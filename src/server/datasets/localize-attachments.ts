import { existsSync } from "node:fs";
import path from "node:path";
import { storagePaths, writeBinaryFile } from "@/src/server/utils/storage";

function inferExtension(sourceUrl: string) {
  const match = sourceUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? `.${match[1].toLowerCase()}` : ".jpeg";
}

export type LocalizedAttachment = {
  sourceUrl: string;
  name: string;
  size?: number;
  localPath: string;
  publicPath: string;
};

export async function localizeAttachment(params: {
  recordId: string;
  attachmentIndex: number;
  sourceUrl: string;
}) {
  const normalizedSourceUrl = params.sourceUrl.replace(/\\u0026/g, "&").trim();
  if (!normalizedSourceUrl) {
    return null;
  }

  const extension = inferExtension(normalizedSourceUrl);
  const fileName = `${params.recordId}_${params.attachmentIndex + 1}${extension}`;
  const absolutePath = path.join(storagePaths.comments, fileName);
  const publicPath = `/mock/files/comments/${fileName}`;
  const localPath = path.join("public", "mock", "files", "comments", fileName);

  let size;
  if (!existsSync(absolutePath)) {
    const response = await fetch(normalizedSourceUrl);
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeBinaryFile(absolutePath, buffer);
    size = buffer.length;
  }

  const attachment: LocalizedAttachment = {
    sourceUrl: normalizedSourceUrl,
    name: fileName,
    size,
    localPath,
    publicPath,
  };

  return attachment;
}

export async function localizeAttachments(params: {
  recordId: string;
  sourceUrls: string[];
}) {
  const results: LocalizedAttachment[] = [];

  for (const [index, sourceUrl] of params.sourceUrls.entries()) {
    const attachment = await localizeAttachment({
      recordId: params.recordId,
      attachmentIndex: index,
      sourceUrl,
    });
    if (attachment) {
      results.push(attachment);
    }
  }

  return results;
}
