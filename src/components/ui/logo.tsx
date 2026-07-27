"use client";

import { assets } from "@/config/assets";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  if (assets.logo.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={assets.logo.src}
        alt={assets.logo.alt}
        className={className}
        width={160}
        height={36}
      />
    );
  }

  return (
    <span
      className={`text-lg font-bold tracking-tight text-brand-navy ${className}`}
    >
      {assets.logo.placeholder}
    </span>
  );
}
