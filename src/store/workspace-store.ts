import { create } from "zustand";
import type { SupportedStyleKey } from "@/src/engine/prompts";

type WorkspaceState = {
  mapName: string;
  city: string;
  style: SupportedStyleKey | "";
  selectedCommentIds: string[];
  initialize: (payload: {
    mapName: string;
    city: string;
    style: SupportedStyleKey | "";
    selectedCommentIds: string[];
  }) => void;
  setMapName: (mapName: string) => void;
  setCity: (city: string) => void;
  setStyle: (style: SupportedStyleKey | "") => void;
  toggleComment: (commentId: string) => void;
  selectAll: (commentIds: string[]) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mapName: "",
  city: "",
  style: "",
  selectedCommentIds: [],
  initialize: (payload) => set(payload),
  setMapName: (mapName) => set({ mapName }),
  setCity: (city) => set({ city }),
  setStyle: (style) => set({ style }),
  toggleComment: (commentId) =>
    set((state) => ({
      selectedCommentIds: state.selectedCommentIds.includes(commentId)
        ? state.selectedCommentIds.filter((id) => id !== commentId)
        : [...state.selectedCommentIds, commentId],
    })),
  selectAll: (commentIds) => set({ selectedCommentIds: commentIds }),
}));
