// API keys are now stored in Chrome storage for security
// Users need to configure their own API keys via the extension options
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';

// OpenRouter Models ordered by coding capability - top models only for fast fallback
const OPENROUTER_MODELS = [
  'qwen/qwen3-coder:free',
  'kwaipilot/kat-coder-pro:free',
  'mistralai/devstral-2512:free'
];

// Hugging Face Models - top coding models only
const HUGGINGFACE_MODELS = [
  'Qwen/Qwen2.5-Coder-32B-Instruct',
  'bigcode/starcoder2-15b'
];

/** Maximum number of retry attempts for rate-limited requests. */
const MAX_RETRIES = 2;
/** Base delay in milliseconds for exponential backoff (RETRY_DELAY_MS * 2^attempt). */
const RETRY_DELAY_MS = 500;
/** Maximum allowed delay between retries in milliseconds. */
const MAX_RETRY_DELAY_MS = 5000;
/** Timeout for individual fetch requests in milliseconds. */
const FETCH_TIMEOUT_MS = 15000;
/** Timeout for overall processing across all models in milliseconds. */
const OVERALL_TIMEOUT_MS = 30000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

function stripMarkdownCodeBlocks(text) {
  return text
    .replace(/```python\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
}

async function processTextWithAPI(text) {
  const storage = await chrome.storage.local.get(['openrouterApiKey', 'huggingfaceApiKey']);
  const OPENROUTER_API_KEY = storage.openrouterApiKey;
  const HUGGINGFACE_API_KEY = storage.huggingfaceApiKey;

  if (!OPENROUTER_API_KEY && !HUGGINGFACE_API_KEY) {
    throw new Error('No API keys configured. Please configure at least one API key (OpenRouter or Hugging Face) in extension options.');
  }

  function getBackoffDelay(attempt) {
    return Math.min(RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  }

  async function callOpenRouter(model, retryAttempt = 0) {
    try {
      const response = await fetchWithTimeout(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://gramerly-extension.local',
          'X-Title': 'Gramerly Extension'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: `Convert the following text to Python code. Return only the Python code with no comments, explanations, or markdown formatting:\n\n${text}`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (response.status === 401) {
        throw new Error('Invalid OpenRouter API key. Please check your key in extension options.');
      }

      if (response.status === 429 && retryAttempt < MAX_RETRIES) {
        await delay(getBackoffDelay(retryAttempt));
        return callOpenRouter(model, retryAttempt + 1);
      }

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? 'Rate limit exceeded. Please try again later.'
            : `OpenRouter API error (${response.status})`
        );
      }

      const data = await response.json();

      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return stripMarkdownCodeBlocks(data.choices[0].message.content);
      }

      throw new Error('Invalid API response format');
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request to ${model} timed out`);
      }
      if (error instanceof TypeError && retryAttempt < MAX_RETRIES) {
        await delay(getBackoffDelay(retryAttempt));
        return callOpenRouter(model, retryAttempt + 1);
      }
      throw error;
    }
  }

  async function callHuggingFace(model, retryAttempt = 0) {
    try {
      const response = await fetchWithTimeout(`${HUGGINGFACE_API_URL}/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`
        },
        body: JSON.stringify({
          inputs: `Convert the following text to Python code. Return only the Python code with no comments, explanations, or markdown formatting:\n\n${text}`,
          parameters: {
            max_new_tokens: 2000,
            temperature: 0.7,
            return_full_text: false
          }
        })
      });

      if (response.status === 401) {
        throw new Error('Invalid Hugging Face API key. Please check your key in extension options.');
      }

      if (response.status === 429 && retryAttempt < MAX_RETRIES) {
        await delay(getBackoffDelay(retryAttempt));
        return callHuggingFace(model, retryAttempt + 1);
      }

      if (response.status === 503) {
        throw new Error('Model is loading');
      }

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? 'Rate limit exceeded'
            : `Hugging Face API error (${response.status})`
        );
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
        return stripMarkdownCodeBlocks(data[0].generated_text);
      }

      throw new Error('Invalid Hugging Face API response format');
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request to ${model} timed out`);
      }
      if (error instanceof TypeError && retryAttempt < MAX_RETRIES) {
        await delay(getBackoffDelay(retryAttempt));
        return callHuggingFace(model, retryAttempt + 1);
      }
      throw error;
    }
  }

  // Wrap the entire model-fallback loop in an overall timeout
  let overallTimeoutId;
  const overallTimeout = new Promise((_, reject) => {
    overallTimeoutId = setTimeout(() => reject(new Error('Processing timed out. Please try again.')), OVERALL_TIMEOUT_MS);
  });

  const processModels = async () => {
    let lastError = null;

    if (OPENROUTER_API_KEY) {
      for (const model of OPENROUTER_MODELS) {
        try {
          return await callOpenRouter(model);
        } catch (error) {
          lastError = error;
          // Stop trying more models if the API key itself is invalid
          if (error.message.includes('Invalid OpenRouter API key')) throw error;
          console.warn(`OpenRouter model ${model} failed:`, error.message);
        }
      }
    }

    if (HUGGINGFACE_API_KEY) {
      for (const model of HUGGINGFACE_MODELS) {
        try {
          return await callHuggingFace(model);
        } catch (error) {
          lastError = error;
          if (error.message.includes('Invalid Hugging Face API key')) throw error;
          console.warn(`Hugging Face model ${model} failed:`, error.message);
        }
      }
    }

    throw lastError || new Error('All models failed. Please try again later.');
  };

  return Promise.race([processModels(), overallTimeout])
    .finally(() => clearTimeout(overallTimeoutId));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processText') {
    processTextWithAPI(request.text)
      .then(processedText => {
        sendResponse({
          success: true,
          processedText: processedText
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message,
          processedText: request.text
        });
      });
    
    return true;
  }
});
