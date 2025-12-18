const API_KEY = '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';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = [
  'mistralai/devstral-2512:free',
  'kwaipilot/kat-coder-pro:free',
  'allenai/olmo-3.1-32b-think:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nex-agi/deepseek-v3.1-nex-n1:free',
  'allenai/olmo-3-32b-think:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-coder:free',
  'openai/gpt-oss-20b:free'
];

async function processTextWithAPI(text) {
  const modelIndex = Math.floor(Math.random() * MODELS.length);
  const selectedModel = MODELS[modelIndex];
  
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
        model: selectedModel,
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
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
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
    console.error('API processing error:', error);
    throw error;
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
