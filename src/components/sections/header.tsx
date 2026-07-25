"use client";

import { Logo } from "@/components/ui/logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-6 md:px-8">
        <Logo className="text-base" />
      </div>
    </header>
  );
}
