import { describe, it, expect, beforeAll } from 'vitest'
import chalk from 'chalk'
import {
  formatSearchResult,
  formatStats,
  formatNoResults,
  formatIndexProgress,
} from './formatter.js'
import type { IndexedMessage, SearchResultWithContext, IndexStats } from './types.js'

beforeAll(() => {
  chalk.level = 0
})

function makeMessage(overrides: Partial<IndexedMessage> = {}): IndexedMessage {
  return {
    id: 1,
    text: 'Hello there',
    sender: 'John',
    chatName: 'John Smith',
    chatId: 100,
    date: 1704067200,
    isFromMe: false,
    ...overrides,
  }
}

function makeSearchResultWithContext(
  overrides: Partial<IndexedMessage> = {},
  context: { before?: IndexedMessage[]; after?: IndexedMessage[] } = {}
): SearchResultWithContext {
  const message = makeMessage(overrides)
  return {
    result: {
      message,
      score: 5.0,
      matchedTerms: ['hello'],
    },
    before: context.before || [],
    after: context.after || [],
  }
}

describe('formatSearchResult', () => {
  it('includes the chat name', () => {
    const output = formatSearchResult(makeSearchResultWithContext({ chatName: 'Alice' }), 0)
    expect(output).toContain('Alice')
  })

  it('includes the message text', () => {
    const output = formatSearchResult(makeSearchResultWithContext({ text: 'Important message' }), 0)
    expect(output).toContain('Important message')
  })

  it('includes the sender name', () => {
    const output = formatSearchResult(makeSearchResultWithContext({ sender: 'Bob', isFromMe: false }), 0)
    expect(output).toContain('Bob')
  })

  it('shows "You" for outgoing messages', () => {
    const output = formatSearchResult(makeSearchResultWithContext({ isFromMe: true }), 0)
    expect(output).toContain('You')
  })

  it('includes context messages before', () => {
    const before = [makeMessage({ text: 'Before message', sender: 'Eve' })]
    const output = formatSearchResult(makeSearchResultWithContext({}, { before }), 0)
    expect(output).toContain('Before message')
  })

  it('includes context messages after', () => {
    const after = [makeMessage({ text: 'After message', sender: 'Eve' })]
    const output = formatSearchResult(makeSearchResultWithContext({}, { after }), 0)
    expect(output).toContain('After message')
  })

  it('truncates long sender names', () => {
    const longSender = 'A'.repeat(25)
    const output = formatSearchResult(makeSearchResultWithContext({ sender: longSender, isFromMe: false }), 0)
    expect(output).toContain('...')
  })
})

describe('formatStats', () => {
  it('includes message count', () => {
    const stats: IndexStats = {
      totalMessages: 1234,
      totalChats: 56,
      totalContacts: 78,
      indexedAt: new Date('2024-01-01'),
      oldestMessage: new Date('2020-01-01'),
      newestMessage: new Date('2024-01-01'),
    }
    const output = formatStats(stats)
    expect(output).toContain('1,234')
    expect(output).toContain('56')
    expect(output).toContain('78')
  })

  it('includes date range', () => {
    const stats: IndexStats = {
      totalMessages: 100,
      totalChats: 10,
      totalContacts: 5,
      indexedAt: new Date('2024-06-15T12:00:00Z'),
      oldestMessage: new Date('2023-06-15T12:00:00Z'),
      newestMessage: new Date('2024-06-15T12:00:00Z'),
    }
    const output = formatStats(stats)
    expect(output).toContain('Date range:')
    expect(output).toMatch(/\d{4}/) // contains years
  })
})

describe('formatNoResults', () => {
  it('includes the query in the message', () => {
    const output = formatNoResults('test query')
    expect(output).toContain('test query')
  })

  it('indicates no messages were found', () => {
    const output = formatNoResults('foo')
    expect(output.toLowerCase()).toContain('no messages found')
  })
})

describe('formatIndexProgress', () => {
  it('shows reading phase with progress', () => {
    const output = formatIndexProgress('reading', 50, 200)
    expect(output).toContain('Reading messages')
    expect(output).toContain('25%')
    expect(output).toContain('50')
    expect(output).toContain('200')
  })

  it('shows FTS indexing phase', () => {
    const output = formatIndexProgress('indexing-fts', 100, 100)
    expect(output).toContain('Building search index')
    expect(output).toContain('100%')
  })

  it('shows fuzzy indexing phase', () => {
    const output = formatIndexProgress('indexing-fuzzy', 75, 100)
    expect(output).toContain('Building fuzzy index')
    expect(output).toContain('75%')
  })

  it('shows done phase', () => {
    const output = formatIndexProgress('done', 100, 100)
    expect(output).toContain('Done')
  })

  it('handles unknown phases gracefully', () => {
    const output = formatIndexProgress('custom-phase', 50, 100)
    expect(output).toContain('custom-phase')
    expect(output).toContain('50%')
  })
})
