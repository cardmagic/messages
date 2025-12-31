import Database from 'better-sqlite3'
import MiniSearch from 'minisearch'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Unarchiver } from 'node-typedstream'
import type { IndexedMessage, IndexStats } from './types.js'
import { appleToUnix } from './types.js'

// Normalize phone number for matching (remove all non-digit characters except +)
function normalizePhone(phone: string): string {
  // Keep only digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '')
  // Remove leading + and country code 1 for US numbers for matching
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return cleaned.slice(2)
  }
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return cleaned.slice(1)
  }
  return cleaned.replace(/^\+/, '')
}

// Build contact lookup from AddressBook databases
function buildContactLookup(): Map<string, string> {
  const lookup = new Map<string, string>()
  const addressBookDir = join(homedir(), 'Library', 'Application Support', 'AddressBook')
  const sourcesDir = join(addressBookDir, 'Sources')

  if (!existsSync(sourcesDir)) {
    return lookup
  }

  // Find all AddressBook databases in Sources subdirectories
  const sources = readdirSync(sourcesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(sourcesDir, d.name, 'AddressBook-v22.abcddb'))
    .filter(p => existsSync(p))

  // Also check the main AddressBook database
  const mainDb = join(addressBookDir, 'AddressBook-v22.abcddb')
  if (existsSync(mainDb)) {
    sources.push(mainDb)
  }

  // Sort by contact count (most contacts first) so the primary/largest DB wins
  sources.sort((a, b) => {
    try {
      const dbA = new Database(a, { readonly: true })
      const dbB = new Database(b, { readonly: true })
      const countA = (dbA.prepare('SELECT COUNT(*) as c FROM ZABCDRECORD').get() as { c: number }).c
      const countB = (dbB.prepare('SELECT COUNT(*) as c FROM ZABCDRECORD').get() as { c: number }).c
      dbA.close()
      dbB.close()
      return countB - countA
    } catch {
      return 0
    }
  })

  for (const dbPath of sources) {
    try {
      const db = new Database(dbPath, { readonly: true })

      // Get phone numbers with contact names
      const phoneQuery = `
        SELECT
          TRIM(COALESCE(r.ZFIRSTNAME, '') || ' ' || COALESCE(r.ZLASTNAME, '')) as name,
          COALESCE(r.ZORGANIZATION, '') as org,
          p.ZFULLNUMBER as phone
        FROM ZABCDRECORD r
        JOIN ZABCDPHONENUMBER p ON r.Z_PK = p.ZOWNER
        WHERE p.ZFULLNUMBER IS NOT NULL
      `
      const phones = db.prepare(phoneQuery).all() as { name: string; org: string; phone: string }[]

      for (const { name, org, phone } of phones) {
        const displayName = name.trim() || org.trim() || null
        if (displayName && phone) {
          const normalized = normalizePhone(phone)
          if (normalized.length >= 7) {
            // Only set if not already in lookup (first/newest source wins)
            if (!lookup.has(normalized)) {
              lookup.set(normalized, displayName)
            }
            // Also store last 10 digits for matching
            if (normalized.length > 10) {
              const last10 = normalized.slice(-10)
              if (!lookup.has(last10)) {
                lookup.set(last10, displayName)
              }
            }
          }
        }
      }

      // Get email addresses with contact names
      const emailQuery = `
        SELECT
          TRIM(COALESCE(r.ZFIRSTNAME, '') || ' ' || COALESCE(r.ZLASTNAME, '')) as name,
          COALESCE(r.ZORGANIZATION, '') as org,
          LOWER(e.ZADDRESS) as email
        FROM ZABCDRECORD r
        JOIN ZABCDEMAILADDRESS e ON r.Z_PK = e.ZOWNER
        WHERE e.ZADDRESS IS NOT NULL
      `
      const emails = db.prepare(emailQuery).all() as { name: string; org: string; email: string }[]

      for (const { name, org, email } of emails) {
        const displayName = name.trim() || org.trim() || null
        if (displayName && email) {
          const emailLower = email.toLowerCase()
          // Only set if not already in lookup (first/newest source wins)
          if (!lookup.has(emailLower)) {
            lookup.set(emailLower, displayName)
          }
        }
      }

      db.close()
    } catch {
      // Skip databases that can't be read
    }
  }

  return lookup
}

// Raw message from query with attributedBody
interface RawQueryMessage {
  rowid: number
  text: string | null
  attributedBody: Buffer | null
  date: number
  is_from_me: number
  sender_id: string | null
  chat_name: string | null
  chat_id: number
  service: string | null
}

