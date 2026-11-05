"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/summary", label: "สรุป", icon: "📊" },
  { href: "/poles/new", label: "เพิ่มเสา", icon: "➕" },
  { href: "/withdraw", label: "เบิกเสา", icon: "📦" },
  { href: "/piles", label: "ผังกอง", icon: "🧱" },
  { href: "/history", label: "ประวัติ", icon: "🧾" },
  { href: "/calendar", label: "ปฏิทิน", icon: "📅" },
  { href: "/sites", label: "จุดกอง", icon: "📍" },
];

function readAreaName() {
  try {
    const m = document.cookie.split("; ").find((c) => c.startsWith("ps_area_name="));
    let v = m ? m.slice(m.indexOf("=") + 1) : "";
    for (let i = 0; i < 3 && /%[0-9A-Fa-f]{2}/.test(v); i++) v = decodeURIComponent(v); // กันกรณีถูก encode ซ้อน
    return v;
  } catch { return ""; }
}

export default function Nav() {
  const path = usePathname();
  const [area, setArea] = useState("");
  useEffect(() => { setArea(readAreaName()); }, [path]);

  // หน้าแรก (เลือกพื้นที่), หน้าเข้าสู่ระบบ และใบเบิกที่พิมพ์ ไม่แสดงเมนู
  if (path === "/" || path === "/login" || path.startsWith("/print")) return null;
  const active = (h: string) => path.startsWith(h);

  const areaChip = (
    <a href="/" className="rounded-full border border-brand/30 bg-brand-light px-3 py-1 text-sm font-medium text-brand-dark" title="เปลี่ยนพื้นที่">
      📍 {area || "เลือกพื้นที่"} <span className="text-xs opacity-70">· เปลี่ยน</span>
    </a>
  );

  return (
    <>
      {/* เดสก์ท็อป: แถบบน */}
      <header className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
          <a href="/" className="mr-3 text-lg font-bold text-brand">ระบบเบิกเสา</a>
          {items.map((i) => (
            <Link key={i.href} href={i.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${active(i.href) ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {i.icon} {i.label}
            </Link>
          ))}
          <Link href="/backup" className={`ml-auto rounded-lg px-3 py-2 text-sm ${active("/backup") ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"}`}>⚙️ สำรองข้อมูล</Link>
          {areaChip}
        </div>
      </header>
      {/* มือถือ: ชื่อพื้นที่ด้านบน + แถบเมนูด้านล่าง */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <a href="/" className="font-bold text-brand">ระบบเบิกเสา</a>
        {areaChip}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map((i) => (
          <Link key={i.href} href={i.href}
            className={`flex flex-col items-center py-2 text-[11px] ${active(i.href) ? "font-bold text-brand" : "text-slate-500"}`}>
            <span className="text-xl leading-none">{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
