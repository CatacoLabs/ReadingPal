document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleVisibility = document.getElementById('toggleVisibility');
  const verifyButton = document.getElementById('verifyButton');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const modelSelect = document.getElementById('modelSelect');
  const modelSelectionContainer = document.getElementById('modelSelectionContainer');
  
  let verifiedModels = [];
  
  // Toggle password visibility
  toggleVisibility.addEventListener('click', function() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleVisibility.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    } else {
      apiKeyInput.type = 'password';
      toggleVisibility.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
  });
  
  // Load the saved API key and selected model
  chrome.storage.local.get(['anthropicApiKey', 'selectedModel'], function(result) {
    if (result.anthropicApiKey) {
      apiKeyInput.value = result.anthropicApiKey;
    }
    
    // If we have a previously selected model, try to verify the key automatically
    if (result.anthropicApiKey && result.selectedModel) {
      verifyApiKey(result.anthropicApiKey, false).then(() => {
        // Select the previously selected model
        if (result.selectedModel) {
          modelSelect.value = result.selectedModel;
        }
      }).catch(error => {
        // If verification fails, just show the input without error message
        console.error('Auto-verification failed:', error);
      });
    }
  });
  
  // Handle verify button click
  verifyButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }
    
    verifyApiKey(apiKey, true);
  });
  
  // Handle save button click
  saveButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;
    
    if (!apiKey) {
      showStatus('Please enter a valid API key', 'error');
      return;
    }
    
    if (modelSelectionContainer.style.display === 'block' && !selectedModel) {
      showStatus('Please select a model', 'error');
      return;
    }
    
    // Save the API key and selected model
    chrome.storage.local.set({ 
      anthropicApiKey: apiKey,
      selectedModel: selectedModel || null
    }, function() {
      showStatus('Settings saved successfully!', 'success');
    });
  });
  
  // Function to verify API key and get available models
  async function verifyApiKey(apiKey, showMessages) {
    loadingIndicator.style.display = 'inline-block';
    
    try {
      console.log('Sending verifyApiKey message to background script...');
      
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'verifyApiKey',
            apiKey: apiKey
          },
          response => {
            console.log('Received response from background script:', response);
            
            if (chrome.runtime.lastError) {
              console.error('Runtime error:', chrome.runtime.lastError);
              reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
            } else if (!response) {
              console.error('Empty response from background script');
              reject(new Error('No response from background script'));
            } else if (!response.success) {
              console.error('API verification failed:', response.error || 'Unknown error');
              reject(new Error(response.error || 'Unknown error'));
            } else if (!response.data) {
              console.error('Missing data in successful response');
              reject(new Error('API verification succeeded but no models were returned'));
            } else {
              console.log('API verification successful, models:', response.data);
              resolve(response.data);
            }
          }
        );
        
        // Add a timeout in case the background script doesn't respond
        setTimeout(() => {
          reject(new Error('Timeout: Background script did not respond'));
        }, 15000); // 15-second timeout
      });
      
      // API key is valid, show model selection
      verifiedModels = response || [];
      
      console.log('Models received:', verifiedModels);
      
      if (!Array.isArray(verifiedModels)) {
        console.error('Expected array of models but got:', verifiedModels);
        verifiedModels = [];
      }
      
      populateModelSelect(verifiedModels);
      modelSelectionContainer.style.display = 'block';
      
      if (showMessages) {
        showStatus('API key verified successfully! Now please select a model.', 'success');
      }
    } catch (error) {
      console.error('Error verifying API key:', error);
      
      // Handle different types of errors with more specific messages
      let errorMessage = error.message;
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network error')) {
        errorMessage = 'Network error: Could not connect to Anthropic API. Please check your internet connection.';
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage = 'Authentication error: Your API key appears to be invalid or expired.';
      } else if (errorMessage.includes('429')) {
        errorMessage = 'Rate limit exceeded: Too many requests to Anthropic API. Please try again later.';
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        errorMessage = 'Anthropic API server error. Please try again later.';
      } else if (errorMessage === 'Unknown error') {
        errorMessage = 'Unknown error: Could not connect to Anthropic API. This might be due to CORS restrictions or network issues.';
      }
      
      if (showMessages) {
        showStatus(`Error: ${errorMessage}`, 'error');
      }
      modelSelectionContainer.style.display = 'none';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }
  
  // Function to populate the model select dropdown
  function populateModelSelect(models) {
    // Clear existing options
    modelSelect.innerHTML = '';
    
    console.log('Populating model select with models:', models);
    
    if (!models || models.length === 0) {
      console.warn('No models available, using default');
      const option = document.createElement('option');
      option.value = 'claude-3-opus-20240229'; // Default fallback
      option.textContent = 'Claude 3 Opus (Default)';
      modelSelect.appendChild(option);
      return;
    }
    
    // Sort models by name if possible
    try {
      models.sort((a, b) => {
        // Make sure name properties exist
        const nameA = a.name || a.id || '';
        const nameB = b.name || b.id || '';
        return nameA.localeCompare(nameB);
      });
    } catch (error) {
      console.error('Error sorting models:', error);
      // Continue without sorting if there's an error
    }
    
    // Add options for each model
    models.forEach(model => {
      if (!model || typeof model !== 'object') {
        console.warn('Invalid model object:', model);
        return;
      }
      
      console.log('Adding model to dropdown:', model);
      
      const option = document.createElement('option');
      option.value = model.id || '';
      
      // Create a descriptive label
      let label = model.name || model.id || 'Unknown Model';
      if (model.description) {
        label += ` (${model.description})`;
      }
      
      option.textContent = label;
      modelSelect.appendChild(option);
    });
    
    // Check if we have a previously selected model
    chrome.storage.local.get(['selectedModel'], function(result) {
      if (result.selectedModel) {
        // Check if the previously selected model is still available
        const modelExists = Array.from(modelSelect.options).some(option => option.value === result.selectedModel);
        
        if (modelExists) {
          modelSelect.value = result.selectedModel;
        }
      } else if (modelSelect.options.length > 0) {
        // Select the first model by default
        modelSelect.selectedIndex = 0;
      }
    });
  }
  
  // Helper function to show status messages
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    
    // Hide the status message after 5 seconds
    setTimeout(function() {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}); 