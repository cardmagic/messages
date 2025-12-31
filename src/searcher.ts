import Database from 'better-sqlite3'
import MiniSearch from 'minisearch'
import { existsSync, readFileSync } from 'node:fs'
import { getIndexDbPath, getFuzzyIndexPath, indexExists } from './indexer.js'
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
    const data = JSON.parse(raw)
    cachedMiniSearch = MiniSearch.loadJSON<IndexedMessage>(raw, {
      fields: ['text', 'sender', 'chatName'],
      storeFields: ['id', 'text', 'sender', 'chatName', 'chatId', 'date', 'isFromMe'],
    })
  }
  return cachedMiniSearch
}

export function search(options: SearchOptions): SearchResultWithContext[] {
  if (!indexExists()) {
    throw new Error('Index not found. Run `txts index` first.')
  }

  const { query, from, after, limit, context } = options
  const miniSearch = getMiniSearch()
  const db = getDb()

  // Use MiniSearch for fuzzy search with typo tolerance
  const fuzzyResults = miniSearch.search(query, {
    fuzzy: 0.2, // 20% of term length allowed as edit distance
    prefix: true,
    boost: { text: 2, sender: 1.5, chatName: 1 },
  })

  if (fuzzyResults.length === 0) {
    return []
  }

  // Get the matched message IDs
  let results: SearchResult[] = fuzzyResults.map((result) => ({
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

  // Apply filters
  if (from) {
    const fromLower = from.toLowerCase()
    results = results.filter(
      (r) =>
        r.message.sender.toLowerCase().includes(fromLower) ||
        r.message.chatName.toLowerCase().includes(fromLower)
    )
  }

  if (after) {
    const afterTimestamp = Math.floor(after.getTime() / 1000)
    results = results.filter((r) => r.message.date >= afterTimestamp)
  }

  // Limit results
  results = results.slice(0, limit)

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

export function closeConnections(): void {
  if (cachedDb) {
    cachedDb.close()
    cachedDb = null
  }
  cachedMiniSearch = null
}
