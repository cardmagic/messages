import { describe, it, expect } from 'vitest'
import { normalizePhone, extractTextFallback } from './indexer.js'

describe('normalizePhone', () => {
  it('strips non-digit characters except leading +', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567')
  })

  it('removes +1 country code from US numbers', () => {
    expect(normalizePhone('+15551234567')).toBe('5551234567')
  })

  it('removes leading 1 from 11-digit US numbers', () => {
    expect(normalizePhone('15551234567')).toBe('5551234567')
  })

  it('keeps international numbers without US prefix', () => {
    expect(normalizePhone('+447911123456')).toBe('447911123456')
  })

  it('handles already clean numbers', () => {
    expect(normalizePhone('5551234567')).toBe('5551234567')
  })

  it('strips dashes and spaces', () => {
    expect(normalizePhone('555-123-4567')).toBe('5551234567')
  })

  it('strips dots', () => {
    expect(normalizePhone('555.123.4567')).toBe('5551234567')
  })

  it('removes leading + from non-US numbers', () => {
    expect(normalizePhone('+33612345678')).toBe('33612345678')
  })

  it('handles empty string', () => {
    expect(normalizePhone('')).toBe('')
  })
})

describe('extractTextFallback', () => {
  it('returns null for empty buffer', () => {
    expect(extractTextFallback(Buffer.alloc(0))).toBeNull()
  })

  it('returns null for buffer with only binary data', () => {
    expect(extractTextFallback(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBeNull()
  })

  it('extracts text from the plus pattern', () => {
    // Simulate the \x01+text\x86 pattern
    const buf = Buffer.from('\x01+Hello this is a message\x86', 'latin1')
    const result = extractTextFallback(buf)
    expect(result).toBe('Hello this is a message')
  })

  it('falls back to longest readable sequence when no plus pattern', () => {
    const buf = Buffer.concat([
      Buffer.from([0x00, 0x01, 0x02]),
      Buffer.from('This is readable text content', 'latin1'),
      Buffer.from([0x00, 0x01]),
    ])
    const result = extractTextFallback(buf)
    expect(result).toBe('This is readable text content')
  })

  it('filters out NSString and other Objective-C class names', () => {
    const buf = Buffer.concat([
      Buffer.from('NSString', 'latin1'),
      Buffer.from([0x00]),
      Buffer.from('NSDictionary', 'latin1'),
      Buffer.from([0x00]),
      Buffer.from('Actual message text here', 'latin1'),
    ])
    const result = extractTextFallback(buf)
    expect(result).not.toContain('NSString')
    expect(result).not.toContain('NSDictionary')
    expect(result).toBe('Actual message text here')
  })

  it('cleans control characters from extracted text', () => {
    const buf = Buffer.from('\x01+Hello\x00\x0Fworld\x86', 'latin1')
    const result = extractTextFallback(buf)
    expect(result).toBe('Helloworld')
  })
})
