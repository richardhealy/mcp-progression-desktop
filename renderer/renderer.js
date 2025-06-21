// Renderer script for MCP Progress Tracker Desktop

class DesktopProgressController {
    constructor() {
        this.settings = null;
        this.todos = [];
        this.logs = [];
        this.endOfDayShownToday = null;
        this.activityStats = {
            isMonitoring: false,
            isActive: false,
            sessionTime: 0,
            dailyActive: 0,
            dailyIdle: 0,
            totalTime: 0
        };
        this.lastActivityTime = Date.now();
        this.activityState = 'active'; // active, idle, inactive
        this.activitySessionStart = Date.now(); // Track when current activity session started
        this.uiReady = false; // Track if UI is fully initialized
        this.activityChart = null; // Chart.js instance for activity visualization
        this.activityChartData = []; // Store activity data for charting
        this.activityTimelineData = new Array(144).fill('no-data'); // 24 hours * 6 (10-minute segments) = 144 segments
        this.realTimelineData = new Map(); // Store real activity data by 10-minute segment
        this.init();
    }

    async init() {
        try {
            console.log('Initializing controller...');
            
            console.log('Loading settings...');
        await this.loadSettings();
            
            console.log('Loading todos...');
        await this.loadTodos();
            
            console.log('Setting up event listeners...');
        this.setupEventListeners();
            
            console.log('Setting up IPC listeners...');
        this.setupIPCListeners();
            
            console.log('Updating UI...');
        this.updateUI();
        this.updateTodoUI();
            
            console.log('Initializing date controls...');
            this.initializeDateControls();
            
            console.log('Starting clock updates...');
            this.startClockUpdates();
            
            console.log('Starting activity state updates...');
            this.startActivityStateUpdates();
            
            console.log('Starting real-time data updates...');
            this.startRealTimeUpdates();
            
            console.log('Loading server status...');
            await this.loadServerStatus();
            
            // Mark UI as ready
            this.uiReady = true;
            console.log('🎉 Controller initialization complete - UI ready for updates');
        } catch (error) {
            console.error('Error during controller initialization:', error);
            throw error;
        }
    }

