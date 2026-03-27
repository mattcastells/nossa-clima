import { supabase } from '@/lib/supabase';
import type { AssistantActionProposal, AssistantPendingActionContext } from '@/features/assistant/actions';

export interface AssistantReply {
  text: string;
  model: string;
  action: AssistantActionProposal | null;
}

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string | null;
  audioDataUrl?: string | null;
}

export interface AssistantContext {
  currentDate: string;
  timeZone?: string | null;
}

export interface SendAssistantMessageInput {
  history: AssistantHistoryMessage[];
  context: AssistantContext;
  pendingAction?: AssistantPendingActionContext | null;
}

const ASSISTANT_FUNCTION_NAME = 'assistant-chat';
const ACTION_TYPES = new Set([
  'create_store',
  'create_item',
  'create_service',
  'create_appointment',
  'create_job',
  'create_store_price_batch',
]);
const ACTION_CONFIDENCE = new Set(['low', 'medium', 'high']);

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  const lines = trimmed.split('\n');
  if (lines.length >= 2 && lines[0]?.startsWith('```') && lines.at(-1)?.trim() === '```') {
    return lines.slice(1, -1).join('\n').trim();
  }

  return trimmed;
};

const extractBalancedJsonObject = (value: string): string | null => {
  let start = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return value.slice(start, index + 1).trim();
      }
    }
  }

  return null;
};

const extractAssistantJsonCandidate = (value: string): string | null => {
  const normalized = stripCodeFence(value);
  if (!normalized) return null;

  if (normalized.startsWith('{')) {
    return extractBalancedJsonObject(normalized);
  }

  const firstBrace = normalized.indexOf('{');
  if (firstBrace < 0) return null;

  return extractBalancedJsonObject(normalized.slice(firstBrace));
};

const toAssistantError = (error: unknown): Error => {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      if (message.includes('401') || message.includes('Unauthorized')) {
        return new Error('Tu sesion no es valida para usar el asistente. Cerra sesion y volve a ingresar.');
      }
      if (message.includes('Failed to send a request to the Edge Function') || message.includes('404')) {
        return new Error(`No se encontro la funcion ${ASSISTANT_FUNCTION_NAME} en Supabase.`);
      }
      return error;
    }
  }

  return new Error('No se pudo consultar el asistente.');
};

const parseAssistantActionProposal = (value: unknown): AssistantActionProposal | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as {
    type?: unknown;
    summary?: unknown;
    confidence?: unknown;
    payload?: unknown;
  };

  if (typeof candidate.type !== 'string' || !ACTION_TYPES.has(candidate.type)) {
    return null;
  }

  const normalized: AssistantActionProposal = {
    type: candidate.type as AssistantActionProposal['type'],
  };

  if (typeof candidate.summary === 'string' && candidate.summary.trim()) {
    normalized.summary = candidate.summary.trim();
  }

  if (typeof candidate.confidence === 'string' && ACTION_CONFIDENCE.has(candidate.confidence)) {
    normalized.confidence = candidate.confidence as 'low' | 'medium' | 'high';
  }

  if (candidate.payload && typeof candidate.payload === 'object' && !Array.isArray(candidate.payload)) {
    normalized.payload = candidate.payload as Record<string, unknown>;
  }

  return normalized;
};

const parseAssistantEnvelopeFromText = (
  value: string,
): {
  text: string;
  action: AssistantActionProposal | null;
} | null => {
  const jsonCandidate = extractAssistantJsonCandidate(value);
  if (!jsonCandidate) return null;

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      reply_text?: unknown;
      action?: unknown;
    };

    const parsedAction = parseAssistantActionProposal(parsed.action);
    const replyText = typeof parsed.reply_text === 'string' && parsed.reply_text.trim() ? parsed.reply_text.trim() : '';

    if (!replyText && !parsedAction) {
      return null;
    }

    return {
      text: replyText || value.trim(),
      action: parsedAction,
    };
  } catch {
    return null;
  }
};

export const sendAssistantMessage = async ({ history, context, pendingAction }: SendAssistantMessageInput): Promise<AssistantReply> => {
  const normalizedHistory = history
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
      imageDataUrl: message.imageDataUrl?.trim() || null,
      audioDataUrl: message.audioDataUrl?.trim() || null,
    }))
    .filter((message) => message.text.length > 0 || message.imageDataUrl || message.audioDataUrl);

  if (normalizedHistory.length === 0) {
    throw new Error('Escribi una consulta o adjunta una imagen o audio.');
  }

  const { data, error } = await supabase.functions.invoke(ASSISTANT_FUNCTION_NAME, {
    body: {
      history: normalizedHistory,
      context: {
        currentDate: context.currentDate,
        timeZone: context.timeZone ?? null,
      },
      pendingAction: pendingAction ?? null,
    },
  });

  if (error) {
    throw toAssistantError(error);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('La respuesta del asistente llego vacia.');
  }

  const reply = data as Partial<AssistantReply> & { error?: string };
  if (reply.error) {
    throw new Error(reply.error);
  }

  if (typeof reply.text !== 'string' || typeof reply.model !== 'string') {
    throw new Error('La respuesta del asistente no tuvo el formato esperado.');
  }

  const fallbackEnvelope = parseAssistantEnvelopeFromText(reply.text);

  return {
    text: fallbackEnvelope?.text ?? reply.text,
    model: reply.model,
    action: parseAssistantActionProposal(reply.action) ?? fallbackEnvelope?.action ?? null,
  };
};
