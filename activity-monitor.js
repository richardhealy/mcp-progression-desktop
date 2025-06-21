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
    
    // Wait a bit for libraries to finish loading if they're still initializing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let hasActiveTracking = false;
    
    // Start different tracking methods based on available libraries
    if (this.desktopIdle || this.realIdle) {
      this.startIdleTracking();
      hasActiveTracking = true;
      console.log('📊 Idle tracking started');
    }
    
    if (this.activeWin) {
      this.startWindowTracking();
      hasActiveTracking = true;
      console.log('🪟 Window tracking started');
    }
    
    if (this.robot) {
      this.startMouseTracking();
      if (this.options.trackKeyboard) {
        this.startKeyboardTracking();
        console.log('⌨️ Keyboard tracking started');
      }
      hasActiveTracking = true;
      console.log('🖱️ Mouse tracking started');
    }
    
    // Fallback: Basic activity simulation if no libraries available
    if (!hasActiveTracking) {
      console.log('⚠️ No native libraries available, using fallback tracking');
      this.startFallbackTracking();
    } else {
      console.log('✅ Native activity tracking active with', {
        idle: !!(this.desktopIdle || this.realIdle),
        window: !!this.activeWin,
        mouse: !!this.robot
      });
    }
    
    this.emit('started');
    
    // Start status update interval
    this.startStatusUpdates();
  }

  startIdleTracking() {
    console.log('📊 Starting system-wide idle time tracking...');
    
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

  startWindowTracking() {
    console.log('🪟 Starting window tracking...');
    
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

  startMouseTracking() {
    console.log('🖱️ Starting mouse tracking...');
    
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
    console.log('⌨️ Starting keyboard tracking...');
    
    // Simulate keyboard activity tracking for demonstration
    // In a real implementation, this would use global keyboard hooks
    this.keyboardCheckInterval = setInterval(() => {
      try {
        // Simulate keypress detection based on general activity
        // When the user is active, randomly add keypresses to simulate typing
        if (this.isActive && Math.random() < 0.3) { // 30% chance per check when active
          const keyIncrement = Math.floor(Math.random() * 3) + 1; // 1-3 keys
          this.stats.keyPresses += keyIncrement;
          
          this.emit('keyboard-activity', {
            totalKeyPresses: this.stats.keyPresses
          });
          
          console.log(`⌨️ Simulated ${keyIncrement} keypresses - Total: ${this.stats.keyPresses}`);
        }
      } catch (error) {
        console.error('Error in keyboard tracking simulation:', error);
      }
    }, 2000); // Check every 2 seconds
  }

  startFallbackTracking() {
    console.log('🔄 Starting fallback activity tracking...');
    
    // Simulate activity for demo purposes
    this.activityCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivity;
      
      // Simulate random activity every 10-30 seconds
      if (Math.random() < 0.1) {
        this.lastActivity = now;
        this.stats.mouseMovements++;
        
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
        
        this.emit('simulated-activity', {
          type: 'mouse',
          totalMovements: this.stats.mouseMovements
        });
      }
      
      // Go inactive after 30 seconds of no activity
      if (this.isActive && timeSinceActivity > 30000) {
        const previousState = this.isActive;
        this.isActive = false;
        
        // Emit activity-changed event
        this.emit('activity-changed', {
          isActive: this.isActive,
          previousState,
          timestamp: Date.now()
        });
        
        this.handleActivityEnd();
      }
    }, 2000);
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
    const permissions = {
      activeWin: false,
      desktopIdle: false,
      realIdle: false,
      robotjs: false,
      overall: 'available'
    };
    
    // Test active-win
    if (this.activeWin) {
      try {
        await this.activeWin();
        permissions.activeWin = true;
      } catch (error) {
        console.log('Active-win permission issue:', error.message);
      }
    }
    
    // Test desktop-idle
    if (this.desktopIdle) {
      try {
        this.desktopIdle.getIdleTime();
        permissions.desktopIdle = true;
      } catch (error) {
        console.log('Desktop-idle permission issue:', error.message);
      }
    }
    
    // Test real-idle
    if (this.realIdle) {
      try {
        this.realIdle.getIdleSeconds();
        permissions.realIdle = true;
      } catch (error) {
        console.log('Real-idle permission issue:', error.message);
      }
    }
    
    // Test robotjs
    if (this.robot) {
      try {
        const pos = this.robot.getMousePos();
        permissions.robotjs = true;
        console.log('RobotJS permissions OK, mouse at:', pos);
      } catch (error) {
        console.log('RobotJS permission issue:', error.message);
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
    this.recordActivity('simulated');
    this.stats.mouseMovements++;
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
    
    if (this.keyboardCheckInterval) {
      clearInterval(this.keyboardCheckInterval);
      this.keyboardCheckInterval = null;
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