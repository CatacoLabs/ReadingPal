// Initialize context menu items when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Clear any existing context menu items first
  chrome.contextMenus.removeAll(() => {
    console.log('Removed existing context menu items');
    
    // Create parent context menu item
    chrome.contextMenus.create({
      id: 'readingPalRoot',
      title: 'ReadingPal',
      contexts: ['selection']
    });
    
    // Create child items
    chrome.contextMenus.create({
      id: 'summarize',
      parentId: 'readingPalRoot',
      title: 'Summarize this',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'explain',
      parentId: 'readingPalRoot',
      title: 'Explain this',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'simplify',
      parentId: 'readingPalRoot',
      title: 'Simplify this',
      contexts: ['selection']
    });
    
    console.log('Created context menu items');
  });
  
  // Open options page for first-time setup
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});

// Handle the context menu item click
function onContextMenuClick(info, tab) {
  console.log("Context menu clicked:", info.menuItemId);
  
  // Validate that we have a valid tab
  if (!tab || typeof tab.id !== 'number' || tab.id < 0) {
    console.error('Invalid tab ID:', tab?.id);
    
    // Try to get the current active tab instead
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        // Use the first active tab instead
        console.log('Recovered valid tab:', tabs[0].id);
        handleContextMenuAction(info, tabs[0]);
      } else {
        showErrorNotification('Cannot process text on this page. Try a regular web page instead.');
      }
    });
    
    return; // Exit early if there's no valid tab
  }
  
  // If we have a valid tab, proceed normally
  handleContextMenuAction(info, tab);
}

// Helper function to show error notifications
function showErrorNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'ReadingPal',
    message: message,
    priority: 2
  });
}

// Handle the actual context menu action
function handleContextMenuAction(info, tab) {
  if (info.menuItemId === 'summarize' || info.menuItemId === 'explain' || info.menuItemId === 'simplify') {
    console.log("Selected text:", info.selectionText);
    
    // Make a backup of the selected text
    const selectedText = info.selectionText;
    
    // Check if the tab is in a context where content scripts can run
    chrome.tabs.get(tab.id, function(tabInfo) {
      // Check if we can access this tab (chrome:// urls, extension pages, etc. are restricted)
      const url = tabInfo.url || '';
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url === 'about:blank') {
        console.error('Cannot inject content script into this type of page:', url);
        
        // Get appropriate error message based on action type
        let errorMessage = 'Cannot process text on this page. Try a regular web page instead.';
        showErrorNotification(errorMessage);
        
        return;
      }
      
      // Send message to content script with the appropriate action and selected text
      chrome.tabs.sendMessage(
        tab.id, 
        {
          action: 'handleSelectedText',
          text: selectedText,
          type: info.menuItemId,
          timestamp: Date.now() // Add timestamp to ensure uniqueness
        }, 
        (response) => {
          // Log the response if we get one
          if (response) {
            console.log('Response from content script:', response);
          } else {
            // Check for error
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              console.error('Error sending message to content script:', lastError.message);
              
              // Try again with a delay - sometimes the content script isn't ready
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  tab.id, 
                  {
                    action: 'handleSelectedText',
                    text: selectedText,
                    type: info.menuItemId,
                    timestamp: Date.now()
                  }
                );
              }, 500);
            }
          }
        }
      );
    });
  }
}

// Add listener for context menu clicks
chrome.contextMenus.onClicked.addListener(onContextMenuClick);

// Listen for messages from content script or sidebar
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Background script received message:', message);
  
  // Handle specific actions
  if (message.action === 'callClaudeAPI') {
    // Call the API and handle streaming
    callClaudeAPI(message.prompt, message.conversation)
      .then(result => {
        // Send the requestId back immediately so the UI can display the loading state
        // and have a reference for cancellation
        sendResponse({ 
          success: true, 
          requestId: result.requestId,
          streaming: true 
        });
        
        // The actual content will come through separate messages as the stream progresses
      })
      .catch(error => {
        console.error('Error calling Claude API:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Unknown error calling Claude API' 
        });
      });
    return true; // Required for async sendResponse
  } 
  else if (message.action === 'stopStreaming') {
    const stopped = stopStreaming(message.requestId);
    sendResponse({ success: stopped });
    return true;
  }
  else if (message.action === 'verifyApiKey') {
    console.log('Verifying API key...');
    
    if (!message.apiKey) {
      console.error('No API key provided');
      sendResponse({ 
        success: false, 
        error: 'API key is required' 
      });
      return true;
    }
    
    verifyApiKey(message.apiKey)
      .then(models => {
        console.log('API key verified successfully, returning models:', models);
        sendResponse({ 
          success: true, 
          data: models 
        });
      })
      .catch(error => {
        console.error('Error verifying API key:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Unknown error verifying API key' 
        });
      });
    return true; // Required for async sendResponse
  }
  
  // For other messages, just send a generic response
  sendResponse({ 
    status: 'Message received by background script',
    success: true
  });
  
  return true; // Keep the message channel open for async responses
});

// Helper function to get Claude API headers
function getClaudeHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };
}

