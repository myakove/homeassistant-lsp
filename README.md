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
git clone https://github.com/myakove/homeassistant-lsp.git
cd homeassistant-lsp
npm install
npm run build
```

## Testing Locally (Before Global Install)

If you want to test the LSP server before installing globally:

1. **Clone and build:**
   ```bash
   git clone https://github.com/myakove/homeassistant-lsp.git
   cd homeassistant-lsp
   npm install
   npm run build
   npm test  # Verify all tests pass
   ```

2. **Test with Neovim (local path):**
   ```lua
   local lspconfig = require('lspconfig')
   local configs = require('lspconfig.configs')
   
   if not configs.homeassistant then
     configs.homeassistant = {
       default_config = {
         -- Use local build instead of global install
         cmd = { 'node', vim.fn.expand('~/git/homeassistant-lsp/dist/server.js'), '--stdio' },
         filetypes = { 'yaml', 'yaml.homeassistant', 'python' },
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
   
   lspconfig.homeassistant.setup({})
   ```

3. **Verify it works:**
   - Open a YAML or Python file
   - Type `entity_id: sensor.` and check for completions
   - Hover over an entity ID to see info

Once verified, you can install globally with `npm install -g .` from the project directory.

## Configuration

The LSP server requires connection details to your Home Assistant instance:

- `homeassistant.host` (required): WebSocket URL (e.g., `ws://homeassistant.local:8123/api/websocket`)
- `homeassistant.token` (required): Long-lived access token

### Environment Variables

The LSP server supports environment variable overrides for configuration:

- `HA_HOST` - Home Assistant WebSocket URL
- `HA_TOKEN` - Long-lived access token
- `HA_TIMEOUT` - Request timeout in milliseconds (default: 5000)
- `LOG_LEVEL` - Logging level: DEBUG, INFO, WARN, ERROR (default: INFO)

Example:
```bash
export HA_HOST="ws://192.168.1.10:8123/api/websocket"
export HA_TOKEN="your_token_here"
export LOG_LEVEL="DEBUG"
nvim configuration.yaml
```

These override values provided in the LSP client settings.

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
      filetypes = { 'yaml', 'yaml.homeassistant', 'python' },
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

### Python/AppDaemon Support

The LSP also works with Python files for AppDaemon automations:

```python
# In your AppDaemon apps
import appdaemon.plugins.hass.hassapi as hass

class MyApp(hass.Hass):
    def initialize(self):
        # Completion works here
        self.get_state("sensor.")  # <-- Completion triggers
        self.call_service("light.")  # <-- Completion triggers
        
        # Hover works too
        temp = self.get_state("sensor.temperature")  # <-- Hover for entity info
```

Supported Python patterns:
- `get_state("entity_id")` - Auto-completion and hover
- `call_service("domain.service")` - Service completion
- `set_state("entity_id")` - Entity completion
- Template strings: `f"The temperature is {self.get_state('sensor.temp')}"`

The LSP detects entity IDs in:
- Function call arguments
- String literals
- F-strings and format strings

## Troubleshooting

### Server Not Connecting

1. **Check LSP is running:**
   ```bash
   # In Neovim
   :LspInfo
   ```
   You should see `homeassistant` client attached.

2. **Check connection to Home Assistant:**
   ```vim
   :lua vim.lsp.buf.execute_command({command='homeassistant.getConnectionStatus'})
   ```

3. **Check LSP logs:**
   
   Neovim LSP logs location: `~/.local/state/nvim/lsp.log`
   ```bash
   tail -f ~/.local/state/nvim/lsp.log
   ```
   
   Enable debug logging:
   ```lua
   vim.lsp.set_log_level("DEBUG")
   ```

### No Completions Appearing

- Ensure you're in a YAML or Python file
- Try manual trigger: Type `entity_id: ` and press `<C-Space>`
- Check if LSP server is connected to Home Assistant (see above)
- Verify completion is enabled in your LSP client config

### Diagnostics Not Working

- Diagnostics are debounced (500ms delay after last edit)
- Check if file is saved (some editors only run diagnostics on save)
- Verify the LSP server is connected to Home Assistant
- Check LSP logs for validation errors

### Common Issues

**"Entity not found" errors for valid entities:**
- The entity might not be loaded yet - try reloading cache:
  ```vim
  :lua vim.lsp.buf.execute_command({command='homeassistant.reloadCache'})
  ```
- Check if entity is actually available in Home Assistant

**High CPU/memory usage:**
- Large entity lists can impact performance
- Consider adjusting cache TTL in configuration
- Check for rapid document changes triggering constant validation

**WebSocket connection errors:**
- Verify the WebSocket URL is correct (should start with `ws://` or `wss://`)
- Check if Home Assistant is accessible from your machine
- Verify the long-lived access token is valid
- Check firewall settings

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

- Issues: [GitHub Issues](https://github.com/myakove/homeassistant-lsp/issues)
- Discussions: [GitHub Discussions](https://github.com/myakove/homeassistant-lsp/discussions)
