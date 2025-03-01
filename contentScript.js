// Variables
let sidebarFrame = null;
let sidebarVisible = false;
let originalStyles = null;
let styleElement = null;
let resizeHandle = null;
const SIDEBAR_WIDTH = '350px';
const SIDEBAR_WIDTH_NUM = 350; // Numeric value of sidebar width for calculations
const MIN_SIDEBAR_WIDTH = 250;
const MAX_SIDEBAR_WIDTH = 600;
let currentWidth = SIDEBAR_WIDTH_NUM;
let resizeInProgress = false;

// Store any pending text to process
let pendingText = null;
let pendingAction = null;

// Create and show an in-page notification for the user
function showNotification(message, type = 'info') {
  // Create notification element if it doesn't exist
  let notification = document.getElementById('readingpal-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'readingpal-notification';
    
    // Base styles
    const baseStyles = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 15px;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 2147483646;
      font-family: Arial, sans-serif;
      font-size: 14px;
      transition: opacity 0.3s ease;
      color: white;
      max-width: 300px;
    `;
    
    notification.style.cssText = baseStyles;
    document.body.appendChild(notification);
  }
  
  // Set color based on type
  const bgColor = type === 'error' ? '#f44336' : 
                 type === 'warning' ? '#ff9800' : 
                 '#2196F3'; // info (default)
  
  notification.style.backgroundColor = bgColor;
  
  // Set message and show notification
  notification.textContent = message;
  notification.style.opacity = '1';
  
  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Create and inject the custom styles for handling the sidebar
function injectCustomStyles() {
  // If already injected, don't do it again
  if (styleElement) return;
  
  // Create style element
  styleElement = document.createElement('style');
  styleElement.id = 'readingpal-styles';
  
  // Define the CSS
  styleElement.textContent = `
    /* When sidebar is active, adjust content */
    body.readingpal-active {
      transition: margin-right 0.3s ease !important;
      margin-right: ${SIDEBAR_WIDTH} !important;
      overflow-x: hidden !important;
    }
    
    /* For common container elements - add padding instead of margin for better layout */
    body.readingpal-active .container,
    body.readingpal-active main,
    body.readingpal-active article,
    body.readingpal-active #content,
    body.readingpal-active .content,
    body.readingpal-active .main-content {
      max-width: calc(100% - ${SIDEBAR_WIDTH_NUM}px) !important;
      width: calc(100% - ${SIDEBAR_WIDTH_NUM}px) !important;
      transition: max-width 0.3s ease, width 0.3s ease !important;
    }
    
    /* Ensure the sidebar iframe is displayed over other elements */
    #readingpal-sidebar-frame {
      box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2) !important;
      z-index: 2147483647 !important; /* Maximum z-index value */
    }
    
    /* Resize handle styles */
    #readingpal-resize-handle {
      position: fixed;
      top: 0;
      bottom: 0;
      width: 20px; /* Increased width for easier targeting */
      cursor: col-resize;
      z-index: 2147483647;
      background-color: transparent;
      transition: background-color 0.2s ease;
    }
    
    #readingpal-resize-handle:hover,
    #readingpal-resize-handle.dragging {
      background-color: rgba(33, 150, 243, 0.3); /* Blue color to match the header */
    }
    
    #readingpal-resize-handle::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 2px;
    }
    
    #readingpal-resize-handle:hover::after,
    #readingpal-resize-handle.dragging::after {
      background-color: rgba(33, 150, 243, 0.8); /* Blue color to match the header */
      box-shadow: 0 0 4px rgba(33, 150, 243, 0.5);
    }
    
    /* Resize overlay to capture mouse events during resize */
    #readingpal-resize-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483646; /* Just below the resize handle */
      display: none;
      cursor: col-resize;
    }
    
    #readingpal-resize-overlay.active {
      display: block;
    }
  `;
  
  // Append to the document head
  document.head.appendChild(styleElement);
  console.log('ReadingPal custom styles injected');
}

// Create and inject the sidebar iframe
function createSidebar() {
  // If sidebar already exists, return it
  if (sidebarFrame) {
    console.log('Sidebar already exists, reusing');
    return sidebarFrame;
  }
  
  console.log('Creating new sidebar iframe');
  
  // Inject custom styles
  injectCustomStyles();
  
  // Create the iframe
  sidebarFrame = document.createElement('iframe');
  sidebarFrame.id = 'readingpal-sidebar-frame';
  
  // Set attributes
  sidebarFrame.src = chrome.runtime.getURL('sidebar.html');
  sidebarFrame.setAttribute('frameborder', '0');
  sidebarFrame.setAttribute('allowtransparency', 'true');
  
  // Set styles
  const styles = {
    position: 'fixed',
    top: '0',
    right: '0',
    width: currentWidth + 'px',
    height: '100%',
    zIndex: '2147483647',
    backgroundColor: 'white',
    boxShadow: '-2px 0 5px rgba(0, 0, 0, 0.2)',
    display: 'none', // Start hidden
    border: 'none'
  };
  
  // Apply styles
  Object.assign(sidebarFrame.style, styles);
  
  // Add load event listener to ensure iframe is fully loaded
  sidebarFrame.addEventListener('load', function() {
    console.log('Sidebar iframe loaded, marking as ready');
    sidebarFrame.dataset.loaded = 'true';
    
    // Trigger a custom event that others can listen for
    const readyEvent = new CustomEvent('readingpal-sidebar-ready');
    document.dispatchEvent(readyEvent);
  });
  
  // Add error event listener to detect load failures
  sidebarFrame.addEventListener('error', function(error) {
    console.error('Error loading sidebar iframe:', error);
  });
  
  // Append to the document
  document.body.appendChild(sidebarFrame);
  
  // Create resize handle
  createResizeHandle();
  
  console.log('Sidebar iframe created with width:', currentWidth + 'px');
  
  return sidebarFrame;
}

// Create resize handle with improved functionality
function createResizeHandle() {
  if (resizeHandle) return;
  
  // Create resize handle
  resizeHandle = document.createElement('div');
  resizeHandle.id = 'readingpal-resize-handle';
  
  // Create resize overlay for better mouse tracking
  const resizeOverlay = document.createElement('div');
  resizeOverlay.id = 'readingpal-resize-overlay';
  
  // Set initial position
  updateResizeHandlePosition();
  
  // Add event listeners for dragging
  let isDragging = false;
  let startX, startWidth;
  
  // Function to start resize
  function startResize(e) {
    isDragging = true;
    resizeInProgress = true;
    resizeHandle.classList.add('dragging');
    resizeOverlay.classList.add('active');
    startX = e.clientX;
    startWidth = currentWidth;
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    
    // Add listeners to document for tracking mouse movement
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
  }
  
  // Improved mouse move handler
  function handleMouseMove(e) {
    if (!isDragging) return;
    
    // Calculate the change in width (dragging from left to right)
    const change = startX - e.clientX;
    let newWidth = startWidth + change;
    
    // Enforce minimum and maximum width
    newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
    
    // Update the sidebar width
    requestAnimationFrame(() => {
      updateSidebarWidth(newWidth);
    });
    
    e.preventDefault();
  }
  
  // Improved mouse up handler
  function handleMouseUp(e) {
    if (!isDragging) return;
    
    isDragging = false;
    resizeInProgress = false;
    resizeHandle.classList.remove('dragging');
    resizeOverlay.classList.remove('active');
    
    // Restore text selection
    document.body.style.userSelect = '';
    
    // Remove document event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
    e.stopPropagation();
    
    // Save the current width to local storage for persistence
    chrome.storage.local.set({ 'ReadingPalSidebarWidth': currentWidth });
  }
  
  // Add event listeners
  resizeHandle.addEventListener('mousedown', startResize);
  
  // Append to the document
  document.body.appendChild(resizeHandle);
  document.body.appendChild(resizeOverlay);
}

// Update the position of the resize handle
function updateResizeHandlePosition() {
  if (!resizeHandle) return;
  
  // Position to the left of the sidebar
  const leftPosition = document.documentElement.clientWidth - currentWidth;
  resizeHandle.style.left = (leftPosition - 10) + 'px'; // Center the 20px handle
}

// Update the sidebar width with smoother animation
function updateSidebarWidth(newWidth) {
  if (!sidebarFrame) return;
  
  currentWidth = newWidth;
  const widthPx = newWidth + 'px';
  
  // Update sidebar iframe
  sidebarFrame.style.width = widthPx;
  
  // Update body margin
  document.body.style.marginRight = widthPx;
  
  // Update stylesheet variables
  if (styleElement) {
    styleElement.textContent = styleElement.textContent
      .replace(/margin-right: [^!]+!important/g, `margin-right: ${widthPx} !important`)
      .replace(/max-width: calc\(100% - \d+px\) !important/g, `max-width: calc(100% - ${newWidth}px) !important`)
      .replace(/width: calc\(100% - \d+px\) !important/g, `width: calc(100% - ${newWidth}px) !important`);
  }
  
  // Update resize handle position
  updateResizeHandlePosition();
}

// Save original styles of elements
function saveOriginalStyles() {
  if (originalStyles) return;
  
  originalStyles = {
    bodyClassName: document.body.className || '',
    marginRight: document.body.style.marginRight || '0'
  };
}

// Debug function to inspect the state of the sidebar
function debugSidebar() {
  if (!sidebarFrame) {
    console.log('Sidebar frame does not exist');
    return;
  }
  
  console.log('Sidebar frame exists, loaded:', sidebarFrame.dataset.loaded === 'true');
  console.log('Sidebar frame style transform:', sidebarFrame.style.transform);
  
  try {
    // Try to access the contentDocument and contentWindow
    const hasContentDocument = !!sidebarFrame.contentDocument;
    const hasContentWindow = !!sidebarFrame.contentWindow;
    console.log('Sidebar has contentDocument:', hasContentDocument);
    console.log('Sidebar has contentWindow:', hasContentWindow);
    
    // Try to access DOM elements in the iframe
    if (hasContentDocument) {
      const messageInput = sidebarFrame.contentDocument.getElementById('messageInput');
      console.log('Found messageInput in sidebar:', !!messageInput);
      
      if (messageInput) {
        console.log('messageInput current value length:', messageInput.value.length);
      }
    }
  } catch (error) {
    console.error('Error accessing sidebar iframe DOM:', error);
  }
}

// Show the sidebar
function showSidebar() {
  if (sidebarVisible) return;
  
  // Create sidebar if it doesn't exist
  if (!sidebarFrame) {
    sidebarFrame = createSidebar();
  }
  
  // Load saved width from storage
  chrome.storage.local.get(['ReadingPalSidebarWidth'], function(result) {
    if (result.ReadingPalSidebarWidth) {
      currentWidth = result.ReadingPalSidebarWidth;
      console.log('Loaded saved sidebar width:', currentWidth);
    }
    
    // Create resize handle if it doesn't exist
    if (!resizeHandle) {
      createResizeHandle();
    }
    
    // Save original styles
    saveOriginalStyles();
    
    // Add active class to body
    document.body.classList.add('readingpal-active');
    
    // Show the sidebar
    sidebarFrame.style.display = 'block';
    sidebarFrame.style.width = currentWidth + 'px';
    document.body.style.marginRight = currentWidth + 'px';
    
    // Show and position the resize handle
    if (resizeHandle) {
      resizeHandle.style.display = 'block';
      updateResizeHandlePosition();
    }
    
    // Mark sidebar as visible
    sidebarVisible = true;
    
    console.log('Sidebar shown with width:', currentWidth + 'px');
    
    // Add window resize listener to keep resize handle positioned correctly
    window.addEventListener('resize', updateResizeHandlePosition);
  });
}

// Hide the sidebar
function hideSidebar() {
  if (!sidebarVisible || !sidebarFrame) return;
  
  // Hide the sidebar
  sidebarFrame.style.display = 'none';
  
  // Remove active class from body
  document.body.classList.remove('readingpal-active');
  
  // Reset body margin
  document.body.style.marginRight = originalStyles?.marginRight || '0';
  
  // Hide resize handle
  if (resizeHandle) {
    resizeHandle.style.display = 'none';
  }
  
  // Mark sidebar as hidden
  sidebarVisible = false;
  
  // Remove window resize listener
  window.removeEventListener('resize', updateResizeHandlePosition);
  
  console.log('Sidebar hidden');
}

// Toggle the sidebar
function toggleSidebar() {
  if (sidebarVisible) {
    hideSidebar();
  } else {
    showSidebar();
  }
}

// Handle selected text and send it to the sidebar
function handleSelectedText(text, action = 'summarize') {
  console.log(`handleSelectedText called with action: ${action}, text length: ${text?.length}`);
  
  // Safety check in case text is undefined
  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.error('No valid text was provided to handleSelectedText');
    showNotification('Please select some text first.', 'warning');
    return;
  }
  
  // Make a backup copy of the selected text
  const selectedText = text;
  
  // Check if text is too short for meaningful processing
  if (selectedText.trim().length < 10) {
    console.warn('Selected text is too short for meaningful processing');
    showNotification('Selected text is too short. Please select a longer passage.', 'warning');
    return;
  }
  
  // Check if text is very long and might cause issues
  if (selectedText.length > 10000) {
    console.warn('Selected text is very long, this might affect response quality');
    showNotification('Selected text is very long. Consider selecting a smaller passage for better results.', 'warning');
    // Note: we still proceed with processing, just warn the user
  }
  
  // Show the sidebar
  showSidebar();
  
  // Check if sidebar frame exists and is loaded
  if (!sidebarFrame || !sidebarFrame.dataset.loaded) {
    console.log('Sidebar not fully loaded yet, storing text as pending');
    
    // Store the text as pending
    pendingText = selectedText;
    pendingAction = action;
    
    // Make sure the sidebar is created
    if (!sidebarFrame) {
      createSidebar();
    }
    
    return;
  }
  
  // Function to send text to sidebar with retry capability
  const sendTextToSidebar = (attempt = 1, maxAttempts = 5) => {
    console.log(`Attempt ${attempt} to send text to sidebar`);
    
    // Check if sidebar frame exists and is loaded
    if (!sidebarFrame || !sidebarFrame.dataset.loaded) {
      console.log('Sidebar not fully loaded yet, waiting...');
      
      if (attempt < maxAttempts) {
        // Wait and retry
        setTimeout(() => sendTextToSidebar(attempt + 1, maxAttempts), 500);
        return;
      } else {
        console.error('Max attempts reached. Sidebar not ready.');
        // Notify the user about the issue
        showNotification('Unable to process selected text. Please try again.', 'error');
        // Try to create sidebar as a last resort
        createSidebar();
        return;
      }
    }
    
    // Try to send message to sidebar iframe
    try {
      console.log(`Sending ${action} message to sidebar with text length: ${selectedText.length}`);
      
      // Add timestamp to ensure message uniqueness
      const message = {
        action: action,
        text: selectedText,
        timestamp: Date.now()
      };
      
      // First try using postMessage
      sidebarFrame.contentWindow.postMessage(message, '*');
      console.log('Message posted to sidebar');
      
      // Also try direct DOM manipulation as a backup
      try {
        if (sidebarFrame.contentDocument) {
          const messageInput = sidebarFrame.contentDocument.getElementById('messageInput');
          if (messageInput) {
            console.log('Found messageInput, setting value directly');
            
            // Set prefix based on action
            let prefix = '';
            if (action === 'summarize') {
              prefix = 'Summarize this: ';
            } else if (action === 'explain') {
              prefix = 'Explain this: ';
            } else if (action === 'simplify') {
              prefix = 'Simplify this: ';
            }
            
            messageInput.value = prefix + selectedText;
            
            // Trigger input event to handle auto-resizing
            const inputEvent = new Event('input', { bubbles: true });
            messageInput.dispatchEvent(inputEvent);
            
            // Focus on the input
            messageInput.focus();
          } else {
            console.error('Could not find messageInput in sidebar DOM');
            showNotification('Unable to prepare text for processing. Please try again.', 'warning');
          }
        }
      } catch (err) {
        console.error('Error directly manipulating sidebar DOM:', err);
        showNotification('Problem accessing sidebar. Please try refreshing the page.', 'error');
      }
      
    } catch (error) {
      console.error('Error sending selected text to sidebar:', error);
      showNotification('Failed to send text to sidebar. Please try again.', 'error');
    }
  };
  
  // Start the send process
  sendTextToSidebar();
  
  // Also debug the sidebar state
  setTimeout(debugSidebar, 1000);
}

// Get the page content
function getPageContent() {
  // Get the main content of the page
  // This is a simple implementation that gets all text content
  // You might want to refine this to get more meaningful content
  const bodyText = document.body.innerText;
  
  // Limit the content to a reasonable size (first 5000 characters)
  const limitedContent = bodyText.substring(0, 5000);
  
  return limitedContent;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Content script received message:', message);
  
  // Send an immediate response to acknowledge receipt
  sendResponse({ status: 'Message received by content script' });
  
  // Check for action type
  if (message.action === 'showSidebar') {
    console.log('Showing sidebar');
    showSidebar();
    
    // If there's selected text, process it
    if (message.selectedText) {
      console.log('Processing selected text from showSidebar message');
      const textToProcess = message.selectedText;
      const typeToProcess = message.type || 'summarize';
      
      // Function to process the text when sidebar is ready
      const processPendingText = () => {
        handleSelectedText(textToProcess, typeToProcess);
      };
      
      // Wait a bit for the sidebar to be ready
      setTimeout(processPendingText, 500);
    }
  }
  else if (message.action === 'handleSelectedText') {
    console.log('Handling selected text from message');
    
    // Get the text and type from the message
    const text = message.text || message.selectedText;
    const action = message.type || 'summarize';
    
    // Make sure we have text
    if (!text || text.trim() === '') {
      console.error('No text provided in message');
      return;
    }
    
    // Handle the text
    handleSelectedText(text, action);
  }
  else if (message.action === 'showNotification') {
    // Show in-page notification with the provided message and type
    const messageText = message.message || 'Something happened'; 
    const messageType = message.type || 'info';
    showNotification(messageText, messageType);
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Listen for messages from the sidebar
window.addEventListener('message', (event) => {
  // Check if message is from sidebar
  if (event.source === sidebarFrame?.contentWindow) {
    console.log('Message from sidebar:', event.data);
    
    if (event.data.action === 'closeSidebar') {
      hideSidebar();
    } else if (event.data.action === 'getPageContent') {
      // Get the page content and send it back to the sidebar
      const pageContent = getPageContent();
      sidebarFrame.contentWindow.postMessage({
        action: 'receivePageContent',
        pageContent: pageContent
      }, '*');
    } else if (event.data.action === 'sidebarReady') {
      console.log('Sidebar notified content script that it is ready');
      
      // If we have pending text to process, do it now
      if (pendingText) {
        console.log('Processing pending text now that sidebar is ready');
        handleSelectedText(pendingText, pendingAction || 'summarize');
        
        // Clear the pending text
        pendingText = null;
        pendingAction = null;
      }
    }
  }
});

// Check if the sidebar should be shown when the page loads
chrome.storage.local.get(['ReadingPalEnabled'], function(result) {
  if (result.ReadingPalEnabled) {
    createSidebar();
    showSidebar();
  }
}); 