import type { ReactNode } from "react";

interface SectionContainerProps {
  id?: string;
  children: ReactNode;
  className?: string;
  background?: "white" | "light" | "dark" | "brand";
  as?: "section" | "div";
  labelledBy?: string;
}

const bgMap = {
  white: "bg-white",
  light: "bg-brand-surface",
  dark: "bg-brand-navy text-white",
  brand: "bg-brand-blue text-white",
};

export function SectionContainer({
  id,
  children,
  className = "",
  background = "white",
  as: Tag = "section",
  labelledBy,
}: SectionContainerProps) {
  return (
    <Tag
      id={id}
      className={`w-full px-5 py-16 sm:px-6 sm:py-24 md:px-8 ${bgMap[background]} ${className}`}
      aria-labelledby={labelledBy}
    >
      <div className="mx-auto max-w-3xl">{children}</div>
    </Tag>
  );
}
