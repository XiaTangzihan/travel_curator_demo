import { NextResponse } from "next/server";
import { listRunTraces } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await listRunTraces();
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "读取 run 列表失败" },
      { status: 500 },
    );
  }
}
