"use client";

import { assets } from "@/config/assets";

export function Logo({ className = "" }: { className?: string }) {
  if (assets.logo.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={assets.logo.src}
        alt={assets.logo.alt}
        className={className}
      />
    );
  }

  return (
    <span className={`text-lg font-bold tracking-tight text-brand-navy ${className}`}>
      {assets.logo.placeholder}
    </span>
  );
}
