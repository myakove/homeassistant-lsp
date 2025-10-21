/**
 * Completion Provider
 * Provides auto-completion for entities, services, and domains
 */

import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  MarkupKind,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { HomeAssistantClient } from '../ha-client';
import { Cache, CacheKeys } from '../cache';
import { Entity, Services } from '../types/homeassistant';
import { getLogger } from '../utils/logger';

const logger = getLogger('CompletionProvider');

/**
 * Completion context types
 */
enum CompletionContext {
  ENTITY_ID = 'entity_id',
  DOMAIN = 'domain',
  SERVICE = 'service',
  UNKNOWN = 'unknown',
}

/**
 * Completion Provider
 */
export class CompletionProvider {
  private haClient: HomeAssistantClient;
  private cache: Cache;

  constructor(haClient: HomeAssistantClient, cache: Cache) {
    this.haClient = haClient;
    this.cache = cache;
  }

  /**
   * Provide completion items
   */
  async provideCompletionItems(
    document: TextDocument,
    position: TextDocumentPositionParams
  ): Promise<CompletionItem[]> {
    try {
      // Get the full document text and extract the current line
      const fullText = document.getText();
      const lines = fullText.split('\n');
      const currentLine = lines[position.position.line] || '';

      const cursorPos = position.position.character;
      const textBeforeCursor = currentLine.substring(0, cursorPos);

      // Detect completion context
      const context = this.detectContext(textBeforeCursor);
      const prefix = this.extractPrefix(textBeforeCursor);

      logger.debug('Completion requested', { 
        context, 
        prefix, 
        line: textBeforeCursor,
        hasDot: prefix.includes('.')
      });

      switch (context) {
        case CompletionContext.ENTITY_ID:
          return this.completeEntityId(prefix);

        case CompletionContext.DOMAIN:
          return this.completeDomain(prefix);

        case CompletionContext.SERVICE:
          return this.completeService(prefix);

        default:
          return [];
      }
    } catch (error) {
      logger.error('Completion provider error', error);
      return [];
    }
  }

  /**
   * Detect completion context from line text
   */
  private detectContext(text: string): CompletionContext {
    // Extract the last word/token before cursor
    const match = text.match(/([\w.]+)$/);
    if (!match) {
      return CompletionContext.UNKNOWN;
    }

    const token = match[1];

    // If token contains a dot, validate it's a proper entity ID pattern
    // Valid: "domain." or "domain.entity_name"
    // Invalid: "domain.." or ".." or "domain..more"
    if (token.includes('.')) {
      // Check for invalid patterns (double dots or empty parts)
      if (token.includes('..') || token.startsWith('.') || token.endsWith('..')) {
        return CompletionContext.UNKNOWN;
      }
      return CompletionContext.ENTITY_ID;
    }

    // Otherwise, it's just text - suggest domains
    // e.g., "light" or "sen" or "input"
    return CompletionContext.DOMAIN;
  }

  /**
   * Extract the prefix for filtering
   */
  private extractPrefix(text: string): string {
    // Match word characters, dots, and underscores at the end
    const match = text.match(/[\w._]*$/);
    return match ? match[0] : '';
  }

  /**
   * Complete entity IDs
   */
  private async completeEntityId(prefix: string): Promise<CompletionItem[]> {
    const entities = await this.getEntities();
    
    if (!entities || entities.length === 0) {
      logger.warn('No entities available for completion');
      return [];
    }

    logger.debug(`Entity completion: fetched ${entities.length} entities, prefix="${prefix}"`);
    const items: CompletionItem[] = [];

    // If prefix contains a dot, it's domain.entity format
    const hasDot = prefix.includes('.');
    const [domainPrefix, entityPrefix] = hasDot ? prefix.split('.') : [prefix, ''];

    logger.debug(`Entity completion: hasDot=${hasDot}, domainPrefix="${domainPrefix}", entityPrefix="${entityPrefix}"`);

    for (const entity of entities) {
      if (!entity || !entity.entity_id) {
        continue;
      }

      // Filter by domain if provided
      if (hasDot) {
        const parts = entity.entity_id.split('.');
        if (parts.length < 2) {
          continue; // Invalid entity_id format
        }
        const [entityDomain, entityName] = parts;
        
        // Domain must match exactly (not startsWith)
        if (entityDomain !== domainPrefix) {
          continue;
        }
        // Filter entity name part if provided (use startsWith for proper prefix matching)
        if (entityPrefix && !entityName.toLowerCase().startsWith(entityPrefix.toLowerCase())) {
          continue;
        }
      } else {
        // No dot yet, filter by prefix
        if (prefix && !entity.entity_id.toLowerCase().startsWith(prefix.toLowerCase())) {
          continue;
        }
      }

      const friendlyName = entity.attributes?.friendly_name || entity.entity_id;
      const state = entity.state || 'unknown';
      const unit = entity.attributes?.unit_of_measurement || '';

      items.push({
        label: entity.entity_id,
        kind: CompletionItemKind.Value,
        detail: `${friendlyName} (${state}${unit ? ' ' + unit : ''})`,
        documentation: {
          kind: MarkupKind.Markdown,
          value: this.formatEntityDocumentation(entity),
        },
        insertText: entity.entity_id,
        sortText: entity.entity_id,
      });
    }

    logger.debug(`Entity completion: ${items.length} items matched for prefix "${prefix}"`);
    return items.slice(0, 50); // Limit to 50 items
  }

