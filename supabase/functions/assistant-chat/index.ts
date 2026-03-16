import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AssistantRequest = {
  history?: Array<{
    role?: string;
    text?: string;
    imageDataUrl?: string | null;
  }>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const parseDataUrl = (
  dataUrl: string,
): {
  mimeType: string;
  data: string;
} | null => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1]?.trim();
  const data = match[2]?.trim();

  if (!mimeType || !data) return null;

  return {
    mimeType,
    data,
  };
};

const extractOutputText = (payload: Record<string, unknown>): string => {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const chunks: string[] = [];

  candidates.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') return;
    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== 'object') return;

    const parts = Array.isArray((content as { parts?: unknown }).parts) ? (content as { parts: unknown[] }).parts : [];
    parts.forEach((part) => {
      if (!part || typeof part !== 'object') return;
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string' && text.trim()) {
        chunks.push(text.trim());
      }
    });
  });

  return chunks.join('\n\n').trim();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Metodo no permitido.' }, 405);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!apiKey) {
    return json({ error: 'Falta configurar GEMINI_API_KEY en Supabase.' }, 500);
  }

  const model = Deno.env.get('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
  const instructions =
    Deno.env.get('GEMINI_ASSISTANT_INSTRUCTIONS')?.trim() ||
    'Sos el asistente tecnico de Nossa Clima. Ayudas a personas que trabajan con aires acondicionados, refrigeracion, instalaciones tecnicas y electronica aplicada. Responde en espanol claro, concreto y util. Prioriza diagnostico, mantenimiento, materiales, seguridad electrica, herramientas, instalacion y service. Si la imagen o el texto no alcanzan para dar una respuesta confiable, explicalo y pedi el dato faltante. No inventes datos tecnicos.';

  let payload: AssistantRequest;

  try {
    payload = (await request.json()) as AssistantRequest;
  } catch {
    return json({ error: 'El body de la solicitud no es JSON valido.' }, 400);
  }

  const normalizedHistory = Array.isArray(payload.history)
    ? payload.history
        .map((entry) => ({
          role: entry?.role === 'assistant' ? 'model' : 'user',
          text: entry?.text?.trim() ?? '',
          imageDataUrl: entry?.imageDataUrl?.trim() ?? '',
        }))
        .filter((entry) => entry.text.length > 0 || entry.imageDataUrl.length > 0)
    : [];

  if (normalizedHistory.length === 0) {
    return json({ error: 'Envia texto, imagen o ambos.' }, 400);
  }

  let contents: Array<Record<string, unknown>>;
  try {
    contents = normalizedHistory.map((entry) => {
      const parts: Array<Record<string, unknown>> = [];

      if (entry.text) {
        parts.push({ text: entry.text });
      }

      if (entry.imageDataUrl) {
        if (entry.imageDataUrl.length > 7_000_000) {
          throw new Error('La imagen es demasiado grande. Proba con una mas liviana.');
        }

        const parsedImage = parseDataUrl(entry.imageDataUrl);
        if (!parsedImage) {
          throw new Error('La imagen adjunta no tiene un formato valido.');
        }

        parts.push({
          inline_data: {
            mime_type: parsedImage.mimeType,
            data: parsedImage.data,
          },
        });
      }

      return {
        role: entry.role,
        parts,
      };
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo procesar la imagen adjunta.' }, 400);
  }

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: instructions }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 900,
        },
      }),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo consultar Gemini.' }, 502);
  }

  const responsePayload = (await geminiResponse.json()) as Record<string, unknown>;

  if (!geminiResponse.ok) {
    const messageFromGemini =
      typeof responsePayload.error === 'object' &&
      responsePayload.error &&
      typeof (responsePayload.error as { message?: unknown }).message === 'string'
        ? (responsePayload.error as { message: string }).message
        : 'Gemini devolvio un error.';

    return json({ error: messageFromGemini }, geminiResponse.status);
  }

  const text = extractOutputText(responsePayload);
  if (!text) {
    return json({ error: 'Gemini no devolvio texto util para mostrar.' }, 502);
  }

  return json({
    text,
    model,
  });
});
