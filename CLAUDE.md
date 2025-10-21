# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Language Server Protocol (LSP) implementation for Home Assistant that provides intelligent code assistance (auto-completion, hover info, custom commands) for any LSP-compatible editor. It connects to a Home Assistant instance via WebSocket to fetch real-time entity states, services, and configuration data.

## Build and Development Commands

### Essential Commands

```bash
# Build the project
npm run build

# Watch mode for development (auto-rebuild on changes)
npm run dev
# or
npm run watch

# Run all tests
npm test

# Run specific test file
npm test -- cache.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Auto-fix lint errors
npm run lint:fix

# Clean build artifacts
npm run clean
```

### Testing Locally

Test the LSP server locally before installing globally:

```bash
# Use local build in Neovim config
cmd = { 'node', vim.fn.expand('~/git/homeassistant-lsp/dist/server.js'), '--stdio' }
```

### Environment Variables for Testing

```bash
export HA_HOST="ws://homeassistant.local:8123/api/websocket"
export HA_TOKEN="your-long-lived-access-token"
export LOG_LEVEL="DEBUG"  # DEBUG, INFO, WARN, ERROR
```

## Architecture Overview

### Core Components and Their Interactions

```
LSP Client (Neovim/VSCode)
         ↓ (JSON-RPC via stdio)
    server.ts (LSP Server Core)
         ↓
    ┌────┴────┐
    ↓         ↓
Completion  Hover
Provider   Provider
    ↓         ↓
    └────┬────┘
         ↓
    cache.ts (TTL-based caching)
         ↓
  ha-client.ts (WebSocket client)
         ↓ (WebSocket)
  Home Assistant API
```

### Key Architectural Patterns

**1. LSP Protocol Handling (`server.ts`)**
- Entry point is `onInitialize` which negotiates capabilities with the client
- CRITICAL: Server capabilities are declared **statically** in the `InitializeResult`, NOT via dynamic registration in `onInitialized`
- This prevents `registerCapability` warnings with clients that have `dynamicRegistration: false` (e.g., Neovim)
- Document lifecycle: onDidOpen → onDidChange → onDidClose

**2. WebSocket Connection State Machine (`ha-client.ts`)**
```
DISCONNECTED → CONNECTING → AUTHENTICATING → CONNECTED
                    ↓             ↓
                  ERROR ←────────┘
```
- Auto-reconnection with exponential backoff (max 10 attempts)
- Message ID correlation for request/response matching
- 30-second timeout per request with automatic cleanup
- Event-driven architecture using EventEmitter

**3. Caching Strategy (`cache.ts`)**
- TTL-based in-memory cache with LRU eviction
- Cache keys and TTLs:
  - `ha:entities` → 5 minutes (high read frequency)
  - `ha:services` → 10 minutes (low change rate)
  - `ha:config` → 1 hour (rarely changes)
  - `ha:dashboards` → 5 minutes (moderate changes)
- `getOrFetch` pattern for lazy loading
- Periodic cleanup of expired entries

**4. Logging System (`utils/logger.ts`)**
- Uses appropriate LSP console methods based on log level:
  - ERROR → `connection.console.error()`
  - WARN → `connection.console.warn()`
  - INFO → `connection.console.info()`
  - DEBUG → `connection.console.log()`
- IMPORTANT: This prevents INFO messages from appearing as ERROR in LSP logs
- Fallback to stderr when LSP connection not available (during early initialization)

### Provider Context Detection

**Completion Provider** (`providers/completion.ts`):
- Detects completion context by analyzing document text around cursor
- Contexts:
  1. Entity ID: After `entity_id:`, `entity:`, or in function calls like `get_state("sensor.")`
  2. Domain: 3+ characters without dot (e.g., `sensor`, `light`)
  3. Service: After `service:` or in `call_service()`
- Supports both YAML and Python files
- Max 50 completion items returned for performance

**Hover Provider** (`providers/hover.ts`):
- Extracts entity ID at cursor position using regex patterns
- Fetches current entity state and attributes from cache/HA
- Returns formatted Markdown with:
  - Friendly name (title)
  - Current state with icon and unit
  - Entity ID and domain
  - Key attributes
  - Timestamps (last changed/updated in relative time)

## Critical Implementation Details

### LSP Capability Registration

**DO NOT** set up workspace folder change listeners in `onInitialized` like this:
```typescript
// ❌ BAD - Triggers dynamic registration warning
connection.onInitialized(() => {
  connection.workspace.onDidChangeWorkspaceFolders((_event) => {
    // handler
  });
});
```

