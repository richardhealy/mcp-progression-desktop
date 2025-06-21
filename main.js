import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { startEmbeddedServer, stopEmbeddedServer, isServerHealthy } from './embedded-http-server.js';
import { HybridActivityMonitor } from './activity-monitor.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object and tray
let mainWindow;
let tray = null;
let mcpServerProcess = null;
let httpServerProcess = null;
let serverStatus = { healthy: false, message: 'Server not started' };

// Activity monitoring
let activityMonitor = {
  isMonitoring: false,
  currentSession: {
    startTime: null,
    lastActivity: null,
    totalActiveTime: 0,
    isActive: false
  },
  dailyStats: {
    activeTime: 0,
    idleTime: 0,
    sessions: [],
    lastReset: new Date().toDateString()
  },
  intervals: {
    monitor: null,
    save: null
  }
};

// Native activity monitor instance
let nativeActivityMonitor = null;

// Settings management
const settingsPath = path.join(__dirname, 'settings.json');
let settings = {};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      console.log('Loaded settings from file:', settings);
    } else {
      // Default settings - matching renderer structure
      settings = {
        enabled: true,
        workingHours: {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5], // Mon-Fri as numbers
          timezone: 'Europe/Berlin'
        },
        mcpServer: {
          url: 'http://localhost:8087',
          endpoint: '/add-progress'
        },
        projects: ['GGSA', 'Nestly', 'Seenspire'], // Array instead of object
        defaultProject: 'GGSA',
        paused: false,
        lastReportTime: null,
        notifications: {
          enabled: true,
          interval: 3600000
        },
        tracking: {
          isPaused: false,
          isEnabled: true
        }
      };
      saveSettings();
      console.log('Created default settings:', settings);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = getDefaultSettings();
  }
}

function getDefaultSettings() {
  return {
    enabled: true,
    workingHours: {
      start: '09:00',
      end: '17:00',
      days: [1, 2, 3, 4, 5],
      timezone: 'Europe/Berlin'
    },
    mcpServer: {
      url: 'http://localhost:8087',
      endpoint: '/add-progress'
    },
    projects: ['GGSA', 'Nestly', 'Seenspire'],
    defaultProject: 'GGSA',
    paused: false,
    lastReportTime: null,
    notifications: {
      enabled: true,
      interval: 3600000
    },
    tracking: {
      isPaused: false,
      isEnabled: true
    }
  };
}

function saveSettings() {
  try {
    console.log('Writing settings to file:', settingsPath);
    console.log('Settings data to write:', JSON.stringify(settings, null, 2));
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    console.log('Settings written successfully to file');
    
    // Verify the file was written correctly
    if (fs.existsSync(settingsPath)) {
      const writtenData = fs.readFileSync(settingsPath, 'utf8');
      console.log('Verified written data:', writtenData);
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    console.error('Settings path:', settingsPath);
    console.error('Settings object:', settings);
    throw error;
  }
}

function updateServerStatus(status) {
  serverStatus = status;
  console.log('Server status updated:', serverStatus);
  
  // Send to renderer if window is available
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('server-status', serverStatus);
  }
}

