import { useEffect, useState } from 'react';

import { ensureProfileForCurrentSession } from '@/features/auth/service';
import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';

export const useAuthSession = (): boolean => {
  const [loading, setLoading] = useState(true);
  const setUserId = useAuthStore((s) => s.setUserId);

  useEffect(() => {
    let mounted = true;

    const bootstrapSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUserId(data.session?.user.id ?? null);

        await ensureProfileForCurrentSession();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserId(session?.user.id ?? null);
      if (session?.user?.id) {
        await ensureProfileForCurrentSession();
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [setUserId]);

  return loading;
};
