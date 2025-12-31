.PHONY: install uninstall build clean

# Build and install globally
install: build
	pnpm link --global
	@echo ""
	@echo "Installed! Usage:"
	@echo "  messages search \"query\"  - Search messages (CLI)"
	@echo "  messages index           - Rebuild index (CLI)"
	@echo "  messages --mcp           - Start MCP server"

# Remove global installation
uninstall:
	pnpm unlink --global messages-mcp

# Build TypeScript
build:
	pnpm install
	pnpm build

# Clean build artifacts
clean:
	rm -rf dist node_modules
