import { siteContent } from "@/config/site-content";
import { assets } from "@/config/assets";
import { AssetPlaceholder } from "@/components/ui/asset-placeholder";

export function TestimonialsSection() {
  return (
    <section className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2
            id="testimonials-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {siteContent.testimonials.heading}
          </h2>
          <p className="mt-3 text-neutral-600">
            {siteContent.testimonials.subheading}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {assets.testimonial_videos.map((video, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-brand-surface/30"
            >
              {video.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnail}
                  alt={video.placeholder}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <AssetPlaceholder
                  label={video.placeholder}
                  aspect="video"
                />
              )}
              <div className="p-4">
                {video.customer_name && (
                  <p className="text-sm font-semibold text-brand-navy">
                    {video.customer_name}
                  </p>
                )}
                {video.caption && (
                  <p className="mt-1 text-xs text-neutral-500">
                    {video.caption}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
