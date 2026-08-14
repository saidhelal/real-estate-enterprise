/**
 * Design tokens, readable from JavaScript.
 *
 * `src/index.css` is the single source of truth for every design decision. This
 * module does not restate those values — it names the CSS custom properties and
 * reads them from the live document, so a colour changed in the stylesheet is
 * picked up here without a second edit. Anything that hard-codes a hex here
 * would immediately be a second source of truth and would drift.
 *
 * Use this only where CSS classes cannot reach: canvas/SVG chart libraries that
 * need a concrete colour string, and dynamically computed inline styles.
 * Everywhere else, use the Tailwind utility (`bg-primary`, `shadow-md`) so the
 * value stays in CSS.
 */

/** Colour tokens that resolve to an `H S% L%` triple in the stylesheet. */
export const COLOR_TOKENS = [
  "background",
  "foreground",
  "surface",
  "surface-sunken",
  "surface-raised",
  "border",
  "border-strong",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "accent",
  "accent-foreground",
  "success",
  "warning",
  "destructive",
  "info",
  "report",
  "neutral",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

/**
 * The categorical chart ramp, in the order series should consume it. Ordered so
 * neighbouring entries stay separable in greyscale and for the common
 * colour-vision deficiencies — ERP charts get printed and exported at least as
 * often as they are looked at on screen.
 */
export const CHART_SERIES: readonly ColorToken[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
];

/**
 * A CSS colour for `token`, usable anywhere a colour string is expected.
 *
 * Returned as `hsl(var(--token))` rather than a resolved value: the browser
 * then re-resolves it whenever the theme changes, so a chart rendered in light
 * mode recolours itself on switching to dark with no re-render. Pass `alpha`
 * for a translucent variant (fills under a line, hover bands).
 */
export function color(token: ColorToken, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(--${token}))`
    : `hsl(var(--${token}) / ${alpha})`;
}

/**
 * The nth categorical series colour, wrapping when a chart has more series than
 * the ramp has entries.
 */
export function seriesColor(index: number, alpha?: number): string {
  const token = CHART_SERIES[index % CHART_SERIES.length];
  return color(token, alpha);
}

/**
 * Resolve a token to a concrete `hsl(...)` string by reading the live computed
 * value.
 *
 * Needed only by libraries that cannot accept `var()` — canvas renderers, and
 * anything that serialises colour for PDF or image export. Because it snapshots
 * the value at call time, a consumer must re-read after a theme change.
 * Returns an empty string during SSR or before styles have applied.
 */
export function resolveColor(token: ColorToken, alpha?: number): string {
  if (typeof window === "undefined") return "";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  if (!raw) return "";
  return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

/**
 * Motion durations, in milliseconds, matching the CSS motion tokens. Exposed
 * for JS-driven animation and for timers that must outlast a CSS transition
 * (deferring an unmount until a drawer has finished closing, for instance).
 */
export const MOTION = {
  instant: 80,
  fast: 140,
  normal: 200,
  slow: 280,
} as const;

export const EASING = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  decelerate: "cubic-bezier(0, 0, 0, 1)",
  accelerate: "cubic-bezier(0.3, 0, 1, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1.1)",
} as const;

/**
 * True when the user has asked the OS to reduce motion. Check this before
 * starting any JS-driven animation; CSS transitions are already handled by the
 * media query in the stylesheet.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Shell dimensions, matching the `--layout-*` CSS tokens. Read from CSS rather
 * than duplicated as numbers so the shell and any JS that measures against it
 * cannot disagree.
 */
export const LAYOUT_TOKENS = {
  headerHeight: "var(--layout-header-height)",
  toolbarHeight: "var(--layout-toolbar-height)",
  sidebarWidth: "var(--layout-sidebar-width)",
  sidebarCollapsedWidth: "var(--layout-sidebar-collapsed-width)",
  contentMax: "var(--layout-content-max)",
} as const;

/**
 * Status → token mapping, so a status string coming from the API turns into
 * consistent styling everywhere instead of each screen inventing its own
 * colour for "overdue" or "approved".
 */
export const STATUS_TOKENS = {
  success: {
    solid: "bg-success text-success-foreground border-success-border",
    subtle: "bg-success-subtle text-success-subtle-foreground border-success-border/30",
  },
  warning: {
    solid: "bg-warning text-warning-foreground border-warning-border",
    subtle: "bg-warning-subtle text-warning-subtle-foreground border-warning-border/30",
  },
  error: {
    solid: "bg-destructive text-destructive-foreground border-destructive-border",
    subtle:
      "bg-destructive-subtle text-destructive-subtle-foreground border-destructive-border/30",
  },
  info: {
    solid: "bg-info text-info-foreground border-info-border",
    subtle: "bg-info-subtle text-info-subtle-foreground border-info-border/30",
  },
  neutral: {
    solid: "bg-neutral text-neutral-foreground border-neutral-border",
    subtle: "bg-muted text-muted-foreground border-border",
  },
} as const;

export type StatusTone = keyof typeof STATUS_TOKENS;

/**
 * Foreground-only tone, for text and icons sitting directly on the page rather
 * than in a filled chip — a KPI icon, a caution line under a field.
 *
 * Uses the `*-subtle-foreground` tokens deliberately: the solid `--warning` is
 * tuned to be read against its own fill, and putting it on the page background
 * is where "amber text on white" contrast failures come from.
 */
export const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-success-subtle-foreground",
  warning: "text-warning-subtle-foreground",
  error: "text-destructive-subtle-foreground",
  info: "text-info-subtle-foreground",
  neutral: "text-muted-foreground",
};

/**
 * Categorical accents for things that need to be *told apart* rather than
 * judged — module tiles on the launcher, entity-type chips, legend keys.
 *
 * Reuses the chart ramp because it was already ordered to stay separable in
 * greyscale and for colour-vision deficiencies; a second decorative palette
 * would be a second source of truth and would not have that property.
 *
 * Written out as whole class strings, never assembled from a template: Tailwind
 * scans source text for literal class names, so `text-chart-${n}` would compile
 * to nothing and the element would render unstyled.
 */
export const ACCENT_CLASSES: readonly string[] = [
  "text-chart-1 bg-chart-1/10",
  "text-chart-2 bg-chart-2/10",
  "text-chart-3 bg-chart-3/10",
  "text-chart-4 bg-chart-4/10",
  "text-chart-5 bg-chart-5/10",
  "text-chart-6 bg-chart-6/10",
  "text-chart-7 bg-chart-7/10",
  "text-chart-8 bg-chart-8/10",
];

/**
 * The icon tile on a tinted card: one step stronger than the body, with the
 * glyph drawn in the hue itself.
 *
 * Not a white glyph on a saturated fill. White survives on the blues and
 * violets but collapses on the amber and lime end of the ramp, and a rule that
 * only works for some of its inputs is not a rule. Hue-on-hue holds for every
 * entry, and it is also the layering the reference identity uses on its tinted
 * cards — body, then a stronger icon tile, with the solid fill reserved for the
 * accent bar.
 */
export const ACCENT_CHIP_CLASSES: readonly string[] = [
  "bg-chart-1/20 text-chart-1",
  "bg-chart-2/20 text-chart-2",
  "bg-chart-3/20 text-chart-3",
  "bg-chart-4/20 text-chart-4",
  "bg-chart-5/20 text-chart-5",
  "bg-chart-6/20 text-chart-6",
  "bg-chart-7/20 text-chart-7",
  "bg-chart-8/20 text-chart-8",
];

/**
 * The card body itself, tinted in the owner's colour, plus a border from the
 * same family.
 *
 * This is the layering the reference identity describes: a soft-but-visible
 * surface for the body, a stronger border, then the solid accent for the bar
 * and the icon chip. A white card with only a coloured icon carries the
 * identity on 4% of its area and reads as generic; tinting the body is what
 * makes a module recognisable from across the screen.
 *
 * Alpha rather than a per-hue ramp because the palette exposes one value per
 * series, not ten. `/10` composites over `--background` in light mode and over
 * the dark canvas in dark mode, so a single class is correct in both themes and
 * the tint stays far enough from the text to keep contrast untouched — the
 * title still runs at `--foreground` against a near-canvas surface.
 */
export const ACCENT_SURFACE_CLASSES: readonly string[] = [
  "bg-chart-1/10 border-chart-1/30",
  "bg-chart-2/10 border-chart-2/30",
  "bg-chart-3/10 border-chart-3/30",
  "bg-chart-4/10 border-chart-4/30",
  "bg-chart-5/10 border-chart-5/30",
  "bg-chart-6/10 border-chart-6/30",
  "bg-chart-7/10 border-chart-7/30",
  "bg-chart-8/10 border-chart-8/30",
];

/** Border tint used on hover, one step stronger than the resting border. */
export const ACCENT_HOVER_BORDER_CLASSES: readonly string[] = [
  "hover:border-chart-1/60",
  "hover:border-chart-2/60",
  "hover:border-chart-3/60",
  "hover:border-chart-4/60",
  "hover:border-chart-5/60",
  "hover:border-chart-6/60",
  "hover:border-chart-7/60",
  "hover:border-chart-8/60",
];

/** Fill for the slim inline-start bar that marks a card's owner. */
export const ACCENT_BAR_CLASSES: readonly string[] = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
];

/**
 * The nth categorical accent, wrapping past the end of the ramp. Repeats are
 * acceptable where colour is secondary to an icon or a label; where it is the
 * only differentiator, keep the set under `ACCENT_CLASSES.length`.
 *
 * No `dark:` variant is needed — the underlying token already changes with the
 * theme, so one class works in both.
 */
export function accentClass(index: number): string {
  return ACCENT_CLASSES[index % ACCENT_CLASSES.length];
}

/** Icon tile for the nth accent. */
export function accentChipClass(index: number): string {
  return ACCENT_CHIP_CLASSES[index % ACCENT_CHIP_CLASSES.length];
}

/** Accent bar fill for the nth accent. */
export function accentBarClass(index: number): string {
  return ACCENT_BAR_CLASSES[index % ACCENT_BAR_CLASSES.length];
}

/** Tinted body surface + matching border for the nth accent. */
export function accentSurfaceClass(index: number): string {
  const n = ACCENT_SURFACE_CLASSES.length;
  return `${ACCENT_SURFACE_CLASSES[index % n]} ${ACCENT_HOVER_BORDER_CLASSES[index % n]}`;
}
