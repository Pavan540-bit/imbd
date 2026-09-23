import { readFileSync, writeFileSync } from "node:fs";
import { BlobNotFoundError, get, head, put } from "@vercel/blob";

const PATHNAME = "portfolio.sqlite";

export async function remotePortfolioStamp(): Promise<string> {
  try {
    const meta = await head(PATHNAME);
    return meta.etag;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return "";
    throw error;
  }
}

export async function downloadPortfolioDb(file: string) {
  const result = await get(PATHNAME, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return;
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    if (step.value) chunks.push(step.value);
  }
  writeFileSync(file, Buffer.concat(chunks));
}

export async function uploadPortfolioDb(file: string): Promise<string> {
  const bytes = readFileSync(file);
  const saved = await put(PATHNAME, bytes, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/octet-stream",
    cacheControlMaxAge: 60,
  });
  return saved.etag;
}
