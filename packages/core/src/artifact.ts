import type {
  NewAuditResult,
  SitelensArtifact,
  SitelensArtifactAsset,
  SitelensArtifactGenerator,
} from "@sitelens/shared/types";

export const SITELENS_ARTIFACT_VERSION = 1;
export const SITELENS_ARTIFACT_KIND = "sitelens.report";

const MANIFEST_PATH = "manifest.json";
const REPORT_PATH = "report.json";
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

export interface CreateArtifactAssetInput {
  path: string;
  mediaType: string;
  bytes: ArrayBuffer | Uint8Array | Buffer;
}

interface ZipEntry {
  path: string;
  bytes: Uint8Array;
}

interface ParsedZipEntry extends ZipEntry {
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
}

const DEFAULT_GENERATOR: SitelensArtifactGenerator = {
  name: "sitelens-core",
  version: "0.1.0",
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function createSitelensArtifact(
  report: NewAuditResult,
  assets: CreateArtifactAssetInput[],
  generator: SitelensArtifactGenerator = DEFAULT_GENERATOR
): SitelensArtifact {
  const artifactAssets = assets.map(createArtifactAsset);

  return {
    manifest: {
      kind: SITELENS_ARTIFACT_KIND,
      version: SITELENS_ARTIFACT_VERSION,
      createdAt: new Date().toISOString(),
      generator,
      audit: {
        id: report.id,
        url: report.url,
        status: report.status,
        createdAt: report.createdAt,
        completedAt: report.completedAt,
      },
      assets: artifactAssets.map(({ path, mediaType, byteLength }) => ({
        path,
        mediaType,
        byteLength,
      })),
      extensions: {},
    },
    report,
    assets: artifactAssets,
  };
}

export function serializeSitelensArtifact(artifact: SitelensArtifact): Uint8Array {
  const errors = validateSitelensArtifact(artifact);
  if (errors.length > 0) {
    throw new Error(`Invalid Sitelens artifact: ${errors.join("; ")}`);
  }

  return writeZip([
    {
      path: MANIFEST_PATH,
      bytes: encodeJson(artifact.manifest),
    },
    {
      path: REPORT_PATH,
      bytes: encodeJson(artifact.report),
    },
    ...artifact.assets.map((asset) => ({
      path: asset.path,
      bytes: asset.bytes,
    })),
  ]);
}

export function parseSitelensArtifact(
  content: ArrayBuffer | Uint8Array | Buffer | string
): SitelensArtifact {
  if (typeof content === "string") {
    const parsed = JSON.parse(content) as unknown;
    const errors = validateSitelensArtifact(parsed);
    if (errors.length > 0) {
      throw new Error(`Invalid Sitelens artifact: ${errors.join("; ")}`);
    }
    return parsed as SitelensArtifact;
  }

  const bytes = toBytes(content);
  const entries = readZip(bytes);
  const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const manifestEntry = entriesByPath.get(MANIFEST_PATH);
  const reportEntry = entriesByPath.get(REPORT_PATH);

  if (!manifestEntry) {
    throw new Error(`Invalid Sitelens artifact: missing ${MANIFEST_PATH}`);
  }
  if (!reportEntry) {
    throw new Error(`Invalid Sitelens artifact: missing ${REPORT_PATH}`);
  }

  const manifest = JSON.parse(textDecoder.decode(manifestEntry.bytes)) as SitelensArtifact["manifest"];
  const report = JSON.parse(textDecoder.decode(reportEntry.bytes)) as NewAuditResult;
  const assets = manifest.assets.map((asset): SitelensArtifactAsset => {
    const entry = entriesByPath.get(asset.path);
    if (!entry) {
      return {
        ...asset,
        bytes: new Uint8Array(),
      };
    }
    return {
      ...asset,
      bytes: entry.bytes,
    };
  });

  const artifact: SitelensArtifact = {
    manifest,
    report,
    assets,
  };
  const errors = validateSitelensArtifact(artifact);
  if (errors.length > 0) {
    throw new Error(`Invalid Sitelens artifact: ${errors.join("; ")}`);
  }

  return artifact;
}

export function validateSitelensArtifact(value: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return ["Artifact must be an object"];
  }

  const manifest = value.manifest;
  const report = value.report;
  const assets = value.assets;

  if (!isRecord(manifest)) {
    errors.push("Manifest must be an object");
  } else {
    if (manifest.kind !== SITELENS_ARTIFACT_KIND) {
      errors.push(`Manifest kind must be ${SITELENS_ARTIFACT_KIND}`);
    }
    if (manifest.version !== SITELENS_ARTIFACT_VERSION) {
      errors.push(`Manifest version must be ${SITELENS_ARTIFACT_VERSION}`);
    }
    if (typeof manifest.createdAt !== "string") {
      errors.push("Manifest createdAt must be a string");
    }
    if (!isRecord(manifest.audit)) {
      errors.push("Manifest audit must be an object");
    }
    if (!Array.isArray(manifest.assets)) {
      errors.push("Manifest assets must be an array");
    }
    if (!isRecord(manifest.extensions)) {
      errors.push("Manifest extensions must be an object");
    }
  }

  if (!isRecord(report)) {
    errors.push("Report must be an object");
  } else {
    if (typeof report.id !== "string") {
      errors.push("Report id must be a string");
    }
    if (typeof report.url !== "string") {
      errors.push("Report url must be a string");
    }
    if (!isRecord(report.assets)) {
      errors.push("Report assets must be an object");
    }
  }

  if (!Array.isArray(assets)) {
    errors.push("Assets must be an array");
  } else {
    const assetPaths = new Set<string>();
    for (const asset of assets) {
      if (!isRecord(asset)) {
        errors.push("Each asset must be an object");
        continue;
      }
      if (typeof asset.path !== "string") {
        errors.push("Asset path must be a string");
        continue;
      }
      if (assetPaths.has(asset.path)) {
        errors.push(`Duplicate asset path: ${asset.path}`);
      }
      assetPaths.add(asset.path);
      if (typeof asset.mediaType !== "string") {
        errors.push(`Asset ${asset.path} mediaType must be a string`);
      }
      if (typeof asset.byteLength !== "number") {
        errors.push(`Asset ${asset.path} byteLength must be a number`);
      }
      if (!(asset.bytes instanceof Uint8Array)) {
        errors.push(`Asset ${asset.path} bytes must be a Uint8Array`);
      } else if (asset.bytes.byteLength !== asset.byteLength) {
        errors.push(`Asset ${asset.path} byteLength does not match bytes`);
      }
    }

    if (isRecord(manifest) && Array.isArray(manifest.assets)) {
      for (const manifestAsset of manifest.assets) {
        if (!isRecord(manifestAsset) || typeof manifestAsset.path !== "string") {
          errors.push("Manifest asset references must include a path");
          continue;
        }
        if (!assetPaths.has(manifestAsset.path)) {
          errors.push(`Missing asset for manifest asset path: ${manifestAsset.path}`);
        }
      }
    }

    if (isRecord(report) && isRecord(report.assets) && Array.isArray(report.assets.screenshots)) {
      for (const screenshot of report.assets.screenshots) {
        if (!isRecord(screenshot) || typeof screenshot.path !== "string") {
          errors.push("Screenshot references must include a path");
          continue;
        }
        if (!assetPaths.has(screenshot.path)) {
          errors.push(`Missing asset for referenced screenshot path: ${screenshot.path}`);
        }
      }
    }
  }

  return errors;
}

