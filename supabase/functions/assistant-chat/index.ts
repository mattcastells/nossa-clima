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
    audioDataUrl?: string | null;
  }>;
  context?: {
    currentDate?: string;
    timeZone?: string | null;
  };
  pendingAction?: {
    type?: string;
    summary?: string;
    confidence?: string;
    payload?: Record<string, unknown> | null;
    problems?: string[];
    hints?: string[];
  } | null;
};

const ACTION_TYPES = new Set([
  'create_store',
  'create_item',
  'create_service',
  'create_appointment',
  'create_job',
  'create_store_price_batch',
]);
const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high']);

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

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  const lines = trimmed.split('\n');
  if (lines.length >= 2 && lines[0]?.startsWith('```')) {
    const lastLine = lines.at(-1)?.trim() ?? '';
    if (lastLine === '```') {
      return lines.slice(1, -1).join('\n').trim();
    }
  }

  return trimmed;
};

const extractJsonCandidate = (value: string): string | null => {
  const normalized = stripCodeFence(value);
  if (!normalized) return null;

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    return normalized;
  }

  const firstBrace = normalized.indexOf('{');
  const lastBrace = normalized.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return normalized.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
};

const sanitizeAction = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as {
    type?: unknown;
    summary?: unknown;
    confidence?: unknown;
    payload?: unknown;
  };

  if (typeof candidate.type !== 'string' || !ACTION_TYPES.has(candidate.type)) {
    return null;
  }

  const normalized: Record<string, unknown> = {
    type: candidate.type,
  };

  if (typeof candidate.summary === 'string' && candidate.summary.trim()) {
    normalized.summary = candidate.summary.trim();
  }

  if (typeof candidate.confidence === 'string' && CONFIDENCE_VALUES.has(candidate.confidence)) {
    normalized.confidence = candidate.confidence;
  }

  if (candidate.payload && typeof candidate.payload === 'object' && !Array.isArray(candidate.payload)) {
    normalized.payload = candidate.payload as Record<string, unknown>;
  }

  return normalized;
};

const sanitizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim());
};

const sanitizePendingAction = (value: unknown): Record<string, unknown> | null => {
  const action = sanitizeAction(value);
  if (!action) return null;

  const candidate = value as {
    problems?: unknown;
    hints?: unknown;
  };

  return {
    ...action,
    problems: sanitizeStringList(candidate.problems),
    hints: sanitizeStringList(candidate.hints),
  };
};

const parseAssistantJsonResponse = (
  rawText: string,
): {
  replyText: string;
  action: Record<string, unknown> | null;
} | null => {
  const jsonCandidate = extractJsonCandidate(rawText);
  if (!jsonCandidate) return null;

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      reply_text?: unknown;
      action?: unknown;
    };

    const replyText = typeof parsed.reply_text === 'string' && parsed.reply_text.trim() ? parsed.reply_text.trim() : rawText.trim();
    return {
      replyText,
      action: sanitizeAction(parsed.action),
    };
  } catch {
    return null;
  }
};

