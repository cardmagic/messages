import { program } from 'commander'
import chalk from 'chalk'
import { buildIndex, getStats } from './indexer.js'
import {
  search,
  closeConnections,
  getRecentMessages,
  getContacts,
  getConversations,
  getThread,
} from './searcher.js'
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
    .description('Force rebuild the search index from Apple Messages')
    .option('-q, --quiet', 'Suppress progress output')
    .action((options) => {
      console.log(chalk.bold('Rebuilding search index...'))
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
        console.log(chalk.green('\u2713 Index rebuilt successfully!'))
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
      // search() auto-rebuilds the index if needed
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
    .command('from <sender>')
    .description('List recent messages from a specific sender')
    .option('-a, --after <date>', 'Show only messages after this date (YYYY-MM-DD)')
    .option('-l, --limit <number>', 'Maximum number of results', '20')
    .option('-c, --context <number>', 'Number of messages to show before/after', '2')
    .action((sender, options) => {
      // search() auto-rebuilds the index if needed
      const searchOptions: SearchOptions = {
        from: sender,
        after: options.after ? new Date(options.after) : undefined,
        limit: parseInt(options.limit, 10),
        context: parseInt(options.context, 10),
      }

      try {
        const results = search(searchOptions)

        if (results.length === 0) {
          console.log(chalk.yellow(`No messages found from "${sender}"`))
          return
        }

        console.log(
          chalk.dim(`Found ${results.length} message${results.length === 1 ? '' : 's'} from ${sender}:`)
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
    .command('recent')
    .description('Show most recent messages')
    .option('-l, --limit <number>', 'Maximum number of messages', '20')
    .action((options) => {
      try {
        const messages = getRecentMessages(parseInt(options.limit, 10))

        if (messages.length === 0) {
          console.log(chalk.yellow('No messages found.'))
          return
        }

        console.log(chalk.dim(`Most recent ${messages.length} messages:\n`))

        for (const { message } of messages) {
          const date = new Date(message.date * 1000)
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
          const sender = message.isFromMe ? chalk.blue('You') : chalk.green(message.sender)
          const chatName = chalk.dim(`[${message.chatName}]`)
          const text = message.text.length > 60 ? message.text.slice(0, 60) + '...' : message.text

          console.log(`${chalk.dim(dateStr)} ${chatName} ${sender}: ${text}`)
        }
      } catch (error) {
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      } finally {
        closeConnections()
      }
    })

  program
    .command('contacts')
    .description('List contacts by recent activity')
    .option('-l, --limit <number>', 'Maximum number of contacts', '20')
    .action((options) => {
      try {
        const contacts = getContacts(parseInt(options.limit, 10))

        if (contacts.length === 0) {
          console.log(chalk.yellow('No contacts found.'))
          return
        }

        console.log(chalk.dim(`Top ${contacts.length} contacts by recent activity:\n`))

        for (const contact of contacts) {
          const date = new Date(contact.lastMessageDate * 1000)
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          const count = chalk.dim(`(${contact.messageCount} messages)`)

          console.log(`${chalk.green(contact.name)} ${count} - last: ${chalk.dim(dateStr)}`)
        }
      } catch (error) {
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      } finally {
        closeConnections()
      }
    })

  program
    .command('conversations')
    .description('List conversations with message counts')
    .option('-l, --limit <number>', 'Maximum number of conversations', '20')
    .action((options) => {
      try {
        const conversations = getConversations(parseInt(options.limit, 10))

        if (conversations.length === 0) {
          console.log(chalk.yellow('No conversations found.'))
          return
        }

        console.log(chalk.dim(`Top ${conversations.length} conversations:\n`))

        for (const conv of conversations) {
          const date = new Date(conv.lastMessageDate * 1000)
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          const count = chalk.dim(`(${conv.messageCount} msgs)`)
          const lastMsg = conv.lastMessage
            ? conv.lastMessage.length > 40
              ? conv.lastMessage.slice(0, 40) + '...'
              : conv.lastMessage
            : ''

          console.log(`${chalk.green(conv.chatName)} ${count} - ${chalk.dim(dateStr)}`)
          if (lastMsg) {
            console.log(`  ${chalk.dim('└─')} ${lastMsg}`)
          }
        }
      } catch (error) {
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      } finally {
        closeConnections()
      }
    })

  program
    .command('thread <contact>')
    .description('Show full conversation thread with a contact')
    .option('-a, --after <date>', 'Show only messages after this date (YYYY-MM-DD)')
    .option('-l, --limit <number>', 'Maximum number of messages', '50')
    .action((contact, options) => {
      try {
        const messages = getThread(contact, {
          after: options.after ? new Date(options.after) : undefined,
          limit: parseInt(options.limit, 10),
        })

        if (messages.length === 0) {
          console.log(chalk.yellow(`No messages found with "${contact}"`))
          return
        }

        const chatName = messages[0].chatName
        console.log(chalk.bold(`Conversation with ${chatName}\n`))

        let lastDate = ''
        for (const message of messages) {
          const date = new Date(message.date * 1000)
          const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
          const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })

          // Print date separator when date changes
          if (dateStr !== lastDate) {
            console.log(chalk.dim(`\n--- ${dateStr} ---\n`))
            lastDate = dateStr
          }

          const sender = message.isFromMe ? chalk.blue('You') : chalk.green(message.sender)
          console.log(`${chalk.dim(timeStr)} ${sender}: ${message.text}`)
        }
      } catch (error) {
        console.error(chalk.red('Error:'), (error as Error).message)
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
