import Database from 'better-sqlite3'
import MiniSearch from 'minisearch'
import { existsSync, readFileSync } from 'node:fs'
import { getIndexDbPath, getFuzzyIndexPath, ensureIndex } from './indexer.js'
import type {
  IndexedMessage,
  SearchResult,
  SearchResultWithContext,
  SearchOptions,
} from './types.js'

let cachedDb: ReturnType<typeof Database> | null = null
let cachedMiniSearch: MiniSearch<IndexedMessage> | null = null

function getDb(): ReturnType<typeof Database> {
  if (!cachedDb) {
    const dbPath = getIndexDbPath()
    if (!existsSync(dbPath)) {
      throw new Error('Index not found. Run `txts index` first.')
    }
    cachedDb = new Database(dbPath, { readonly: true })
  }
  return cachedDb
}

function getMiniSearch(): MiniSearch<IndexedMessage> {
  if (!cachedMiniSearch) {
    const fuzzyPath = getFuzzyIndexPath()
    if (!existsSync(fuzzyPath)) {
      throw new Error('Fuzzy index not found. Run `txts index` first.')
    }
    const raw = readFileSync(fuzzyPath, 'utf-8')
    cachedMiniSearch = MiniSearch.loadJSON<IndexedMessage>(raw, {
      fields: ['text', 'sender', 'chatName'],
      storeFields: ['id', 'text', 'sender', 'chatName', 'chatId', 'date', 'isFromMe'],
    })
  }
  return cachedMiniSearch
}

function rowToMessage(row: unknown): IndexedMessage {
  const r = row as {
    id: number
    text: string
    sender: string
    chatName: string
    chatId: number
    date: number
    isFromMe: number
  }
  return {
    id: r.id,
    text: r.text,
    sender: r.sender,
    chatName: r.chatName,
    chatId: r.chatId,
    date: r.date,
    isFromMe: r.isFromMe === 1,
  }
}

// Search by sender using SQLite (for "from X" queries without text search)
function searchBySender(
  db: ReturnType<typeof Database>,
  from: string,
  after: Date | undefined,
  limit: number
): SearchResult[] {
  const fromLower = from.toLowerCase()
  const afterTimestamp = after ? Math.floor(after.getTime() / 1000) : 0

  // Query messages where sender matches AND is not from me (messages actually sent by that person)
  const query = db.prepare(`
    SELECT id, text, sender, chat_name as chatName, chat_id as chatId, date, is_from_me as isFromMe
    FROM messages
    WHERE LOWER(sender) LIKE ?
      AND is_from_me = 0
      AND date >= ?
    ORDER BY date DESC
    LIMIT ?
  `)

  const pattern = `%${fromLower}%`
  const rows = query.all(pattern, afterTimestamp, limit)

  return rows.map((row) => {
    const msg = rowToMessage(row)
    return {
      message: msg,
      score: 1.0, // No relevance score for direct queries
      matchedTerms: [],
    }
  })
}

// Search by text with optional sender filter
function searchByText(
  query: string,
  from: string | undefined,
  after: Date | undefined,
  limit: number
): SearchResult[] {
  const miniSearch = getMiniSearch()

  // Build filter function for MiniSearch
  const fromLower = from?.toLowerCase()
  const afterTimestamp = after ? Math.floor(after.getTime() / 1000) : undefined

  // When filtering, search with a higher limit to ensure we get enough results after filtering
  const hasFilters = from || after
  const searchLimit = hasFilters ? limit * 20 : limit

  // Use MiniSearch for fuzzy search with typo tolerance
  const fuzzyResults = miniSearch.search(query, {
    fuzzy: 0.2,
    prefix: true,
    boost: { text: 2, sender: 1.5, chatName: 1 },
    // Apply filter during search when possible
    // Filter for messages actually sent by this person (not from me)
    filter: fromLower
      ? (result) => {
          const sender = (result.sender as string).toLowerCase()
          const isFromMe = result.isFromMe as boolean
          return !isFromMe && sender.includes(fromLower)
        }
      : undefined,
  })

  if (fuzzyResults.length === 0) {
    return []
  }

  // Convert to SearchResult[]
  let results: SearchResult[] = fuzzyResults.slice(0, searchLimit).map((result) => ({
    message: {
      id: result.id as number,
      text: result.text as string,
      sender: result.sender as string,
      chatName: result.chatName as string,
      chatId: result.chatId as number,
      date: result.date as number,
      isFromMe: result.isFromMe as boolean,
    },
    score: result.score,
    matchedTerms: result.terms,
  }))

  // Apply date filter if specified
  if (afterTimestamp) {
    results = results.filter((r) => r.message.date >= afterTimestamp)
  }

  // Apply limit
  return results.slice(0, limit)
}

