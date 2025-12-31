# messages

Fuzzy search through Apple Messages (iMessage/SMS) from the command line, as a Claude Code skill, or as an MCP server.

## Features

- **Fuzzy search** with typo tolerance across all your messages
- **Contact resolution** - shows names instead of phone numbers
- **Context display** - see messages before/after each match
- **Filter by sender** or date range
- **Multiple interfaces** - CLI, MCP server, or Claude Code skill

## Requirements

- macOS (reads from Apple Messages database)
- Node.js 22+
- Full Disk Access permission for your terminal (to read `~/Library/Messages/chat.db`)

## Installation

```bash
git clone https://github.com/cardmagic/messages.git
cd messages
make install
```

## Granting Full Disk Access

The tool needs to read your Messages database at `~/Library/Messages/chat.db`:

1. Open **System Settings** > **Privacy & Security** > **Full Disk Access**
2. Click **+** and add your terminal app (Terminal.app, iTerm, Warp, etc.)
3. Restart your terminal

## Usage

### CLI

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

#### CLI Options

| Option | Description |
|--------|-------------|
| `-f, --from <sender>` | Filter by sender name or phone |
| `-a, --after <date>` | Only messages after date (YYYY-MM-DD) |
| `-l, --limit <n>` | Max results (default: 10) |
| `-c, --context <n>` | Messages before/after (default: 2) |

### MCP Server

Add to your Claude Code MCP configuration (`~/.claude/claude_desktop_config.json` or VS Code settings):

```json
{
  "mcpServers": {
    "messages": {
      "command": "messages",
      "args": ["--mcp"]
    }
  }
}
```

#### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_messages` | Search messages with fuzzy matching |
| `rebuild_message_index` | Rebuild the search index |
| `get_message_stats` | Get index statistics |

### Claude Code Plugin

Install as a Claude Code plugin:

```bash
claude plugin install github:cardmagic/messages
```

This gives you:
- **Skill**: Claude automatically searches messages when you ask about texts/iMessages
- **Slash command**: `/messages:search "query"` for direct searching

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
