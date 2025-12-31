---
description: List conversations with message counts
allowed-tools: Bash(messages:*)
argument-hint: [--limit N]
---

# Conversations

List conversations with message counts and last message preview.

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
npm install -g @cardmagic/messages
```

2. **Run the command**:

```bash
messages conversations $ARGUMENTS
```

## Options

- `--limit N` - Maximum number of conversations (default: 20)

## Examples

User: `/messages:conversations`
-> `messages conversations`

User: `/messages:conversations --limit 50`
-> `messages conversations --limit 50`
