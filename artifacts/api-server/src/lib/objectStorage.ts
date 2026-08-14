import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, join, resolve, sep } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

/**
 * Object storage, on the local filesystem.
 *
 * This used to reach a Replit sidecar on `127.0.0.1:1106` for Google Cloud
 * credentials, which made the archive unusable anywhere but Replit — the one
 * runtime dependency left after the move to local development. Nothing else in
 * the system knew that: the sidecar only answered when a file was actually
 * read or written, so the failure appeared as a broken upload rather than as a
 * missing platform.
 *
 * The class keeps the shape it had. Every route that stores or serves a file
 * calls the same methods with the same arguments and gets the same things
 * back, so replacing the provider changed no route, no permission check and no
 * database column — the storage boundary was already in the right place.
 *
 * There is one provider. Modules do not touch the filesystem themselves; they
 * ask this service, which is the only thing here that knows a file is a file.
 */

/** Where objects live. Outside the source tree, so uploads are never committed. */
function storageRoot(): string {
  const configured = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (configured) return resolve(configured);
  // A default that works with no configuration at all, next to the repo rather
  // than inside it. `.local-storage` is gitignored.
  return resolve(process.cwd(), "..", "..", ".local-storage");
}

/**
 * Refuse a path that climbs out of the storage root.
 *
 * Object ids come from the request in `/objects/:id`, so `../../etc/passwd` is
 * a thing a caller can send. Resolving first and comparing prefixes is what
 * makes the id a name inside the store rather than a path on the disk.
 */
function safeJoin(root: string, relative: string): string {
  const full = resolve(join(root, relative));
  const bounded = full === root || full.startsWith(root + sep);
  if (!bounded) throw new ObjectNotFoundError();
  return full;
}

/** Metadata is a sidecar file: content type, size and the ACL policy. */
interface StoredMeta {
  contentType?: string;
  metadata?: Record<string, string>;
}

const metaPathFor = (filePath: string): string => `${filePath}.meta.json`;

async function readMeta(filePath: string): Promise<StoredMeta> {
  try {
    return JSON.parse(await readFile(metaPathFor(filePath), "utf8")) as StoredMeta;
  } catch {
    return {};
  }
}

/**
 * One stored object.
 *
 * Deliberately the same small surface the cloud client exposed — `name`,
 * `exists`, `download`, `getMetadata`, `setMetadata`, `createReadStream`,
 * each returning what the callers already destructure. That is why the ACL
 * module and every route work against it untouched.
 */
export class StoredObject {
  constructor(
    /** Path inside the store, e.g. `uploads/<uuid>`. */
    readonly name: string,
    private readonly fullPath: string,
  ) {}

  async exists(): Promise<[boolean]> {
    try {
      const s = await stat(this.fullPath);
      return [s.isFile()];
    } catch {
      return [false];
    }
  }

  async download(): Promise<[Buffer]> {
    try {
      return [await readFile(this.fullPath)];
    } catch {
      throw new ObjectNotFoundError();
    }
  }

  async getMetadata(): Promise<[{ contentType?: string; size?: number; metadata?: Record<string, string> }]> {
    const meta = await readMeta(this.fullPath);
    let size: number | undefined;
    try {
      size = (await stat(this.fullPath)).size;
    } catch {
      throw new ObjectNotFoundError();
    }
    return [{ contentType: meta.contentType, size, metadata: meta.metadata }];
  }

  /** Merges, so setting the ACL never drops the content type. */
  async setMetadata(update: { metadata?: Record<string, string>; contentType?: string }): Promise<void> {
    const current = await readMeta(this.fullPath);
    const next: StoredMeta = {
      contentType: update.contentType ?? current.contentType,
      metadata: { ...(current.metadata ?? {}), ...(update.metadata ?? {}) },
    };
    await writeFile(metaPathFor(this.fullPath), JSON.stringify(next), "utf8");
  }

  createReadStream(): NodeJS.ReadableStream {
    return createReadStream(this.fullPath);
  }

