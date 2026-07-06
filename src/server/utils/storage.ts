import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildRuntimeVirtualPath,
  ensureRuntimeStoreReady,
  getRuntimeStoreMode,
  listRuntimeStoreFiles,
  parseRuntimeVirtualPath,
  readRuntimeStoreBuffer,
  runtimeStorePathExists,
  writeRuntimeStoreBuffer,
  deleteRuntimeStorePath,
} from "@/src/server/runtime-store";

const publicDir = path.join(/* turbopackIgnore: true */ process.cwd(), "public");
const publicMockDir = path.join(publicDir, "mock");
const runtimeDir = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime");
const runtimeMockDir = path.join(runtimeDir, "mock");
const runtimePublicPrefix = "/runtime/mock";

const runtimeMockCategories = ["routes", "posters", "videos", "maps", "runs"] as const;

type RuntimeMockCategory = (typeof runtimeMockCategories)[number];
export type { RuntimeMockCategory };

const runtimeMockCategorySet = new Set<string>(runtimeMockCategories);

export const storagePaths = {
  publicDir,
  publicMockDir,
  runtimeDir,
  runtimeMockDir,
  raw: path.join(publicMockDir, "raw"),
  events: path.join(publicMockDir, "events"),
  routes: path.join(runtimeMockDir, "routes"),
  posters: path.join(runtimeMockDir, "posters"),
  videos: path.join(runtimeMockDir, "videos"),
  maps: path.join(runtimeMockDir, "maps"),
  runs: path.join(runtimeMockDir, "runs"),
  files: path.join(publicMockDir, "files"),
  comments: path.join(publicMockDir, "files", "comments"),
} as const;

export const legacyRuntimeStoragePaths = {
  routes: path.join(publicMockDir, "routes"),
  posters: path.join(publicMockDir, "posters"),
  videos: path.join(publicMockDir, "videos"),
  maps: path.join(publicMockDir, "maps"),
  runs: path.join(publicMockDir, "runs"),
} as const satisfies Record<RuntimeMockCategory, string>;

let runtimeMigrationPromise: Promise<void> | null = null;

function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

function normalizePublicPath(publicPath: string) {
  return `/${publicPath.replace(/^\/+/, "")}`;
}

function splitRuntimePublicPath(publicPath: string) {
  const normalized = normalizePublicPath(publicPath);
  if (normalized.startsWith(`${runtimePublicPrefix}/`)) {
    const relative = normalized.slice(`${runtimePublicPrefix}/`.length);
    const [category, ...restSegments] = relative.split("/").filter(Boolean);
    if (!category || restSegments.length === 0) {
      return null;
    }

    return {
      category,
      relativePath: restSegments.join("/"),
    };
  }

  if (normalized.startsWith("/mock/")) {
    const segments = normalized.split("/").filter(Boolean);
    const [mock, category, ...restSegments] = segments;
    if (mock !== "mock" || !category || restSegments.length === 0) {
      return null;
    }

    return {
      category,
      relativePath: restSegments.join("/"),
    };
  }

  return null;
}

function splitRuntimeFileReference(filePath: string) {
  const virtualPath = parseRuntimeVirtualPath(filePath);
  if (virtualPath) {
    return virtualPath;
  }

  const publicPath = splitRuntimePublicPath(filePath);
  if (publicPath && runtimeMockCategorySet.has(publicPath.category)) {
    return {
      category: publicPath.category as RuntimeMockCategory,
      relativePath: publicPath.relativePath,
    };
  }

  for (const category of runtimeMockCategories) {
    const runtimeDirectory = storagePaths[category];
    if (filePath === runtimeDirectory) {
      return {
        category,
        relativePath: "",
      };
    }
    if (filePath.startsWith(`${runtimeDirectory}${path.sep}`)) {
      return {
        category,
        relativePath: toPosixPath(path.relative(runtimeDirectory, filePath)),
      };
    }

    const legacyDirectory = legacyRuntimeStoragePaths[category];
    if (filePath === legacyDirectory) {
      return {
        category,
        relativePath: "",
      };
    }
    if (filePath.startsWith(`${legacyDirectory}${path.sep}`)) {
      return {
        category,
        relativePath: toPosixPath(path.relative(legacyDirectory, filePath)),
      };
    }
  }

  return null;
}

function resolveRuntimeCategoryPath(category: RuntimeMockCategory, relativePath: string) {
  return path.join(storagePaths[category], ...relativePath.split("/"));
}

function resolveLegacyRuntimeCategoryPath(category: RuntimeMockCategory, relativePath: string) {
  return path.join(legacyRuntimeStoragePaths[category], ...relativePath.split("/"));
}

export function toPublicPath(filePath: string) {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    return runtimeAssetPublicPath(runtimeRef.category, runtimeRef.relativePath);
  }

  if (filePath.startsWith(storagePaths.runtimeMockDir)) {
    const relative = toPosixPath(path.relative(storagePaths.runtimeMockDir, filePath));
    return `${runtimePublicPrefix}/${relative}`;
  }

  const relative = toPosixPath(path.relative(publicDir, filePath));
  return `/${relative}`;
}

export function fromPublicPath(publicPath: string) {
  const runtimeCandidates = fromPublicPathCandidates(publicPath);
  return runtimeCandidates[0];
}

