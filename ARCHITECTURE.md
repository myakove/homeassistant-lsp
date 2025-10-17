# Architecture

## System Overview

The Home Assistant LSP Server is built on a modular architecture with the following key components:

```
┌─────────────────────────────────────────────────────────┐
│                    LSP Client                           │
│            (Neovim, VSCode, etc.)                       │
└───────────────────┬─────────────────────────────────────┘
                    │ LSP Protocol (JSON-RPC)
                    │ stdin/stdout
┌───────────────────▼─────────────────────────────────────┐
│                 LSP Server (server.ts)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  • Connection Management                         │   │
│  │  • Capability Registration                       │   │
│  │  • Document Synchronization                      │   │
│  │  • Configuration Management                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────┬────────────────┬──────────────────┬──────────────┘
      │                │                  │
      ▼                ▼                  ▼
┌─────────────┐  ┌──────────┐      ┌──────────────┐
│ Completion  │  │  Hover   │      │ Diagnostics  │
│  Provider   │  │ Provider │      │   Provider   │
└─────────────┘  └──────────┘      └──────────────┘
      │                │                  │
      └────────────────┴──────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Cache Layer   │
              │  (TTL-based)   │
              └────────┬───────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Home Assistant      │
            │  WebSocket Client    │
            └──────────┬───────────┘
                       │ WebSocket
                       ▼
            ┌──────────────────────┐
            │   Home Assistant     │
            │    Server (API)      │
            └──────────────────────┘
```

## Core Components

### 1. LSP Server (`server.ts`)

**Responsibilities:**
- Manages LSP protocol communication via stdio
- Handles initialization and capability registration
- Coordinates document lifecycle (open, change, close)
- Routes requests to appropriate providers
- Manages server configuration and logging

**Key Methods:**
- `onInitialize`: Capability negotiation
- `onInitialized`: Setup connections and validation
- `onDidChangeConfiguration`: Handle config updates
- Document event handlers (open, change, close)

### 2. Home Assistant Client (`ha-client.ts`)

**Responsibilities:**
- WebSocket connection to Home Assistant
- Authentication with long-lived tokens
- Message ID tracking and correlation
- Auto-reconnection with exponential backoff
- Event subscription management

**Connection States:**
```
DISCONNECTED → CONNECTING → AUTHENTICATING → CONNECTED
                    ↓             ↓
                  ERROR ←────────┘
```

**Key Methods:**
- `connect(url, token)`: Establish connection
- `getStates()`: Fetch all entities
- `getServices()`: Fetch available services
- `getDashboards()`: List Lovelace dashboards
- `subscribeEvents()`: Subscribe to HA events

### 3. Cache Layer (`cache.ts`)

**Responsibilities:**
- In-memory caching with TTL
- LRU eviction when max size reached
- Pattern-based invalidation
- Statistics tracking
- Periodic cleanup of expired entries

**Cache Keys:**
```typescript
const CacheKeys = {
  ENTITIES: 'ha:entities',          // TTL: 5 minutes
  SERVICES: 'ha:services',          // TTL: 10 minutes
  CONFIG: 'ha:config',              // TTL: 1 hour
  DASHBOARDS: 'ha:dashboards',      // TTL: 5 minutes
};
```

**Features:**
- Automatic expiration
- getOrFetch pattern for lazy loading
- Event emission for monitoring
- Thread-safe operations

### 4. Providers

#### Completion Provider (`providers/completion.ts`)

**Responsibilities:**
- Detect completion context (entity_id, service, domain)
- Filter and rank completion items
- Provide Markdown documentation

**Completion Contexts:**
1. **Entity ID**: After `entity_id:`, `entity:`, in functions
2. **Domain**: 3+ characters without dot
3. **Service**: After `service:`, in `call_service()`

#### Hover Provider (`providers/hover.ts`)

**Responsibilities:**
- Extract entity ID at cursor position
- Fetch entity state and attributes
- Format rich Markdown hover content

**Hover Content Sections:**
1. Friendly name (title)
2. State with icon and unit
3. Entity ID and domain
4. Key attributes
5. Timestamps (relative time)

#### Diagnostics Provider (`providers/diagnostics.ts`)

**Responsibilities:**
- Parse documents for entity references
- Validate against Home Assistant entities
- Generate error/warning diagnostics
- Debounced validation

