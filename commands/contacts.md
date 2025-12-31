---
description: List contacts by recent messaging activity
allowed-tools: Bash(messages:*)
argument-hint: [--limit N]
---

# Contacts

List contacts sorted by recent messaging activity.

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
npm install -g @cardmagic/messages
```

2. **Run the command**:

```bash
messages contacts $ARGUMENTS
```

## Options

- `--limit N` - Maximum number of contacts (default: 20)

## Examples

User: `/messages:contacts`
-> `messages contacts`

User: `/messages:contacts --limit 10`
-> `messages contacts --limit 10`
