import { create } from "zustand";
import {
  defaultImageModel,
  type SelectableImageModel,
} from "@/src/config/image-models";
import type { SupportedStyleKey } from "@/src/engine/prompts";

type WorkspaceState = {
  mapName: string;
  city: string;
  style: SupportedStyleKey | "";
  imageModel: SelectableImageModel;
  hydratedDatasetKey: string | null;
  selectedCommentIds: string[];
  initialize: (payload: {
    datasetKey: string;
    mapName: string;
    city: string;
    style: SupportedStyleKey | "";
    imageModel: SelectableImageModel;
    selectedCommentIds: string[];
  }) => void;
  setMapName: (mapName: string) => void;
  setCity: (city: string) => void;
  setStyle: (style: SupportedStyleKey | "") => void;
  setImageModel: (imageModel: SelectableImageModel) => void;
  toggleComment: (commentId: string) => void;
  selectAll: (commentIds: string[]) => void;
  clearSelection: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mapName: "",
  city: "",
  style: "",
  imageModel: defaultImageModel,
  hydratedDatasetKey: null,
  selectedCommentIds: [],
  initialize: (payload) =>
    set({
      hydratedDatasetKey: payload.datasetKey,
      mapName: payload.mapName,
      city: payload.city,
      style: payload.style,
      imageModel: payload.imageModel,
      selectedCommentIds: payload.selectedCommentIds,
    }),
  setMapName: (mapName) => set({ mapName }),
  setCity: (city) => set({ city }),
  setStyle: (style) => set({ style }),
  setImageModel: (imageModel) => set({ imageModel }),
  toggleComment: (commentId) =>
    set((state) => ({
      selectedCommentIds: state.selectedCommentIds.includes(commentId)
        ? state.selectedCommentIds.filter((id) => id !== commentId)
        : [...state.selectedCommentIds, commentId],
    })),
  selectAll: (commentIds) => set({ selectedCommentIds: commentIds }),
  clearSelection: () => set({ selectedCommentIds: [] }),
}));
