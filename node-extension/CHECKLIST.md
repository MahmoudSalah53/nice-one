# Pre-Loading Checklist

Before loading this extension in Chrome, verify the following:

## ✅ Required Files

- [x] `manifest.json` - Extension configuration
- [x] `background.js` - Background service worker
- [x] `content-script.js` - Script that injects the popup
- [x] `options.html` & `options.js` - Settings page
- [x] `popup.html` & `popup.js` - Extension popup
- [x] `embed-popup.js` - **CRITICAL: The voice agent bundle** (must be present!)

## ✅ Verification Steps

1. **Check that `embed-popup.js` exists** in the extension folder

   - If missing, run: `./copy-bundle.sh` or `copy-bundle.bat` (or manually copy from `../public/`)

2. **Verify bundle is up-to-date**

   - If you made changes to the frontend, rebuild: `cd .. && pnpm build-embed-popup-script`
   - Then copy again: `./copy-bundle.sh`

3. **Check file permissions**
   - All `.js` files should be readable
   - `copy-bundle.sh` should be executable: `chmod +x copy-bundle.sh`

## 🚀 Ready to Load!

Once all files are present, you can load the extension:

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `node-extension` folder
5. The extension should load without errors

## ⚙️ After Loading

1. Click the extension icon → "Open Settings"
2. Configure your **Sandbox ID** (e.g., `http://localhost:3000`)
3. Save settings
4. Reload any open tabs to see the popup

## ⚠️ Common Issues

- **"Could not load manifest"**: Check that `manifest.json` is valid JSON
- **"Failed to load bundle"**: Ensure `embed-popup.js` exists in the extension folder
- **Popup doesn't appear**: Check the console for errors and verify sandbox ID is correct
