import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

/**
 * The upload target for a signed handle.
 *
 * The browser uploads with a bare `fetch(url, { method: "PUT", body: file })`
 * and sends no authorisation header — that is what a signed URL is for, and it
 * is how this worked when the bytes went to cloud storage. So the permission
 * to write travels in the URL: the handle names one object, expires, and is
 * HMAC-signed with the session secret. Editing it to point at another object,
 * or replaying it after it lapses, fails the check.
 *
 * Mounted before the auth gate for that reason. It is not an unguarded
 * endpoint: without a valid handle it does nothing, and a handle is only ever
 * issued to an authenticated caller by `getObjectEntityUploadURL`.
 *
 * The route reads the request stream straight to disk rather than buffering,
 * so a large attachment does not have to fit in memory.
 */

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.put("/object-upload/:token", async (req: Request, res: Response): Promise<void> => {
  const object = storage.objectForUploadToken(String(req.params.token));
  if (!object) {
    // One answer for forged, tampered and expired: telling them apart would
    // let a caller probe which object ids exist.
    res.status(403).json({ error: "This upload link is not valid or has expired." });
    return;
  }

  try {
    const contentType = req.headers["content-type"];
    await object.write(req, typeof contentType === "string" ? contentType : undefined);
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "object upload failed");
    res.status(500).json({ error: "Could not store the uploaded file." });
  }
});

export default router;
