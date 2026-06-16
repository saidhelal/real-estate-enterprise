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
      retry: false,
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
