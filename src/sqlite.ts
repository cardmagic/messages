import type BetterSqlite3 from 'better-sqlite3'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type SqliteConstructor = typeof BetterSqlite3

let cachedConstructor: SqliteConstructor | null = null
let attemptedNativeRebuild = false

interface SqliteLoadResult {
  constructor: SqliteConstructor | null
  error: unknown
}

function verifySqliteModule(sqlite: SqliteConstructor): void {
  const db = new sqlite(':memory:')
  db.close()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }

  return 'Unknown error loading better-sqlite3.'
}

function loadSqliteModule(): SqliteLoadResult {
  try {
    const sqlite = require('better-sqlite3') as SqliteConstructor
    verifySqliteModule(sqlite)
    return { constructor: sqlite, error: null }
  } catch (error) {
    return { constructor: null, error }
  }
}

function isNativeBindingError(error: unknown): boolean {
  const message = getErrorMessage(error)

  if (message.includes('Could not locate the bindings file')) {
    return true
  }

  if (message.includes('NODE_MODULE_VERSION')) {
    return true
  }

  return false
}

function rebuildNativeModule(): boolean {
  const rebuild = spawnSync('npm', ['rebuild', 'better-sqlite3'], {
    cwd: packageRoot,
    encoding: 'utf-8',
    stdio: 'pipe',
  })

  return rebuild.status === 0
}

function formatLoadError(error: unknown): string {
  const message = getErrorMessage(error)

  if (!isNativeBindingError(error)) {
    return message
  }

  return [
    'Could not load better-sqlite3 native bindings.',
    'This often happens with Homebrew installs because npm install scripts are skipped.',
    `Tried auto-rebuilding in ${packageRoot} but it still failed.`,
    'Fix: run `npm rebuild better-sqlite3` in the package directory,',
    'or if that fails, run `npm rebuild better-sqlite3 --build-from-source`,',
    'or reinstall with `npm install -g @cardmagic/messages`.',
  ].join(' ')
}

export function getSqliteConstructor(): SqliteConstructor {
  if (cachedConstructor) {
    return cachedConstructor
  }

  const firstLoad = loadSqliteModule()
  if (firstLoad.constructor) {
    cachedConstructor = firstLoad.constructor
    return cachedConstructor
  }

  if (!isNativeBindingError(firstLoad.error)) {
    throw new Error(formatLoadError(firstLoad.error))
  }

  if (!attemptedNativeRebuild) {
    attemptedNativeRebuild = true
    const rebuilt = rebuildNativeModule()

    if (rebuilt) {
      const secondLoad = loadSqliteModule()
      if (secondLoad.constructor) {
        cachedConstructor = secondLoad.constructor
        return cachedConstructor
      }
      throw new Error(formatLoadError(secondLoad.error))
    }
  }

  throw new Error(formatLoadError(firstLoad.error))
}