function createWindow() {
  // Don't create multiple windows
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'renderer', 'preload.cjs')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hiddenInset', // macOS-style title bar
    show: false // Don't show until ready
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Send current server status to renderer after a brief delay
    setTimeout(() => {
      if (mainWindow && mainWindow.webContents) {
        console.log('Sending current server status to renderer:', serverStatus);
        mainWindow.webContents.send('server-status', serverStatus);
      }
    }, 500);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Track window focus for activity monitoring
  mainWindow.on('focus', () => {
    simulateActivityDetection();
  });

  mainWindow.on('blur', () => {
    // Window lost focus - could indicate user switched to another app
  });

  // Handle minimize to tray on macOS
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Destroy existing tray to prevent duplicates
  if (tray) {
    tray.destroy();
    tray = null;
  }

  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  
  // Create tray icon
  tray = new Tray(iconPath);
  console.log('Tray icon created');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Submit Report Now',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('submit-report-now');
        }
        showProgressDialog();
      }
    },
    { type: 'separator' },
    {
      label: settings.paused ? 'Resume Tracking' : 'Pause Tracking',
      click: () => {
        settings.paused = !settings.paused;
        saveSettings();
        updateTrayMenu();
        if (mainWindow) {
          mainWindow.webContents.send('tracking-status-changed', { isPaused: settings.paused, isEnabled: settings.enabled });
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('MCP Progress Tracker');
  
  // Handle tray click on macOS
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

function updateTrayMenu() {
  if (!tray) {
    createTray();
    return;
  }

  // Just update the menu instead of recreating the entire tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Submit Report Now',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('submit-report-now');
        }
        showProgressDialog();
      }
    },
    { type: 'separator' },
    {
      label: settings.paused ? 'Resume Tracking' : 'Pause Tracking',
      click: () => {
        settings.paused = !settings.paused;
        
        if (settings.paused) {
          // When pausing, set pause until 2 hours from now
          const pauseUntil = new Date();
          pauseUntil.setHours(pauseUntil.getHours() + 2);
          settings.pauseUntil = pauseUntil.toISOString();
        } else {
          // When resuming, clear the pause until time
          settings.pauseUntil = null;
        }
        
        saveSettings();
        updateTrayMenu();
        if (mainWindow) {
          mainWindow.webContents.send('tracking-status-changed', { isPaused: settings.paused, isEnabled: settings.enabled });
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  console.log('Tray menu updated');
}

async function startMcpServer() {
  try {
    // Check if we're in a packaged app
    const isPackaged = app.isPackaged;
    console.log('App is packaged:', isPackaged);
    console.log('Current directory:', __dirname);
    console.log('Process cwd:', process.cwd());

    // Only start MCP server in development mode
    if (!isPackaged) {
      // Start the MCP server (stdio server) - only in development
      mcpServerProcess = spawn('node', ['mcp-server.js'], {
        cwd: __dirname,
        stdio: 'pipe',
        env: process.env
      });

      mcpServerProcess.stdout.on('data', (data) => {
        console.log(`MCP Server: ${data}`);
      });

      mcpServerProcess.stderr.on('data', (data) => {
        console.error(`MCP Server Error: ${data}`);
      });

      mcpServerProcess.on('close', (code) => {
        console.log(`MCP Server process exited with code ${code}`);
      });
      
      console.log('MCP server started in development mode');
    } else {
      console.log('Skipping MCP server spawn in packaged app');
    }

    // Start the embedded HTTP server
    console.log('Starting embedded HTTP server...');
    
    // Send initial status
    updateServerStatus({ healthy: false, message: 'Starting server...' });
    
    try {
      await startEmbeddedServer();
      console.log('Embedded HTTP server started successfully');
    } catch (serverError) {
      console.error('Failed to start embedded HTTP server:', serverError);
      updateServerStatus({ healthy: false, message: `Server startup failed: ${serverError.message}` });
      throw serverError; // Re-throw to be caught by outer try-catch
    }
    
    // Health check the HTTP server
    setTimeout(async () => {
      try {
        console.log('Performing HTTP server health check...');
        const response = await fetch('http://localhost:8087/health');
        if (response.ok) {
          const data = await response.json();
          console.log('HTTP server health check passed:', data);
          
          // Notify renderer that server is healthy
          updateServerStatus({ healthy: true, message: 'Server running' });
        } else {
          console.error('HTTP server health check failed:', response.status);
          updateServerStatus({ healthy: false, message: 'Server health check failed' });
        }
      } catch (error) {
        console.error('HTTP server health check error:', error.message);
        updateServerStatus({ healthy: false, message: `Server error: ${error.message}` });
      }
    }, 2000); // Wait 2 seconds for server to start
    
  } catch (error) {
    console.error('Error starting servers:', error);
    updateServerStatus({ healthy: false, message: `Failed to start server: ${error.message}` });
  }
}

function showProgressDialog() {
  if (!Notification.isSupported()) {
    console.log('Notifications not supported');
    return;
  }

  console.log('Showing progress notification');
  const notification = new Notification({
    title: 'Progress Report Time',
    body: 'Time to submit your hourly progress report!',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    urgency: 'normal'
  });

  notification.show();
  
  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('show-progress-dialog');
    } else {
      createWindow();
    }
  });
}