export function search(options: SearchOptions): SearchResultWithContext[] {
  // Auto-rebuild index if source database has changed
  const wasRebuilt = ensureIndex()
  if (wasRebuilt) {
    // Clear caches since index was rebuilt
    clearCaches()
  }

  const { query, from, after, limit, context } = options
  const db = getDb()

  let results: SearchResult[]

  // Normalize empty or wildcard queries
  const hasTextQuery = query && query !== '*' && query.trim() !== ''

  if (from && !hasTextQuery) {
    // Sender-only query - use SQLite directly
    results = searchBySender(db, from, after, limit)
  } else if (hasTextQuery) {
    // Text search with optional sender filter
    results = searchByText(query, from, after, limit)
  } else {
    // No query and no from - return empty
    return []
  }

  // Get context for each result
  const resultsWithContext: SearchResultWithContext[] = []

  const contextQuery = db.prepare(`
    SELECT id, text, sender, chat_name as chatName, chat_id as chatId, date, is_from_me as isFromMe
    FROM messages
    WHERE chat_id = ? AND date < ?
    ORDER BY date DESC
    LIMIT ?
  `)

  const afterContextQuery = db.prepare(`
    SELECT id, text, sender, chat_name as chatName, chat_id as chatId, date, is_from_me as isFromMe
    FROM messages
    WHERE chat_id = ? AND date > ?
    ORDER BY date ASC
    LIMIT ?
  `)

  for (const result of results) {
    const before = contextQuery
      .all(result.message.chatId, result.message.date, context)
      .reverse()
      .map(rowToMessage)

    const after = afterContextQuery
      .all(result.message.chatId, result.message.date, context)
      .map(rowToMessage)

    resultsWithContext.push({
      result,
      before,
      after,
    })
  }

  return resultsWithContext
}

function clearCaches(): void {
  if (cachedDb) {
    cachedDb.close()
    cachedDb = null
  }
  cachedMiniSearch = null
}

export function closeConnections(): void {
  clearCaches()
}

// Browse functions

export interface RecentMessage {
  message: IndexedMessage
  chatName: string
}

export function getRecentMessages(limit: number): RecentMessage[] {
  ensureIndex()
  const db = getDb()

  const query = db.prepare(`
    SELECT id, text, sender, chat_name as chatName, chat_id as chatId, date, is_from_me as isFromMe
    FROM messages
    ORDER BY date DESC
    LIMIT ?
  `)

  const rows = query.all(limit)
  return rows.map((row) => ({
    message: rowToMessage(row),
    chatName: (row as { chatName: string }).chatName,
  }))
}

export interface ContactInfo {
  name: string
  lastMessageDate: number
  messageCount: number
}

export function getContacts(limit: number): ContactInfo[] {
  ensureIndex()
  const db = getDb()

  const query = db.prepare(`
    SELECT
      chat_name as name,
      MAX(date) as lastMessageDate,
      COUNT(*) as messageCount
    FROM messages
    WHERE chat_name != ''
    GROUP BY chat_name
    ORDER BY lastMessageDate DESC
    LIMIT ?
  `)

  const rows = query.all(limit) as ContactInfo[]
  return rows
}

export interface ConversationInfo {
  chatId: number
  chatName: string
  lastMessageDate: number
  messageCount: number
  lastMessage: string
}

export function getConversations(limit: number): ConversationInfo[] {
  ensureIndex()
  const db = getDb()

  const query = db.prepare(`
    SELECT
      chat_id as chatId,
      chat_name as chatName,
      MAX(date) as lastMessageDate,
      COUNT(*) as messageCount,
      (SELECT text FROM messages m2 WHERE m2.chat_id = messages.chat_id ORDER BY date DESC LIMIT 1) as lastMessage
    FROM messages
    WHERE chat_name != ''
    GROUP BY chat_id
    ORDER BY lastMessageDate DESC
    LIMIT ?
  `)

  const rows = query.all(limit) as ConversationInfo[]
  return rows
}

export interface ThreadOptions {
  after?: Date
  limit?: number
}

export function getThread(contact: string, options: ThreadOptions = {}): IndexedMessage[] {
  ensureIndex()
  const db = getDb()

  const contactLower = contact.toLowerCase()
  const afterTimestamp = options.after ? Math.floor(options.after.getTime() / 1000) : 0
  const limit = options.limit ?? 100

  const query = db.prepare(`
    SELECT id, text, sender, chat_name as chatName, chat_id as chatId, date, is_from_me as isFromMe
    FROM messages
    WHERE LOWER(chat_name) LIKE ?
      AND date >= ?
    ORDER BY date ASC
    LIMIT ?
  `)

  const pattern = `%${contactLower}%`
  const rows = query.all(pattern, afterTimestamp, limit)
  return rows.map(rowToMessage)
}
