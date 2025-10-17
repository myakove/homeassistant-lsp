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
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

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
    connection.console.log('Home Assistant LSP Server initialized successfully');
    connection.window.showInformationMessage(
      'Home Assistant LSP Server is ready'
    );
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
  // Cleanup will be added here (close WebSocket connections, etc.)
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
