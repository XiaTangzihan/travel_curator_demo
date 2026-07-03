import { describe, expect, it } from "vitest";
import {
  buildRegenerateImagePublicPaths,
  canUsePublicImageAsModelInput,
} from "@/src/engine/pipelines/model-image-inputs";

describe("model-image-inputs", () => {
  it("在基于旧图修改时把旧底片图插到参考图前面", () => {
    expect(
      buildRegenerateImagePublicPaths({
        styleReferencePublicPath: "/ui-static/styles/young-cartoon.jpeg",
        existingPosterPublicPath: "/mock/posters/map_001.png",
        basedOnExistingImage: true,
      }),
    ).toEqual([
      "/mock/posters/map_001.png",
      "/ui-static/styles/young-cartoon.jpeg",
    ]);
  });

  it("会过滤掉不适合作为模型图片输入的 svg 旧底片", () => {
    expect(canUsePublicImageAsModelInput("/mock/posters/map_001.svg")).toBe(false);
    expect(
      buildRegenerateImagePublicPaths({
        styleReferencePublicPath: "/ui-static/styles/young-cartoon.jpeg",
        existingPosterPublicPath: "/mock/posters/map_001.svg",
        basedOnExistingImage: true,
      }),
    ).toEqual(["/ui-static/styles/young-cartoon.jpeg"]);
  });
});
