# MCP Progress Tracker - Desktop Application

A cross-platform desktop application for tracking hourly progress reports, built with Electron and integrated with MCP (Model Context Protocol) servers.

## Features

- **Cross-Platform**: Works on Windows, macOS, and Linux
- **System Tray Integration**: Minimizes to system tray for unobtrusive operation
- **Smart Notifications**: Desktop notifications for hourly progress prompts
- **Working Hours Management**: Configurable working days, hours, and timezone
- **Project Management**: Multiple projects with customizable tracking
- **MCP Server Integration**: Connects to your MCP server for data storage
- **Auto-pause**: Intelligent pause functionality
- **Offline Ready**: Works even when your browser is closed

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Add Your Application Icon** (Optional):
   - Save your icon as `assets/icon.png` (512x512 PNG recommended)
   - This enables custom window icon and system tray integration

3. **Start the Application**:
   ```bash
   npm start
   ```

4. **Configure Settings**:
   - Set your working hours and timezone
   - Configure your MCP server connection
   - Add your projects

## Development

- **Run in Development Mode**:
  ```bash
  npm run dev
  ```

- **Build for Distribution**:
  ```bash
  # Build for current platform
  npm run build
  
  # Build for specific platforms
  npm run build-win    # Windows
  npm run build-mac    # macOS
  npm run build-linux  # Linux
  ```

## MCP Server

The application includes an integrated MCP server that starts automatically:

- **Start MCP Server Only**:
  ```bash
  npm run server
  ```

- **Start HTTP MCP Server**:
  ```bash
  npm run http-server
  ```

## Configuration

### Working Hours
- Configurable start/end times
- Timezone support (including Asia/Makassar for Bali)
- Selective working days

### MCP Server Connection
- Default: `http://localhost:8080/add-progress`
- Configurable URL and endpoint
- Connection testing built-in

### Projects
- Multiple project support
- Default project selection
- Easy project management

## Usage

1. **Automatic Tracking**: The app automatically prompts for progress reports during working hours
2. **Manual Reports**: Click "Submit Report Now" for immediate reporting
3. **Pause Tracking**: Temporarily disable tracking when needed
4. **System Tray**: The app runs in the background, accessible from the system tray

## Architecture

- **Main Process** (`main.js`): Handles app lifecycle, notifications, and MCP server integration
- **Renderer Process** (`renderer/`): User interface and interaction logic
- **MCP Integration**: Built-in server processes for data handling
- **Settings Storage**: Local JSON-based configuration storage

## Browser Extension Legacy

This desktop app maintains full compatibility with the original browser extension functionality while adding desktop-native features:

- System-level notifications
- Background operation
- Better resource management
- No browser dependency

## Troubleshooting

### Connection Issues
- Ensure MCP server is running on the configured port
- Check firewall settings
- Verify server URL and endpoint configuration

### Notification Issues
- Check system notification permissions
- Ensure the app is not in Do Not Disturb mode

### Performance
- The app uses minimal resources when running in the background
- MCP server process is automatically managed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
