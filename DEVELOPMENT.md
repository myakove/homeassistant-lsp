# Development Guide

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git
- Home Assistant instance (for testing)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/homeassistant-lsp.git
cd homeassistant-lsp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Development Workflow

```bash
# Start development mode (watch for changes)
npm run dev

# In another terminal, test with a sample file
node dist/server.js < sample-input.json
```

## Project Structure

```
homeassistant-lsp/
├── src/
│   ├── server.ts              # Main LSP server
│   ├── ha-client.ts           # WebSocket client
│   ├── cache.ts               # Caching layer
│   ├── commands.ts            # Custom commands
│   ├── providers/
│   │   ├── completion.ts      # Completion provider
│   │   ├── hover.ts           # Hover provider
│   │   └── diagnostics.ts     # Diagnostics provider
│   ├── utils/
│   │   ├── logger.ts          # Logging utility
│   │   └── config.ts          # Configuration
│   └── types/
│       └── homeassistant.ts   # Type definitions
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── fixtures/              # Test data
├── dist/                      # Compiled output
└── docs/                      # Additional docs
```

## Building

### Standard Build

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Watch Mode

```bash
npm run watch
# or
npm run dev
```

Automatically recompiles on file changes.

### Clean Build

```bash
npm run clean
npm run build
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- cache.test.ts

# Run with coverage
npm run test:coverage
```

### Writing Tests

#### Unit Tests

Create test files in `tests/unit/` with `.test.ts` extension:

```typescript
import { Cache } from '../../src/cache';

describe('MyModule', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

#### Integration Tests

Create test files in `tests/integration/`:

```typescript
import { HomeAssistantClient } from '../../src/ha-client';
import { CompletionProvider } from '../../src/providers/completion';

describe('Completion Integration', () => {
  it('should provide completions from HA', async () => {
    // Test full workflow
  });
});
```

#### Using Fixtures

```typescript
import mockEntities from '../fixtures/mock-entities.json';

describe('Provider Tests', () => {
  it('should handle entities', () => {
    const entity = mockEntities[0];
    // Use mock data
  });
});
```

## Debugging

### VSCode Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug LSP Server",
      "program": "${workspaceFolder}/dist/server.js",
      "console": "integratedTerminal",
      "sourceMaps": true
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ]
}
```

### Logging

Enable debug logging:

```bash
# Set log level in config
{
  "logging": {
    "level": "debug"
  }
}
```

View logs in your LSP client (Neovim `:LspLog`, VSCode Output panel).

### Testing with Real Home Assistant

1. Set up environment variables:

```bash
export HA_HOST="ws://homeassistant.local:8123/api/websocket"
export HA_TOKEN="your-long-lived-access-token"
export LOG_LEVEL="debug"
```

2. Run the server:

```bash
node dist/server.js
```

3. Send LSP messages via stdin

## Code Style

### Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

### Formatting

Follow the TypeScript style guide:

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons
- Use TypeScript types (avoid `any`)
- Document public APIs with JSDoc

Example:

```typescript
/**
 * Get entity from cache or fetch from Home Assistant
 * @param entityId - The entity ID to fetch
 * @returns The entity or null if not found
 */
async getEntity(entityId: string): Promise<Entity | null> {
  // Implementation
}
```

## Making Changes

### Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes

3. Add tests for new functionality

4. Run tests and linting:
   ```bash
   npm test
   npm run lint
   ```

5. Build and verify:
   ```bash
   npm run build
   ```

6. Commit with descriptive message:
   ```bash
   git commit -m "Add feature X"
   ```

7. Push and create pull request

### Adding a New Provider

1. Create file in `src/providers/`:
   ```typescript
   export class MyProvider {
     async provideMyFeature() {
       // Implementation
     }
   }
   ```

2. Register in `server.ts`:
   ```typescript
   connection.onMyRequest((params) => {
     return myProvider.provideMyFeature(params);
   });
   ```

3. Add tests in `tests/unit/`:
   ```typescript
   describe('MyProvider', () => {
     it('should provide feature', () => {
       // Test
     });
   });
   ```

4. Update documentation

### Adding a Custom Command

1. Add method to `CommandHandler`:
   ```typescript
   private async myCommand(args?: any[]): Promise<CommandResult> {
     // Implementation
   }
   ```

2. Register in `executeCommand`:
   ```typescript
   case 'homeassistant.myCommand':
     return await this.myCommand(args);
   ```

3. Document in API.md

## Performance Profiling

### Memory Usage

```bash
node --inspect dist/server.js
```

Open Chrome DevTools at `chrome://inspect`

### CPU Profiling

```bash
node --prof dist/server.js
node --prof-process isolate-*.log > profile.txt
```

### Cache Statistics

Monitor cache performance:

```typescript
const stats = cache.getStats();
console.log('Hit rate:', stats.hits / (stats.hits + stats.misses));
```

## Troubleshooting

### Build Errors

- Clear dist folder: `npm run clean`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript version: `npx tsc --version`

### Test Failures

- Run tests individually: `npm test -- my.test.ts`
- Check for timing issues (use `jest.setTimeout()`)
- Verify mock data is correct

### Connection Issues

- Verify HA instance is accessible
- Check token is valid
- Enable debug logging
- Check WebSocket URL format (ws:// or wss://)

## Release Process

1. Update version in `package.json`

2. Update CHANGELOG.md

3. Run full test suite:
   ```bash
   npm test
   npm run test:coverage
   ```

4. Build and verify:
   ```bash
   npm run build
   node dist/server.js --version
   ```

5. Commit and tag:
   ```bash
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   ```

6. Push to repository:
   ```bash
   git push origin main --tags
   ```

7. Publish to npm (if public):
   ```bash
   npm publish
   ```

## Resources

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [Home Assistant API](https://developers.home-assistant.io/docs/api/websocket)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

## Getting Help

- Open an issue on GitHub
- Join discussions
- Check existing issues and PRs
- Review the architecture documentation
