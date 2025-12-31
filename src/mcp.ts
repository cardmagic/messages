import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { getStats, ensureIndex } from './indexer.js'
import {
  search,
  closeConnections,
  getRecentMessages,
  getContacts,
  getConversations,
  getThread,
} from './searcher.js'
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
            'Search through Apple Messages (iMessage/SMS) with fuzzy matching. Can search by text query, filter by sender, or both. Use "from" to get messages from a specific person.',
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
          name: 'recent_messages',
          description:
            'Get the most recent messages across all conversations. Use this to see "who texted me recently" or get an overview of recent activity.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of messages to return (default: 20)',
                default: 20,
              },
            },
          },
        },
        {
          name: 'list_contacts',
          description:
            'List contacts sorted by recent messaging activity. Shows contact name, message count, and last message date.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of contacts to return (default: 20)',
                default: 20,
              },
            },
          },
        },
        {
          name: 'list_conversations',
          description:
            'List conversations with message counts and last message preview. Shows all chat threads sorted by recent activity.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of conversations to return (default: 20)',
                default: 20,
              },
            },
          },
        },
        {
          name: 'get_thread',
          description:
            'Get the full conversation thread with a specific contact. Shows messages in chronological order.',
          inputSchema: {
            type: 'object',
            properties: {
              contact: {
                type: 'string',
                description: 'Contact name to get the conversation thread for',
              },
              after: {
                type: 'string',
                description: 'Show only messages after this date in YYYY-MM-DD format (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of messages to return (default: 50)',
                default: 50,
              },
            },
            required: ['contact'],
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

            for (const msg of r.before) {
              const msgDate = new Date(msg.date * 1000)
              const sender = msg.isFromMe ? 'Me' : msg.sender
              lines.push(`  [${msgDate.toLocaleTimeString()}] ${sender}: ${msg.text}`)
            }

            const sender = r.result.message.isFromMe ? 'Me' : r.result.message.sender
            lines.push(`> [${dateStr}] ${sender}: ${r.result.message.text}`)

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

        case 'recent_messages': {
          const limit = (args as { limit?: number }).limit ?? 20
          const messages = getRecentMessages(limit)
          closeConnections()

          if (messages.length === 0) {
            return {
              content: [{ type: 'text', text: 'No messages found.' }],
            }
          }

          const formatted = messages.map(({ message }) => {
            const date = new Date(message.date * 1000)
            const dateStr = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
            const sender = message.isFromMe ? 'Me' : message.sender
            return `[${dateStr}] [${message.chatName}] ${sender}: ${message.text}`
          })

          return {
            content: [
              {
                type: 'text',
                text: `Most recent ${messages.length} messages:\n\n${formatted.join('\n')}`,
              },
            ],
          }
        }

        case 'list_contacts': {
          const limit = (args as { limit?: number }).limit ?? 20
          const contacts = getContacts(limit)
          closeConnections()

          if (contacts.length === 0) {
            return {
              content: [{ type: 'text', text: 'No contacts found.' }],
            }
          }

          const formatted = contacts.map((contact) => {
            const date = new Date(contact.lastMessageDate * 1000)
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return `${contact.name} (${contact.messageCount} messages) - last: ${dateStr}`
          })

          return {
            content: [
              {
                type: 'text',
                text: `Top ${contacts.length} contacts by recent activity:\n\n${formatted.join('\n')}`,
              },
            ],
          }
        }

        case 'list_conversations': {
          const limit = (args as { limit?: number }).limit ?? 20
          const conversations = getConversations(limit)
          closeConnections()

          if (conversations.length === 0) {
            return {
              content: [{ type: 'text', text: 'No conversations found.' }],
            }
          }

          const formatted = conversations.map((conv) => {
            const date = new Date(conv.lastMessageDate * 1000)
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const preview = conv.lastMessage
              ? conv.lastMessage.length > 50
                ? conv.lastMessage.slice(0, 50) + '...'
                : conv.lastMessage
              : ''
            return `${conv.chatName} (${conv.messageCount} msgs) - ${dateStr}\n  └─ ${preview}`
          })

          return {
            content: [
              {
                type: 'text',
                text: `Top ${conversations.length} conversations:\n\n${formatted.join('\n')}`,
              },
            ],
          }
        }

        case 'get_thread': {
          const threadArgs = args as { contact: string; after?: string; limit?: number }

          if (!threadArgs.contact) {
            return {
              content: [{ type: 'text', text: 'Please provide a contact name.' }],
              isError: true,
            }
          }

          const messages = getThread(threadArgs.contact, {
            after: threadArgs.after ? new Date(threadArgs.after) : undefined,
            limit: threadArgs.limit ?? 50,
          })
          closeConnections()

          if (messages.length === 0) {
            return {
              content: [{ type: 'text', text: `No messages found with "${threadArgs.contact}".` }],
            }
          }

          const chatName = messages[0].chatName
          let lastDate = ''
          const formatted: string[] = []

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

            if (dateStr !== lastDate) {
              formatted.push(`\n--- ${dateStr} ---\n`)
              lastDate = dateStr
            }

            const sender = message.isFromMe ? 'Me' : message.sender
            formatted.push(`[${timeStr}] ${sender}: ${message.text}`)
          }

          return {
            content: [
              {
                type: 'text',
                text: `Conversation with ${chatName}:\n${formatted.join('\n')}`,
              },
            ],
          }
        }

        case 'get_message_stats': {
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
