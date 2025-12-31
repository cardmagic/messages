---
name: messages
description: Fuzzy search and browse Apple Messages/iMessage. Use when user asks to find texts, search messages, look up conversations, find what someone said, who texted recently, or view recent messages.
---

# messages

Fuzzy search through Apple Messages using the messages CLI tool.

## Installation

If the `messages` CLI is not installed, install it:

```bash
git clone https://github.com/cardmagic/messages.git
cd messages && make install
```

**Requirements:**
- macOS with Apple Messages
- Node.js 22+
- Full Disk Access for terminal (System Settings > Privacy & Security > Full Disk Access)

## Triggers

Use this skill when user asks about:
- Finding or searching text messages
- Looking up conversations or chats
- Finding what someone said in iMessage
- Searching message history
- Who texted recently, recent messages, contacts

**Proactive triggers:** "find text", "search messages", "what did X say", "message from", "text about", "iMessage", "look up conversation", "who texted", "recent messages", "recent texts"

## Browse Commands

For browsing recent messages and conversations (no search query needed):

```bash
# Show most recent messages (answers "who texted me?")
messages recent

# List contacts by recent activity
messages contacts --limit 10

# List conversations with message counts
messages conversations

# Show recent messages from/to a specific person
messages from "John"

# Show full conversation thread with someone
messages thread "John" --after 2024-12-01
```

## Search Commands

For fuzzy searching through message content:

```bash
# Rebuild index and search (recommended)
messages index-and-search "search query"

# Search with filters
messages search "query" --from "John"
messages search "query" --after 2024-06-01
messages search "query" --limit 25
messages search "query" --context 5

# Combine options
messages search "dinner" --from "Mom" --after 2024-01-01 --limit 15
```

## Other Commands

```bash
# Check index stats (message count, date range, etc.)
messages stats

# Rebuild index only
messages index
```

## Options Reference

| Option | Description | Example |
|--------|-------------|---------|
| `--from, -f` | Filter by sender name or phone | `--from "John Smith"` |
| `--after, -a` | Messages after date | `--after 2024-06-01` |
| `--limit, -l` | Max results (default: 10) | `--limit 25` |
| `--context, -c` | Messages before/after match (default: 2) | `--context 5` |

## Tips

- Use quotes around multi-word search terms: `"dinner plans"`
- Sender filter supports partial matches: `--from "John"` matches "John Smith"
- Phone numbers can be used in sender filter: `--from "+1555"`
- Increase `--limit` for broader searches
- Increase `--context` to see more conversation around matches
