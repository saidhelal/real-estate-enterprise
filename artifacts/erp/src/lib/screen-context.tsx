import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * What the user is looking at right now.
 *
 * The global header actions — issue a directive, print — have to act on
 * something, and the only component that knows what that something is, is the
 * screen itself. So a screen declares it once and the header reads it. The
 * alternative, a header that inspects the URL and maps paths to entity types,
 * would be a second routing table that silently rots the first time a route
 * changes.
 *
 * Declaring is optional. A screen with nothing printable simply says nothing,
 * and the header degrades to the general actions — no screen is required to
 * know that the header exists.
 */

export interface ScreenContext {
  /** Matches the print system's `moduleKey`, so templates can be filtered. */
  moduleKey?: string;
  /** Matches a template's `documentType` — contract, receipt, letter, … */
  documentType?: string;
  /** The record on screen, passed to the renderer as `entityId`. */
  entityId?: string;
  /** Human-readable, for the directive subject and the print menu heading. */
  label?: string;
  /** Shown on the print menu when a specific document number applies. */
  documentNumber?: string;
}

const Ctx = createContext<{
  context: ScreenContext;
  setContext: (c: ScreenContext) => void;
}>({ context: {}, setContext: () => {} });

export function ScreenContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<ScreenContext>({});
  const value = useMemo(() => ({ context, setContext }), [context]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the current context. Used by the header actions. */
export function useScreenContext(): ScreenContext {
  return useContext(Ctx).context;
}

/**
 * Declare what this screen is showing.
 *
 * Clears itself on unmount, so navigating away can never leave the header
 * offering to print a record the user has left. The dependency list is the
 * primitive fields rather than the object, because a caller building the
 * object inline would otherwise re-register on every render.
 */
export function useDeclareScreenContext(next: ScreenContext): void {
  const { setContext } = useContext(Ctx);
  const { moduleKey, documentType, entityId, label, documentNumber } = next;
  useEffect(() => {
    setContext({ moduleKey, documentType, entityId, label, documentNumber });
    return () => setContext({});
  }, [setContext, moduleKey, documentType, entityId, label, documentNumber]);
}
