import { siteContent } from "@/config/site-content";
import { SectionContainer } from "@/components/ui/section-container";

export function HowItWorksSection() {
  const { steps } = siteContent.how_it_works;

  return (
    <SectionContainer id="how-it-works" background="white">
      <div className="text-center">
        <h2
          id="how-it-works-heading"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {siteContent.how_it_works.heading}
        </h2>
        <p className="mt-3 text-neutral-600">
          {siteContent.how_it_works.subheading}
        </p>
      </div>
      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={i} className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-lg font-bold text-white">
              {i + 1}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{step.heading}</h3>
            <p className="mt-2 text-sm text-neutral-600">{step.text}</p>
          </div>
        ))}
      </div>
    </SectionContainer>
  );
}
