import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { scopedSites } from "@/lib/area";
import { pilePhotos } from "@/lib/pile";
import { buildInventory, cleanSigners, DEFAULT_SIGNERS, Signers, Person, InvBlock, InvSheet, InvRow } from "@/lib/inventory";

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

export async function GET() { return build(DEFAULT_SIGNERS); }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  return build(cleanSigners(b?.signers));
}

async function build(sg: Signers) {
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
  const DSUB = 24.6, DSUB_PX = Math.floor(DSUB * 7 + 5), D_PX = DSUB_PX * 4; // คอลัมน์ D แบ่งเป็น 4 ช่องย่อย (รวมเซลล์ในตาราง) เพื่อจัดช่องลงชื่อให้ชิดกัน

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
    const widths = [4.43, 14.14, 14.43, DSUB, DSUB, DSUB, DSUB, 10.71, 15.71, 10.71, 37.57];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const head = ws.addRow(["ที่", "รหัสพัสดุ", "รายการ", "หมายเลข / No.เสา", null, null, null, "แบทช์", "ยี่ห้อผลิตภัณฑ์", "จำนวน", "ข้อตรวจพบการจัดเก็บพัสดุ"]);
    ws.mergeCells(head.number, 4, head.number, 7);
    head.height = 24;
    head.eachCell({ includeEmpty: true }, (c: any) => { c.font = font(true); c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = border; });

    const NC = 11; // จำนวนคอลัมน์ทั้งหมด
    const cell = (r: ExcelJS.Row, col: number, v: any, align: "center" | "left" = "center") => {
      const c = r.getCell(col); c.value = v; c.font = font(); c.border = border;
      c.alignment = { horizontal: align, vertical: "middle", wrapText: true };
    };
    sh.blocks.forEach((b: InvBlock, bi: number) => {
      let sub = 0;
      b.rows.forEach((row: InvRow, ri: number) => {
        const r = ws.addRow([]);
        const lines = Math.max(1, Math.ceil(row.nos.length / 78));
        r.height = ROW_H * lines + (ri === 0 && b.item.length > 20 ? ROW_H : 0);
        for (let c = 1; c <= NC; c++) cell(r, c, null);
        ws.mergeCells(r.number, 4, r.number, 7);
        cell(r, 1, ri === 0 ? b.seq : null); cell(r, 2, ri === 0 ? b.code : null);
        cell(r, 3, ri === 0 ? b.item : null, "left"); cell(r, 4, row.nos);
        cell(r, 8, b.batch); cell(r, 10, row.count);
        cell(r, 11, ri === 0 ? b.point : null);
        sub += row.count;
      });
      const tot = ws.addRow([]); tot.height = ROW_H;
      for (let c = 1; c <= NC; c++) cell(tot, c, null);
      ws.mergeCells(tot.number, 4, tot.number, 7);
      tot.getCell(9).value = "รวม"; tot.getCell(9).font = font(true);
      tot.getCell(10).value = sub; tot.getCell(10).font = font(true);
      if (bi === sh.blocks.length - 1) {
        const all = ws.addRow([]); all.height = ROW_H;
        for (let c = 1; c <= NC; c++) cell(all, c, null);
        ws.mergeCells(all.number, 4, all.number, 7);
        const e = all.getCell(8); e.value = "รวมทั้งหมด"; e.font = font(true); e.alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };
        ws.mergeCells(all.number, 9, all.number, 11);
        const t = all.getCell(9);
        t.value = sh.blocks.length > 1 ? `${sh.blocks.map((x: InvBlock) => x.total).join(" + ")} = ${sh.total}` : String(sh.total);
        t.font = font(true); t.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
        all.height = ROW_H * Math.max(1, Math.ceil(String(t.value).length / 55));
      }

      // พื้นที่รูป
      const firstPhotoRow = ws.rowCount + 1;
      // แถวว่างพร้อมเส้นตาราง (เหมือนต้นฉบับ) สำหรับวางรูป
      for (let i = 0; i < PHOTO_ROWS; i++) {
        const pr = ws.addRow([]); pr.height = ROW_H;
        for (let c = 1; c <= NC; c++) pr.getCell(c).border = border;
        ws.mergeCells(pr.number, 4, pr.number, 7);
      }
      const im = imgs.get(b.siteId);
      if (im) {
        const k = Math.min(PHOTO_W_MAX / im.w, PHOTO_H_MAX / im.h, 1.6);
        const w = Math.round(im.w * k), h = Math.round(im.h * k);
        const id = wb.addImage({ buffer: im.buf as any, extension: im.ext });
        const areaH = PHOTO_ROWS * ROW_H * 4 / 3;
        ws.addImage(id, {
          tl: { nativeCol: 3 + Math.floor(Math.max(0, (D_PX - w) / 2) / DSUB_PX), nativeColOff: Math.round((Math.max(0, (D_PX - w) / 2) % DSUB_PX) * 9525), nativeRow: firstPhotoRow - 1, nativeRowOff: Math.round(Math.max(0, (areaH - h) / 2) * 9525) },
          ext: { width: w, height: h }, editAs: "oneCell",
        } as any);
      }

      // ช่องลงชื่อ: แต่ละคนอยู่ในช่องรวมเซลล์ของตัวเอง จัดกึ่งกลาง → ชื่อ/ตำแหน่งตรงกับเส้นลงชื่อเสมอ
      // ช่วงคอลัมน์: A:C · D1:D2 · D3:D4 (กรรมการ 3 คนชิดกัน) · ขวา F:H
      const place = (r: ExcelJS.Row, c1: number, c2: number, text: string) => {
        if (c2 > c1) ws.mergeCells(r.number, c1, r.number, c2);
        const c = r.getCell(c1); c.value = text || null; c.font = { name: FONT, size: 14 };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      };
      const lineOf = (role: string) => `ลงชื่อ ................................ ${role}`;
      // ความสูงแถว: บรรทัดเดียวถ้าข้อความพอดีช่อง (จำกัดตัวอักษรตามความกว้างช่อง) ไม่งั้นขึ้นบรรทัดที่ 2
      const LIM = [30, 46, 46, 55];
      const heightFor = (cols: number[], ...t: string[]) => (t.some((x, k) => x.length > LIM[cols[k] ?? 0]) ? 36 : 19);
      const trio = (cols: [number, number][], texts: string[], h = 19) => {
        const r = ws.addRow([]); r.height = h;
        cols.forEach((c, k) => place(r, c[0], c[1], texts[k] || ""));
      };
      const L: [number, number] = [1, 3], M: [number, number] = [4, 5], R1: [number, number] = [6, 7], R2: [number, number] = [9, 11];
      ws.addRow([]).height = 18; // เว้นช่องไฟระหว่างตารางกับช่องลงชื่อ
      // แถวบน: ประธาน (ซ้าย) · ผู้ควบคุมพัสดุ (ขวา)
      trio([L, R2], [lineOf("ประธาน"), lineOf("ผู้ควบคุมพัสดุ")]);
      trio([L, R2], [`( ${sg.chair.name} )`, `( ${sg.controller.name} )`], heightFor([0, 3], sg.chair.name, sg.controller.name));
      trio([L, R2], [sg.chair.pos, sg.controller.pos], heightFor([0, 3], sg.chair.pos, sg.controller.pos));
      ws.addRow([]).height = 10;
      // แถวล่าง: กรรมการ 3 คน · หัวหน้าแผนก (ขวา)
      const m = sg.members;
      trio([L, M, R1, R2], [lineOf("กรรมการ"), lineOf("กรรมการ"), lineOf("กรรมการ"), lineOf("หัวหน้าแผนก")]);
      const names = [`( ${m[0].name} )`, `( ${m[1].name} )`, `( ${m[2].name} )`, `( ${sg.head.name} )`];
      trio([L, M, R1, R2], names, heightFor([0, 1, 2, 3], ...names));
      const poss = [m[0].pos, m[1].pos, m[2].pos, sg.head.pos];
      trio([L, M, R1, R2], poss, heightFor([0, 1, 2, 3], ...poss));
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
