"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Shield, Settings as SettingsIcon } from "@/components/icons";

export default function Navbar() {
  const pathname = usePathname();
  const [currentPath, setCurrentPath] = useState<string>("/analyze");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname) {
      setCurrentPath(pathname);
    }
  }, [pathname]);

  const navItems = [
    { name: "Analyze", href: "/analyze" },
    { name: "Datasets", href: "/datasets" },
    { name: "Reports", href: "/reports" },
  ];

  const isActive = (href: string) => {
    if (href === "/analyze") {
      return currentPath === "/" || currentPath === "/analyze" || currentPath.startsWith("/analyze/");
    }
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Brand */}
          <div className="flex items-center">
            <Link
              href="/analyze"
              className="flex items-center gap-2 text-neutral-900 hover:text-black transition-colors"
            >
              <Shield className="w-5 h-5 text-neutral-900" strokeWidth={2.2} />
              <span className="font-semibold text-base tracking-tight text-neutral-900">
                PII Guard
              </span>
            </Link>
          </div>

          {/* Center: Main Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm transition-colors rounded-md ${
                    active
                      ? "text-neutral-900 font-semibold bg-neutral-100"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right: Settings & Status */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/settings"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded-md ${
                isActive("/settings")
                  ? "text-neutral-900 font-semibold bg-neutral-100"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              <SettingsIcon className="w-4 h-4 text-neutral-500" />
              <span>Settings</span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              type="button"
              className="p-1.5 text-neutral-700 hover:text-neutral-900 border border-neutral-200 rounded"
              aria-label="Toggle Navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileOpen && (
          <div className="md:hidden py-2 border-t border-neutral-200 flex flex-col gap-1 pb-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2 text-sm rounded ${
                  isActive(item.href)
                    ? "font-semibold text-neutral-900 bg-neutral-100"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2 text-sm rounded flex items-center gap-2 ${
                isActive("/settings")
                  ? "font-semibold text-neutral-900 bg-neutral-100"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
