// Content script for MCP Progress Tracker
// This script runs in the context of web pages and handles modal injection

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showProgressModal') {
      showProgressModal();
      sendResponse({ success: true });
    }
  });
  
  function showProgressModal() {
    // Remove any existing modal
    const existingModal = document.getElementById('mcp-progress-modal');
    if (existingModal) {
      existingModal.remove();
    }
  
    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'mcp-progress-modal';
    modal.innerHTML = `
      <div class="mcp-modal-overlay">
        <div class="mcp-modal-content">
          <div class="mcp-modal-header">
            <h3>Hourly Progress Report</h3>
            <button class="mcp-close-btn" id="mcp-close-btn">&times;</button>
          </div>
          <div class="mcp-modal-body">
            <div class="mcp-form-group">
              <label class="mcp-label" for="mcp-project-select">Project:</label>
              <select id="mcp-project-select" class="mcp-select">
                <!-- Options will be populated by JS -->
              </select>
            </div>
            <div class="mcp-form-group">
              <label class="mcp-label" for="mcp-progress-text">What have you accomplished in the past hour?</label>
              <textarea 
                id="mcp-progress-text" 
                placeholder="Enter your progress update..." 
                rows="4"
              ></textarea>
            </div>
            <div class="mcp-quick-actions">
              <span class="mcp-label">Quick actions:</span>
              <button class="mcp-quick-btn" data-text="Completed coding tasks and reviewed pull requests">Code Review</button>
              <button class="mcp-quick-btn" data-text="Attended meetings and updated project status">Meetings</button>
              <button class="mcp-quick-btn" data-text="Researched and documented new features">Research</button>
              <button class="mcp-quick-btn" data-text="Fixed bugs and improved code quality">Bug Fixes</button>
            </div>
          </div>
          <div class="mcp-modal-footer">
            <button id="mcp-submit-btn" class="mcp-btn mcp-btn-primary">Submit Report</button>
            <button id="mcp-dismiss-btn" class="mcp-btn mcp-btn-secondary">Dismiss</button>
            <button id="mcp-pause-btn" class="mcp-btn mcp-btn-warning">Pause 2 Hours</button>
          </div>
        </div>
      </div>
    `;
  
    // Add comprehensive styles
    const style = document.createElement('style');
    style.id = 'mcp-modal-styles';
    style.textContent = `
      #mcp-progress-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .mcp-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
        animation: mcpFadeIn 0.2s ease-out;
      }
      
      @keyframes mcpFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .mcp-modal-content {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
        animation: mcpSlideIn 0.3s ease-out;
        border: 1px solid #e1e5e9;
      }
      
      @keyframes mcpSlideIn {
        from { 
          opacity: 0;
          transform: translateY(-30px) scale(0.95);
        }
        to { 
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .mcp-modal-header {
        padding: 24px 24px 16px;
        border-bottom: 1px solid #e1e5e9;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .mcp-modal-header h3 {
        margin: 0;
        color: #1a1a1a;
        font-size: 18px;
        font-weight: 600;
      }
      
      .mcp-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }
      
      .mcp-close-btn:hover {
        background-color: #f3f4f6;
        color: #374151;
      }
      
      .mcp-modal-body {
        padding: 24px;
      }
      
      .mcp-modal-body p {
        margin: 0 0 16px 0;
        color: #4b5563;
        font-size: 15px;
      }
      
      #mcp-progress-text {
        width: 100%;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 100px;
        margin-bottom: 20px;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
        background: #fafbfc;
        color: #1a1a1a;
      }
      
      #mcp-progress-text:focus {
        outline: none;
        border-color: #3b82f6;
        background: white;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      #mcp-progress-text::placeholder {
        color: #9ca3af;
      }
      
      .mcp-quick-actions {
        margin-bottom: 20px;
      }
      
      .mcp-form-group {
        margin-bottom: 16px;
      }
      
      .mcp-label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        color: #6b7280;
        font-weight: 500;
      }
      
      .mcp-select {
        width: 100%;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 14px;
        font-family: inherit;
        background: #fafbfc;
        color: #1a1a1a;
        cursor: pointer;
        transition: border-color 0.2s ease;
      }
      
      .mcp-select:focus {
        outline: none;
        border-color: #3b82f6;
        background: white;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .mcp-quick-btn {
        display: inline-block;
        margin: 0 8px 8px 0;
        padding: 6px 12px;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        color: #374151;
      }
      
      .mcp-quick-btn:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
      }
      
      .mcp-modal-footer {
        padding: 16px 24px 24px;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        border-top: 1px solid #e1e5e9;
      }
      
      .mcp-btn {
        padding: 10px 20px;
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
        font-family: inherit;
      }
      
      .mcp-btn-primary {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
      }
      
      .mcp-btn-primary:hover {
        background: #2563eb;
        border-color: #2563eb;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      }
      
      .mcp-btn-secondary {
        background: white;
        color: #374151;
        border-color: #d1d5db;
      }
      
      .mcp-btn-secondary:hover {
        background: #f9fafb;
        border-color: #9ca3af;
      }
      
      .mcp-btn-warning {
        background: #f59e0b;
        color: white;
        border-color: #f59e0b;
      }
      
      .mcp-btn-warning:hover {
        background: #d97706;
        border-color: #d97706;
      }
      
      .mcp-btn:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .mcp-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }
      
      /* Ensure modal appears above all other content */
      .mcp-modal-overlay * {
        box-sizing: border-box;
      }
    `;
  
    // Remove any existing styles
    const existingStyles = document.getElementById('mcp-modal-styles');
    if (existingStyles) {
      existingStyles.remove();
    }
  
    // Add modal to page
    document.head.appendChild(style);
    document.body.appendChild(modal);
  
    // Add event listeners
    setupModalEventListeners(modal);
    
    // Populate projects
    populateProjects();
  
    // Focus on textarea
    setTimeout(() => {
      document.getElementById('mcp-progress-text').focus();
    }, 100);
  }
  
  function setupModalEventListeners(modal) {
    const textarea = document.getElementById('mcp-progress-text');
    const submitBtn = document.getElementById('mcp-submit-btn');
    const dismissBtn = document.getElementById('mcp-dismiss-btn');
    const pauseBtn = document.getElementById('mcp-pause-btn');
    const closeBtn = document.getElementById('mcp-close-btn');
    
    // Auto-close timer (5 minutes = 300000ms)
    const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    function resetInactivityTimer() {
      if (window.mcpInactivityTimer) {
        clearTimeout(window.mcpInactivityTimer);
      }
      if (window.mcpWarningTimer) {
        clearTimeout(window.mcpWarningTimer);
      }
      
      // Clear any existing warning
      clearInactivityWarning();
      
      // Show warning after 4 minutes, auto-close after 5 minutes
      window.mcpWarningTimer = setTimeout(() => {
        if (!textarea.value.trim()) {
          showInactivityWarning();
        }
      }, INACTIVITY_TIMEOUT - 60000); // 4 minutes
      
      window.mcpInactivityTimer = setTimeout(() => {
        // Check if textarea is empty before auto-closing
        if (!textarea.value.trim()) {
          console.log('Auto-closing modal due to 5 minutes of inactivity with empty textarea');
          removeModal();
        }
      }, INACTIVITY_TIMEOUT);
    }
    
    // Start the inactivity timer
    resetInactivityTimer();
  
    // Quick action buttons
    document.querySelectorAll('.mcp-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentText = textarea.value.trim();
        const quickText = btn.getAttribute('data-text');
        
        if (currentText) {
          textarea.value = currentText + '\n' + quickText;
        } else {
          textarea.value = quickText;
        }
        
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      });
    });
  
    // Submit button
    submitBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      const projectSelect = document.getElementById('mcp-project-select');
      const selectedProject = projectSelect.value;
      
      if (text) {
        // Show loading state
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;
        
        chrome.runtime.sendMessage({
          action: 'submitProgress',
          data: { 
            progress: text, 
            project: selectedProject,
            timestamp: new Date().toISOString() 
          }
        }, (response) => {
          if (response && response.success) {
            showSuccessMessage();
          } else {
            // Reset button state on error
            submitBtn.textContent = 'Submit Report';
            submitBtn.disabled = false;
          }
        });
      } else {
        textarea.focus();
        textarea.style.borderColor = '#ef4444';
        setTimeout(() => {
          textarea.style.borderColor = '#d1d5db';
        }, 2000);
      }
    });
  
    // Dismiss button
    dismissBtn.addEventListener('click', removeModal);
  
    // Close button
    closeBtn.addEventListener('click', removeModal);
  
    // Pause button
    pauseBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'pauseTracking', hours: 2 });
      removeModal();
    });
  
    // Close on overlay click
    modal.querySelector('.mcp-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        removeModal();
      }
    });
  
    // Handle keyboard shortcuts
    document.addEventListener('keydown', handleModalKeydown);
  
    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(100, textarea.scrollHeight) + 'px';
      resetInactivityTimer(); // Reset timer on typing
    });
    
    // Reset inactivity timer on various user interactions
    textarea.addEventListener('focus', resetInactivityTimer);
    textarea.addEventListener('keydown', resetInactivityTimer);
    textarea.addEventListener('click', resetInactivityTimer);
    
    // Reset timer on button clicks
    [submitBtn, dismissBtn, pauseBtn, closeBtn].forEach(btn => {
      if (btn) btn.addEventListener('click', resetInactivityTimer);
    });
    
    // Reset timer on quick action button clicks
    document.querySelectorAll('.mcp-quick-btn').forEach(btn => {
      btn.addEventListener('click', resetInactivityTimer);
    });
    
    // Reset timer on project selection change
    const projectSelect = document.getElementById('mcp-project-select');
    if (projectSelect) {
      projectSelect.addEventListener('change', resetInactivityTimer);
      projectSelect.addEventListener('click', resetInactivityTimer);
    }
    
    // Reset timer on any modal interaction
    modal.addEventListener('click', resetInactivityTimer);
    modal.addEventListener('keydown', resetInactivityTimer);
    
    // Clear timers when modal is removed
    window.addEventListener('beforeunload', () => {
      if (window.mcpInactivityTimer) clearTimeout(window.mcpInactivityTimer);
      if (window.mcpWarningTimer) clearTimeout(window.mcpWarningTimer);
    });
  }
  
  function handleModalKeydown(e) {
    if (!document.getElementById('mcp-progress-modal')) return;
  
    // Escape key to close
    if (e.key === 'Escape') {
      removeModal();
    }
    
    // Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const submitBtn = document.getElementById('mcp-submit-btn');
      if (submitBtn) {
        submitBtn.click();
      }
    }
  }
  
  function showSuccessMessage() {
    const modal = document.getElementById('mcp-progress-modal');
    if (!modal) return;
    
    const modalContent = modal.querySelector('.mcp-modal-content');
    modalContent.innerHTML = `
      <div class="mcp-success-content">
        <div class="mcp-success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#10b981" stroke="none"/>
            <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3>Progress Submitted!</h3>
        <p>Your progress update has been saved successfully.</p>
        <button id="mcp-success-close" class="mcp-btn mcp-btn-primary">Close</button>
      </div>
    `;
    
    // Add success-specific styles
    const successStyle = document.createElement('style');
    successStyle.id = 'mcp-success-styles';
    successStyle.textContent = `
      .mcp-success-content {
        text-align: center;
        padding: 20px;
      }
      
      .mcp-success-icon {
        margin: 0 auto 20px auto;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: mcpSuccessBounce 0.6s ease-out;
      }
      
      @keyframes mcpSuccessBounce {
        0% { transform: scale(0); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      .mcp-success-content h3 {
        color: #10b981;
        margin: 0 0 12px 0;
        font-size: 20px;
        font-weight: 600;
      }
      
      .mcp-success-content p {
        color: #6b7280;
        margin: 0 0 24px 0;
        font-size: 15px;
      }
    `;
    
    document.head.appendChild(successStyle);
    
    // Add close button listener
    document.getElementById('mcp-success-close').addEventListener('click', () => {
      removeModal();
    });
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      removeModal();
    }, 3000);
  }

  function populateProjects() {
    // Get projects from settings via background script
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      const projectSelect = document.getElementById('mcp-project-select');
      if (!projectSelect) return;
      
      const settings = response?.settings || {};
      const projects = settings.projects || ['Nestly', 'GGSA'];
      const defaultProject = settings.defaultProject || projects[0];
      
      // Clear existing options
      projectSelect.innerHTML = '';
      
      // Add project options
      projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        if (project === defaultProject) {
          option.selected = true;
        }
        projectSelect.appendChild(option);
      });
    });
  }
  
  function showInactivityWarning() {
    const modal = document.getElementById('mcp-progress-modal');
    if (!modal) return;
    
    // Remove any existing warning
    clearInactivityWarning();
    
    const warningElement = document.createElement('div');
    warningElement.id = 'mcp-inactivity-warning';
    warningElement.innerHTML = `
      <div class="mcp-warning-content">
        <span class="mcp-warning-icon">⏰</span>
        <span class="mcp-warning-text">Modal will close in 1 minute due to inactivity</span>
      </div>
    `;
    
    // Add warning styles
    const warningStyle = document.createElement('style');
    warningStyle.id = 'mcp-warning-styles';
    warningStyle.textContent = `
      #mcp-inactivity-warning {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #fbbf24;
        color: #92400e;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        animation: mcpWarningSlideIn 0.3s ease-out;
        z-index: 1000;
      }
      
      .mcp-warning-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .mcp-warning-icon {
        font-size: 14px;
      }
      
      @keyframes mcpWarningSlideIn {
        from { 
          opacity: 0;
          transform: translateX(-50%) translateY(-10px);
        }
        to { 
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    
    document.head.appendChild(warningStyle);
    modal.querySelector('.mcp-modal-overlay').appendChild(warningElement);
  }
  
  function clearInactivityWarning() {
    const warning = document.getElementById('mcp-inactivity-warning');
    const warningStyles = document.getElementById('mcp-warning-styles');
    
    if (warning) warning.remove();
    if (warningStyles) warningStyles.remove();
  }

  function removeModal() {
    const modal = document.getElementById('mcp-progress-modal');
    const styles = document.getElementById('mcp-modal-styles');
    const successStyles = document.getElementById('mcp-success-styles');
    const warningStyles = document.getElementById('mcp-warning-styles');
    
    // Clear any active inactivity timers
    if (window.mcpInactivityTimer) {
      clearTimeout(window.mcpInactivityTimer);
      window.mcpInactivityTimer = null;
    }
    if (window.mcpWarningTimer) {
      clearTimeout(window.mcpWarningTimer);
      window.mcpWarningTimer = null;
    }
    
    // Clear warning
    clearInactivityWarning();
    
    if (modal) {
      modal.style.animation = 'mcpFadeOut 0.2s ease-in forwards';
      setTimeout(() => {
        modal.remove();
        if (styles) styles.remove();
        if (successStyles) successStyles.remove();
        if (warningStyles) warningStyles.remove();
        document.removeEventListener('keydown', handleModalKeydown);
      }, 200);
    }
  }
  
  // Add fade out animation
  const fadeOutStyle = document.createElement('style');
  fadeOutStyle.textContent = `
    @keyframes mcpFadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(fadeOutStyle);