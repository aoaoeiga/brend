"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const navItems = [
  { href: "/pos", label: "POS", icon: "🛒" },
  { href: "/menu", label: "メニュー管理", icon: "📋" },
  { href: "/report", label: "売上レポート", icon: "📊" },
  { href: "/history", label: "注文履歴", icon: "📜" },
  { href: "/settings", label: "設定", icon: "⚙️" },
];

export default function Navigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, currentStaff } = useAuth();

  return (
    <div className="flex h-screen relative z-10">
      {/* Sidebar for PC */}
      <aside className="hidden md:flex flex-col w-56 bg-cafe-card border-r border-cafe-accent/20 shadow-cafe">
        <div className="p-4 border-b border-cafe-accent/20">
          <h1 className="text-xl font-bold text-cafe-text font-serif">
            Cafe BRE+ND
          </h1>
          {currentStaff && (
            <p className="text-sm text-cafe-text/60 mt-1">
              👤 {currentStaff.name}
            </p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-cafe text-sm transition-colors ${
                pathname === item.href
                  ? "bg-cafe-button text-white"
                  : "text-cafe-text hover:bg-cafe-accent/10"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-cafe-accent/20">
          <button
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-cafe text-sm text-cafe-danger hover:bg-cafe-danger/10 w-full transition-colors"
          >
            <span className="text-lg">🚪</span>
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>

      {/* Bottom nav for mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-cafe-card border-t border-cafe-accent/20 shadow-cafe-lg z-50">
        <div className="flex justify-around">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-1 text-xs ${
                pathname === item.href
                  ? "text-cafe-accent"
                  : "text-cafe-text/60"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="mt-0.5 truncate max-w-[64px]">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="flex flex-col items-center py-2 px-1 text-xs text-cafe-danger"
          >
            <span className="text-xl">🚪</span>
            <span className="mt-0.5">ログアウト</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
