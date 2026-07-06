import { NextResponse } from "next/server";
import {
  readBinaryFile,
  runtimeAssetAbsolutePath,
  type RuntimeMockCategory,
} from "@/src/server/utils/storage";

export const dynamic = "force-dynamic";

const supportedRuntimeCategories = new Set<RuntimeMockCategory>([
  "maps",
  "routes",
  "posters",
  "videos",
  "runs",
]);

type RuntimeAssetRouteContext = {
  params: Promise<{
    category: string;
    fileName: string;
  }>;
};

function isSafeFileName(fileName: string) {
  return !fileName.includes("..") && !fileName.includes("/") && !fileName.includes("\\");
}

function contentTypeByFileName(fileName: string) {
  if (fileName.endsWith(".png")) {
    return "image/png";
  }
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (fileName.endsWith(".webp")) {
    return "image/webp";
  }
  if (fileName.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (fileName.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (fileName.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (fileName.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }
  return "application/octet-stream";
}

export async function GET(_request: Request, context: RuntimeAssetRouteContext) {
  const { category, fileName } = await context.params;

  if (
    !supportedRuntimeCategories.has(category as RuntimeMockCategory)
    || !isSafeFileName(fileName)
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const filePath = runtimeAssetAbsolutePath(category as RuntimeMockCategory, fileName);
  const content = await readBinaryFile(filePath);

  if (!content) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(content), {
    status: 200,
    headers: {
      "Content-Type": contentTypeByFileName(fileName),
      "Cache-Control": "no-store",
    },
  });
}