// Special test function to verify API key without getting models
async function testApiKey(apiKey) {
  try {
    console.log('Performing simple API key test...');
    // Claude API always requires a message, so we'll use the simplest possible request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: getClaudeHeaders(apiKey),
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Use the smallest model for testing
        max_tokens: 1, // Minimize token usage
        system: "You are a test system. Reply with 'OK'.",
        messages: [{ role: 'user', content: 'Test' }]
      })
    });
    
    console.log('Test API response status:', response.status, response.statusText);
    
    // If we get a non-auth error (like 400), the key might still be valid
    // 401/403 means invalid key
    if (response.status === 401 || response.status === 403) {
      throw new Error('API key is invalid or unauthorized');
    }
    
    // Any response that's not 401/403 suggests the key is valid but there might
    // be other issues with the request
    return true;
  } catch (error) {
    console.error('Error testing API key:', error);
    // Only rethrow authentication errors, other errors might be due to CORS
    if (error.message.includes('unauthorized') || 
        error.message.includes('invalid') || 
        error.message.includes('401') || 
        error.message.includes('403')) {
      throw error;
    }
    // Return true if it's a network/CORS error (key might still be valid)
    return true;
  }
}

// Function to verify API key and get available models
async function verifyApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  try {
    console.log('Verifying API key...');
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: getClaudeHeaders(apiKey)
    });
    
    console.log('API response status:', response.status, response.statusText);
    
    // If not OK, try to get the error details
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('API error details:', errorData);
        if (errorData.error) {
          errorMessage = `API Error: ${errorData.error.message || errorData.error.type || JSON.stringify(errorData.error)}`;
        }
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      throw new Error(errorMessage);
    }
    
    // Try to parse the response
    let data;
    try {
      data = await response.json();
      console.log('API response data:', JSON.stringify(data).substring(0, 500) + '...');
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error('Failed to parse API response');
    }
    
    // Check if the response has the expected format
    if (!data) {
      console.error('Empty API response');
      throw new Error('Received empty response from API');
    }
    
    // The Anthropic API returns a paginated response with a 'data' array
    if (data.data && Array.isArray(data.data)) {
      console.log('Found models in data array:', data.data);
      
      // Map the models to the expected format
      const models = data.data.map(model => ({
        id: model.id || '',
        name: model.name || model.id || '',
        description: model.description || ''
      }));
      
      if (models.length > 0) {
        return models;
      } else {
        throw new Error('No models found in API response');
      }
    } else {
      console.error('Unexpected API response format:', data);
      throw new Error('Unexpected API response format');
    }
  } catch (error) {
    console.error('Error verifying API key:', error);
    
    // Special handling for CORS errors
    if (error.message.includes('CORS') || 
        error.message.includes('Failed to fetch') || 
        error.name === 'TypeError') {
      
      console.warn('Possible CORS or network issue, trying fallback API key test');
      
      try {
        // Try a simpler test to just verify the key works
        const isValid = await testApiKey(apiKey);
        
        if (isValid) {
          console.log('API key appears valid based on simplified test');
          return getDefaultModels();
        } else {
          throw new Error('API key verification failed');
        }
      } catch (testError) {
        console.error('API key test failed:', testError);
        throw testError;
      }
    }
    
    // Re-throw the original error if it's not a CORS/network issue
    throw error;
  }
}

// Helper function to get default models
function getDefaultModels() {
  return [
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      description: 'Most powerful model for complex tasks'
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      description: 'Balanced model for most tasks'
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      description: 'Fastest and most compact model'
    }
  ];
}

// Initialize global variables
let activeStreams = new Map();

