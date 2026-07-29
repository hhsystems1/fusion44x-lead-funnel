import Image from "next/image";
import { assets } from "@/config/assets";
import { siteContent } from "@/config/site-content";

export function Footer() {
  const { footer } = siteContent;

  return (
    <footer className="w-full border-t border-neutral-200 bg-brand-navy px-5 py-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl text-center">
        {assets.logo.src ? (
          <div className="mx-auto w-[150px]">
            <Image
              src={assets.logo.src}
              alt={assets.logo.alt}
              width={2048}
              height={469}
              className="h-auto w-auto max-w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-sm font-bold tracking-tight text-white">
            {siteContent.company.name}
          </p>
        )}
        <p className="mt-0.5 text-base font-medium text-white/70">{footer.tagline}</p>
        <p className="mt-2 text-sm text-white/40">{footer.supporting_line}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/60">
          <a
            href={`mailto:${footer.support_email}`}
            className="transition-colors hover:text-brand-aqua-light"
          >
            {footer.support_email}
          </a>
          <a
            href={`tel:${footer.support_phone.replace(/[^+\d]/g, "")}`}
            className="transition-colors hover:text-brand-aqua-light"
          >
            {footer.support_phone}
          </a>
        </div>

        <p className="mt-4 text-xs text-white/30">{footer.copyright}</p>
      </div>
    </footer>
  );
}
