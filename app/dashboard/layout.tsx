"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  FileText,
  LayoutDashboard,
  Settings,
  FolderOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "議事録作成", icon: FileText },
  { href: "/dashboard/reference", label: "参考資料", icon: FolderOpen },
  { href: "/dashboard/history", label: "過去の議事録", icon: LayoutDashboard },
  { href: "/dashboard/templates", label: "フォーマット設定", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1
              className="font-semibold text-lg cursor-pointer whitespace-nowrap"
              onClick={() => router.push("/dashboard")}
            >
              FMPJ議事録ツール
            </h1>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => router.push(item.href)}
                    className={isActive ? "font-medium" : ""}
                  >
                    <Icon className="mr-1.5 h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}
