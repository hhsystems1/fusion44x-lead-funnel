import { siteContent } from "@/config/site-content";

export function Footer() {
  const { footer } = siteContent;

  return (
    <footer className="w-full border-t border-neutral-200 bg-white px-5 py-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-tight text-brand-navy">
          {siteContent.company.name}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {footer.tagline}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
          <a
            href={`mailto:${footer.support_email}`}
            className="hover:text-brand-aqua transition-colors"
          >
            {footer.support_email}
          </a>
          <a
            href={`tel:${footer.support_phone.replace(/[^+\d]/g, "")}`}
            className="hover:text-brand-aqua transition-colors"
          >
            {footer.support_phone}
          </a>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-400">
          <span>{footer.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
