import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

let s3Client: S3Client | null = null;
let clientCacheKey = "";
let envFileCache: Record<string, string> | null = null;

type WasabiConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  publicBaseUrl: string;
};

const parseEnvFile = (): Record<string, string> => {
  if (envFileCache) return envFileCache;
  const envPath = path.join(process.cwd(), ".env");
  const parsed: Record<string, string> = {};

  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex <= 0) continue;

      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      parsed[key] = value;
    }
  } catch {
  }

  envFileCache = parsed;
  return parsed;
};

const getEnvValue = (key: string): string => {
  const runtimeValue = process.env[key];
  if (runtimeValue && runtimeValue.trim() !== "") {
    return runtimeValue.trim();
  }
  const fromFile = parseEnvFile()[key];
  return fromFile ? fromFile.trim() : "";
};

export const getWasabiConfig = (): WasabiConfig | null => {
  const bucket = getEnvValue("WASABI_BUCKET");
  const region = getEnvValue("WASABI_REGION") || "us-east-1";
  const endpoint = getEnvValue("WASABI_ENDPOINT").replace(/^https?:\/\//, "");
  const accessKey = getEnvValue("WASABI_ACCESS_KEY");
  const secretKey = getEnvValue("WASABI_SECRET_KEY");
  const publicBaseUrl = getEnvValue("WASABI_PUBLIC_BASE_URL").replace(/\/+$/, "");

  if (!bucket || !endpoint || !accessKey || !secretKey || !publicBaseUrl) {
    return null;
  }

  return { bucket, region, endpoint, accessKey, secretKey, publicBaseUrl };
};

export const isWasabiConfigured = (): boolean => {
  return Boolean(getWasabiConfig());
};

export const getS3Client = (): S3Client => {
  const config = getWasabiConfig();
  if (!config) {
    throw new Error("Wasabi is not fully configured.");
  }

  const nextCacheKey = `${config.endpoint}|${config.region}|${config.accessKey}`;
  if (!s3Client || clientCacheKey !== nextCacheKey) {
    s3Client = new S3Client({
      region: config.region,
      endpoint: `https://${config.endpoint}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
    clientCacheKey = nextCacheKey;
  }

  return s3Client;
};

export const buildWasabiPublicUrl = (key: string): string => {
  const config = getWasabiConfig();
  if (!config) return "";
  const normalizedKey = key.replace(/^\/+/, "");
  return `${config.publicBaseUrl}/${normalizedKey}`;
};

export const getPresignedUrl = async (key: string, expiresIn = 3600): Promise<string> => {
  const config = getWasabiConfig();
  if (!config) throw new Error("Wasabi is not configured.");
  
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key.replace(/^\/+/, ""),
  });

  return await getSignedUrl(client, command, { expiresIn });
};

export const uploadBufferToWasabi = async (
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> => {
  const config = getWasabiConfig();
  if (!config) {
    throw new Error("Wasabi is not fully configured.");
  }
  const client = getS3Client();
  const cleanKey = key.replace(/^\/+/, "");

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: cleanKey,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return buildWasabiPublicUrl(cleanKey);
};

export const deleteObjectFromWasabi = async (key: string): Promise<void> => {
  const config = getWasabiConfig();
  if (!config) {
    throw new Error("Wasabi is not fully configured.");
  }
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key.replace(/^\/+/, ""),
    })
  );
};

export const resolveWasabiKeyFromUrl = (url: string): string | null => {
  const cleanUrl = url?.trim();
  if (!cleanUrl) return null;

  const config = getWasabiConfig();
  if (!config) return null;

  if (cleanUrl.startsWith("http")) {
    const base = config.publicBaseUrl;
    if (cleanUrl.startsWith(base)) {
      return cleanUrl.slice(base.length).replace(/^\/+/, "");
    }
  }

  if (cleanUrl.startsWith("/api/")) {
    return cleanUrl.slice("/api/".length).replace(/^\/+/, "");
  }

  return cleanUrl.replace(/^\/+/, "");
};
