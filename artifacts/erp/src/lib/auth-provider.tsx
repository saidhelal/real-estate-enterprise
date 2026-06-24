import React, { createContext, useContext, useEffect, useState } from "react";
import {
  useGetCurrentUser,
  useLogout,
  getGetCurrentUserQueryKey,
  CurrentUser,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

type AuthState = {
  user: CurrentUser | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      // The very first request the app makes on load is this current-user
      // check. On a cold/parallel startup (e.g. pressing Run, which boots the
      // web and API services at the same time) the API may not be listening
      // yet, so this call can fail with a network error or a 5xx before the
      // API finishes coming up. A genuine 401 is authoritative ("not logged
      // in") and must fall through to /login immediately; any other failure
      // means "API not ready yet" and should be retried so a still-valid
      // session is restored automatically once the API is up — without the
      // user being kicked to /login and forced to sign in again.
      retry: (failureCount, err) => {
        if (failureCount >= 6) return false;
        const status = (err as { status?: number } | null)?.status;
        if (status === 401) return false;
        return true;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      queryKey: getGetCurrentUserQueryKey(),
    },
  });

  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoading && error && location !== "/login") {
      setLocation("/login");
    }
  }, [isLoading, error, location, setLocation]);

  // Force a password change before anything else when the account is flagged
  // (admin reset or first login). The change-password page clears the flag
  // server-side, after which the current-user query refetches and releases.
  useEffect(() => {
    if (!isLoading && user?.mustChangePassword && location !== "/change-password") {
      setLocation("/change-password");
    }
  }, [isLoading, user, location, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: async () => {
        await queryClient.resetQueries({ queryKey: getGetCurrentUserQueryKey() });
        queryClient.clear();
        setLocation("/login");
      },
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
