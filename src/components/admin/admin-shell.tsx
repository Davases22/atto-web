"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Plans and features", href: "/admin/plans", icon: CreditCard },
  { label: "App logo", href: "/admin/app-logo", icon: ImageIcon },
  { label: "App icons", href: "/admin/app-icons", icon: LayoutGrid },
  { label: "Creator logos", href: "/admin/logos", icon: Shapes },
  { label: "Ads", href: "/admin/ads", icon: Megaphone },
  { label: "Waitlist", href: "/admin/waitlist", icon: ListChecks },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label="ATTO SOUND admin home"
    >
      <Logo className="h-8 w-8 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-wide text-white">
          ATTO SOUND
        </span>
        <span className="text-[11px] uppercase tracking-widest text-neutral-500">
          Admin
        </span>
      </span>
    </Link>
  );
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "bg-white font-medium text-black"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SignOutForm() {
  return (
    <form action="/api/admin/logout" method="post">
      <Button
        type="submit"
        variant="ghost"
        className="w-full justify-start gap-3 px-3 text-neutral-400 hover:text-white"
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </form>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      data-admin-shell
      className="flex min-h-dvh bg-black text-white"
    >
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-neutral-800 bg-black lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavList pathname={pathname} />
        </div>
        <Separator className="bg-neutral-800" />
        <div className="p-3">
          <SignOutForm />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-800 bg-black/95 px-4 py-3 backdrop-blur lg:hidden">
          <Brand />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-black p-0">
              <SheetHeader className="border-b border-neutral-800 px-5 py-5 text-left">
                <SheetTitle className="sr-only">Admin menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Sections of the ATTO SOUND admin
                </SheetDescription>
                <Brand />
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <NavList pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </div>
              <Separator className="bg-neutral-800" />
              <div className="p-3">
                <SignOutForm />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
