import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const publicDir = path.join(/* turbopackIgnore: true */ process.cwd(), "public");
const mockDir = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "mock");

export const storagePaths = {
  publicDir,
  mockDir,
  raw: path.join(mockDir, "raw"),
  events: path.join(mockDir, "events"),
  routes: path.join(mockDir, "routes"),
  posters: path.join(mockDir, "posters"),
  videos: path.join(mockDir, "videos"),
  maps: path.join(mockDir, "maps"),
  runs: path.join(mockDir, "runs"),
  files: path.join(mockDir, "files"),
  comments: path.join(mockDir, "files", "comments"),
} as const;

export function toPublicPath(filePath: string) {
  const relative = path.relative(publicDir, filePath).split(path.sep).join("/");
  return `/${relative}`;
}

export function fromPublicPath(publicPath: string) {
  const relative = publicPath.replace(/^\/+/, "");
  return path.join(publicDir, relative);
}

export async function ensureStorageDirectories() {
  const directories = Object.values(storagePaths).filter((value) =>
    value.startsWith(mockDir),
  );

  await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
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
