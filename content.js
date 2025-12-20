let originalText = '';
let processedText = '';
let isProcessing = false;

// Clear any stale processed text on page load
processedText = '';

document.addEventListener('copy', (event) => {
  try {
    const selection = window.getSelection();
    const copiedText = selection.toString();
    
    if (!copiedText || copiedText.trim().length === 0) {
      return;
    }
    
    originalText = copiedText;
    processedText = ''; // Reset processed text for new copy
    isProcessing = true;
    
    // Prevent default copy behavior
    event.preventDefault();
    
    // Set the original text to clipboard immediately using clipboardData
    // This works synchronously and doesn't require document focus
    event.clipboardData.setData('text/plain', copiedText);
    
    // Store original text in Chrome storage for cross-context access
    chrome.storage.local.set({
      originalText: copiedText,
      processedText: '',
      isProcessing: true,
      timestamp: Date.now()
    });
    
    // Process text in background and store result
    chrome.runtime.sendMessage(
      {
        action: 'processText',
        text: copiedText
      },
      (response) => {
        isProcessing = false;
        
        if (chrome.runtime.lastError) {
          // If there's an error communicating with background, clear processing state
          chrome.storage.local.set({ isProcessing: false });
          return;
        }
        
        if (response && response.success && response.processedText) {
          // Store the processed text in memory and Chrome storage
          processedText = response.processedText;
          chrome.storage.local.set({
            processedText: response.processedText,
            isProcessing: false
          });
          
          // Try to update clipboard with processed text
          // This may fail if document loses focus, but paste handler will use stored text
          navigator.clipboard.writeText(response.processedText).catch(() => {
            // Silently fail - paste handler will use stored processedText
          });
        } else {
          chrome.storage.local.set({ isProcessing: false });
        }
      }
    );
  } catch (error) {
    isProcessing = false;
    // On error, try to copy text if available
    // originalText is set early in the try block if selection was successful
    if (event.clipboardData) {
      const textToCopy = originalText || (window.getSelection() && window.getSelection().toString()) || '';
      if (textToCopy) {
        event.clipboardData.setData('text/plain', textToCopy);
        event.preventDefault();
      }
    }
  }
});

// Handle paste event to ensure processed text is used even if clipboard update failed
document.addEventListener('paste', async (event) => {
  try {
    // Get current clipboard content
    const clipboardText = event.clipboardData.getData('text/plain');
    
    // First check in-memory processedText (fastest)
    if (processedText && originalText && clipboardText === originalText) {
      event.preventDefault();
      insertTextAtCursor(processedText);
      return;
    }
    
    // If in-memory doesn't have it, check Chrome storage (handles cross-tab/delayed scenarios)
    const stored = await chrome.storage.local.get(['originalText', 'processedText', 'isProcessing', 'timestamp']);
    
    // Check if the clipboard contains the original text and we have processed text available
    // Also check timestamp to avoid using stale data (expire after 10 minutes)
    const isStale = stored.timestamp && (Date.now() - stored.timestamp > 10 * 60 * 1000);
    
    if (!isStale && stored.processedText && stored.originalText && clipboardText === stored.originalText) {
      event.preventDefault();
      insertTextAtCursor(stored.processedText);
      
      // Update clipboard for future pastes
      navigator.clipboard.writeText(stored.processedText).catch(() => {});
    }
    // If processing is still ongoing, let the original text be pasted (better UX than waiting)
  } catch (error) {
    // On error, let default paste behavior handle it
  }
});

// Helper function to insert text at the current cursor position
function insertTextAtCursor(text) {
  const activeElement = document.activeElement;
  
  // Check if we're in an input or textarea (case-insensitive for XHTML compatibility)
  const tagName = activeElement?.tagName?.toUpperCase();
  if (activeElement && (tagName === 'INPUT' || tagName === 'TEXTAREA')) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    const value = activeElement.value;
    
    activeElement.value = value.substring(0, start) + text + value.substring(end);
    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
    
    // Dispatch input event for frameworks that listen to it
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (activeElement && activeElement.isContentEditable) {
    // For contenteditable elements, use Selection and Range APIs
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } else {
    // Fallback: try using Selection API for any focused element
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
