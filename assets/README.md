# Assets Folder

## Application Icon

Save your application icon as `icon.png` in this folder.

**Recommended sizes:**
- **512x512 pixels** (will be automatically resized for different uses)
- **PNG format** with transparency support
- **Square aspect ratio**

## Current Status

The application expects an icon file at `assets/icon.png` for:
- Main application window icon
- System tray icon
- Dock/taskbar icon
- Installer icon (when building distributions)

## Platform-Specific Icons

When building for distribution, the icon will be automatically converted to:
- **macOS**: `.icns` format
- **Windows**: `.ico` format  
- **Linux**: `.png` format

## Adding Your Icon

1. Save your icon image as `icon.png` in this folder
2. Restart the application to see the new icon
3. The system tray will automatically use your custom icon 