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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return Response.json(
        {
          success: false,
          error: 'Please provide a prompt to enhance.'
        },
        { status: 400 }
      );
    }

    const enhanced = enrichPrompt(prompt);

    return Response.json({
      success: true,
      enhancedPrompt: enhanced,
      model: 'ai-horde-photorealistic'
    });
  } catch {
    return Response.json(
      {
        success: false,
        error: 'Could not enhance prompt at this moment.'
      },
      { status: 500 }
    );
  }
}