// Background service worker for MCP Progress Tracker

class MCPProgressTracker {
    constructor() {
      this.setupAlarms();
      this.setupEventListeners();
    }
  
    setupEventListeners() {
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'hourlyProgress') {
          this.handleHourlyCheck();
        } else if (alarm.name === 'workingHoursCheck') {
          this.handleWorkingHoursCheck();
        }
      });
  
      chrome.runtime.onInstalled.addListener(() => {
        this.initializeSettings();
      });
  
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open for async response
      });
    }
  
    async initializeSettings() {
      const defaultSettings = {
        enabled: true,
        workingHours: {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5], // Monday to Friday
          timezone: 'Asia/Makassar' // Bali timezone (UTC+8)
        },
        mcpServer: {
          url: 'http://localhost:3000',
          endpoint: '/add-progress'
        },
        paused: false,
        lastReportTime: null,
        promptOnExactHour: true // New option to control exact hour prompting
      };
  
      const existing = await chrome.storage.local.get(['settings']);
      if (!existing.settings) {
        await chrome.storage.local.set({ settings: defaultSettings });
      } else {
        // Merge with defaults to add any missing properties
        const merged = { ...defaultSettings, ...existing.settings };
        // Update the server endpoint to match our new setup
        merged.mcpServer.endpoint = '/add-progress';
        // Ensure timezone is set for existing users
        if (!merged.workingHours.timezone) {
          merged.workingHours.timezone = 'Asia/Makassar';
        }
        await chrome.storage.local.set({ settings: merged });
      }
  
      this.setupAlarms();
    }
  
    async setupAlarms() {
      // Clear existing alarms
      chrome.alarms.clearAll();
  
      const { settings } = await chrome.storage.local.get(['settings']);
      if (!settings || !settings.enabled) return;
  
      // Calculate next hour start using the configured timezone
      const timezone = settings.workingHours.timezone || 'UTC';
      const now = new Date();
      const timeInTimezone = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
      
      const nextHour = new Date(timeInTimezone);
      nextHour.setHours(timeInTimezone.getHours() + 1, 0, 0, 0); // Next hour at :00 minutes
      
      // Convert back to local time for alarm scheduling
      const nextHourLocal = new Date(nextHour.toLocaleString("en-US", {timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone}));
      const delayMinutes = Math.ceil((nextHourLocal.getTime() - now.getTime()) / (1000 * 60));
  
      // Set up hourly progress check - triggers exactly on the hour
      chrome.alarms.create('hourlyProgress', {
        delayInMinutes: delayMinutes,
        periodInMinutes: 60
      });
  
      // Set up working hours check (every 30 minutes)
      chrome.alarms.create('workingHoursCheck', {
        delayInMinutes: 5,
        periodInMinutes: 30
      });
  
      console.log(`Next hourly check will trigger in ${delayMinutes} minutes at ${nextHour.toLocaleTimeString()} (${timezone}) / ${nextHourLocal.toLocaleTimeString()} (local)`);
    }
  
    async handleHourlyCheck() {
      const { settings } = await chrome.storage.local.get(['settings']);
      if (!settings || !settings.enabled || settings.paused) return;
  
      const now = new Date();
      const timezone = settings.workingHours.timezone || 'UTC';
      const timeInTimezone = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
      
      console.log(`Hourly check triggered at ${now.toLocaleTimeString()} (local) / ${timeInTimezone.toLocaleTimeString()} (${timezone})`);
  
      // Only show prompt if it's within 5 minutes of the hour (to account for timing variations)
      const currentMinutes = timeInTimezone.getMinutes();
      if (currentMinutes <= 5) {
        if (this.isWorkingHours(settings.workingHours)) {
          console.log(`Showing progress prompt at ${timeInTimezone.toLocaleTimeString()} (${timezone})`);
          await this.showProgressPrompt();
        } else {
          console.log(`Outside working hours at ${timeInTimezone.toLocaleTimeString()} (${timezone})`);
        }
      } else {
        console.log(`Skipping prompt - not at top of hour (${currentMinutes} minutes past in ${timezone})`);
      }
    }
  
    async handleWorkingHoursCheck() {
      const { settings } = await chrome.storage.local.get(['settings']);
      if (!settings || settings.paused) return;
  
      if (this.isWorkingHours(settings.workingHours) && !settings.enabled) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'MCP Progress Tracker',
          message: 'Working hours detected. Would you like to enable progress tracking?',
          buttons: [
            { title: 'Enable' },
            { title: 'Dismiss' }
          ]
        });
      }
    }
  
    isWorkingHours(workingHours) {
      // Get current time in the specified timezone
      const timezone = workingHours.timezone || 'UTC';
      const now = new Date();
      
      // Create date in the working hours timezone
      const timeInTimezone = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
      const currentDay = timeInTimezone.getDay();
      const currentTime = timeInTimezone.getHours() * 60 + timeInTimezone.getMinutes();

      console.log(`Current time in ${timezone}: ${timeInTimezone.toLocaleTimeString()}, Day: ${currentDay}`);

      if (!workingHours.days.includes(currentDay)) {
        console.log(`Not a working day (${currentDay})`);
        return false;
      }

      const [startHour, startMin] = workingHours.start.split(':').map(Number);
      const [endHour, endMin] = workingHours.end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      const isInWorkingHours = currentTime >= startTime && currentTime <= endTime;
      console.log(`Working hours: ${workingHours.start}-${workingHours.end}, Current: ${Math.floor(currentTime/60)}:${String(currentTime%60).padStart(2,'0')}, In hours: ${isInWorkingHours}`);

      return isInWorkingHours;
    }
  
        async showProgressPrompt() {
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return;

      // Use the content script modal instead of inline injection
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'showProgressModal' });
      } catch (error) {
        console.error('Failed to show progress modal via content script:', error);
        // Fallback to notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Progress Report',
          message: 'Time for your hourly progress update! Click to open tracker.',
          requireInteraction: true
        });
      }
    }

  
    async handleMessage(request, sender, sendResponse) {
      try {
        switch (request.action) {
          case 'submitProgress':
            await this.submitToMCP(request.data);
            sendResponse({ success: true });
            break;
  
          case 'pauseTracking':
            await this.pauseTracking(request.hours || 2);
            sendResponse({ success: true });
            break;
  
          case 'updateSettings':
            await chrome.storage.local.set({ settings: request.settings });
            await this.setupAlarms();
            sendResponse({ success: true });
            break;
  
          case 'getSettings':
            const { settings } = await chrome.storage.local.get(['settings']);
            sendResponse({ settings });
            break;
  
          default:
            sendResponse({ error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
      }
    }
  
    async submitToMCP(data) {
      const { settings } = await chrome.storage.local.get(['settings']);
      if (!settings?.mcpServer?.url) return;
  
      try {
        // Parse the progress text to extract hours and description
        const progressText = data.progress.trim();
        let hours = 1; // Default to 1 hour
        let description = progressText;
  
        // Try to extract hours from patterns like "2h: description" or "1.5 hours: description"
        const hourPatterns = [
          /^(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*:\s*(.+)/i,
          /^(\d+(?:\.\d+)?)\s*hours?\s*:\s*(.+)/i,
          /(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*[:-]\s*(.+)/i
        ];
  
        for (const pattern of hourPatterns) {
          const match = progressText.match(pattern);
          if (match) {
            hours = parseFloat(match[1]);
            description = match[2].trim();
            break;
          }
        }
  
        // If no hours found, ask user via prompt (fallback)
        if (hours === 1 && !progressText.match(/\d+(?:\.\d+)?\s*h/i)) {
          // For now, we'll default to 1 hour, but this could be enhanced
          console.log('No hours specified, defaulting to 1 hour');
        }
  
        const payload = {
          hours: hours,
          description: description,
          date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
          project: data.project || 'GGSA' // Use provided project or default
        };
  
        console.log('Submitting to MCP:', payload);
  
        const response = await fetch(`${settings.mcpServer.url}${settings.mcpServer.endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
  
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
  
        const result = await response.json();
        console.log('MCP Response:', result);
  
        // Update last report time
        const updatedSettings = { ...settings, lastReportTime: data.timestamp };
        await chrome.storage.local.set({ settings: updatedSettings });
  
        // Show success notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Progress Saved!',
          message: `Saved: ${hours}h - ${description}`
        });
  
        console.log('Progress report submitted to MCP successfully');
      } catch (error) {
        console.error('Failed to submit to MCP:', error);
        // Show notification about failure
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'MCP Progress Tracker',
          message: `Failed to submit report: ${error.message}`
        });
      }
    }
  
    async pauseTracking(hours) {
      const { settings } = await chrome.storage.local.get(['settings']);
      const pauseUntil = new Date();
      pauseUntil.setHours(pauseUntil.getHours() + hours);
  
      const updatedSettings = {
        ...settings,
        paused: true,
        pauseUntil: pauseUntil.toISOString()
      };
  
      await chrome.storage.local.set({ settings: updatedSettings });
  
      // Set alarm to resume
      chrome.alarms.create('resumeTracking', {
        when: pauseUntil.getTime()
      });
  
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'resumeTracking') {
          this.resumeTracking();
        }
      });
    }
  
    async resumeTracking() {
      const { settings } = await chrome.storage.local.get(['settings']);
      const updatedSettings = {
        ...settings,
        paused: false,
        pauseUntil: null
      };
  
      await chrome.storage.local.set({ settings: updatedSettings });
    }
  }
  
  // Initialize the tracker
  new MCPProgressTracker();