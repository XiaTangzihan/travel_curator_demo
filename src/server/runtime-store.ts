import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TosClient, TosServerError } from "@volcengine/tos-sdk";

export type RuntimeStoreCategory = "routes" | "posters" | "videos" | "maps" | "runs";
export type RuntimeStoreMode = "filesystem" | "tmp" | "tos";

export const runtimeStoreCategories = [
  "routes",
  "posters",
  "videos",
  "maps",
  "runs",
] as const satisfies readonly RuntimeStoreCategory[];

const runtimeStoreCategorySet = new Set<string>(runtimeStoreCategories);
const runtimeVirtualPrefix = "runtime://";
const packagedRuntimeMockDir = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "mock");
const tmpRuntimeMockDir = path.join(os.tmpdir(), "travel-curator-runtime", "mock");

let tmpRuntimeSeedPromise: Promise<void> | null = null;
let tosClientPromise: Promise<TosClient> | null = null;

type RuntimeStoreRef = {
  category: RuntimeStoreCategory;
  relativePath: string;
};

function isHostedReadonlyRuntime() {
  return process.cwd().startsWith("/opt/bytefaas");
}

function normalizeRelativePath(value: string) {
  return value.split(path.sep).join("/").replace(/^\/+/, "");
}

function normalizePrefix(value: string) {
  return value.split(path.sep).join("/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function hasTosConfig() {
  return Boolean(
    process.env.RUNTIME_TOS_BUCKET?.trim()
    && process.env.RUNTIME_TOS_REGION?.trim()
    && process.env.RUNTIME_TOS_ACCESS_KEY?.trim()
    && process.env.RUNTIME_TOS_SECRET_KEY?.trim(),
  );
}

export function getRuntimeStoreMode(): RuntimeStoreMode {
  const configured = process.env.RUNTIME_STORE_DRIVER?.trim();
  if (configured === "filesystem" || configured === "tmp" || configured === "tos") {
    return configured;
  }

  if (hasTosConfig()) {
    return "tos";
  }

  if (isHostedReadonlyRuntime()) {
    return "tmp";
  }

  return "filesystem";
}

export function buildRuntimeVirtualPath(category: RuntimeStoreCategory, relativePath: string) {
  return `${runtimeVirtualPrefix}${category}/${normalizeRelativePath(relativePath)}`;
}

export function parseRuntimeVirtualPath(filePath: string): RuntimeStoreRef | null {
  if (!filePath.startsWith(runtimeVirtualPrefix)) {
    return null;
  }

  const relative = filePath.slice(runtimeVirtualPrefix.length);
  const [category, ...restSegments] = relative.split("/").filter(Boolean);
  if (!category || !runtimeStoreCategorySet.has(category) || restSegments.length === 0) {
    return null;
  }

  return {
    category: category as RuntimeStoreCategory,
    relativePath: restSegments.join("/"),
  };
}

function parseRuntimeVirtualDirectory(directoryPath: string) {
  if (!directoryPath.startsWith(runtimeVirtualPrefix)) {
    return null;
  }

  const relative = directoryPath.slice(runtimeVirtualPrefix.length);
  const [category, ...restSegments] = relative.split("/").filter(Boolean);
  if (!category || !runtimeStoreCategorySet.has(category)) {
    return null;
  }

  return {
    category: category as RuntimeStoreCategory,
    relativePath: restSegments.join("/"),
  };
}

function resolveFilesystemRuntimePath(ref: RuntimeStoreRef, mode: RuntimeStoreMode) {
  const runtimeRoot = mode === "tmp" ? tmpRuntimeMockDir : packagedRuntimeMockDir;
  return path.join(runtimeRoot, ref.category, ...ref.relativePath.split("/"));
}

function buildTosObjectKey(ref: RuntimeStoreRef) {
  const configuredPrefix = normalizePrefix(process.env.RUNTIME_TOS_PREFIX?.trim() || "runtime/mock");
  return `${configuredPrefix}/${ref.category}/${ref.relativePath}`;
}

async function getTosClient() {
  if (!tosClientPromise) {
    tosClientPromise = Promise.resolve(
      new TosClient({
        accessKeyId: requireEnv("RUNTIME_TOS_ACCESS_KEY"),
        accessKeySecret: requireEnv("RUNTIME_TOS_SECRET_KEY"),
        region: requireEnv("RUNTIME_TOS_REGION"),
        endpoint: process.env.RUNTIME_TOS_ENDPOINT?.trim() || undefined,
        stsToken: process.env.RUNTIME_TOS_SESSION_TOKEN?.trim() || undefined,
      }),
    );
  }

  return tosClientPromise;
}

function isTosNotFoundError(error: unknown) {
  if (error instanceof TosServerError) {
    return error.statusCode === 404;
  }

  return Boolean(
    error
    && typeof error === "object"
    && "statusCode" in error
    && (error as { statusCode?: number }).statusCode === 404,
  );
}

async function seedTmpRuntimeStore() {
  await Promise.all(
    runtimeStoreCategories.map(async (category) => {
      const sourceDirectory = path.join(packagedRuntimeMockDir, category);
      const targetDirectory = path.join(tmpRuntimeMockDir, category);
      await mkdir(targetDirectory, { recursive: true });
      try {
        const fileNames = await readdir(sourceDirectory);
        await Promise.all(
          fileNames.map(async (fileName) => {
            const sourcePath = path.join(sourceDirectory, fileName);
            const targetPath = path.join(targetDirectory, fileName);
            try {
              await access(targetPath);
              return;
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
              }
            }
            await cp(sourcePath, targetPath, { force: false, recursive: true });
          }),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return;
        }
        throw error;
      }
    }),
  );
}

