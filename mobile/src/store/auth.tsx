import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

export type Profile = {
  name: string | null;
  mobile: string | null;
  address: string | null;
  businessName: string | null;
};
export type User = {
  id: string;
  email: string;
  emailVerified: boolean;
  profileComplete: boolean;
  profile: Profile;
};

type AuthState = {
  loading: boolean;
  token: string | null;
  user: User | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const TOKEN_KEY = "padosipro.token";
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!token) return;
    try {
      const { user: fresh } = await api<{ user: User }>("/api/profile/me", { token });
      setUser(fresh);
    } catch {
      await signOut();
    }
  };

  const signIn = async (newToken: string, newUser: User) => {
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TOKEN_KEY);
        if (saved) {
          setToken(saved);
          try {
            const { user: fresh } = await api<{ user: User }>("/api/profile/me", {
              token: saved,
            });
            setUser(fresh);
          } catch {
            await AsyncStorage.removeItem(TOKEN_KEY);
            setToken(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, token, user, signIn, signOut, refresh, setUser }),
    [loading, token, user]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
