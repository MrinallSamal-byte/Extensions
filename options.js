// Load saved settings when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  const storage = await chrome.storage.local.get(['openrouterApiKey', 'huggingfaceApiKey']);
  
  if (storage.openrouterApiKey) {
    document.getElementById('openrouterApiKey').value = storage.openrouterApiKey;
  }
  
  if (storage.huggingfaceApiKey) {
    document.getElementById('huggingfaceApiKey').value = storage.huggingfaceApiKey;
  }
});

// Save settings when the form is submitted
document.getElementById('optionsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const openrouterApiKey = document.getElementById('openrouterApiKey').value.trim();
  const huggingfaceApiKey = document.getElementById('huggingfaceApiKey').value.trim();
  
  // Validate that at least one API key is provided
  if (!openrouterApiKey && !huggingfaceApiKey) {
    showStatus('Please provide at least one API key.', 'error');
    return;
  }
  
  // Save to Chrome storage
  try {
    // Get current storage to check what exists
    const currentStorage = await chrome.storage.local.get(['openrouterApiKey', 'huggingfaceApiKey']);
    const dataToSave = {};
    const keysToRemove = [];
    
    // Only save non-empty API keys
    if (openrouterApiKey) {
      dataToSave.openrouterApiKey = openrouterApiKey;
    } else if (currentStorage.openrouterApiKey) {
      // Only remove the key from storage if it existed
      keysToRemove.push('openrouterApiKey');
    }
    
    if (huggingfaceApiKey) {
      dataToSave.huggingfaceApiKey = huggingfaceApiKey;
    } else if (currentStorage.huggingfaceApiKey) {
      // Only remove the key from storage if it existed
      keysToRemove.push('huggingfaceApiKey');
    }
    
    // Save non-empty keys to storage
    if (Object.keys(dataToSave).length > 0) {
      await chrome.storage.local.set(dataToSave);
    }
    
    // Remove empty keys from storage
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
    
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Error saving settings: ' + error.message, 'error');
  }
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  statusDiv.style.display = 'block';
  
  // Hide status message after 3 seconds
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}
