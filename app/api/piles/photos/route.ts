import { NextResponse } from "next/server";
import { pilePhotos } from "@/lib/pile";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// รูปกองเต็ม + รูปหลังขนล่าสุด ของแต่ละกอง   ?site=id1,id2
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("site") || "").split(",").filter(Boolean);
  try {
    return NextResponse.json({ piles: await pilePhotos(ids) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
