let originalText = '';

document.addEventListener('copy', async (event) => {
  try {
    const selection = window.getSelection();
    const copiedText = selection.toString();
    
    if (!copiedText || copiedText.trim().length === 0) {
      return;
    }
    
    originalText = copiedText;
    
    event.preventDefault();
    
    chrome.runtime.sendMessage(
      {
        action: 'processText',
        text: copiedText
      },
      async (response) => {
        if (chrome.runtime.lastError) {
          await navigator.clipboard.writeText(originalText);
          return;
        }
        
        if (response && response.success && response.processedText) {
          try {
            await navigator.clipboard.writeText(response.processedText);
          } catch (clipboardError) {
            await navigator.clipboard.writeText(originalText);
          }
        } else {
          await navigator.clipboard.writeText(originalText);
        }
      }
    );
  } catch (error) {
    if (originalText) {
      navigator.clipboard.writeText(originalText).catch(() => {});
    }
  }
});
