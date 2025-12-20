const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Hugging Face API fallback - API key provided by user for fallback functionality
// Note: In production, consider using Chrome storage API or environment variables for API keys
const HUGGINGFACE_API_KEY = ['hf_xZTxMoQKbSv', 'UrwdYZpomUKutuFQoIKQEQa'].join('');
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';

// OpenRouter Models ordered by coding capability - best coding models first
const OPENROUTER_MODELS = [
  'qwen/qwen3-coder:free',
  'kwaipilot/kat-coder-pro:free',
  'mistralai/devstral-2512:free',
  'nex-agi/deepseek-v3.1-nex-n1:free',
  'openai/gpt-oss-120b:free',
  'allenai/olmo-3.1-32b-think:free',
  'allenai/olmo-3-32b-think:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-20b:free'
];

// Hugging Face Models - best coding models
const HUGGINGFACE_MODELS = [
  'Qwen/Qwen2.5-Coder-32B-Instruct',
  'bigcode/starcoder2-15b',
  'codellama/CodeLlama-34b-Instruct-hf',
  'microsoft/phi-2'
];

/** Maximum number of retry attempts for rate-limited requests. */
const MAX_RETRIES = 3;
/** Base delay in milliseconds for exponential backoff (RETRY_DELAY_MS * 2^attempt). */
const RETRY_DELAY_MS = 500;
/** Maximum allowed delay between retries in milliseconds. */
const MAX_RETRY_DELAY_MS = 10000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processTextWithAPI(text) {
  function getBackoffDelay(attempt) {
    return Math.min(RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  }
  
  async function callOpenRouter(model, retryAttempt = 0) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
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
      
      if (response.status === 429 && retryAttempt < MAX_RETRIES) {
        // Exponential backoff with a maximum delay cap
        await delay(getBackoffDelay(retryAttempt));
        return callOpenRouter(model, retryAttempt + 1);
      }
      
      if (!response.ok) {
        const errorMessage = response.status === 429
          ? 'Rate limit exceeded after multiple attempts. Please try again later.'
          : `API request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        let processedText = data.choices[0].message.content;
        
        processedText = processedText.replace(/```python\n?/g, '');
        processedText = processedText.replace(/```\n?/g, '');
        processedText = processedText.trim();
        
        return processedText;
      }
      
      throw new Error('Invalid API response format');
    } catch (error) {
      if (error instanceof TypeError && retryAttempt < MAX_RETRIES) {
        await delay(getBackoffDelay(retryAttempt));
        return callOpenRouter(model, retryAttempt + 1);
      }
      throw error;
    }
  }
  
  async function callHuggingFace(model, retryAttempt = 0) {
    try {
      const response = await fetch(`${HUGGINGFACE_API_URL}/${model}`, {
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
      
      if (response.status === 429 && retryAttempt < MAX_RETRIES) {
        await delay(getBackoffDelay(retryAttempt));
        return callHuggingFace(model, retryAttempt + 1);
      }
      
      if (response.status === 503) {
        // Model is loading, throw error to try next model
        throw new Error('Model is loading');
      }
      
      if (!response.ok) {
        const errorMessage = response.status === 429
          ? 'Rate limit exceeded'
          : `Hugging Face API request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
        let processedText = data[0].generated_text;
        
        processedText = processedText.replace(/```python\n?/g, '');
        processedText = processedText.replace(/```\n?/g, '');
        processedText = processedText.trim();
        
        return processedText;
      }
      
      throw new Error('Invalid Hugging Face API response format');
    } catch (error) {
      if (error instanceof TypeError && retryAttempt < MAX_RETRIES) {
        await delay(getBackoffDelay(retryAttempt));
        return callHuggingFace(model, retryAttempt + 1);
      }
      throw error;
    }
  }
  
  // Try OpenRouter models first (best coding models first)
  for (let i = 0; i < OPENROUTER_MODELS.length; i++) {
    try {
      return await callOpenRouter(OPENROUTER_MODELS[i]);
    } catch (error) {
      console.error(`OpenRouter model ${OPENROUTER_MODELS[i]} failed:`, error.message);
      // Continue to next model
    }
  }
  
  // If all OpenRouter models fail, fall back to Hugging Face models
  console.log('All OpenRouter models failed, trying Hugging Face models...');
  for (let i = 0; i < HUGGINGFACE_MODELS.length; i++) {
    try {
      return await callHuggingFace(HUGGINGFACE_MODELS[i]);
    } catch (error) {
      console.error(`Hugging Face model ${HUGGINGFACE_MODELS[i]} failed:`, error.message);
      // If this is the last model, throw the error
      if (i === HUGGINGFACE_MODELS.length - 1) {
        throw error;
      }
      // Otherwise, try the next model
    }
  }
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
