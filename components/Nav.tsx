"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "สรุป", icon: "📊" },
  { href: "/poles/new", label: "เพิ่มเสา", icon: "➕" },
  { href: "/withdraw", label: "เบิกเสา", icon: "📦" },
  { href: "/piles", label: "ผังกอง", icon: "🧱" },
  { href: "/history", label: "ประวัติ", icon: "🧾" },
  { href: "/sites", label: "จุดกอง", icon: "📍" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login" || path.startsWith("/print")) return null;
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  return (
    <>
      {/* เดสก์ท็อป: แถบบน */}
      <header className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
          <span className="mr-4 text-lg font-bold text-brand">ระบบเบิกเสา</span>
          {items.map((i) => (
            <Link key={i.href} href={i.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${active(i.href) ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {i.icon} {i.label}
            </Link>
          ))}
        </div>
      </header>
      {/* มือถือ: แถบล่าง */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
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