function createArtifactAsset(input: CreateArtifactAssetInput): SitelensArtifactAsset {
  const bytes = toBytes(input.bytes);
  return {
    path: input.path,
    mediaType: input.mediaType,
    byteLength: bytes.byteLength,
    bytes,
  };
}

function encodeJson(value: unknown): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(value, null, 2)}\n`);
}

function toBytes(bytes: ArrayBuffer | Uint8Array | Buffer): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  return new Uint8Array(bytes);
}

function writeZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = textEncoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const localHeader = new Uint8Array(30 + name.byteLength);
    const local = new DataView(localHeader.buffer);
    local.setUint32(0, ZIP_LOCAL_FILE_HEADER, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.bytes.byteLength, true);
    local.setUint32(22, entry.bytes.byteLength, true);
    local.setUint16(26, name.byteLength, true);
    local.setUint16(28, 0, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, entry.bytes);

    const centralHeader = new Uint8Array(46 + name.byteLength);
    const central = new DataView(centralHeader.buffer);
    central.setUint32(0, ZIP_CENTRAL_DIRECTORY_HEADER, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, 0, true);
    central.setUint16(14, 0, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, entry.bytes.byteLength, true);
    central.setUint32(24, entry.bytes.byteLength, true);
    central.setUint16(28, name.byteLength, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, offset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    offset += localHeader.byteLength + entry.bytes.byteLength;
  }

  const centralOffset = offset;
  const centralSize = sumByteLengths(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, ZIP_END_OF_CENTRAL_DIRECTORY, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, ...centralParts, end]);
}

function readZip(bytes: Uint8Array): ParsedZipEntry[] {
  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset < 0) {
    throw new Error("Invalid Sitelens artifact: expected zip package");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  const entries: ParsedZipEntry[] = [];
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(cursor, true) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw new Error("Invalid Sitelens artifact: corrupt central directory");
    }

    const compressionMethod = view.getUint16(cursor + 10, true);
    if (compressionMethod !== 0) {
      throw new Error("Invalid Sitelens artifact: compressed zip entries are not supported yet");
    }

    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const path = textDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + fileNameLength));

    if (view.getUint32(localOffset, true) !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error(`Invalid Sitelens artifact: missing local file header for ${path}`);
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    const entryBytes = bytes.slice(dataStart, dataEnd);
    const actualCrc = crc32(entryBytes);
    if (actualCrc !== crc) {
      throw new Error(`Invalid Sitelens artifact: CRC mismatch for ${path}`);
    }

    entries.push({
      path,
      bytes: entryBytes,
      crc32: crc,
      compressedSize,
      uncompressedSize,
    });

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minOffset = Math.max(0, bytes.byteLength - 65557);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.byteLength - 22; offset >= minOffset; offset--) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  return -1;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(sumByteLengths(parts));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function sumByteLengths(parts: Uint8Array[]): number {
  return parts.reduce((total, part) => total + part.byteLength, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