// Extract plain text from NSAttributedString blob using node-typedstream
function extractTextFromAttributedBody(blob: Buffer): string | null {
  if (!blob || blob.length === 0) return null

  try {
    // Parse the typedstream format using Unarchiver
    const unarchiver = Unarchiver.open(blob)
    const parsed = unarchiver.decodeSingleRoot()

    // Try to find the string content in the parsed object
    const findString = (obj: unknown, depth = 0): string | null => {
      if (depth > 10) return null

      if (typeof obj === 'string' && obj.length > 0) {
        return obj.trim()
      }

      if (Array.isArray(obj)) {
        for (const item of obj) {
          const result = findString(item, depth + 1)
          if (result) return result
        }
      }

      if (obj && typeof obj === 'object') {
        // Check for NSString property first
        const o = obj as Record<string, unknown>
        if ('NSString' in o && typeof o.NSString === 'string') {
          return o.NSString.trim()
        }
        if ('string' in o && typeof o.string === 'string') {
          return o.string.trim()
        }

        // Recursively search other properties
        for (const value of Object.values(o)) {
          const result = findString(value, depth + 1)
          if (result) return result
        }
      }

      return null
    }

    return findString(parsed)
  } catch {
    // Fall back to simpler pattern matching if parsing fails
    return extractTextFallback(blob)
  }
}

// Fallback text extraction using pattern matching
function extractTextFallback(blob: Buffer): string | null {
  try {
    const blobStr = blob.toString('latin1')

    // Look for the pattern with + character that contains the text
    // oxlint-disable-next-line no-control-regex -- Parsing binary blob data
    const plusPattern = /\x01\+(.{1,2000}?)\x86/s
    const match = blobStr.match(plusPattern)
    if (match && match[1]) {
      // oxlint-disable-next-line no-control-regex -- Cleaning binary data
      const cleaned = match[1].replace(/[\x00-\x1F\x80-\x9F]/g, '').trim()
      if (cleaned.length > 0) {
        return cleaned
      }
    }

    // Find the longest sequence of printable characters
    const readablePattern = /[\x20-\x7E\u00A0-\uFFFF]{5,}/g
    const matches = blobStr.match(readablePattern)
    if (matches && matches.length > 0) {
      const filtered = matches.filter(
        (m) =>
          !m.includes('NSString') &&
          !m.includes('NSDictionary') &&
          !m.includes('NSMutable') &&
          !m.includes('streamtyped') &&
          !m.includes('NSObject') &&
          m.length > 3
      )
      if (filtered.length > 0) {
        return filtered.sort((a, b) => b.length - a.length)[0].trim()
      }
    }

    return null
  } catch {
    return null
  }
}

const MESSAGES_DIR = join(homedir(), '.messages')
const INDEX_DB_PATH = join(MESSAGES_DIR, 'index.db')
const FUZZY_INDEX_PATH = join(MESSAGES_DIR, 'fuzzy.json')
const STATS_PATH = join(MESSAGES_DIR, 'stats.json')
const MESSAGES_DB_PATH = join(homedir(), 'Library', 'Messages', 'chat.db')

export function ensureIndexDir(): void {
  if (!existsSync(MESSAGES_DIR)) {
    mkdirSync(MESSAGES_DIR, { recursive: true })
  }
}

export function getIndexDbPath(): string {
  return INDEX_DB_PATH
}

export function getFuzzyIndexPath(): string {
  return FUZZY_INDEX_PATH
}

export function indexExists(): boolean {
  return existsSync(INDEX_DB_PATH) && existsSync(FUZZY_INDEX_PATH)
}

// Check if the source chat.db has been modified since the index was built
export function indexNeedsRebuild(): boolean {
  if (!indexExists()) {
    return true
  }

  if (!existsSync(MESSAGES_DB_PATH)) {
    return false // No source db, can't rebuild anyway
  }

  try {
    const sourceModTime = statSync(MESSAGES_DB_PATH).mtime.getTime()
    const indexModTime = statSync(INDEX_DB_PATH).mtime.getTime()
    return sourceModTime > indexModTime
  } catch {
    return true // If we can't check, rebuild to be safe
  }
}

// Ensure index is up to date, rebuilding if necessary
// Returns true if rebuild was performed
export function ensureIndex(
  onProgress?: (progress: IndexProgress) => void
): boolean {
  if (!indexNeedsRebuild()) {
    return false
  }
  buildIndex(onProgress)
  return true
}

