document.addEventListener('DOMContentLoaded', function() {
  const toggleSidebar = document.getElementById('toggleSidebar');
  const settingsLink = document.getElementById('settingsLink');
  const refreshButton = document.getElementById('refreshButton');
  const refreshButtonContainer = document.getElementById('refreshButtonContainer');
  
  let originalToggleState = false;
  
  // Load the current state of the sidebar toggle
  chrome.storage.local.get(['ReadingPalEnabled'], function(result) {
    originalToggleState = result.ReadingPalEnabled || false;
    toggleSidebar.checked = originalToggleState;
  });
  
  // Handle toggle change
  toggleSidebar.addEventListener('change', function() {
    const isEnabled = toggleSidebar.checked;
    
    // Save the toggle state
    chrome.storage.local.set({ ReadingPalEnabled: isEnabled });
    
    // Send message to the active tab to show/hide sidebar
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: isEnabled ? 'showSidebar' : 'hideSidebar' 
        });
      }
    });
    
    // Show refresh button if the toggle state has changed
    if (isEnabled !== originalToggleState) {
      refreshButtonContainer.style.display = 'block';
    } else {
      refreshButtonContainer.style.display = 'none';
    }
  });
  
  // Handle refresh button click
  refreshButton.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
        window.close(); // Close the popup
      }
    });
  });
  
  // Handle settings link click
  settingsLink.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}); 