function isCurrentlyInWorkingHours() {
  if (!settings || !settings.workingHours) {
    console.log('No working hours settings found');
    return false;
  }

  const timezone = settings.workingHours.timezone || 'UTC';
  const now = new Date();
  
  try {
    // Get time in the target timezone using proper Intl API
    const timeInTimezone = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short'
    }).formatToParts(now);
    
    // Extract day and time from the formatted parts
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = timeInTimezone.find(part => part.type === 'weekday').value;
    const currentDay = weekdays.indexOf(dayName);
    
    const hour = parseInt(timeInTimezone.find(part => part.type === 'hour').value);
    const minute = parseInt(timeInTimezone.find(part => part.type === 'minute').value);
    const currentTime = hour * 60 + minute;

    console.log('Working hours check:', {
      timezone,
      dayName,
      currentDay,
      hour,
      minute,
      currentTime,
      workingDays: settings.workingHours.days,
      workingHours: `${settings.workingHours.start} - ${settings.workingHours.end}`
    });

    // Check if current day is a working day
    if (!settings.workingHours.days || !settings.workingHours.days.includes(currentDay)) {
      console.log('Not a working day');
      return false;
    }

    // Check if current time is within working hours
    const [startHour, startMin] = settings.workingHours.start.split(':').map(Number);
    const [endHour, endMin] = settings.workingHours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    const isInWorkingHours = currentTime >= startTime && currentTime <= endTime;
    console.log('Is in working hours:', isInWorkingHours);
    
    return isInWorkingHours;
  } catch (error) {
    console.error('Error checking working hours:', error);
    return false;
  }
}

function setupHourlyNotifications() {
  console.log('Setting up hourly notifications...');
  
  // Check every minute if we should send a notification or auto-resume
  setInterval(() => {
    // Check if we should auto-resume from pause
    if (settings.paused && settings.pauseUntil) {
      const pauseUntil = new Date(settings.pauseUntil);
      if (new Date() >= pauseUntil) {
        console.log('Auto-resuming tracking - pause period expired');
        settings.paused = false;
        settings.pauseUntil = null;
        saveSettings();
        updateTrayMenu();
        if (mainWindow) {
          mainWindow.webContents.send('tracking-status-changed', { isPaused: settings.paused, isEnabled: settings.enabled });
        }
      }
    }
    
    if (!settings.enabled || settings.paused) {
      return;
    }

    if (isCurrentlyInWorkingHours()) {
      const now = new Date();
      const minutes = now.getMinutes();
      
      // Send notification at the top of each hour (when minutes = 0)
      if (minutes === 0) {
        console.log('Top of the hour - sending notification');
        showProgressDialog();
      }
    }
  }, 60000); // Check every minute

  console.log('Hourly notifications set up - checking every minute');
}

// IPC handlers
// Activity Monitoring Functions
function startActivityMonitoring() {
  if (activityMonitor.isMonitoring) return;
  
  console.log('Starting activity monitoring...');
  activityMonitor.isMonitoring = true;
  activityMonitor.currentSession.startTime = Date.now();
  activityMonitor.currentSession.lastActivity = Date.now();
  
  // Check if we need to reset daily stats
  const today = new Date().toDateString();
  if (activityMonitor.dailyStats.lastReset !== today) {
    resetDailyStats();
  }
  
  // Monitor activity every 10 seconds
  activityMonitor.intervals.monitor = setInterval(checkActivity, 10000);
  
  // Save stats every minute
  activityMonitor.intervals.save = setInterval(saveActivityStats, 60000);

  // Simulate periodic activity detection
  setInterval(simulateActivityDetection, 5000);
  
  // Load existing stats
  loadActivityStats();
}