// Function to call Claude API
async function callClaudeAPI(prompt, conversation) {
  // Get the API key and selected model
  const result = await chrome.storage.local.get(['anthropicApiKey', 'selectedModel']);
  const apiKey = result.anthropicApiKey;
  const model = result.selectedModel || 'claude-3-opus-20240229'; // Default model if none selected
  
  if (!apiKey) {
    throw new Error('API key not found. Please set your Anthropic API key in the extension settings. Click on the extension icon and select "Settings" to configure.');
  }
  
  // Prepare the conversation history for Claude
  let messages = [];
  
  // Add conversation history if available
  if (conversation && conversation.messages && conversation.messages.length > 0) {
    // Filter out any system messages and remove timestamp field from each message
    messages = conversation.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
        // timestamp is intentionally omitted
      }));
  }
  
  // Add the new user message
  messages.push({
    role: "user",
    content: prompt
  });
  
  // System message content
  const systemMessage = "You are Claude, an AI assistant helping users understand text they've selected from webpages. Be concise, helpful, and accurate.";
  
  // Create a unique identifier for this request to track cancellations
  const requestId = Date.now().toString();
  
  try {
    // Create fetch request for streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        ...getClaudeHeaders(apiKey),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1024,
        stream: true,
        system: systemMessage,
        messages: messages
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `API Error: ${response.status} ${response.statusText}`;
      
      // Add specific suggestions for common error codes
      if (response.status === 401 || response.status === 403) {
        throw new Error(`${errorMsg}. Your API key may be invalid. Please check your Anthropic API key in the extension settings.`);
      } else if (response.status === 429) {
        throw new Error(`${errorMsg}. You've hit a rate limit. Please wait a moment before trying again.`);
      } else {
        throw new Error(errorMsg);
      }
    }
    
    // Get response body stream reader
    const reader = response.body.getReader();
    let accumulatedContent = "";
    
    // Store the reader in our active streams map
    activeStreams.set(requestId, reader);
    
    // Create a promise that will be resolved when the stream completes or is cancelled
    const streamPromise = new Promise(async (resolve, reject) => {
      try {
        let done = false;
        
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          
          if (done) {
            // Stream completed normally
            resolve(accumulatedContent);
            break;
          }
          
          // Convert Uint8Array to string
          const chunk = new TextDecoder().decode(value);
          
          try {
            // Process the chunk - it now uses Server-Sent Events (SSE) format
            // Each event has format: "event: event_type\ndata: {json_data}\n\n"
            const lines = chunk.split('\n');
            let currentEvent = '';
            let currentData = '';
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith('event:')) {
                currentEvent = line.substring(6).trim();
              } else if (line.startsWith('data:')) {
                currentData = line.substring(5).trim();
                
                // If we have both event and data, process them
                if (currentEvent && currentData) {
                  try {
                    const data = JSON.parse(currentData);
                    
                    if (currentEvent === 'content_block_delta' && data.delta?.type === 'text_delta') {
                      // Extract and append the text delta
                      const textDelta = data.delta.text || '';
                      accumulatedContent += textDelta;
                      
                      // Send the partial response to the sidebar
                      chrome.runtime.sendMessage({
                        action: 'streamUpdate',
                        requestId: requestId,
                        text: textDelta,
                        done: false
                      });
                    } else if (currentEvent === 'message_stop') {
                      // Message is complete
                      activeStreams.delete(requestId);
                      
                      // Send a final message to indicate completion
                      chrome.runtime.sendMessage({
                        action: 'streamUpdate',
                        requestId: requestId,
                        text: '',
                        done: true
                      });
                    }
                    
                    // Reset for next event
                    currentEvent = '';
                    currentData = '';
                  } catch (jsonError) {
                    console.error('Error parsing SSE data JSON:', jsonError, 'Data:', currentData);
                  }
                }
              } else if (line === '') {
                // Empty line indicates end of an event
                currentEvent = '';
                currentData = '';
              }
            }
          } catch (parseError) {
            console.error('Error parsing streaming response:', parseError, 'Chunk:', chunk);
          }
        }
      } catch (error) {
        if (error.name === 'AbortError' || error.message.includes('abort')) {
          // Stream was aborted by user
          activeStreams.delete(requestId);
          resolve(''); // Resolve with empty string to indicate cancellation
        } else {
          // Some other error occurred
          reject(error);
        }
      }
    });
    
    return {
      requestId: requestId,
      streamPromise: streamPromise
    };
  } catch (error) {
    console.error('Error calling Claude API:', error);
    
    // Make error message more helpful if it's an API key problem
    if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403')) {
      // Show notification to direct user to settings
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'showNotification',
            message: 'API key issue detected. Please check your settings.',
            type: 'error'
          });
        }
      });
    }
    
    throw error;
  }
}

// Function to stop a streaming response
function stopStreaming(requestId) {
  if (activeStreams && activeStreams.has(requestId)) {
    const reader = activeStreams.get(requestId);
    if (reader && typeof reader.cancel === 'function') {
      reader.cancel();
      activeStreams.delete(requestId);
    }
    return true;
  }
  return false; // Stream not found or already completed
}

// Handle browser action (extension icon) click
chrome.action.onClicked.addListener(function(tab) {
  console.log('Extension icon clicked on tab:', tab.id);
  
  // Validate that we have a valid tab
  if (!tab || typeof tab.id !== 'number' || tab.id < 0) {
    console.error('Invalid tab ID:', tab?.id);
    return; // Exit early if there's no valid tab
  }
  
  // Check if the tab is in a context where content scripts can run
  chrome.tabs.get(tab.id, function(tabInfo) {
    // Check if we can access this tab (chrome:// urls, extension pages, etc. are restricted)
    const url = tabInfo.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url === 'about:blank') {
      console.error('Cannot inject content script into this type of page:', url);
      showErrorNotification('ReadingPal cannot be used on this page type.');
      return;
    }
    
    // Send message to content script to toggle sidebar
    chrome.tabs.sendMessage(
      tab.id, 
      { 
        action: 'showSidebar',
        timestamp: Date.now()
      },
      (response) => {
        if (response) {
          console.log('Response from content script:', response);
        } else {
          // Check for error
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error('Error sending message to content script:', lastError.message);
            
            // Try again with a delay - sometimes the content script isn't ready
            setTimeout(() => {
              chrome.tabs.sendMessage(
                tab.id, 
                { 
                  action: 'showSidebar',
                  timestamp: Date.now()
                }
              );
            }, 500);
          }
        }
      }
    );
  });
}); 