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

const ASSISTANT_FUNCTION_NAME = 'assistant-chat';

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

  const { data, error } = await supabase.functions.invoke(ASSISTANT_FUNCTION_NAME, {
    body: {
      history: normalizedHistory,
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

  return {
    text: reply.text,
    model: reply.model,
  };
};
