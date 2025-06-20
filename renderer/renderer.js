// Renderer script for MCP Progress Tracker Desktop

class DesktopProgressController {
    constructor() {
        this.settings = null;
        this.todos = [];
        this.logs = [];
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
            
            console.log('Loading server status...');
            await this.loadServerStatus();
            
            console.log('Controller initialization complete');
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
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');

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

        // Update header status badge (simple)
        if (statusDot) {
            statusDot.className = `status-dot ${statusClass}`;
        }
        if (statusLabel) {
            statusLabel.textContent = simpleStatus;
        }

        // Update current time display
        this.updateCurrentTimeDisplay();
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
        const lastReportEl = document.getElementById('lastReport');
        if (this.settings.lastReportTime) {
            const lastReport = new Date(this.settings.lastReportTime);
            lastReportEl.textContent = `Last report: ${lastReport.toLocaleString()}`;
        } else {
            lastReportEl.textContent = 'No reports submitted yet';
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
            
            // Enabled toggle
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
        }
    }

    async testMCPConnection() {
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
        }
    }

    async testNotification() {
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
        }
    }

    async triggerManualReport() {
        this.showProgressModal();
    }

    async pauseTracking() {
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
        const selectedProject = document.querySelector('.project-btn.active')?.textContent || this.settings.defaultProject;
        const hours = parseFloat(document.getElementById('modalHours').value);
        const description = document.getElementById('modalDescription').value.trim();

        if (!description) {
            this.showStatus('modalStatus', 'Please enter a description', 'error');
            return;
        }

        const progressData = {
            project: selectedProject,
            hours: hours,
            description: description,
            date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
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
        const description = document.getElementById('todoDescription').value.trim();
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
        const progressData = {
            project: todo.project,
            hours: todo.hours,
            description: `✅ ${todo.description}`,
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
            const formattedTime = date.toLocaleTimeString();
            
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
        
        // Format date for input (YYYY-MM-DD)
        const date = new Date(item.date);
        const formattedDate = date.toISOString().split('T')[0];
        document.getElementById('editDate').value = formattedDate;
        
        // Show the modal
        document.getElementById('editProgressModal').style.display = 'block';
    }

    async saveProgressItem() {
        try {
            const project = document.getElementById('editProject').value;
            const hours = parseFloat(document.getElementById('editHours').value);
            const description = document.getElementById('editDescription').value.trim();
            const date = document.getElementById('editDate').value;

            if (!hours || !description || !date) {
                this.showStatus('editModalStatus', 'Please fill in all required fields', 'error');
                return;
            }

            const updatedItem = {
                id: this.currentEditingItem.id,
                project,
                hours,
                description,
                date: new Date(date).toISOString()
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
        }
    }

    async deleteProgressItem(id) {
        if (!confirm('Are you sure you want to delete this progress item? This action cannot be undone.')) {
            return;
        }

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
        this.addLog('Loading diagnostics...', 'info');
        
        // Update server status
        await this.updateDiagnosticServerStatus();
        
        // Test environment file
        await this.testEnvironmentFile();
        
        // Test Airtable connection
        await this.testAirtableConnection();
        
        this.addLog('Diagnostics loaded', 'success');
    }

    async updateDiagnosticServerStatus() {
        const serverStatusValue = document.getElementById('serverStatusValue');
        if (!serverStatusValue) return;

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
        const airtableStatus = document.getElementById('airtableStatus');
        if (!airtableStatus) return;

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
        }
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