export function fromPublicPathCandidates(publicPath: string) {
  const mockPath = splitRuntimePublicPath(publicPath);
  if (mockPath && runtimeMockCategorySet.has(mockPath.category)) {
    const category = mockPath.category as RuntimeMockCategory;
    return [
      resolveRuntimeCategoryPath(category, mockPath.relativePath),
      resolveLegacyRuntimeCategoryPath(category, mockPath.relativePath),
    ];
  }

  const relative = normalizePublicPath(publicPath).replace(/^\/+/, "");
  return [path.join(publicDir, relative)];
}

export function runtimeAssetPublicPath(category: RuntimeMockCategory, fileName: string) {
  const normalizedFileName = fileName.split(path.sep).join("/");
  return `${runtimePublicPrefix}/${category}/${normalizedFileName}`;
}

export function runtimeAssetAbsolutePath(category: RuntimeMockCategory, fileName: string) {
  return path.join(storagePaths[category], fileName);
}

export function normalizeRuntimeAbsolutePath(filePath: string) {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    return runtimeAssetPublicPath(runtimeRef.category, runtimeRef.relativePath);
  }

  for (const category of runtimeMockCategories) {
    const legacyDirectory = legacyRuntimeStoragePaths[category];
    if (!filePath.startsWith(legacyDirectory)) {
      continue;
    }

    const relativePath = path.relative(legacyDirectory, filePath);
    return path.join(storagePaths[category], relativePath);
  }

  return filePath;
}

export function normalizeRuntimePublicPath(publicPath: string) {
  const runtimePath = splitRuntimePublicPath(publicPath);
  if (!runtimePath || !runtimeMockCategorySet.has(runtimePath.category)) {
    return publicPath;
  }

  return runtimeAssetPublicPath(runtimePath.category as RuntimeMockCategory, runtimePath.relativePath);
}

async function migrateLegacyRuntimeStorage() {
  await Promise.all(
    runtimeMockCategories.map(async (category) => {
      const legacyDirectory = legacyRuntimeStoragePaths[category];
      const runtimeDirectory = storagePaths[category];
      try {
        const fileNames = await readdir(legacyDirectory);
        await Promise.all(
          fileNames.map(async (fileName) => {
            const sourcePath = path.join(legacyDirectory, fileName);
            const targetPath = path.join(runtimeDirectory, fileName);
            if (await pathExists(targetPath)) {
              return;
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

async function ensureRuntimeStorageMigrated() {
  if (!runtimeMigrationPromise) {
    runtimeMigrationPromise = migrateLegacyRuntimeStorage();
  }
  await runtimeMigrationPromise;
}

export async function ensureStorageDirectories() {
  const runtimeMode = getRuntimeStoreMode();
  if (runtimeMode === "tmp" || runtimeMode === "tos") {
    await ensureRuntimeStoreReady();
    return;
  }

  const directories = [
    storagePaths.runtimeDir,
    storagePaths.runtimeMockDir,
    storagePaths.routes,
    storagePaths.posters,
    storagePaths.videos,
    storagePaths.maps,
    storagePaths.runs,
  ];

  await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
  await ensureRuntimeStorageMigrated();
}

export async function writeJsonFile(filePath: string, value: unknown) {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    await ensureRuntimeStoreReady();
    await writeRuntimeStoreBuffer(
      buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath),
      Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"),
    );
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomically(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    const content = await readRuntimeStoreBuffer(
      buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath),
    );
    if (!content) {
      return null;
    }
    return JSON.parse(content.toString("utf8")) as T;
  }

  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeTextFile(filePath: string, value: string) {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    await ensureRuntimeStoreReady();
    await writeRuntimeStoreBuffer(
      buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath),
      Buffer.from(value, "utf8"),
    );
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomically(filePath, value, "utf8");
}

export async function readTextFile(filePath: string): Promise<string | null> {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    const content = await readRuntimeStoreBuffer(
      buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath),
    );
    return content ? content.toString("utf8") : null;
  }

  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function readBinaryFile(filePath: string): Promise<Buffer | null> {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    return readRuntimeStoreBuffer(buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath));
  }

  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeBinaryFile(filePath: string, value: Buffer) {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    await ensureRuntimeStoreReady();
    await writeRuntimeStoreBuffer(
      buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath),
      value,
    );
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomically(filePath, value);
}

async function writeFileAtomically(
  filePath: string,
  value: string | Buffer,
  encoding?: BufferEncoding,
) {
  const tempFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  if (typeof value === "string") {
    await writeFile(tempFilePath, value, encoding);
  } else {
    await writeFile(tempFilePath, value);
  }
  await rm(filePath, { force: true });
  await rename(tempFilePath, filePath);
}

export async function pathExists(filePath: string) {
  const runtimeRef = splitRuntimeFileReference(filePath);
  if (runtimeRef?.relativePath) {
    return runtimeStorePathExists(buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath));
  }

  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function deleteFilePaths(filePaths: string[]) {
  await Promise.all(filePaths.map(async (filePath) => {
    const runtimeRef = splitRuntimeFileReference(filePath);
    if (runtimeRef?.relativePath) {
      await deleteRuntimeStorePath(buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath));
      return;
    }

    await rm(filePath, { force: true });
  }));
}

export async function listJsonFiles(directory: string) {
  const runtimeRef = splitRuntimeFileReference(directory);
  if (runtimeRef) {
    return listRuntimeStoreFiles(
      buildRuntimeVirtualPath(runtimeRef.category, runtimeRef.relativePath),
      ".json",
    );
  }

  try {
    const files = await readdir(directory);
    return files.filter((fileName) => fileName.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
