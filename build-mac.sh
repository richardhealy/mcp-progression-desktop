#!/bin/bash

echo "🔨 Building MCP Progress Desktop for macOS..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Ensure build directory exists
mkdir -p build/

# Build the app
echo "⚙️ Building Electron app..."
npm run build-mac

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    
    # Check if the app was created
    if [ -d "dist/mac/MCP Progress Tracker.app" ]; then
        echo "📱 App bundle created: dist/mac/MCP Progress Tracker.app"
        
        # Check permission descriptions
        echo "🔐 Checking permission descriptions..."
        plutil -p "dist/mac/MCP Progress Tracker.app/Contents/Info.plist" | grep -A1 "NSAppleEventsUsageDescription" || echo "   No accessibility permissions found"
        
        echo ""
        echo "🚀 To test the built app:"
        echo "   open 'dist/mac/MCP Progress Tracker.app'"
        echo ""
        echo "📝 If you still see permission dialogs:"
        echo "   1. Open System Preferences > Security & Privacy > Privacy"
        echo "   2. Add 'MCP Progress Tracker' to Accessibility permissions"
        echo "   3. Restart the app"
        echo ""
    else
        echo "❌ App bundle not found in expected location"
        ls -la dist/
    fi
else
    echo "❌ Build failed!"
    exit 1
fi 