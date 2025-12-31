# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build          # Compile TypeScript to dist/
pnpm dev            # Watch mode for development
pnpm typecheck      # Type check without emitting
pnpm lint           # Run oxlint
pnpm test           # Run tests
pnpm test:watch     # Run tests in watch mode

make install        # Build and link globally
make clean          # Remove dist/ and node_modules/
```

## Architecture

Dual-mode CLI/MCP tool for searching Apple Messages:

```
src/
├── index.ts      # Entry point - routes to CLI or MCP mode based on --mcp flag
├── cli.ts        # Commander-based CLI (search, index, stats commands)
├── mcp.ts        # MCP server exposing tools via @modelcontextprotocol/sdk
├── indexer.ts    # Builds search indexes from ~/Library/Messages/chat.db
├── searcher.ts   # Queries indexes with fuzzy matching via MiniSearch
├── formatter.ts  # Terminal output formatting with chalk
└── types.ts      # Shared types and Apple date conversion utilities
```

**Data flow:**
1. `indexer.ts` reads Apple's `chat.db` SQLite database and AddressBook for contact resolution
2. Creates two indexes in `~/.messages/`: FTS5 SQLite for exact search, MiniSearch JSON for fuzzy matching
3. `searcher.ts` queries MiniSearch for fuzzy results, then fetches context from SQLite

**Key dependencies:**
- `better-sqlite3`: Read Apple Messages DB and create FTS5 index
- `minisearch`: Fuzzy search with typo tolerance
- `node-typedstream`: Extract text from NSAttributedString blobs (messages with null text field)
- `@modelcontextprotocol/sdk`: MCP server for Claude Code integration

## Claude Code Plugin

This repo is also a Claude Code plugin with skills and slash commands:

```
.claude-plugin/
├── plugin.json       # Plugin manifest
└── marketplace.json  # Marketplace definition (name: cardmagic)

skills/messages/SKILL.md    # Auto-invoked skill for message queries
commands/
├── search.md               # /messages:search slash command
└── browse.md               # /messages:browse slash command
```

## Releasing

When asked to "bump version to X" or "tag vX.Y.Z":

1. Update `package.json` version field to the new version
2. Commit: `git add package.json && git commit -m "chore: bump version to X.Y.Z"`
3. Tag: `git tag vX.Y.Z`
4. Push: `git push && git push origin vX.Y.Z`

GitHub Actions will automatically publish to npm on version tags.

**First-time setup:**
1. Create GitHub environment `npm` at repo settings
2. Publish manually once: `npm login && npm publish --access public`
3. Add trusted publisher on npmjs.com/package/@cardmagic/messages/access
