export const SHORT_NAME_MAX_LENGTH = 7;

const SHORT_NAME_SEPARATOR_PATTERN = /[·•｜|／/]/;

function trimOuterQuotes(value: string) {
  return value.replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, "");
}

function truncateChars(value: string, maxLength = SHORT_NAME_MAX_LENGTH) {
  return Array.from(value).slice(0, maxLength).join("");
}

export function stripPoiNoise(name: string) {
  return name
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
}

export function buildShortNameSource(name: string) {
  const stripped = stripPoiNoise(name);
  return stripped || name.trim();
}

export function buildMechanicalShortName(
  name: string,
  maxLength = SHORT_NAME_MAX_LENGTH,
) {
  const candidate = buildShortNameSource(name);
  const firstSegment = candidate
    .split(SHORT_NAME_SEPARATOR_PATTERN)
    .map((segment) => segment.trim())
    .find(Boolean);
  const source = firstSegment ?? candidate;

  return truncateChars(source, maxLength) || truncateChars(candidate, maxLength);
}

export function normalizeModelShortNameCandidate(candidate: string) {
  return trimOuterQuotes(candidate).replace(/\s+/g, "").trim();
}

export function validateModelShortName(
  candidate: string,
  canonicalName: string,
  maxLength = SHORT_NAME_MAX_LENGTH,
) {
  const normalized = normalizeModelShortNameCandidate(candidate);
  if (!normalized) {
    return null;
  }

  if (Array.from(normalized).length > maxLength) {
    return null;
  }

  const source = buildShortNameSource(canonicalName);
  const firstSegment = source
    .split(SHORT_NAME_SEPARATOR_PATTERN)
    .map((segment) => segment.trim())
    .find(Boolean);

  const candidates = [canonicalName.trim(), source, firstSegment ?? ""].filter(Boolean);
  if (!candidates.some((item) => item.includes(normalized))) {
    return null;
  }

  return normalized;
}

export function resolveShortName(params: {
  canonicalName: string;
  candidate?: string | null;
}) {
  return (
    validateModelShortName(params.candidate ?? "", params.canonicalName) ??
    buildMechanicalShortName(params.canonicalName)
  );
}
