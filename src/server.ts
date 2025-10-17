#!/usr/bin/env node
/**
 * Home Assistant LSP Server
 * Main entry point for the Language Server Protocol implementation
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  ExecuteCommandParams,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { HomeAssistantClient } from './ha-client';
import { Cache, getCache } from './cache';
import { CommandHandler } from './commands';

// Server configuration interface
interface ServerConfig {
  homeassistant: {
    host: string;
    token: string;
    timeout?: number;
  };
}

// Create a connection for the server using Node's IPC as a transport
const connection = createConnection(ProposedFeatures.all);

// Create a text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Server configuration
let serverConfig: ServerConfig | null = null;

// Server state
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

// Initialize Home Assistant client, cache, and command handler
let haClient: HomeAssistantClient | null = null;
let cache: Cache | null = null;
let commandHandler: CommandHandler | null = null;

/**
 * Initialize the LSP server
 */
connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  // Extract configuration from initialization options
  if (params.initializationOptions) {
    serverConfig = params.initializationOptions as ServerConfig;
    connection.console.log(
      `Configuration received: host=${serverConfig?.homeassistant?.host ? 'provided' : 'missing'}, token=${serverConfig?.homeassistant?.token ? 'provided' : 'missing'}`
    );
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Enable completion provider
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', '_', ':'],
      },
      // Enable hover provider
      hoverProvider: true,
      // Enable execute command provider
      executeCommandProvider: {
        commands: [
          'homeassistant.listDashboards',
          'homeassistant.getDashboardConfig',
          'homeassistant.saveDashboardConfig',
          'homeassistant.reloadCache',
          'homeassistant.getConnectionStatus',
          'homeassistant.getEntityState',
          'homeassistant.listEntities',
          'homeassistant.listServices',
          'homeassistant.listAreas',
          'homeassistant.callService',
        ],
      },
      // Diagnostic provider will be implemented later
      // diagnosticProvider: {
      //   interFileDependencies: false,
      //   workspaceDiagnostics: false
      // },
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  return result;
});

/**
 * Server initialized - setup connections
 */
connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    // Configuration changes will be handled via onDidChangeConfiguration
    connection.console.log('Client supports configuration capability');
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.');
    });
  }

  // Validate configuration
  if (!serverConfig?.homeassistant?.host || !serverConfig?.homeassistant?.token) {
    connection.window.showErrorMessage(
      'Home Assistant LSP Server: Missing configuration. Please provide homeassistant.host and homeassistant.token'
    );
    connection.console.error(
      'Missing required configuration: homeassistant.host and homeassistant.token'
    );
  } else {
    // Initialize Home Assistant client and services
    try {
      haClient = new HomeAssistantClient();
      cache = getCache();
      commandHandler = new CommandHandler(haClient, cache);

      // Connect to Home Assistant
      await haClient.connect(
        serverConfig.homeassistant.host,
        serverConfig.homeassistant.token
      );

      connection.console.log('Home Assistant LSP Server initialized successfully');
      connection.console.log('Connected to Home Assistant');
      connection.window.showInformationMessage(
        'Home Assistant LSP Server is ready'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      connection.console.error(`Failed to connect to Home Assistant: ${errorMsg}`);
      connection.window.showErrorMessage(
        `Failed to connect to Home Assistant: ${errorMsg}`
      );
    }
  }
});

/**
 * Handle configuration changes
 */
connection.onDidChangeConfiguration((change) => {
  if (change.settings?.homeassistant) {
    serverConfig = {
      homeassistant: change.settings.homeassistant,
    };
    connection.console.log('Configuration updated');
  }
});

/**
 * Execute command handler
 */
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
  try {
    connection.console.log(`Execute command: ${params.command}`);

    if (!commandHandler) {
      return {
        success: false,
        error: 'Command handler not initialized',
      };
    }

    const result = await commandHandler.executeCommand(
      params.command,
      params.arguments
    );

    connection.console.log(`Command result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    connection.console.error(`Command execution error: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
});

/**
 * Document opened event
 */
documents.onDidOpen((event) => {
  connection.console.log(
    `Document opened: ${event.document.uri} (${event.document.languageId})`
  );
});

/**
 * Document changed event
 */
documents.onDidChangeContent((event) => {
  connection.console.log(`Document changed: ${event.document.uri}`);
  // Diagnostics will be triggered here when implemented
});

/**
 * Document closed event
 */
documents.onDidClose((event) => {
  connection.console.log(`Document closed: ${event.document.uri}`);
});

/**
 * Graceful shutdown handler
 */
connection.onShutdown(() => {
  connection.console.log('Server shutting down...');
  
  // Cleanup: disconnect Home Assistant client
  if (haClient) {
    haClient.disconnect();
  }
  
  // Cleanup: destroy cache
  if (cache) {
    cache.destroy();
  }
});

/**
 * Exit handler
 */
connection.onExit(() => {
  connection.console.log('Server exited');
});

// Export configuration accessor for other modules
export function getConfig(): ServerConfig | null {
  return serverConfig;
}

export { connection, documents };

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
