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

  const saveButton = e.target.querySelector('button[type="submit"]');
  const openrouterApiKey = document.getElementById('openrouterApiKey').value.trim();
  const huggingfaceApiKey = document.getElementById('huggingfaceApiKey').value.trim();

  // Validate that at least one API key is provided
  if (!openrouterApiKey && !huggingfaceApiKey) {
    showStatus('Please provide at least one API key.', 'error');
    return;
  }

  // Basic format validation
  if (openrouterApiKey && !openrouterApiKey.startsWith('sk-or-')) {
    showStatus('OpenRouter API key should start with "sk-or-". Please check your key.', 'error');
    return;
  }

  if (huggingfaceApiKey && !huggingfaceApiKey.startsWith('hf_')) {
    showStatus('Hugging Face API key should start with "hf_". Please check your key.', 'error');
    return;
  }

  // Disable button while saving
  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';

  try {
    const currentStorage = await chrome.storage.local.get(['openrouterApiKey', 'huggingfaceApiKey']);
    const dataToSave = {};
    const keysToRemove = [];

    if (openrouterApiKey) {
      dataToSave.openrouterApiKey = openrouterApiKey;
    } else if (currentStorage.openrouterApiKey) {
      keysToRemove.push('openrouterApiKey');
    }

    if (huggingfaceApiKey) {
      dataToSave.huggingfaceApiKey = huggingfaceApiKey;
    } else if (currentStorage.huggingfaceApiKey) {
      keysToRemove.push('huggingfaceApiKey');
    }

    if (Object.keys(dataToSave).length > 0) {
      await chrome.storage.local.set(dataToSave);
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }

    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Error saving settings: ' + error.message, 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
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
