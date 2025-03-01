# ReadingPal Chrome Extension

ReadingPal is a Chrome extension that leverages Anthropic's Claude AI to help users understand and interact with text on webpages. With ReadingPal, you can select text from any webpage and ask Claude to summarize it or answer questions about it.

## Features

- **Text Selection**: Select any text on a webpage and use ReadingPal to analyze it.
- **Summarization**: Quickly get summaries of selected text.
- **Question Answering**: Ask specific questions about the selected text.
- **Conversation History**: Chat with Claude in a sidebar interface with conversation history.
- **Easy Toggle**: Enable or disable the sidebar with a simple toggle.
- **Model Selection**: Choose which Claude model to use for your conversations.
- **Secure API Key Management**: Your API key is stored securely with a visibility toggle option.
- **Convenient Page Refresh**: Refresh the current page directly from the popup when toggling the sidebar.

## Installation

### From Source

1. Clone this repository or download the source code.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the directory containing the extension files.
5. The ReadingPal extension should now be installed and visible in your extensions list.

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store page for ReadingPal.
2. Click "Add to Chrome" to install the extension.

## Setup

1. After installing the extension, click on the ReadingPal icon in your browser toolbar.
2. Click on "Settings" to open the settings page.
3. Enter your Anthropic API key. You can get an API key from [Anthropic's website](https://www.anthropic.com/).
   - Use the eye icon to toggle visibility of your API key.
4. Click "Verify Key" to verify your API key and see available models.
5. Select the Claude model you want to use from the dropdown menu.
6. Click "Save Settings" to save your configuration.

## Usage

1. Enable ReadingPal by clicking the toggle in the popup.
   - If you change the toggle state, a "Refresh Page" button will appear to help you apply changes to the current page.
2. Select text on any webpage.
3. Right-click and choose either "Summarize with ReadingPal" or "Ask Claude about this...".
4. The ReadingPal sidebar will appear with your request.
5. For questions, type your question in the input field and press Enter or click Send.
6. View Claude's response in the sidebar.
7. Continue the conversation by typing more messages.
8. Clear the conversation history using the "Clear Conversation" button.
9. Close the sidebar using the X button in the top-right corner.

## Privacy

ReadingPal stores your Anthropic API key and conversation history locally on your device. Your selected text and questions are sent to Anthropic's Claude API for processing. Please refer to Anthropic's privacy policy for information on how they handle your data.

## Troubleshooting

### CORS Issues
If you encounter CORS-related errors, make sure you're using the latest version of the extension which includes the required headers for direct browser access to the Anthropic API.

### API Key Verification
If your API key verification fails:
1. Double-check that you've entered the correct API key.
2. Ensure your API key has the necessary permissions to access the Claude models.
3. Check if your API key has any usage restrictions or rate limits.

### Sidebar Not Appearing
If the sidebar doesn't appear after enabling it:
1. Try refreshing the page using the "Refresh Page" button in the popup.
2. Check if the extension has the necessary permissions to inject content into the current page.
3. Some websites with strict Content Security Policies may block the sidebar from loading.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgements

- [Anthropic](https://www.anthropic.com/) for providing the Claude AI API.
- All contributors to this project. 