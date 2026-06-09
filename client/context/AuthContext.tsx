import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/api";
import { getToken, loginRequest, meRequest, setToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  authReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setAuthReady(true);
      return;
    }
    meRequest()
      .then(({ user: u }) => setUser(u))
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setAuthReady(true));
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const { token, user: u } = await loginRequest(username, password);
      setToken(token);
      setUser(u);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    [queryClient]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        authReady,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
