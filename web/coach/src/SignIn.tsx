import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { supabase } from './supabase';

export function SignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    setFailed(!!error);
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>{t('signIn.title')}</h1>
      <label>
        {t('signIn.email')}
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        {t('signIn.password')}
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {failed ? (
        <p role="alert" className="warn">
          {t('signIn.failed')}
        </p>
      ) : null}
      <button type="submit" disabled={busy}>
        {t('signIn.submit')}
      </button>
    </form>
  );
}
