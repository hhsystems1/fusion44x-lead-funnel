import { FunnelProvider } from "@/lib/funnel/funnel-context";
import { HeroSection } from "@/components/sections/hero-section";
import { VideoTestimonialsSection } from "@/components/sections/video-testimonials-section";
import { HowItWorksSection } from "@/components/sections/how-it-works-section";
import { PoolDiagnosticSection } from "@/components/sections/pool-diagnostic-section";
import { ContactSection } from "@/components/sections/contact-section";
import { BookingSection } from "@/components/booking/booking-section";
import { ConfirmationPlaceholder } from "@/components/sections/confirmation-placeholder";

export default function Home() {
  return (
    <FunnelProvider>
      <HeroSection />
      <VideoTestimonialsSection />
      <HowItWorksSection />
      <PoolDiagnosticSection />
      <ContactSection />
      <BookingSection />
      <ConfirmationPlaceholder />
    </FunnelProvider>
  );
}
