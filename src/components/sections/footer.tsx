import { assets } from "@/config/assets";
import { siteContent } from "@/config/site-content";

export function Footer() {
  const { footer } = siteContent;

  return (
    <footer className="w-full border-t border-neutral-200 bg-brand-navy px-5 py-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl text-center">
        {assets.logo.src_white ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assets.logo.src_white}
            alt={assets.logo.alt}
            className="mx-auto h-auto w-auto object-contain"
            width={300}
            height={300}
          />
        ) : (
          <p className="text-sm font-bold tracking-tight text-white">
            {siteContent.company.name}
          </p>
        )}
        <p className="mt-1 text-sm text-white/50">{footer.tagline}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/60">
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
