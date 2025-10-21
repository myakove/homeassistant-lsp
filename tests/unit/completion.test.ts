/**
 * Completion Provider Tests
 * Tests entity prefix matching and completion logic
 */

import { CompletionProvider } from '../../src/providers/completion';
import { HomeAssistantClient } from '../../src/ha-client';
import { Cache } from '../../src/cache';
import { Entity } from '../../src/types/homeassistant';
import { TextDocument } from 'vscode-languageserver-textdocument';

// Mock Home Assistant Client
class MockHomeAssistantClient extends HomeAssistantClient {
  private mockEntities: Entity[] = [];

  setMockEntities(entities: Entity[]) {
    this.mockEntities = entities;
  }

  async getStates(): Promise<Entity[]> {
    return this.mockEntities;
  }

  async getServices(): Promise<any> {
    return {};
  }

  async connect(_host: string, _token: string): Promise<void> {
    // Mock connection
  }

  disconnect(): void {
    // Mock disconnect
  }
}

// Mock Cache
class MockCache extends Cache {
  private store: Map<string, any> = new Map();

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    _ttl?: number
  ): Promise<T> {
    if (this.store.has(key)) {
      return this.store.get(key);
    }
    const value = await fetchFn();
    this.store.set(key, value);
    return value;
  }

  clear(): void {
    this.store.clear();
  }

  destroy(): void {
    this.store.clear();
  }
}

