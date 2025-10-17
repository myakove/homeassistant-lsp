# Contributing to Home Assistant LSP Server

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Assume good intentions

## How to Contribute

### Reporting Issues

Before creating an issue:
1. Check if the issue already exists
2. Gather relevant information:
   - LSP server version
   - Home Assistant version
   - Editor and version (Neovim, VSCode, etc.)
   - Error messages and logs
   - Steps to reproduce

Create a clear issue:
```markdown
**Description**
Brief description of the issue

**Steps to Reproduce**
1. Open file...
2. Type...
3. See error...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- LSP Server version: 0.1.0
- Home Assistant version: 2024.1.0
- Editor: Neovim 0.9.0
- OS: Linux

**Logs**
```
[paste relevant logs]
```
```

### Suggesting Features

Feature requests should include:
- Clear use case and motivation
- Proposed implementation approach
- Potential alternatives considered
- Examples of similar features in other LSPs

### Contributing Code

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/homeassistant-lsp.git
   cd homeassistant-lsp
   npm install
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/my-bugfix
   ```

3. **Make Changes**
   - Follow the code style (see below)
   - Add tests for new functionality
   - Update documentation
   - Keep commits focused and atomic

4. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "Add feature: description"
   ```

   Commit message format:
   - `feat: Add new feature`
   - `fix: Fix bug in X`
   - `docs: Update documentation`
   - `test: Add tests for Y`
   - `refactor: Refactor Z`
   - `perf: Improve performance of W`

6. **Push and Create PR**
   ```bash
   git push origin feature/my-feature
   ```
   
   Then create a pull request on GitHub.

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Prefer immutability
- Use async/await over promises

Example:
```typescript
/**
 * Fetch entity state from Home Assistant
 * @param entityId - The entity identifier (e.g., "sensor.temperature")
 * @returns Entity state or null if not found
 * @throws Error if not connected to Home Assistant
 */
async getEntityState(entityId: string): Promise<EntityState | null> {
  if (!this.isConnected()) {
    throw new Error('Not connected to Home Assistant');
  }
  
  const entities = await this.getStates();
  return entities.find(e => e.entity_id === entityId) ?? null;
}
```

### Testing Requirements

All contributions must include tests:

1. **Unit Tests** for new functions/classes
   ```typescript
   describe('MyFeature', () => {
     it('should handle normal case', () => {
       expect(result).toBe(expected);
     });
     
     it('should handle edge case', () => {
       expect(edgeCase).toBe(expected);
     });
     
     it('should handle error case', () => {
       expect(() => errorCase()).toThrow();
     });
   });
   ```

2. **Integration Tests** for features spanning multiple components

3. **Coverage** should not decrease (aim for 80%+)

### Documentation Requirements

Update relevant documentation:

- **README.md**: User-facing features and usage
- **ARCHITECTURE.md**: System design changes
- **API.md**: New commands or capabilities
- **DEVELOPMENT.md**: Developer workflow changes
- **Code comments**: For complex logic

### Performance Considerations

- Use caching appropriately
- Avoid blocking operations
- Consider memory usage
- Profile performance-critical code
- Document time/space complexity for algorithms

### Security Considerations

- Never log sensitive information (tokens, passwords)
- Validate all inputs
- Handle errors securely
- Follow principle of least privilege
- Document security implications

## Pull Request Process

1. **PR Description**
   - Reference related issues
   - Explain what and why
   - Include screenshots/examples if relevant
   - Note any breaking changes

2. **Checklist**
   - [ ] Tests pass (`npm test`)
   - [ ] Lint passes (`npm run lint`)
   - [ ] Build succeeds (`npm run build`)
   - [ ] Documentation updated
   - [ ] Changelog updated (for significant changes)
   - [ ] No merge conflicts

3. **Review Process**
   - Maintainers will review within 1 week
   - Address feedback promptly
   - Be open to suggestions
   - Update PR based on feedback

4. **After Merge**
   - Delete your feature branch
   - Pull latest changes from main
   - Celebrate! 🎉

## Project Organization

### Module Responsibilities

- **server.ts**: LSP protocol handling, coordination
- **ha-client.ts**: Home Assistant communication
- **cache.ts**: Data caching and invalidation
- **providers/**: LSP feature implementations
- **utils/**: Shared utilities
- **commands.ts**: Custom command handlers

### Dependencies

Be cautious when adding dependencies:
- Justify the need
- Check license compatibility
- Consider bundle size
- Verify maintenance status
- Add to appropriate section (dependencies vs devDependencies)

### TypeScript Guidelines

```typescript
// ✅ Good
interface UserConfig {
  host: string;
  token: string;
  timeout?: number;
}

function processConfig(config: UserConfig): ValidatedConfig {
  // Implementation
}

// ❌ Avoid
function processConfig(config: any): any {
  // Implementation
}
```

## Common Patterns

### Error Handling

```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', error);
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}
```

### Async Patterns

```typescript
// ✅ Good: Use async/await
async function fetchData(): Promise<Data> {
  const response = await client.request();
  return processResponse(response);
}

// ❌ Avoid: Promise chains
function fetchData(): Promise<Data> {
  return client.request()
    .then(response => processResponse(response));
}
```

### Cache Usage

```typescript
// Use getOrFetch pattern
const entities = await cache.getOrFetch(
  CacheKeys.ENTITIES,
  () => haClient.getStates(),
  300 // TTL in seconds
);
```

## Getting Help

- **Questions**: Open a discussion on GitHub
- **Bugs**: Open an issue
- **Security**: Email security@example.com (do not open public issue)
- **Chat**: Join our Discord/Slack (if available)

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in commit history

Thank you for contributing! 🙏
