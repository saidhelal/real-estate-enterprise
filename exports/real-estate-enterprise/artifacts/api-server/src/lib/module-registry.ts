import type { IRouter } from "express";
import { logger } from "./logger";

/**
 * Isolated module loading. Each feature router is mounted through `mountModule`,
 * which wraps the mount in a try/catch and records the outcome. A failure
 * mounting one module is logged and tracked but does NOT prevent the remaining
 * modules from mounting, so a single broken module cannot take down the whole
 * API surface. The recorded statuses feed the readiness probe, which lets us
 * validate module independence at runtime.
 */

export interface ModuleStatus {
  name: string;
  mounted: boolean;
  error?: string;
}

const moduleStatuses: ModuleStatus[] = [];

export function mountModule(
  router: IRouter,
  name: string,
  mod: IRouter,
): void {
  try {
    router.use(mod);
    moduleStatuses.push({ name, mounted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    moduleStatuses.push({ name, mounted: false, error: message });
    logger.error({ module: name, err }, `Failed to mount module: ${name}`);
  }
}

export function getModuleStatuses(): ModuleStatus[] {
  return moduleStatuses;
}

export function getModuleSummary(): {
  total: number;
  mounted: number;
  failed: number;
} {
  const total = moduleStatuses.length;
  const mounted = moduleStatuses.filter((m) => m.mounted).length;
  return { total, mounted, failed: total - mounted };
}