describe('CompletionProvider', () => {
  let completionProvider: CompletionProvider;
  let mockClient: MockHomeAssistantClient;
  let mockCache: MockCache;

  beforeEach(() => {
    mockClient = new MockHomeAssistantClient();
    mockCache = new MockCache();
    completionProvider = new CompletionProvider(mockClient, mockCache);
  });

  describe('Entity ID Prefix Matching', () => {
    beforeEach(() => {
      // Setup mock entities matching the bug report scenario
      const mockEntities: Entity[] = [
        {
          entity_id: 'switch.spz1',
          state: 'on',
          attributes: { friendly_name: 'Switch SPZ 1' },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
        {
          entity_id: 'switch.spz2',
          state: 'off',
          attributes: { friendly_name: 'Switch SPZ 2' },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
        {
          entity_id: 'switch.spz11',
          state: 'on',
          attributes: { friendly_name: 'Switch SPZ 11' },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
        {
          entity_id: 'switch.other_switch',
          state: 'off',
          attributes: { friendly_name: 'Other Switch' },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
        {
          entity_id: 'light.spz_light',
          state: 'on',
          attributes: { friendly_name: 'SPZ Light' },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
      ];

      mockClient.setMockEntities(mockEntities);
    });

    test('should complete "switch.spz" with all spz* entities', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'switch.spz');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 10 }, // After "switch.spz"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match switch.spz1, switch.spz2, switch.spz11
      expect(completions.length).toBe(3);
      expect(completions.map((c) => c.label).sort()).toEqual([
        'switch.spz1',
        'switch.spz11',
        'switch.spz2',
      ]);
    });

    test('should complete "switch.spz1" with spz1* entities', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'switch.spz1');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 11 }, // After "switch.spz1"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match switch.spz1 and switch.spz11 (both start with spz1)
      expect(completions.length).toBe(2);
      expect(completions.map((c) => c.label).sort()).toEqual(['switch.spz1', 'switch.spz11']);
    });

    test('should complete "switch.s" with entities starting with s', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'switch.s');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 8 }, // After "switch.s"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match switch.spz1, switch.spz2, switch.spz11 (all start with s)
      expect(completions.length).toBe(3);
      expect(completions.map((c) => c.label).sort()).toEqual([
        'switch.spz1',
        'switch.spz11',
        'switch.spz2',
      ]);
    });

    test('should NOT match entities that only contain prefix as substring', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'light.spz');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 9 }, // After "light.spz"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match light.spz_light (starts with spz)
      expect(completions.length).toBe(1);
      expect(completions[0].label).toBe('light.spz_light');
    });

    test('should complete "switch.other" with exact prefix match', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'switch.other');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 12 }, // After "switch.other"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match switch.other_switch
      expect(completions.length).toBe(1);
      expect(completions[0].label).toBe('switch.other_switch');
    });

    test('should return all domain entities when only domain is provided', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'switch.');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 7 }, // After "switch."
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match all switch.* entities (4 total)
      expect(completions.length).toBe(4);
      expect(completions.map((c) => c.label).sort()).toEqual([
        'switch.other_switch',
        'switch.spz1',
        'switch.spz11',
        'switch.spz2',
      ]);
    });

    test('should be case-insensitive', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'switch.SPZ');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 10 }, // After "switch.SPZ"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match all spz* entities (case-insensitive)
      expect(completions.length).toBe(3);
      expect(completions.map((c) => c.label).sort()).toEqual([
        'switch.spz1',
        'switch.spz11',
        'switch.spz2',
      ]);
    });
  });

  describe('Domain Prefix Matching', () => {
    beforeEach(() => {
      const mockEntities: Entity[] = [
        {
          entity_id: 'switch.test',
          state: 'on',
          attributes: {},
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
        {
          entity_id: 'sensor.test',
          state: '22',
          attributes: {},
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
        {
          entity_id: 'light.test',
          state: 'off',
          attributes: {},
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
      ];

      mockClient.setMockEntities(mockEntities);
    });

    test('should complete domain names starting with prefix', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'sw');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 2 }, // After "sw"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should match switch domain
      expect(completions.length).toBe(1);
      expect(completions[0].label).toBe('switch');
      expect(completions[0].insertText).toBe('switch.');
    });

    test('should complete partial domain prefix', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 's');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 1 },
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should return domains starting with 's' (sensor, switch)
      expect(completions.length).toBe(2);
      expect(completions.map((c) => c.label).sort()).toEqual(['sensor', 'switch']);
    });
  });

  describe('Invalid Entity ID Patterns', () => {
    beforeEach(() => {
      const mockEntities: Entity[] = [
        {
          entity_id: 'sensor.temperature',
          state: '22',
          attributes: { friendly_name: 'Temperature Sensor' },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
        {
          entity_id: 'light.bedroom',
          state: 'on',
          attributes: { friendly_name: 'Bedroom Light' },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
      ];

      mockClient.setMockEntities(mockEntities);
    });

    test('should NOT provide completions for double dots (sensor..)', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'sensor..');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 8 }, // After "sensor.."
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should return empty array for invalid pattern
      expect(completions.length).toBe(0);
    });

    test('should NOT provide completions for just double dots (..)', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, '..');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 2 }, // After ".."
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should return empty array for invalid pattern
      expect(completions.length).toBe(0);
    });

    test('should NOT provide completions for double dots in middle (sensor..temp)', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'sensor..temp');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 12 }, // After "sensor..temp"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should return empty array for invalid pattern
      expect(completions.length).toBe(0);
    });

    test('should NOT provide completions for pattern starting with dot (.sensor)', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, '.sensor');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 7 }, // After ".sensor"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should return empty array for invalid pattern
      expect(completions.length).toBe(0);
    });

    test('should provide completions for valid single dot pattern (sensor.)', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'sensor.');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 7 }, // After "sensor."
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should return sensor entities for valid pattern
      expect(completions.length).toBe(1);
      expect(completions[0].label).toBe('sensor.temperature');
    });

    test('should provide completions for valid entity pattern (light.bed)', async () => {
      const document = TextDocument.create('test://test.yaml', 'yaml', 1, 'light.bed');
      const position = {
        textDocument: { uri: 'test://test.yaml' },
        position: { line: 0, character: 9 }, // After "light.bed"
      };

      const completions = await completionProvider.provideCompletionItems(document, position);

      // Should return matching entity for valid pattern
      expect(completions.length).toBe(1);
      expect(completions[0].label).toBe('light.bedroom');
    });
  });
});
