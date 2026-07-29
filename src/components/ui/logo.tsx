import Image from "next/image";
import { assets } from "@/config/assets";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  if (assets.logo.src) {
    return (
      <Image
        src={assets.logo.src}
        alt={assets.logo.alt}
        width={2048}
        height={469}
        className={`max-h-10 w-auto object-contain sm:max-h-12 ${className}`}
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
