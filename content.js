let originalText = '';
let processedText = '';
let isProcessing = false;

// Notification element for user feedback
let notificationEl = null;

function showNotification(message, type) {
  removeNotification();
  notificationEl = document.createElement('div');
  notificationEl.setAttribute('style', [
    'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
    'padding:10px 18px', 'border-radius:8px', 'font-size:14px',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'color:#fff', 'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
    'transition:opacity 0.3s', 'pointer-events:none',
    type === 'success' ? 'background:#4CAF50'
      : type === 'error' ? 'background:#f44336'
      : 'background:#2196F3'
  ].join(';'));
  notificationEl.textContent = message;
  document.body.appendChild(notificationEl);
}

function removeNotification() {
  if (notificationEl && notificationEl.parentNode) {
    notificationEl.parentNode.removeChild(notificationEl);
  }
  notificationEl = null;
}

function fadeOutNotification(delayMs) {
  setTimeout(() => {
    if (notificationEl) {
      notificationEl.style.opacity = '0';
      setTimeout(removeNotification, 300);
    }
  }, delayMs);
}

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

    showNotification('⏳ Processing text…', 'info');

    // Process text in background
    chrome.runtime.sendMessage(
      { action: 'processText', text: copiedText },
      (response) => {
        isProcessing = false;

        if (chrome.runtime.lastError) {
          chrome.storage.local.set({ isProcessing: false });
          showNotification('⚠️ Extension error — paste will use original text', 'error');
          fadeOutNotification(3000);
          return;
        }

        if (response && response.success && response.processedText) {
          processedText = response.processedText;
          chrome.storage.local.set({
            processedText: response.processedText,
            isProcessing: false
          });

          // Update clipboard with processed text
          navigator.clipboard.writeText(response.processedText).catch(() => {
            // Paste handler will use stored processedText as fallback
          });

          showNotification('✅ Text processed — ready to paste', 'success');
          fadeOutNotification(2500);
        } else {
          const errorMsg = (response && response.error) || 'Processing failed';
          chrome.storage.local.set({ isProcessing: false });
          showNotification('⚠️ ' + errorMsg, 'error');
          fadeOutNotification(3000);
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

// Handle paste — must call preventDefault synchronously before any await
document.addEventListener('paste', (event) => {
  try {
    const clipboardText = event.clipboardData ? event.clipboardData.getData('text/plain') : '';

    // Fast path: check in-memory processed text (synchronous, no await)
    if (processedText && originalText && clipboardText === originalText) {
      event.preventDefault();
      insertTextAtCursor(processedText);
      return;
    }

    // If processing is still ongoing, let default paste happen (original text)
    if (isProcessing) {
      return;
    }

    // Async fallback: check Chrome storage for cross-tab scenarios
    // We must decide synchronously whether to preventDefault,
    // so only preventDefault if we had in-memory match (above).
    // For the async storage path, we pre-read storage on every copy
    // and rely on the in-memory cache. If a cross-tab scenario is needed,
    // the clipboard itself should already have the processed text via
    // navigator.clipboard.writeText in the copy handler.
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
