const API_KEY = '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';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Models ordered by coding capability - best coding models first
const MODELS = [
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
  
  async function callWithModel(model, retryAttempt = 0) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
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
        return callWithModel(model, retryAttempt + 1);
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
        return callWithModel(model, retryAttempt + 1);
      }
      throw error;
    }
  }
  
  // Try models in order (best coding models first), fall back to next if one fails
  for (let i = 0; i < MODELS.length; i++) {
    try {
      return await callWithModel(MODELS[i]);
    } catch (error) {
      console.error(`Model ${MODELS[i]} failed:`, error.message);
      // If this is the last model, throw the error
      if (i === MODELS.length - 1) {
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
