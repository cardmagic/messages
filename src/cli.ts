import { program } from 'commander'
import chalk from 'chalk'
import { buildIndex, indexExists, getStats } from './indexer.js'
import { search, closeConnections } from './searcher.js'
import {
  formatSearchResult,
  formatStats,
  formatNoResults,
  formatIndexProgress,
} from './formatter.js'
import type { SearchOptions } from './types.js'

export function runCli(): void {
  program
    .name('messages')
    .description('Fuzzy search through Apple Messages. Run with --mcp for MCP server mode.')
    .version('1.0.0')

  program
    .command('index')
    .description('Build or rebuild the search index from Apple Messages')
    .option('-q, --quiet', 'Suppress progress output')
    .action((options) => {
      console.log(chalk.bold('Building search index...'))
      console.log(
        chalk.dim('Reading from ~/Library/Messages/chat.db (requires Full Disk Access)')
      )
      console.log()

      try {
        const stats = buildIndex((progress) => {
          if (!options.quiet) {
            process.stdout.write(
              '\r' + formatIndexProgress(progress.phase, progress.current, progress.total)
            )
            if (progress.phase === 'done') {
              console.log()
            }
          }
        })

        console.log()
        console.log(chalk.green('\u2713 Index built successfully!'))
        console.log()
        console.log(formatStats(stats))
      } catch (error) {
        console.error(chalk.red('Error building index:'), (error as Error).message)
        process.exit(1)
      }
    })

  program
    .command('search <query>')
    .description('Search messages with fuzzy matching')
    .option('-f, --from <sender>', 'Filter by sender name or phone number')
    .option('-a, --after <date>', 'Show only messages after this date (YYYY-MM-DD)')
    .option('-l, --limit <number>', 'Maximum number of results', '10')
    .option('-c, --context <number>', 'Number of messages to show before/after', '2')
    .action((query, options) => {
      if (!indexExists()) {
        console.error(
          chalk.red('Index not found. Run `messages index` first to build the search index.')
        )
        process.exit(1)
      }

      const searchOptions: SearchOptions = {
        query,
        from: options.from,
        after: options.after ? new Date(options.after) : undefined,
        limit: parseInt(options.limit, 10),
        context: parseInt(options.context, 10),
      }

      try {
        const results = search(searchOptions)

        if (results.length === 0) {
          console.log(formatNoResults(query))
          return
        }

        console.log(
          chalk.dim(`Found ${results.length} result${results.length === 1 ? '' : 's'}:`)
        )
        console.log()

        for (let i = 0; i < results.length; i++) {
          console.log(formatSearchResult(results[i], i))
        }
      } catch (error) {
        console.error(chalk.red('Search error:'), (error as Error).message)
        process.exit(1)
      } finally {
        closeConnections()
      }
    })

  program
    .command('stats')
    .description('Show index statistics')
    .action(() => {
      const stats = getStats()
      if (!stats) {
        console.error(
          chalk.red('Index not found. Run `messages index` first to build the search index.')
        )
        process.exit(1)
      }
      console.log(formatStats(stats))
    })

  program
    .command('mcp')
    .description('Start as MCP server (for Claude Code integration)')
    .action(async () => {
      const { startMcpServer } = await import('./mcp.js')
      startMcpServer()
    })

  // Default action: if no command provided, show help
  program.action(() => {
    program.help()
  })

  program.parse()
}
