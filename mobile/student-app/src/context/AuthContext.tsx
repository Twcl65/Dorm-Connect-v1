import * as SecureStore from "expo-secure-store";
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
  ApiError,
  apiRequest,
  type MeResponse,
  type MobileLoginResponse,
} from "@/lib/api";
import { isMobileAppRole } from "@/lib/auth-routes";

const TOKEN_KEY = "dc_mobile_token";

export type AuthUser = MobileLoginResponse["user"];

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!stored) {
      setUser(null);
      setToken(null);
      return;
    }
    const me = await apiRequest<MeResponse>("/api/auth/me", { token: stored });
    if (!me.user || !isMobileAppRole(me.user.role)) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setUser(null);
      setToken(null);
      return;
    }
    setToken(stored);
    setUser(me.user);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshUser();
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiRequest<MobileLoginResponse>(
      "/api/auth/mobile/login",
      {
        method: "POST",
        body: { email, password },
      }
    );
    if (!res.accessToken) {
      throw new ApiError("Server did not return a session token.", 500);
    }
    if (!isMobileAppRole(res.user.role)) {
      throw new ApiError(
        "This account type cannot use the mobile app. Students and landlords only.",
        403
      );
    }
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, res.accessToken);
    } catch (e) {
      if (__DEV__) console.warn("[auth] SecureStore failed", e);
      throw new Error(
        "Could not save your session securely. Restart Expo Go and try again."
      );
    }
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, signIn, signOut, refreshUser }),
    [user, token, loading, signIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
