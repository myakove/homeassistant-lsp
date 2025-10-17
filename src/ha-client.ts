/**
 * Home Assistant WebSocket Client
 * Manages WebSocket connection to Home Assistant API
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  Entity,
  Services,
  Config,
  Dashboard,
  DashboardConfig,
} from './types/homeassistant';

/**
 * Connection states
 */
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  AUTHENTICATING = 'AUTHENTICATING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

/**
 * WebSocket message types
 */
interface WSMessage {
  id?: number;
  type: string;
  [key: string]: any;
}

/**
 * Pending request tracker
 */
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Home Assistant WebSocket Client
 */
export class HomeAssistantClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private messageId: number = 1;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // Start with 1 second
  private requestTimeout: number = 30000; // 30 seconds
  private subscriptions: Map<number, (data: any) => void> = new Map();

  /**
   * Connect to Home Assistant
   */
  async connect(url: string, token: string): Promise<void> {
    this.url = url;
    this.token = token;
    this.state = ConnectionState.CONNECTING;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this.emit('state', ConnectionState.CONNECTING);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          this.emit('error', error);
          this.state = ConnectionState.ERROR;
          reject(error);
        });

        this.ws.on('close', () => {
          this.handleClose();
        });

        // Wait for authentication to complete
        this.once('authenticated', () => {
          this.state = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          this.emit('state', ConnectionState.CONNECTED);
          resolve();
        });

        this.once('auth_failed', (error) => {
          this.state = ConnectionState.ERROR;
          reject(new Error(error));
        });
      } catch (error) {
        this.state = ConnectionState.ERROR;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from Home Assistant
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = ConnectionState.DISCONNECTED;
    this.pendingRequests.clear();
    this.subscriptions.clear();
    this.emit('state', ConnectionState.DISCONNECTED);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Get all entity states
   */
  async getStates(): Promise<Entity[]> {
    return this.sendRequest({ type: 'get_states' });
  }

  /**
   * Get available services
   */
  async getServices(): Promise<Services> {
    return this.sendRequest({ type: 'get_services' });
  }

  /**
   * Get Home Assistant configuration
   */
  async getConfig(): Promise<Config> {
    return this.sendRequest({ type: 'get_config' });
  }

  /**
   * Get list of dashboards
   */
  async getDashboards(): Promise<Dashboard[]> {
    const result = await this.sendRequest({
      type: 'lovelace/dashboards/list',
    });
    return result || [];
  }

  /**
   * Get dashboard configuration
   */
  async getDashboardConfig(urlPath?: string): Promise<DashboardConfig> {
    return this.sendRequest({
      type: 'lovelace/config',
      url_path: urlPath || null,
    });
  }

  /**
   * Save dashboard configuration
   */
  async saveDashboardConfig(
    config: DashboardConfig,
    urlPath?: string
  ): Promise<void> {
    await this.sendRequest({
      type: 'lovelace/config/save',
      config,
      url_path: urlPath || null,
    });
  }

  /**
   * Subscribe to events
   */
  subscribeEvents(
    eventType: string,
    callback: (data: any) => void
  ): number {
    const id = this.messageId++;
    this.subscriptions.set(id, callback);

    this.sendMessage({
      id,
      type: 'subscribe_events',
      event_type: eventType,
    });

    return id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribeEvents(subscriptionId: number): void {
    this.subscriptions.delete(subscriptionId);
    this.sendMessage({
      id: this.messageId++,
      type: 'unsubscribe_events',
      subscription: subscriptionId,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      // Handle authentication flow
      if (message.type === 'auth_required') {
        this.state = ConnectionState.AUTHENTICATING;
        this.emit('state', ConnectionState.AUTHENTICATING);
        this.sendMessage({
          type: 'auth',
          access_token: this.token,
        });
        return;
      }

      if (message.type === 'auth_ok') {
        this.emit('authenticated');
        return;
      }

      if (message.type === 'auth_invalid') {
        this.emit('auth_failed', message.message || 'Authentication failed');
        return;
      }

      // Handle event subscriptions
      if (message.type === 'event' && message.id) {
        const callback = this.subscriptions.get(message.id);
        if (callback) {
          callback(message.event);
        }
        return;
      }

      // Handle request responses
      if (message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);

          if (message.type === 'result') {
            if (message.success) {
              pending.resolve(message.result);
            } else {
              pending.reject(
                new Error(message.error?.message || 'Request failed')
              );
            }
          }
        }
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${error}`));
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private handleClose(): void {
    this.state = ConnectionState.DISCONNECTED;
    this.emit('state', ConnectionState.DISCONNECTED);

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
      this.pendingRequests.delete(id);
    }

    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000
      ); // Max 30 seconds

      this.emit('reconnecting', this.reconnectAttempts, delay);

      setTimeout(() => {
        if (this.state === ConnectionState.DISCONNECTED) {
          this.connect(this.url, this.token).catch((error) => {
            this.emit('error', error);
          });
        }
      }, delay);
    } else {
      this.emit('max_reconnect_attempts');
    }
  }

  /**
   * Send a message to Home Assistant
   */
  private sendMessage(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest(message: Omit<WSMessage, 'id'>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        this.sendMessage({ ...message, id } as WSMessage);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }
}