**Diagnostic Types:**
1. **Error**: Entity not found, unknown domain
2. **Warning**: Entity unavailable

### 5. Utilities

#### Logger (`utils/logger.ts`)

**Features:**
- LSP-compatible output (stderr for logs)
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Structured logging with timestamps
- Child logger support

#### Configuration Manager (`utils/config.ts`)

**Features:**
- Load from client initialization
- Environment variable overrides
- Comprehensive validation
- Type-safe access with getters

## Data Flow

### 1. Completion Request Flow

```
User types → LSP Client → onCompletion Request
                           ↓
                    Completion Provider
                           ↓
                      Parse Context
                           ↓
                 Check Cache (entities)
                           ↓
              ┌─────────────┴─────────────┐
              ↓                           ↓
          Cache Hit                   Cache Miss
              ↓                           ↓
       Return Cached              Fetch from HA
              ↓                           ↓
              └─────────────┬─────────────┘
                           ↓
                    Filter & Rank Items
                           ↓
                    Format Documentation
                           ↓
                  Return CompletionItem[]
```

### 2. Diagnostics Flow

```
Document Change → Debounce Timer (500ms)
                           ↓
                  Extract Entity IDs
                           ↓
                   Fetch Entities (cache)
                           ↓
              ┌────────────┴────────────┐
              ↓                         ↓
       Validate Domains          Validate Entities
              ↓                         ↓
              └────────────┬────────────┘
                           ↓
                  Generate Diagnostics
                           ↓
                   Return Diagnostic[]
```

### 3. WebSocket Communication

```
HA Client → WebSocket.send(message)
              ↓
         Add to pendingRequests
              ↓
         Set timeout (30s)
              ↓
    Wait for response from HA
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
Response            Timeout
    ↓                   ↓
Resolve Promise    Reject Promise
    ↓                   ↓
Clear timeout      Remove from pending
```

## Performance Considerations

### Caching Strategy

1. **Entity Cache**: 5-minute TTL
   - High read frequency
   - Moderate change rate
   - Invalidate on connection events

2. **Service Cache**: 10-minute TTL
   - Low change rate
   - Rarely modified
   - Full invalidation on reload

3. **Dashboard Cache**: 5-minute TTL
   - Moderate change rate
   - User-driven changes
   - Invalidate on save operations

### Optimization Techniques

1. **Debouncing**: Diagnostics delayed 500ms
2. **Result Limiting**: Max 50 completion items
3. **Lazy Loading**: Cache miss triggers fetch
4. **Background Cleanup**: Expired entries removed periodically
5. **Connection Pooling**: Single WebSocket connection

## Security Considerations

1. **Token Storage**: 
   - Never logged or displayed
   - Only in memory
   - Environment variable support

2. **WebSocket Security**:
   - Supports WSS (TLS)
   - Token-based authentication
   - Connection timeout handling

3. **Input Validation**:
   - Configuration validation
   - Entity ID format validation
   - Dashboard config structure validation

## Extensibility

### Adding New Providers

1. Create provider in `src/providers/`
2. Implement provider interface
3. Register in `server.ts`
4. Add capability to initialization
5. Wire up event handlers

### Adding Custom Commands

1. Add method to `CommandHandler`
2. Register command name
3. Implement validation and logic
4. Document command API

### Supporting New Editors

1. Configure LSP client
2. Set initialization options
3. Map custom commands
4. Test capability support

## Error Handling

### Connection Errors

- Auto-reconnect with exponential backoff
- Max 10 reconnection attempts
- User notification on failure

### Request Timeouts

- 30-second timeout per request
- Automatic cleanup of pending requests
- Error messages to client

### Validation Errors

- Configuration validation on load
- Runtime validation for commands
- Detailed error messages with context

## Monitoring

### Logging

- Configurable log levels
- Structured log format
- Context-aware logging
- Performance logging

### Metrics

- Cache hit/miss rates
- Request latency
- Connection status
- Provider usage statistics

## Future Enhancements

1. **Code Actions**: Quick fixes for entity errors
2. **Signature Help**: Service parameter hints
3. **Semantic Tokens**: Syntax highlighting
4. **Workspace Symbols**: Entity search
5. **Document Formatting**: YAML formatting
6. **Rename**: Entity ID refactoring
