import { NextResponse } from "next/server";
import { callGas, safeSegment } from "@/lib/gas";

export const maxDuration = 60;

// รับรูป (base64, ≤ ~1MB หลังบีบ) → ส่งต่อ Apps Script → Google Drive ตาม folder ที่กำหนด
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.data) return NextResponse.json({ error: "ไม่มีข้อมูลรูป" }, { status: 400 });
    if (b.data.length > 1_700_000)
      return NextResponse.json({ error: "รูปใหญ่เกินไป (ต้องไม่เกิน 1MB)" }, { status: 413 });

    const folderPath = (Array.isArray(b.folder) ? b.folder : []).map(safeSegment);
    const r = await callGas({
      action: "upload",
      folderPath,
      filename: safeSegment(b.filename || "photo.jpg"),
      mimeType: b.mimeType || "image/jpeg",
      data: b.data,
    });
    if (!r.ok) return NextResponse.json({ error: r.error || "Drive error" }, { status: 502 });
    return NextResponse.json({ ok: true, id: r.id, url: r.url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
