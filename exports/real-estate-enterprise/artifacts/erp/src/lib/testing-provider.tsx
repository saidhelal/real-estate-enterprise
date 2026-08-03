import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";

type TestingState = {
  /** Whether the session is currently routed to the isolated demo database. */
  testing: boolean;
  /** Whether the current user (super admin) may use Testing Mode controls. */
  canTest: boolean;
  /** A control action is in flight (enter/exit/reset). */
  busy: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  reset: () => Promise<void>;
};

const TestingContext = createContext<TestingState | undefined>(undefined);

async function postTesting(action: "enter" | "exit" | "reset"): Promise<void> {
  const res = await fetch(`/api/testing/${action}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`testing/${action} failed: ${res.status}`);
}

export function TestingProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [canTest, setCanTest] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-sync from the server whenever the authenticated identity changes. The app
  // often mounts unauthenticated and the user logs in afterwards, so a mount-only
  // fetch would leave the banner/controls stale until a hard reload. Keying the
  // effect on the user id refetches right after login and resets on logout.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setTesting(false);
      setCanTest(false);
      return;
    }
    let cancelled = false;
    fetch("/api/testing/status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setTesting(data.testing === true);
        setCanTest(data.canTest === true);
      })
      .catch(() => {
        /* network/transient — banner simply stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // After switching the connected database (enter/exit) or resetting it, every
  // cached query now points at the wrong/old data — invalidate them all so the
  // whole app refetches from the now-active schema.
  const refetchEverything = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const enter = useCallback(async () => {
    setBusy(true);
    try {
      await postTesting("enter");
      setTesting(true);
      refetchEverything();
    } finally {
      setBusy(false);
    }
  }, [refetchEverything]);

  const exit = useCallback(async () => {
    setBusy(true);
    try {
      await postTesting("exit");
      setTesting(false);
      refetchEverything();
    } finally {
      setBusy(false);
    }
  }, [refetchEverything]);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await postTesting("reset");
      refetchEverything();
    } finally {
      setBusy(false);
    }
  }, [refetchEverything]);

  return (
    <TestingContext.Provider value={{ testing, canTest, busy, enter, exit, reset }}>
      {children}
    </TestingContext.Provider>
  );
}

export function useTesting(): TestingState {
  const ctx = useContext(TestingContext);
  if (ctx === undefined) {
    throw new Error("useTesting must be used within a TestingProvider");
  }
  return ctx;
}
