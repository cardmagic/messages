---
name: messages
description: "Fuzzy search and browse Apple Messages/iMessage — find texts, search by contact or date, view conversation threads, list recent messages, and check who texted. Use when user asks to find texts, search messages, look up conversations, find what someone said, filter messages by sender or date range, who texted recently, or view recent messages."
---

# messages

Fuzzy search and browse Apple Messages using the `messages` CLI tool.

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

## Browse Commands

Browse recent messages and conversations (no search query needed):

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

Fuzzy search through message content with typo tolerance:

```bash
# Rebuild index and search (recommended for first use or after new messages)
messages index-and-search "search query"

# Search with filters
messages search "query" --from "John"
messages search "query" --after 2024-06-01
messages search "query" --limit 25
messages search "query" --context 5

# Combine filters
messages search "dinner" --from "Mom" --after 2024-01-01 --limit 15
```

**Filtering tips:** Sender filter supports partial matches (`--from "John"` matches "John Smith") and phone numbers (`--from "+1555"`). Use quotes around multi-word search terms: `"dinner plans"`.

## Utility Commands

```bash
# Check index stats (message count, date range, etc.)
messages stats

# Rebuild index only (without searching)
messages index
```
