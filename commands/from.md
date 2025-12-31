---
description: Show recent messages from a specific person
allowed-tools: Bash(messages:*)
argument-hint: <name> [--after date] [--limit N]
---

# Messages From

Show recent messages sent by a specific person.

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
npm install -g @cardmagic/messages
```

2. **Run the command**:

```bash
messages from "$ARGUMENTS"
```

## Options

- `--after YYYY-MM-DD` - Only messages after this date
- `--limit N` - Maximum number of messages (default: 20)
- `--context N` - Messages before/after each result (default: 2)

## Examples

User: `/messages:from Mom`
-> `messages from "Mom"`

User: `/messages:from "John Smith" --limit 50`
-> `messages from "John Smith" --limit 50`

User: `/messages:from Dad --after 2024-12-01`
-> `messages from "Dad" --after 2024-12-01`