  /** Write the object's bytes, creating parent directories as needed. */
  async write(body: Readable | Buffer, contentType?: string): Promise<void> {
    await mkdir(dirname(this.fullPath), { recursive: true });
    if (Buffer.isBuffer(body)) await writeFile(this.fullPath, body);
    else await pipeline(body, createWriteStream(this.fullPath));
    await this.setMetadata({ contentType });
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/* -------------------------------------------------------------------------- */
/* Upload handles                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A short-lived, signed handle standing in for a cloud signed URL.
 *
 * The browser uploads with a bare `fetch(url, { method: "PUT", body: file })`
 * and sends no authorisation header, so the permission to write has to travel
 * in the URL — exactly what a signed URL is. The handle names one object id,
 * expires, and is signed with the session secret, so it cannot be edited to
 * point at another object or replayed after it lapses.
 */
const UPLOAD_TTL_MS = 15 * 60 * 1000;

function signingKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to sign upload handles.");
  return secret;
}

export function createUploadToken(objectId: string, ttlMs = UPLOAD_TTL_MS): string {
  const expires = Date.now() + ttlMs;
  const payload = `${objectId}.${expires}`;
  const sig = createHmac("sha256", signingKey()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** The object id a handle authorises, or null when it is forged or expired. */
export function verifyUploadToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [objectId, expiresRaw, sig] = parts;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  const expected = createHmac("sha256", signingKey())
    .update(`${objectId}.${expiresRaw}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  // Constant-time: a length-varying compare leaks the signature a byte at a time.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return objectId;
}

/* -------------------------------------------------------------------------- */
/* The service                                                                */
/* -------------------------------------------------------------------------- */

export class ObjectStorageService {
  constructor() {}

  /**
   * Directories searched for public assets, relative to the store.
   *
   * Optional now. It named cloud buckets before and threw when unset, which
   * meant a local run could not serve a public asset at all; an empty list
   * simply means "no public search paths configured".
   */
  getPublicObjectSearchPaths(): Array<string> {
    const raw = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    return Array.from(
      new Set(raw.split(",").map((p) => p.trim()).filter((p) => p.length > 0)),
    );
  }

  getPrivateObjectDir(): string {
    return storageRoot();
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const relative = `${searchPath}/${filePath}`.replace(/^\/+/, "");
      const object = new StoredObject(relative, safeJoin(storageRoot(), relative));
      const [exists] = await object.exists();
      if (exists) return object;
    }
    return null;
  }

  /** Stream an object back with its content type and cache policy. */
  async downloadObject(file: StoredObject, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const webStream = Readable.toWeb(
      file.createReadStream() as Readable,
    ) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size !== undefined) headers["Content-Length"] = String(metadata.size);

    return new Response(webStream, { headers });
  }

  /**
   * Where to PUT a new object.
   *
   * Returns a same-origin path rather than an absolute URL: the browser is
   * already talking to this API, and an absolute one would have to guess the
   * host — which is what tied the old implementation to a platform.
   */
  async getObjectEntityUploadURL(): Promise<string> {
    // The handle carries the bare id, never a path. A slash in it would end the
    // `:token` route parameter early and the upload would 404 — and it would
    // also let a handle name a directory rather than one object.
    return `/api/object-upload/${createUploadToken(randomUUID())}`;
  }

  /** Resolve `/objects/<id>` to a stored object, or refuse. */
  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) throw new ObjectNotFoundError();

    const object = new StoredObject(entityId, safeJoin(storageRoot(), entityId));
    const [exists] = await object.exists();
    if (!exists) throw new ObjectNotFoundError();
    return object;
  }

  /** The object an upload handle points at, whether or not it exists yet. */
  objectForUploadToken(token: string): StoredObject | null {
    const objectId = verifyUploadToken(token);
    if (!objectId) return null;
    const relative = `uploads/${objectId}`;
    return new StoredObject(relative, safeJoin(storageRoot(), relative));
  }

  /**
   * Turn an upload URL into the `/objects/<id>` path stored on the record.
   *
   * Callers hand this whatever the upload step returned. It also still accepts
   * the old `https://storage.googleapis.com/...` form so paths written before
   * this change keep resolving — historical rows are not rewritten.
   */
  normalizeObjectEntityPath(rawPath: string): string {
    const handle = rawPath.startsWith("/api/object-upload/")
      ? rawPath.slice("/api/object-upload/".length)
      : null;
    if (handle) {
      const objectId = verifyUploadToken(handle);
      // Same `uploads/` prefix the upload route writes under, so the stored
      // path and the served path describe the same file.
      if (objectId) return `/objects/uploads/${objectId}`;
    }

    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      const url = new URL(rawPath);
      const parts = url.pathname.replace(/^\/+/, "").split("/");
      // bucket/<path...> — drop the bucket, keep the object path.
      return `/objects/${parts.slice(1).join("/")}`;
    }

    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) return normalizedPath;

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StoredObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
