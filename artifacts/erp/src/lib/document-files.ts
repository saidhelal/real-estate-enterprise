import { useCallback, useState } from "react";
import {
  useCreateDocumentUploadUrl,
  useCreateDocumentVersion,
  type DocumentVersion,
} from "@workspace/api-client-react";

/** Human-readable file size. */
export function formatFileSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

/** Same-origin URL the API serves the current (or a specific) file from. */
export function documentFileUrl(documentId: string, versionId?: string): string {
  const base = `/api/documents/${documentId}/file`;
  return versionId ? `${base}?versionId=${encodeURIComponent(versionId)}` : base;
}

export type PreviewKind = "image" | "pdf" | "text" | "none";

/** Decide how a file can be previewed inline in the browser. */
export function previewKind(mimeType?: string | null, fileName?: string | null): PreviewKind {
  const mime = (mimeType ?? "").toLowerCase();
  const ext = (fileName ?? "").toLowerCase().split(".").pop() ?? "";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  // Active content (HTML, SVG, XML, scripts) must never be previewed inline —
  // it would execute in the app's same origin. Treat it as non-previewable.
  const dangerous =
    mime === "text/html" ||
    mime === "application/xhtml+xml" ||
    mime === "image/svg+xml" ||
    mime.includes("javascript") ||
    mime.includes("ecmascript") ||
    mime === "application/xml" ||
    mime === "text/xml" ||
    ["html", "htm", "xhtml", "svg", "xml", "js", "mjs"].includes(ext);
  if (dangerous) return "none";
  if (mime.startsWith("text/") || ["txt", "csv", "json", "md", "log"].includes(ext)) {
    return "text";
  }
  return "none";
}

function fileFormatOf(name: string): string | undefined {
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toLowerCase() : undefined;
}

/**
 * Composes the two-step upload: request a presigned URL, PUT the bytes to object
 * storage, then register a new document version. Reused by the detail page and
 * the cross-module Documents panel.
 */
export function useDocumentUpload() {
  const uploadUrlMutation = useCreateDocumentUploadUrl();
  const versionMutation = useCreateDocumentVersion();
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    async (documentId: string, file: File, changeSummary?: string): Promise<DocumentVersion> => {
      setIsUploading(true);
      try {
        const contentType = file.type || "application/octet-stream";
        const { uploadUrl, filePath } = await uploadUrlMutation.mutateAsync({
          data: { fileName: file.name, contentType },
        });
        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        if (!put.ok) {
          throw new Error(`Upload failed (${put.status})`);
        }
        return await versionMutation.mutateAsync({
          id: documentId,
          data: {
            fileObjectPath: filePath,
            fileName: file.name,
            fileFormat: fileFormatOf(file.name),
            mimeType: contentType,
            fileSize: file.size,
            changeSummary: changeSummary || undefined,
          },
        });
      } finally {
        setIsUploading(false);
      }
    },
    [uploadUrlMutation, versionMutation],
  );

  return { upload, isUploading };
}
