import { create } from "zustand";

type WorkspaceState = {
  mapName: string;
  city: string;
  style: string;
  selectedCommentIds: string[];
  initialize: (payload: {
    mapName: string;
    city: string;
    style: string;
    selectedCommentIds: string[];
  }) => void;
  setMapName: (mapName: string) => void;
  toggleComment: (commentId: string) => void;
  selectAll: (commentIds: string[]) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mapName: "",
  city: "广州",
  style: "young-cartoon",
  selectedCommentIds: [],
  initialize: (payload) => set(payload),
  setMapName: (mapName) => set({ mapName }),
  toggleComment: (commentId) =>
    set((state) => ({
      selectedCommentIds: state.selectedCommentIds.includes(commentId)
        ? state.selectedCommentIds.filter((id) => id !== commentId)
        : [...state.selectedCommentIds, commentId],
    })),
  selectAll: (commentIds) => set({ selectedCommentIds: commentIds }),
}));
