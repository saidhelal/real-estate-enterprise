import { createRoot } from "react-dom/client";
import { setTokenRefresher } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Keep the user signed in across access-token expiry: when any API call returns
// 401, customFetch calls this refresher once and replays the request. Only a
// genuinely expired/revoked refresh token (or an explicit logout) ends the
// session. Same-origin cookies carry the refresh token automatically.
setTokenRefresher(async () => {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
