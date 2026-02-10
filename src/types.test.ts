import { describe, it, expect } from 'vitest'
import {
  appleToUnix,
  unixToDate,
  appleToDate,
  APPLE_EPOCH_OFFSET,
  NANOSECONDS_PER_SECOND,
} from './types.js'

describe('appleToUnix', () => {
  it('converts Apple epoch 0 nanoseconds to Unix epoch offset', () => {
    expect(appleToUnix(0)).toBe(APPLE_EPOCH_OFFSET)
  })

  it('converts a known Apple nanosecond timestamp', () => {
    // 2024-01-01 00:00:00 UTC = 1704067200 Unix seconds
    // Apple seconds since 2001 = 725760000
    // Apple nanoseconds = 725760000 * 1_000_000_000
    const appleNanos = 725760000 * NANOSECONDS_PER_SECOND
    expect(appleToUnix(appleNanos)).toBe(1704067200)
  })

  it('floors fractional seconds from nanosecond division', () => {
    // 1.5 seconds in nanoseconds
    const appleNanos = 1.5 * NANOSECONDS_PER_SECOND
    expect(appleToUnix(appleNanos)).toBe(1 + APPLE_EPOCH_OFFSET)
  })

  it('handles zero correctly', () => {
    // Apple epoch 0 = Jan 1, 2001 = Unix 978307200
    expect(appleToUnix(0)).toBe(978307200)
  })
})

describe('unixToDate', () => {
  it('converts Unix epoch 0 to Jan 1 1970', () => {
    const date = unixToDate(0)
    expect(date.getUTCFullYear()).toBe(1970)
    expect(date.getUTCMonth()).toBe(0)
    expect(date.getUTCDate()).toBe(1)
  })

  it('converts a known Unix timestamp to the correct date', () => {
    const date = unixToDate(1704067200) // 2024-01-01
    expect(date.getUTCFullYear()).toBe(2024)
    expect(date.getUTCMonth()).toBe(0)
    expect(date.getUTCDate()).toBe(1)
  })

  it('returns a Date instance', () => {
    expect(unixToDate(1000000)).toBeInstanceOf(Date)
  })
})

describe('appleToDate', () => {
  it('converts Apple epoch 0 to Jan 1 2001', () => {
    const date = appleToDate(0)
    expect(date.getUTCFullYear()).toBe(2001)
    expect(date.getUTCMonth()).toBe(0)
    expect(date.getUTCDate()).toBe(1)
  })

  it('composes appleToUnix and unixToDate correctly', () => {
    const appleNanos = 725760000 * NANOSECONDS_PER_SECOND
    const date = appleToDate(appleNanos)
    expect(date.getUTCFullYear()).toBe(2024)
    expect(date.getUTCMonth()).toBe(0)
    expect(date.getUTCDate()).toBe(1)
  })
})
