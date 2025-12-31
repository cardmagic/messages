#!/usr/bin/env node

// Dual-mode entry point: CLI or MCP server
// Usage:
//   messages search "query"  - CLI mode
//   messages index           - CLI mode
//   messages stats           - CLI mode
//   messages --mcp           - MCP server mode (for Claude Code integration)

import { argv } from 'node:process'

const args = argv.slice(2)

if (args.includes('--mcp') || args.includes('mcp')) {
  // MCP server mode
  const { startMcpServer } = await import('./mcp.js')
  startMcpServer()
} else {
  // CLI mode
  const { runCli } = await import('./cli.js')
  runCli()
}
