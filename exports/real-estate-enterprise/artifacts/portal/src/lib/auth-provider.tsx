import React, { createContext, useContext, useEffect } from "react";
import {
  useGetPortalMe,
  usePortalLogout,
  getGetPortalMeQueryKey,
  PortalCurrentUser,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

type AuthState = {
  user: PortalCurrentUser | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetPortalMe({
    query: {
      // On a cold/parallel startup (pressing Run boots the web and API
      // services at the same time) the API may not be listening yet, so this
      // first current-user check can fail with a network error or a 5xx before
      // the API finishes coming up. A genuine 401 is authoritative ("not logged
      // in") and must fall through to /login immediately; any other failure
      // means "API not ready yet" and should be retried so a still-valid
      // session is restored automatically once the API is up.
      retry: (failureCount, err) => {
        if (failureCount >= 6) return false;
        const status = (err as { status?: number } | null)?.status;
        if (status === 401) return false;
        return true;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      queryKey: getGetPortalMeQueryKey(),
    },
  });

  const logoutMutation = usePortalLogout();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoading && error && !location.startsWith("/login") && !location.startsWith("/forgot-password")) {
      setLocation("/login");
    }
  }, [isLoading, error, location, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: async () => {
        await queryClient.resetQueries({ queryKey: getGetPortalMeQueryKey() });
        queryClient.clear();
        setLocation("/login");
      },
      onError: async () => {
        await queryClient.resetQueries({ queryKey: getGetPortalMeQueryKey() });
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
