"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  FileText,
  LayoutDashboard,
  Settings,
  FolderOpen,
  Brain,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "議事録作成", icon: FileText },
  { href: "/dashboard/reference", label: "参考資料", icon: FolderOpen },
  { href: "/dashboard/learning", label: "学習データ", icon: Brain },
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar flex flex-col z-30">
        {/* Logo */}
        <div className="px-5 h-16 flex items-center border-b border-sidebar-border">
          <h1
            className="font-semibold text-base text-sidebar-accent-foreground cursor-pointer tracking-tight"
            onClick={() => router.push("/dashboard")}
          >
            FMPJ議事録ツール
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  );
}
