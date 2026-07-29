"use client";

import { useState, useCallback } from "react";
import { FunnelProvider } from "@/lib/funnel/funnel-context";
import { Header } from "@/components/sections/header";
import { HeroSection } from "@/components/sections/hero-section";
import { ProofBar } from "@/components/sections/proof-bar";
import { EducationSection } from "@/components/sections/education-section";
import { ChemicalCycleSection } from "@/components/sections/chemical-cycle-section";
import { HowFusionWorksSection } from "@/components/sections/how-fusion-works-section";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { FunnelExperience } from "@/components/funnel/funnel-experience";
import { FaqSection } from "@/components/sections/faq-section";
import { StickyAssessmentBar } from "@/components/sections/sticky-assessment-bar";
import { HowItWorksModal } from "@/components/sections/how-it-works-modal";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  const [hiwOpen, setHiwOpen] = useState(false);

  const openHiw = useCallback(() => setHiwOpen(true), []);
  const closeHiw = useCallback(() => setHiwOpen(false), []);

  return (
    <FunnelProvider>
      <Header />
      <main className="pb-20 sm:pb-24">
        <HeroSection onHowItWorksClick={openHiw} />
        <ProofBar />
        <TestimonialsSection />
        <EducationSection />
        <ChemicalCycleSection />
        <HowFusionWorksSection />
        <FunnelExperience />
        <FaqSection />
      </main>
      <Footer />
      <StickyAssessmentBar />
      <HowItWorksModal isOpen={hiwOpen} onClose={closeHiw} />
    </FunnelProvider>
  );
}
