import { z } from "zod";

export const mapStatusSchema = z.enum(["draft", "confirmed", "failed"]);
export const runStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "incomplete",
]);

export const rawAttachmentSchema = z.object({
  fileToken: z.string(),
  name: z.string(),
  size: z.number().optional(),
  localPath: z.string(),
  publicPath: z.string(),
});

export const rawReviewSchema = z.object({
  recordId: z.string(),
  createdAt: z.string(),
  sourceDay: z.string().optional().default(""),
  sourceTime: z.string().optional().default(""),
  commentText: z.string().default(""),
  poiName: z.string(),
  poiLocation: z.string(),
  poiProvince: z.string(),
  poiCity: z.string(),
  poiDistrict: z.string(),
  categoryL1: z.string(),
  categoryL2: z.string(),
  categoryL3: z.string(),
  attachments: z.array(rawAttachmentSchema),
});

export const rawDatasetSnapshotSchema = z.object({
  datasetId: z.string(),
  authorName: z.string(),
  source: z.object({
    baseToken: z.string(),
    tableId: z.string(),
    viewId: z.string(),
  }),
  syncedAt: z.string(),
  reviews: z.array(rawReviewSchema),
});

export const eventPictureSchema = z.object({
  url: z.string(),
  name: z.string().optional(),
});

export const eventRecordSchema = z.object({
  eventId: z.string(),
  commentId: z.string(),
  sequence: z.number().int().positive().optional(),
  day: z.string(),
  time: z.string(),
  commentText: z.string(),
  commentPictures: z.array(eventPictureSchema),
  canonicalName: z.string().optional(),
  shortName: z.string().optional(),
  poiName: z.string(),
  poiLocation: z.string(),
  poiProvince: z.string(),
  poiCity: z.string(),
  poiDistrict: z.string(),
  categoryL1: z.string(),
  categoryL2: z.string(),
  categoryL3: z.string(),
  authorName: z.string(),
});

export const preprocessReportSchema = z.object({
  totalInput: z.number(),
  totalOutput: z.number(),
  warnings: z.array(z.string()),
  generatedAt: z.string(),
});

export const eventsSnapshotSchema = z.object({
  datasetId: z.string(),
  generatedAt: z.string(),
  report: preprocessReportSchema,
  events: z.array(eventRecordSchema),
});

export const landmarkSchema = z.object({
  name: z.string(),
  visual: z.string(),
});

export const routeArtifactSchema = z.object({
  markdown: z.string(),
  generatedAt: z.string(),
});

export const mapRecordSchema = z.object({
  mapId: z.string(),
  mapName: z.string(),
  city: z.string(),
  style: z.string(),
  status: mapStatusSchema,
  eventCount: z.number(),
  routePath: z.string(),
  posterPath: z.string(),
  knowledgePath: z.string(),
  currentRunId: z.string(),
  selectedCommentIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastInstruction: z.string().optional(),
});

export const mapNodeSchema = z.object({
  eventId: z.string(),
  day: z.string(),
  time: z.string(),
  title: z.string(),
  excerpt: z.string(),
  thumbnail: z.string().optional(),
});

export const mapViewModelSchema = z.object({
  mapId: z.string(),
  mapName: z.string(),
  city: z.string(),
  style: z.string(),
  posterPath: z.string(),
  routeMarkdown: z.string(),
  selectedEventId: z.string(),
  generatedAt: z.string(),
  knowledge: z.array(landmarkSchema),
  nodes: z.array(mapNodeSchema),
  events: z.array(eventRecordSchema),
});

export const runArtifactPathsSchema = z.object({
  rawPath: z.string().optional(),
  eventsPath: z.string().optional(),
  routePath: z.string().optional(),
  posterPath: z.string().optional(),
  mapPath: z.string().optional(),
});

export const runInputSummarySchema = z.object({
  mapName: z.string(),
  city: z.string(),
  selectedCommentCount: z.number(),
});

export const runTraceSchema = z.object({
  runId: z.string(),
  mapId: z.string(),
  status: runStatusSchema,
  stage: z.enum(["preprocess", "generate", "regenerate", "confirm"]),
  basedOnExistingImage: z.boolean().optional(),
  promptInstruction: z.string().optional(),
  styleKey: z.string().optional(),
  inputSummary: runInputSummarySchema.optional(),
  warnings: z.array(z.string()),
  artifacts: runArtifactPathsSchema,
  providerMode: z.enum(["live", "fallback"]).default("live"),
  errorMessage: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
});

export type RawAttachment = z.infer<typeof rawAttachmentSchema>;
export type RawReview = z.infer<typeof rawReviewSchema>;
export type RawDatasetSnapshot = z.infer<typeof rawDatasetSnapshotSchema>;
export type EventRecord = z.infer<typeof eventRecordSchema>;
export type EventsSnapshot = z.infer<typeof eventsSnapshotSchema>;
export type PreprocessReport = z.infer<typeof preprocessReportSchema>;
export type Landmark = z.infer<typeof landmarkSchema>;
export type RouteArtifact = z.infer<typeof routeArtifactSchema>;
export type MapRecord = z.infer<typeof mapRecordSchema>;
export type MapNode = z.infer<typeof mapNodeSchema>;
export type MapViewModel = z.infer<typeof mapViewModelSchema>;
export type RunInputSummary = z.infer<typeof runInputSummarySchema>;
export type RunTrace = z.infer<typeof runTraceSchema>;
