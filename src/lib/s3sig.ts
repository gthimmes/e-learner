/**
 * AWS Signature Version 4 for S3-compatible object stores (AWS S3, MinIO, Cloudflare R2, …).
 * Pure: no I/O, so it is unit-tested against the vector from the AWS documentation.
 */
import { createHash, createHmac } from "node:crypto";

export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export const sha256Hex = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding as AWS expects it (`!'()*` encoded, `~` not). */
export function awsEncode(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export function amzDate(d: Date) {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20130524T000000Z
}

export type SignInput = {
  method: string;
  url: URL;
  headers: Record<string, string>; // must not include host / x-amz-date / authorization
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
  date?: Date;
};

/** Returns the full header set to send, including Authorization. */
export function signRequest(input: SignInput): Record<string, string> {
  const service = input.service ?? "s3";
  const date = input.date ?? new Date();
  const xAmzDate = amzDate(date);
  const dateStamp = xAmzDate.slice(0, 8);
  const headers: Record<string, string> = { ...input.headers, host: input.url.host, "x-amz-content-sha256": input.payloadHash, "x-amz-date": xAmzDate };

  const canonicalUri = input.url.pathname
    .split("/")
    .map((seg) => awsEncode(decodeURIComponent(seg)))
    .join("/");
  const canonicalQuery = [...input.url.searchParams.entries()]
    .map(([k, v]) => [awsEncode(k), awsEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const names = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v.trim().replace(/\s+/g, " ");
  const canonicalHeaders = names.map((h) => `${h}:${lower[h]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [input.method.toUpperCase(), canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, input.payloadHash].join("\n");

  const scope = `${dateStamp}/${input.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", xAmzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac("AWS4" + input.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
