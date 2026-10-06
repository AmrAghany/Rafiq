import { Redirect } from 'expo-router';

// OAuth redirects (rafiq://auth/callback) are consumed by WebBrowser.openAuthSessionAsync
// in features/auth/oauth.ts. If the OS also routes the deep link here, just go home;
// the auth gate in the root layout picks the right stack.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
