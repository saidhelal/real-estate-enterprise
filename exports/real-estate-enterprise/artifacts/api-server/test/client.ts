/**
 * Minimal cookie-aware HTTP client for the e2e suite. Node's global `fetch`
 * does not persist cookies, so we capture Set-Cookie headers and replay them —
 * exactly what the browser does for the cookie-based auth + testing-mode flow.
 */
export class ApiClient {
  private cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private storeCookies(res: Response): void {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      // A cleared cookie comes back empty; drop it from the jar.
      if (value === "" || value === "deleted") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  hasCookie(name: string): boolean {
    return this.cookies.has(name);
  }

  async request(
    method: string,
    pathname: string,
    body?: unknown,
  ): Promise<{ status: number; json: any }> {
    const headers: Record<string, string> = {};
    const cookie = this.cookieHeader();
    if (cookie) headers["cookie"] = cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${this.baseUrl}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(res);
    const text = await res.text();
    let json: any = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    return { status: res.status, json };
  }

  get(pathname: string) {
    return this.request("GET", pathname);
  }
  post(pathname: string, body?: unknown) {
    return this.request("POST", pathname, body);
  }
  patch(pathname: string, body?: unknown) {
    return this.request("PATCH", pathname, body);
  }
}
