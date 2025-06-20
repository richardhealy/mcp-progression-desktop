// Popup script for MCP Progress Tracker

class PopupController {
    constructor() {
      this.settings = null;
      this.init();
    }
  
    async init() {
      await this.loadSettings();
      this.setupEventListeners();
      this.updateUI();
    }
  
    async loadSettings() {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
        this.settings = response.settings || this.getDefaultSettings();
      } catch (error) {
        console.error('Failed to load settings:', error);
        this.settings = this.getDefaultSettings();
      }
    }
  
    getDefaultSettings() {
      return {
        enabled: true,
        workingHours: {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5],
          timezone: 'Asia/Makassar' // Default to Bali timezone
        },
        mcpServer: {
          url: 'http://localhost:8080',
          endpoint: '/add-progress'
        },
        projects: ['Nestly', 'GGSA'],
        defaultProject: 'Nestly',
        paused: false,
        lastReportTime: null
      };
    }
  
    setupEventListeners() {
      // Enable/disable toggle
      document.getElementById('enabledToggle').addEventListener('change', (e) => {
        this.settings.enabled = e.target.checked;
        this.updateStatus();
      });
  
      // Working days checkboxes
      [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        const checkbox = document.getElementById(`day${day}`);
        checkbox.addEventListener('change', () => {
          this.updateWorkingDays();
        });
      });
  
      // Time inputs
      document.getElementById('startTime').addEventListener('change', (e) => {
        this.settings.workingHours.start = e.target.value;
      });
  
      document.getElementById('endTime').addEventListener('change', (e) => {
        this.settings.workingHours.end = e.target.value;
      });
  
      // Timezone dropdown
      document.getElementById('timezone').addEventListener('change', (e) => {
        this.settings.workingHours.timezone = e.target.value;
        this.updateStatus(); // Update status since timezone affects working hours
      });
  
      // MCP server settings
      document.getElementById('mcpUrl').addEventListener('change', (e) => {
        this.settings.mcpServer.url = e.target.value;
      });
  
      document.getElementById('mcpEndpoint').addEventListener('change', (e) => {
        this.settings.mcpServer.endpoint = e.target.value;
      });
  
      // Action buttons
      document.getElementById('saveSettings').addEventListener('click', () => {
        this.saveSettings();
      });
  
      document.getElementById('testConnection').addEventListener('click', () => {
        this.testMCPConnection();
      });
  
      document.getElementById('triggerReport').addEventListener('click', () => {
        this.triggerManualReport();
      });
  
      document.getElementById('pauseTracking').addEventListener('click', () => {
        this.pauseTracking();
      });
      
      // Project management
      document.getElementById('addProject').addEventListener('click', () => {
        this.addProject();
      });
      
      document.getElementById('defaultProject').addEventListener('change', (e) => {
        this.settings.defaultProject = e.target.value;
      });
    }
  
    updateWorkingDays() {
      const selectedDays = [];
      [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        const checkbox = document.getElementById(`day${day}`);
        if (checkbox.checked) {
          selectedDays.push(day);
        }
      });
      this.settings.workingHours.days = selectedDays;
    }
  
    updateUI() {
      // Update enabled toggle
      document.getElementById('enabledToggle').checked = this.settings.enabled;
  
      // Update working days
      this.settings.workingHours.days.forEach(day => {
        document.getElementById(`day${day}`).checked = true;
      });
  
      // Update time inputs
      document.getElementById('startTime').value = this.settings.workingHours.start;
      document.getElementById('endTime').value = this.settings.workingHours.end;
  
      // Update timezone dropdown
      document.getElementById('timezone').value = this.settings.workingHours.timezone || 'Asia/Makassar';
  
      // Update MCP server settings
      document.getElementById('mcpUrl').value = this.settings.mcpServer.url;
      document.getElementById('mcpEndpoint').value = this.settings.mcpServer.endpoint;
  
      // Update projects
      this.updateProjectsUI();
      
      // Update status
      this.updateStatus();
      this.updateLastReport();
    }
  
    updateStatus() {
      const indicator = document.getElementById('statusIndicator');
      const text = document.getElementById('statusText');
      
      // Get current time in working timezone for display
      const timezone = this.settings.workingHours.timezone || 'UTC';
      const now = new Date();
      const timeInTimezone = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
      const timeString = timeInTimezone.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      if (!this.settings.enabled) {
        indicator.className = 'status-indicator disabled';
        text.textContent = 'Disabled';
      } else if (this.settings.paused) {
        indicator.className = 'status-indicator paused';
        const pauseUntil = new Date(this.settings.pauseUntil);
        text.textContent = `Paused until ${pauseUntil.toLocaleTimeString()}`;
      } else if (this.isCurrentlyInWorkingHours()) {
        indicator.className = 'status-indicator active';
        text.textContent = `Active (Working Hours) - ${timeString}`;
      } else {
        indicator.className = 'status-indicator';
        text.textContent = `Inactive (Outside Working Hours) - ${timeString}`;
      }
    }
  
    updateLastReport() {
      const lastReportEl = document.getElementById('lastReport');
      if (this.settings.lastReportTime) {
        const lastReport = new Date(this.settings.lastReportTime);
        lastReportEl.textContent = `Last report: ${lastReport.toLocaleString()}`;
      } else {
        lastReportEl.textContent = 'No reports submitted yet';
      }
    }
  
    isCurrentlyInWorkingHours() {
      // Get current time in the specified timezone
      const timezone = this.settings.workingHours.timezone || 'UTC';
      const now = new Date();
      
      // Create date in the working hours timezone
      const timeInTimezone = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
      const currentDay = timeInTimezone.getDay();
      const currentTime = timeInTimezone.getHours() * 60 + timeInTimezone.getMinutes();

      if (!this.settings.workingHours.days.includes(currentDay)) return false;

      const [startHour, startMin] = this.settings.workingHours.start.split(':').map(Number);
      const [endHour, endMin] = this.settings.workingHours.end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      return currentTime >= startTime && currentTime <= endTime;
    }
  
    async saveSettings() {
      try {
        await chrome.runtime.sendMessage({
          action: 'updateSettings',
          settings: this.settings
        });
        
        this.showStatus('actionStatus', 'Settings saved successfully!', 'success');
        setTimeout(() => this.clearStatus('actionStatus'), 3000);
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.showStatus('actionStatus', 'Failed to save settings: ' + error.message, 'error');
      }
    }
  
    async testMCPConnection() {
      const statusEl = document.getElementById('connectionStatus');
      statusEl.textContent = 'Testing connection...';
      statusEl.className = '';
  
      try {
        const response = await fetch(`${this.settings.mcpServer.url}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
  
        if (response.ok) {
          this.showStatus('connectionStatus', 'Connection successful!', 'success');
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Connection test failed:', error);
        this.showStatus('connectionStatus', `Connection failed: ${error.message}`, 'error');
      }
  
      setTimeout(() => this.clearStatus('connectionStatus'), 5000);
    }
  
        async triggerManualReport() {
      try {
        // Get the active tab and show the progress modal
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          this.showStatus('actionStatus', 'No active tab found', 'error');
          return;
        }

        const activeTab = tabs[0];
        
        // Check if this is a restricted page where content scripts can't run
        if (activeTab.url.startsWith('chrome://') || 
            activeTab.url.startsWith('chrome-extension://') || 
            activeTab.url.startsWith('edge://') || 
            activeTab.url.startsWith('about:') ||
            activeTab.url.startsWith('moz-extension://')) {
          
          this.showStatus('actionStatus', 'Cannot show modal on this page. Using fallback...', 'warning');
          setTimeout(() => this.useFallbackPrompt(), 1000);
          return;
        }

        // Show loading state
        this.showStatus('actionStatus', 'Opening progress modal...', 'info');

        try {
          // Try to show the progress modal on the active tab
          const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'showProgressModal' });
          
          if (response && response.success) {
            // Modal opened successfully, close popup after a short delay
            setTimeout(() => window.close(), 500);
          } else {
            throw new Error('Modal failed to open');
          }
          
        } catch (modalError) {
          console.log('Content script not available, using fallback:', modalError);
          this.showStatus('actionStatus', 'Modal unavailable, using prompt...', 'warning');
          setTimeout(() => this.useFallbackPrompt(), 1000);
        }
        
      } catch (error) {
        console.error('Failed to trigger manual report:', error);
        this.showStatus('actionStatus', 'Error: ' + error.message, 'error');
        setTimeout(() => this.useFallbackPrompt(), 1000);
      }
    }

    async useFallbackPrompt() {
      try {
        // Fallback to simple prompt if modal fails
        const defaultProject = this.settings.defaultProject || 'GGSA';
        const progress = prompt(`Enter your progress update for ${defaultProject}:\n\nFormat examples:\n• 2h: Fixed authentication bug\n• 1.5h: Code review and testing\n• Attended team meeting (defaults to 1h)`);
        
        if (progress && progress.trim()) {
          this.showStatus('actionStatus', 'Submitting report...', 'info');
          
          await chrome.runtime.sendMessage({
            action: 'submitProgress',
            data: {
              progress: progress.trim(),
              project: defaultProject,
              timestamp: new Date().toISOString()
            }
          });
          
          this.showStatus('actionStatus', 'Report submitted successfully!', 'success');
          
          // Reload settings to update last report time
          await this.loadSettings();
          this.updateLastReport();
          
          setTimeout(() => this.clearStatus('actionStatus'), 3000);
        } else {
          this.clearStatus('actionStatus');
        }
      } catch (error) {
        console.error('Failed to submit fallback report:', error);
        this.showStatus('actionStatus', 'Failed to submit: ' + error.message, 'error');
        setTimeout(() => this.clearStatus('actionStatus'), 5000);
      }
    }
  
    async pauseTracking() {
      try {
        await chrome.runtime.sendMessage({
          action: 'pauseTracking',
          hours: 2
        });
        
        this.showStatus('actionStatus', 'Tracking paused for 2 hours', 'success');
        
        // Update settings to reflect pause
        this.settings.paused = true;
        const pauseUntil = new Date();
        pauseUntil.setHours(pauseUntil.getHours() + 2);
        this.settings.pauseUntil = pauseUntil.toISOString();
        
        this.updateStatus();
      } catch (error) {
        console.error('Failed to pause tracking:', error);
        this.showStatus('actionStatus', 'Failed to pause tracking: ' + error.message, 'error');
      }
  
      setTimeout(() => this.clearStatus('actionStatus'), 3000);
    }
  
    updateProjectsUI() {
      // Update project list
      const projectListEl = document.getElementById('projectList');
      const defaultProjectEl = document.getElementById('defaultProject');
      
      // Clear existing content
      projectListEl.innerHTML = '';
      defaultProjectEl.innerHTML = '';
      
      if (!this.settings.projects) {
        this.settings.projects = ['Nestly', 'GGSA'];
      }
      
      // Populate project list
      this.settings.projects.forEach(project => {
        // Add to project list
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.innerHTML = `
          <span class="project-name">${project}</span>
          <button class="btn small remove" onclick="window.popupController.removeProject('${project}')">Remove</button>
        `;
        projectListEl.appendChild(projectItem);
        
        // Add to default project dropdown
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        if (project === this.settings.defaultProject) {
          option.selected = true;
        }
        defaultProjectEl.appendChild(option);
      });
    }
    
    addProject() {
      const newProjectInput = document.getElementById('newProjectName');
      const projectName = newProjectInput.value.trim();
      
      if (!projectName) {
        this.showStatus('actionStatus', 'Please enter a project name', 'error');
        setTimeout(() => this.clearStatus('actionStatus'), 3000);
        return;
      }
      
      if (this.settings.projects.includes(projectName)) {
        this.showStatus('actionStatus', 'Project already exists', 'error');
        setTimeout(() => this.clearStatus('actionStatus'), 3000);
        return;
      }
      
      this.settings.projects.push(projectName);
      
      // Set as default if it's the first project
      if (!this.settings.defaultProject) {
        this.settings.defaultProject = projectName;
      }
      
      newProjectInput.value = '';
      this.updateProjectsUI();
      
      this.showStatus('actionStatus', `Project "${projectName}" added successfully`, 'success');
      setTimeout(() => this.clearStatus('actionStatus'), 3000);
    }
    
    removeProject(projectName) {
      if (this.settings.projects.length <= 1) {
        this.showStatus('actionStatus', 'Cannot remove the last project', 'error');
        setTimeout(() => this.clearStatus('actionStatus'), 3000);
        return;
      }
      
      this.settings.projects = this.settings.projects.filter(p => p !== projectName);
      
      // Update default project if removed
      if (this.settings.defaultProject === projectName) {
        this.settings.defaultProject = this.settings.projects[0];
      }
      
      this.updateProjectsUI();
      
      this.showStatus('actionStatus', `Project "${projectName}" removed`, 'success');
      setTimeout(() => this.clearStatus('actionStatus'), 3000);
    }

    showStatus(elementId, message, type) {
      const element = document.getElementById(elementId);
      element.textContent = message;
      element.className = type;
    }
  
    clearStatus(elementId) {
      const element = document.getElementById(elementId);
      element.textContent = '';
      element.className = '';
    }
  }
  
  // Initialize popup when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    window.popupController = new PopupController();
  });