    async loadSettings() {
        try {
            if (window.electronAPI && window.electronAPI.getSettings) {
                this.settings = await window.electronAPI.getSettings();
                console.log('Settings loaded:', this.settings);
            } else {
                console.warn('electronAPI not available, using default settings');
                this.settings = this.getDefaultSettings();
            }
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
                timezone: 'Europe/Berlin'  // Default to CET/CEST timezone
            },
            mcpServer: {
                url: 'http://localhost:8087',
                endpoint: '/add-progress'
            },
            projects: ['GGSA', 'Nestly', 'Seenspire'],
            defaultProject: 'GGSA',
            paused: false,
            lastReportTime: null
        };
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettingsModal();
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        // Close settings modal when clicking outside
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.hideSettingsModal();
            }
        });

        // Enable/disable toggle (removed from progress screen)
        const enabledToggle = document.getElementById('enabledToggle');
        if (enabledToggle) {
            enabledToggle.addEventListener('change', (e) => {
            this.settings.enabled = e.target.checked;
            this.updateStatus();
        });
        }

        // Working days checkboxes
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {
            const checkbox = document.getElementById(`day${day}`);
            checkbox.addEventListener('change', () => {
                this.updateWorkingDays();
                this.updateStatus();
            });
        });

        // Time inputs
        document.getElementById('startTime').addEventListener('change', (e) => {
            this.settings.workingHours.start = e.target.value;
            this.updateStatus();
        });

        document.getElementById('endTime').addEventListener('change', (e) => {
            this.settings.workingHours.end = e.target.value;
            this.updateStatus();
        });

        // Timezone dropdown
        document.getElementById('timezone').addEventListener('change', (e) => {
            this.settings.workingHours.timezone = e.target.value;
            this.updateStatus();
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

        document.getElementById('testNotification').addEventListener('click', () => {
            this.testNotification();
        });

        document.getElementById('testEndOfDay').addEventListener('click', () => {
            this.testEndOfDay();
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

        // Modal event listeners
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideProgressModal();
        });

        document.getElementById('progressForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitProgressReport();
        });

        document.getElementById('skipReport').addEventListener('click', () => {
            this.hideProgressModal();
        });

        // Close modal when clicking outside
        document.getElementById('progressModal').addEventListener('click', (e) => {
            if (e.target.id === 'progressModal') {
                this.hideProgressModal();
            }
        });

        // Diagnostics event listeners
        document.getElementById('testServerHealth').addEventListener('click', () => {
            this.updateDiagnosticServerStatus();
        });

        document.getElementById('testAirtableConnection').addEventListener('click', () => {
            this.testAirtableConnection();
        });

        document.getElementById('refreshDiagnostics').addEventListener('click', () => {
            this.loadDiagnostics();
        });

        document.getElementById('clearLogs').addEventListener('click', () => {
            this.logs = [];
            this.updateLogsDisplay();
            this.addLog('Logs cleared', 'info');
        });

        // To-Do event listeners
        document.getElementById('addTodo').addEventListener('click', () => {
            this.addTodo();
        });

        document.getElementById('todoDescription').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTodo();
            }
        });

        document.getElementById('filterProject').addEventListener('change', () => {
            this.updateTodoList();
        });

        document.getElementById('clearCompleted').addEventListener('click', () => {
            this.clearCompletedTodos();
        });

        // Progress Items event listeners
        document.getElementById('refreshProgress').addEventListener('click', () => {
            this.loadProgressItems();
        });

        document.getElementById('progressDateFilter').addEventListener('change', (e) => {
            // Show/hide custom date inputs based on selection
            const customDateControls = document.querySelectorAll('#customDateFrom, #customDateTo, #applyDateRange');
            const isCustom = e.target.value === 'custom';
            
            customDateControls.forEach(control => {
                control.style.display = isCustom ? 'inline-block' : 'none';
            });
            
            if (!isCustom) {
                this.loadProgressItems();
            }
        });

        // Custom date range application
        document.getElementById('applyDateRange').addEventListener('click', () => {
            document.getElementById('progressDateFilter').value = 'custom';
            this.loadProgressItems();
        });

        // Allow Enter key to apply date range
        document.getElementById('customDateFrom').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('progressDateFilter').value = 'custom';
                this.loadProgressItems();
            }
        });

        document.getElementById('customDateTo').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('progressDateFilter').value = 'custom';
                this.loadProgressItems();
            }
        });

        // Edit Progress Modal event listeners
        document.getElementById('closeEditModal').addEventListener('click', () => {
            this.hideEditModal();
        });

        document.getElementById('editProgressForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProgressItem();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.hideEditModal();
        });

        document.getElementById('deleteProgress').addEventListener('click', () => {
            if (this.currentEditingItem) {
                this.hideEditModal();
                this.deleteProgressItem(this.currentEditingItem.id);
            }
        });

        // Close edit modal when clicking outside
        document.getElementById('editProgressModal').addEventListener('click', (e) => {
            if (e.target.id === 'editProgressModal') {
                this.hideEditModal();
            }
        });

        // AI Planner event listeners
        document.getElementById('generatePlan').addEventListener('click', () => {
            this.generateWeeklyPlan();
        });

        document.getElementById('addAllTodos').addEventListener('click', () => {
            this.addAllGeneratedTodos();
        });

        document.getElementById('regeneratePlan').addEventListener('click', () => {
            this.generateWeeklyPlan();
        });

        document.getElementById('clearPlan').addEventListener('click', () => {
            this.clearGeneratedPlan();
        });

        // End of Day Modal event listeners
        document.getElementById('closeEndOfDayModal').addEventListener('click', () => {
            this.hideEndOfDayModal();
        });

        document.getElementById('selectAllTodos').addEventListener('click', () => {
            this.selectAllTodayTodos();
        });

        document.getElementById('selectNoneTodos').addEventListener('click', () => {
            this.selectNoneTodayTodos();
        });

        document.getElementById('submitSelectedTodos').addEventListener('click', () => {
            this.submitSelectedTodos();
        });

        document.getElementById('skipEndOfDay').addEventListener('click', () => {
            this.skipEndOfDayReview();
        });

        // Close end of day modal when clicking outside
        document.getElementById('endOfDayModal').addEventListener('click', (e) => {
            if (e.target.id === 'endOfDayModal') {
                this.hideEndOfDayModal();
            }
        });

        // Activity Monitor event listeners
        document.getElementById('refreshActivity').addEventListener('click', () => {
            this.refreshActivityStats();
        });

        document.getElementById('exportActivity').addEventListener('click', () => {
            this.exportActivityData();
        });

        document.getElementById('activitySettings').addEventListener('click', () => {
            this.showActivitySettings();
        });



        // Native activity monitoring event listeners
        document.getElementById('testNativeActivity')?.addEventListener('click', () => {
            this.testNativeActivity();
        });

        document.getElementById('resetNativeStats')?.addEventListener('click', () => {
            this.resetNativeStats();
        });

        document.getElementById('refreshNativeStats')?.addEventListener('click', () => {
            this.refreshNativeStats();
        });

        document.getElementById('resetKeypressStats')?.addEventListener('click', () => {
            this.resetKeypressStats();
        });

        document.getElementById('refreshKeypressStats')?.addEventListener('click', () => {
            this.refreshKeypressStats();
        });
    }

    setupIPCListeners() {
        if (!window.electronAPI) return;

        // Listen for progress dialog requests
        window.electronAPI.onShowProgressDialog(() => {
            this.showProgressModal();
        });

        // Listen for submit report now requests
        window.electronAPI.onSubmitReportNow(() => {
            this.showProgressModal();
        });

        // Listen for tracking status changes
        window.electronAPI.onTrackingStatusChanged((event, trackingStatus) => {
            this.settings.paused = trackingStatus.isPaused;
            this.settings.enabled = trackingStatus.isEnabled;
            this.updateUI();
        });

        // Listen for server status changes
        window.electronAPI.onServerStatus((event, serverStatus) => {
            this.updateServerStatus(serverStatus);
        });

        // Listen for activity updates
        window.electronAPI.onActivityUpdate((event, activityData) => {
            this.updateActivityStats(activityData);
        });

        // Listen for native activity events
        window.electronAPI.onNativeActivity((event, data) => {
            console.log('✅ Native activity detected in renderer:', data);
            this.updateNativeActivityDisplay(data);
            
            // Update activity overview stats when native activity is detected
            this.updateActivityOverviewFromNativeActivity(data);
        });

        window.electronAPI.onActivityStatusChanged((event, data) => {
            console.log('✅ Activity status changed in renderer:', data);
            this.updateActivityStatusDisplay(data);
            
            // Update activity overview when status changes
            this.updateActivityOverviewFromStatusChange(data);
            
            // Update timeline and chart when status changes - but use the native state
            this.updateActivityTimeline({ isActive: data.isActive, status: data.isActive ? 'active' : 'inactive' });
            this.updateActivityChart({ isActive: data.isActive });
            this.updateActivityBreakdown();
        });
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Handle different tab content IDs
        let tabContentId;
        if (tabName === 'todos') {
            tabContentId = 'todosTab';
        } else if (tabName === 'progress') {
            tabContentId = 'progressTab';
        } else if (tabName === 'planner') {
            tabContentId = 'planner-tab';
        } else if (tabName === 'activity') {
            tabContentId = 'activityTab';
        } else if (tabName === 'logs') {
            tabContentId = 'logsTab';
        }
        
        if (tabContentId) {
            document.getElementById(tabContentId).classList.add('active');
        }

        // Load progress items when switching to progress tab
        if (tabName === 'progress') {
            this.loadProgressItems();
        }
        
        // Initialize custom date controls visibility
        if (tabName === 'progress') {
            this.initializeDateControls();
        }

        // Load diagnostics when switching to logs tab
        if (tabName === 'logs') {
            this.loadDiagnostics();
        }

        // Initialize planner tab when switching to it
        if (tabName === 'planner') {
            this.initializePlannerTab();
        }

        // Initialize activity tab when switching to it
        if (tabName === 'activity') {
            this.initializeActivityTab();
        }
    }

    showSettingsModal() {
        document.getElementById('settingsModal').classList.add('show');
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').classList.remove('show');
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
        if (!this.settings) {
            console.warn('Settings not loaded yet, skipping UI update');
            return;
        }

        try {
        // Update enabled toggle
                    // Update enabled toggle if it exists (removed from progress screen)
            const enabledToggle = document.getElementById('enabledToggle');
            if (enabledToggle) {
                enabledToggle.checked = this.settings.enabled;
            }

        // Update working days
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {
                const checkbox = document.getElementById(`day${day}`);
                if (checkbox && this.settings.workingHours && this.settings.workingHours.days) {
                    checkbox.checked = this.settings.workingHours.days.includes(day);
                }
        });

        // Update time inputs
            const startTime = document.getElementById('startTime');
            const endTime = document.getElementById('endTime');
            if (startTime && this.settings.workingHours) {
                startTime.value = this.settings.workingHours.start || '09:00';
            }
            if (endTime && this.settings.workingHours) {
                endTime.value = this.settings.workingHours.end || '17:00';
            }

        // Update timezone dropdown
            const timezone = document.getElementById('timezone');
            if (timezone && this.settings.workingHours) {
                timezone.value = this.settings.workingHours.timezone || 'Europe/Berlin';
            }

        // Update MCP server settings
            const mcpUrl = document.getElementById('mcpUrl');
            const mcpEndpoint = document.getElementById('mcpEndpoint');
            if (mcpUrl && this.settings.mcpServer) {
                mcpUrl.value = this.settings.mcpServer.url || 'http://localhost:8080';
            }
            if (mcpEndpoint && this.settings.mcpServer) {
                mcpEndpoint.value = this.settings.mcpServer.endpoint || '/add-progress';
            }

        // Update projects
        this.updateProjectsUI();

        // Update status
        this.updateStatus();
        this.updateLastReport();
        
        // Update to-do UI after projects are loaded
        this.updateTodoUI();
            
            console.log('UI updated successfully');
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }

    updateStatus() {
        // Status elements removed from progress screen, but may exist in header
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        const statusLabel = document.getElementById('statusLabel');

        // Get current time in working timezone for display
        const timezone = this.settings.workingHours.timezone || 'UTC';
        const now = new Date();
        const timeString = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(now);

        let statusClass = '';
        let detailedStatus = '';
        let simpleStatus = '';

        if (!this.settings.enabled) {
            statusClass = 'disabled';
            detailedStatus = 'Disabled';
            simpleStatus = 'Disabled';
        } else if (this.settings.paused) {
            statusClass = 'paused';
            if (this.settings.pauseUntil && !isNaN(new Date(this.settings.pauseUntil).getTime())) {
            const pauseUntil = new Date(this.settings.pauseUntil);
            detailedStatus = `Paused until ${pauseUntil.toLocaleTimeString()}`;
            } else {
                detailedStatus = 'Paused';
            }
            simpleStatus = 'Paused';
        } else if (this.isCurrentlyInWorkingHours()) {
            statusClass = 'active';
            detailedStatus = `Active (Working Hours) - ${timeString}`;
            simpleStatus = 'Active';
        } else {
            statusClass = '';
            detailedStatus = `Inactive (Outside Working Hours) - ${timeString}`;
            simpleStatus = 'Inactive';
        }

        // Update progress tab status (detailed)
        if (indicator) {
            indicator.className = `status-indicator ${statusClass}`;
        }
        if (text) {
            text.textContent = detailedStatus;
        }

        // Don't update header status badge here - it's managed by activity status
        // The activity status (active/idle/inactive) takes precedence over working hours status

        // Update current time display
        this.updateCurrentTimeDisplay();

        // Check for end of day
        this.checkEndOfDay();
    }

    async loadServerStatus() {
        try {
            if (window.electronAPI && window.electronAPI.getServerStatus) {
                const serverStatus = await window.electronAPI.getServerStatus();
                console.log('Loaded server status:', serverStatus);
                this.updateServerStatus(serverStatus);
            }
        } catch (error) {
            console.error('Failed to load server status:', error);
            this.updateServerStatus({ healthy: false, message: 'Failed to get server status' });
        }
    }

    updateServerStatus(serverStatus) {
        const serverStatusDot = document.getElementById('serverStatusDot');
        const serverStatusLabel = document.getElementById('serverStatusLabel');

        console.log('Updating server status UI:', serverStatus);

        if (serverStatus.healthy) {
            serverStatusDot.className = 'status-dot active';
            serverStatusLabel.textContent = 'Server OK';
            this.addLog('Server status updated: Running', 'success');
        } else {
            serverStatusDot.className = 'status-dot disabled';
            serverStatusLabel.textContent = 'Server Error';
            this.addLog(`Server status updated: Error - ${serverStatus.message}`, 'error');
            
            // Show error message in progress tab if it's active
            const progressTab = document.getElementById('progressTab');
            if (progressTab && progressTab.classList.contains('active')) {
                this.showStatus('progressStatus', `Server Error: ${serverStatus.message}`, 'error');
            }
        }
    }

    updateLastReport() {
        // Last report element removed from progress screen
        const lastReportEl = document.getElementById('lastReport');
        if (lastReportEl) {
        if (this.settings.lastReportTime) {
            const lastReport = new Date(this.settings.lastReportTime);
            lastReportEl.textContent = `Last report: ${lastReport.toLocaleString()}`;
        } else {
            lastReportEl.textContent = 'No reports submitted yet';
            }
        }
    }

    isCurrentlyInWorkingHours() {
        const timezone = this.settings.workingHours.timezone || 'UTC';
        const now = new Date();
        
        // Properly get time in the target timezone
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

        console.log('Debug time info:', {
            timezone,
            dayName,
            currentDay,
            hour,
            minute,
            currentTime,
            workingDays: this.settings.workingHours.days,
            workingHours: `${this.settings.workingHours.start} - ${this.settings.workingHours.end}`
        });

        if (!this.settings.workingHours.days.includes(currentDay)) return false;

        const [startHour, startMin] = this.settings.workingHours.start.split(':').map(Number);
        const [endHour, endMin] = this.settings.workingHours.end.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return currentTime >= startTime && currentTime <= endTime;
    }

    gatherSettingsFromForm() {
        try {
            console.log('Gathering settings from form inputs...');
            
            // Enabled toggle (removed from progress screen, keep existing setting)
            const enabledToggle = document.getElementById('enabledToggle');
            if (enabledToggle) {
                this.settings.enabled = enabledToggle.checked;
                console.log('Enabled:', this.settings.enabled);
            }

            // Working hours
            const startTime = document.getElementById('startTime');
            const endTime = document.getElementById('endTime');
            const timezone = document.getElementById('timezone');
            
            if (startTime) {
                this.settings.workingHours.start = startTime.value;
                console.log('Start time:', this.settings.workingHours.start);
            }
            if (endTime) {
                this.settings.workingHours.end = endTime.value;
                console.log('End time:', this.settings.workingHours.end);
            }
            if (timezone) {
                this.settings.workingHours.timezone = timezone.value;
                console.log('Timezone:', this.settings.workingHours.timezone);
            }

            // Working days
            this.updateWorkingDays();
            console.log('Working days:', this.settings.workingHours.days);

            // MCP Server settings
            const mcpUrl = document.getElementById('mcpUrl');
            const mcpEndpoint = document.getElementById('mcpEndpoint');
            
            if (mcpUrl) {
                this.settings.mcpServer.url = mcpUrl.value;
                console.log('MCP URL:', this.settings.mcpServer.url);
            }
            if (mcpEndpoint) {
                this.settings.mcpServer.endpoint = mcpEndpoint.value;
                console.log('MCP Endpoint:', this.settings.mcpServer.endpoint);
            }

            // Default project
            const defaultProject = document.getElementById('defaultProject');
            if (defaultProject) {
                this.settings.defaultProject = defaultProject.value;
                console.log('Default project:', this.settings.defaultProject);
            }

            console.log('Final gathered settings:', JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('Error gathering settings from form:', error);
        }
    }

    async saveSettings() {
        this.setButtonLoading('saveSettings', true);
        try {
            console.log('Starting to save settings...');
            
            // First, gather all current form values
            this.gatherSettingsFromForm();
            
            console.log('Current settings object:', JSON.stringify(this.settings, null, 2));
            
            // Validate required fields before saving
            if (!this.settings.workingHours) {
                throw new Error('Working hours settings are missing');
            }
            if (!this.settings.mcpServer) {
                throw new Error('MCP server settings are missing');
            }
            if (!this.settings.projects || this.settings.projects.length === 0) {
                throw new Error('At least one project is required');
            }
            
            this.showStatus('settingsStatus', 'Saving settings...', 'info');
            
            if (window.electronAPI && window.electronAPI.saveSettings) {
                console.log('Calling electronAPI.saveSettings...');
                const savedSettings = await window.electronAPI.saveSettings(this.settings);
                console.log('Received saved settings back:', savedSettings);
                
                // Update local settings with what was actually saved
                this.settings = savedSettings;
                
                this.showStatus('settingsStatus', 'Settings saved successfully!', 'success');
                console.log('Settings saved successfully');
                
                // Auto-clear success message after 3 seconds
                setTimeout(() => {
                    this.clearStatus('settingsStatus');
                }, 3000);
            } else {
                console.warn('electronAPI.saveSettings not available');
                this.showStatus('settingsStatus', 'Settings API not available', 'error');
            }
            
            // Immediately update status to reflect new settings
            this.updateStatus();
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showStatus('settingsStatus', `Failed to save settings: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('saveSettings', false);
        }
    }

    async testMCPConnection() {
        this.setButtonLoading('testConnection', true);
        this.showStatus('connectionStatus', 'Testing connection...', 'info');
        
        try {
            let result;
            if (window.electronAPI && window.electronAPI.testServerConnection) {
                result = await window.electronAPI.testServerConnection();
            } else {
                // Fallback for web version
                const response = await fetch(`${this.settings.mcpServer.url}/health`);
                result = { success: response.ok, status: response.status };
            }
            
            if (result.success) {
                this.showStatus('connectionStatus', 'Connection successful!', 'success');
            } else {
                this.showStatus('connectionStatus', `Connection failed: ${result.error || result.status}`, 'error');
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            this.showStatus('connectionStatus', 'Connection test failed', 'error');
        } finally {
            this.setButtonLoading('testConnection', false);
        }
    }

    async testNotification() {
        this.setButtonLoading('testNotification', true);
        try {
            if (window.electronAPI && window.electronAPI.testNotification) {
                await window.electronAPI.testNotification();
                this.showStatus('connectionStatus', 'Test notification sent!', 'success');
            } else {
                this.showStatus('connectionStatus', 'Notification API not available', 'error');
            }
        } catch (error) {
            console.error('Notification test failed:', error);
            this.showStatus('connectionStatus', 'Notification test failed', 'error');
        } finally {
            this.setButtonLoading('testNotification', false);
        }
    }

    async testEndOfDay() {
        this.setButtonLoading('testEndOfDay', true);
        try {
            // Reset the shown today flag to allow testing
            this.endOfDayShownToday = null;
            
            // Force show the end of day modal
            this.showEndOfDayModal();
            
            this.addLog('End of day modal test triggered', 'success');
            this.showStatus('connectionStatus', 'End of day modal test triggered!', 'success');
        } catch (error) {
            console.error('Test end of day failed:', error);
            this.showStatus('connectionStatus', 'Test end of day failed', 'error');
        } finally {
            this.setButtonLoading('testEndOfDay', false);
        }
    }

    async triggerManualReport() {
        this.setButtonLoading('triggerReport', true);
        this.showProgressModal();
        // Reset loading state when modal is shown
        setTimeout(() => {
            this.setButtonLoading('triggerReport', false);
        }, 500);
    }

    async pauseTracking() {
        this.setButtonLoading('pauseTracking', true);
        try {
            this.settings.paused = !this.settings.paused;
            
            if (this.settings.paused) {
                // When pausing, set pause until 2 hours from now
                const pauseUntil = new Date();
                pauseUntil.setHours(pauseUntil.getHours() + 2);
                this.settings.pauseUntil = pauseUntil.toISOString();
            } else {
                // When resuming, clear the pause until time
                this.settings.pauseUntil = null;
            }
            
            await this.saveSettings();
            
            const status = this.settings.paused ? 'Tracking paused for 2 hours' : 'Tracking resumed';
            this.showStatus('controlStatus', status, 'info');
            this.updateStatus();
        } catch (error) {
            console.error('Failed to toggle tracking:', error);
            this.showStatus('controlStatus', 'Failed to toggle tracking', 'error');
        } finally {
            this.setButtonLoading('pauseTracking', false);
        }
    }

    updateProjectsUI() {
        const projectsList = document.getElementById('projectsList');
        const defaultProjectSelect = document.getElementById('defaultProject');
        
        // Clear existing options
        defaultProjectSelect.innerHTML = '';
        projectsList.innerHTML = '';

        // Add projects to dropdown and list
        this.settings.projects.forEach(project => {
            // Add to dropdown
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            if (project === this.settings.defaultProject) {
                option.selected = true;
            }
            defaultProjectSelect.appendChild(option);

            // Add to project list
            const projectTag = document.createElement('div');
            projectTag.className = `project-tag ${project === this.settings.defaultProject ? 'default' : ''}`;
            projectTag.innerHTML = `
                ${project}
                <span class="project-remove" onclick="controller.removeProject('${project}')">&times;</span>
            `;
            projectsList.appendChild(projectTag);
        });
    }

    addProject() {
        const newProjectInput = document.getElementById('newProject');
        const projectName = newProjectInput.value.trim();

        if (projectName && !this.settings.projects.includes(projectName)) {
            this.settings.projects.push(projectName);
            newProjectInput.value = '';
            this.updateProjectsUI();
            this.showStatus('projectStatus', `Project "${projectName}" added`, 'success');
        } else if (projectName) {
            this.showStatus('projectStatus', 'Project already exists', 'error');
        }
    }

    removeProject(projectName) {
        if (this.settings.projects.length <= 1) {
            this.showStatus('projectStatus', 'Cannot remove all projects', 'error');
            return;
        }

        this.settings.projects = this.settings.projects.filter(p => p !== projectName);
        
        if (this.settings.defaultProject === projectName) {
            this.settings.defaultProject = this.settings.projects[0];
        }
        
        this.updateProjectsUI();
        this.showStatus('projectStatus', `Project "${projectName}" removed`, 'info');
    }

    showProgressModal() {
        const modal = document.getElementById('progressModal');
        const projectButtons = document.getElementById('modalProjectButtons');
        
        // Clear and populate project buttons
        projectButtons.innerHTML = '';
        this.settings.projects.forEach(project => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `project-btn ${project === this.settings.defaultProject ? 'active' : ''}`;
            button.textContent = project;
            button.onclick = () => this.selectModalProject(button, project);
            projectButtons.appendChild(button);
        });

        // Reset form
        document.getElementById('modalHours').value = '1';
        document.getElementById('modalDescription').value = '';
        
        // Set current time as default
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
        document.getElementById('modalTime').value = currentTime;
        
        this.clearStatus('modalStatus');

        modal.style.display = 'block';
    }

    hideProgressModal() {
        document.getElementById('progressModal').style.display = 'none';
    }

    selectModalProject(button, project) {
        // Remove active class from all buttons
        document.querySelectorAll('.project-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        button.dataset.selected = project;
    }

    async submitProgressReport() {
        this.setButtonLoading('submitProgressBtn', true);
        const selectedProject = document.querySelector('.project-btn.active')?.textContent || this.settings.defaultProject;
        const hours = parseFloat(document.getElementById('modalHours').value);
        const rawDescription = document.getElementById('modalDescription').value.trim();
        const description = this.removeEmojis(rawDescription);
        const time = document.getElementById('modalTime').value;

        if (!description) {
            this.showStatus('modalStatus', 'Please enter a description', 'error');
            this.setButtonLoading('submitProgressBtn', false);
            return;
        }

        if (!time) {
            this.showStatus('modalStatus', 'Please enter a time', 'error');
            this.setButtonLoading('submitProgressBtn', false);
            return;
        }

        // Create date with specified time, defaulting to today
        const today = new Date().toISOString().split('T')[0];
        const combinedDateTime = new Date(today + 'T' + time).toISOString();

        const progressData = {
            project: selectedProject,
            hours: hours,
            description: description,
            date: combinedDateTime
        };

        this.showStatus('modalStatus', 'Submitting progress...', 'info');

        try {
            this.addLog(`Submitting progress: ${hours}h for ${selectedProject} - ${description}`, 'info');
            const result = await window.electronAPI.submitProgress(progressData);
            
            if (result.success) {
                this.addLog('Progress submitted successfully to Airtable', 'success');
                this.showStatus('modalStatus', 'Progress submitted successfully!', 'success');
                setTimeout(() => {
                    this.hideProgressModal();
                }, 1500);
            } else {
                this.addLog(`Progress submission failed: ${result.error}`, 'error');
                this.showStatus('modalStatus', `Failed to submit: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to submit progress:', error);
            this.addLog(`Progress submission error: ${error.message}`, 'error');
            this.showStatus('modalStatus', 'Failed to submit progress', 'error');
        } finally {
            this.setButtonLoading('submitProgressBtn', false);
        }
    }

    showStatus(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.className = `status-message ${type}`;
        element.style.display = 'block';
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => this.clearStatus(elementId), 3000);
        }
    }

    clearStatus(elementId) {
        const element = document.getElementById(elementId);
        element.style.display = 'none';
        element.textContent = '';
        element.className = 'status-message';
    }

    // ==================== LOADING STATE MANAGEMENT ====================

    setButtonLoading(buttonId, loading = true) {
        const button = document.getElementById(buttonId);
        if (button) {
            if (loading) {
                button.classList.add('loading');
                button.disabled = true;
            } else {
                button.classList.remove('loading');
                button.disabled = false;
            }
        }
    }

    setButtonsLoading(buttonIds, loading = true) {
        buttonIds.forEach(id => this.setButtonLoading(id, loading));
    }

    // ==================== TEXT PROCESSING ====================

    removeEmojis(text) {
        // Remove emojis using regex that matches most emoji ranges
        return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE0F}]|[\u{200D}]/gu, '').trim();
    }

    // ==================== TO-DO MANAGEMENT ====================

    async loadTodos() {
        try {
            const stored = localStorage.getItem('mcp-todos');
            this.todos = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading todos:', error);
            this.todos = [];
        }
    }

    saveTodos() {
        try {
            localStorage.setItem('mcp-todos', JSON.stringify(this.todos));
        } catch (error) {
            console.error('Error saving todos:', error);
        }
    }

    addTodo() {
        const project = document.getElementById('todoProject').value;
        const rawDescription = document.getElementById('todoDescription').value.trim();
        const description = this.removeEmojis(rawDescription);
        const date = document.getElementById('todoDate').value;
        const time = document.getElementById('todoTime').value;
        const hours = parseFloat(document.getElementById('todoHours').value);

        if (!description) {
            alert('Please enter a task description');
            return;
        }

        if (!project) {
            alert('Please select a project');
            return;
        }

        const todo = {
            id: Date.now() + Math.random(), // Simple unique ID
            project: project,
            description: description,
            date: date || new Date().toISOString().split('T')[0],
            time: time || '09:00',
            hours: hours || 1,
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
        };

        this.todos.push(todo);
        this.saveTodos();
        this.updateTodoList();

        // Clear form
        document.getElementById('todoDescription').value = '';
        document.getElementById('todoTime').value = '';
        document.getElementById('todoHours').value = '';

        // Show a brief success message
        if (window.electronAPI && window.electronAPI.showNotification) {
            window.electronAPI.showNotification('To-do added successfully!');
        }
    }

    updateTodoUI() {
        // Update project dropdowns for to-dos
        const todoProjectSelect = document.getElementById('todoProject');
        const todoFilterSelect = document.getElementById('filterProject');
        
        // Clear existing options
        todoProjectSelect.innerHTML = '';
        todoFilterSelect.innerHTML = '<option value="all">All Projects</option>';

        // Add projects
        this.settings.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            if (project === this.settings.defaultProject) {
                option.selected = true;
            }
            todoProjectSelect.appendChild(option);

            const filterOption = document.createElement('option');
            filterOption.value = project;
            filterOption.textContent = project;
            todoFilterSelect.appendChild(filterOption);
        });

        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('todoDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
        }

        this.updateTodoList();
    }

    updateTodoList() {
        const filterProject = document.getElementById('filterProject').value;
        const todoList = document.getElementById('todoList');
        
        // Filter todos
        let filteredTodos = this.todos;
        if (filterProject && filterProject !== 'all') {
            filteredTodos = this.todos.filter(todo => todo.project === filterProject);
        }

        // Sort todos: incomplete first, then by date/time
        filteredTodos.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            const aDateTime = new Date(`${a.date}T${a.time}`);
            const bDateTime = new Date(`${b.date}T${b.time}`);
            return aDateTime - bDateTime;
        });

        if (filteredTodos.length === 0) {
            const emptyMessage = filterProject && filterProject !== 'all' 
                ? `📋 No to-dos found for ${filterProject}. Try a different filter or add new tasks above!`
                : '🎯 No to-dos yet. Add your first task above!';
            todoList.innerHTML = `<div class="todo-empty">${emptyMessage}</div>`;
            return;
        }

        todoList.innerHTML = filteredTodos.map(todo => {
            const formattedDate = new Date(todo.date).toLocaleDateString();
            const formattedTime = todo.time;
            
            return `
                <div class="todo-item ${todo.completed ? 'completed' : ''}">
                    <div class="todo-content">
                        <div class="todo-description">${todo.description}</div>
                        <div class="todo-meta">
                            <span class="todo-project">${todo.project}</span>
                            <span>📅 ${formattedDate}</span>
                            <span>⏰ ${formattedTime}</span>
                            <span>⏱️ ${todo.hours}h</span>
                            ${todo.completed ? `<span>✅ Completed ${new Date(todo.completedAt).toLocaleString()}</span>` : ''}
                        </div>
                    </div>
                    <div class="todo-actions">
                        ${todo.completed ? 
                            `<button class="todo-btn undo" onclick="controller.undoTodo('${todo.id}')">Undo</button>` :
                            `<button class="todo-btn done" onclick="controller.completeTodo('${todo.id}')">Done</button>`
                        }
                        <button class="todo-btn delete" onclick="controller.deleteTodo('${todo.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async completeTodo(todoId) {
        const todo = this.todos.find(t => t.id == todoId);
        if (!todo) return;

        // Mark as completed
        todo.completed = true;
        todo.completedAt = new Date().toISOString();

        // Convert to progress report
        const cleanDescription = this.removeEmojis(todo.description);
        const progressData = {
            project: todo.project,
            hours: todo.hours,
            description: cleanDescription,
            date: todo.date
        };

        try {
            if (window.electronAPI && window.electronAPI.submitProgress) {
                this.addLog(`Completing todo: ${todo.hours}h for ${todo.project} - ${todo.description}`, 'info');
                const result = await window.electronAPI.submitProgress(progressData);
                
                if (result.success) {
                    this.addLog('Todo completed and submitted to Airtable successfully', 'success');
                    if (window.electronAPI && window.electronAPI.showNotification) {
                        window.electronAPI.showNotification('Task completed and added to progress report!');
                    }
                } else {
                    this.addLog(`Todo completion submission failed: ${result.error}`, 'error');
                    if (window.electronAPI && window.electronAPI.showNotification) {
                        window.electronAPI.showNotification(`Task marked done, but progress submission failed: ${result.error}`);
                    }
                }
            } else {
                this.addLog('Todo marked as done but progress API not available', 'warning');
                if (window.electronAPI && window.electronAPI.showNotification) {
                    window.electronAPI.showNotification('Task marked as done (progress API not available)');
                }
            }
        } catch (error) {
            console.error('Error submitting progress:', error);
            this.addLog(`Todo completion error: ${error.message}`, 'error');
            if (window.electronAPI && window.electronAPI.showNotification) {
                window.electronAPI.showNotification('Task marked done, but progress submission failed');
            }
        }

        this.saveTodos();
        this.updateTodoList();
    }

    undoTodo(todoId) {
        const todo = this.todos.find(t => t.id == todoId);
        if (!todo) return;

        todo.completed = false;
        todo.completedAt = null;

        this.saveTodos();
        this.updateTodoList();
        this.showStatus('todoStatus', 'Task marked as pending', 'info');
    }

    deleteTodo(todoId) {
        if (!confirm('Are you sure you want to delete this to-do?')) return;

        this.todos = this.todos.filter(t => t.id != todoId);
        this.saveTodos();
        this.updateTodoList();
        this.showStatus('todoStatus', 'To-do deleted', 'info');
    }

    clearCompletedTodos() {
        const completedCount = this.todos.filter(t => t.completed).length;
        if (completedCount === 0) {
            this.showStatus('todoStatus', 'No completed to-dos to clear', 'info');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${completedCount} completed to-do(s)?`)) return;

        this.todos = this.todos.filter(t => !t.completed);
        this.saveTodos();
        this.updateTodoList();
        this.showStatus('todoStatus', `${completedCount} completed to-do(s) cleared`, 'success');
    }

    // Clock and time management
    startClockUpdates() {
        // Update immediately
        this.updateCurrentTimeDisplay();
        
        // Update every second
        setInterval(() => {
            this.updateCurrentTimeDisplay();
        }, 1000);
        
        // Update status every minute
        setInterval(() => {
            this.updateStatus();
        }, 60000);
    }

    startActivityStateUpdates() {
        // Check activity state every 10 seconds to update state transitions
        setInterval(() => {
            const now = Date.now();
            const timeSinceActivity = now - this.lastActivityTime;
            const tenSeconds = 10 * 1000;
            const fiveMinutes = 5 * 60 * 1000;
            
            console.log(`🔄 State check: Current=${this.activityState}, TimeSinceActivity=${Math.round(timeSinceActivity/1000)}s, LastActivity=${new Date(this.lastActivityTime).toLocaleTimeString()}`);
            
            let stateChanged = false;
            let newState = this.activityState;
            
            // Only handle idle → inactive transition here
            // Active → idle transition is handled by the native activity monitor
            if (this.activityState === 'idle' && timeSinceActivity >= fiveMinutes) {
                console.log('🔄 Transitioning from idle to inactive after 5 minutes');
                newState = 'inactive';
                stateChanged = true;
            }
            
            // Update state and UI if changed
            if (stateChanged) {
                this.activityState = newState;
                this.updateStatusDisplay();
                
                // Also update timeline with new state
                this.updateCurrentSegmentState();
                
                console.log(`✅ State changed to: ${newState}`);
            }
        }, 10000); // Check every 10 seconds
        
        // Refresh activity stats every minute to prevent flickering
        setInterval(() => {
            if (this.uiReady) {
                this.refreshActivityStats();
            }
        }, 60000); // Every minute
    }

    startRealTimeUpdates() {
        // Update timeline and chart data every minute
        setInterval(() => {
            if (this.uiReady) {
                // Save current timeline data
                this.saveRealTimelineData();
                this.saveChartData();
                
                // Update breakdown with latest data
                this.updateActivityBreakdown();
                
                // Fill in any missing segments based on current state
                this.fillMissingSegments();
                
                console.log('📊 Real-time data saved and updated');
            }
        }, 60000); // Every minute
        
        // Refresh timeline display every 10 seconds to show current segment
        setInterval(() => {
            if (this.uiReady) {
                this.refreshTimelineDisplay();
                // Also update current segment state based on time since last activity
                this.updateCurrentSegmentState();
            }
        }, 10000); // Every 10 seconds
        
        console.log('📊 Real-time updates started');
    }

    updateCurrentTimeDisplay() {
        const timezone = this.settings.workingHours.timezone || 'UTC';
        const now = new Date();
        
        // Format current time for display
        const currentTime = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }).format(now);

        // Update current time display elements
        const currentTimeElement = document.getElementById('currentTime');
        const timezoneElement = document.getElementById('currentTimezone');
        
        if (currentTimeElement) {
            currentTimeElement.textContent = currentTime;
        }
        
        if (timezoneElement) {
            timezoneElement.textContent = timezone;
        }
    }

    // Progress Items Management
    async loadProgressItems() {
        this.setButtonLoading('refreshProgress', true);
        try {
            this.showStatus('progressStatus', 'Loading progress items...', 'info');
            
            if (window.electronAPI && window.electronAPI.getProgressItems) {
                const items = await window.electronAPI.getProgressItems();
                
                if (items && items.length > 0) {
                    this.displayProgressItems(items);
                    this.showStatus('progressStatus', `Loaded ${items.length} progress items`, 'success');
                    setTimeout(() => this.clearStatus('progressStatus'), 3000);
                } else if (items && items.length === 0) {
                    this.displayProgressItems([]);
                    this.showStatus('progressStatus', 'No progress items found', 'info');
                    setTimeout(() => this.clearStatus('progressStatus'), 3000);
                } else {
                    // Server might not be running
                    const tbody = document.getElementById('progressTableBody');
                    if (tbody) {
                        tbody.innerHTML = `
                            <tr class="error-state">
                                <td colspan="5" class="error-state">
                                    ⚠️ Unable to load progress items. Please check if the server is running.
                                    <br><small>Check the server status indicator in the header.</small>
                                </td>
                            </tr>
                        `;
                    }
                    this.showStatus('progressStatus', 'Server not responding - check server status', 'error');
                }
            } else {
                this.showStatus('progressStatus', 'Progress API not available', 'error');
            }
        } catch (error) {
            console.error('Failed to load progress items:', error);
            
            const tbody = document.getElementById('progressTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr class="error-state">
                        <td colspan="5" class="error-state">
                            ❌ Failed to load progress items: ${error.message}
                            <br><small>The HTTP server may not be running. Check the server status in the header.</small>
                        </td>
                    </tr>
                `;
            }
            
            this.showStatus('progressStatus', `Failed to load progress items: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('refreshProgress', false);
        }
    }

    displayProgressItems(items) {
        const tbody = document.getElementById('progressTableBody');
        if (!tbody) return;

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="5" class="empty-state">
                        📊 No progress items found. Submit some progress reports to see them here!
                    </td>
                </tr>
            `;
            return;
        }

        // Apply date filter
        const dateFilter = document.getElementById('progressDateFilter').value;
        let filteredItems = this.filterProgressItems(items, dateFilter);

        // Sort by date descending (most recent first)
        filteredItems = filteredItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Update summary
        this.updateProgressSummary(filteredItems, dateFilter);

        tbody.innerHTML = filteredItems.map(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString();
            
            // Handle time display - check if we have a valid time
            let formattedTime;
            if (isNaN(date.getTime())) {
                // If date is invalid, try to parse it differently
                formattedTime = 'Invalid time';
            } else if (item.date.includes('T') || item.date.includes(' ')) {
                // Has time component
                formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                // Date only, show as "All day"
                formattedTime = 'All day';
            }
            
            return `
                <tr>
                    <td class="date-cell">
                        ${formattedDate}<br>
                        <small>${formattedTime}</small>
                    </td>
                    <td class="project-cell">${item.project || 'GGSA'}</td>
                    <td class="hours-cell">${item.hours}h</td>
                    <td class="description-cell">${item.description}</td>
                    <td class="actions-cell">
                        <button class="action-btn edit" onclick="controller.editProgressItem('${item.id}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            ✏️ Edit
                        </button>
                        <button class="action-btn delete" onclick="controller.deleteProgressItem('${item.id}')">
                            🗑️ Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    filterProgressItems(items, filter) {
        const now = new Date();
        
        // Check if we're using custom date range
        if (filter === 'custom') {
            const fromDate = document.getElementById('customDateFrom').value;
            const toDate = document.getElementById('customDateTo').value;
            
            if (fromDate || toDate) {
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    const fromCheck = fromDate ? itemDate >= new Date(fromDate) : true;
                    const toCheck = toDate ? itemDate <= new Date(toDate + ' 23:59:59') : true;
                    return fromCheck && toCheck;
                });
            }
        }
        
        switch (filter) {
            case 'today':
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate.toDateString() === now.toDateString();
                });
            
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= weekStart;
                });
            
            case 'lastWeek':
                const lastWeekStart = new Date(now);
                lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
                lastWeekStart.setHours(0, 0, 0, 0);
                
                const lastWeekEnd = new Date(lastWeekStart);
                lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
                lastWeekEnd.setHours(23, 59, 59, 999);
                
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= lastWeekStart && itemDate <= lastWeekEnd;
                });
            
            case 'month':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= monthStart;
                });
            
            case 'lastMonth':
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                lastMonthEnd.setHours(23, 59, 59, 999);
                
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= lastMonthStart && itemDate <= lastMonthEnd;
                });
            
            case 'quarter':
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= quarterStart;
                });
            
            case 'year':
                const yearStart = new Date(now.getFullYear(), 0, 1);
                
                return items.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= yearStart;
                });
            
            default: // 'all'
                return items;
        }
    }

    editProgressItem(id, item) {
        this.currentEditingItem = { id, ...item };
        
        // Populate the edit form
        document.getElementById('editProject').value = item.project || 'GGSA';
        document.getElementById('editHours').value = item.hours;
        document.getElementById('editDescription').value = item.description;
        
        // Format date and time for inputs
        const date = new Date(item.date);
        let formattedDate, formattedTime;
        
        if (isNaN(date.getTime())) {
            // Invalid date, use current date/time as fallback
            const now = new Date();
            formattedDate = now.toISOString().split('T')[0];
            formattedTime = now.toTimeString().split(' ')[0].substring(0, 5);
        } else {
            formattedDate = date.toISOString().split('T')[0];
            if (item.date.includes('T') || item.date.includes(' ')) {
                // Has time component
                formattedTime = date.toTimeString().split(' ')[0].substring(0, 5);
            } else {
                // Date only, use current time as default
                formattedTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
            }
        }
        
        document.getElementById('editDate').value = formattedDate;
        document.getElementById('editTime').value = formattedTime;
        
        // Show the modal
        document.getElementById('editProgressModal').style.display = 'block';
    }

    async saveProgressItem() {
        this.setButtonLoading('saveProgressChangesBtn', true);
        try {
            const project = document.getElementById('editProject').value;
            const hours = parseFloat(document.getElementById('editHours').value);
            const rawDescription = document.getElementById('editDescription').value.trim();
            const description = this.removeEmojis(rawDescription);
            const date = document.getElementById('editDate').value;
            const time = document.getElementById('editTime').value;

            if (!hours || !description || !date || !time) {
                this.showStatus('editModalStatus', 'Please fill in all required fields', 'error');
                this.setButtonLoading('saveProgressChangesBtn', false);
                return;
            }

            // Combine date and time into ISO string
            const combinedDateTime = new Date(date + 'T' + time).toISOString();

            const updatedItem = {
                id: this.currentEditingItem.id,
                project,
                hours,
                description,
                date: combinedDateTime
            };

            this.showStatus('editModalStatus', 'Saving changes...', 'info');

            if (window.electronAPI && window.electronAPI.updateProgressItem) {
                const result = await window.electronAPI.updateProgressItem(updatedItem);
                
                if (result.success) {
                    this.showStatus('editModalStatus', 'Progress item updated successfully!', 'success');
                    setTimeout(() => {
                        this.hideEditModal();
                        this.loadProgressItems();
                    }, 1000);
                } else {
                    this.showStatus('editModalStatus', `Failed to update: ${result.error}`, 'error');
                }
            } else {
                this.showStatus('editModalStatus', 'Update API not available', 'error');
            }
        } catch (error) {
            console.error('Failed to save progress item:', error);
            this.showStatus('editModalStatus', 'Failed to save changes', 'error');
        } finally {
            this.setButtonLoading('saveProgressChangesBtn', false);
        }
    }

    async deleteProgressItem(id) {
        if (!confirm('Are you sure you want to delete this progress item? This action cannot be undone.')) {
            return;
        }

        this.setButtonLoading('deleteProgress', true);
        try {
            this.showStatus('progressStatus', 'Deleting progress item...', 'info');

            if (window.electronAPI && window.electronAPI.deleteProgressItem) {
                const result = await window.electronAPI.deleteProgressItem(id);
                
                if (result.success) {
                    this.showStatus('progressStatus', 'Progress item deleted successfully', 'success');
                    this.loadProgressItems();
                    setTimeout(() => this.clearStatus('progressStatus'), 3000);
                } else {
                    this.showStatus('progressStatus', `Failed to delete: ${result.error}`, 'error');
                }
            } else {
                this.showStatus('progressStatus', 'Delete API not available', 'error');
            }
        } catch (error) {
            console.error('Failed to delete progress item:', error);
            this.showStatus('progressStatus', 'Failed to delete progress item', 'error');
        } finally {
            this.setButtonLoading('deleteProgress', false);
        }
    }

    hideEditModal() {
        document.getElementById('editProgressModal').style.display = 'none';
        this.clearStatus('editModalStatus');
        this.currentEditingItem = null;
    }

    initializeDateControls() {
        // Ensure custom date controls are hidden initially
        const customDateControls = document.querySelectorAll('#customDateFrom, #customDateTo, #applyDateRange');
        customDateControls.forEach(control => {
            if (control) {
                control.style.display = 'none';
            }
        });
        
        // Set default filter to week if not already set
        const dateFilter = document.getElementById('progressDateFilter');
        if (dateFilter && !dateFilter.value) {
            dateFilter.value = 'week';
        }
    }

    updateProgressSummary(items, filter) {
        const summaryElement = document.getElementById('progressSummary');
        const totalHoursElement = document.getElementById('totalHours');
        const totalItemsElement = document.getElementById('totalItems');
        const periodLabelElement = document.getElementById('periodLabel');

        if (!summaryElement || !totalHoursElement || !totalItemsElement || !periodLabelElement) return;

        // Calculate totals
        const totalHours = items.reduce((sum, item) => sum + (parseFloat(item.hours) || 0), 0);
        const totalItems = items.length;

        // Update display
        totalHoursElement.textContent = totalHours.toFixed(1);
        totalItemsElement.textContent = totalItems;

        // Update period label
        const periodLabels = {
            'today': 'Today',
            'week': 'This Week',
            'lastWeek': 'Last Week',
            'month': 'This Month',
            'lastMonth': 'Last Month',
            'quarter': 'This Quarter',
            'year': 'This Year',
            'custom': 'Custom Range',
            'all': 'All Time'
        };
        
        periodLabelElement.textContent = periodLabels[filter] || 'Unknown';

        // Show/hide summary based on whether we have items
        if (totalItems > 0) {
            summaryElement.style.display = 'flex';
        } else {
            summaryElement.style.display = 'none';
        }
    }

    // Logging and Diagnostics
    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            type,
            time: Date.now()
        };
        
        this.logs.unshift(logEntry); // Add to beginning
        
        // Keep only last 100 logs
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(0, 100);
        }
        
        // Update logs display if visible
        this.updateLogsDisplay();
        
        // Also log to console
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    updateLogsDisplay() {
        const logsContent = document.getElementById('logsContent');
        if (!logsContent) return;

        if (this.logs.length === 0) {
            logsContent.innerHTML = `
                <div class="log-entry info">
                    <span class="log-time">--:--:--</span>
                    <span class="log-message">No logs available</span>
                </div>
            `;
            return;
        }

        logsContent.innerHTML = this.logs.map(log => `
            <div class="log-entry ${log.type}">
                <span class="log-time">${log.timestamp}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }

    async loadDiagnostics() {
        this.setButtonLoading('refreshDiagnostics', true);
        this.addLog('Loading diagnostics...', 'info');
        
        try {
            // Update server status
            await this.updateDiagnosticServerStatus();
            
            // Test environment file
            await this.testEnvironmentFile();
            
            // Test Airtable connection
            await this.testAirtableConnection();
            
            this.addLog('Diagnostics loaded', 'success');
        } finally {
            this.setButtonLoading('refreshDiagnostics', false);
        }
    }

    async updateDiagnosticServerStatus() {
        this.setButtonLoading('testServerHealth', true);
        const serverStatusValue = document.getElementById('serverStatusValue');
        if (!serverStatusValue) {
            this.setButtonLoading('testServerHealth', false);
            return;
        }

        try {
            if (window.electronAPI && window.electronAPI.getServerStatus) {
                const status = await window.electronAPI.getServerStatus();
                
                if (status.healthy) {
                    serverStatusValue.textContent = '✅ Running';
                    serverStatusValue.style.color = 'var(--accent-green)';
                    this.addLog('Server is running and healthy', 'success');
                } else {
                    serverStatusValue.textContent = `❌ Error: ${status.message}`;
                    serverStatusValue.style.color = 'var(--accent-red)';
                    this.addLog(`Server error: ${status.message}`, 'error');
                }
            } else {
                serverStatusValue.textContent = '❓ API not available';
                serverStatusValue.style.color = 'var(--text-muted)';
                this.addLog('Server status API not available', 'warning');
            }
        } catch (error) {
            serverStatusValue.textContent = `❌ Check failed: ${error.message}`;
            serverStatusValue.style.color = 'var(--accent-red)';
            this.addLog(`Server status check failed: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('testServerHealth', false);
        }
    }

    async testEnvironmentFile() {
        const envFileStatus = document.getElementById('envFileStatus');
        if (!envFileStatus) return;

        // Check if we can access environment variables
        try {
            const response = await fetch('http://localhost:8087/health');
            if (response.ok) {
                envFileStatus.textContent = '✅ Loaded';
                envFileStatus.style.color = 'var(--accent-green)';
                this.addLog('Environment file loaded successfully', 'success');
            } else {
                envFileStatus.textContent = '❌ Server not responding';
                envFileStatus.style.color = 'var(--accent-red)';
                this.addLog('Environment file check failed - server not responding', 'error');
            }
        } catch (error) {
            envFileStatus.textContent = '❌ Not accessible';
            envFileStatus.style.color = 'var(--accent-red)';
            this.addLog(`Environment file check failed: ${error.message}`, 'error');
        }
    }

    async testAirtableConnection() {
        this.setButtonLoading('testAirtableConnection', true);
        const airtableStatus = document.getElementById('airtableStatus');
        if (!airtableStatus) {
            this.setButtonLoading('testAirtableConnection', false);
            return;
        }

        try {
            if (window.electronAPI && window.electronAPI.getProgressItems) {
                airtableStatus.textContent = '🔄 Testing...';
                airtableStatus.style.color = 'var(--text-muted)';
                
                const items = await window.electronAPI.getProgressItems();
                
                if (items && Array.isArray(items)) {
                    airtableStatus.textContent = `✅ Connected (${items.length} items)`;
                    airtableStatus.style.color = 'var(--accent-green)';
                    this.addLog(`Airtable connection successful - ${items.length} items found`, 'success');
                } else {
                    airtableStatus.textContent = '❌ No data returned';
                    airtableStatus.style.color = 'var(--accent-red)';
                    this.addLog('Airtable connection failed - no data returned', 'error');
                }
            } else {
                airtableStatus.textContent = '❓ API not available';
                airtableStatus.style.color = 'var(--text-muted)';
                this.addLog('Airtable test API not available', 'warning');
            }
        } catch (error) {
            airtableStatus.textContent = `❌ Error: ${error.message}`;
            airtableStatus.style.color = 'var(--accent-red)';
            this.addLog(`Airtable connection test failed: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('testAirtableConnection', false);
        }
    }

    // AI Planner Methods
    async generateWeeklyPlan() {
        this.setButtonLoading('generatePlan', true);
        this.showStatus('plannerStatus', '', '');

        try {
            // Get form values
            const project = document.getElementById('plannerProject').value;
            const goals = document.getElementById('plannerGoals').value.trim();
            const workPattern = parseFloat(document.getElementById('plannerWorkPattern').value);
            
            // Validate inputs
            if (!project) {
                this.showStatus('plannerStatus', 'Please select a project', 'error');
                return;
            }
            
            if (!goals) {
                this.showStatus('plannerStatus', 'Please describe your weekly goals', 'error');
                return;
            }

            // Get selected working days
            const workingDays = [];
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((day, index) => {
                if (document.getElementById(`planner${day}`).checked) {
                    workingDays.push(index + 1); // 1-7 for Monday-Sunday
                }
            });

            if (workingDays.length === 0) {
                this.showStatus('plannerStatus', 'Please select at least one working day', 'error');
                return;
            }

            this.showStatus('plannerStatus', 'Generating weekly plan with AI...', 'info');
            this.addLog('Generating AI weekly plan...', 'info');

            // Generate the plan using AI
            const generatedPlan = await this.callAIForWeeklyPlan(project, goals, workPattern, workingDays);
            
            // Display the generated plan
            this.displayGeneratedPlan(generatedPlan);
            
            this.showStatus('plannerStatus', 'Weekly plan generated successfully!', 'success');
            this.addLog('AI weekly plan generated successfully', 'success');

        } catch (error) {
            console.error('Error generating weekly plan:', error);
            this.showStatus('plannerStatus', `Error generating plan: ${error.message}`, 'error');
            this.addLog(`Failed to generate weekly plan: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('generatePlan', false);
        }
    }

    async callAIForWeeklyPlan(project, goals, workPattern, workingDays) {
        try {
            this.addLog('Calling Anthropic API for intelligent plan generation...', 'info');
            
            const response = await fetch('http://localhost:8087/generate-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project: project,
                    goals: goals,
                    workPattern: workPattern,
                    workingDays: workingDays
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success || !data.plan) {
                throw new Error('Invalid response from AI planning service');
            }

            this.addLog(`AI generated ${data.plan.tasks.length} intelligent tasks for ${project}`, 'success');
            return data.plan;
            
        } catch (error) {
            this.addLog(`AI planning failed: ${error.message}`, 'error');
            
            // Fallback to basic planning if AI fails
            this.addLog('Falling back to basic task generation...', 'warning');
            return this.generateBasicPlan(project, goals, workPattern, workingDays);
        }
    }

    generateBasicPlan(project, goals, workPattern, workingDays) {
        // Fallback basic planning when AI is not available
        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const currentDate = new Date();
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Start from Monday
        
        const tasks = [];
        let taskCounter = 1;

        // Generate tasks for each working day
        workingDays.forEach(dayNumber => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + dayNumber - 1);
            
            const dayName = dayNames[dayNumber];
            const dayTasks = this.generateBasicTasksForDay(project, goals, workPattern, dayName, taskCounter);
            
            dayTasks.forEach(task => {
                tasks.push({
                    ...task,
                    date: date.toISOString().split('T')[0],
                    dayName: dayName
                });
                taskCounter++;
            });
        });

        return {
            project: project,
            totalHours: workingDays.length * workPattern,
            totalDays: workingDays.length,
            workPattern: workPattern,
            tasks: tasks
        };
    }

    generateBasicTasksForDay(project, goals, workPattern, dayName, startCounter) {
        // Parse goals to understand the context
        const tasks = [];
        const hoursPerDay = workPattern;
        
        // Generate realistic task durations that add up to the daily hours
        const taskDurations = this.generateTaskDurations(hoursPerDay);
        let currentTime = 9; // Start at 9 AM
        
        // Sample task templates based on common development work
        const taskTemplates = [
            "Research and planning for {focus}",
            "Implement {feature} functionality", 
            "Code review and testing for {component}",
            "Debug and fix issues in {area}",
            "Design and architecture for {system}",
            "Documentation and comments for {module}",
            "Integration testing with {service}",
            "Performance optimization for {feature}",
            "User interface improvements for {component}",
            "Database schema updates for {data}",
            "API endpoint development for {functionality}",
            "Security review and hardening for {area}"
        ];

        // Extract key terms from goals for more relevant tasks
        const keyTerms = this.extractKeyTermsFromGoals(goals);
        
        taskDurations.forEach((duration, index) => {
            const template = taskTemplates[index % taskTemplates.length];
            const keyTerm = keyTerms[index % keyTerms.length] || 'core functionality';
            
            const title = template.replace(/\{[^}]+\}/g, keyTerm);
            
            // Calculate time with breaks
            const startTime = this.formatTime(currentTime);
            currentTime += duration;
            if (index < taskDurations.length - 1 && duration >= 2) {
                currentTime += 0.25; // Add 15-minute break after 2+ hour tasks
            }
            const endTime = this.formatTime(currentTime - (index < taskDurations.length - 1 ? 0.25 : 0));
            
            tasks.push({
                id: `task-${startCounter + index}`,
                title: title,
                hours: duration,
                startTime: startTime,
                endTime: endTime,
                description: `${duration}h task focusing on ${keyTerm} - scheduled for ${dayName}`
            });
        });

        return tasks;
    }

    generateTaskDurations(totalHours) {
        // Generate realistic task durations that add up to totalHours
        const durations = [];
        let remaining = totalHours;
        
        while (remaining > 0) {
            if (remaining >= 3) {
                // Add a 2-3 hour task
                const duration = Math.random() > 0.5 ? 2.5 : 3;
                durations.push(Math.min(duration, remaining));
                remaining -= Math.min(duration, remaining);
            } else if (remaining >= 1.5) {
                // Add a 1.5-2 hour task
                const duration = Math.random() > 0.5 ? 1.5 : 2;
                durations.push(Math.min(duration, remaining));
                remaining -= Math.min(duration, remaining);
            } else if (remaining >= 1) {
                // Add a 1 hour task
                durations.push(Math.min(1, remaining));
                remaining -= Math.min(1, remaining);
            } else {
                // Add remaining time as final task
                durations.push(remaining);
                remaining = 0;
            }
        }
        
        return durations;
    }

    extractKeyTermsFromGoals(goals) {
        // Simple keyword extraction - in a real AI implementation, this would be more sophisticated
        const commonTerms = [
            'authentication', 'user management', 'database', 'API', 'frontend', 'backend',
            'testing', 'deployment', 'security', 'performance', 'UI/UX', 'integration',
            'documentation', 'monitoring', 'analytics', 'search', 'notifications',
            'payment', 'messaging', 'file upload', 'reporting', 'admin panel'
        ];
        
        const foundTerms = commonTerms.filter(term => 
            goals.toLowerCase().includes(term.toLowerCase())
        );
        
        // If no specific terms found, use generic ones
        if (foundTerms.length === 0) {
            return ['core features', 'system components', 'user interface', 'data management'];
        }
        
        return foundTerms.length > 0 ? foundTerms : ['development tasks'];
    }

    formatTime(hours) {
        const hour = Math.floor(hours);
        const minutes = Math.round((hours - hour) * 60);
        return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    displayGeneratedPlan(plan) {
        const planSection = document.getElementById('generatedPlanSection');
        const planSummary = document.getElementById('planSummary');
        const generatedTasks = document.getElementById('generatedTasks');
        
        // Show the plan section
        planSection.style.display = 'block';
        
        // Update summary
        planSummary.innerHTML = `
            <h4>📊 Plan Summary</h4>
            <div style="display: flex; gap: 20px; margin-top: 12px;">
                <div><strong>Project:</strong> ${plan.project}</div>
                <div><strong>Total Hours:</strong> ${plan.totalHours}h</div>
                <div><strong>Working Days:</strong> ${plan.totalDays}</div>
                <div><strong>Hours/Day:</strong> ${plan.workPattern}h</div>
            </div>
        `;
        
        // Group tasks by day
        const tasksByDay = {};
        plan.tasks.forEach(task => {
            if (!tasksByDay[task.dayName]) {
                tasksByDay[task.dayName] = [];
            }
            tasksByDay[task.dayName].push(task);
        });
        
        // Generate tasks HTML
        let tasksHTML = '';
        Object.entries(tasksByDay).forEach(([dayName, dayTasks]) => {
            const dayDate = dayTasks[0].date;
            const totalDayHours = dayTasks.reduce((sum, task) => sum + task.hours, 0);
            
            tasksHTML += `
                <div class="task-day">
                    <div class="task-day-header">
                        ${dayName}, ${new Date(dayDate + 'T00:00:00').toLocaleDateString()} 
                        (${totalDayHours}h total)
                    </div>
                    ${dayTasks.map(task => `
                        <div class="task-item" data-task-id="${task.id}">
                            <div class="task-content">
                                <div class="task-title">${task.title}</div>
                                <div class="task-details">
                                    <span>📅 ${dayName}</span>
                                    <span>⏰ ${task.startTime} - ${task.endTime}</span>
                                </div>
                            </div>
                            <div class="task-meta">
                                <div class="task-hours">${task.hours}h</div>
                                <div class="task-time">${task.startTime}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        generatedTasks.innerHTML = tasksHTML;
        
        // Store the plan for later use
        this.currentGeneratedPlan = plan;
    }

    async addAllGeneratedTodos() {
        if (!this.currentGeneratedPlan || !this.currentGeneratedPlan.tasks) {
            this.showStatus('planActionsStatus', 'No plan available to add', 'error');
            return;
        }

        this.setButtonLoading('addAllTodos', true);
        this.showStatus('planActionsStatus', '', '');

        try {
            let addedCount = 0;
            const tasks = this.currentGeneratedPlan.tasks;
            
            this.showStatus('planActionsStatus', `Adding ${tasks.length} tasks to todo list...`, 'info');
            
            // Add each task to the todo list
            for (const task of tasks) {
                const todo = {
                    id: Date.now() + Math.random(),
                    description: this.removeEmojis(task.title),
                    project: this.currentGeneratedPlan.project,
                    date: task.date,
                    time: task.startTime,
                    hours: task.hours,
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                
                this.todos.push(todo);
                addedCount++;
            }
            
            // Save todos and update UI
            this.saveTodos();
            this.updateTodoUI();
            
            // Switch to todos tab to show the results
            this.switchTab('todos');
            
            this.showStatus('planActionsStatus', `Successfully added ${addedCount} tasks to your todo list!`, 'success');
            this.addLog(`Added ${addedCount} AI-generated tasks to todo list`, 'success');
            
        } catch (error) {
            console.error('Error adding todos:', error);
            this.showStatus('planActionsStatus', `Error adding tasks: ${error.message}`, 'error');
            this.addLog(`Failed to add AI-generated tasks: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('addAllTodos', false);
        }
    }

    clearGeneratedPlan() {
        const planSection = document.getElementById('generatedPlanSection');
        planSection.style.display = 'none';
        this.currentGeneratedPlan = null;
        this.showStatus('planActionsStatus', 'Plan cleared', 'info');
        this.addLog('Generated plan cleared', 'info');
    }

    initializePlannerTab() {
        // Populate project dropdown
        const plannerProject = document.getElementById('plannerProject');
        if (plannerProject && this.settings && this.settings.projects) {
            plannerProject.innerHTML = '<option value="">Select a project...</option>';
            this.settings.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project;
                option.textContent = project;
                if (project === this.settings.defaultProject) {
                    option.selected = true;
                }
                plannerProject.appendChild(option);
            });
        }

        // Set current date for today's date
        const today = new Date();
        const currentTime = today.toTimeString().slice(0, 5);
        
        // Set default working pattern based on settings
        const workPattern = document.getElementById('plannerWorkPattern');
        if (workPattern) {
            // Default to 8 hours, but could be customized based on user settings
            workPattern.value = '8';
        }

        // Set working days based on user settings
        if (this.settings && this.settings.workingHours && this.settings.workingHours.days) {
            const dayMapping = {
                1: 'plannerMon',
                2: 'plannerTue', 
                3: 'plannerWed',
                4: 'plannerThu',
                5: 'plannerFri',
                6: 'plannerSat',
                0: 'plannerSun'
            };

            // First uncheck all
            ['plannerMon', 'plannerTue', 'plannerWed', 'plannerThu', 'plannerFri', 'plannerSat', 'plannerSun'].forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = false;
            });

            // Then check the working days
            this.settings.workingHours.days.forEach(day => {
                const checkboxId = dayMapping[day];
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) checkbox.checked = true;
            });
        }
    }

    // End of Day Methods
    checkEndOfDay() {
        if (!this.settings || !this.settings.enabled || this.settings.paused) {
            return;
        }

        const timezone = this.settings.workingHours.timezone || 'UTC';
        const now = new Date();
        
        // Get current time in working timezone
        const timeInTimezone = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short'
        }).formatToParts(now);
        
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = timeInTimezone.find(part => part.type === 'weekday').value;
        const currentDay = weekdays.indexOf(dayName);
        
        const hour = parseInt(timeInTimezone.find(part => part.type === 'hour').value);
        const minute = parseInt(timeInTimezone.find(part => part.type === 'minute').value);
        const currentTime = hour * 60 + minute;

        // Check if it's a working day
        if (!this.settings.workingHours.days.includes(currentDay)) {
            return;
        }

        // Get end time
        const [endHour, endMin] = this.settings.workingHours.end.split(':').map(Number);
        const endTime = endHour * 60 + endMin;

        // Check if we're within 5 minutes of end time or just past it
        const timeDiff = currentTime - endTime;
        const isEndOfDay = timeDiff >= 0 && timeDiff <= 5; // 0-5 minutes past end time

        if (isEndOfDay && !this.endOfDayShownToday) {
            this.showEndOfDayModal();
        }
    }

    showEndOfDayModal() {
        // Mark as shown for today
        const today = new Date().toDateString();
        this.endOfDayShownToday = today;
        
        // Get today's todos
        const todayTodos = this.getTodayTodos();
        
        if (todayTodos.length === 0) {
            // No todos for today, skip the modal
            this.addLog('No todos scheduled for today - skipping end of day review', 'info');
            return;
        }

        // Populate the modal
        this.populateEndOfDayModal(todayTodos);
        
        // Show the modal
        document.getElementById('endOfDayModal').classList.add('show');
        
        this.addLog(`End of day review shown with ${todayTodos.length} todos`, 'info');
    }

    getTodayTodos() {
        const today = new Date().toISOString().split('T')[0];
        return this.todos.filter(todo => 
            !todo.completed && 
            todo.date === today
        );
    }

    populateEndOfDayModal(todayTodos) {
        const todosList = document.getElementById('todayTodosList');
        
        if (todayTodos.length === 0) {
            todosList.innerHTML = `
                <div class="empty-todos">
                    No todos scheduled for today
                </div>
            `;
            return;
        }

        todosList.innerHTML = todayTodos.map(todo => `
            <div class="todo-review-item" data-todo-id="${todo.id}">
                <input type="checkbox" class="todo-checkbox" id="todo-${todo.id}">
                <div class="todo-review-content">
                    <div class="todo-review-title">${todo.description}</div>
                    <div class="todo-review-details">
                        <span>📁 ${todo.project}</span>
                        <span>📅 ${new Date(todo.date).toLocaleDateString()}</span>
                        ${todo.time ? `<span>⏰ ${todo.time}</span>` : ''}
                    </div>
                </div>
                <div class="todo-review-meta">
                    ${todo.hours ? `<div class="todo-hours-badge">${todo.hours}h</div>` : ''}
                    ${todo.time ? `<div class="todo-time-badge">${todo.time}</div>` : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers for checkboxes and rows
        todosList.querySelectorAll('.todo-review-item').forEach(item => {
            const checkbox = item.querySelector('.todo-checkbox');
            
            // Click on row toggles checkbox
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    checkbox.checked = !checkbox.checked;
                    this.updateTodoItemSelection(item, checkbox.checked);
                }
            });

            // Checkbox change updates selection
            checkbox.addEventListener('change', (e) => {
                this.updateTodoItemSelection(item, e.target.checked);
            });
        });
    }

    updateTodoItemSelection(item, selected) {
        if (selected) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }

    selectAllTodayTodos() {
        const checkboxes = document.querySelectorAll('#todayTodosList .todo-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            const item = checkbox.closest('.todo-review-item');
            this.updateTodoItemSelection(item, true);
        });
    }

    selectNoneTodayTodos() {
        const checkboxes = document.querySelectorAll('#todayTodosList .todo-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const item = checkbox.closest('.todo-review-item');
            this.updateTodoItemSelection(item, false);
        });
    }

    async submitSelectedTodos() {
        this.setButtonLoading('submitSelectedTodos', true);
        this.showStatus('endOfDayStatus', '', '');

        try {
            const selectedCheckboxes = document.querySelectorAll('#todayTodosList .todo-checkbox:checked');
            
            if (selectedCheckboxes.length === 0) {
                this.showStatus('endOfDayStatus', 'Please select at least one todo to submit', 'error');
                return;
            }

            let submittedCount = 0;
            const errors = [];

            for (const checkbox of selectedCheckboxes) {
                const todoId = checkbox.id.replace('todo-', '');
                const todo = this.todos.find(t => t.id == todoId);
                
                if (todo) {
                    try {
                        // Create progress item
                        const progressData = {
                            hours: todo.hours || 1,
                            description: this.removeEmojis(todo.description),
                            date: new Date().toISOString(),
                            project: todo.project
                        };

                        // Submit to server
                        const response = await fetch('http://localhost:8087/add-progress', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(progressData)
                        });

                        if (response.ok) {
                            // Mark todo as completed
                            todo.completed = true;
                            todo.completedAt = new Date().toISOString();
                            submittedCount++;
                            
                            this.addLog(`Submitted progress: ${todo.description} (${todo.hours || 1}h)`, 'success');
                        } else {
                            const errorData = await response.json();
                            errors.push(`${todo.description}: ${errorData.error}`);
                        }
                    } catch (error) {
                        errors.push(`${todo.description}: ${error.message}`);
                    }
                }
            }

            // Save updated todos
            this.saveTodos();
            this.updateTodoUI();

            if (submittedCount > 0) {
                this.showStatus('endOfDayStatus', 
                    `Successfully submitted ${submittedCount} progress item${submittedCount > 1 ? 's' : ''}!`, 
                    'success'
                );
                
                // Close modal after a short delay
                setTimeout(() => {
                    this.hideEndOfDayModal();
                }, 2000);
            }

            if (errors.length > 0) {
                this.showStatus('endOfDayStatus', 
                    `${submittedCount} submitted, ${errors.length} failed: ${errors.join(', ')}`, 
                    'warning'
                );
            }

        } catch (error) {
            console.error('Error submitting selected todos:', error);
            this.showStatus('endOfDayStatus', `Error submitting progress: ${error.message}`, 'error');
            this.addLog(`Failed to submit end-of-day progress: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('submitSelectedTodos', false);
        }
    }

    skipEndOfDayReview() {
        this.addLog('End of day review skipped by user', 'info');
        this.hideEndOfDayModal();
    }

    hideEndOfDayModal() {
        document.getElementById('endOfDayModal').classList.remove('show');
        this.showStatus('endOfDayStatus', '', '');
    }

    // Activity Monitoring Methods
    updateActivityStats(activityData) {
        this.activityStats = { ...this.activityStats, ...activityData };
        this.updateActivityUI();
    }

    updateActivityUI() {
        // Update activity overview cards
        const todayActiveTime = document.getElementById('todayActiveTime');
        const todayLoggedTime = document.getElementById('todayLoggedTime');
        const todayEfficiency = document.getElementById('todayEfficiency');
        const activityStatus = document.getElementById('activityStatus');

        if (todayActiveTime) {
            // Show total time including current session if active
            const totalActiveTime = this.activityStats.dailyActive + 
                (this.activityStats.isActive ? this.activityStats.sessionTime : 0);
            todayActiveTime.textContent = this.formatDuration(totalActiveTime);
        }

        if (todayLoggedTime) {
            // Calculate logged time from progress items for today
            const today = new Date().toISOString().split('T')[0];
            const todayProgress = this.getProgressItemsForDate(today);
            const loggedMs = todayProgress.reduce((total, item) => total + (item.hours * 3600000), 0);
            todayLoggedTime.textContent = this.formatDuration(loggedMs);
        }

        if (todayEfficiency) {
            const totalActiveTime = this.activityStats.dailyActive + 
                (this.activityStats.isActive ? this.activityStats.sessionTime : 0);
            const loggedMs = this.getTodayLoggedTime();
            const efficiency = totalActiveTime > 0 ? Math.round((loggedMs / totalActiveTime) * 100) : 0;
            todayEfficiency.textContent = `${Math.min(efficiency, 100)}%`;
        }

        if (activityStatus) {
            activityStatus.textContent = this.activityStats.isActive ? 'Active' : 'Idle';
        }

        // Update real-time monitor
        const currentSessionTime = document.getElementById('currentSessionTime');
        const activityStatusDot = document.getElementById('activityStatusDot');
        const activityStatusText = document.getElementById('activityStatusText');

        if (currentSessionTime) {
            currentSessionTime.textContent = this.formatDuration(this.activityStats.sessionTime);
        }

        if (activityStatusDot) {
            activityStatusDot.className = `status-dot ${this.activityStats.isActive ? 'active' : ''}`;
        }

        if (activityStatusText) {
            activityStatusText.textContent = this.activityStats.isActive ? 'Active' : 'Idle';
        }

        // Update breakdown
        this.updateActivityBreakdown();
        
        // Update activity chart
        this.updateActivityChart(this.activityStats);
        
        // Update activity timeline
        this.updateActivityTimeline(this.activityStats);
        
        // Update weekly insights
        this.updateWeeklyInsights();
    }

    updateActivityBreakdown() {
        const activePeriods = document.getElementById('activePeriods');
        const idlePeriods = document.getElementById('idlePeriods');
        const focusSessions = document.getElementById('focusSessions');
        const peakActivity = document.getElementById('peakActivity');

        // Calculate real periods from timeline data
        let activeCount = 0;
        let idleCount = 0;
        let inactiveCount = 0;
        let peakHour = 0;
        let maxActivityInHour = 0;
        
        // Count activity states from timeline data
        this.realTimelineData.forEach((state, segmentKey) => {
            switch (state) {
                case 'active':
                    activeCount++;
                    break;
                case 'idle':
                    idleCount++;
                    break;
                case 'inactive':
                    inactiveCount++;
                    break;
            }
        });
        
        // Find peak activity hour from chart data
        if (this.activityChart && this.activityChart.data.datasets[0].data) {
            this.activityChart.data.datasets[0].data.forEach((minutes, hourIndex) => {
                if (minutes > maxActivityInHour) {
                    maxActivityInHour = minutes;
                    peakHour = hourIndex;
                }
            });
        }
        
        // Update UI with real data
        if (activePeriods) {
            // Each segment is 10 minutes, so convert to periods
            const activeMinutes = activeCount * 10;
            const activePeriodCount = Math.ceil(activeMinutes / 30); // 30-min periods
            activePeriods.textContent = activePeriodCount;
        }

        if (idlePeriods) {
            const idleMinutes = idleCount * 10;
            const idlePeriodCount = Math.ceil(idleMinutes / 15); // 15-min periods
            idlePeriods.textContent = idlePeriodCount;
        }

        if (focusSessions) {
            const activeMinutes = activeCount * 10;
            const focusSessionCount = Math.floor(activeMinutes / 60); // 1-hour sessions
            focusSessions.textContent = focusSessionCount;
        }

        if (peakActivity) {
            if (maxActivityInHour > 0) {
                peakActivity.textContent = `${peakHour.toString().padStart(2, '0')}:00`;
            } else {
                const now = new Date();
                const currentHour = now.getHours();
                peakActivity.textContent = `${currentHour.toString().padStart(2, '0')}:00`;
            }
        }
        
        console.log(`📊 Breakdown updated: ${activeCount} active, ${idleCount} idle, ${inactiveCount} inactive segments`);
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    getTodayLoggedTime() {
        const today = new Date().toISOString().split('T')[0];
        const todayProgress = this.getProgressItemsForDate(today);
        return todayProgress.reduce((total, item) => total + (item.hours * 3600000), 0);
    }

    getProgressItemsForDate(date) {
        // This would need to access progress items - for now return empty array
        return [];
    }

    async refreshActivityStats() {
        // Don't refresh if UI isn't ready yet - prevents flickering during initialization
        if (!this.uiReady) {
            console.log('🔄 Skipping activity stats refresh - UI not ready yet');
            return;
        }
        
        this.setButtonLoading('refreshActivity', true);
        try {
            // Activity Overview is now updated in real-time from native activity events
            // This refresh just updates the UI with current stats
            this.updateActivityUI();
                this.addLog('Activity stats refreshed', 'success');
            console.log('📊 Activity stats refreshed from real-time tracking:', this.activityStats);
        } catch (error) {
            console.error('Error refreshing activity stats:', error);
            this.addLog('Failed to refresh activity stats', 'error');
        } finally {
            this.setButtonLoading('refreshActivity', false);
        }
    }

    async exportActivityData() {
        this.setButtonLoading('exportActivity', true);
        try {
            const stats = this.activityStats;
            const data = {
                date: new Date().toISOString().split('T')[0],
                activeTime: this.formatDuration(stats.dailyActive),
                idleTime: this.formatDuration(stats.dailyIdle),
                totalTime: this.formatDuration(stats.totalTime),
                efficiency: Math.round((this.getTodayLoggedTime() / stats.dailyActive) * 100),
                isMonitoring: stats.isMonitoring,
                exportedAt: new Date().toISOString()
            };

            // Create downloadable JSON file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `activity-data-${data.date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.addLog('Activity data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting activity data:', error);
            this.addLog('Failed to export activity data', 'error');
        } finally {
            this.setButtonLoading('exportActivity', false);
        }
    }

    showActivitySettings() {
        // For now, just show a simple alert - could be expanded to a modal
        alert('Activity monitoring settings:\n\n• Monitoring runs automatically when app is open\n• Activity is detected based on window focus\n• Data is saved locally and resets daily\n• Idle threshold: 1 minute of inactivity');
    }



    // Initialize activity monitoring when switching to activity tab
    async initializeActivityTab() {
        try {
                    // Initialize the activity chart
        this.initializeActivityChart();
        
        // Initialize the activity timeline
        this.initializeActivityTimeline();
            
            // Load today's activity stats from native monitor first
            await this.refreshActivityStats();
            
            // Load native activity stats
            await this.refreshNativeStats();
            
            // Load keypress counter stats
            await this.refreshKeypressStats();
            
            // Start periodic update of last keypress time
            if (this.keypressUpdateInterval) {
                clearInterval(this.keypressUpdateInterval);
            }
            
            this.keypressUpdateInterval = setInterval(() => {
                this.updateLastKeypressDisplay();
            }, 5000); // Update every 5 seconds
        } catch (error) {
            console.error('Error initializing activity tab:', error);
        }
    }

    // Native Activity Monitoring Methods
    async testNativeActivity() {
        try {
            this.setButtonLoading('testNativeActivity', true);
            const result = await window.electronAPI.testNativeActivity();
            
            if (result.success) {
                this.addLog('Native activity test triggered successfully', 'success');
                // Refresh stats after test
                setTimeout(() => this.refreshNativeStats(), 1000);
            } else {
                this.addLog(`Native activity test failed: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Error testing native activity:', error);
            this.addLog(`Error testing native activity: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('testNativeActivity', false);
        }
    }

    async resetNativeStats() {
        try {
            this.setButtonLoading('resetNativeStats', true);
            const result = await window.electronAPI.resetNativeActivityStats();
            
            if (result.success) {
                this.addLog('Native activity stats reset successfully', 'success');
                await this.refreshNativeStats();
            } else {
                this.addLog(`Failed to reset native stats: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Error resetting native stats:', error);
            this.addLog(`Error resetting native stats: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('resetNativeStats', false);
        }
    }

    async refreshNativeStats() {
        try {
            this.setButtonLoading('refreshNativeStats', true);
            const stats = await window.electronAPI.getNativeActivityStats();
            
            if (stats.error) {
                this.updateNativeTrackingStatus('Not Available', 'error');
                this.addLog(`Native tracking error: ${stats.error}`, 'warning');
            } else {
                this.updateNativeActivityUI(stats);
                this.addLog('Native activity stats refreshed', 'info');
            }
        } catch (error) {
            console.error('Error refreshing native stats:', error);
            this.updateNativeTrackingStatus('Error', 'error');
            this.addLog(`Error refreshing native stats: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('refreshNativeStats', false);
        }
    }

    async resetKeypressStats() {
        try {
            this.setButtonLoading('resetKeypressStats', true);
            const result = await window.electronAPI.resetNativeActivityStats();
            
            if (result.success) {
                this.addLog('Keypress counter reset successfully', 'success');
                // Reset the display
                this.resetKeypressDisplay();
            } else {
                this.addLog(`Failed to reset keypress counter: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Error resetting keypress counter:', error);
            this.addLog(`Error resetting keypress counter: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('resetKeypressStats', false);
        }
    }

    async refreshKeypressStats() {
        try {
            this.setButtonLoading('refreshKeypressStats', true);
            const stats = await window.electronAPI.getNativeActivityStats();
            
            if (stats.error) {
                this.addLog(`Keypress tracking error: ${stats.error}`, 'warning');
            } else {
                this.updateKeypressUI(stats);
                this.addLog('Keypress stats refreshed', 'info');
            }
        } catch (error) {
            console.error('Error refreshing keypress stats:', error);
            this.addLog(`Error refreshing keypress stats: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('refreshKeypressStats', false);
        }
    }

    updateKeypressUI(stats) {
        // Initialize keypress tracking variables if they don't exist
        if (!this.keypressData) {
            this.keypressData = {
                startTime: Date.now(),
                lastKeypressTime: null,
                totalKeypresses: 0,
                maxKeysPerMinute: 0,
                lastMinuteKeys: 0,
                lastMinuteStartTime: Date.now()
            };
        }

        if (stats.stats && stats.stats.keyPresses !== undefined) {
            this.keypressData.totalKeypresses = stats.stats.keyPresses;
            
            // Update main counter
            const totalKeypresses = document.getElementById('totalKeypresses');
            if (totalKeypresses) {
                totalKeypresses.textContent = this.keypressData.totalKeypresses.toLocaleString();
            }

            // Calculate keys per minute
            const now = Date.now();
            const sessionDurationMinutes = (now - this.keypressData.startTime) / 60000;
            const keysPerMinute = sessionDurationMinutes > 0 ? 
                Math.round(this.keypressData.totalKeypresses / sessionDurationMinutes) : 0;
            
            const keysPerMinuteElement = document.getElementById('keysPerMinute');
            if (keysPerMinuteElement) {
                keysPerMinuteElement.textContent = keysPerMinute;
            }

            // Update peak rate
            if (keysPerMinute > this.keypressData.maxKeysPerMinute) {
                this.keypressData.maxKeysPerMinute = keysPerMinute;
            }
            
            const peakKeysPerMinute = document.getElementById('peakKeysPerMinute');
            if (peakKeysPerMinute) {
                peakKeysPerMinute.textContent = this.keypressData.maxKeysPerMinute;
            }

            // Update last keypress time
            if (stats.lastActivity) {
                this.keypressData.lastKeypressTime = stats.lastActivity;
            }
        }

        this.updateLastKeypressDisplay();
    }

    updateNativeActivityUI(stats) {
        // Check if we're in fallback mode
        if (stats.permissions && stats.permissions.fallbackMode) {
            this.updateNativeTrackingStatus('Fallback Mode', 'info');
            this.addLog(stats.permissions.message, 'info');
        } else if (stats.permissions && !stats.permissions.hasPermissions) {
            this.updateNativeTrackingStatus('Permissions Required', 'error');
            this.addLog(stats.permissions.message, 'warning');
            return;
        } else {
            // Update native tracking status
            if (stats.isMonitoring) {
                this.updateNativeTrackingStatus('Active', 'success');
            } else {
                this.updateNativeTrackingStatus('Inactive', 'warning');
            }
        }

        // Update mouse movements
        const mouseMovements = document.getElementById('mouseMovements');
        if (mouseMovements && stats.stats) {
            mouseMovements.textContent = stats.stats.mouseMovements || 0;
        }

        const windowSwitches = document.getElementById('windowSwitches');
        if (windowSwitches && stats.stats) {
            windowSwitches.textContent = stats.stats.windowSwitches || 0;
        }

        // Update last activity
        const lastActivity = document.getElementById('lastNativeActivity');
        if (lastActivity && stats.lastActivity) {
            const lastActivityTime = new Date(stats.lastActivity);
            const now = new Date();
            const diffMs = now - lastActivityTime;
            const diffSeconds = Math.floor(diffMs / 1000);
            
            if (diffSeconds < 60) {
                lastActivity.textContent = `${diffSeconds}s ago`;
            } else if (diffSeconds < 3600) {
                const minutes = Math.floor(diffSeconds / 60);
                lastActivity.textContent = `${minutes}m ago`;
            } else {
                lastActivity.textContent = lastActivityTime.toLocaleTimeString();
            }
        } else if (lastActivity) {
            lastActivity.textContent = 'Never';
        }
    }

    updateNativeTrackingStatus(status, type = 'info') {
        const statusElement = document.getElementById('nativeTrackingStatus');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `activity-value ${type}`;
        }
    }

    updateLastKeypressDisplay() {
        const lastKeypress = document.getElementById('lastKeypress');
        if (lastKeypress && this.keypressData && this.keypressData.lastKeypressTime) {
            const lastKeypressTime = new Date(this.keypressData.lastKeypressTime);
            const now = new Date();
            const diffMs = now - lastKeypressTime;
            const diffSeconds = Math.floor(diffMs / 1000);
            
            if (diffSeconds < 60) {
                lastKeypress.textContent = `${diffSeconds}s ago`;
            } else if (diffSeconds < 3600) {
                const minutes = Math.floor(diffSeconds / 60);
                lastKeypress.textContent = `${minutes}m ago`;
            } else {
                lastKeypress.textContent = lastKeypressTime.toLocaleTimeString();
            }
        } else if (lastKeypress) {
            lastKeypress.textContent = 'Never';
        }
    }

    resetKeypressDisplay() {
        this.keypressData = {
            startTime: Date.now(),
            lastKeypressTime: null,
            totalKeypresses: 0,
            maxKeysPerMinute: 0,
            lastMinuteKeys: 0,
            lastMinuteStartTime: Date.now()
        };

        const totalKeypresses = document.getElementById('totalKeypresses');
        if (totalKeypresses) {
            totalKeypresses.textContent = '0';
        }

        const keysPerMinute = document.getElementById('keysPerMinute');
        if (keysPerMinute) {
            keysPerMinute.textContent = '0';
        }

        const peakKeysPerMinute = document.getElementById('peakKeysPerMinute');
        if (peakKeysPerMinute) {
            peakKeysPerMinute.textContent = '0';
        }

        const lastKeypress = document.getElementById('lastKeypress');
        if (lastKeypress) {
            lastKeypress.textContent = 'Never';
        }
    }

    updateNativeActivityDisplay(data) {
        console.log('🔔 Native activity display update:', data.type);
        
        // Don't update if UI isn't ready yet
        if (!this.uiReady) {
            console.log('⏳ Native activity display update skipped - UI not ready yet');
            return;
        }
        
        // Update stats in real-time when native activity is detected
        if (data.stats) {
                          const mouseMovements = document.getElementById('mouseMovements');
              if (mouseMovements) {
                  mouseMovements.textContent = data.stats.mouseMovements || 0;
              }

              const windowSwitches = document.getElementById('windowSwitches');
              if (windowSwitches) {
                  windowSwitches.textContent = data.stats.windowSwitches || 0;
              }
        }

        // Update last activity time for native tracking
        const lastActivity = document.getElementById('lastNativeActivity');
        if (lastActivity) {
            lastActivity.textContent = 'Just now';
        }
        
        // Handle keyboard activity specifically
        if (data.type === 'keyboard' && data.totalKeyPresses !== undefined) {
            // Initialize keypress data if not already done
            if (!this.keypressData) {
                this.keypressData = {
                    startTime: Date.now(),
                    lastKeypressTime: null,
                    totalKeypresses: 0,
                    maxKeysPerMinute: 0,
                    lastMinuteKeys: 0,
                    lastMinuteStartTime: Date.now()
                };
            }

            // Update keypress count
            this.keypressData.totalKeypresses = data.totalKeyPresses;
            this.keypressData.lastKeypressTime = Date.now();

            // Update UI elements
            const totalKeypresses = document.getElementById('totalKeypresses');
            if (totalKeypresses) {
                totalKeypresses.textContent = this.keypressData.totalKeypresses.toLocaleString();
            }

            // Calculate and update keys per minute
            const sessionDurationMinutes = (Date.now() - this.keypressData.startTime) / 60000;
            const keysPerMinute = sessionDurationMinutes > 0 ? 
                Math.round(this.keypressData.totalKeypresses / sessionDurationMinutes) : 0;
            
            const keysPerMinuteElement = document.getElementById('keysPerMinute');
            if (keysPerMinuteElement) {
                keysPerMinuteElement.textContent = keysPerMinute;
            }

            // Update peak rate
            if (keysPerMinute > this.keypressData.maxKeysPerMinute) {
                this.keypressData.maxKeysPerMinute = keysPerMinute;
                const peakKeysPerMinute = document.getElementById('peakKeysPerMinute');
                if (peakKeysPerMinute) {
                    peakKeysPerMinute.textContent = this.keypressData.maxKeysPerMinute;
                }
            }

            // Update last keypress time
            this.updateLastKeypressDisplay();

            console.log(`📝 Keypress detected - Total: ${this.keypressData.totalKeypresses}, Rate: ${keysPerMinute}/min`);
        }

        // Mark as active and update the status display
        const oldLastActivityTime = this.lastActivityTime;
        this.lastActivityTime = Date.now();
        this.activityState = 'active';
        
        console.log(`🎯 Native activity detected - lastActivityTime updated from ${new Date(oldLastActivityTime).toLocaleTimeString()} to ${new Date(this.lastActivityTime).toLocaleTimeString()}`);
        
        this.updateStatusDisplay();

        // Add visual feedback
        if (data.type === 'keyboard') {
            this.addLog(`Keyboard activity detected - Total keypresses: ${data.totalKeyPresses || 0}`, 'info');
        } else {
        this.addLog(`Native activity detected: ${data.type}`, 'info');
        }
    }

    updateActivityStatusDisplay(data) {
        console.log('Updating activity status display:', data);
        
        const now = Date.now();
        
        // Update activity state based on native monitor
        if (data.isActive) {
            const oldLastActivityTime = this.lastActivityTime;
            this.lastActivityTime = now;
            this.activityState = 'active';
            
            console.log(`🎯 Activity status update - ACTIVE - lastActivityTime updated from ${new Date(oldLastActivityTime).toLocaleTimeString()} to ${new Date(this.lastActivityTime).toLocaleTimeString()}`);
        } else {
            // When native monitor says inactive, set to idle first (will transition to inactive after 5 min)
            if (this.activityState === 'active') {
                this.activityState = 'idle';
                console.log(`🎯 Activity status update - IDLE - transitioning from active to idle`);
            }
            // Don't update lastActivityTime when going inactive - let the timer handle inactive transition
        }
        
        // Update the UI display
        this.updateStatusDisplay();
        
        // Update timeline with current activity state
        this.updateActivityTimeline({ isActive: data.isActive });
        
        // Record the activity state change
        this.recordActivityEvent('status_change', data.isActive);
        
        console.log(`Activity state: ${this.activityState}, Time since last activity: ${Math.round((now - this.lastActivityTime) / 1000)}s`);
    }

    updateStatusDisplay() {
        console.log(`🎯 Updating status display - State: ${this.activityState}`);
        
        // Don't update if UI isn't ready yet
        if (!this.uiReady) {
            console.log('⏳ Status display update skipped - UI not ready yet');
            return;
        }
        
        // Update the UI elements based on current activity state without changing the state
        let displayText, cssClass, dotClass;
        switch (this.activityState) {
            case 'active':
                displayText = 'Active';
                cssClass = 'success';
                dotClass = 'active';
                break;
            case 'idle':
                displayText = 'Idle';
                cssClass = 'warning';
                dotClass = 'idle';
                break;
            case 'inactive':
                displayText = 'Inactive';
                cssClass = 'warning';
                dotClass = 'inactive';
                break;
        }
        
        // Update all status display elements
        const activityStatus = document.getElementById('activityStatus');
        if (activityStatus) {
            activityStatus.textContent = displayText;
            activityStatus.className = `activity-value ${cssClass}`;
        }

        const statusDot = document.getElementById('statusDot');
        if (statusDot) {
            statusDot.className = `status-dot ${dotClass}`;
        }

        const activityStatusDot = document.getElementById('activityStatusDot');
        if (activityStatusDot) {
            activityStatusDot.className = `status-dot ${dotClass}`;
        }

        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = displayText;
        }

        const activityStatusText = document.getElementById('activityStatusText');
        if (activityStatusText) {
            activityStatusText.textContent = displayText;
        }

        const statusLabel = document.getElementById('statusLabel');
        if (statusLabel) {
            statusLabel.textContent = displayText;
        }
        
        console.log(`✅ Status display updated to: ${displayText} (${dotClass})`);
    }

    // New methods to connect native activity to Activity Overview
    updateActivityOverviewFromNativeActivity(data) {
        if (!this.uiReady) return;
        
        // Update last activity time
        this.lastActivityTime = Date.now();
        
        // If this is activity detection, mark as active and accumulate time
        if (data.type === 'mouse' || data.type === 'keyboard' || data.type === 'window') {
            if (!this.activityStats.isActive) {
                this.activityStats.isActive = true;
                this.activitySessionStart = Date.now();
                console.log(`📊 Activity Overview: Started new session`);
            }
            
            // Update session time
            this.activityStats.sessionTime = Date.now() - this.activitySessionStart;
            
            // Update monitoring status
            this.activityStats.isMonitoring = true;
            
                    // Update the Activity Overview UI
        this.updateActivityUI();
        
        // Record real activity event for timeline
        this.recordActivityEvent(data.type, true);
        
        console.log(`📊 Activity Overview: Session time ${this.formatDuration(this.activityStats.sessionTime)}`);
        }
    }

    updateActivityOverviewFromStatusChange(data) {
        if (!this.uiReady) return;
        
        const wasActive = this.activityStats.isActive;
        this.activityStats.isActive = data.isActive;
        
        if (wasActive && !data.isActive) {
            // User became inactive - add session time to daily active time
            const sessionTime = Date.now() - this.activitySessionStart;
            this.activityStats.dailyActive += sessionTime;
            this.activityStats.totalTime = this.activityStats.dailyActive + this.activityStats.dailyIdle;
            
            console.log(`📊 Activity Overview: Session ended - ${this.formatDuration(sessionTime)}, Total today: ${this.formatDuration(this.activityStats.dailyActive)}`);
        } else if (!wasActive && data.isActive) {
            // User became active - start new session
            this.activitySessionStart = Date.now();
            console.log(`📊 Activity Overview: New session started`);
        }
        
        // Update current session time
        if (this.activityStats.isActive) {
            this.activityStats.sessionTime = Date.now() - this.activitySessionStart;
        } else {
            this.activityStats.sessionTime = 0;
        }
        
        // Update monitoring status
        this.activityStats.isMonitoring = true;
        
        // Update the Activity Overview UI
        this.updateActivityUI();
        
        console.log(`📊 Activity Overview: Status changed to ${data.isActive ? 'active' : 'inactive'}, Daily total: ${this.formatDuration(this.activityStats.dailyActive)}`);
    }

    // Activity Chart Methods
    initializeActivityChart() {
        const canvas = document.getElementById('activityChartCanvas');
        if (!canvas) {
            console.error('Activity chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        // Initialize chart data for the last 24 hours (hourly intervals)
        const now = new Date();
        const labels = [];
        const data = [];
        
        // Create labels for the last 24 hours
        for (let i = 23; i >= 0; i--) {
            const time = new Date(now.getTime() - (i * 60 * 60 * 1000));
            labels.push(time.getHours().toString().padStart(2, '0') + ':00');
            data.push(0); // Initialize with 0 activity
        }
        
        this.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Activity Level',
                    data: data,
                    borderColor: '#1f6feb',
                    backgroundColor: 'rgba(31, 111, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#1f6feb',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(13, 17, 23, 0.9)',
                        titleColor: '#f0f6fc',
                        bodyColor: '#8b949e',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(tooltipItems) {
                                return `Time: ${tooltipItems[0].label}`;
                            },
                            label: function(context) {
                                const minutes = Math.round(context.parsed.y);
                                return `Active: ${minutes} minutes`;
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time (24h)',
                            color: '#8b949e',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            color: '#6e7681',
                            font: {
                                size: 11
                            },
                            maxTicksLimit: 8
                        },
                        grid: {
                            color: 'rgba(48, 54, 61, 0.5)',
                            drawBorder: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Active Minutes',
                            color: '#8b949e',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            color: '#6e7681',
                            font: {
                                size: 11
                            },
                            beginAtZero: true,
                            stepSize: 10
                        },
                        grid: {
                            color: 'rgba(48, 54, 61, 0.5)',
                            drawBorder: false
                        }
                    }
                }
            }
        });

        console.log('📊 Activity chart initialized');
        
        // Load any existing activity data for today
        this.loadTodayActivityData();
    }

    loadTodayActivityData() {
        // Load real activity data from localStorage for today's chart
        const today = new Date().toDateString();
        const storedChartData = localStorage.getItem(`activityChart_${today}`);
        
        if (storedChartData && this.activityChart) {
            try {
                const chartData = JSON.parse(storedChartData);
                this.activityChart.data.datasets[0].data = chartData;
                this.activityChart.update();
                console.log('📊 Real activity chart data loaded from storage');
            } catch (error) {
                console.error('Error loading chart data:', error);
                this.initializeEmptyChartData();
            }
        } else {
            this.initializeEmptyChartData();
        }
    }

    initializeEmptyChartData() {
        // Initialize with zeros for all hours
        if (this.activityChart) {
            this.activityChart.data.datasets[0].data = new Array(24).fill(0);
            this.activityChart.update();
            console.log('📊 Initialized empty chart data');
        }
    }

    saveChartData() {
        // Save current chart data to localStorage
        if (this.activityChart) {
            const today = new Date().toDateString();
            try {
                const chartData = this.activityChart.data.datasets[0].data;
                localStorage.setItem(`activityChart_${today}`, JSON.stringify(chartData));
            } catch (error) {
                console.error('Error saving chart data:', error);
            }
        }
    }

    // Activity Timeline Methods - Now with minute-level granularity using real data
    initializeActivityTimeline() {
        const timelineContainer = document.getElementById('activityTimeline');
        if (!timelineContainer) {
            console.error('Activity timeline container not found');
            return;
        }

        // Clear existing segments
        timelineContainer.innerHTML = '';

        // Create 144 segments (one for each 10-minute period) to avoid layout issues
        // This gives us good granularity while keeping the timeline manageable
        for (let segment = 0; segment < 144; segment++) {
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'timeline-segment no-data';
            segmentDiv.dataset.segment = segment;
            segmentDiv.dataset.startMinute = segment * 10;
            segmentDiv.dataset.endMinute = (segment * 10) + 9;
            
            const startMinute = segment * 10;
            const endMinute = (segment * 10) + 9;
            
            // Add hover tooltip
            segmentDiv.addEventListener('mouseenter', (e) => {
                this.showTimelineTooltip(e, startMinute, endMinute);
            });
            
            segmentDiv.addEventListener('mouseleave', () => {
                this.hideTimelineTooltip();
            });
            
            timelineContainer.appendChild(segmentDiv);
        }

        console.log('📊 Real-time activity timeline initialized with 10-minute precision (144 segments)');
        
        // Load real activity data from today
        this.loadRealTimelineData();
        
        // Auto-scroll to current time
        this.scrollTimelineToCurrentTime();
    }

    loadRealTimelineData() {
        // Load any stored activity data from localStorage for today
        const today = new Date().toDateString();
        const storedData = localStorage.getItem(`activityTimeline_${today}`);
        
        if (storedData) {
            try {
                this.realTimelineData = new Map(JSON.parse(storedData));
                console.log(`📊 Loaded ${this.realTimelineData.size} minutes of real activity data from storage`);
            } catch (error) {
                console.error('Error loading timeline data:', error);
                this.realTimelineData = new Map();
            }
        } else {
            this.realTimelineData = new Map();
            console.log('📊 No existing timeline data found, starting fresh');
        }
        
        // Apply the loaded data to the timeline
        this.refreshTimelineDisplay();
    }

    saveRealTimelineData() {
        // Save current timeline data to localStorage
        const today = new Date().toDateString();
        try {
            const dataToStore = JSON.stringify([...this.realTimelineData]);
            localStorage.setItem(`activityTimeline_${today}`, dataToStore);
        } catch (error) {
            console.error('Error saving timeline data:', error);
        }
    }

    refreshTimelineDisplay() {
        // Update all timeline segments based on real data
        for (let segment = 0; segment < 144; segment++) {
            const segmentDiv = document.querySelector(`[data-segment="${segment}"]`);
            if (segmentDiv) {
                const segmentKey = this.getSegmentKey(segment);
                const state = this.realTimelineData.get(segmentKey) || 'no-data';
                segmentDiv.className = `timeline-segment ${state}`;
            }
        }
    }

    updateCurrentSegmentState() {
        // Update the current segment based on the MAIN activity state, not time calculations
        const currentSegment = this.getCurrentSegment();
        const segmentKey = this.getSegmentKey(currentSegment);
        
        // Use the main activity state for timeline segments
        let currentState = this.activityState || 'no-data';
        
        // Always update the current segment (it might be a new segment)
        const existingState = this.realTimelineData.get(segmentKey);
        
        // Store the new state
        this.realTimelineData.set(segmentKey, currentState);
        
        // Update the visual segment
        const segment = document.querySelector(`[data-segment="${currentSegment}"]`);
        if (segment) {
            segment.className = `timeline-segment ${currentState}`;
        }
        
        // Save data if state changed
        if (existingState !== currentState) {
            this.saveRealTimelineData();
            console.log(`📊 Current segment ${currentSegment} updated: ${existingState || 'no-data'} -> ${currentState} (using main state: ${this.activityState})`);
            
            // Update breakdown when segment state changes
            this.updateActivityBreakdown();
        }
    }

    fillMissingSegments() {
        // Fill in segments that might have been missed during periods of inactivity
        const currentSegment = this.getCurrentSegment();
        const now = Date.now();
        const timeSinceActivity = now - this.lastActivityTime;
        
        // Define time thresholds
        const tenSeconds = 10 * 1000;
        const fiveMinutes = 5 * 60 * 1000;
        
        // Determine what state recent segments should be
        let stateToFill;
        if (timeSinceActivity < tenSeconds) {
            stateToFill = 'active';
        } else if (timeSinceActivity < fiveMinutes) {
            stateToFill = 'idle';
        } else {
            stateToFill = 'inactive';
        }
        
        // Look back at the last few segments to fill any gaps
        const segmentsToCheck = Math.min(6, currentSegment + 1); // Check last hour or from start
        for (let i = Math.max(0, currentSegment - segmentsToCheck + 1); i <= currentSegment; i++) {
            const segmentKey = this.getSegmentKey(i);
            
            // If segment has no data, fill it based on when it would have occurred
            if (!this.realTimelineData.has(segmentKey)) {
                // Calculate when this segment occurred
                const segmentStartTime = new Date();
                segmentStartTime.setHours(0, 0, 0, 0); // Start of day
                segmentStartTime.setMinutes(i * 10); // Add segment minutes
                
                const segmentTime = segmentStartTime.getTime();
                const timeSinceSegment = now - segmentTime;
                const timeSinceActivityAtSegment = Math.max(0, timeSinceActivity - (now - segmentTime));
                
                let segmentState;
                if (timeSinceActivityAtSegment < tenSeconds) {
                    segmentState = 'active';
                } else if (timeSinceActivityAtSegment < fiveMinutes) {
                    segmentState = 'idle';
                } else {
                    segmentState = 'inactive';
                }
                
                // Only fill recent segments (within last 30 minutes)
                if (timeSinceSegment < 30 * 60 * 1000) {
                    this.realTimelineData.set(segmentKey, segmentState);
                    
                    // Update visual
                    const segment = document.querySelector(`[data-segment="${i}"]`);
                    if (segment) {
                        segment.className = `timeline-segment ${segmentState}`;
                    }
                }
            }
        }
    }

    getSegmentKey(segmentIndex) {
        // Convert segment index to a key format (segment number)
        return `segment_${segmentIndex}`;
    }

    getCurrentSegment() {
        const now = new Date();
        const minuteOfDay = now.getHours() * 60 + now.getMinutes();
        return Math.floor(minuteOfDay / 10); // Each segment is 10 minutes
    }

    scrollTimelineToCurrentTime() {
        const timelineContainer = document.getElementById('activityTimeline');
        if (!timelineContainer) return;
        
        const currentSegment = this.getCurrentSegment();
        const totalSegments = 144;
        
        // Calculate scroll position (scroll to show current time in center)
        const scrollPercentage = currentSegment / totalSegments;
        const containerWidth = timelineContainer.clientWidth;
        const totalWidth = timelineContainer.scrollWidth;
        const scrollPosition = (totalWidth * scrollPercentage) - (containerWidth / 2);
        
        timelineContainer.scrollLeft = Math.max(0, scrollPosition);
        
        console.log(`📊 Timeline scrolled to current segment: ${currentSegment}`);
    }

    updateActivityTimeline(activityData) {
        if (!activityData) return;
        
        const currentSegment = this.getCurrentSegment();
        const segmentKey = this.getSegmentKey(currentSegment);
        
        let state = 'no-data';
        
        if (activityData.isActive) {
            state = 'active';
        } else {
            // Determine if idle or inactive based on time since last activity
            const timeSinceActivity = Date.now() - this.lastActivityTime;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (timeSinceActivity < fiveMinutes) {
                state = 'idle';
            } else {
                state = 'inactive';
            }
        }
        
        // Store the real activity data
        this.realTimelineData.set(segmentKey, state);
        
        // Update the visual segment
        const segment = document.querySelector(`[data-segment="${currentSegment}"]`);
        if (segment) {
            segment.className = `timeline-segment ${state}`;
        }
        
        // Save to localStorage periodically
        this.saveRealTimelineData();
        
        console.log(`📊 Real timeline updated: Segment ${currentSegment} is now ${state}`);
    }

    // Record activity event with 10-minute segment precision
    recordActivityEvent(activityType, isActive) {
        const currentSegment = this.getCurrentSegment();
        const segmentKey = this.getSegmentKey(currentSegment);
        
        let state;
        if (isActive) {
            state = 'active';
        } else {
            // Check if this is a transition to idle or inactive
            const timeSinceActivity = Date.now() - this.lastActivityTime;
            const fiveMinutes = 5 * 60 * 1000;
            state = timeSinceActivity < fiveMinutes ? 'idle' : 'inactive';
        }
        
        // Store the activity state for this segment
        this.realTimelineData.set(segmentKey, state);
        
        // Update the visual display
        const segment = document.querySelector(`[data-segment="${currentSegment}"]`);
        if (segment) {
            segment.className = `timeline-segment ${state}`;
        }
        
        console.log(`📊 Activity event recorded: ${activityType} at segment ${currentSegment} -> ${state}`);
        
        // Save data
        this.saveRealTimelineData();
    }

    showTimelineTooltip(event, startMinute, endMinute) {
        const tooltip = document.createElement('div');
        tooltip.className = 'timeline-tooltip';
        tooltip.id = 'timelineTooltip';
        
        const segment = event.target;
        const state = segment.className.replace('timeline-segment ', '');
        
        // Convert minutes to hour:minute format
        const startHour = Math.floor(startMinute / 60);
        const startMin = startMinute % 60;
        const endHour = Math.floor(endMinute / 60);
        const endMin = endMinute % 60;
        
        const timeString = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
        
        let stateText;
        switch (state) {
            case 'active':
                stateText = 'Active';
                break;
            case 'idle':
                stateText = 'Idle';
                break;
            case 'inactive':
                stateText = 'Inactive';
                break;
            default:
                stateText = 'No Data';
        }
        
        tooltip.textContent = `${timeString}: ${stateText}`;
        
        // Position tooltip
        const rect = segment.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 30}px`;
        tooltip.style.transform = 'translateX(-50%)';
        
        document.body.appendChild(tooltip);
    }

    hideTimelineTooltip() {
        const tooltip = document.getElementById('timelineTooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    updateActivityChart(activityData) {
        if (!this.activityChart) {
            console.log('📊 Chart not initialized yet');
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        
        // Find the index for the current hour
        const hourIndex = this.activityChart.data.labels.findIndex(label => {
            return label === currentHour.toString().padStart(2, '0') + ':00';
        });

        if (hourIndex !== -1) {
            const currentValue = this.activityChart.data.datasets[0].data[hourIndex] || 0;
            
            // Determine if we should add activity time
            let shouldIncrement = false;
            
            if (activityData.isActive || activityData.status === 'active') {
                shouldIncrement = true;
            } else if (activityData.sessionTime && activityData.sessionTime > 0) {
                shouldIncrement = true;
            }
            
            if (shouldIncrement) {
                // Add 1 minute of activity (real-time increment)
                this.activityChart.data.datasets[0].data[hourIndex] = currentValue + 1;
                this.activityChart.update('none'); // Update without animation for real-time feel
                
                // Save chart data to localStorage
                this.saveChartData();
                
                console.log(`📊 Chart updated: Hour ${currentHour} now has ${this.activityChart.data.datasets[0].data[hourIndex]} minutes of activity`);
            }
        }
    }

    updateWeeklyInsights() {
        if (!this.uiReady) return;

        // Most Productive Day (simplified - show today if active)
        const mostProductiveDay = document.getElementById('mostProductiveDay');
        const mostProductiveDetails = document.getElementById('mostProductiveDetails');
        if (mostProductiveDay && mostProductiveDetails) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const totalActiveTime = this.activityStats.dailyActive + 
                (this.activityStats.isActive ? this.activityStats.sessionTime : 0);
            mostProductiveDay.textContent = today;
            mostProductiveDetails.textContent = this.formatDuration(totalActiveTime);
        }

        // Peak Hours (show current hour when active)
        const peakHours = document.getElementById('peakHours');
        const peakHoursDetails = document.getElementById('peakHoursDetails');
        if (peakHours && peakHoursDetails) {
            const now = new Date();
            const currentHour = now.getHours();
            const hourString = `${currentHour.toString().padStart(2, '0')}:00`;
            peakHours.textContent = this.activityStats.isActive ? hourString : 'Not active';
            peakHoursDetails.textContent = this.activityStats.isActive ? 'Current active period' : 'No activity detected';
        }

        // Today's Progress (show daily active time)
        const weeklyTrend = document.getElementById('weeklyTrend');
        const weeklyTrendDetails = document.getElementById('weeklyTrendDetails');
        if (weeklyTrend && weeklyTrendDetails) {
            const totalActiveTime = this.activityStats.dailyActive + 
                (this.activityStats.isActive ? this.activityStats.sessionTime : 0);
            weeklyTrend.textContent = this.formatDuration(totalActiveTime);
            weeklyTrendDetails.textContent = 'Active time today';
        }

        // Efficiency (logged vs active)
        const weeklyAccuracy = document.getElementById('weeklyAccuracy');
        const weeklyAccuracyDetails = document.getElementById('weeklyAccuracyDetails');
        if (weeklyAccuracy && weeklyAccuracyDetails) {
            const totalActiveTime = this.activityStats.dailyActive + 
                (this.activityStats.isActive ? this.activityStats.sessionTime : 0);
            const loggedMs = this.getTodayLoggedTime();
            const efficiency = totalActiveTime > 0 ? Math.round((loggedMs / totalActiveTime) * 100) : 0;
            weeklyAccuracy.textContent = `${Math.min(efficiency, 100)}%`;
            weeklyAccuracyDetails.textContent = 'Logged vs. active';
        }

        console.log('📊 Weekly insights updated');
    }
}

// Initialize the controller when the page loads
let controller;
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, electronAPI available:', !!window.electronAPI);
    if (window.electronAPI) {
        console.log('Available electronAPI methods:', Object.keys(window.electronAPI));
    }
    
    try {
        // Show loading state
        const statusLabel = document.getElementById('statusLabel');
        if (statusLabel) statusLabel.textContent = 'Initializing...';
        
    controller = new DesktopProgressController();
        
        console.log('Controller initialized successfully');
    } catch (error) {
        console.error('Failed to initialize controller:', error);
        
        // Show error state
        const statusLabel = document.getElementById('statusLabel');
        if (statusLabel) statusLabel.textContent = 'Error';
        
        // Try to show basic fallback
        document.body.innerHTML += `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: var(--bg-secondary); padding: 20px; border-radius: 8px; 
                        color: var(--text-primary); text-align: center;">
                <h3>⚠️ Initialization Error</h3>
                <p>Failed to initialize the application.</p>
                <p>Error: ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px;">
                    Reload App
                </button>
            </div>
        `;
    }
});

// Update status every minute
setInterval(() => {
    if (controller && controller.updateStatus) {
        controller.updateStatus();
    }
}, 60000); 