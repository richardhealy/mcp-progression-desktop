#!/bin/bash

echo "🔄 Resetting accessibility permissions for MCP Progress Tracker..."

APP_NAME="MCP Progress Tracker"

echo "📝 Instructions to reset permissions:"
echo ""
echo "1. Open System Preferences > Security & Privacy > Privacy"
echo "2. Click on 'Accessibility' in the left sidebar"
echo "3. Look for '$APP_NAME' in the list"
echo "4. If found, click the checkbox to uncheck it, then check it again"
echo "5. If not found, click the '+' button and add: dist/mac/$APP_NAME.app"
echo "6. Make sure the checkbox is checked"
echo "7. Close System Preferences"
echo "8. Restart the app"
echo ""
echo "🚀 Then test with:"
echo "   open 'dist/mac/$APP_NAME.app'"
echo ""
echo "💡 The app should now:"
echo "   - Show at most ONE permission dialog"
echo "   - Not repeat the dialog every few seconds"
echo "   - Fall back to basic tracking if permissions are denied" 