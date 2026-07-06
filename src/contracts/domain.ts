import { z } from "zod";
import { supportedDatasetKeys } from "@/src/config/demo";
import {
  persistedImageModelKeys,
  selectableImageModelKeys,
} from "@/src/config/image-models";
import {
  persistedVideoModelKeys,
  selectableVideoModelKeys,
} from "@/src/config/video-models";

export const mapStatusSchema = z.enum(["draft", "confirmed", "failed"]);
export const runStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "incomplete",
]);
export const datasetKeySchema = z.enum(supportedDatasetKeys);
export const imageModelSchema = z.enum(persistedImageModelKeys);
export const selectableImageModelSchema = z.enum(selectableImageModelKeys);
export const videoModelSchema = z.enum(persistedVideoModelKeys);
export const selectableVideoModelSchema = z.enum(selectableVideoModelKeys);

export const rawAttachmentSchema = z.object({
  sourceUrl: z.string(),
  name: z.string(),
  size: z.number().optional(),
  localPath: z.string(),
  publicPath: z.string(),
});

export const rawReviewSchema = z.object({
  recordId: z.string(),
  sourceReviewId: z.string(),
  sourceRowNumber: z.number().int().positive().optional(),
  createdAt: z.string(),
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

export const rawSheetSourceSchema = z.object({
  type: z.literal("sheet"),
  spreadsheetToken: z.string(),
  sheetId: z.string(),
  sheetName: z.string(),
  url: z.string().optional(),
  adapterVersion: z.string(),
});

export const rawDatasetSnapshotSchema = z.object({
  datasetKey: datasetKeySchema,
  datasetId: z.string(),
  authorName: z.string(),
  source: rawSheetSourceSchema,
  syncedAt: z.string(),
  reviews: z.array(rawReviewSchema),
});

export const eventPictureSchema = z.object({
  url: z.string(),
  name: z.string().optional(),
});

export const eventVisualBriefSchema = z.object({
  shortName: z.string().trim().min(1).max(32),
  subject: z.string().trim().min(1),
  avoid: z.array(z.string().trim().min(1)).min(3).max(5),
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
  subject: z.string().trim().min(1).optional(),
  avoid: z.array(z.string().trim().min(1)).min(3).max(5).optional(),
  authorName: z.string(),
});

export const preprocessReportSchema = z.object({
  totalInput: z.number(),
  totalOutput: z.number(),
  warnings: z.array(z.string()),
  generatedAt: z.string(),
});

export const eventsSnapshotSchema = z.object({
  datasetKey: datasetKeySchema,
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

export const parsedRouteEventSchema = z.object({
  dayIndex: z.number().int().positive(),
  day: z.string().min(1),
  sequence: z.number().int().positive(),
  headingTitle: z.string().min(1),
  poi: z.string().min(1),
  shortName: z.string().min(1),
  category: z.string().min(1),
  commentText: z.string(),
  imagePath: z.string().min(1),
  subject: z.string().trim().min(1),
  avoid: z.array(z.string().trim().min(1)).min(3).max(5),
});

export const parsedRouteSchema = z
  .object({
    mapName: z.string().min(1),
    city: z.string().min(1),
    styleLabel: z.string().min(1),
    days: z.number().int().positive(),
    eventCount: z.number().int().nonnegative(),
    knowledgeCount: z.number().int().nonnegative(),
    importantRules: z.array(z.string().trim().min(1)).min(1),
    events: z.array(parsedRouteEventSchema),
  })
  .superRefine((value, ctx) => {
    if (value.events.length !== value.eventCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "route 事件数量与 event_count 不一致",
      });
    }

    const sequenceSet = new Set<number>();
    for (const event of value.events) {
      if (sequenceSet.has(event.sequence)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `route 中存在重复 sequence: ${event.sequence}`,
        });
      }
      sequenceSet.add(event.sequence);
    }
  });

