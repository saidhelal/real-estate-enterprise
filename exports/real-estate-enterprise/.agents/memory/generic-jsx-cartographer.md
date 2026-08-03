---
name: Generic JSX breaks dev babel plugin
description: Why <Component<T>> generic JSX type args parse in tsc but 500 in the Vite dev server here.
---

Generic JSX syntax like `<ResourceManager<Project> ...>` (explicit type argument on a
JSX component) typechecks fine with `tsc` but the Vite React dev plugin
(replit-cartographer, which injects `data-component-name`) cannot parse it and throws a
babel "Unexpected token" error → the page 500s in the browser.

**Why:** the cartographer transform inserts attributes right after the component name,
producing invalid `<ResourceManager data-component-name="..."<Project>`. tsc never sees
that transform, so a full `pnpm run typecheck` passes while the dev preview is broken.

**How to apply:** never use explicit generic type args in JSX. Drop the `<T>` and let the
generic be inferred from a typed prop (e.g. `columns: ResourceColumn<T>[]`). The error
only surfaces when the page is actually imported/built, so a page can sit broken until it
is first routed. If a page 500s with a babel parse error but typecheck is green, suspect
generic JSX (or other TS-only syntax the babel transform mishandles).
