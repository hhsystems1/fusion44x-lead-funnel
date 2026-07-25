import { siteContent } from "@/config/site-content";
import { assets } from "@/config/assets";
import { AssetPlaceholder } from "@/components/ui/asset-placeholder";

export function HowFusionWorksSection() {
  const { features } = siteContent.how_fusion_works;

  return (
    <section className="w-full bg-brand-surface px-5 py-16 sm:px-6 sm:py-20 md:px-8" aria-labelledby="hfw-heading">
      <div className="mx-auto max-w-5xl">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="text-center md:text-left">
            <h2
              id="hfw-heading"
              className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
            >
              {siteContent.how_fusion_works.heading}
            </h2>
            <p className="mt-3 text-neutral-600">
              {siteContent.how_fusion_works.subheading}
            </p>

            <div className="mt-8 space-y-5">
              {features.map((feature, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-aqua/10 text-brand-aqua">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-brand-navy">
                      {feature.heading}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      {feature.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {assets.product_photo.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assets.product_photo.src}
                alt={assets.product_photo.alt}
                className="w-full rounded-xl"
              />
            ) : (
              <AssetPlaceholder
                label={assets.product_photo.placeholder}
                aspect="square"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
