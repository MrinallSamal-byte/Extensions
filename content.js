let originalText = '';
let processedText = '';
let isProcessing = false;

document.addEventListener('copy', (event) => {
  try {
    const selection = window.getSelection();
    const copiedText = selection ? selection.toString() : '';

    if (!copiedText || copiedText.trim().length === 0) {
      return;
    }

    originalText = copiedText;
    processedText = '';
    isProcessing = true;

    // Prevent default and set original text to clipboard synchronously
    event.preventDefault();
    event.clipboardData.setData('text/plain', copiedText);

    // Store state in Chrome storage for cross-context access
    chrome.storage.local.set({
      originalText: copiedText,
      processedText: '',
      isProcessing: true,
      timestamp: Date.now()
    });

    // Process text silently in background
    chrome.runtime.sendMessage(
      { action: 'processText', text: copiedText },
      (response) => {
        isProcessing = false;

        if (chrome.runtime.lastError) {
          chrome.storage.local.set({ isProcessing: false });
          return;
        }

        if (response && response.success && response.processedText) {
          processedText = response.processedText;
          chrome.storage.local.set({
            processedText: response.processedText,
            isProcessing: false
          });

          // Silently update clipboard with processed text
          navigator.clipboard.writeText(response.processedText).catch(() => {
            // Paste handler will use stored processedText as fallback
          });
        } else {
          chrome.storage.local.set({ isProcessing: false });
        }
      }
    );
  } catch (error) {
    isProcessing = false;
    if (event.clipboardData) {
      const textToCopy = originalText || (window.getSelection() && window.getSelection().toString()) || '';
      if (textToCopy) {
        event.clipboardData.setData('text/plain', textToCopy);
        event.preventDefault();
      }
    }
  }
});

// Paste handler is synchronous — preventDefault must be called before any async
// work, so we only check the in-memory cache. The clipboard itself is updated
// asynchronously via navigator.clipboard.writeText in the copy handler above.
document.addEventListener('paste', (event) => {
  try {
    const clipboardText = event.clipboardData ? event.clipboardData.getData('text/plain') : '';

    if (processedText && originalText && clipboardText === originalText) {
      event.preventDefault();
      insertTextAtCursor(processedText);
      return;
    }

    // If processing is still ongoing, let default paste happen (original text)
  } catch (error) {
    // On error, let default paste behavior handle it
  }
});

// Helper function to insert text at the current cursor position
function insertTextAtCursor(text) {
  const activeElement = document.activeElement;
  const tagName = activeElement && activeElement.tagName ? activeElement.tagName.toUpperCase() : '';

  if (activeElement && (tagName === 'INPUT' || tagName === 'TEXTAREA')) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    const value = activeElement.value;

    activeElement.value = value.substring(0, start) + text + value.substring(end);
    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;

    // Dispatch input event for frameworks that listen to it
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (activeElement && activeElement.isContentEditable) {
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

      // Dispatch input event for frameworks
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
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
