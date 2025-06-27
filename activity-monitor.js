import { EventEmitter } from 'events';

// Using hybrid approach with multiple libraries for comprehensive system tracking
// This avoids the permission dialog issues we had with nut-js
console.log('🔧 Initializing hybrid system-wide activity monitoring...');

class HybridActivityMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.options = {
      idleThreshold: options.idleThreshold || 60000, // 1 minute
      checkInterval: options.checkInterval || 5000,  // 5 seconds
      trackMouse: options.trackMouse !== false,      // Default true
      trackKeyboard: options.trackKeyboard || false, // Default false
      ...options
    };
    
    this.isActive = false;
    this.lastActivity = Date.now();
    this.stats = {
      totalActiveTime: 0,
      totalSessions: 0,
      averageSessionLength: 0,
      mouseMovements: 0,
      keyPresses: 0,
      windowSwitches: 0,
      applicationUsage: new Map()
    };
    
    // Tracking intervals
    this.activityCheckInterval = null;
    this.windowTrackingInterval = null;
    this.idleCheckInterval = null;
    this.statusUpdateInterval = null;
    
    // Libraries (loaded dynamically)
    this.activeWin = null;
    this.desktopIdle = null;
    this.realIdle = null;
    this.robot = null;
    
    // State tracking
    this.lastActiveWindow = null;
    this.sessionStartTime = null;
    this.lastMousePos = { x: 0, y: 0 };
    
    // Permission state caching
    this.permissionsChecked = false;
    this.permissionsResult = null;
    this.permissionCheckInProgress = false;
    this.permissionsGranted = false;
    this.permissionsDenied = false; // Explicit flag to track denial
    
    this.initializeLibraries();
  }

  async initializeLibraries() {
    try {
      // Try to load active-win for window tracking
      try {
        const activeWinModule = await import('active-win');
        this.activeWin = activeWinModule.default;
        console.log('✅ Active-win loaded successfully');
      } catch (error) {
        console.log('⚠️ Active-win not available:', error.message);
      }

      // Try to load desktop-idle (cross-platform idle detection)
      try {
        const desktopIdleModule = await import('desktop-idle');
        this.desktopIdle = desktopIdleModule.default;
        console.log('✅ Desktop-idle loaded successfully');
      } catch (error) {
        console.log('⚠️ Desktop-idle not available:', error.message);
      }

      // Try to load @paymoapp/real-idle (advanced idle detection)
      try {
        const realIdleModule = await import('@paymoapp/real-idle');
        this.realIdle = realIdleModule.default;
        console.log('✅ Real-idle loaded successfully');
      } catch (error) {
        console.log('⚠️ Real-idle not available:', error.message);
      }

      // Try to load @hurdlegroup/robotjs (updated fork)
      try {
        const robotModule = await import('@hurdlegroup/robotjs');
        this.robot = robotModule.default;
        console.log('✅ @hurdlegroup/robotjs loaded successfully');
      } catch (error) {
        console.log('⚠️ @hurdlegroup/robotjs not available:', error.message);
      }

      this.emit('libraries-loaded', {
        activeWin: !!this.activeWin,
        desktopIdle: !!this.desktopIdle,
        realIdle: !!this.realIdle,
        robotjs: !!this.robot
      });
    } catch (error) {
      console.error('Error initializing activity monitor:', error);
      this.emit('error', error);
    }
  }

  async start() {
    console.log('🚀 Starting Hybrid Activity Monitor...');
    
    // Wait a bit for libraries to finish loading and app to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check permissions ONCE at startup
    console.log('🔐 Performing ONE-TIME permission check at startup...');
    const permissions = await this.checkPermissions();
    
    let hasActiveTracking = false;
    
    if (this.permissionsGranted) {
      console.log('✅ Permissions granted, starting native tracking...');
    
    // Start different tracking methods based on available libraries
      // These will now run WITHOUT permission checks since we verified them once
    if (this.desktopIdle || this.realIdle) {
        this.startIdleTrackingWithPermissions();
        hasActiveTracking = true;
        console.log('📊 Idle tracking started (permissions verified)');
    }
    
    if (this.activeWin) {
        this.startWindowTrackingWithPermissions();
        hasActiveTracking = true;
        console.log('🪟 Window tracking started (permissions verified)');
    }
    
    if (this.robot) {
        this.startMouseTrackingWithPermissions();
        if (this.options.trackKeyboard) {
          this.startKeyboardTracking();
          console.log('⌨️ Keyboard tracking started (permissions verified)');
        }
        hasActiveTracking = true;
        console.log('🖱️ Mouse tracking started (permissions verified)');
      }
    } else {
      console.log('❌ Permissions not granted, using fallback tracking only');
    }
    
    // Fallback: Basic activity simulation if no libraries available or no permissions
    if (!hasActiveTracking) {
      console.log('⚠️ Using fallback tracking (no native libraries or permissions)');
      this.startFallbackTracking();
    } else {
      console.log('✅ Native activity tracking active with', {
        idle: !!(this.desktopIdle || this.realIdle),
        window: !!this.activeWin,
        mouse: !!this.robot,
        permissions: permissions.overall
      });
    }
    
    this.emit('started');
    
    // Start status update interval
    this.startStatusUpdates();
  }

  startIdleTrackingWithPermissions() {
    console.log('📊 Starting system-wide idle time tracking (permissions already verified)...');
    
    this.idleCheckInterval = setInterval(() => {
      try {
        let idleTime = -1;
        let idleState = 'unknown';
        
        // Try real-idle first (more sophisticated)
        if (this.realIdle) {
          try {
            idleTime = this.realIdle.getIdleSeconds() * 1000; // Convert to milliseconds
            idleState = this.realIdle.getIdleState(5); // 5 second threshold
          } catch (error) {
            console.log('Real-idle error:', error.message);
          }
        }
        
        // Fallback to desktop-idle
        if (idleTime === -1 && this.desktopIdle) {
          try {
            idleTime = this.desktopIdle.getIdleTime();
          } catch (error) {
            console.log('Desktop-idle error:', error.message);
          }
        }
        
        if (idleTime !== -1) {
          const isCurrentlyActive = idleTime < 5000; // Active if idle < 5 seconds
          
                  if (isCurrentlyActive !== this.isActive) {
          const previousState = this.isActive;
          this.isActive = isCurrentlyActive;
          
          // Emit activity-changed event
          this.emit('activity-changed', {
            isActive: this.isActive,
            previousState,
            timestamp: Date.now()
          });
          
          if (isCurrentlyActive) {
            this.handleActivityStart();
          } else {
            this.handleActivityEnd();
          }
        }
          
          if (isCurrentlyActive) {
            this.lastActivity = Date.now();
          }
          
          this.emit('idle-check', { 
            idleTime, 
            idleState,
            isActive: isCurrentlyActive,
            source: this.realIdle ? 'real-idle' : 'desktop-idle'
          });
        }
      } catch (error) {
        console.error('Error checking idle time:', error);
      }
    }, 1000);
  }

  startWindowTrackingWithPermissions() {
    console.log('🪟 Starting window tracking (permissions already verified)...');
    
    this.windowTrackingInterval = setInterval(async () => {
      try {
        const activeWindow = await this.activeWin();
        
        if (activeWindow && activeWindow.title !== this.lastActiveWindow?.title) {
          // Window switched
          this.stats.windowSwitches++;
          
          // Track application usage
          const appName = activeWindow.owner?.name || 'Unknown';
          const currentUsage = this.stats.applicationUsage.get(appName) || 0;
          this.stats.applicationUsage.set(appName, currentUsage + 1);
          
          this.lastActiveWindow = activeWindow;
          this.lastActivity = Date.now();
          
          // Consider window switching as activity
          if (!this.isActive) {
            const previousState = this.isActive;
            this.isActive = true;
            
            // Emit activity-changed event
            this.emit('activity-changed', {
              isActive: this.isActive,
              previousState,
              timestamp: Date.now()
            });
            
            this.handleActivityStart();
          }
          
          this.emit('window-changed', {
            window: activeWindow,
            appName,
            totalSwitches: this.stats.windowSwitches
          });
        }
      } catch (error) {
        console.error('Error tracking windows:', error);
      }
    }, 2000);
  }

  startMouseTrackingWithPermissions() {
    console.log('🖱️ Starting mouse tracking (permissions already verified)...');
    
    this.activityCheckInterval = setInterval(() => {
      try {
        const currentPos = this.robot.getMousePos();
        
        if (currentPos.x !== this.lastMousePos.x || currentPos.y !== this.lastMousePos.y) {
          // Mouse moved
          this.stats.mouseMovements++;
          this.lastMousePos = currentPos;
          this.lastActivity = Date.now();
          
          if (!this.isActive) {
            const previousState = this.isActive;
            this.isActive = true;
            
            // Emit activity-changed event
            this.emit('activity-changed', {
              isActive: this.isActive,
              previousState,
              timestamp: Date.now()
            });
            
            this.handleActivityStart();
          }
          
          this.emit('mouse-activity', {
            position: currentPos,
            totalMovements: this.stats.mouseMovements
          });
        }
      } catch (error) {
        console.error('Error tracking mouse:', error);
      }
    }, 500);
  }

  startKeyboardTracking() {
    console.log('⌨️ Starting keyboard tracking with robotjs...');
    
    if (!this.robot) {
      console.log('❌ RobotJS not available for keyboard tracking');
      return;
    }
    
    // Initialize keyboard stats
    this.stats.keyPresses = 0;
    this.lastKeypressTime = Date.now();
    
    // Set up keyboard activity detection using mouse movement and system activity as proxies
    this.keyboardTrackingInterval = setInterval(() => {
      try {
        // Since direct keyboard monitoring requires complex global hooks,
        // we'll use system activity changes as a proxy for keyboard activity
        
        // Method 1: Monitor mouse position changes (indicates user interaction)
        let activityDetected = false;
        
        if (this.robot) {
          try {
            const currentMousePos = this.robot.getMousePos();
            
            // Check for mouse movement
            if (this.lastMousePos && 
                (Math.abs(currentMousePos.x - this.lastMousePos.x) > 5 || 
                 Math.abs(currentMousePos.y - this.lastMousePos.y) > 5)) {
              activityDetected = true;
            }
            
            this.lastMousePos = currentMousePos;
          } catch (error) {
            console.log('Mouse position check error:', error.message);
          }
        }
        
        // Method 2: Use system idle time as proxy for keyboard activity
        if (!activityDetected && (this.desktopIdle || this.realIdle)) {
          try {
            let idleTime = -1;
            
            if (this.realIdle) {
              idleTime = this.realIdle.getIdleSeconds() * 1000;
            } else if (this.desktopIdle) {
              idleTime = this.desktopIdle.getIdleTime();
            }
            
            // If idle time is very low (< 2 seconds), assume keyboard activity
            if (idleTime !== -1 && idleTime < 2000) {
              const now = Date.now();
              if (now - this.lastKeypressTime > 2000) { // Throttle to prevent spam
                activityDetected = true;
              }
            }
          } catch (error) {
            console.log('Idle time check error:', error.message);
          }
        }
        
        if (activityDetected) {
          this.recordKeypressActivity();
        }
        
      } catch (error) {
        console.log('Keyboard tracking error:', error.message);
      }
    }, 2000); // Check every 2 seconds
    
    console.log('⌨️ Keyboard tracking started successfully');
  }
  
  recordKeypressActivity() {
    const now = Date.now();
    this.stats.keyPresses++;
    this.lastKeypressTime = now;
    this.recordActivity('keyboard');
    
    // Emit keyboard activity event
    this.emit('keyboard-activity', {
      timestamp: now,
      totalKeyPresses: this.stats.keyPresses
    });
    
    console.log(`⌨️ Keyboard activity detected (total: ${this.stats.keyPresses})`);
  }

  startFallbackTracking() {
    console.log('🔄 Fallback tracking disabled - no simulation will be performed');
    
    // Fallback tracking has been disabled to prevent false activity data
    // The system now relies on real activity detection only
    
    console.log('✅ Real activity tracking mode enabled - no fake data generated');
  }

  handleActivityStart() {
    this.sessionStartTime = Date.now();
    this.stats.totalSessions++;
    
    this.emit('activity-start', {
      timestamp: this.sessionStartTime,
      sessionNumber: this.stats.totalSessions
    });
  }

  handleActivityEnd() {
    if (this.sessionStartTime) {
      const sessionLength = Date.now() - this.sessionStartTime;
      this.stats.totalActiveTime += sessionLength;
      this.stats.averageSessionLength = this.stats.totalActiveTime / this.stats.totalSessions;
      
      this.emit('activity-end', {
        sessionLength,
        totalActiveTime: this.stats.totalActiveTime,
        averageSessionLength: this.stats.averageSessionLength
      });
    }
  }

  async checkPermissions() {
    // Return cached result if available
    if (this.permissionsChecked && this.permissionsResult) {
      return this.permissionsResult;
    }
    
    // Prevent multiple simultaneous permission checks
    if (this.permissionCheckInProgress) {
      console.log('⏳ Permission check already in progress, waiting...');
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.permissionCheckInProgress && this.permissionsResult) {
            clearInterval(checkInterval);
            resolve(this.permissionsResult);
          }
        }, 100);
      });
    }
    
    this.permissionCheckInProgress = true;
    console.log('🔐 Checking native library permissions...');
    
    const permissions = {
      activeWin: false,
      desktopIdle: false,
      realIdle: false,
      robotjs: false,
      overall: 'available'
    };
    
    // Test active-win (least invasive first)
    if (this.activeWin) {
      try {
        await this.activeWin();
        permissions.activeWin = true;
        console.log('✅ Active-win permissions OK');
      } catch (error) {
        console.log('❌ Active-win permission issue:', error.message);
      }
    }
    
    // Test desktop-idle
    if (this.desktopIdle) {
      try {
        this.desktopIdle.getIdleTime();
        permissions.desktopIdle = true;
        console.log('✅ Desktop-idle permissions OK');
      } catch (error) {
        console.log('❌ Desktop-idle permission issue:', error.message);
      }
    }
    
    // Test real-idle
    if (this.realIdle) {
      try {
        this.realIdle.getIdleSeconds();
        permissions.realIdle = true;
        console.log('✅ Real-idle permissions OK');
      } catch (error) {
        console.log('❌ Real-idle permission issue:', error.message);
      }
    }
    
    // Test robotjs (most likely to trigger permission dialog)
    if (this.robot) {
      try {
        const pos = this.robot.getMousePos();
        permissions.robotjs = true;
        console.log('✅ RobotJS permissions OK, mouse at:', pos);
      } catch (error) {
        console.log('❌ RobotJS permission issue:', error.message);
        // If this is a permission error, mark as denied and disable all native tracking
        if (error.message.includes('permission') || error.message.includes('accessibility') || error.message.includes('denied')) {
          console.log('🚫 Accessibility permissions denied - disabling all native tracking');
          this.permissionsDenied = true;
          this.permissionsGranted = false;
          
          // Immediately disable all libraries
          this.robot = null;
          this.activeWin = null;
          this.desktopIdle = null;
          this.realIdle = null;
          
          permissions.activeWin = false;
          permissions.desktopIdle = false;
          permissions.realIdle = false;
          permissions.robotjs = false;
        }
      }
    }
    
    // Determine overall status
    const workingLibraries = [permissions.activeWin, permissions.desktopIdle, permissions.realIdle, permissions.robotjs];
    const workingCount = workingLibraries.filter(Boolean).length;
    
    if (workingCount === 0) {
      permissions.overall = 'none';
    } else if (workingCount < workingLibraries.length) {
      permissions.overall = 'partial';
    } else {
      permissions.overall = 'full';
    }
    
    // Cache the result
    this.permissionsResult = permissions;
    this.permissionsChecked = true;
    this.permissionCheckInProgress = false;
    this.permissionsGranted = permissions.overall !== 'none';
    
    console.log('🔐 Permission check complete:', permissions);
    console.log('🔐 Permissions granted:', this.permissionsGranted);
    return permissions;
  }

  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      uptime: Date.now() - (this.sessionStartTime || Date.now()),
      applicationUsage: Object.fromEntries(this.stats.applicationUsage)
    };
  }

  // Additional methods for compatibility with main.js
  recordActivity(type) {
    this.lastActivity = Date.now();
    const previousState = this.isActive;
    
    if (!this.isActive) {
      this.isActive = true;
      
      // Emit activity-changed event
      this.emit('activity-changed', {
        isActive: this.isActive,
        previousState,
        timestamp: this.lastActivity
      });
      
      this.handleActivityStart();
    }
    
    this.emit('activity', {
      type,
      timestamp: this.lastActivity,
      isActive: this.isActive
    });
  }

  simulateActivity() {
    // Simulation disabled to prevent false activity data
    console.log('⚠️ simulateActivity() called but disabled - no fake data will be generated');
  }

  getActivityStatus() {
    return this.getStats();
  }

  resetStats() {
    this.stats = {
      totalActiveTime: 0,
      totalSessions: 0,
      averageSessionLength: 0,
      mouseMovements: 0,
      keyPresses: 0,
      windowSwitches: 0,
      applicationUsage: new Map()
    };
    
    this.emit('stats-reset');
  }

  // Method to handle permission denial and stop all native calls
  handlePermissionDenial(source) {
    console.log(`🚫 Permission denied for ${source} - disabling all native tracking`);
    this.permissionsGranted = false;
    this.permissionsDenied = true;
    
    // Stop all intervals to prevent further permission requests
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    
    if (this.windowTrackingInterval) {
      clearInterval(this.windowTrackingInterval);
      this.windowTrackingInterval = null;
    }
    
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    
    // Completely disable native libraries to prevent any future calls
    this.robot = null;
    this.activeWin = null;
    this.desktopIdle = null;
    this.realIdle = null;
    
    console.log('🚫 All native libraries disabled due to permission denial');
    
    // Start fallback tracking if not already running
    if (!this.activityCheckInterval) {
      console.log('🔄 Starting fallback tracking due to permission denial');
      this.startFallbackTracking();
    }
    
    this.emit('permissions-denied', { source });
  }

  startStatusUpdates() {
    // Send status updates at the configured interval
    this.statusUpdateInterval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - this.lastActivity;
      
      this.emit('status-update', {
        isActive: this.isActive,
        lastActivity: this.lastActivity,
        idleTime,
        stats: this.getStats()
      });
    }, this.options.checkInterval);
  }

  stop() {
    console.log('🛑 Stopping Hybrid Activity Monitor...');
    
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    
    if (this.keyboardTrackingInterval) {
      clearInterval(this.keyboardTrackingInterval);
      this.keyboardTrackingInterval = null;
    }
    
    if (this.windowTrackingInterval) {
      clearInterval(this.windowTrackingInterval);
      this.windowTrackingInterval = null;
    }
    
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
    
    this.emit('stopped');
  }
}

export { HybridActivityMonitor };
export default HybridActivityMonitor; 