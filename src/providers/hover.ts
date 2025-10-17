/**
 * Hover Provider
 * Displays entity information on hover
 */

import {
  Hover,
  MarkupKind,
  TextDocumentPositionParams,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { HomeAssistantClient } from '../ha-client';
import { Cache, CacheKeys } from '../cache';
import { Entity } from '../types/homeassistant';
import { getLogger } from '../utils/logger';

const logger = getLogger('HoverProvider');

/**
 * Hover Provider
 */
export class HoverProvider {
  private haClient: HomeAssistantClient;
  private cache: Cache;

  constructor(haClient: HomeAssistantClient, cache: Cache) {
    this.haClient = haClient;
    this.cache = cache;
  }

  /**
   * Provide hover information
   */
  async provideHover(
    document: TextDocument,
    position: TextDocumentPositionParams
  ): Promise<Hover | null> {
    try {
      // Get the word at the cursor position
      const line = document.getText({
        start: { line: position.position.line, character: 0 },
        end: { line: position.position.line + 1, character: 0 },
      });

      const cursorPos = position.position.character;

      // Extract entity ID at cursor position
      const entityId = this.extractEntityId(line, cursorPos);

      if (!entityId) {
        return null;
      }

      logger.debug(`Hover requested for: ${entityId}`);

      // Check if client is connected
      if (!this.haClient.isConnected()) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: '⚠️ Not connected to Home Assistant',
          },
        };
      }

      // Get entity information
      const entity = await this.getEntity(entityId);

      if (!entity) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: `❌ Entity \`${entityId}\` not found in Home Assistant`,
          },
        };
      }

      // Format hover content
      const content = this.formatEntityHover(entity);

      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: content,
        },
      };
    } catch (error) {
      logger.error('Hover provider error', error);
      return null;
    }
  }

  /**
   * Extract entity ID from line at cursor position
   */
  private extractEntityId(line: string, cursorPos: number): string | null {
    // Entity ID pattern: domain.entity_name (e.g., sensor.temperature)
    const entityIdPattern = /\b([a-z_]+\.[a-z0-9_]+)\b/gi;
    let match;

    while ((match = entityIdPattern.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if cursor is within this entity ID
      if (cursorPos >= start && cursorPos <= end) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Get entity from cache or Home Assistant
   */
  private async getEntity(entityId: string): Promise<Entity | null> {
    const entities = await this.cache.getOrFetch<Entity[]>(
      CacheKeys.ENTITIES,
      () => this.haClient.getStates(),
      300 // 5 minutes TTL
    );

    return entities.find((e) => e.entity_id === entityId) || null;
  }

  /**
   * Format entity information for hover display
   */
  private formatEntityHover(entity: Entity): string {
    const friendlyName = entity.attributes.friendly_name || entity.entity_id;
    const [domain] = entity.entity_id.split('.');
    const unit = entity.attributes.unit_of_measurement || '';
    const state = entity.state;

    let content = `## ${friendlyName}\n\n`;

    // State section
    const stateIcon = state === 'unavailable' ? '⚠️' : '✓';
    content += `**State:** ${stateIcon} \`${state}${unit ? ' ' + unit : ''}\`\n\n`;

    // Basic info
    content += `**Entity ID:** \`${entity.entity_id}\`\n\n`;
    content += `**Domain:** \`${domain}\`\n\n`;

    // Device class
    if (entity.attributes.device_class) {
      content += `**Device Class:** ${entity.attributes.device_class}\n\n`;
    }

    // Icon
    if (entity.attributes.icon) {
      content += `**Icon:** ${entity.attributes.icon}\n\n`;
    }

    // Key attributes
    const importantAttrs = this.getImportantAttributes(entity);
    if (importantAttrs.length > 0) {
      content += `### Attributes\n\n`;
      for (const [key, value] of importantAttrs) {
        const formattedValue = this.formatAttributeValue(value);
        content += `- **${key}:** ${formattedValue}\n`;
      }
      content += '\n';
    }

    // Timestamps
    content += `### Timestamps\n\n`;
    content += `- **Last Changed:** ${this.formatTimestamp(entity.last_changed)}\n`;
    content += `- **Last Updated:** ${this.formatTimestamp(entity.last_updated)}\n`;

    // Additional attributes count
    const totalAttrs = Object.keys(entity.attributes).length;
    const shownAttrs = importantAttrs.length;
    if (totalAttrs > shownAttrs) {
      content += `\n*+${totalAttrs - shownAttrs} more attributes*\n`;
    }

    return content;
  }

  /**
   * Get important attributes to display
   */
  private getImportantAttributes(entity: Entity): [string, any][] {
    const attrs: [string, any][] = [];

    // Define priority attributes
    const priorityKeys = [
      'battery_level',
      'temperature',
      'humidity',
      'brightness',
      'color_temp',
      'rgb_color',
      'supported_features',
      'mode',
      'preset_mode',
      'fan_mode',
      'swing_mode',
    ];

    // Skip these (already shown or not useful)
    const skipKeys = [
      'friendly_name',
      'icon',
      'device_class',
      'unit_of_measurement',
      'attribution',
      'restored',
      'supported_color_modes',
    ];

    // Add priority attributes first
    for (const key of priorityKeys) {
      if (entity.attributes[key] !== undefined && !skipKeys.includes(key)) {
        attrs.push([key, entity.attributes[key]]);
      }
    }

    // Add other attributes (limit to 10 total)
    for (const [key, value] of Object.entries(entity.attributes)) {
      if (attrs.length >= 10) break;
      if (!priorityKeys.includes(key) && !skipKeys.includes(key)) {
        attrs.push([key, value]);
      }
    }

    return attrs;
  }

  /**
   * Format attribute value for display
   */
  private formatAttributeValue(value: any): string {
    if (value === null) return '`null`';
    if (value === undefined) return '`undefined`';
    if (typeof value === 'boolean') return value ? '`true`' : '`false`';
    if (typeof value === 'number') return `\`${value}\``;
    if (typeof value === 'string') {
      // Truncate long strings
      if (value.length > 100) {
        return `\`${value.substring(0, 100)}...\``;
      }
      return `\`${value}\``;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '`[]`';
      if (value.length <= 3) {
        return `\`[${value.join(', ')}]\``;
      }
      return `\`[${value.slice(0, 3).join(', ')}, ...]\` (${value.length} items)`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '`{}`';
      return `\`{...}\` (${keys.length} properties)`;
    }
    return String(value);
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      // Relative time for recent changes
      if (diffSecs < 60) {
        return `${diffSecs} seconds ago`;
      } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
      } else {
        // Absolute time for older changes
        return date.toLocaleString();
      }
    } catch {
      return timestamp;
    }
  }
}
