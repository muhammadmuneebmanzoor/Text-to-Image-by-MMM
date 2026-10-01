const DEFAULT_MODEL_ID = 'ai-horde-photorealistic';
const DEFAULT_MODEL_LABEL = 'AI Horde Photorealistic';

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

  let extraContext = '';

  if (
    lower.includes('karbala') ||
    lower.includes('shrine') ||
    lower.includes('dome') ||
    lower.includes('mosque')
  ) {
    extraContext =
      ', majestic golden dome, towering minarets, intricate geometric mosaic tiles, marble courtyard, radiant golden hour lighting';
  }

  return `${trimmed}${extraContext}, ${missing.slice(0, 4).join(', ')}`;
}

async function generateWithHorde(
  promptText: string,
  apiKey?: string
): Promise<string> {
  const hordeKey =
    apiKey && apiKey.trim() !== ''
      ? apiKey.trim()
      : '0000000000';

  const submitRes = await fetch(
    'https://aihorde.net/api/v2/generate/async',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: hordeKey,
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
          'stable_diffusion',
          'Realistic Vision',
          'AbsoluteReality',
          'Dreamshaper',
          'Deliberate'
        ]
      })
    }
  );

  if (!submitRes.ok) {
    const errorText = await submitRes.text();

    throw new Error(
      `AI Horde submission failed: ${submitRes.status} ${errorText}`
    );
  }

  const submitData = await submitRes.json();
  const jobId = submitData.id;

  if (!jobId) {
    throw new Error(
      'AI Horde did not return a generation task ID.'
    );
  }

  const startTime = Date.now();
  const maxWaitMs = 240000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, 6500));

    const checkRes = await fetch(
      `https://aihorde.net/api/v2/generate/status/${jobId}`,
      {
        headers: {
          'Client-Agent':
            'TextToImageMMM:1.0:user@app.internal'
        }
      }
    );

    if (!checkRes.ok) {
      continue;
    }

    const checkData = await checkRes.json();

    if (
      checkData.done &&
      checkData.generations &&
      checkData.generations.length > 0
    ) {
      const gen = checkData.generations[0];
      const imgVal = gen.img;

      if (!imgVal) {
        throw new Error(
          'AI Horde completed without an image payload.'
        );
      }

      if (imgVal.startsWith('http')) {
        const imgFetch = await fetch(imgVal);

        if (!imgFetch.ok) {
          throw new Error(
            'Could not download the generated image.'
          );
        }

        const buffer = await imgFetch.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        const mime =
          imgFetch.headers.get('content-type') ||
          'image/webp';

        return `data:${mime};base64,${base64}`;
      }

      const mime = imgVal.startsWith('/9j/')
        ? 'image/jpeg'
        : imgVal.startsWith('iVBORw')
          ? 'image/png'
          : 'image/webp';

      return `data:${mime};base64,${imgVal}`;
    }

    if (checkData.faulted) {
      throw new Error(
        'AI Horde worker encountered an error generating this image.'
      );
    }
  }

  throw new Error(
    'AI Horde request timed out waiting in the worker queue. Please try again.'
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body?.prompt;

    if (
      !prompt ||
      typeof prompt !== 'string' ||
      !prompt.trim()
    ) {
      return Response.json(
        {
          success: false,
          error:
            'Write a description first, then press Generate image.'
        },
        { status: 400 }
      );
    }

    const cleanPrompt = prompt.trim();
    const promptToUse = enrichPrompt(cleanPrompt);

    const imageUrl = await generateWithHorde(
      promptToUse,
      process.env.HORDE_API_KEY
    );

    return Response.json({
      success: true,
      imageUrl,
      model: DEFAULT_MODEL_ID,
      modelId: DEFAULT_MODEL_ID,
      modelLabel: DEFAULT_MODEL_LABEL,
      enhancedPrompt:
        promptToUse !== cleanPrompt
          ? promptToUse
          : undefined
    });
  } catch (error: any) {
    console.error(
      'Error generating image via AI Horde:',
      error?.message
    );

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          'Error generating image with AI Horde.'
      },
      { status: 500 }
    );
  }
}