export function getStats(): IndexStats | null {
  if (!existsSync(STATS_PATH)) {
    return null
  }
  const raw = readFileSync(STATS_PATH, 'utf-8')
  const data = JSON.parse(raw)
  return {
    ...data,
    indexedAt: new Date(data.indexedAt),
    oldestMessage: new Date(data.oldestMessage),
    newestMessage: new Date(data.newestMessage),
  }
}

function saveStats(stats: IndexStats): void {
  writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2))
}

export interface IndexProgress {
  current: number
  total: number
  phase: 'reading' | 'indexing-fts' | 'indexing-fuzzy' | 'done'
}

export function buildIndex(
  onProgress?: (progress: IndexProgress) => void
): IndexStats {
  ensureIndexDir()

  // Open Apple Messages database (read-only)
  if (!existsSync(MESSAGES_DB_PATH)) {
    throw new Error(
      `Messages database not found at ${MESSAGES_DB_PATH}. Make sure you have Full Disk Access enabled for your terminal.`
    )
  }

  const messagesDb = new Database(MESSAGES_DB_PATH, { readonly: true })

  // Build contact lookup from AddressBook
  const contactLookup = buildContactLookup()

  // Helper to resolve contact name from phone/email
  const resolveContactName = (identifier: string | null): string | null => {
    if (!identifier) return null

    // Try email lookup (case insensitive)
    if (identifier.includes('@')) {
      const name = contactLookup.get(identifier.toLowerCase())
      if (name) return name
      return identifier // Return email as-is if not found
    }

    // Try phone lookup
    const normalized = normalizePhone(identifier)
    if (normalized.length >= 7) {
      // Try full number
      let name = contactLookup.get(normalized)
      if (name) return name

      // Try last 10 digits
      if (normalized.length > 10) {
        name = contactLookup.get(normalized.slice(-10))
        if (name) return name
      }

      // Try last 7 digits (local number)
      name = contactLookup.get(normalized.slice(-7))
      if (name) return name
    }

    return identifier // Return original if not found
  }

  // Query all messages with sender and chat info
  // Include attributedBody for messages where text is null
  // Use GROUP BY to avoid duplicates from multiple chat_message_join entries
  const query = `
    SELECT
      m.ROWID as rowid,
      m.text,
      m.attributedBody,
      m.date,
      m.is_from_me,
      h.id as sender_id,
      COALESCE(c.display_name, c.chat_identifier) as chat_name,
      c.ROWID as chat_id,
      m.service
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    LEFT JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE m.text IS NOT NULL OR m.attributedBody IS NOT NULL
    GROUP BY m.ROWID
    ORDER BY m.date ASC
  `

  const rawMessages = messagesDb.prepare(query).all() as RawQueryMessage[]

  // Extract text from attributedBody when text is null
  // Also resolve contact names for sender and chat
  const messages = rawMessages
    .map((msg) => {
      let text = msg.text
      if (!text && msg.attributedBody) {
        text = extractTextFromAttributedBody(msg.attributedBody)
      }

      // Resolve sender name from contacts
      const senderName = resolveContactName(msg.sender_id)

      // Resolve chat name - prefer display_name from db, otherwise resolve from identifier
      let chatName = msg.chat_name
      if (!chatName || chatName === msg.sender_id) {
        // No display name set, try to resolve from sender
        chatName = senderName
      } else if (chatName && (chatName.startsWith('+') || chatName.includes('@'))) {
        // Chat name is a phone number or email, try to resolve
        chatName = resolveContactName(chatName) || chatName
      }

      return {
        rowid: msg.rowid,
        text,
        date: msg.date,
        is_from_me: msg.is_from_me,
        sender_id: senderName,
        chat_name: chatName,
        chat_id: msg.chat_id,
        service: msg.service,
      }
    })
    .filter((msg) => msg.text && msg.text.trim().length > 0)
  messagesDb.close()

  const total = messages.length
  onProgress?.({ current: 0, total, phase: 'reading' })

  // Create our index database
  if (existsSync(INDEX_DB_PATH)) {
    // Remove old index
    unlinkSync(INDEX_DB_PATH)
  }

  const indexDb = new Database(INDEX_DB_PATH)

  // Create FTS5 virtual table
  indexDb.exec(`
    CREATE VIRTUAL TABLE messages_fts USING fts5(
      id,
      text,
      sender,
      chat_name,
      chat_id,
      date,
      is_from_me,
      tokenize = 'porter unicode61'
    );
  `)

  // Also create a regular table for context lookups (FTS5 doesn't support efficient range queries)
  indexDb.exec(`
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL,
      sender TEXT,
      chat_name TEXT,
      chat_id INTEGER,
      date INTEGER NOT NULL,
      is_from_me INTEGER NOT NULL
    );
    CREATE INDEX idx_messages_chat_date ON messages(chat_id, date);
    CREATE INDEX idx_messages_date ON messages(date);
  `)

  const insertFts = indexDb.prepare(`
    INSERT INTO messages_fts (id, text, sender, chat_name, chat_id, date, is_from_me)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMessages = indexDb.prepare(`
    INSERT INTO messages (id, text, sender, chat_name, chat_id, date, is_from_me)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  // Build MiniSearch index for fuzzy matching
  const miniSearch = new MiniSearch<IndexedMessage>({
    fields: ['text', 'sender', 'chatName'],
    storeFields: ['id', 'text', 'sender', 'chatName', 'chatId', 'date', 'isFromMe'],
    searchOptions: {
      boost: { text: 2, sender: 1.5, chatName: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  })

  let oldestDate = Infinity
  let newestDate = 0
  const indexedMessages: IndexedMessage[] = []

  // Type for filtered messages
  type FilteredMessage = {
    rowid: number
    text: string | null
    date: number
    is_from_me: number
    sender_id: string | null
    chat_name: string | null
    chat_id: number
    service: string | null
  }

  // Insert messages in a transaction for performance
  const insertBatch = indexDb.transaction(
    (batch: { indexed: IndexedMessage; raw: FilteredMessage }[]) => {
      for (const { indexed, raw: _raw } of batch) {
        insertFts.run(
          indexed.id,
          indexed.text,
          indexed.sender,
          indexed.chatName,
          indexed.chatId,
          indexed.date,
          indexed.isFromMe ? 1 : 0
        )
        insertMessages.run(
          indexed.id,
          indexed.text,
          indexed.sender,
          indexed.chatName,
          indexed.chatId,
          indexed.date,
          indexed.isFromMe ? 1 : 0
        )
      }
    }
  )

  const BATCH_SIZE = 1000
  let batch: { indexed: IndexedMessage; raw: FilteredMessage }[] = []
  let processed = 0

  onProgress?.({ current: 0, total, phase: 'indexing-fts' })

  for (const msg of messages) {
    const unixDate = appleToUnix(msg.date)

    if (unixDate < oldestDate) oldestDate = unixDate
    if (unixDate > newestDate) newestDate = unixDate

    const indexed: IndexedMessage = {
      id: msg.rowid,
      text: msg.text ?? '',
      sender: msg.sender_id ?? 'Unknown',
      chatName: msg.chat_name ?? 'Unknown',
      chatId: msg.chat_id ?? 0,
      date: unixDate,
      isFromMe: msg.is_from_me === 1,
    }

    batch.push({ indexed, raw: msg })
    indexedMessages.push(indexed)

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch)
      batch = []
      processed += BATCH_SIZE
      onProgress?.({ current: processed, total, phase: 'indexing-fts' })
    }
  }

  // Insert remaining messages
  if (batch.length > 0) {
    insertBatch(batch)
    processed += batch.length
    onProgress?.({ current: processed, total, phase: 'indexing-fts' })
  }

  indexDb.close()

  // Build fuzzy index
  onProgress?.({ current: 0, total: indexedMessages.length, phase: 'indexing-fuzzy' })

  // Add documents in batches for MiniSearch
  const MINI_BATCH = 5000
  for (let i = 0; i < indexedMessages.length; i += MINI_BATCH) {
    const slice = indexedMessages.slice(i, i + MINI_BATCH)
    miniSearch.addAll(slice)
    onProgress?.({
      current: Math.min(i + MINI_BATCH, indexedMessages.length),
      total: indexedMessages.length,
      phase: 'indexing-fuzzy',
    })
  }

  // Save fuzzy index
  const serialized = JSON.stringify(miniSearch.toJSON())
  writeFileSync(FUZZY_INDEX_PATH, serialized)

  // Count unique chats and contacts
  const uniqueChats = new Set(indexedMessages.map((m) => m.chatId))
  const uniqueContacts = new Set(indexedMessages.map((m) => m.sender))

  const stats: IndexStats = {
    totalMessages: indexedMessages.length,
    totalChats: uniqueChats.size,
    totalContacts: uniqueContacts.size,
    indexedAt: new Date(),
    oldestMessage: new Date(oldestDate * 1000),
    newestMessage: new Date(newestDate * 1000),
  }

  saveStats(stats)
  onProgress?.({ current: total, total, phase: 'done' })

  return stats
}
