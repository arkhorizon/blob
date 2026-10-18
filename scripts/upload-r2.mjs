import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repositoryRoot, "content/r2-upload-manifest.json");
const sourceRoot = path.resolve(
  process.env.SHIYE_SOURCE_DIR ?? "/Volumes/SSD/Work/code/self/shiye-books/data"
);
const endpoint = (process.env.R2_S3_ENDPOINT ?? "").replace(/\/+$/, "");
const bucket = process.env.R2_BUCKET ?? "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
const overwrite = process.env.R2_OVERWRITE === "1";

const CONTENT_TYPES = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function canonicalUri(key) {
  return `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function authorization(headers, method, uri, timestamp) {
  const date = timestamp.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const payloadHash = "UNSIGNED-PAYLOAD";
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("");
  const canonicalRequest = [
    method,
    uri,
    "",
    canonicalHeaders,
    signedHeaders.join(";"),
    payloadHash
  ].join("\n");
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    scope,
    sha256(canonicalRequest)
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), service),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
}

async function signedFetch(method, key, body) {
  const url = new URL(endpoint + canonicalUri(key));
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const headers = {
    host: url.host,
    "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    "x-amz-date": timestamp
  };
  if (body) {
    headers["content-type"] =
      CONTENT_TYPES.get(path.extname(key).toLowerCase()) ?? "application/octet-stream";
  }
  headers.authorization = authorization(headers, method, canonicalUri(key), timestamp);

  const response = await fetch(url, {
    method,
    headers: body
      ? {
          ...headers,
          "cache-control": "public, max-age=31536000, immutable"
        }
      : headers,
    body
  });
  return response;
}

async function errorMessage(response) {
  let message = `${response.status} ${response.statusText}`;
  try {
    const text = await response.text();
    if (text) message += `: ${text.slice(0, 300)}`;
  } catch {}
  return message;
}

function resolveSource(source) {
  const file = path.resolve(sourceRoot, source);
  if (file !== sourceRoot && !file.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`Manifest source escapes source root: ${source}`);
  }
  if (path.posix.normalize(source).startsWith("../")) {
    throw new Error(`Invalid manifest source: ${source}`);
  }
  if (source.split("/").includes("..") || source.startsWith("/")) {
    throw new Error(`Invalid manifest source: ${source}`);
  }
  return file;
}

async function uploadAsset(asset) {
  const key = asset.r2Key;
  if (
    !key ||
    key.startsWith("/") ||
    key.split("/").includes("..") ||
    key.includes("\\") ||
    key !== path.posix.normalize(key)
  ) {
    throw new Error(`Invalid R2 key: ${key}`);
  }

  if (!overwrite) {
    const head = await signedFetch("HEAD", key);
    if (head.status === 200) return "skipped";
    if (head.status !== 404) throw new Error(`HEAD ${key}: ${await errorMessage(head)}`);
  }

  const file = resolveSource(asset.source);
  const body = await readFile(file);
  const put = await signedFetch("PUT", key, body);
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`PUT ${key}: ${await errorMessage(put)}`);
  }
  await put.arrayBuffer();
  return "uploaded";
}

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "Missing R2_S3_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY."
  );
  process.exit(1);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const assets = manifest.assets ?? [];
let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const asset of assets) {
  try {
    const result = await uploadAsset(asset);
    if (result === "uploaded") uploaded += 1;
    else skipped += 1;
    if ((uploaded + skipped) % 50 === 0) {
      console.log(`Progress: ${uploaded + skipped}/${assets.length}`);
    }
  } catch (error) {
    failed += 1;
    console.error(`Failed ${asset.r2Key}: ${error.message}`);
  }
}

console.log(`R2 upload complete: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed.`);
if (failed > 0) process.exit(1);
