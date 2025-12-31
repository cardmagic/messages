# messages

Fuzzy search and browse Apple Messages (iMessage/SMS) from the command line, as a Claude Code plugin, or as an MCP server.

## Features

- **Fuzzy search** with typo tolerance across all your messages
- **Browse recent** messages, contacts, and conversations
- **Contact resolution** - shows names instead of phone numbers
- **Context display** - see messages before/after each match
- **Filter by sender** or date range
- **Auto-indexing** - index automatically rebuilds when new messages are detected
- **Multiple interfaces** - CLI, MCP server, or Claude Code plugin

## Requirements

- macOS (reads from Apple Messages database)
- Node.js 22+
- Full Disk Access permission for your terminal (to read `~/Library/Messages/chat.db`)

## Installation

### Claude Code Plugin (recommended)

Install as a plugin to get skills (auto-invoked) and slash commands:

```bash
# Add the marketplace
claude plugin marketplace add https://github.com/cardmagic/messages

# Install the plugin
claude plugin install messages@cardmagic
```

This gives you:
- **Skill**: Claude automatically searches messages when you ask about texts/iMessages
- **Slash commands**: `/messages:search`, `/messages:recent`, `/messages:from`, and more

### MCP Server

For direct MCP tool access without the plugin:

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

# Then add as plugin OR MCP server:
claude plugin marketplace add /Users/you/messages/.claude-plugin/marketplace.json
claude plugin install messages@cardmagic
# OR
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

# Show recent messages from someone
messages from "Mom"

# Show full conversation thread
messages thread "John" --after 2024-12-01
```

#### Search Commands

```bash
# Search for messages (index auto-builds on first search)
messages search "coffee tomorrow"

# Filter by sender
messages search "dinner" --from "Mom"

# Filter by date
messages search "meeting" --after 2024-01-01

# Adjust result count and context
messages search "project" --limit 20 --context 5

# Show index statistics
messages stats

# Force rebuild the index
messages index
```

#### Search Options

| Option | Description |
|--------|-------------|
| `-f, --from <sender>` | Filter by sender name or phone |
| `-a, --after <date>` | Only messages after date (YYYY-MM-DD) |
| `-l, --limit <n>` | Max results (default: 10) |
| `-c, --context <n>` | Messages before/after (default: 2) |

### Claude Code Plugin

When installed as a plugin, you get:

**Skill** (auto-invoked): Claude automatically searches messages when you ask things like:
- "What did Mom say about dinner?"
- "Who texted me recently?"
- "Find messages about the trip"

**Slash Commands**:

| Command | Description |
|---------|-------------|
| `/messages:search <query>` | Fuzzy search with optional filters |
| `/messages:recent` | Show most recent messages |
| `/messages:contacts` | List contacts by activity |
| `/messages:conversations` | List conversations with message counts |
| `/messages:from "Name"` | Messages from a specific person |
| `/messages:thread "Name"` | Full conversation thread |
| `/messages:browse <cmd>` | Alias for browse commands |

### MCP Server

When installed as an MCP server, Claude Code can use these tools:

| Tool | Description |
|------|-------------|
| `search_messages` | Search messages with fuzzy matching (auto-rebuilds index) |
| `get_message_stats` | Get index statistics |

#### Manual MCP Configuration

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

1. **Auto-Indexing**: On first search (or when new messages are detected), the tool automatically:
   - Reads your Apple Messages SQLite database
   - Builds a SQLite FTS5 full-text search index
   - Creates a MiniSearch fuzzy search index
   - Resolves contact names from your Address Book

2. **Searching**: Queries both indexes for best results with typo tolerance

3. **Storage**: Index files are stored in `~/.messages/`:
   - `index.db` - SQLite FTS5 database
   - `fuzzy.json` - MiniSearch index
   - `stats.json` - Index statistics

## License

MIT
