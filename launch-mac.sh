#!/bin/bash

# Launch script for MCP Progress Tracker on Mac

echo "🚀 Launching MCP Progress Tracker..."

# Check if the app exists
if [ -d "dist/mac/MCP Progress Tracker.app" ]; then
    echo "✅ Found app bundle, launching..."
    open "dist/mac/MCP Progress Tracker.app"
elif [ -f "dist/MCP Progress Tracker-1.0.0.dmg" ]; then
    echo "📦 Found DMG file, mounting and launching..."
    hdiutil attach "dist/MCP Progress Tracker-1.0.0.dmg"
    sleep 2
    open -a "MCP Progress Tracker"
else
    echo "❌ No built app found. Building now..."
    npm run build-mac
    if [ $? -eq 0 ]; then
        echo "✅ Build successful, launching..."
        open "dist/mac/MCP Progress Tracker.app"
    else
        echo "❌ Build failed. Please check the logs."
        exit 1
    fi
fi

echo "🎉 MCP Progress Tracker should now be running!"
echo "💡 Look for the icon in your menu bar" 