---
description: Fuzzy search through Apple Messages/iMessage
allowed-tools: Bash(messages:*)
argument-hint: <query> [--from name] [--after date] [--limit N]
---

# Search Messages

Fuzzy search through Apple Messages to find conversations and messages.

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
npm install -g @cardmagic/messages
```

2. **Run the search** (index auto-rebuilds when new messages are detected):

```bash
messages search "$ARGUMENTS"
```

3. If the user provides filters, apply them:
   - Sender filter: `--from "Name or phone"`
   - Date filter: `--after YYYY-MM-DD`
   - More results: `--limit N`
   - More context: `--context N`

4. Present results clearly, showing:
   - Who sent/received the message
   - When it was sent
   - The message content and surrounding context

5. If no results found, suggest:
   - Trying different search terms
   - Broadening the date range
   - Checking the sender name spelling

## Examples

User: `/messages:search dinner`
-> `messages search "dinner"`

User: `/messages:search trip --from Mom`
-> `messages search "trip" --from "Mom"`

User: `/messages:search meeting --after 2024-12-01`
-> `messages search "meeting" --after 2024-12-01`
