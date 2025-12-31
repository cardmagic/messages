import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { getStats, ensureIndex } from './indexer.js'
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
            'Search through Apple Messages (iMessage/SMS) with fuzzy matching. Can search by text query, filter by sender, or both. Use "from" to get messages from a specific person. The index is automatically rebuilt when new messages are detected.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for message content - supports fuzzy matching and typos. Optional if "from" is provided.',
              },
              from: {
                type: 'string',
                description: 'Filter by sender name (e.g., "Mom", "John Smith") or phone number. When used alone (without query), returns recent messages from this sender.',
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
            required: [],
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
          const searchArgs = args as {
            query?: string
            from?: string
            after?: string
            limit?: number
            context?: number
          }

          // Validate that at least query or from is provided
          if (!searchArgs.query && !searchArgs.from) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Please provide either a "query" to search message content, or "from" to filter by sender, or both.',
                },
              ],
              isError: true,
            }
          }

          const searchOptions: SearchOptions = {
            query: searchArgs.query,
            from: searchArgs.from,
            after: searchArgs.after ? new Date(searchArgs.after) : undefined,
            limit: searchArgs.limit ?? 10,
            context: searchArgs.context ?? 2,
          }

          // search() auto-rebuilds the index if needed
          const results = search(searchOptions)
          closeConnections()

          if (results.length === 0) {
            const searchDesc = searchArgs.from
              ? `from "${searchArgs.from}"${searchArgs.query ? ` matching "${searchArgs.query}"` : ''}`
              : `matching "${searchArgs.query}"`

            return {
              content: [
                {
                  type: 'text',
                  text: `No messages found ${searchDesc}.`,
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

        case 'get_message_stats': {
          // Ensure index is up to date
          ensureIndex()

          const stats = getStats()
          if (!stats) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Unable to read message statistics. The Messages database may not be accessible.',
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
