const modelImageExtensions = [".png", ".jpg", ".jpeg", ".webp"] as const;

export function canUsePublicImageAsModelInput(publicPath: string) {
  const normalized = publicPath.trim().toLowerCase();
  return modelImageExtensions.some((extension) => normalized.endsWith(extension));
}

export function buildRegenerateImagePublicPaths(params: {
  styleReferencePublicPath: string;
  existingPosterPublicPath: string;
  basedOnExistingImage: boolean;
}) {
  const publicPaths = [params.styleReferencePublicPath];

  if (
    params.basedOnExistingImage &&
    canUsePublicImageAsModelInput(params.existingPosterPublicPath)
  ) {
    publicPaths.unshift(params.existingPosterPublicPath);
  }

  return publicPaths;
}
