// Raw message from Apple's chat.db
export interface RawMessage {
  rowid: number
  text: string | null
  date: number // Apple's nanoseconds since 2001-01-01
  is_from_me: number // 0 or 1
  handle_id: number
  service: string | null
}

// Joined message with sender and chat info
export interface JoinedMessage {
  rowid: number
  text: string | null
  date: number
  is_from_me: number
  sender_id: string | null // phone number or email
  chat_name: string | null // display name or chat identifier
  chat_id: number
  service: string | null
}

// Indexed message stored in our FTS5 database
export interface IndexedMessage {
  id: number // same as rowid from chat.db
  text: string
  sender: string
  chatName: string
  chatId: number
  date: number // Unix timestamp (seconds)
  isFromMe: boolean
}

// Search result with relevance score
export interface SearchResult {
  message: IndexedMessage
  score: number
  matchedTerms: string[]
}

// Search result with context (surrounding messages)
export interface SearchResultWithContext {
  result: SearchResult
  before: IndexedMessage[]
  after: IndexedMessage[]
}

// Search options for the CLI
export interface SearchOptions {
  query: string
  from?: string // filter by sender
  after?: Date // filter by date
  limit: number
  context: number // number of messages before/after to show
}

// Index stats
export interface IndexStats {
  totalMessages: number
  totalChats: number
  totalContacts: number
  indexedAt: Date
  oldestMessage: Date
  newestMessage: Date
}

// Apple date constants
export const APPLE_EPOCH_OFFSET = 978307200 // seconds between Unix epoch and Apple epoch (2001-01-01)
export const NANOSECONDS_PER_SECOND = 1_000_000_000

// Convert Apple nanoseconds to Unix timestamp (seconds)
export function appleToUnix(appleDate: number): number {
  return Math.floor(appleDate / NANOSECONDS_PER_SECOND) + APPLE_EPOCH_OFFSET
}

// Convert Unix timestamp to JavaScript Date
export function unixToDate(unixTimestamp: number): Date {
  return new Date(unixTimestamp * 1000)
}

// Convert Apple nanoseconds to JavaScript Date
export function appleToDate(appleDate: number): Date {
  return unixToDate(appleToUnix(appleDate))
}
