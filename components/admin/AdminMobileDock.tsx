"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GyIcon from "./GyIcon";

const items = [
  { href: "/admin", label: "홈", icon: "command" },
  { href: "/admin/shorts-hub", label: "쇼츠", icon: "play" },
  { href: "/admin/content-factory", label: "블로그", icon: "factory" },
  { href: "/admin/products", label: "상품", icon: "box" },
  { href: "/admin/connections", label: "연결", icon: "link" },
];

function activePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/products") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminMobileDock() {
  const pathname = usePathname();
  return (
    <nav className="admin-mobile-dock" aria-label="모바일 빠른 메뉴">
      {items.map((item) => {
        const active = activePath(pathname, item.href);
        return <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}><GyIcon name={item.icon} /><span>{item.label}</span></Link>;
      })}
    </nav>
  );
}