function stopActivityMonitoring() {
  if (!activityMonitor.isMonitoring) return;
  
  console.log('Stopping activity monitoring...');
  activityMonitor.isMonitoring = false;
  
  if (activityMonitor.intervals.monitor) {
    clearInterval(activityMonitor.intervals.monitor);
    activityMonitor.intervals.monitor = null;
  }
  
  if (activityMonitor.intervals.save) {
    clearInterval(activityMonitor.intervals.save);
    activityMonitor.intervals.save = null;
  }
  
  // Save final stats
  saveActivityStats();
}

function checkActivity() {
  const now = Date.now();
  const idleTime = now - activityMonitor.currentSession.lastActivity;
  const isIdle = idleTime > 60000; // 1 minute of inactivity = idle
  
  if (!isIdle) {
    // User is active
    if (!activityMonitor.currentSession.isActive) {
      // Just became active
      activityMonitor.currentSession.isActive = true;
      console.log('User became active');
    }
    activityMonitor.currentSession.lastActivity = now;
  } else {
    // User is idle
    if (activityMonitor.currentSession.isActive) {
      // Just became idle
      activityMonitor.currentSession.isActive = false;
      console.log('User became idle');
    }
  }
  
  // Update daily stats
  if (activityMonitor.currentSession.isActive) {
    activityMonitor.dailyStats.activeTime += 10; // 10 seconds
  } else {
    activityMonitor.dailyStats.idleTime += 10; // 10 seconds
  }
  
  // Send update to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('activity-update', {
      isActive: activityMonitor.currentSession.isActive,
      sessionTime: now - activityMonitor.currentSession.startTime,
      dailyActive: activityMonitor.dailyStats.activeTime,
      dailyIdle: activityMonitor.dailyStats.idleTime
    });
  }
}

function resetDailyStats() {
  const today = new Date().toDateString();
  console.log('Resetting daily stats for:', today);
  
  activityMonitor.dailyStats = {
    activeTime: 0,
    idleTime: 0,
    sessions: [],
    lastReset: today
  };
}

