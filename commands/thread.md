---
description: Show full conversation thread with a contact
allowed-tools: Bash(messages:*)
argument-hint: <name> [--after date] [--limit N]
---

# Conversation Thread

Show the full conversation thread with a specific contact.

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
npm install -g @cardmagic/messages
```

2. **Run the command**:

```bash
messages thread "$ARGUMENTS"
```

## Options

- `--after YYYY-MM-DD` - Only messages after this date
- `--limit N` - Maximum number of messages (default: 50)

## Examples

User: `/messages:thread Mom`
-> `messages thread "Mom"`

User: `/messages:thread "John Smith" --after 2024-12-01`
-> `messages thread "John Smith" --after 2024-12-01`

User: `/messages:thread Boss --limit 100`
-> `messages thread "Boss" --limit 100`
