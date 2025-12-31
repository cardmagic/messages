# messages

Fuzzy search and browse Apple Messages (iMessage/SMS) from the command line, as a Claude Code plugin, or as an MCP server.

## Features

- **Fuzzy search** with typo tolerance across all your messages
- **Browse recent** messages, contacts, and conversations
- **Contact resolution** - shows names instead of phone numbers
- **Context display** - see messages before/after each match
- **Filter by sender** or date range
- **Multiple interfaces** - CLI, MCP server, or Claude Code plugin

## Requirements

- macOS (reads from Apple Messages database)
- Node.js 22+
- Full Disk Access permission for your terminal (to read `~/Library/Messages/chat.db`)

## Installation

### As a Claude Code MCP Server (recommended)

```bash
claude mcp add --transport stdio messages -- npx -y @cardmagic/messages --mcp
```

Or install globally first:

```bash
npm install -g @cardmagic/messages
claude mcp add --transport stdio messages -- messages --mcp
```

### From source

```bash
git clone https://github.com/cardmagic/messages.git
cd messages
make install
claude mcp add --transport stdio messages -- messages --mcp
```

## Granting Full Disk Access

The tool needs to read your Messages database at `~/Library/Messages/chat.db`:

1. Open **System Settings** > **Privacy & Security** > **Full Disk Access**
2. Click **+** and add your terminal app (Terminal.app, iTerm, Warp, etc.)
3. Restart your terminal

## Usage

### CLI

#### Browse Commands

```bash
# Show most recent messages (who texted me?)
messages recent

# List contacts by recent activity
messages contacts --limit 10

# List conversations with message counts
messages conversations

# Show recent messages from/to someone
messages from "Mom"

# Show full conversation thread
messages thread "John" --after 2024-12-01
```

#### Search Commands

```bash
# Build the search index (required before first search)
messages index

# Search for messages
messages search "coffee tomorrow"

# Filter by sender
messages search "dinner" --from "Mom"

# Filter by date
messages search "meeting" --after 2024-01-01

# Adjust result count and context
messages search "project" --limit 20 --context 5

# Show index statistics
messages stats
```

#### Search Options

| Option | Description |
|--------|-------------|
| `-f, --from <sender>` | Filter by sender name or phone |
| `-a, --after <date>` | Only messages after date (YYYY-MM-DD) |
| `-l, --limit <n>` | Max results (default: 10) |
| `-c, --context <n>` | Messages before/after (default: 2) |

### MCP Server

Once installed with `claude mcp add` (see Installation above), Claude Code can use these tools:

| Tool | Description |
|------|-------------|
| `search_messages` | Search messages with fuzzy matching |
| `rebuild_message_index` | Rebuild the search index |
| `get_message_stats` | Get index statistics |

#### Manual Configuration

For Claude Desktop or VS Code, add to your MCP configuration:

```json
{
  "mcpServers": {
    "messages": {
      "command": "npx",
      "args": ["-y", "@cardmagic/messages", "--mcp"]
    }
  }
}
```

## How It Works

1. **Indexing**: Reads your Apple Messages SQLite database and builds:
   - A SQLite FTS5 full-text search index
   - A MiniSearch fuzzy search index
   - Contact name resolution from your Address Book

2. **Searching**: Queries both indexes for best results with typo tolerance

3. **Storage**: Index files are stored in `~/.messages/`:
   - `index.db` - SQLite FTS5 database
   - `fuzzy.json` - MiniSearch index
   - `stats.json` - Index statistics

## Rebuilding the Index

Run `messages index` periodically to include new messages. The index doesn't auto-update.

For automatic daily indexing, add a cron job or launchd plist:

```bash
# crontab -e
0 4 * * * /path/to/messages index
```

## License

MIT