  /**
   * Complete domain names
   */
  private async completeDomain(prefix: string): Promise<CompletionItem[]> {
    const entities = await this.getEntities();
    const domains = new Set<string>();

    // Extract unique domains
    for (const entity of entities) {
      const [domain] = entity.entity_id.split('.');
      domains.add(domain);
    }

    const items: CompletionItem[] = [];

    for (const domain of Array.from(domains).sort()) {
      if (prefix && !domain.toLowerCase().startsWith(prefix.toLowerCase())) {
        continue;
      }

      // Count entities in this domain
      const count = entities.filter((e) => e.entity_id.startsWith(domain + '.')).length;

      items.push({
        label: domain,
        kind: CompletionItemKind.Module,
        detail: `${count} entities`,
        documentation: {
          kind: MarkupKind.Markdown,
          value: `Home Assistant domain: **${domain}**\n\nContains ${count} entities.`,
        },
        insertText: domain + '.',
        sortText: domain,
      });
    }

    logger.debug(`Domain completion: ${items.length} items for prefix "${prefix}"`);
    return items;
  }

  /**
   * Complete service calls
   */
  private async completeService(prefix: string): Promise<CompletionItem[]> {
    const services = await this.getServices();
    const items: CompletionItem[] = [];

    // If prefix contains a dot, it's domain.service format
    const hasDot = prefix.includes('.');
    const [domainPrefix, servicePrefix] = hasDot ? prefix.split('.') : [prefix, ''];

    for (const [domain, domainServices] of Object.entries(services)) {
      // Filter by domain if provided
      if (hasDot && !domain.startsWith(domainPrefix)) {
        continue;
      }

      for (const [serviceName, service] of Object.entries(domainServices)) {
        const fullServiceName = `${domain}.${serviceName}`;

        // Filter by prefix (use startsWith for proper prefix matching)
        if (hasDot) {
          if (servicePrefix && !serviceName.toLowerCase().startsWith(servicePrefix.toLowerCase())) {
            continue;
          }
        } else {
          if (prefix && !fullServiceName.toLowerCase().startsWith(prefix.toLowerCase())) {
            continue;
          }
        }

        const description = service.description || service.name || '';

        items.push({
          label: fullServiceName,
          kind: CompletionItemKind.Function,
          detail: description,
          documentation: {
            kind: MarkupKind.Markdown,
            value: this.formatServiceDocumentation(domain, serviceName, service),
          },
          insertText: fullServiceName,
          sortText: fullServiceName,
        });
      }
    }

    logger.debug(`Service completion: ${items.length} items for prefix "${prefix}"`);
    return items.slice(0, 50); // Limit to 50 items
  }

  /**
   * Get entities from cache or Home Assistant
   */
  private async getEntities(): Promise<Entity[]> {
    return this.cache.getOrFetch(
      CacheKeys.ENTITIES,
      () => this.haClient.getStates(),
      300 // 5 minutes TTL
    );
  }

  /**
   * Get services from cache or Home Assistant
   */
  private async getServices(): Promise<Services> {
    return this.cache.getOrFetch(
      CacheKeys.SERVICES,
      () => this.haClient.getServices(),
      600 // 10 minutes TTL
    );
  }

  /**
   * Format entity documentation
   */
  private formatEntityDocumentation(entity: Entity): string {
    const friendlyName = entity.attributes?.friendly_name || entity.entity_id;
    const [domain] = entity.entity_id.split('.');
    const unit = entity.attributes?.unit_of_measurement || '';

    let doc = `**${friendlyName}**\n\n`;
    doc += `**Entity ID:** \`${entity.entity_id}\`\n\n`;
    doc += `**Domain:** ${domain}\n\n`;
    doc += `**State:** ${entity.state}${unit ? ' ' + unit : ''}\n\n`;

    // Add key attributes
    const importantAttrs = ['device_class', 'unit_of_measurement', 'icon'];
    const attrs: string[] = [];
    for (const attr of importantAttrs) {
      if (entity.attributes?.[attr]) {
        attrs.push(`- **${attr}:** ${entity.attributes[attr]}`);
      }
    }

    if (attrs.length > 0) {
      doc += `**Attributes:**\n${attrs.join('\n')}\n`;
    }

    return doc;
  }

  /**
   * Format service documentation
   */
  private formatServiceDocumentation(domain: string, serviceName: string, service: any): string {
    let doc = `**${domain}.${serviceName}**\n\n`;

    if (service.description) {
      doc += `${service.description}\n\n`;
    }

    if (service.fields && Object.keys(service.fields).length > 0) {
      doc += `**Fields:**\n`;
      for (const [fieldName, field] of Object.entries<any>(service.fields)) {
        const required = field.required ? ' *(required)*' : '';
        doc += `- **${fieldName}**${required}: ${field.description || ''}\n`;
      }
    }

    return doc;
  }
}
