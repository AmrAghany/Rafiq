import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useOnboarding } from '@/features/onboarding/store';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  /** False until the stored session has been read, so the auth gate doesn't flash. */
  isLoaded: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, isLoaded: false });

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ session: null, isLoaded: false });

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => active && setState({ session: data.session, isLoaded: true }))
      .catch(() => active && setState({ session: null, isLoaded: true }));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, isLoaded: true });
      // Never let one member's cached health data survive into another session.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        useOnboarding.getState().reset();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
