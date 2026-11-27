import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { scopedSites } from "@/lib/area";
import { pilePhotos } from "@/lib/pile";
import { buildInventory, InvBlock, InvSheet, InvRow } from "@/lib/inventory";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

const FONT = "TH SarabunPSK";
const HEADER_LINES = process.env.INVENTORY_HEADER || "คลังพัสดุ นครพนม โรงงาน D060";

// ขนาดรูป (px) จาก JPEG/PNG
function imgInfo(b: Buffer): { ext: "jpeg" | "png"; w: number; h: number } | null {
  try {
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { ext: "png", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { ext: "jpeg", w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + b.readUInt16BE(i + 2);
      }
      return { ext: "jpeg", w: 4, h: 3 };
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
}

async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export async function GET() {
  const s = db();
  const { data: sites, error: e1 } = await scopedSites("id,name,zone,pile").order("name");
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const { data: sizes, error: e2 } = await s.from("pole_sizes").select("id,name,sort_order");
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  const ids = (sites || []).map((x: any) => x.id as string);
  if (ids.length === 0) return NextResponse.json({ error: "ไม่มีจุดกองในพื้นที่นี้" }, { status: 404 });

  // เสาที่ยังคงเหลือ
  const poles: any[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await s.from("poles").select("pole_no,tier,pos,kind,site_id,size_id")
        .in("site_id", ids.slice(i, i + 40)).eq("status", "available").order("id").range(from, from + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      poles.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }

  const sheets: InvSheet[] = buildInventory(sites || [], sizes || [], poles);
  if (sheets.length === 0) return NextResponse.json({ error: "ไม่มีเสาคงเหลือ" }, { status: 404 });

  // รูปล่าสุดของแต่ละกอง (รูปกองเต็ม หรือรูปหลังขนล่าสุด อันไหนใหม่กว่า)
  const siteIds: string[] = Array.from(new Set<string>(sheets.flatMap((sh: InvSheet) => sh.blocks.map((b: InvBlock) => b.siteId))));
  const phs = await pilePhotos(siteIds);
  const urlOf = new Map<string, string>();
  for (const id of siteIds) {
    const p = phs[id]; const cand: { at: number; url: string }[] = [];
    if (p?.full?.url) cand.push({ at: +new Date(p.full.at), url: p.full.url });
    if (p?.after?.photos?.[0]?.url) cand.push({ at: +new Date(p.after.at), url: p.after.photos[0].url });
    cand.sort((a, b) => b.at - a.at);
    if (cand[0]) urlOf.set(id, cand[0].url);
  }
  const imgs = new Map<string, { buf: Buffer; ext: "jpeg" | "png"; w: number; h: number }>();
  await mapLimit(Array.from(urlOf.entries()), 6, async ([id, url]) => {
    const buf = await fetchImage(url); if (!buf) return;
    const info = imgInfo(buf); if (!info) return;
    imgs.set(id, { buf, ...info });
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "ระบบเบิกเสา";
  const thin = { style: "thin" as const };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const font = (b = false) => ({ name: FONT, size: 14, bold: b });
  const PHOTO_ROWS = 15, ROW_H = 21, PHOTO_W_MAX = 560, PHOTO_H_MAX = PHOTO_ROWS * ROW_H * 4 / 3 - 8;
  const D_PX = 98.43 * 7 + 5;

  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name, {
      pageSetup: {
        paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.2, right: 0.2, top: 0.9, bottom: 0.5, header: 0.3, footer: 0.3 },
        printTitlesRow: "1:1", horizontalCentered: true,
      },
      headerFooter: {
        oddHeader: `&C${HEADER_LINES}\nรายละเอียดประกอบการตรวจนับพัสดุประเภท  ผลิตภัณฑ์คอนกรีต\nสถานที่จัดเก็บ ${sh.place}&R&P/&N`,
      },
    });
    const widths = [4.43, 14.14, 14.43, 98.43, 10.71, 15.71, 10.71, 37.57];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const head = ws.addRow(["ที่", "รหัสพัสดุ", "รายการ", "หมายเลข / No.เสา", "แบทช์", "ยี่ห้อผลิตภัณฑ์", "จำนวน", "ข้อตรวจพบการจัดเก็บพัสดุ"]);
    head.height = 24;
    head.eachCell((c: any) => { c.font = font(true); c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = border; });

    const cell = (r: ExcelJS.Row, col: number, v: any, align: "center" | "left" = "center") => {
      const c = r.getCell(col); c.value = v; c.font = font(); c.border = border;
      c.alignment = { horizontal: align, vertical: "middle", wrapText: true };
    };
    const sig = (text: string, h = ROW_H) => {
      const r = ws.addRow([text]); ws.mergeCells(r.number, 1, r.number, 8);
      r.height = h; const c = r.getCell(1); c.font = font(); c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    };

    sh.blocks.forEach((b: InvBlock, bi: number) => {
      let sub = 0;
      b.rows.forEach((row: InvRow, ri: number) => {
        const r = ws.addRow([]);
        const lines = Math.max(1, Math.ceil(row.nos.length / 78));
        r.height = ROW_H * lines + (ri === 0 && b.item.length > 20 ? ROW_H : 0);
        cell(r, 1, ri === 0 ? b.seq : null); cell(r, 2, ri === 0 ? b.code : null);
        cell(r, 3, ri === 0 ? b.item : null, "left"); cell(r, 4, row.nos);
        cell(r, 5, b.batch); cell(r, 6, null); cell(r, 7, row.count);
        cell(r, 8, ri === 0 ? b.point : null);
        sub += row.count;
      });
      const tot = ws.addRow([]); tot.height = ROW_H;
      for (let c = 1; c <= 8; c++) cell(tot, c, null);
      tot.getCell(6).value = "รวม"; tot.getCell(6).font = font(true);
      tot.getCell(7).value = sub; tot.getCell(7).font = font(true);
      if (bi === sh.blocks.length - 1) {
        const all = ws.addRow([]); all.height = ROW_H;
        for (let c = 1; c <= 8; c++) cell(all, c, null);
        all.getCell(5).value = "รวมทั้งหมด"; all.getCell(5).font = font(true);
        all.getCell(7).value = sh.total; all.getCell(7).font = font(true);
      }

      // พื้นที่รูป
      const firstPhotoRow = ws.rowCount + 1;
      for (let i = 0; i < PHOTO_ROWS; i++) ws.addRow([]).height = ROW_H;
      const im = imgs.get(b.siteId);
      if (im) {
        const k = Math.min(PHOTO_W_MAX / im.w, PHOTO_H_MAX / im.h, 1.6);
        const w = Math.round(im.w * k), h = Math.round(im.h * k);
        const id = wb.addImage({ buffer: im.buf as any, extension: im.ext });
        ws.addImage(id, { tl: { col: 3 + Math.max(0, (D_PX - w) / 2 / D_PX), row: firstPhotoRow - 1 + 0.2 }, ext: { width: w, height: h } });
      }

      sig("ลงชื่อ ................................................ ประธาน");
      sig("         ( นายไชย์พิชิต โป๊ะประนม )  ชก.บษ.(ฉ1)");
      sig("", 10);
      sig("ลงชื่อ ................................................ กรรมการ                ลงชื่อ ................................................ กรรมการ                   ลงชื่อ ................................................ กรรมการ");
      sig("          ( นางมาธินีย์ แสนนาม ) รจก.กฟจ.สน.                       ( นายณรงฤทธิ์ นันทพันธ์ ) วศก.8 กฟจ.สน..                 ( นางจิฬวตี เงาะปก ) ชก.บพ.(ฉ1)");
      if (bi < sh.blocks.length - 1) ws.getRow(ws.rowCount).addPageBreak();
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const fname = `เอกสารตรวจนับพัสดุ_${d}.xlsx`;
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory_${d}.xlsx"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      "Cache-Control": "no-store",
    },
  });
}
