import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_MODEL_ID = "ai-horde-photorealistic";
export const DEFAULT_MODEL_LABEL = "AI Horde Photorealistic";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // Static files and client serving
  app.use('/assets', express.static(path.resolve(__dirname, 'assets')));
  app.use(express.static(__dirname));
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'AI Horde Image Generator',
      model: DEFAULT_MODEL_ID,
      api: 'AI Horde Exclusive'
    });
  });

  // GET /api/models
  app.get(['/api/models', '/models'], (_req, res) => {
    return res.json({
      default: DEFAULT_MODEL_ID,
      models: [
        {
          key: DEFAULT_MODEL_ID,
          label: DEFAULT_MODEL_LABEL,
          modelId: DEFAULT_MODEL_ID,
          description: "Crowdsourced photorealistic image generation powered exclusively by AI Horde."
        }
      ]
    });
  });

  // Smart prompt enhancer for photorealistic generation without any paid/third-party AI
  function enrichPrompt(rawPrompt: string): string {
    const trimmed = rawPrompt.trim();
    if (!trimmed) return '';

    const lower = trimmed.toLowerCase();
    const qualityTags = [
      'photorealistic',
      '8k resolution',
      'sharp focus',
      'cinematic natural lighting',
      '35mm architectural lens',
      'intricate fine details',
      'masterpiece'
    ];

    const missing = qualityTags.filter(tag => !lower.includes(tag));
    if (missing.length === 0) {
      return trimmed;
    }

    // If describing a holy site or landmark, add specific respectful architectural terms
    let extraContext = '';
    if (lower.includes('karbala') || lower.includes('shrine') || lower.includes('dome') || lower.includes('mosque')) {
      extraContext = ', majestic golden dome, towering minarets, intricate geometric mosaic tiles, marble courtyard, radiant golden hour lighting';
    }

    return `${trimmed}${extraContext}, ${missing.slice(0, 4).join(', ')}`;
  }

  // POST /enhance-prompt powered locally with prompt engineering
  app.post(['/enhance-prompt', '/api/enhance-prompt'], (req, res) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a prompt to enhance.'
        });
      }

      const enhanced = enrichPrompt(prompt);

      return res.json({
        success: true,
        enhancedPrompt: enhanced,
        model: DEFAULT_MODEL_ID
      });

    } catch (error: any) {
      return res.json({
        success: true,
        enhancedPrompt: req.body?.prompt?.trim() || '',
        model: DEFAULT_MODEL_ID
      });
    }
  });

  // Helper function to generate image via AI Horde
  async function generateWithHorde(promptText: string, apiKey?: string): Promise<string> {
    const hordeKey = apiKey && apiKey.trim() !== '' ? apiKey.trim() : '0000000000';

    const submitRes = await fetch('https://aihorde.net/api/v2/generate/async', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': hordeKey,
        'Client-Agent': 'TextToImageMMM:1.0:user@app.internal'
      },
      body: JSON.stringify({
        prompt: promptText,
        params: {
          sampler_name: 'k_euler',
          cfg_scale: 7.5,
          steps: 25,
          width: 512,
          height: 512,
          n: 1
        },
        nsfw: false,
        censor_nsfw: true,
        models: [
          "ICBINP - I Can't Believe It's Not Photography",
          "stable_diffusion",
          "Realistic Vision",
          "AbsoluteReality",
          "Dreamshaper",
          "Deliberate"
        ]
      })
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      throw new Error(`AI Horde submission failed: ${submitRes.status} ${errorText}`);
    }

    const submitData = await submitRes.json();
    const jobId = submitData.id;
    if (!jobId) {
      throw new Error('AI Horde did not return a generation task ID.');
    }

    // Poll for completion (up to 90 seconds)
    const startTime = Date.now();
    const maxWaitMs = 90000;

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, 6500));

      const checkRes = await fetch(`https://aihorde.net/api/v2/generate/status/${jobId}`, {
        headers: {
          'Client-Agent': 'TextToImageMMM:1.0:user@app.internal'
        }
      });

      if (!checkRes.ok) continue;

      const checkData = await checkRes.json();
      if (checkData.done && checkData.generations && checkData.generations.length > 0) {
        const gen = checkData.generations[0];
        const imgVal = gen.img;
        if (!imgVal) throw new Error('AI Horde completed without an image payload.');

        if (imgVal.startsWith('http')) {
          const imgFetch = await fetch(imgVal);
          const buffer = await imgFetch.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mime = imgFetch.headers.get('content-type') || 'image/webp';
          return `data:${mime};base64,${base64}`;
        } else {
          const mime = imgVal.startsWith('/9j/') ? 'image/jpeg' : (imgVal.startsWith('iVBORw') ? 'image/png' : 'image/webp');
          return `data:${mime};base64,${imgVal}`;
        }
      }

      if (checkData.faulted) {
        throw new Error('AI Horde worker encountered an error generating this image.');
      }
    }

    throw new Error('AI Horde request timed out waiting in worker queue. Please retry.');
  }

  // POST /generate endpoint using ONLY AI Horde
  app.post(['/generate', '/api/generate'], async (req, res) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Write a description first, then press Generate image.'
        });
      }

      const cleanPrompt = prompt.trim();
      const hordeApiKey = process.env.HORDE_API_KEY;

      // Enhance prompt with quality photography keywords
      const promptToUse = enrichPrompt(cleanPrompt);

      // Generate exclusively with AI Horde
      const imageUrl = await generateWithHorde(promptToUse, hordeApiKey);

      return res.json({
        success: true,
        imageUrl: imageUrl,
        model: DEFAULT_MODEL_ID,
        modelId: DEFAULT_MODEL_ID,
        modelLabel: DEFAULT_MODEL_LABEL,
        enhancedPrompt: promptToUse !== cleanPrompt ? promptToUse : undefined
      });

    } catch (error: any) {
      console.error('Error generating image via AI Horde:', error?.message);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Error generating image with AI Horde.'
      });
    }
  });

  // Client-side index.html serving
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT} [Powered Exclusively by AI Horde]`);
  });
}

startServer();
