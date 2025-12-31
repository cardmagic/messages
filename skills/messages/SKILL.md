---
name: messages
description: Fuzzy search through Apple Messages/iMessage. Use when user asks to find texts, search messages, look up conversations, or find what someone said.
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

**Proactive triggers:** "find text", "search messages", "what did X say", "message from", "text about", "iMessage", "look up conversation"

## Workflow

**IMPORTANT:** Always rebuild the index first to ensure you have the latest messages.

### Step 1: Rebuild Index and Search

Use the `index-and-search` command which rebuilds the index then searches:

```bash
messages index-and-search "search query"
```

### Step 2: Refine if Needed

If initial results aren't helpful, use search options:

```bash
# Filter by sender
messages search "query" --from "John"

# Filter by date
messages search "query" --after 2024-06-01

# More results
messages search "query" --limit 25

# More context around matches
messages search "query" --context 5

# Combine options
messages search "dinner" --from "Mom" --after 2024-01-01 --limit 15
```

### Other Commands

```bash
# Check index stats (message count, date range, etc.)
messages stats

# Rebuild index only
messages index
```

## Search Options Reference

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
