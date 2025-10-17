# Home Assistant LSP Server

A Language Server Protocol (LSP) implementation for Home Assistant that provides intelligent code assistance for any LSP-compatible editor (Neovim, VSCode, Emacs, Sublime Text, etc.).

## Features

- **Auto-completion**: Entity IDs, service calls, and domain names
- **Hover Information**: Real-time entity state and attributes
- **Diagnostics**: Validate entity references against your Home Assistant instance
- **Dashboard Commands**: Edit Lovelace dashboards via custom LSP commands
- **Multi-editor Support**: Works with any LSP-compatible editor

## Installation

```bash
npm install -g homeassistant-lsp
```

Or install locally:

```bash
git clone https://github.com/yourusername/homeassistant-lsp.git
cd homeassistant-lsp
npm install
npm run build
```

## Configuration

The LSP server requires connection details to your Home Assistant instance:

- `homeassistant.host` (required): WebSocket URL (e.g., `ws://homeassistant.local:8123/api/websocket`)
- `homeassistant.token` (required): Long-lived access token

### Neovim Setup

```lua
-- In your Neovim config (e.g., ~/.config/nvim/lua/lsp/homeassistant.lua)
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

-- Define the custom server
if not configs.homeassistant then
  configs.homeassistant = {
    default_config = {
      cmd = { 'homeassistant-lsp', '--stdio' },
      filetypes = { 'yaml', 'yaml.homeassistant' },
      root_dir = lspconfig.util.root_pattern('.git', 'configuration.yaml'),
      settings = {
        homeassistant = {
          host = 'ws://homeassistant.local:8123/api/websocket',
          token = 'your-long-lived-access-token',
        },
      },
    },
  }
end

-- Setup the server
lspconfig.homeassistant.setup({
  on_attach = function(client, bufnr)
    -- Your on_attach function
  end,
})
```

### VSCode Setup

VSCode support requires a separate extension (coming soon). For now, you can use the server directly with the VSCode extension development workflow.

## Usage

Once configured, the LSP server provides:

### Auto-completion
Type `entity_id:` followed by a domain name to get entity suggestions:
```yaml
automation:
  - trigger:
      platform: state
      entity_id: sensor.  # <-- Completion triggers here
```

### Hover Information
Hover over any entity ID to see its current state and attributes:
```yaml
entity_id: sensor.temperature  # <-- Hover here for info
```

### Diagnostics
Invalid entity references are automatically highlighted:
```yaml
entity_id: sensor.nonexistent  # <-- Error: Entity not found
```

### Custom Commands
Use LSP commands to manage dashboards:
- `homeassistant.listDashboards` - List all editable dashboards
- `homeassistant.getDashboardConfig` - Get dashboard configuration
- `homeassistant.saveDashboardConfig` - Save dashboard changes

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint
```

## Project Structure

```
homeassistant-lsp/
├── src/
│   ├── server.ts           # Main LSP server entry point
│   ├── ha-client.ts        # Home Assistant WebSocket client
│   ├── cache.ts            # Entity/service caching layer
│   ├── providers/
│   │   ├── completion.ts   # Completion provider
│   │   ├── hover.ts        # Hover provider
│   │   └── diagnostics.ts  # Diagnostics provider
│   ├── utils/
│   │   ├── logger.ts       # Logging utility
│   │   └── config.ts       # Configuration management
│   └── types/
│       └── homeassistant.ts # Type definitions
├── tests/
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── fixtures/           # Test fixtures
└── docs/                   # Documentation
```

## Architecture

The LSP server consists of several key components:

1. **LSP Server Core**: Handles LSP protocol communication
2. **WebSocket Client**: Connects to Home Assistant API
3. **Caching Layer**: Caches entities and services for fast lookups
4. **Providers**: Implement LSP features (completion, hover, diagnostics)

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

## Related Projects

- [Home Assistant](https://www.home-assistant.io/) - Open source home automation
- [LSP Specification](https://microsoft.github.io/language-server-protocol/) - Language Server Protocol

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/homeassistant-lsp/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/homeassistant-lsp/discussions)
