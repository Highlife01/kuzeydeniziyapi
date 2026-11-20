import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../core/firebase';

export { auth };

export async function connectGmailPopup(): Promise<{ email: string; displayName: string; oauthAccessToken: string }> {
  const mainApp = auth.app;
  const secondary =
    getApps().find((a) => a.name === 'cb-gmail-oauth') ||
    initializeApp(mainApp.options, 'cb-gmail-oauth');
  const oauthAuth = getAuth(secondary);
  const provider = new GoogleAuthProvider();
  provider.addScope('https://mail.google.com/');
  provider.setCustomParameters({ prompt: 'select_account consent' });
  try {
    const result = await signInWithPopup(oauthAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const oauthAccessToken = credential?.accessToken || '';
    const email = result.user.email || '';
    const displayName = result.user.displayName || email.split('@')[0] || 'Gmail';
    if (!email || !oauthAccessToken) {
      throw new Error('Google hesabından e-posta veya erişim izni alınamadı.');
    }
    return { email, displayName, oauthAccessToken };
  } finally {
    try {
      await signOut(oauthAuth);
    } catch {
      /* ignore secondary cleanup errors */
    }
  }
}
