-- Test configuration for Home Assistant LSP
-- Run with: nvim -u test-lsp.lua test.yaml

-- Minimal setup to test LSP
vim.opt.runtimepath:prepend(vim.fn.stdpath('data') .. '/lazy/nvim-lspconfig')

-- Load lspconfig
local ok, lspconfig = pcall(require, 'lspconfig')
if not ok then
  print("ERROR: nvim-lspconfig not found. Install it first:")
  print("  lazy.nvim: { 'neovim/nvim-lspconfig' }")
  return
end

local configs = require('lspconfig.configs')

-- Get HA credentials from environment or hardcode for testing
local ha_host = os.getenv("HOMEASSISTANT_HOST") or "ws://192.168.10.44:8123/api/websocket"
local ha_token = os.getenv("HOMEASSISTANT_TOKEN") or "YOUR_TOKEN_HERE"

print("=== Home Assistant LSP Test ===")
print("Host: " .. ha_host)
print("Token: " .. string.sub(ha_token, 1, 20) .. "...")

-- Define custom homeassistant LSP server
if not configs.homeassistant then
  configs.homeassistant = {
    default_config = {
      cmd = { 'node', vim.fn.expand('~/git/homeassistant-lsp/dist/server.js'), '--stdio' },
      filetypes = { 'yaml', 'yaml.homeassistant', 'python' },
      root_dir = function(fname)
        return vim.fn.getcwd()
      end,
      settings = {
        homeassistant = {
          host = ha_host,
          token = ha_token,
        },
      },
    },
  }
end

-- Setup the server
lspconfig.homeassistant.setup({
  on_attach = function(client, bufnr)
    print("✅ LSP attached to buffer " .. bufnr)
    print("   Client: " .. client.name)
    print("   Capabilities: completion=" .. tostring(client.server_capabilities.completionProvider ~= nil))
    print("                hover=" .. tostring(client.server_capabilities.hoverProvider))
    
    -- Keymaps for testing
    local opts = { buffer = bufnr, noremap = true, silent = true }
    vim.keymap.set('n', 'K', vim.lsp.buf.hover, opts)
    vim.keymap.set('n', 'gd', vim.lsp.buf.definition, opts)
    vim.keymap.set('i', '<C-Space>', vim.lsp.buf.completion, opts)
    
    print("\n📋 Test keymaps:")
    print("   K         - Hover info")
    print("   <C-Space> - Trigger completion")
    print("   :lua vim.lsp.buf.execute_command({command='homeassistant.listDashboards'})")
  end,
  on_init = function(client, initialize_result)
    print("🚀 LSP initialized successfully")
  end,
  handlers = {
    ["window/logMessage"] = function(err, result, ctx, config)
      print(string.format("[LSP LOG] %s", result.message))
    end,
  },
})

-- Auto-open a test file
vim.defer_fn(function()
  print("\n=== Creating test file ===")
  vim.cmd('enew')
  vim.bo.filetype = 'yaml'
  vim.api.nvim_buf_set_lines(0, 0, -1, false, {
    "# Test Home Assistant LSP",
    "automation:",
    "  - trigger:",
    "      platform: state",
    "      entity_id: ",  -- Try completion here
    "  - action:",
    "      service: ",    -- Try completion here
  })
  vim.cmd('normal! 5G$')
  print("✅ Test file created. Try typing 'sensor.' after entity_id:")
  print("   Or press <C-Space> to trigger completion")
end, 100)

-- Enable LSP log for debugging
vim.lsp.set_log_level("DEBUG")
print("📝 LSP log: " .. vim.lsp.get_log_path())
