import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/lib/auth-provider";

type OwnerModeState = {
  /** Whether the current session is currently in elevated Owner Mode. */
  active: boolean;
  /** A control action (verify/exit/status) is in flight. */
  busy: boolean;
  /** Re-authenticate with owner-tier credentials. Returns null on success or an error message. */
  verify: (username: string, password: string) => Promise<string | null>;
  /** Leave Owner Mode immediately. */
  exit: () => Promise<void>;
};

const OwnerModeContext = createContext<OwnerModeState | undefined>(undefined);

// Mirror of the server's OWNER_TTL_SECONDS: the inactivity window after which
// Owner Mode auto-disables and re-authentication is required.
const INACTIVITY_MS = 15 * 60 * 1000;

export function OwnerModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = user?.id ?? null;

  // Re-sync from the server whenever the authenticated identity changes.
  useEffect(() => {
    if (!userId) {
      setActive(false);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/owner-mode", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setActive(data.active === true);
      })
      .catch(() => {
        /* transient — stays inactive */
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const exit = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/owner-mode/exit", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setActive(false);
      setBusy(false);
    }
  }, []);

  // Inactivity auto-exit: while active, any user interaction resets a 15-minute
  // timer; if it elapses, Owner Mode is dropped and re-auth is required.
  useEffect(() => {
    if (!active) return;
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    const arm = () => {
      clear();
      timerRef.current = setTimeout(() => {
        void exit();
      }, INACTIVITY_MS);
    };
    const events: Array<keyof DocumentEventMap> = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clear();
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [active, exit]);

  const verify = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      setBusy(true);
      try {
        const res = await fetch("/api/auth/owner-mode/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          return data?.error ?? "Owner verification failed.";
        }
        setActive(true);
        return null;
      } catch {
        return "Network error during owner verification.";
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return (
    <OwnerModeContext.Provider value={{ active, busy, verify, exit }}>
      {children}
    </OwnerModeContext.Provider>
  );
}

export function useOwnerMode(): OwnerModeState {
  const ctx = useContext(OwnerModeContext);
  if (ctx === undefined) {
    throw new Error("useOwnerMode must be used within an OwnerModeProvider");
  }
  return ctx;
}