function saveActivityStats() {
  const statsPath = path.join(__dirname, 'activity-stats.json');
  try {
    const stats = {
      dailyStats: activityMonitor.dailyStats,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Error saving activity stats:', error);
  }
}

function loadActivityStats() {
  const statsPath = path.join(__dirname, 'activity-stats.json');
  try {
    if (fs.existsSync(statsPath)) {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      
      // Only load if it's from today
      const today = new Date().toDateString();
      if (stats.dailyStats && stats.dailyStats.lastReset === today) {
        activityMonitor.dailyStats = stats.dailyStats;
        console.log('Loaded activity stats from file');
      }
    }
  } catch (error) {
    console.error('Error loading activity stats:', error);
  }
}

function getActivityStats() {
  const now = Date.now();
  const sessionTime = activityMonitor.currentSession.startTime ? 
    now - activityMonitor.currentSession.startTime : 0;
  
  return {
    isMonitoring: activityMonitor.isMonitoring,
    isActive: activityMonitor.currentSession.isActive,
    sessionTime: sessionTime,
    dailyActive: activityMonitor.dailyStats.activeTime * 1000, // Convert to milliseconds
    dailyIdle: activityMonitor.dailyStats.idleTime * 1000,
    totalTime: (activityMonitor.dailyStats.activeTime + activityMonitor.dailyStats.idleTime) * 1000
  };
}

// Simulate user activity detection (since real system monitoring requires native modules)
function simulateActivityDetection() {
  // This is a simplified version - in a real implementation, you'd use:
  // - Mouse movement detection
  // - Keyboard input detection
  // - Screen interaction monitoring
  
  // For now, we'll simulate activity based on window focus and basic events
  if (mainWindow && mainWindow.isFocused()) {
    activityMonitor.currentSession.lastActivity = Date.now();
  }
}

function setupIpcHandlers() {
  ipcMain.handle('get-settings', () => {
    console.log('Returning settings:', settings);
    return settings;
  });

  ipcMain.handle('save-settings', (event, newSettings) => {
    try {
      console.log('Received settings to save:', newSettings);
      console.log('Current settings before save:', settings);
      
      // Merge new settings with existing settings
      settings = { ...settings, ...newSettings };
      
      console.log('Merged settings:', settings);
      
      // Save to file
      saveSettings();
      
      // Update tray menu to reflect changes
      updateTrayMenu();
      
      console.log('Settings saved successfully');
      return settings;
    } catch (error) {
      console.error('Error in save-settings handler:', error);
      throw error;
    }
  });

  ipcMain.handle('submit-progress', async (event, progressData) => {
    try {
      console.log('Progress submitted:', progressData);
      
      // Send data to the embedded HTTP server
      const url = `${settings.mcpServer.url}/add-progress`;
      console.log('Sending progress to HTTP server:', url);
      console.log('Progress data:', JSON.stringify(progressData, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      });
      
      console.log('HTTP response status:', response.status);
      console.log('HTTP response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP server error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('HTTP server response:', result);
      
      // Show success notification
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'Progress Submitted',
          body: `Successfully logged ${progressData.hours} hours for ${progressData.project}`,
          icon: path.join(__dirname, 'assets', 'icon.png')
        });
        notification.show();
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Error submitting progress:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('test-server-connection', async () => {
    try {
      // Test connection to MCP server
      const response = await fetch(`${settings.mcpServer.url}/health`);
      return { success: response.ok, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('test-notification', () => {
    console.log('Testing notification...');
    showProgressDialog();
    return { success: true };
  });

  ipcMain.handle('get-server-status', () => {
    console.log('Returning server status:', serverStatus);
    return serverStatus;
  });

  // Progress items management
  ipcMain.handle('get-progress-items', async () => {
    try {
      const url = `${settings.mcpServer.url}/progress-report`;
      console.log('Fetching progress items from HTTP server...');
      console.log('Settings:', JSON.stringify(settings, null, 2));
      console.log('Fetch URL:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Progress items fetched:', data.rawItems?.length || 0, 'items');
      console.log('First item sample:', data.rawItems?.[0]);
      
      return data.rawItems || [];
    } catch (error) {
      console.error('Error fetching progress items:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return [];
    }
  });

  ipcMain.handle('update-progress-item', async (event, item) => {
    try {
      console.log('Updating progress item:', item);
      
      // For now, we'll just return success as Airtable doesn't have a direct update API
      // In a real implementation, you'd need to implement update functionality in your HTTP server
      console.warn('Update functionality not yet implemented in HTTP server');
      
      return { 
        success: false, 
        error: 'Update functionality not yet implemented. Please delete and recreate the item instead.' 
      };
    } catch (error) {
      console.error('Error updating progress item:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-progress-item', async (event, id) => {
    try {
      console.log('Deleting progress item:', id);
      
      // For now, we'll just return success as Airtable doesn't have a direct delete API
      // In a real implementation, you'd need to implement delete functionality in your HTTP server
      console.warn('Delete functionality not yet implemented in HTTP server');
      
      return { 
        success: false, 
        error: 'Delete functionality not yet implemented. You can delete items directly in Airtable.' 
      };
    } catch (error) {
      console.error('Error deleting progress item:', error);
      return { success: false, error: error.message };
    }
  });

  // Activity monitoring handlers
  ipcMain.handle('start-activity-monitoring', () => {
    startActivityMonitoring();
    return { success: true };
  });

  ipcMain.handle('stop-activity-monitoring', () => {
    stopActivityMonitoring();
    return { success: true };
  });

  ipcMain.handle('get-activity-stats', () => {
    return getActivityStats();
  });

  ipcMain.handle('reset-activity-stats', () => {
    resetDailyStats();
    return { success: true };
  });

  // Native activity monitoring handlers
  ipcMain.handle('get-native-activity-stats', async () => {
    try {
      if (!nativeActivityMonitor) {
        return {
          error: 'Native activity monitor not initialized',
          permissions: {
            hasPermissions: false,
            fallbackMode: true,
            message: 'Using fallback activity tracking. Native libraries not available.'
          }
        };
      }

      const permissions = await nativeActivityMonitor.checkPermissions();
      const stats = nativeActivityMonitor.getStats();
      
      return {
        isMonitoring: nativeActivityMonitor.isActive,
        lastActivity: nativeActivityMonitor.lastActivity,
        stats: stats,
        permissions: {
          hasPermissions: permissions.overall !== 'none',
          fallbackMode: permissions.overall === 'none',
          message: permissions.overall === 'none' 
            ? 'System permissions required for advanced activity tracking'
            : `Active with ${permissions.overall} permissions`,
          details: permissions
        }
      };
    } catch (error) {
      console.error('Error getting native activity stats:', error);
      return {
        error: error.message,
        permissions: {
          hasPermissions: false,
          fallbackMode: true,
          message: 'Error accessing native activity tracking'
        }
      };
    }
  });

  ipcMain.handle('test-native-activity', async () => {
    try {
      if (!nativeActivityMonitor) {
        return { success: false, message: 'Native activity monitor not initialized' };
      }

      const permissions = await nativeActivityMonitor.checkPermissions();
      if (permissions.overall === 'none') {
        return { 
          success: false, 
          message: 'No native libraries have permissions. Using fallback mode.' 
        };
      }

      // Simulate activity detection
      nativeActivityMonitor.simulateActivity();
      return { 
        success: true, 
        message: `Activity test successful. Libraries available: ${JSON.stringify(permissions)}` 
      };
    } catch (error) {
      console.error('Error testing native activity:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('reset-native-activity-stats', () => {
    try {
      if (nativeActivityMonitor) {
        nativeActivityMonitor.resetStats();
        return { success: true, message: 'Native activity stats reset successfully' };
      }
      return { success: false, message: 'Native activity monitor not initialized' };
    } catch (error) {
      console.error('Error resetting native activity stats:', error);
      return { success: false, message: error.message };
    }
  });
}

// Simple permission check function
async function checkNativePermissions() {
  console.log('🔐 Checking native permissions in main process...');
  
  try {
    // Try to import and test robotjs (most likely to trigger permission dialog)
    const robotModule = await import('@hurdlegroup/robotjs');
    const robot = robotModule.default;
    
    // Test if we can get mouse position (requires accessibility permissions)
    const pos = robot.getMousePos();
    console.log('✅ Native permissions granted - mouse position:', pos);
    return true;
  } catch (error) {
    console.log('❌ Native permissions denied or not available:', error.message);
    return false;
  }
}

// Copy .env file to userData directory for packaged app
function ensureEnvFile() {
  try {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
      const sourceEnvPath = path.join(__dirname, '.env');
      const targetEnvPath = path.join(app.getPath('userData'), '.env');
      
      console.log('Checking for .env file...');
      console.log('Source path:', sourceEnvPath);
      console.log('Target path:', targetEnvPath);
      
      // Copy .env file to userData directory if it exists and target doesn't exist
      if (fs.existsSync(sourceEnvPath) && !fs.existsSync(targetEnvPath)) {
        console.log('Copying .env file to userData directory...');
        fs.copyFileSync(sourceEnvPath, targetEnvPath);
        console.log('.env file copied successfully');
      } else if (fs.existsSync(targetEnvPath)) {
        console.log('.env file already exists in userData directory');
      } else if (!fs.existsSync(sourceEnvPath)) {
        console.log('No .env file found in app bundle');
      }
    }
  } catch (error) {
    console.error('Error handling .env file:', error);
  }
}

// App event handlers
app.whenReady().then(async () => {
  loadSettings();
  ensureEnvFile(); // Ensure .env file is available
  createWindow();
  
  // Only create tray if it doesn't exist
  if (!tray) {
    createTray();
  }
  
  setupIpcHandlers();
  startMcpServer();

  // Request notification permissions
  if (Notification.isSupported()) {
    console.log('Requesting notification permissions...');
    app.dock?.setBadge('');
  }

  // Set up hourly notifications
  setupHourlyNotifications();

  // Start activity monitoring
  startActivityMonitoring();

  // Initialize native activity monitor after a delay to prevent immediate permission requests
  setTimeout(async () => {
    try {
      console.log('Initializing native activity monitor...');
      nativeActivityMonitor = new HybridActivityMonitor({
        idleThreshold: 60000, // 1 minute
        checkInterval: 5000,  // 5 seconds
        trackMouse: true,
        trackKeyboard: true
      });

    // Set up event listeners
    nativeActivityMonitor.on('activity-changed', (data) => {
      console.log('Native activity changed:', data);
      if (mainWindow && mainWindow.webContents) {
        // Send both the native activity event and the activity status change
        mainWindow.webContents.send('native-activity-changed', data);
        mainWindow.webContents.send('activity-status-changed', data);
      }
    });

    nativeActivityMonitor.on('libraries-loaded', (libraries) => {
      console.log('Native activity libraries loaded:', libraries);
    });

    nativeActivityMonitor.on('error', (error) => {
      console.error('Native activity monitor error:', error);
    });

    // Listen for mouse, keyboard, and window activity for real-time updates
    nativeActivityMonitor.on('mouse-activity', (data) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('native-activity', { type: 'mouse', ...data });
      }
    });

    nativeActivityMonitor.on('keyboard-activity', (data) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('native-activity', { type: 'keyboard', ...data });
      }
    });

    nativeActivityMonitor.on('window-changed', (data) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('native-activity', { type: 'window', ...data });
      }
    });

      // Start the native monitor
      await nativeActivityMonitor.start();
      console.log('Native activity monitor started successfully');
    } catch (error) {
      console.error('Failed to initialize native activity monitor:', error);
      console.log('Continuing with basic activity monitoring only');
    }
  }, 3000); // 3 second delay to allow app to fully initialize

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running in the background but clean up window reference
  if (process.platform !== 'darwin') {
    app.quit();
  } else {
    // Just clean up the window reference, keep tray running
    mainWindow = null;
  }
});

app.on('before-quit', async () => {
  app.isQuiting = true;
  
  // Clean up tray icon
  if (tray) {
    console.log('Destroying tray icon');
    tray.destroy();
    tray = null;
  }
  
  // Clean up native activity monitor
  if (nativeActivityMonitor) {
    console.log('Stopping native activity monitor...');
    nativeActivityMonitor.stop();
    nativeActivityMonitor = null;
  }
  
  // Clean up server processes
  if (mcpServerProcess) {
    mcpServerProcess.kill();
  }
  
  // Clean up embedded HTTP server
  try {
    console.log('Stopping embedded HTTP server...');
    await stopEmbeddedServer();
    console.log('Embedded HTTP server stopped');
  } catch (error) {
    console.error('Error stopping embedded server:', error);
  }
});

// Handle protocol for macOS (if needed for deep linking)
app.setAsDefaultProtocolClient('mcp-progress'); 