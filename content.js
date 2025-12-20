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
          // If there's an error communicating with background, original text is already in clipboard
          return;
        }
        
        if (response && response.success && response.processedText) {
          // Try to update clipboard with processed text
          // This may fail if document loses focus, but that's okay - original text is already copied
          navigator.clipboard.writeText(response.processedText).catch(() => {
            // Silently fail - user already has original text in clipboard
          });
        }
      }
    );
  } catch (error) {
    // On error, try to copy original text if available
    if (event.clipboardData && originalText) {
      event.clipboardData.setData('text/plain', originalText);
      event.preventDefault();
    }
  }
});
