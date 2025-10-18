/**
 * Diagnostics Provider
 * Validates entity references in documents
 */

import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { HomeAssistantClient } from '../ha-client';
import { Cache, CacheKeys } from '../cache';
import { Entity } from '../types/homeassistant';
import { getLogger } from '../utils/logger';

const logger = getLogger('DiagnosticsProvider');

/**
 * Diagnostics Provider
 */
export class DiagnosticsProvider {
  private haClient: HomeAssistantClient;
  private cache: Cache;
  private debounceTimer: Map<string, NodeJS.Timeout> = new Map();
  private debounceDelay: number;

  constructor(
    haClient: HomeAssistantClient,
    cache: Cache,
    debounceDelay: number = 500
  ) {
    this.haClient = haClient;
    this.cache = cache;
    this.debounceDelay = debounceDelay;
  }

  /**
   * Validate document and return diagnostics
   */
  async validateDocument(
    document: TextDocument,
    debounce: boolean = true
  ): Promise<Diagnostic[]> {
    // Debounce validation if requested
    if (debounce) {
      return new Promise((resolve) => {
        const existingTimer = this.debounceTimer.get(document.uri);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
          this.debounceTimer.delete(document.uri);
          const diagnostics = await this.performValidation(document);
          resolve(diagnostics);
        }, this.debounceDelay);

        this.debounceTimer.set(document.uri, timer);
      });
    }

    return this.performValidation(document);
  }

  /**
   * Perform validation
   */
  private async performValidation(document: TextDocument): Promise<Diagnostic[]> {
    try {
      // Check if connected
      if (!this.haClient.isConnected()) {
        logger.debug('Skipping validation - not connected to Home Assistant');
        return [];
      }

      const text = document.getText();
      const diagnostics: Diagnostic[] = [];

      // Get all entities for validation
      const entities = await this.getEntities();
      const entityMap = new Map(entities.map((e) => [e.entity_id, e]));

      // Extract all entity IDs from document
      const entityReferences = this.extractEntityReferences(text);

      logger.debug(
        `Found ${entityReferences.length} entity references in ${document.uri}`
      );

      // Validate each reference
      for (const ref of entityReferences) {
        const entity = entityMap.get(ref.entityId);

        if (!entity) {
          // Entity not found - just report it's missing
          // Don't check domain validity to avoid false positives
          diagnostics.push({
            severity: DiagnosticSeverity.Warning, // Changed to Warning instead of Error
            range: ref.range,
            message: `Entity '${ref.entityId}' not found in Home Assistant`,
            source: 'homeassistant-lsp',
          });
        } else if (entity.state === 'unavailable') {
          diagnostics.push({
            severity: DiagnosticSeverity.Information, // Changed to Info for less noise
            range: ref.range,
            message: `Entity '${ref.entityId}' is currently unavailable`,
            source: 'homeassistant-lsp',
          });
        }
      }

      logger.debug(`Generated ${diagnostics.length} diagnostics for ${document.uri}`);
      return diagnostics;
    } catch (error) {
      logger.error('Diagnostics validation error', error);
      return [];
    }
  }

  /**
   * Extract entity references from text
   */
  private extractEntityReferences(
    text: string
  ): Array<{ entityId: string; range: Range }> {
    const references: Array<{ entityId: string; range: Range }> = [];
    const lines = text.split('\n');

    // Entity ID pattern
    const entityIdPattern = /\b([a-z_]+\.[a-z0-9_]+)\b/g;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      // Skip comments
      if (line.trim().startsWith('#')) {
        continue;
      }

      // Skip lines with YAML tags (!secret, !include, etc.)
      if (/!\w+/.test(line)) {
        continue;
      }

      // Skip lines that look like file paths or config (too many false positives)
      if (line.includes('/') || line.includes('://')) {
        continue;
      }

      let match;

      while ((match = entityIdPattern.exec(line)) !== null) {
        const entityId = match[0];
        const startChar = match.index;
        const endChar = startChar + entityId.length;

        // Simple check: skip if it has a file extension
        if (/\.(yaml|yml|json|xml|txt|md|py|js|ts|conf|cfg|ini|toml)$/.test(entityId)) {
          continue;
        }

        references.push({
          entityId,
          range: {
            start: { line: lineNum, character: startChar },
            end: { line: lineNum, character: endChar },
          },
        });
      }
    }

    return references;
  }

  /**
   * Get entities from cache
   */
  private async getEntities(): Promise<Entity[]> {
    return this.cache.getOrFetch<Entity[]>(
      CacheKeys.ENTITIES,
      () => this.haClient.getStates(),
      300 // 5 minutes TTL
    );
  }

  /**
   * Clear debounce timer for a document
   */
  clearDebounce(documentUri: string): void {
    const timer = this.debounceTimer.get(documentUri);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimer.delete(documentUri);
    }
  }

  /**
   * Clear all debounce timers
   */
  clearAllDebounce(): void {
    for (const timer of this.debounceTimer.values()) {
      clearTimeout(timer);
    }
    this.debounceTimer.clear();
  }
}
