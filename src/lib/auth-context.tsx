"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  getClientAuth,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { ensureUserSeeded } from "@/lib/firebase/data";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;

    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, async (next) => {
      if (next) {
        try {
          await ensureUserSeeded(next.uid);
        } catch (err) {
          console.error("Failed to seed user", err);
        }
      }
      setUser(next);
      setLoading(false);
    });
    return unsub;
  }, [configured]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getClientAuth(), email, password);
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(getClientAuth(), email, password);
  }, []);

  const signInGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getClientAuth(), provider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getClientAuth());
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signOut,
    }),
    [
      user,
      loading,
      configured,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
