import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export interface AssistantReply {
  text: string;
  model: string;
}

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string | null;
}

export interface SendAssistantMessageInput {
  history: AssistantHistoryMessage[];
}

const ASSISTANT_FUNCTION_NAME = env.aiFunctionName ?? 'assistant-chat';
const ASSISTANT_FUNCTION_URL = `${env.supabaseUrl}/functions/v1/${ASSISTANT_FUNCTION_NAME}`;

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

export const sendAssistantMessage = async ({ history }: SendAssistantMessageInput): Promise<AssistantReply> => {
  const normalizedHistory = history
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
      imageDataUrl: message.imageDataUrl?.trim() || null,
    }))
    .filter((message) => message.text.length > 0 || message.imageDataUrl);

  if (normalizedHistory.length === 0) {
    throw new Error('Escribi una consulta o adjunta una imagen.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token?.trim();
  if (!accessToken) {
    throw new Error('Tu sesion no es valida para usar el asistente. Cerra sesion y volve a ingresar.');
  }

  const response = await fetch(ASSISTANT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      history: normalizedHistory,
    }),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw toAssistantError(new Error(`${response.status} ${response.statusText}`));
    }
    throw new Error('La respuesta del asistente no fue JSON valido.');
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `${response.status} ${response.statusText}`;
    throw toAssistantError(new Error(message));
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

  return {
    text: reply.text,
    model: reply.model,
  };
};
