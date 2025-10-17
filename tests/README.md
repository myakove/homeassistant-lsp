# Tests

This directory contains the test suite for the Home Assistant LSP Server.

## Structure

```
tests/
├── unit/          # Unit tests for individual modules
├── integration/   # Integration tests for full workflows
├── fixtures/      # Mock data and test fixtures
└── README.md      # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- cache.test.ts
```

## Writing Tests

### Unit Tests

Unit tests should focus on testing individual functions and classes in isolation:

```typescript
import { Cache } from '../../src/cache';

describe('Cache', () => {
  it('should store and retrieve values', () => {
    const cache = new Cache();
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });
});
```

### Integration Tests

Integration tests should test the interaction between multiple components:

```typescript
import { HomeAssistantClient } from '../../src/ha-client';
import { Cache } from '../../src/cache';

describe('LSP Server Integration', () => {
  it('should provide completions using cached entities', async () => {
    // Test full workflow
  });
});
```

### Mock Data

Use fixtures for consistent test data:

```typescript
import mockEntities from '../fixtures/mock-entities.json';

describe('Hover Provider', () => {
  it('should format entity hover', () => {
    const entity = mockEntities[0];
    // Test with mock data
  });
});
```

## Coverage Goals

- Unit tests: 80%+ coverage
- Integration tests: Key workflows covered
- Critical paths: 100% coverage

## CI/CD Integration

Tests are automatically run in CI/CD pipelines:
- On pull requests
- Before merging to main
- Before releases