export const posterVersionSchema = z.object({
  versionId: z.string(),
  posterPath: z.string(),
  runId: z.string(),
  imageModel: imageModelSchema.optional().default("unknown"),
  createdAt: z.string(),
  instruction: z.string().optional(),
  basedOnExistingImage: z.boolean().optional(),
});

export const mapRecordSchema = z.object({
  mapId: z.string(),
  datasetKey: datasetKeySchema.optional().default("guangzhou"),
  mapName: z.string(),
  city: z.string(),
  style: z.string(),
  isFavorite: z.boolean().optional().default(false),
  imageModel: imageModelSchema.optional().default("unknown"),
  currentVideoRunId: z.string().optional(),
  videoPath: z.string().optional(),
  videoDurationSeconds: z.number().int().positive().optional(),
  videoUpdatedAt: z.string().optional(),
  videoModel: videoModelSchema.optional().default("unknown"),
  status: mapStatusSchema,
  eventCount: z.number(),
  routePath: z.string(),
  posterPath: z.string(),
  knowledgePath: z.string(),
  currentRunId: z.string(),
  posterVersions: z.array(posterVersionSchema).optional().default([]),
  selectedPosterVersionId: z.string().optional(),
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
  datasetKey: datasetKeySchema.optional().default("guangzhou"),
  mapName: z.string(),
  city: z.string(),
  style: z.string(),
  isFavorite: z.boolean().optional().default(false),
  imageModel: imageModelSchema.optional().default("unknown"),
  currentVideoRunId: z.string().optional(),
  videoPath: z.string().optional(),
  videoDurationSeconds: z.number().int().positive().optional(),
  videoUpdatedAt: z.string().optional(),
  videoModel: videoModelSchema.optional().default("unknown"),
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
  videoPath: z.string().optional(),
  mapPath: z.string().optional(),
});

export const runProgressStepSchema = z.enum([
  "preparing",
  "rendering",
  "finalizing",
]);

export const runDriveStateSchema = z.object({
  phase: runProgressStepSchema.optional().default("preparing"),
  leaseExpiresAt: z.string().optional(),
});

export const generateRunInputSchema = z.object({
  datasetKey: datasetKeySchema.optional().default("guangzhou"),
  mapName: z.string(),
  city: z.string(),
  style: z.string(),
  imageModel: selectableImageModelSchema.optional(),
  selectedCommentIds: z.array(z.string()).min(1),
});

export const regenerateRunInputSchema = z.object({
  mapId: z.string(),
  mode: z.enum(["variant", "edit"]),
  instruction: z.string().default(""),
  imageModel: selectableImageModelSchema.optional(),
  selectedPosterPath: z.string(),
  selectedCommentIds: z.array(z.string()).min(1),
});

export const runInputSummarySchema = z.object({
  datasetKey: datasetKeySchema.optional().default("guangzhou"),
  mapName: z.string(),
  city: z.string(),
  selectedCommentCount: z.number(),
});

export const runTraceSchema = z.object({
  runId: z.string(),
  mapId: z.string(),
  datasetKey: datasetKeySchema.optional().default("guangzhou"),
  status: runStatusSchema,
  stage: z.enum(["preprocess", "generate", "regenerate", "confirm", "video_generate"]),
  imageModel: imageModelSchema.optional().default("unknown"),
  videoModel: videoModelSchema.optional().default("unknown"),
  providerTaskId: z.string().optional(),
  videoDurationSeconds: z.number().int().positive().optional(),
  basedOnExistingImage: z.boolean().optional(),
  promptInstruction: z.string().optional(),
  styleKey: z.string().optional(),
  promptVersion: z.string().optional(),
  referenceIds: z.array(z.string()).optional(),
  progressStep: runProgressStepSchema.optional(),
  updatedAt: z.string().optional(),
  previewImagePaths: z.array(z.string()).optional(),
  generateInput: generateRunInputSchema.optional(),
  regenerateInput: regenerateRunInputSchema.optional(),
  inputSummary: runInputSummarySchema.optional(),
  driveState: runDriveStateSchema.optional(),
  warnings: z.array(z.string()),
  artifacts: runArtifactPathsSchema,
  providerMode: z.enum(["live", "fallback"]).default("live"),
  errorMessage: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
});

