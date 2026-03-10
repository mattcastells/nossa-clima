import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store';

export const useAuthSession = (): boolean => {
  const [loading, setLoading] = useState(true);
  const setUserId = useAuthStore((s) => s.setUserId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [setUserId]);

  return loading;
};
