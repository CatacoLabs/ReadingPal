// Initialize variables
let conversation = { messages: [] };
let selectedText = '';
let pendingQuestion = '';
let currentStreamingRequestId = null;

// DOM elements
const conversationContainer = document.getElementById('conversationContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
const closeButton = document.getElementById('closeButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const suggestionsContainer = document.getElementById('suggestionsContainer');
const settingsButton = document.getElementById('settingsButton');

// Create a stop button for streaming
const stopButton = document.createElement('button');
stopButton.id = 'stopButton';
stopButton.className = 'action-button cancel-button';
stopButton.textContent = 'Stop';
stopButton.style.display = 'none';
stopButton.title = 'Stop generating response';
// Insert stop button next to send button
sendButton.parentNode.insertBefore(stopButton, sendButton.nextSibling);

// Add stop button listener
stopButton.addEventListener('click', stopGenerating);

// Function to stop ongoing generation
function stopGenerating() {
  if (currentStreamingRequestId) {
    chrome.runtime.sendMessage(
      {
        action: 'stopStreaming',
        requestId: currentStreamingRequestId
      },
      response => {
        console.log('Stop streaming response:', response);
        // Reset state regardless of response
        currentStreamingRequestId = null;
        toggleStreamingUI(false);
      }
    );
  }
}

// Toggle UI elements based on streaming state
function toggleStreamingUI(isStreaming) {
  if (isStreaming) {
    loadingIndicator.style.display = 'flex';
    stopButton.style.display = 'inline-flex';
    sendButton.style.display = 'none';
  } else {
    loadingIndicator.style.display = 'none';
    stopButton.style.display = 'none';
    sendButton.style.display = 'inline-flex';
  }
}

// Get all suggestion buttons and add click listeners
const suggestionButtons = document.querySelectorAll('.suggestion-button');
suggestionButtons.forEach(button => {
  button.addEventListener('click', function() {
    const suggestionText = this.getAttribute('data-text');
    messageInput.value = suggestionText;
    messageInput.focus();
    autoResizeTextarea();
  });
});

// Add settings button click listener
settingsButton.addEventListener('click', function() {
  chrome.runtime.openOptionsPage();
});

// Function to toggle suggestion visibility based on conversation status
function toggleSuggestions() {
  if (conversation.messages.length === 0) {
    suggestionsContainer.style.display = 'flex';
  } else {
    suggestionsContainer.style.display = 'none';
  }
}

// Function to auto-resize textarea based on content
function autoResizeTextarea() {
  // Reset height to auto to get the correct scrollHeight
  messageInput.style.height = 'auto';
  
  // Set new height based on scrollHeight, with a maximum of 200px
  // If content is empty, use the default height from CSS
  if (messageInput.value.trim() === '') {
    messageInput.style.height = 'auto';
  } else {
    messageInput.style.height = Math.min(200, messageInput.scrollHeight) + 'px';
  }
  
  console.log('Textarea resized to height:', messageInput.style.height);
}

// Add input event listener to auto-resize textarea
messageInput.addEventListener('input', autoResizeTextarea);

// Add paste event listener to handle pasted content
messageInput.addEventListener('paste', function() {
  // Use setTimeout to allow the paste operation to complete
  setTimeout(autoResizeTextarea, 0);
});

// Load conversation from storage
function loadConversation() {
  chrome.storage.local.get(['ReadingPalConversation'], function(result) {
    if (result.ReadingPalConversation) {
      conversation = result.ReadingPalConversation;
      displayConversation();
    }
    // Check if we should show suggestions after loading conversation
    toggleSuggestions();
  });
}

// Save conversation to storage
function saveConversation() {
  chrome.storage.local.set({ ReadingPalConversation: conversation });
}

// Display the conversation in the UI
function displayConversation() {
  // Clear existing messages
  conversationContainer.innerHTML = '';
  
  // Add messages to the conversation container
  conversation.messages.forEach(message => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`;
    
    // For streaming messages, set an ID so we can find and update it
    if (message.isStreaming) {
      messageElement.id = 'streaming-message';
    }
    
    messageElement.textContent = message.content;
    conversationContainer.appendChild(messageElement);
  });
  
  // Toggle suggestion visibility
  toggleSuggestions();
  
  // Scroll to the bottom
  conversationContainer.scrollTop = conversationContainer.scrollHeight;
}

// Add a message to the conversation
function addMessage(role, content, isStreaming = false) {
  // For streamed responses, we'll either be updating an existing message or creating a new one
  if (isStreaming && role === 'assistant') {
    // Check if we already have a streaming message in progress
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    
    // If the last message is an assistant message, update it instead of adding a new one
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      lastMessage.content += content;
      saveConversation();
      displayConversation();
      return;
    }
    
    // Otherwise, add a new streaming message
    conversation.messages.push({
      role: role,
      content: content,
      timestamp: new Date().toISOString(),
      isStreaming: true
    });
  } else {
    // For regular (non-streaming) messages or user messages
    conversation.messages.push({
      role: role,
      content: content,
      timestamp: new Date().toISOString()
    });
  }
  
  saveConversation();
  displayConversation();
}

// Update a streaming message in the UI without redrawing the entire conversation
function updateStreamingMessage(content, append = true) {
  let streamingMsg = document.getElementById('streaming-message');
  
  // If no streaming message exists in the DOM yet, create one
  if (!streamingMsg) {
    // Find the last message in the conversation array
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    
    // If the last message is an assistant message marked as streaming, update it
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      if (append) {
        lastMessage.content += content;
      } else {
        lastMessage.content = content;
      }
    } else {
      // Create a new streaming message
      conversation.messages.push({
        role: 'assistant',
        content: content,
        timestamp: new Date().toISOString(),
        isStreaming: true
      });
    }
    
    // Redraw the conversation
    displayConversation();
  } else {
    // If streaming message exists, just update its content
    if (append) {
      streamingMsg.textContent += content;
    } else {
      streamingMsg.textContent = content;
    }
    
    // Update the corresponding message in the conversation array
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      if (append) {
        lastMessage.content += content;
      } else {
        lastMessage.content = content;
      }
    }
    
    // Scroll to the bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
  }
}

// Finalize a streaming message (mark it as complete)
function finalizeStreamingMessage() {
  // Find the last message in the conversation array
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  
  // If the last message is an assistant message marked as streaming, mark it as complete
  if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
    delete lastMessage.isStreaming;
    saveConversation();
  }
  
  // Update the UI to remove the streaming indicator
  toggleStreamingUI(false);
}

// Send a message to Claude
async function sendToAssistant(prompt) {
  // Show streaming UI
  toggleStreamingUI(true);
  
  try {
    // First check if API key is configured
    const apiKeyCheck = await new Promise((resolve) => {
      chrome.storage.local.get(['anthropicApiKey'], function(result) {
        resolve(result.anthropicApiKey);
      });
    });
    
    if (!apiKeyCheck) {
      throw new Error('API key not found. Please set your Anthropic API key in the extension settings.');
    }
    
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'callClaudeAPI',
          prompt: prompt,
          conversation: conversation
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
    
    // Handle streamed response differently
    if (response.success && response.streaming) {
      // Store the requestId so we can cancel if needed
      currentStreamingRequestId = response.requestId;
      
      // Create an empty assistant message that will be filled as we receive chunks
      updateStreamingMessage('', false);
      
      // Note: We don't wait for the complete response here - it will come through
      // the streamUpdate message handler as chunks
    } else if (response.success) {
      // This is for backward compatibility with non-streaming responses
      addMessage('assistant', response.data);
      toggleStreamingUI(false);
    } else {
      // Format error message to be more user-friendly
      let errorMsg = response.error;
      
      // Check for common error patterns and provide better messages
      if (errorMsg.includes('API key') || errorMsg.includes('invalid key') || errorMsg.includes('unauthorized')) {
        errorMsg = 'Invalid API key. Please check your Anthropic API key in the extension settings.';
      } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        errorMsg = 'Rate limit exceeded. Please wait a moment before trying again.';
      } else if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('timeout')) {
        errorMsg = 'Network error. Please check your internet connection and try again.';
      }
      
      addMessage('assistant', `Error: ${errorMsg}`);
      toggleStreamingUI(false);
    }
  } catch (error) {
    // Format error message to be more user-friendly
    let errorMsg = error.message;
    
    // Check for common error patterns and provide better messages
    if (errorMsg.includes('API key') || errorMsg.includes('invalid key') || errorMsg.includes('unauthorized')) {
      errorMsg = 'API key issue. Please check your Anthropic API key in the extension settings.';
    } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      errorMsg = 'Rate limit exceeded. Please wait a moment before trying again.';
    } else if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('timeout')) {
      errorMsg = 'Network error. Please check your internet connection and try again.';
    }
    
    addMessage('assistant', `Error: ${errorMsg}`);
    toggleStreamingUI(false);
  }
}

// Handle sending a message
function handleSendMessage() {
  const message = messageInput.value.trim();
  
  if (!message) return;
  
  addMessage('user', message);
  messageInput.value = '';
  
  // Reset textarea height to its original size after sending
  messageInput.style.height = 'auto';
  
  // If there's selected text, include it in the prompt
  let prompt = message;
  if (selectedText) {
    prompt = `Given the following text: "${selectedText}"\n\n${message}`;
    selectedText = ''; // Clear selected text after using it
  }
  
  sendToAssistant(prompt);
}

// Handle clearing the conversation
function handleClearConversation() {
  conversation = { messages: [] };
  saveConversation();
  displayConversation();
}

// Handle closing the sidebar
function handleCloseSidebar() {
  // Clear the conversation first
  handleClearConversation();
  
  // Then close the sidebar
  window.parent.postMessage({ action: 'closeSidebar' }, '*');
}

// Event listeners
document.addEventListener('DOMContentLoaded', loadConversation);

sendButton.addEventListener('click', handleSendMessage);

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
    // Reset textarea height to its original size after sending with Enter key
    messageInput.style.height = 'auto';
  }
});

clearButton.addEventListener('click', handleClearConversation);

closeButton.addEventListener('click', handleCloseSidebar);

// Listen for messages from the content script
window.addEventListener('message', function(event) {
  console.log('Sidebar received message:', event.data);
  
  // Check if the message is from our extension
  if (event.data && (event.data.action || event.data.type)) {
    console.log('Valid message received in sidebar');
    
    // Get the selected text from the message
    let selectedText = '';
    if (event.data.selectedText) {
      selectedText = event.data.selectedText;
      console.log('Selected text from event.data.selectedText, length:', selectedText.length);
    } else if (event.data.text) {
      selectedText = event.data.text;
      console.log('Selected text from event.data.text, length:', selectedText.length);
    }
    
    if (!selectedText || selectedText.trim() === '') {
      console.log('No selected text in message');
      return;
    }
    
    // Get the message input field
    const messageInput = document.getElementById('messageInput');
    
    if (!messageInput) {
      console.error('Could not find messageInput element in sidebar!');
      return;
    }
    
    // Function to set text with retry logic
    const setText = (text, prefix = '', attempt = 1, maxAttempts = 3) => {
      try {
        console.log(`Setting text (attempt ${attempt}), text length: ${text.length}`);
        
        // Set the value
        messageInput.value = prefix + text;
        
        // Dispatch input event to trigger any listeners
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Focus the input field
        messageInput.focus();
        
        // Auto-resize the textarea
        autoResizeTextarea();
        
        console.log('Text set successfully, current length:', messageInput.value.length);
      } catch (error) {
        console.error('Error setting text:', error);
        
        if (attempt < maxAttempts) {
          // Wait and retry
          setTimeout(() => setText(text, prefix, attempt + 1, maxAttempts), 300);
        }
      }
    };
    
    // Handle different types of actions
    const action = event.data.action || '';
    const type = event.data.type || '';
    
    // Determine prefix based on action/type
    let prefix = '';
    if (action === 'summarize' || type === 'summarize') {
      prefix = 'Summarize this: ';
    } else if (action === 'explain' || type === 'explain') {
      prefix = 'Explain this: ';
    } else if (action === 'simplify' || type === 'simplify') {
      prefix = 'Simplify this: ';
    }
    
    // Set the text with the appropriate prefix
    setText(selectedText, prefix);
  }
});

// Add a log when sidebar is fully loaded
window.addEventListener('load', function() {
  console.log('Sidebar fully loaded and ready to receive messages');
  
  // Let the content script know the sidebar is ready
  try {
    window.parent.postMessage({ 
      action: 'sidebarReady',
      status: 'initialized',
      timestamp: Date.now()
    }, '*');
  } catch (e) {
    console.error('Could not send ready message to parent:', e);
  }
});

// Initialize the sidebar when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Sidebar DOM content loaded');
  
  // Get the message input field
  const messageInput = document.getElementById('messageInput');
  
  if (messageInput) {
    console.log('Found messageInput element');
    
    // Add a property to indicate the input is ready
    messageInput.dataset.ready = 'true';
    
    // Log message input element state
    messageInput.addEventListener('input', function() {
      console.log('Message input value changed, new length:', this.value.length);
    });
  } else {
    console.error('Could not find messageInput element on DOM content loaded!');
  }
  
  // Load the conversation
  loadConversation();
});

// Listen for runtime messages including streaming updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Sidebar received runtime message:', message);
  
  if (message.action === 'streamUpdate') {
    // Make sure it's for the current request
    if (currentStreamingRequestId === message.requestId) {
      if (!message.done) {
        // Update the streaming message with the new chunk
        updateStreamingMessage(message.text);
      } else {
        // Stream is complete
        finalizeStreamingMessage();
        currentStreamingRequestId = null;
      }
    }
    
    sendResponse({ received: true });
    return true;
  }
  
  // For other messages
  sendResponse({ status: 'Message received by sidebar' });
  return true;
}); 