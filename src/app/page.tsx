"use client";

import { FunnelProvider } from "@/lib/funnel/funnel-context";
import { Header } from "@/components/sections/header";
import { HeroSection } from "@/components/sections/hero-section";
import { ProofBar } from "@/components/sections/proof-bar";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { ProblemCycleSection } from "@/components/sections/problem-cycle-section";
import { SolutionSection } from "@/components/sections/solution-section";
import { HowFusion44xWorksSection } from "@/components/sections/how-fusion44x-works-section";
import { NextStepSection } from "@/components/sections/next-step-section";
import { FunnelExperience } from "@/components/funnel/funnel-experience";
import { FaqSection } from "@/components/sections/faq-section";
import { StickyAssessmentBar } from "@/components/sections/sticky-assessment-bar";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  return (
    <FunnelProvider>
      <Header />
      <main className="pb-28 sm:pb-32">
        <HeroSection />
        <ProofBar />
        <TestimonialsSection />
        <ProblemCycleSection />
        <SolutionSection />
        <HowFusion44xWorksSection />
        <NextStepSection />
        <FunnelExperience />
        <FaqSection />
      </main>
      <Footer />
      <StickyAssessmentBar />
    </FunnelProvider>
  );
}
