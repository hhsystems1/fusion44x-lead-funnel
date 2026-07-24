import { siteContent } from "@/config/site-content";
import { SectionContainer } from "@/components/ui/section-container";

export function VideoTestimonialsSection() {
  return (
    <SectionContainer id="video-testimonials" background="light">
      <div className="text-center">
        <h2
          id="video-testimonials-heading"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {siteContent.video_testimonials.heading}
        </h2>
        <p className="mt-3 text-neutral-600">
          {siteContent.video_testimonials.subheading}
        </p>
        <div className="mt-8 flex aspect-video items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-100 p-8">
          <p className="text-center text-sm text-neutral-500">
            {siteContent.video_testimonials.placeholder}
          </p>
        </div>
      </div>
    </SectionContainer>
  );
}
