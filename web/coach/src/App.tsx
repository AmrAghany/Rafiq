import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isCoach } from './api';
import { applyLanguage } from './i18n';
import { Queue } from './Queue';
import { SignIn } from './SignIn';
import { supabase } from './supabase';
import { Workspace } from './Workspace';

export function App() {
  const { t, i18n } = useTranslation();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const coach = useQuery({
    queryKey: ['is_coach', session?.user.id],
    queryFn: isCoach,
    enabled: !!session,
  });

  const header = (
    <header>
      <strong>{t('app.title')}</strong>
      <span className="spacer" />
      <button className="link" onClick={() => applyLanguage(i18n.language === 'ar' ? 'en' : 'ar')}>
        {t('app.language')}
      </button>
      {session ? (
        <button className="link" onClick={() => void supabase.auth.signOut()}>
          {t('app.signOut')}
        </button>
      ) : null}
    </header>
  );

  let body;
  if (session === undefined || (session && coach.isPending)) body = <p>{t('app.loading')}</p>;
  else if (!session) body = <SignIn />;
  else if (coach.isError) body = <p className="warn">{t('app.error')}</p>;
  else if (!coach.data) body = <p className="card narrow">{t('app.notCoach')}</p>;
  else if (open) body = <Workspace id={open} onBack={() => setOpen(null)} />;
  else body = <Queue onOpen={setOpen} />;

  return (
    <>
      {header}
      <main>{body}</main>
    </>
  );
}
