---
description: Browse recent messages and conversations
allowed-tools: Bash(messages:*)
argument-hint: [recent|contacts|conversations|from "name"|thread "name"]
---

# Browse Messages

Browse recent messages and conversations without searching.

## Instructions

1. **Check if messages CLI is installed** - if `which messages` fails, install it:

```bash
git clone https://github.com/cardmagic/messages.git
cd messages && make install
```

2. Parse the arguments and run the appropriate command:

```bash
messages $ARGUMENTS
```

## Commands

| Command | Description |
|---------|-------------|
| `recent` | Show most recent messages (who texted me?) |
| `contacts` | List contacts by recent activity |
| `conversations` | List conversations with message counts |
| `from "Name"` | Show recent messages from/to someone |
| `thread "Name"` | Show full conversation thread |

## Examples

User: `/messages:browse recent`
-> `messages recent`

User: `/messages:browse contacts --limit 10`
-> `messages contacts --limit 10`

User: `/messages:browse from Mom`
-> `messages from "Mom"`

User: `/messages:browse thread "John Smith" --after 2024-12-01`
-> `messages thread "John Smith" --after 2024-12-01`