const buildActionInstruction = (
  currentDate: string,
  timeZone: string,
  pendingAction: Record<string, unknown> | null,
): string => `
Tambien podes proponer acciones concretas para la app, pero SOLO en formato JSON valido.

Responde SIEMPRE con un unico objeto JSON con esta forma exacta:
{
  "reply_text": "respuesta breve y clara en espanol para mostrar al usuario",
  "action": null
}

Si el usuario pide crear/agendar/agregar algo y hay datos suficientes, usa:
{
  "reply_text": "explicacion breve de lo que entendiste",
  "action": {
    "type": "create_store" | "create_item" | "create_service" | "create_appointment" | "create_job" | "create_store_price_batch",
    "summary": "resumen corto de la accion",
    "confidence": "low" | "medium" | "high",
    "payload": { ... }
  }
}

Reglas:
- Solo proponer altas nuevas. Nunca editar, borrar, archivar ni ejecutar acciones destructivas.
- Si la intencion del usuario es clara y corresponde a una accion soportada, devolve la accion aunque falten datos. No inventes los faltantes.
- Usa "action": null solo si no hay una intencion clara de crear algo o si el pedido no corresponde a una accion soportada.
- Contexto temporal del usuario:
  - fecha local actual: ${currentDate}
  - zona horaria: ${timeZone}
- Si el usuario dice "hoy", "manana", "pasado manana" o una fecha relativa, converti a fecha absoluta YYYY-MM-DD.
- Para horas usa HH:mm:ss.
- Para "create_store", payload permitido: name, description, address, phone, notes.
- Para "create_item", payload permitido: name, description, notes, category, base_price_label, sku, item_type.
- Para "create_service", payload permitido: name, description, category, base_price, unit_type.
- Para "create_appointment", payload permitido: title, notes, scheduled_for, starts_at, ends_at.
- Para "create_job", payload permitido:
  - client_name, client_phone, title, description, notes
  - scheduled_for, starts_at, ends_at
  - default_material_margin_percent
  - source_store: null o { name, description, address, phone, notes }
  - services: array de objetos con name, quantity, unit_price, base_price, description, category, unit_type, notes
  - materials: array de objetos con name, quantity, unit, unit_price, description, notes, category, base_price_label, sku, item_type
- Para "create_store_price_batch", payload permitido:
  - store: { name, description, address, phone, notes }
  - observed_at, currency, notes
  - items: array de objetos con name, price, quantity_reference, description, notes, category, base_price_label, sku, item_type
- Para servicios, "base_price" debe ser numero sin simbolos ni texto.
- Si el usuario pide crear un trabajo o presupuesto con servicios/materiales, usa "create_job".
- Si el usuario pide asociar materiales a una tienda con sus precios, usa "create_store_price_batch".
- En "create_job", si hay materiales, incluye siempre "source_store" si el usuario la menciono. No inventes tiendas.
- En "create_job", no inventes precios de servicios ni materiales.
- En "create_job", si un servicio no tiene precio claro, dejalo sin precio y pedi la aclaracion.
- En "create_job", si un material no tiene precio claro, dejalo sin "unit_price" y pedi la aclaracion o la tienda correspondiente.
- Si el usuario no indica la tienda de los materiales, pedi esa aclaracion antes de confirmar el trabajo.
- Si no se aclara margen global de materiales, usa null en "default_material_margin_percent".
- No inventes precios. Si no sabes el valor, usa null.
- Si el tipo de item no es claro, usa "material".
- Si existe pending_action, significa que ya hay un borrador pendiente y debes actualizar ESE borrador con el ultimo mensaje del usuario.
- Cuando falten datos para completar la accion, explica claramente en "reply_text" que dato falta.
- Con pending_action:
  - conserva los datos ya confirmados salvo que el usuario los cambie explicitamente
  - completa los campos faltantes con el nuevo mensaje
  - devuelve la misma accion actualizada, no una accion nueva distinta, salvo que el usuario cambie claramente de objetivo
  - si todavia faltan datos, NO devuelvas action null: devolve la accion actualizada con lo que falte y explicalo en reply_text
- Si propones un turno, en reply_text menciona la fecha absoluta que interpretaste.
- Si propones un trabajo con fecha, en reply_text menciona la fecha absoluta que interpretaste.
- No agregues texto antes ni despues del JSON.
${pendingAction ? `\nBorrador pendiente actual:\n${JSON.stringify(pendingAction, null, 2)}` : ''}
`.trim();

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
          audioDataUrl: entry?.audioDataUrl?.trim() ?? '',
        }))
        .filter((entry) => entry.text.length > 0 || entry.imageDataUrl.length > 0 || entry.audioDataUrl.length > 0)
    : [];

  if (normalizedHistory.length === 0) {
    return json({ error: 'Envia texto, imagen, audio o cualquier combinacion de esos datos.' }, 400);
  }

  const currentDate = payload.context?.currentDate?.trim() || new Date().toISOString().slice(0, 10);
  const timeZone = payload.context?.timeZone?.trim() || 'America/Argentina/Buenos_Aires';
  const pendingAction = sanitizePendingAction(payload.pendingAction);
  const systemPrompt = `${instructions}\n\n${buildActionInstruction(currentDate, timeZone, pendingAction)}`;

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

      if (entry.audioDataUrl) {
        if (entry.audioDataUrl.length > 4_000_000) {
          throw new Error('El audio es demasiado grande. Proba con una grabacion mas corta.');
        }

        const parsedAudio = parseDataUrl(entry.audioDataUrl);
        if (!parsedAudio) {
          throw new Error('El audio adjunto no tiene un formato valido.');
        }

        parts.push({
          inline_data: {
            mime_type: parsedAudio.mimeType,
            data: parsedAudio.data,
          },
        });
      }

      return {
        role: entry.role,
        parts,
      };
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo procesar el adjunto enviado.' }, 400);
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
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 900,
          temperature: 0.2,
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

  const parsedResponse = parseAssistantJsonResponse(text);
  if (parsedResponse) {
    return json({
      text: parsedResponse.replyText,
      model,
      action: parsedResponse.action,
    });
  }

  return json({
    text,
    model,
    action: null,
  });
});
