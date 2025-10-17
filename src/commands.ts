/**
 * Custom LSP Commands
 * Handles custom commands for dashboard management and cache operations
 */

import { HomeAssistantClient } from './ha-client';
import { Cache } from './cache';
import { getLogger } from './utils/logger';

const logger = getLogger('Commands');

/**
 * Command result
 */
export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Command handler class
 */
export class CommandHandler {
  private haClient: HomeAssistantClient;
  private cache: Cache;

  constructor(haClient: HomeAssistantClient, cache: Cache) {
    this.haClient = haClient;
    this.cache = cache;
  }

  /**
   * Execute a command
   */
  async executeCommand(command: string, args?: any[]): Promise<CommandResult> {
    try {
      logger.info(`Executing command: ${command}`, { args });

      switch (command) {
        case 'homeassistant.listDashboards':
          return await this.listDashboards();

        case 'homeassistant.getDashboardConfig':
          return await this.getDashboardConfig(args);

        case 'homeassistant.saveDashboardConfig':
          return await this.saveDashboardConfig(args);

        case 'homeassistant.reloadCache':
          return this.reloadCache();

        case 'homeassistant.getConnectionStatus':
          return this.getConnectionStatus();

        case 'homeassistant.getEntityState':
          return await this.getEntityState(args);

        case 'homeassistant.listEntities':
          return await this.listEntities(args);

        case 'homeassistant.listServices':
          return await this.listServices();

        case 'homeassistant.listAreas':
          return await this.listAreas();

        case 'homeassistant.callService':
          return await this.callService(args);

        default:
          return {
            success: false,
            error: `Unknown command: ${command}`,
          };
      }
    } catch (error) {
      logger.error(`Command execution failed: ${command}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List all dashboards
   */
  private async listDashboards(): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    const dashboards = await this.haClient.getDashboards();

    // Filter for editable dashboards (storage mode)
    const editableDashboards = dashboards.filter((d) => d.mode === 'storage');

    return {
      success: true,
      data: editableDashboards,
    };
  }

  /**
   * Get dashboard configuration
   */
  private async getDashboardConfig(args?: any[]): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    const urlPath = args && args.length > 0 ? args[0] : undefined;

    try {
      const config = await this.haClient.getDashboardConfig(urlPath);
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get dashboard config',
      };
    }
  }

  /**
   * Save dashboard configuration
   */
  private async saveDashboardConfig(args?: any[]): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    if (!args || args.length < 1) {
      return {
        success: false,
        error: 'Missing config parameter',
      };
    }

    const config = args[0];
    const urlPath = args.length > 1 ? args[1] : undefined;

    // Validate config structure
    if (!config || typeof config !== 'object') {
      return {
        success: false,
        error: 'Invalid config: must be an object',
      };
    }

    if (!config.views || !Array.isArray(config.views)) {
      return {
        success: false,
        error: 'Invalid config: missing or invalid views array',
      };
    }

    try {
      await this.haClient.saveDashboardConfig(config, urlPath);
      return {
        success: true,
        data: { message: 'Dashboard configuration saved successfully' },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save dashboard config',
      };
    }
  }

  /**
   * Reload cache
   */
  private reloadCache(): CommandResult {
    try {
      this.cache.invalidateAll();
      logger.info('Cache invalidated successfully');
      return {
        success: true,
        data: { message: 'Cache reloaded successfully' },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reload cache',
      };
    }
  }

  /**
   * Get connection status
   */
  private getConnectionStatus(): CommandResult {
    const state = this.haClient.getState();
    const isConnected = this.haClient.isConnected();

    return {
      success: true,
      data: {
        connected: isConnected,
        state: state,
        cacheStats: this.cache.getStats(),
      },
    };
  }

  /**
   * Get entity state
   */
  private async getEntityState(args?: any[]): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    if (!args || args.length < 1) {
      return {
        success: false,
        error: 'Missing entity_id parameter',
      };
    }

    const entityId = args[0];

    try {
      const entities = await this.haClient.getStates();
      const entity = entities.find((e) => e.entity_id === entityId);

      if (!entity) {
        return {
          success: false,
          error: `Entity '${entityId}' not found`,
        };
      }

      return {
        success: true,
        data: entity,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get entity state',
      };
    }
  }

  /**
   * List all entities
   */
  private async listEntities(args?: any[]): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    try {
      const entities = await this.haClient.getStates();

      // Optional filtering
      let filteredEntities = entities;

      if (args && args.length > 0) {
        const filters = args[0];

        // Filter by domain
        if (filters.domain) {
          filteredEntities = filteredEntities.filter((e) =>
            e.entity_id.startsWith(filters.domain + '.')
          );
        }

        // Filter by search term (entity_id or friendly_name)
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredEntities = filteredEntities.filter((e) => {
            const friendlyName = (e.attributes.friendly_name || '').toLowerCase();
            return (
              e.entity_id.toLowerCase().includes(searchLower) ||
              friendlyName.includes(searchLower)
            );
          });
        }
      }

      return {
        success: true,
        data: filteredEntities,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list entities',
      };
    }
  }

  /**
   * List all services
   */
  private async listServices(): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    try {
      const services = await this.haClient.getServices();
      return {
        success: true,
        data: services,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list services',
      };
    }
  }

  /**
   * List all areas
   */
  private async listAreas(): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    try {
      // Areas are fetched from the area registry
      // For now, we'll return an empty array as the WebSocket client
      // doesn't have an areas method yet. This can be added later.
      logger.warn('listAreas not yet fully implemented - area registry API needed');
      return {
        success: true,
        data: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list areas',
      };
    }
  }

  /**
   * Call a service
   */
  private async callService(args?: any[]): Promise<CommandResult> {
    if (!this.haClient.isConnected()) {
      return {
        success: false,
        error: 'Not connected to Home Assistant',
      };
    }

    if (!args || args.length < 1) {
      return {
        success: false,
        error: 'Missing service parameter (format: domain.service)',
      };
    }

    const service = args[0];
    // const serviceData = args.length > 1 ? args[1] : {}; // Will be used when implemented

    if (typeof service !== 'string' || !service.includes('.')) {
      return {
        success: false,
        error: 'Invalid service format (expected: domain.service)',
      };
    }

    // Note: Service calling would require additional WebSocket API implementation
    // serviceData would be used when this is implemented
    return {
      success: false,
      error: 'Service calling not yet implemented',
    };
  }
}
