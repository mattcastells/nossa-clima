import { useEffect, useState } from 'react';

import { ensureProfileForCurrentSession } from '@/features/auth/service';
import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';

const SESSION_BOOT_TIMEOUT_MS = 8000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timeoutId));
  });

export const useAuthSession = (): boolean => {
  const [loading, setLoading] = useState(true);
  const setUserId = useAuthStore((s) => s.setUserId);

  useEffect(() => {
    let mounted = true;

    const syncProfileWithoutBlocking = () => {
      ensureProfileForCurrentSession().catch((error) => {
        // eslint-disable-next-line no-console
        console.warn('No se pudo sincronizar perfil de sesión:', error);
      });
    };

    const bootstrapSession = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_BOOT_TIMEOUT_MS,
          'Timeout restaurando sesión.',
        );
        if (error) throw error;
        if (!mounted) return;
        setUserId(data.session?.user.id ?? null);

        if (data.session?.user?.id) {
          syncProfileWithoutBlocking();
        }
      } catch (error) {
        if (mounted) {
          // eslint-disable-next-line no-console
          console.warn('No se pudo restaurar sesión:', error);
          setUserId(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      if (session?.user?.id) {
        syncProfileWithoutBlocking();
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [setUserId]);

  return loading;
};
