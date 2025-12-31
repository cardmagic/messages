---
description: Show most recent messages (who texted me?)
allowed-tools: Bash(messages:*)
argument-hint: [--limit N]
---

# Recent Messages

Show the most recent messages across all conversations.

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
npm install -g @cardmagic/messages
```

2. **Run the command**:

```bash
messages recent $ARGUMENTS
```

## Options

- `--limit N` - Maximum number of messages (default: 20)

## Examples

User: `/messages:recent`
-> `messages recent`

User: `/messages:recent --limit 50`
-> `messages recent --limit 50`
