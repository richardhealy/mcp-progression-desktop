const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Settings management
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    
    // Progress submission
    submitProgress: (progressData) => ipcRenderer.invoke('submit-progress', progressData),
    
    // Progress items management
    getProgressItems: () => ipcRenderer.invoke('get-progress-items'),
    updateProgressItem: (item) => ipcRenderer.invoke('update-progress-item', item),
    deleteProgressItem: (id) => ipcRenderer.invoke('delete-progress-item', id),
    
      // Server connection testing
  testServerConnection: () => ipcRenderer.invoke('test-server-connection'),
  
  // Notification testing
  testNotification: () => ipcRenderer.invoke('test-notification'),
  
  // Server status
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    
    // Event listeners
    onTrackingStatusChanged: (callback) => {
        ipcRenderer.on('tracking-status-changed', callback);
        return () => ipcRenderer.removeListener('tracking-status-changed', callback);
    },
    
    onSubmitReportNow: (callback) => {
        ipcRenderer.on('submit-report-now', callback);
        return () => ipcRenderer.removeListener('submit-report-now', callback);
    },
    
    onShowProgressDialog: (callback) => {
        ipcRenderer.on('show-progress-dialog', callback);
        return () => ipcRenderer.removeListener('show-progress-dialog', callback);
    },
    
    onServerStatus: (callback) => {
        ipcRenderer.on('server-status', callback);
        return () => ipcRenderer.removeListener('server-status', callback);
    },
    
    // Platform detection
    platform: process.platform,
    
    // Version info
    versions: process.versions
}); 