# Testing Home Assistant LSP (Following README)

## ✅ Installation (Done)
```bash
cd ~/git/homeassistant-lsp
npm install  # ✓ Done
npm run build  # ✓ Done
```

## ✅ Running Tests (Done)
```bash
npm test  # ✓ 15/15 passing
```

## 🧪 Testing with Neovim (Following README)

### Step 1: Test with the README config
```bash
cd ~/git/homeassistant-lsp
nvim -u /tmp/test-ha-lsp-from-readme.lua test.yaml
```

### Step 2: Try the features listed in README

1. **Auto-completion** (as per README example):
   - Type: `entity_id: sensor.`
   - Expected: Completion popup with sensor entities

2. **Hover Information** (as per README example):
   - Hover over: `entity_id: sensor.temperature`
   - Press: `K`
   - Expected: Entity state and attributes popup

3. **Diagnostics** (as per README example):
   - Type: `entity_id: sensor.nonexistent`
   - Expected: Error highlight "Entity not found"

### Step 3: Test Custom Commands
```vim
:lua vim.lsp.buf.execute_command({command='homeassistant.listDashboards'})
:lua vim.lsp.buf.execute_command({command='homeassistant.getConnectionStatus'})
```

## 📋 Issues to Report:

### README Accuracy:
- [ ] Installation instructions work?
- [ ] Neovim setup code works?
- [ ] Examples match actual behavior?
- [ ] Commands work as documented?

### Missing from README:
- [ ] Environment variable support (HOMEASSISTANT_HOST, HOMEASSISTANT_TOKEN)?
- [ ] Troubleshooting section?
- [ ] What to do if connection fails?
- [ ] How to check LSP logs?

### Suggestions:
- [ ] Add "Testing Locally" section before global install
- [ ] Add troubleshooting/debugging section
- [ ] Add LSP log location
- [ ] Add link to get HA token
