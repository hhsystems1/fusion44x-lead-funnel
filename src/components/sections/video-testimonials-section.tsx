import { siteContent } from "@/config/site-content";
import { SectionContainer } from "@/components/ui/section-container";

export function VideoTestimonialsSection() {
  const { testimonials } = siteContent.video_testimonials;

  return (
    <SectionContainer id="video-testimonials" background="white">
      <div className="text-center">
        <h2
          id="video-testimonials-heading"
          className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
        >
          {siteContent.video_testimonials.heading}
        </h2>
        <p className="mt-3 text-neutral-600">
          {siteContent.video_testimonials.subheading}
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {testimonials.map((testimonial, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 bg-brand-surface p-6"
          >
            <div className="mb-3 flex text-brand-aqua" aria-hidden="true">
              {[...Array(5)].map((_, j) => (
                <svg
                  key={j}
                  className="h-4 w-4 fill-current"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote>
              <p className="text-sm leading-relaxed text-brand-navy/80">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
            </blockquote>
            <div className="mt-4 border-t border-neutral-200 pt-3">
              <p className="text-sm font-semibold text-brand-navy">
                {testimonial.name}
              </p>
              <p className="text-xs text-neutral-500">
                {testimonial.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SectionContainer>
  );
}
