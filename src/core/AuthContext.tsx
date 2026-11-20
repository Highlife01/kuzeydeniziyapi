import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isSuperAdminEmail } from '../core/firebase';
import { ensureCloudSeeded, setDataServiceLocalScope } from '../services/dataService';
import { setErpLocalScope } from '../erp/services/erpStore';
import type { ErpRoleId } from '../erp/types/erp';

export type AccessMode = 'loading' | 'unauthenticated' | 'cloud-admin' | 'preview';

export interface AuthErpProfile {
  email: string;
  fullName: string;
  roleId: ErpRoleId;
  assignedProjectIds: string[];
  active: boolean;
}

interface AuthContextValue {
  user: FirebaseUser | null;
  mode: AccessMode;
  authError: string;
  isSuperAdmin: boolean;
  erpProfile: AuthErpProfile | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  enterPreviewMode: () => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const PREVIEW_STORAGE_KEY = 'cb_dashboard_preview_mode';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [mode, setMode] = useState<AccessMode>('loading');
  const [authError, setAuthError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [erpProfile, setErpProfile] = useState<AuthErpProfile | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setIsSuperAdmin(false);
        setErpProfile(null);
        setErpLocalScope('preview');
        setDataServiceLocalScope('preview');
        const savedPreview = sessionStorage.getItem(PREVIEW_STORAGE_KEY) === '1';
        setMode(savedPreview ? 'preview' : 'unauthenticated');
        return;
      }

      const email = fbUser.email?.toLowerCase().trim() || '';
      const superAdmin = isSuperAdminEmail(email);

      let authorized = superAdmin;
      let resolvedProfile: AuthErpProfile | null = superAdmin
        ? {
            email,
            fullName: fbUser.displayName || email,
            roleId: 'sirket_sahibi',
            assignedProjectIds: [],
            active: true,
          }
        : null;

      if (email && !superAdmin) {
        try {
          const [adminSnap, userSnap] = await Promise.all([
            getDoc(doc(db, 'authorized_admins', email)),
            getDoc(doc(db, 'users', email)),
          ]);
          const userData = userSnap.exists() ? userSnap.data() : null;
          authorized = adminSnap.exists() || (userSnap.exists() && userData?.active !== false);
          if (authorized) {
            resolvedProfile = {
              email,
              fullName: String(userData?.fullName || fbUser.displayName || email),
              roleId: (userData?.roleId as ErpRoleId) || 'salt_okunur',
              assignedProjectIds: Array.isArray(userData?.assignedProjectIds)
                ? userData.assignedProjectIds.map(String)
                : [],
              active: userData ? userData.active !== false : true,
            };
          }
        } catch {
          authorized = false;
        }
      }

      if (authorized) {
        const cloudScope = `cloud_${fbUser.uid || email}`;
        setErpLocalScope(cloudScope);
        setDataServiceLocalScope(cloudScope);
        setUser(fbUser);
        setIsSuperAdmin(superAdmin);
        setErpProfile(resolvedProfile);
        setMode('cloud-admin');
        setAuthError('');
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
        if (superAdmin) {
          await ensureCloudSeeded();
        }
      } else {
        setUser(null);
        setIsSuperAdmin(false);
        setErpProfile(null);
        setErpLocalScope('preview');
        setDataServiceLocalScope('preview');
        setMode('unauthenticated');
        setAuthError(
          `Bu hesap (${email}) yönetim paneli için yetkilendirilmemiş. Yetkili sistem yöneticisi (info@kuzeydenizinsaat.com.tr) tarafından eklenmesi gerekir veya Önizleme Modu'nu kullanabilirsiniz.`
        );
        await signOut(auth).catch(() => {});
      }
    });

    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Google giriş penceresi kapatıldı.');
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'Alan adı Firebase Auth yetkili alan adları listesinde bulunamadı. Önizleme Modu ile paneli hemen test edebilirsiniz.'
        );
      } else {
        setAuthError(err?.message || 'Giriş sırasında bir hata oluştu.');
      }
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setAuthError('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
      } else {
        setAuthError(err?.message || 'E-posta ile giriş sırasında bir hata oluştu.');
      }
    }
  };

  const enterPreviewMode = () => {
    setAuthError('');
    setErpLocalScope('preview');
    setDataServiceLocalScope('preview');
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, '1');
    setMode('preview');
  };

  const logout = async () => {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    setAuthError('');
    if (auth.currentUser) {
      await signOut(auth);
    }
    setUser(null);
    setIsSuperAdmin(false);
    setErpProfile(null);
    setErpLocalScope('preview');
    setDataServiceLocalScope('preview');
    setMode('unauthenticated');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        mode,
        authError,
        isSuperAdmin,
        erpProfile,
        loginWithGoogle,
        loginWithEmail,
        enterPreviewMode,
        logout,
        clearError: () => setAuthError(''),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
