import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { buildIndex, indexExists, getStats } from './indexer.js'
import { search, closeConnections } from './searcher.js'
import type { SearchOptions } from './types.js'

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: 'messages',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_messages',
          description:
            'Search through Apple Messages (iMessage/SMS) with fuzzy matching. Returns matching messages with surrounding context.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query - supports fuzzy matching and typos',
              },
              from: {
                type: 'string',
                description: 'Filter by sender name or phone number (optional)',
              },
              after: {
                type: 'string',
                description: 'Show only messages after this date in YYYY-MM-DD format (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10)',
                default: 10,
              },
              context: {
                type: 'number',
                description: 'Number of messages to show before/after each result (default: 2)',
                default: 2,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'rebuild_message_index',
          description:
            'Rebuild the search index from Apple Messages database. Required before first search and to include new messages. Requires Full Disk Access for the terminal.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_message_stats',
          description:
            'Get statistics about the indexed messages including count, date range, and contacts.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'search_messages': {
          if (!indexExists()) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Index not found. Run rebuild_message_index first to build the search index.',
                },
              ],
              isError: true,
            }
          }

          const searchArgs = args as {
            query: string
            from?: string
            after?: string
            limit?: number
            context?: number
          }

          const searchOptions: SearchOptions = {
            query: searchArgs.query,
            from: searchArgs.from,
            after: searchArgs.after ? new Date(searchArgs.after) : undefined,
            limit: searchArgs.limit ?? 10,
            context: searchArgs.context ?? 2,
          }

          const results = search(searchOptions)
          closeConnections()

          if (results.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No messages found matching "${searchArgs.query}"`,
                },
              ],
            }
          }

          // Format results for output
          const formatted = results.map((r, i) => {
            const lines: string[] = []
            const date = new Date(r.result.message.date * 1000)
            const dateStr = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })

            lines.push(`--- Result ${i + 1} (score: ${r.result.score.toFixed(2)}) ---`)
            lines.push(`Chat: ${r.result.message.chatName}`)
            lines.push('')

            // Context before
            for (const msg of r.before) {
              const msgDate = new Date(msg.date * 1000)
              const sender = msg.isFromMe ? 'Me' : msg.sender
              lines.push(`  [${msgDate.toLocaleTimeString()}] ${sender}: ${msg.text}`)
            }

            // The matched message
            const sender = r.result.message.isFromMe ? 'Me' : r.result.message.sender
            lines.push(`> [${dateStr}] ${sender}: ${r.result.message.text}`)

            // Context after
            for (const msg of r.after) {
              const msgDate = new Date(msg.date * 1000)
              const afterSender = msg.isFromMe ? 'Me' : msg.sender
              lines.push(`  [${msgDate.toLocaleTimeString()}] ${afterSender}: ${msg.text}`)
            }

            return lines.join('\n')
          })

          return {
            content: [
              {
                type: 'text',
                text: `Found ${results.length} result${results.length === 1 ? '' : 's'}:\n\n${formatted.join('\n\n')}`,
              },
            ],
          }
        }

        case 'rebuild_message_index': {
          const stats = buildIndex()
          return {
            content: [
              {
                type: 'text',
                text: `Index rebuilt successfully!\n\nMessages: ${stats.totalMessages.toLocaleString()}\nChats: ${stats.totalChats.toLocaleString()}\nContacts: ${stats.totalContacts.toLocaleString()}\nDate range: ${stats.oldestMessage.toLocaleDateString()} - ${stats.newestMessage.toLocaleDateString()}`,
              },
            ],
          }
        }

        case 'get_message_stats': {
          const stats = getStats()
          if (!stats) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Index not found. Run rebuild_message_index first.',
                },
              ],
              isError: true,
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: `Message Index Statistics\n\nMessages: ${stats.totalMessages.toLocaleString()}\nChats: ${stats.totalChats.toLocaleString()}\nContacts: ${stats.totalContacts.toLocaleString()}\nIndexed at: ${stats.indexedAt.toLocaleString()}\nDate range: ${stats.oldestMessage.toLocaleDateString()} - ${stats.newestMessage.toLocaleDateString()}`,
              },
            ],
          }
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          }
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      }
    }
  })

  // Start the server
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