export async function ensureRuntimeStoreReady() {
  const mode = getRuntimeStoreMode();
  if (mode !== "tmp") {
    return;
  }

  if (!tmpRuntimeSeedPromise) {
    tmpRuntimeSeedPromise = seedTmpRuntimeStore();
  }

  await tmpRuntimeSeedPromise;
}

export async function readRuntimeStoreBuffer(filePath: string): Promise<Buffer | null> {
  const ref = parseRuntimeVirtualPath(filePath);
  if (!ref) {
    throw new Error(`非 runtime store 路径: ${filePath}`);
  }

  const mode = getRuntimeStoreMode();
  if (mode === "tos") {
    try {
      const client = await getTosClient();
      const { data } = await client.getObjectV2({
        bucket: requireEnv("RUNTIME_TOS_BUCKET"),
        key: buildTosObjectKey(ref),
        dataType: "buffer",
      });
      return data.content;
    } catch (error) {
      if (isTosNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  await ensureRuntimeStoreReady();
  const resolvedPath = resolveFilesystemRuntimePath(ref, mode);
  try {
    return await readFile(resolvedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeRuntimeStoreBuffer(filePath: string, value: Buffer) {
  const ref = parseRuntimeVirtualPath(filePath);
  if (!ref) {
    throw new Error(`非 runtime store 路径: ${filePath}`);
  }

  const mode = getRuntimeStoreMode();
  if (mode === "tos") {
    const client = await getTosClient();
    await client.putObject({
      bucket: requireEnv("RUNTIME_TOS_BUCKET"),
      key: buildTosObjectKey(ref),
      body: value,
    });
    return;
  }

  await ensureRuntimeStoreReady();
  const resolvedPath = resolveFilesystemRuntimePath(ref, mode);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, value);
}

export async function runtimeStorePathExists(filePath: string) {
  const ref = parseRuntimeVirtualPath(filePath);
  if (!ref) {
    throw new Error(`非 runtime store 路径: ${filePath}`);
  }

  const mode = getRuntimeStoreMode();
  if (mode === "tos") {
    try {
      const client = await getTosClient();
      await client.headObject({
        bucket: requireEnv("RUNTIME_TOS_BUCKET"),
        key: buildTosObjectKey(ref),
      });
      return true;
    } catch (error) {
      if (isTosNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  await ensureRuntimeStoreReady();
  try {
    await access(resolveFilesystemRuntimePath(ref, mode));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function deleteRuntimeStorePath(filePath: string) {
  const ref = parseRuntimeVirtualPath(filePath);
  if (!ref) {
    throw new Error(`非 runtime store 路径: ${filePath}`);
  }

  const mode = getRuntimeStoreMode();
  if (mode === "tos") {
    try {
      const client = await getTosClient();
      await client.deleteObject({
        bucket: requireEnv("RUNTIME_TOS_BUCKET"),
        key: buildTosObjectKey(ref),
      });
    } catch (error) {
      if (!isTosNotFoundError(error)) {
        throw error;
      }
    }
    return;
  }

  await ensureRuntimeStoreReady();
  await rm(resolveFilesystemRuntimePath(ref, mode), { force: true });
}

export async function listRuntimeStoreFiles(directoryPath: string, suffix?: string) {
  const ref = parseRuntimeVirtualDirectory(directoryPath);
  if (!ref) {
    throw new Error(`非 runtime store 目录: ${directoryPath}`);
  }

  const mode = getRuntimeStoreMode();
  if (mode === "tos") {
    const client = await getTosClient();
    const bucket = requireEnv("RUNTIME_TOS_BUCKET");
    const directoryPrefix = buildTosObjectKey({
      category: ref.category,
      relativePath: ref.relativePath ? `${ref.relativePath}/` : "",
    }).replace(/\/+$/, "");
    const keyPrefix = ref.relativePath ? `${directoryPrefix}/` : `${normalizePrefix(process.env.RUNTIME_TOS_PREFIX?.trim() || "runtime/mock")}/${ref.category}/`;

    const fileNames: string[] = [];
    let continuationToken: string | undefined;

    do {
      const { data } = await client.listObjectsType2({
        bucket,
        prefix: keyPrefix,
        continuationToken,
        maxKeys: 1000,
        listOnlyOnce: true,
      });

      for (const item of data.Contents ?? []) {
        const key = item.Key;
        if (!key.startsWith(keyPrefix)) {
          continue;
        }

        const relativePath = key.slice(keyPrefix.length);
        if (!relativePath || relativePath.includes("/")) {
          continue;
        }

        if (!suffix || relativePath.endsWith(suffix)) {
          fileNames.push(relativePath);
        }
      }

      continuationToken = data.IsTruncated ? data.NextContinuationToken : undefined;
    } while (continuationToken);

    return fileNames;
  }

  await ensureRuntimeStoreReady();
  const resolvedPath = resolveFilesystemRuntimePath(
    {
      category: ref.category,
      relativePath: ref.relativePath || "__directory__",
    },
    mode,
  );
  const targetDirectory = ref.relativePath ? resolvedPath.replace(/[\\/]__directory__$/, "") : path.join(
    mode === "tmp" ? tmpRuntimeMockDir : packagedRuntimeMockDir,
    ref.category,
  );

  try {
    const fileNames = await readdir(targetDirectory);
    return suffix ? fileNames.filter((fileName) => fileName.endsWith(suffix)) : fileNames;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
