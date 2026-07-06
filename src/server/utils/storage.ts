import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const publicDir = path.join(/* turbopackIgnore: true */ process.cwd(), "public");
const publicMockDir = path.join(publicDir, "mock");
const runtimeDir = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime");
const runtimeMockDir = path.join(runtimeDir, "mock");

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

function splitMockPublicPath(publicPath: string) {
  const normalized = normalizePublicPath(publicPath);
  if (!normalized.startsWith("/mock/")) {
    return null;
  }

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

function resolveRuntimeCategoryPath(category: RuntimeMockCategory, relativePath: string) {
  return path.join(storagePaths[category], ...relativePath.split("/"));
}

function resolveLegacyRuntimeCategoryPath(category: RuntimeMockCategory, relativePath: string) {
  return path.join(legacyRuntimeStoragePaths[category], ...relativePath.split("/"));
}

export function toPublicPath(filePath: string) {
  if (filePath.startsWith(storagePaths.runtimeMockDir)) {
    const relative = toPosixPath(path.relative(storagePaths.runtimeMockDir, filePath));
    return `/mock/${relative}`;
  }

  const relative = toPosixPath(path.relative(publicDir, filePath));
  return `/${relative}`;
}

export function fromPublicPath(publicPath: string) {
  const runtimeCandidates = fromPublicPathCandidates(publicPath);
  return runtimeCandidates[0];
}

export function fromPublicPathCandidates(publicPath: string) {
  const mockPath = splitMockPublicPath(publicPath);
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
  return `/mock/${category}/${fileName}`;
}

export function runtimeAssetAbsolutePath(category: RuntimeMockCategory, fileName: string) {
  return path.join(storagePaths[category], fileName);
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
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
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
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

export async function readTextFile(filePath: string): Promise<string | null> {
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
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value);
}

export async function pathExists(filePath: string) {
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
  await Promise.all(filePaths.map((filePath) => rm(filePath, { force: true })));
}

export async function listJsonFiles(directory: string) {
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
