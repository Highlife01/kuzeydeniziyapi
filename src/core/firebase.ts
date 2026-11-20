import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'karacateknik-b202f',
  appId: '1:637491972242:web:eba0aaa81a9f5dc339fe4b',
  storageBucket: 'karacateknik-b202f.firebasestorage.app',
  apiKey: 'AIzaSyBQ7jDW4uvq1O-NHR_UIfKkGnYi7TG5Ug0',
  authDomain: 'karacateknik-b202f.firebaseapp.com',
  messagingSenderId: '637491972242',
  measurementId: 'G-1KG2MMYZ2W',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIRESTORE_DATABASE_ID = 'kuzeydenizi-db';
export const db = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true }, FIRESTORE_DATABASE_ID);
  } catch {
    try {
      return getFirestore(app, FIRESTORE_DATABASE_ID);
    } catch {
      return getFirestore(app);
    }
  }
})();

export const SUPER_ADMIN_EMAILS = [
  'cebrailkara@gmail.com',
  'info@kuzeydeniziyapi.com.tr',
  'yalinizlargrup@gmail.com',
  'ilkeryaliniz@gmail.com',
];

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
};
