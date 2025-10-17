/**
 * Configuration Management
 * Load and validate configuration from client
 */

import { getLogger } from './logger';

const logger = getLogger('Config');

/**
 * Home Assistant configuration
 */
export interface HomeAssistantConfig {
  host: string;
  token: string;
  timeout?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // in seconds
  maxSize?: number;
}

/**
 * Diagnostics configuration
 */
export interface DiagnosticsConfig {
  enabled: boolean;
  debounce?: number; // in milliseconds
}

/**
 * Completion configuration
 */
export interface CompletionConfig {
  minChars: number;
  maxResults?: number;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: string;
  file?: string;
}

/**
 * Full LSP server configuration
 */
export interface ServerConfig {
  homeassistant: HomeAssistantConfig;
  cache?: CacheConfig;
  diagnostics?: DiagnosticsConfig;
  completion?: CompletionConfig;
  logging?: LoggingConfig;
}

/**
 * Configuration defaults
 */
const DEFAULT_CONFIG: Partial<ServerConfig> = {
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
  },
  diagnostics: {
    enabled: true,
    debounce: 500,
  },
  completion: {
    minChars: 3,
    maxResults: 50,
  },
  logging: {
    level: 'info',
  },
};

/**
 * Configuration Manager
 */
export class ConfigManager {
  private config: ServerConfig | null = null;

  /**
   * Load configuration from initialization options
   */
  load(initializationOptions: any): void {
    try {
      // Start with defaults
      this.config = {
        ...DEFAULT_CONFIG,
        ...initializationOptions,
      } as ServerConfig;

      // Apply environment variable overrides
      this.applyEnvironmentOverrides();

      // Validate configuration
      this.validate();

      logger.info('Configuration loaded successfully');
    } catch (error) {
      logger.error('Failed to load configuration', error);
      throw error;
    }
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(): void {
    if (!this.config) return;

    // Home Assistant configuration
    if (process.env.HA_HOST) {
      this.config.homeassistant.host = process.env.HA_HOST;
      logger.debug('Using HA_HOST from environment');
    }

    if (process.env.HA_TOKEN) {
      this.config.homeassistant.token = process.env.HA_TOKEN;
      logger.debug('Using HA_TOKEN from environment');
    }

    if (process.env.HA_TIMEOUT) {
      this.config.homeassistant.timeout = parseInt(process.env.HA_TIMEOUT, 10);
      logger.debug('Using HA_TIMEOUT from environment');
    }

    // Logging configuration
    if (process.env.LOG_LEVEL && this.config.logging) {
      this.config.logging.level = process.env.LOG_LEVEL;
      logger.debug('Using LOG_LEVEL from environment');
    }
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Validate required fields
    if (!this.config.homeassistant) {
      throw new Error('Missing homeassistant configuration');
    }

    if (!this.config.homeassistant.host) {
      throw new Error('Missing required configuration: homeassistant.host');
    }

    if (!this.config.homeassistant.token) {
      throw new Error('Missing required configuration: homeassistant.token');
    }

    // Validate WebSocket URL format
    if (
      !this.config.homeassistant.host.startsWith('ws://') &&
      !this.config.homeassistant.host.startsWith('wss://')
    ) {
      throw new Error(
        'homeassistant.host must be a WebSocket URL (ws:// or wss://)'
      );
    }

    // Validate timeout
    if (
      this.config.homeassistant.timeout !== undefined &&
      this.config.homeassistant.timeout <= 0
    ) {
      throw new Error('homeassistant.timeout must be a positive number');
    }

    // Validate cache TTL
    if (this.config.cache?.ttl !== undefined && this.config.cache.ttl <= 0) {
      throw new Error('cache.ttl must be a positive number');
    }

    // Validate completion minChars
    if (
      this.config.completion?.minChars !== undefined &&
      this.config.completion.minChars < 0
    ) {
      throw new Error('completion.minChars must be a non-negative number');
    }

    logger.debug('Configuration validated successfully');
  }

  /**
   * Get the full configuration
   */
  getConfig(): ServerConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  /**
   * Get Home Assistant configuration
   */
  getHomeAssistantConfig(): HomeAssistantConfig {
    return this.getConfig().homeassistant;
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): CacheConfig {
    const config = this.getConfig();
    return config.cache || DEFAULT_CONFIG.cache!;
  }

  /**
   * Get diagnostics configuration
   */
  getDiagnosticsConfig(): DiagnosticsConfig {
    const config = this.getConfig();
    return config.diagnostics || DEFAULT_CONFIG.diagnostics!;
  }

  /**
   * Get completion configuration
   */
  getCompletionConfig(): CompletionConfig {
    const config = this.getConfig();
    return config.completion || DEFAULT_CONFIG.completion!;
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): LoggingConfig {
    const config = this.getConfig();
    return config.logging || DEFAULT_CONFIG.logging!;
  }

  /**
   * Update configuration dynamically
   */
  update(updates: Partial<ServerConfig>): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config = {
      ...this.config,
      ...updates,
      homeassistant: {
        ...this.config.homeassistant,
        ...updates.homeassistant,
      },
    };

    this.validate();
    logger.info('Configuration updated');
  }
}

// Global configuration manager instance
let globalConfigManager: ConfigManager | null = null;

/**
 * Get or create the global configuration manager
 */
export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}
