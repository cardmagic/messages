---
description: Browse recent messages and conversations (alias for other commands)
allowed-tools: Bash(messages:*)
argument-hint: [recent|contacts|conversations|from "name"|thread "name"]
---

# Browse Messages

Browse recent messages and conversations. This is an alias - you can also use the individual commands directly:

- `/messages:recent` - Show most recent messages
- `/messages:contacts` - List contacts by activity
- `/messages:conversations` - List conversations
- `/messages:from "Name"` - Messages from someone
- `/messages:thread "Name"` - Full conversation thread

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
npm install -g @cardmagic/messages
```

2. Parse the arguments and run the appropriate command:

```bash
messages $ARGUMENTS
```

## Examples

User: `/messages:browse recent`
-> `messages recent`

User: `/messages:browse contacts --limit 10`
-> `messages contacts --limit 10`

User: `/messages:browse from Mom`
-> `messages from "Mom"`

User: `/messages:browse thread "John Smith" --after 2024-12-01`
-> `messages thread "John Smith" --after 2024-12-01`
