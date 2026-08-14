import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";

/**
 * Local object storage.
 *
 * Storage used to reach a Replit sidecar on `127.0.0.1:1106` for cloud
 * credentials, so uploads and downloads only worked on one hosting platform.
 * These exercise the replacement against a real temporary directory — actual
 * files, actual bytes — because the failure this replaces was precisely one
 * that unit-level mocking would have hidden: the code was correct, the
 * platform underneath it was gone.
 *
 * The service is imported after `PRIVATE_OBJECT_DIR` is set, since the module
 * reads it when resolving the storage root.
 */

let root: string;
let storage: import("../src/lib/objectStorage").ObjectStorageService;
let lib: typeof import("../src/lib/objectStorage");

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "erp-storage-test-"));
  process.env.PRIVATE_OBJECT_DIR = root;
  process.env.SESSION_SECRET ||= "test-secret-for-upload-handles";
  lib = await import("../src/lib/objectStorage");
  storage = new lib.ObjectStorageService();
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Walk the flow a browser walks: ask for a handle, PUT through it. */
async function upload(content: string, contentType = "text/plain") {
  const url = await storage.getObjectEntityUploadURL();
  const token = url.slice("/api/object-upload/".length);
  const object = storage.objectForUploadToken(token);
  expect(object, "a fresh handle must resolve").not.toBeNull();
  await object!.write(Readable.from([content]), contentType);
  return { url, token, objectPath: storage.normalizeObjectEntityPath(url) };
}

describe("upload", () => {
  it("issues a local handle, never a sidecar or cloud URL", async () => {
    const url = await storage.getObjectEntityUploadURL();
    expect(url.startsWith("/api/object-upload/")).toBe(true);
    expect(url).not.toMatch(/1106|replit|storage\.googleapis/i);
  });

  it("writes the bytes to disk", async () => {
    const { objectPath } = await upload("hello storage");
    const file = await storage.getObjectEntityFile(objectPath);
    const [buf] = await file.download();
    expect(buf.toString()).toBe("hello storage");
  });

  it("gives every upload its own object", async () => {
    const a = await upload("first");
    const b = await upload("second");
    expect(a.objectPath).not.toBe(b.objectPath);
  });
});

describe("download", () => {
  it("returns the stored bytes with the stored content type", async () => {
    const { objectPath } = await upload("downloadable", "text/csv");
    const file = await storage.getObjectEntityFile(objectPath);
    const res = await storage.downloadObject(file);
    expect(res.headers.get("content-type")).toBe("text/csv");
    expect(await res.text()).toBe("downloadable");
  });

  it("reports the size", async () => {
    const { objectPath } = await upload("12345");
    const file = await storage.getObjectEntityFile(objectPath);
    const [meta] = await file.getMetadata();
    expect(meta.size).toBe(5);
  });
});

describe("metadata", () => {
  it("keeps the content type when the ACL is written", async () => {
    const { objectPath } = await upload("acl subject", "application/pdf");
    const file = await storage.getObjectEntityFile(objectPath);
    await file.setMetadata({ metadata: { "custom:aclPolicy": '{"visibility":"public"}' } });
    const [meta] = await file.getMetadata();
    expect(meta.contentType).toBe("application/pdf");
    expect(meta.metadata?.["custom:aclPolicy"]).toContain("public");
  });

  it("marks a public object as publicly cacheable", async () => {
    const { objectPath } = await upload("public thing");
    const file = await storage.getObjectEntityFile(objectPath);
    await file.setMetadata({ metadata: { "custom:aclPolicy": '{"visibility":"public"}' } });
    const res = await storage.downloadObject(file);
    expect(res.headers.get("cache-control")).toContain("public");
  });
});

describe("missing and malformed", () => {
  it("refuses an object that does not exist", async () => {
    await expect(storage.getObjectEntityFile("/objects/uploads/nope")).rejects.toBeInstanceOf(
      lib.ObjectNotFoundError,
    );
  });

  it("refuses a path outside /objects/", async () => {
    await expect(storage.getObjectEntityFile("/etc/passwd")).rejects.toBeInstanceOf(
      lib.ObjectNotFoundError,
    );
  });

  it("refuses a path that climbs out of the store", async () => {
    // The id arrives from the URL, so `../` is something a caller can send.
    await expect(
      storage.getObjectEntityFile("/objects/../../../../etc/passwd"),
    ).rejects.toBeInstanceOf(lib.ObjectNotFoundError);
  });
});

describe("upload handles", () => {
  it("rejects a forged signature", () => {
    expect(lib.verifyUploadToken("someid.9999999999999.deadbeef")).toBeNull();
  });

  it("rejects a handle edited to name another object", async () => {
    const url = await storage.getObjectEntityUploadURL();
    const token = url.slice("/api/object-upload/".length);
    const [, expires, sig] = token.split(".");
    expect(lib.verifyUploadToken(`other-object.${expires}.${sig}`)).toBeNull();
  });

  it("rejects an expired handle", () => {
    const expired = lib.createUploadToken("obj", -1000);
    expect(lib.verifyUploadToken(expired)).toBeNull();
  });

  it("accepts its own valid handle", () => {
    const token = lib.createUploadToken("obj-123");
    expect(lib.verifyUploadToken(token)).toBe("obj-123");
  });
});

describe("persistence", () => {
  it("survives a new service instance, as it would a restart", async () => {
    const { objectPath } = await upload("still here after restart");
    // A fresh instance shares no memory with the one that wrote the file.
    const fresh = new lib.ObjectStorageService();
    const file = await fresh.getObjectEntityFile(objectPath);
    const [buf] = await file.download();
    expect(buf.toString()).toBe("still here after restart");
  });
});

describe("public search paths", () => {
  it("finds an asset under a configured public path", async () => {
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "public";
    await mkdir(join(root, "public"), { recursive: true });
    await writeFile(join(root, "public", "logo.txt"), "a logo");
    const found = await storage.searchPublicObject("logo.txt");
    expect(found).not.toBeNull();
    const [buf] = await found!.download();
    expect(buf.toString()).toBe("a logo");
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  });

  it("returns null when nothing is configured, rather than throwing", async () => {
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    expect(await storage.searchPublicObject("anything.txt")).toBeNull();
  });
});

describe("legacy paths", () => {
  it("still normalises a cloud URL written before the move", () => {
    // Historical rows hold these; they must keep resolving.
    const normalised = storage.normalizeObjectEntityPath(
      "https://storage.googleapis.com/some-bucket/uploads/abc-123",
    );
    expect(normalised).toBe("/objects/uploads/abc-123");
  });

  it("leaves an already-normalised path alone", () => {
    expect(storage.normalizeObjectEntityPath("/objects/uploads/x")).toBe("/objects/uploads/x");
  });
});
