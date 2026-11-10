#!/bin/bash
set -e

APP_DIR="/home/ubuntu/projects/noda-voice-front"

cd "$APP_DIR"

echo "⏳ Pulling latest code..."
/usr/bin/git restore .
/usr/bin/git pull origin main

echo "⏳ Installing dependencies..."
/usr/bin/pnpm install
/usr/bin/pnpm run build

echo "⏳ Restarting service..."
sudo /usr/bin/systemctl restart nice-one-frontend

echo "✅ Deployment complete"