export const curatedMapImportModeSchema = z.enum(["favorite_preload", "manual"]);
export const curatedMapImportAssetKindSchema = z.enum([
  "map_record",
  "rendered_map",
  "route_markdown",
  "knowledge",
  "poster",
  "video",
  "run",
]);

export const curatedMapImportAssetSchema = z.object({
  kind: curatedMapImportAssetKindSchema,
  label: z.string(),
  path: z.string(),
  required: z.boolean(),
  exists: z.boolean(),
});

export const curatedMapImportEntrySchema = z.object({
  mapId: z.string(),
  mapName: z.string().optional(),
  datasetKey: datasetKeySchema.optional(),
  selectionReason: z.enum(["favorite", "explicit"]),
  hasVideo: z.boolean(),
  ready: z.boolean(),
  runIds: z.array(z.string()),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  assets: z.array(curatedMapImportAssetSchema),
});

export const curatedMapImportReportSchema = z.object({
  mode: curatedMapImportModeSchema,
  dryRun: z.boolean(),
  targetRoot: z.string().optional(),
  expectedCount: z.number().int().positive().optional(),
  totalRequested: z.number().int().nonnegative(),
  totalSelected: z.number().int().nonnegative(),
  readyCount: z.number().int().nonnegative(),
  mapsWithVideo: z.number().int().nonnegative(),
  mapsWithoutVideo: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  entries: z.array(curatedMapImportEntrySchema),
  appliedAt: z.string().optional(),
});

export type RawAttachment = z.infer<typeof rawAttachmentSchema>;
export type RawReview = z.infer<typeof rawReviewSchema>;
export type RawDatasetSnapshot = z.infer<typeof rawDatasetSnapshotSchema>;
export type EventVisualBrief = z.infer<typeof eventVisualBriefSchema>;
export type EventRecord = z.infer<typeof eventRecordSchema>;
export type EventsSnapshot = z.infer<typeof eventsSnapshotSchema>;
export type PreprocessReport = z.infer<typeof preprocessReportSchema>;
export type Landmark = z.infer<typeof landmarkSchema>;
export type RouteArtifact = z.infer<typeof routeArtifactSchema>;
export type ParsedRouteEvent = z.infer<typeof parsedRouteEventSchema>;
export type ParsedRoute = z.infer<typeof parsedRouteSchema>;
export type PosterVersion = z.infer<typeof posterVersionSchema>;
export type MapRecord = z.infer<typeof mapRecordSchema>;
export type MapNode = z.infer<typeof mapNodeSchema>;
export type MapViewModel = z.infer<typeof mapViewModelSchema>;
export type RunProgressStep = z.infer<typeof runProgressStepSchema>;
export type ImageModel = z.infer<typeof imageModelSchema>;
export type SelectableImageModel = z.infer<typeof selectableImageModelSchema>;
export type VideoModel = z.infer<typeof videoModelSchema>;
export type SelectableVideoModel = z.infer<typeof selectableVideoModelSchema>;
export type GenerateRunInput = z.infer<typeof generateRunInputSchema>;
export type RegenerateRunInput = z.infer<typeof regenerateRunInputSchema>;
export type RunInputSummary = z.infer<typeof runInputSummarySchema>;
export type RunDriveState = z.infer<typeof runDriveStateSchema>;
export type RunTrace = z.infer<typeof runTraceSchema>;
export type CuratedMapImportMode = z.infer<typeof curatedMapImportModeSchema>;
export type CuratedMapImportAssetKind = z.infer<typeof curatedMapImportAssetKindSchema>;
export type CuratedMapImportAsset = z.infer<typeof curatedMapImportAssetSchema>;
export type CuratedMapImportEntry = z.infer<typeof curatedMapImportEntrySchema>;
export type CuratedMapImportReport = z.infer<typeof curatedMapImportReportSchema>;
