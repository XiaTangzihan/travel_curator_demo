/* eslint-disable @next/next/no-img-element */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileHome } from "@/src/features/profile/profile-home";

const replaceMock = vi.fn();

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.unoptimized;
    delete rest.fill;
    return <img alt={String(rest.alt ?? "")} {...rest} />;
  },
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => (
    <a href={String(props.href ?? "#")}>{props.children as React.ReactNode}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
}));

describe("ProfileHome", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("勾选有视频后会把 hasVideo=1 写入 URL，并保留其他筛选参数", () => {
    render(
      <ProfileHome
        maps={[]}
        rawCount={0}
        activeDatasetKey="hangzhou"
        activeImageModel="all"
        activeStyle="storybook"
        activeHasVideo={false}
        datasetOptions={[{ key: "hangzhou", city: "杭州" }]}
        imageModelOptions={[]}
        styleOptions={[{ key: "storybook", label: "绘本插画风" }]}
      />,
    );

    fireEvent.click(screen.getByLabelText("有视频"));

    expect(replaceMock).toHaveBeenCalledWith("/?dataset=hangzhou&style=storybook&hasVideo=1", {
      scroll: false,
    });
  });
});
