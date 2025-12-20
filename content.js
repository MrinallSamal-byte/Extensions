let originalText = '';

document.addEventListener('copy', (event) => {
  try {
    const selection = window.getSelection();
    const copiedText = selection.toString();
    
    if (!copiedText || copiedText.trim().length === 0) {
      return;
    }
    
    originalText = copiedText;
    
    // Prevent default copy behavior
    event.preventDefault();
    
    // Set the original text to clipboard immediately using clipboardData
    // This works synchronously and doesn't require document focus
    event.clipboardData.setData('text/plain', copiedText);
    
    // Process text in background and update clipboard if we can
    chrome.runtime.sendMessage(
      {
        action: 'processText',
        text: copiedText
      },
      (response) => {
        if (chrome.runtime.lastError) {
          // If there's an error communicating with background, original text is already in clipboard (set via event.clipboardData.setData() on line 19)
          return;
        }
        
        if (response && response.success && response.processedText) {
          // Try to update clipboard with processed text
          // This may fail if document loses focus, but that's okay - original text is already copied via event.clipboardData.setData()
          navigator.clipboard.writeText(response.processedText).catch(() => {
            // Silently fail - user already has original text in clipboard
          });
        }
      }
    );
  } catch (error) {
    // On error, try to copy text if available (use copiedText from outer scope if originalText not set)
    if (event.clipboardData) {
      const textToCopy = originalText || (window.getSelection() && window.getSelection().toString()) || '';
      if (textToCopy) {
        event.clipboardData.setData('text/plain', textToCopy);
        event.preventDefault();
      }
    }
  }
});
