# Obsidian Unhide Plugin

Reveals hidden .ai/README.md files with advanced clone management, sync detection, and seamless UI integration

## Installation

### Via BRAT (Recommended)
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins
2. In BRAT settings, click "Add Beta Plugin"
3. Enter: `https://github.com/9swampy/ObsidianUnhide`
4. Enable "Obsidian Unhide" in your Community Plugins

### Manual Installation
1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/9swampy/ObsidianUnhide/releases/latest)
2. Create folder `your-vault/.obsidian/plugins/obsidian-unhide/`
3. Copy the files into this folder
4. Enable "Obsidian Unhide" in Community Plugins

# Test Vault

This is a test Obsidian vault for testing the AI README Unhide plugin.

## Files in this vault:
- This README file (visible)
- .ai/README.md (hidden by default, should become visible with plugin)
- Other project files and documentation

## Testing the Plugin:
1. Look for the eye icon in the left ribbon
2. Try the Command Palette: "Toggle .ai/README.md file visibility"
3. Check if .ai/README.md appears in the file explorer when toggled on
4. Verify it can be clicked to open
5. Check status bar shows "AI files: visible/hidden"