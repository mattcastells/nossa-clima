import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from './env';

const SUPABASE_REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const onUpstreamAbort = () => controller.abort();

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado (${SUPABASE_REQUEST_TIMEOUT_MS / 1000}s) al conectar con Supabase.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener?.('abort', onUpstreamAbort);
  }
};

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
