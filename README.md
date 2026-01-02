# Extensions

## Gramerly - Browser Extension

A lightweight grammar and writing assistant that converts text to Python code using AI models.

## Features

- Automatically processes copied text and converts it to Python code
- Uses OpenRouter API with fallback to Hugging Face API
- Seamless clipboard integration
- Works on all websites

## Setup Instructions

### 1. Install the Extension

1. Clone this repository or download the source code
2. Open your Chrome/Edge browser
3. Navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked"
6. Select the directory containing the extension files

### 2. Configure API Keys

**Important:** This extension requires API keys to function. You need to provide your own API keys.

1. After installing the extension, right-click on the extension icon in your browser toolbar
2. Select "Options" from the context menu
3. Enter at least one of the following API keys:
   - **OpenRouter API Key**: Get yours from [OpenRouter](https://openrouter.ai/keys)
   - **Hugging Face API Key**: Get yours from [Hugging Face](https://huggingface.co/settings/tokens)
4. Click "Save Settings"

**Note:** The OpenRouter API is recommended as the primary option, with Hugging Face as a fallback. You can use either or both.

## Usage

1. Select and copy any text on any webpage
2. The extension will automatically process the text and convert it to Python code
3. Paste the result anywhere you need it

## Privacy & Security

- API keys are stored locally in your browser using Chrome's secure storage API
- No API keys are included in the source code
- Your API keys are never shared with anyone except the respective API services
- All processing happens through secure HTTPS connections

## Development

- `background.js`: Service worker that handles API calls
- `content.js`: Content script that handles copy/paste events
- `options.html` & `options.js`: Options page for configuring API keys
- `manifest.json`: Extension manifest file

## License

This project is for personal learning and experimentation.