**DO** declare capabilities statically in `onInitialize`:
```typescript
// ✅ GOOD - Static capability declaration
connection.onInitialize(() => {
  return {
    capabilities: {
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true,
        },
      },
    },
  };
});
```

### Configuration Management

The server accepts configuration via three sources (priority order):
1. Environment variables (`HA_HOST`, `HA_TOKEN`, `HA_TIMEOUT`, `LOG_LEVEL`)
2. LSP client `initializationOptions`
3. LSP client `settings` (workspace configuration)

Configuration is validated in `onInitialized` - the server exits early if `host` or `token` are missing (logs error but does NOT show UI prompts to avoid blocking Neovim).

### Error Handling Patterns

**Connection Errors**: Auto-reconnect with exponential backoff
**Request Timeouts**: 30-second timeout with automatic cleanup of pending requests
**Validation Errors**: Detailed error messages logged, graceful degradation

### Python Support

The LSP works with Python files for AppDaemon automations:
- Detects entity IDs in function calls: `get_state("sensor.temp")`
- Service completion: `call_service("light.turn_on")`
- Supports string literals, f-strings, and format strings

## Common Development Tasks

### Adding a New Provider

1. Create provider in `src/providers/my-provider.ts`
2. Implement provider interface with appropriate LSP methods
3. Register in `server.ts`:
   ```typescript
   const myProvider = new MyProvider(haClient, cache);
   connection.onMyRequest((params) => {
     return myProvider.provideMyFeature(document, params);
   });
   ```
4. Add capability to `InitializeResult` in `onInitialize`
5. Add tests in `tests/unit/my-provider.test.ts`

### Adding a Custom Command

1. Add method to `CommandHandler` class in `commands.ts`
2. Register command name in `executeCommandProvider` capabilities
3. Add case in `executeCommand` switch statement
4. Update documentation

### Debugging LSP Issues

**Neovim**:
```vim
:LspInfo                    " Check LSP status
:LspLog                     " View LSP logs
:lua vim.lsp.set_log_level("DEBUG")
```

**Check logs**: `~/.local/state/nvim/lsp.log`

**Enable server debug logging**:
```bash
export LOG_LEVEL="DEBUG"
```

## Testing Strategy

- **Unit tests**: Test individual functions/classes in isolation
- **Integration tests**: Test interactions between components (e.g., Completion Provider + Cache + HA Client)
- **Use fixtures**: Mock data in `tests/fixtures/` for consistent testing
- **Coverage target**: 80%+ coverage

Example test structure:
```typescript
describe('CompletionProvider', () => {
  let provider: CompletionProvider;
  let mockClient: HomeAssistantClient;
  let mockCache: Cache;

  beforeEach(() => {
    mockClient = new HomeAssistantClient();
    mockCache = new Cache();
    provider = new CompletionProvider(mockClient, mockCache);
  });

  it('should provide entity completions', async () => {
    // Test implementation
  });
});
```

## Performance Considerations

- **Result limiting**: Max 50 completion items to prevent UI lag
- **Cache hit optimization**: High TTLs for stable data (services, config)
- **Connection pooling**: Single WebSocket connection shared across all requests
- **Background cleanup**: Expired cache entries removed periodically (every 60s)
- **Lazy loading**: Cache miss triggers fetch only when needed (getOrFetch pattern)

## Security Notes

- **Never log tokens**: Tokens are masked in logs as `***PROVIDED***`
- **Environment variable support**: Allows config without storing in editor settings
- **WSS support**: Use `wss://` URLs for TLS-encrypted WebSocket connections
- **Token-based auth**: Uses Home Assistant long-lived access tokens

## Related Documentation

- Full architecture: See `ARCHITECTURE.md` for detailed component diagrams
- Development workflow: See `DEVELOPMENT.md` for setup, debugging, profiling
- Contributing guidelines: See `CONTRIBUTING.md` for code style, PR process
- User documentation: See `README.md` for installation and usage

## Common Pitfalls

1. **Don't use dynamic registration**: Always declare capabilities statically in `onInitialize`
2. **Don't block on initialization**: Log errors but don't show UI prompts (blocks Neovim)
3. **Don't log sensitive data**: Mask tokens and credentials
4. **Don't bypass cache**: Always use `getOrFetch` pattern, not direct HA client calls
5. **Don't use console.log directly**: Use the logger utility with appropriate log levels
