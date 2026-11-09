#!/bin/bash
# Helper script to copy the bundles to the extension folder

FRONTEND_DIR=".."
EXTENSION_DIR="."

echo "Copying bundles to extension..."

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Error: Frontend directory not found at $FRONTEND_DIR"
    exit 1
fi

# Check if embed-popup bundle exists
if [ ! -f "$FRONTEND_DIR/public/embed-popup.js" ]; then
    echo "Error: embed-popup.js not found. Please build it first:"
    echo "  cd $FRONTEND_DIR && pnpm build-embed-popup-script"
    exit 1
fi

# Copy embed-popup bundle
cp "$FRONTEND_DIR/public/embed-popup.js" "$EXTENSION_DIR/"
echo "✅ Copied embed-popup.js"

# Copy embed-popup source map if it exists
if [ -f "$FRONTEND_DIR/public/embed-popup.js.map" ]; then
    cp "$FRONTEND_DIR/public/embed-popup.js.map" "$EXTENSION_DIR/"
    echo "✅ Copied embed-popup.js.map"
fi

# Copy page-automation bundle (for iframe mode)
if [ -f "$FRONTEND_DIR/public/page-automation.js" ]; then
    cp "$FRONTEND_DIR/public/page-automation.js" "$EXTENSION_DIR/"
    echo "✅ Copied page-automation.js"
else
    echo "⚠️ Warning: page-automation.js not found"
fi

# Copy page-automation source map if it exists
if [ -f "$FRONTEND_DIR/public/page-automation.js.map" ]; then
    cp "$FRONTEND_DIR/public/page-automation.js.map" "$EXTENSION_DIR/"
    echo "✅ Copied page-automation.js.map"
fi

echo "Done! Bundles copied successfully."

