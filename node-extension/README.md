# Node Extension

Chrome extension for the Nice One voice agent. It runs **only** on `niceonesa.com` websites.

## Installation

### Prerequisites

1. Build the embed-popup.js bundle (from the frontend project root):

   ```bash
   cd ..
   pnpm install
   pnpm build-embed-popup-script
   ```

2. Copy the built bundle to the extension:

   ```bash
   cd node-extension
   ./copy-bundle.sh
   ```

   On Windows, from `node-extension`:

   ```bat
   copy-bundle.bat
   ```

   Or manually (from `node-extension`):

   ```bash
   cp ../public/embed-popup.js .
   cp ../public/embed-popup.js.map .  # Optional: for debugging
   cp ../public/page-automation.js .
   cp ../public/page-automation.js.map .  # Optional: for debugging
   ```

3. (Optional) Create extension icons:
   - Create an `icons` folder in the `node-extension` directory
   - Add three PNG images: `icon16.png`, `icon48.png`, and `icon128.png`
   - You can use any image editor or online tool to create these
   - The extension will work without icons, but they improve the user experience

### Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `node-extension` folder
5. The extension should now be loaded

### Configuration

1. Click on the extension icon in the toolbar
2. Click "Open Settings" or right-click the extension icon and select "Options"
3. Configure:

   - **Enable extension**: Toggle to enable/disable the popup
   - **Sandbox ID / Server URL**: The URL of your LiveKit server (e.g., `http://localhost:3000`)
   - **Bundle URL**: Leave empty to use the bundled version, or provide a custom URL

4. Click "Save Settings"
5. Reload any open tabs to apply the changes

## Usage

Once installed and configured:

1. Navigate to a **niceonesa.com** page
2. The voice agent popup will automatically appear (if enabled)
3. Click the microphone icon to start interacting with the agent

## Development

### Building the Bundle

The extension uses the `embed-popup.js` bundle from the frontend project. To rebuild it:

```bash
cd ..
pnpm build-embed-popup-script
cd chrome-extension
./copy-bundle.sh
```

### Testing

1. Make changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the test page

## File Structure

```
node-extension/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── content-script.js      # Script injected into web pages
├── options.html           # Options page HTML
├── options.js             # Options page script
├── popup.html             # Extension popup HTML
├── popup.js               # Extension popup script
├── embed-popup.js         # Voice agent bundle (copied from frontend)
└── icons/                 # Extension icons (optional)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Notes

- The extension injects the voice agent only on `niceonesa.com` URLs (see `manifest.json` matches)
- You can disable it per-site or globally via the options page
- The bundle URL can point to a remote server or use the local bundled version
- Make sure your LiveKit server is running and accessible from the configured sandbox ID

## Troubleshooting

1. **Popup doesn't appear**:

   - Check that the extension is enabled in settings
   - Verify the sandbox ID is correct
   - Check the browser console for errors
   - Ensure `embed-popup.js` is in the extension folder

2. **Connection errors**:

   - Verify your LiveKit server is running
   - Check that the sandbox ID matches your server configuration
   - Ensure CORS is properly configured on your server

3. **Bundle not loading**:
   - Make sure `embed-popup.js` is copied to the extension folder
   - Check that the file is listed in `web_accessible_resources` in manifest.json
   - Verify the bundle URL in settings
