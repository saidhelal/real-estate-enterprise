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
      retry: false,
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
