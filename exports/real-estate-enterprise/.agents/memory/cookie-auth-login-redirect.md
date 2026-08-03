---
name: Cookie-auth login redirect
description: Why login can succeed (200) yet the app stays on /login, and how to fix it.
---

After a cookie-based-JWT login, the login page MUST invalidate (or refetch) the
current-user query before navigating, or the app bounces back to the login screen.

**Why:** The auth guard derives its state from a `useGetCurrentUser` query. While
logged out that query resolved to a 401 error and is cached. A successful login
only sets cookies server-side — it does not change that cached query — so the
guard still sees `user = null` and redirects to `/login` even though the API
returned 200. Symptom: POST /api/auth/login → 200, then the page never leaves
/login.

**How to apply:** In the login mutation's `onSuccess`, call
`queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })` and
`await` it before `setLocation("/")`. The same applies to logout: invalidate/
reset the current-user query so the guard re-evaluates. Generated query-key
helpers come from `@workspace/api-client-react`.
