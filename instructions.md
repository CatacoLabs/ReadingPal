────────────────────────────────────────────────────────
# 1. Project Overview
────────────────────────────────────────────────────────

## 1.1 Project Vision
Building a Chrome extension called "ReadingPal" that allows users to seamlessly:
• Select text from any webpage.  
• Ask questions or request summaries of that text via Claude (Anthropic's API).  
• Chat in a sidebar that behaves similarly to ChatGPT, with conversation history and the ability to clear the conversation.  

This extension aims to improve reading comprehension and productivity for everyday users.

## 1.2 High-Level Architecture
1. A popup (popup.html / popup.js) that allows users to:  
   – Toggle ReadingPal sidebar on or off.  
   – Access a settings page to enter (or update) their Anthropic API key.  
2. A content script (contentScript.js) injected into webpages that:  
   – Detects selected text.  
   – Sends the selected text to the extension's background script or directly to the Anthropic API (depending on design).  
   – Manages the display/hiding of the ReadingPal sidebar (sidebar.html / sidebar.js).  
3. A background script (background.js) that:  
   – Manages extension state (on/off) and user settings.  
   – Acts as a middle layer between content scripts and external APIs when needed.  
   – Creates and handles context menu items for text selection.
   – Verifies the Anthropic API key and available models.
4. A sidebar UI (sidebar.html / sidebar.js) that:  
   – Displays chat (a conversation interface).  
   – Allows sending new requests to Claude.  
   – Keeps track of the conversation history (stored in Chrome's local storage).  
   – Supports resizable width for better user experience.

By separating responsibilities, we ensure that each part of the extension is narrowly focused and maintainable.

────────────────────────────────────────────────────────
# 2. Features
────────────────────────────────────────────────────────

The following core features have been implemented:

1. Toggle Sidebar  
   – The user can toggle on/off the ReadingPal sidebar via a switch in the popup UI.
   – The sidebar can be toggled via the popup or closed directly via a close button in the sidebar.
   – The extension remembers the sidebar state between page loads.

2. Settings Page (Anthropic API Key)  
   – A settings page where users can enter and verify their Anthropic API key.
   – The key is stored in Chrome's local storage and used for API calls.
   – The API key can be tested to verify its validity.
   – Users can select from available Claude models based on their API key's capabilities.

3. Text Selection → Summarize / Ask a Question  
   – By selecting text on any webpage, the user can invoke ReadingPal via context menu.
   – Two context menu options: "Summarize with ReadingPal" and "Ask Claude about this".
   – The selected text is sent to the sidebar which communicates with Claude API.

4. Sidebar Chat Interface  
   – Modern chat UI with a conversation history.
   – "Clear Conversation" button to reset the chat.
   – Scrollable conversation area with messages distinguished by role (user/assistant).
   – Auto-expanding text input area for user messages.
   – Resizable sidebar width through a drag handle.
   – Adapts webpage layout when sidebar is active.

────────────────────────────────────────────────────────
# 3. Implementation Details
────────────────────────────────────────────────────────

### 3.1 Toggle Sidebar
• User Interface:
  – A switch in popup.html labeled "Enable ReadingPal."  
  – Visual feedback reflecting the toggle state.
  – Close button within the sidebar itself.
  – Refresh button appears when toggle state changes for current page.
• Functionality:
  – The toggle state is saved in Chrome's local storage (`ReadingPalEnabled`).
  – When toggled on, the sidebar is injected into the active webpage.
  – The webpage layout adjusts to accommodate the sidebar.
  – Custom CSS handles responsive layout changes.

### 3.2 Settings Page (Anthropic API Key)
• User Interface:
  – Accessible via "Settings" link in the popup.
  – API key input field with visibility toggle.
  – "Verify API Key" button to test the key before saving.
  – Model selection dropdown populated based on available models.
  – Status indicators for verification results.
• Functionality:
  – API key verification using Anthropic's API.
  – Model availability detection based on the API key capabilities.
  – Key and selected model stored in Chrome's local storage.
  – Error handling for invalid keys or API issues.

### 3.3 Text Selection → Summarize / Ask a Question
• User Interface:
  – Context menu entries for selected text.
  – Option to summarize or ask questions about selected text.
• Functionality:
  – Context menu created and managed by the background script.
  – Selected text captured and passed to the sidebar.
  – Sidebar communicates with the Anthropic API.
  – Different prompt construction based on action (summarize vs. question).
  – Loading indicators during API communication.

### 3.4 Sidebar Chat Interface
• User Interface:
  – Header with title and close button.
  – Conversation area displaying message history.
  – Input area with auto-expanding text field.
  – Send and Clear buttons.
  – Resizable width with drag handle.
• Functionality:
  – Message history stored in Chrome's local storage.
  – Real-time display and update of conversation.
  – Markdown rendering for Claude's responses.
  – Auto-scrolling to latest messages.
  – Handles window resize events.
  – Persistent width preferences.

────────────────────────────────────────────────────────
# 4. Data Storage
────────────────────────────────────────────────────────

The extension uses Chrome's local storage for persistent data:

1. Settings:
   – `ReadingPalEnabled`: boolean - Extension toggle state
   – `anthropicApiKey`: string - User's Anthropic API key
   – `selectedModel`: string - Selected Claude model

2. Conversation:
   – `conversation`: object - Contains the chat history
   ```
   {
     messages: Array<{
       role: "user" | "assistant",
       content: string,
       timestamp: string
     }>
   }
   ```

3. UI Preferences:
   – `sidebarWidth`: number - User's preferred sidebar width

────────────────────────────────────────────────────────
# 5. API Integration
────────────────────────────────────────────────────────

### 5.1 Anthropic Claude API
• Endpoint: https://api.anthropic.com/v1/messages
• Authentication: API key in the "x-api-key" header
• Request body format:
  ```json
  {
    "model": "claude-3-opus-20240229" or other available model,
    "max_tokens": 1000,
    "messages": [
      {"role": "user", "content": "Please summarize this text: {selectedText}"}
    ]
  }
  ```
• Response handling:
  – Parses and displays message content
  – Handles error responses and displays appropriate messages

### 5.2 API Key Verification
• The extension verifies API keys before saving
• Tests available models for the provided key
• Provides feedback about key validity and accessible models

────────────────────────────────────────────────────────
# 6. Browser Integration
────────────────────────────────────────────────────────

### 6.1 Content Manipulation
• The extension injects a sidebar iframe into webpages
• Custom CSS adjusts the page layout to accommodate the sidebar
• Handles various webpage layouts smartly
• Saves and restores original page styles when the sidebar is closed

### 6.2 Context Menu Integration
• Creates context menu items for selected text
• Supports both summarization and questioning actions
• Handles user selection and passes text to the sidebar

### 6.3 Cross-Component Communication
• Content script to sidebar communication via postMessage
• Background script to content script communication via chrome.tabs.sendMessage
• Popup to background script communication via chrome.runtime.sendMessage

────────────────────────────────────────────────────────

Feel free to adapt the above sections to your internal format or labeling conventions for PRDs. This outline provides a robust starting point that captures your functional, UX, data, and API requirements in a single, traceable document.