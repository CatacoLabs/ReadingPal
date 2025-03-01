// Initialize variables
let conversation = { messages: [] };
let selectedText = '';
let pendingQuestion = '';

// DOM elements
const conversationContainer = document.getElementById('conversationContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
const closeButton = document.getElementById('closeButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const suggestionsContainer = document.getElementById('suggestionsContainer');
const settingsButton = document.getElementById('settingsButton');

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
    messageElement.textContent = message.content;
    conversationContainer.appendChild(messageElement);
  });
  
  // Toggle suggestion visibility
  toggleSuggestions();
  
  // Scroll to the bottom
  conversationContainer.scrollTop = conversationContainer.scrollHeight;
}

// Add a message to the conversation
function addMessage(role, content) {
  // Add message to the conversation
  conversation.messages.push({
    role: role,
    content: content,
    timestamp: new Date().toISOString()
  });
  
  // Save and display
  saveConversation();
  displayConversation();
}

// Send a message to Claude
async function sendToAssistant(prompt) {
  loadingIndicator.style.display = 'flex';
  
  try {
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
    
    if (response.success) {
      addMessage('assistant', response.data);
    } else {
      addMessage('assistant', `Error: ${response.error}`);
    }
  } catch (error) {
    addMessage('assistant', `Error: ${error.message}`);
  } finally {
    loadingIndicator.style.display = 'none';
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
  
  // Store the selected text to ensure it doesn't get lost
  let selectedText = '';
  
  // Check if the message is from our extension
  if (event.data && (event.data.action || event.data.type)) {
    console.log('Valid message received in sidebar');
    
    // Check for different message formats for backward compatibility
    if (event.data.selectedText) {
      selectedText = event.data.selectedText;
      console.log('Selected text from event.data.selectedText, length:', selectedText.length);
    } else if (event.data.text) {
      selectedText = event.data.text;
      console.log('Selected text from event.data.text, length:', selectedText.length);
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
        
        // Resize the textarea if needed
        if (typeof resizeTextarea === 'function') {
          resizeTextarea(messageInput);
        }
        
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
    
    if (action === 'summarize' || type === 'prefillSummarize' || type === 'summarize') {
      console.log('Handling summarize action');
      const summaryPrefix = 'Summarize this: ';
      setText(selectedText, summaryPrefix);
    } 
    else if (action === 'explain' || type === 'explain') {
      console.log('Handling explain action');
      const explainPrefix = 'Explain this: ';
      setText(selectedText, explainPrefix);
    }
    else if (action === 'simplify' || type === 'simplify') {
      console.log('Handling simplify action');
      const simplifyPrefix = 'Simplify this: ';
      setText(selectedText, simplifyPrefix);
    }
    else if (action === 'askQuestion' || type === 'prefillText') {
      console.log('Handling ask question action');
      setText(selectedText);
    }
    else if (type === 'processSelectedText') {
      console.log('Processing selected text with type:', event.data.type);
      
      // Handle different processing types
      if (event.data.type === 'prefillSummarize') {
        const summaryPrefix = 'Summarize this: ';
        setText(selectedText, summaryPrefix);
      } 
      else if (event.data.type === 'prefillText') {
        setText(selectedText);
      }
    }
  }
});

// Add a log when sidebar is fully loaded
window.addEventListener('load', function() {
  console.log('Sidebar fully loaded and ready to receive messages');
  
  // Let the content script know the sidebar is ready
  try {
    window.parent.postMessage({ action: 'sidebarReady' }, '*');
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
  
  // Log when the sidebar is fully initialized
  console.log('Sidebar initialized and ready for messages');
  
  // Notify the parent window (content script) that we're ready
  try {
    window.parent.postMessage({ 
      action: 'sidebarReady', 
      status: 'initialized',
      timestamp: Date.now()
    }, '*');
  } catch (e) {
    console.error('Error sending ready message to parent:', e);
  }
});

// Define a function to resize textareas based on content
function resizeTextarea(textarea) {
  if (!textarea) return;
  
  // Save the current height
  const currentHeight = textarea.style.height;
  
  // Reset the height temporarily to get the scroll height
  textarea.style.height = 'auto';
  
  // Set the height to the scroll height
  const newHeight = (textarea.scrollHeight) + 'px';
  textarea.style.height = newHeight;
  
  console.log(`Resized textarea from ${currentHeight} to ${newHeight}`);
} 