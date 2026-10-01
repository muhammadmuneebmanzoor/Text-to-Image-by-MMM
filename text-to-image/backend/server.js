// ==============================================================================
// Text-to-Image Generator Backend
// Built with Node.js & Express.js connected to Pollinations AI
// ==============================================================================

// 1. Load environment variables from .env file
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

// 2. Initialize the Express application
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Middlewares
// Enable CORS so the frontend can securely call this backend
app.use(cors());

// Parse incoming requests with JSON payloads
app.use(express.json());

// Optionally serve frontend files if frontend is placed next to backend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// ==============================================================================
// 4. API Endpoints
// ==============================================================================

/**
 * Health check route to verify server status
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Text-to-Image Backend' });
});

const ENHANCER_SYSTEM_PROMPT = `You are an expert image prompt enhancer.

The user will provide a short image idea.

Your job is to transform it into a detailed image-generation prompt.

If the input is a city, country, landmark, tourist destination, historical location, building, natural location, or other real-world place:
- identify the likely real-world location
- include the country when useful
- include recognizable landmarks when appropriate
- describe architecture, environment, atmosphere, lighting and camera perspective
- preserve the user's original intent
- do not invent fictional landmarks
- do not change the requested location
- do not add unrelated objects
- do not explain your reasoning
- return ONLY the final image prompt

If the user gives a person, animal, object, food, event, or abstract concept, enhance it appropriately without changing the subject.

Example:

Input:
Karbala

Output:
A realistic photographic view of Karbala, Iraq, featuring the Imam Husayn Shrine with its distinctive golden dome and minarets, surrounding urban architecture, people moving through the city, warm golden-hour lighting, realistic atmosphere, highly detailed architectural photography.

Input:
Paris

Output:
A realistic photographic view of Paris, France, featuring the Eiffel Tower, classic Parisian architecture, tree-lined streets, natural daylight, realistic urban atmosphere, highly detailed travel photography.

Input:
cat

Output:
A cute fluffy orange cat sitting on a windowsill, soft natural morning light, detailed fur, realistic photography, shallow depth of field.`;

/**
 * POST /enhance-prompt
 * Receives: { prompt: "Your text description" }
 * Returns:  { success: true, enhancedPrompt: "Detailed photographic view..." }
 */
app.post('/enhance-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a prompt to enhance.'
      });
    }

    const cleanPrompt = prompt.trim();
    const apiKey = process.env.POLLINATIONS_API_KEY;
    const hasCustomApiKey = Boolean(apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey.trim() !== '');

    let enhancedPrompt = '';

    // 1. If custom API key is present, attempt authenticated OpenAI-compatible endpoint
    if (hasCustomApiKey) {
      try {
        const genResponse = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: ENHANCER_SYSTEM_PROMPT },
              { role: 'user', content: cleanPrompt }
            ],
            model: 'openai'
          })
        });

        if (genResponse.ok) {
          const genData = await genResponse.json();
          if (genData?.choices?.[0]?.message?.content) {
            enhancedPrompt = genData.choices[0].message.content.trim();
          }
        }
      } catch (err) {
        console.warn('Authenticated text API attempt failed, trying public endpoint...');
      }
    }

    // 2. If no key or authenticated request did not return prompt, use text.pollinations.ai with openai-fast
    if (!enhancedPrompt) {
      const textResponse = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: ENHANCER_SYSTEM_PROMPT },
            { role: 'user', content: cleanPrompt }
          ],
          model: 'openai-fast'
        })
      });

      if (textResponse.ok) {
        const textResult = await textResponse.text();
        if (textResult && textResult.trim()) {
          enhancedPrompt = textResult.trim();
        }
      }
    }

    // 3. Clean up formatting if necessary
    if (enhancedPrompt) {
      enhancedPrompt = enhancedPrompt.replace(/^Output:\s*/i, '').replace(/^"|"$/g, '').trim();
    }

    // Fallback to original prompt if enhancement is empty
    if (!enhancedPrompt) {
      enhancedPrompt = cleanPrompt;
    }

    return res.json({
      success: true,
      enhancedPrompt: enhancedPrompt
    });

  } catch (error) {
    console.error('Error in /enhance-prompt:', error.message);
    // Graceful fallback to original prompt
    return res.json({
      success: true,
      enhancedPrompt: req.body?.prompt?.trim() || ''
    });
  }
});

/**
 * POST /generate
 * Receives: { prompt: "Your text description" }
 * Returns:  { success: true, imageUrl: "data:image/jpeg;base64,..." }
 */
app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    // Step 1: Validate the prompt
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Write a description first, then press Generate image.'
      });
    }

    const cleanPrompt = prompt.trim();

    // Step 2: Retrieve the secret API key from environment variables
    // (Never hardcode or expose this key to client-side code)
    const apiKey = process.env.POLLINATIONS_API_KEY;
    const hasCustomApiKey = Boolean(apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey.trim() !== '');

    // Step 3: Construct Pollinations API parameters
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const randomSeed = Math.floor(Math.random() * 1000000);

    let apiUrl;
    const requestHeaders = {};

    if (hasCustomApiKey) {
      // Authenticated request to official gen.pollinations.ai API
      apiUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&seed=${randomSeed}`;
      requestHeaders['Authorization'] = `Bearer ${apiKey.trim()}`;
    } else {
      // Direct generation endpoint (works without key)
      apiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&seed=${randomSeed}`;
    }

    // Step 4: Request image from Pollinations API with resilient fallback
    let apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: requestHeaders
    });

    // If authenticated endpoint fails due to invalid/expired key, gracefully fallback
    if (!apiResponse.ok && hasCustomApiKey && (apiResponse.status === 401 || apiResponse.status === 403)) {
      console.warn(`Pollinations returned ${apiResponse.status} with provided key, attempting fallback...`);
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&seed=${randomSeed}`;
      apiResponse = await fetch(fallbackUrl, { method: 'GET' });
    }

    // Step 5: Check if the API returned a successful response
    if (!apiResponse.ok) {
      console.error(`Pollinations API returned error status: ${apiResponse.status}`);
      return res.status(502).json({
        success: false,
        error: "Something went wrong while generating your image. Please try again."
      });
    }

    // Step 6: Convert image stream/buffer to Base64 Data URL
    // This allows the frontend to display the image immediately and enables direct downloading
    const contentType = apiResponse.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await apiResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    // Step 7: Return the successful JSON response to the frontend
    return res.json({
      success: true,
      imageUrl: dataUrl
    });

  } catch (error) {
    console.error('Server error in /generate:', error.message);
    return res.status(500).json({
      success: false,
      error: "Something went wrong while generating your image. Please try again."
    });
  }
});

// ==============================================================================
// 5. Start the Server
// ==============================================================================
app.listen(PORT, () => {
  console.log(`Text-to-Image backend server is running on http://localhost:${PORT}`);
});
