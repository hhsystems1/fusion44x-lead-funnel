import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

describe("page section order", () => {
  const pageContent = readFileSync(
    path.join(ROOT, "src/app/page.tsx"),
    "utf-8",
  );

  it("renders Header before HeroSection", () => {
    const headerIdx = pageContent.indexOf("<Header />");
    const heroIdx = pageContent.indexOf("<HeroSection");
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(heroIdx).toBeGreaterThan(headerIdx);
  });

  it("renders ProofBar after HeroSection", () => {
    const heroIdx = pageContent.indexOf("<HeroSection");
    const proofIdx = pageContent.indexOf("<ProofBar");
    expect(proofIdx).toBeGreaterThan(heroIdx);
  });

  it("renders TestimonialsSection after ProofBar", () => {
    const proofIdx = pageContent.indexOf("<ProofBar");
    const testIdx = pageContent.indexOf("<TestimonialsSection");
    expect(testIdx).toBeGreaterThan(proofIdx);
  });

  it("renders ProblemCycleSection after TestimonialsSection", () => {
    const testIdx = pageContent.indexOf("<TestimonialsSection");
    const probIdx = pageContent.indexOf("<ProblemCycleSection");
    expect(probIdx).toBeGreaterThan(testIdx);
  });

  it("renders SolutionSection after ProblemCycleSection", () => {
    const probIdx = pageContent.indexOf("<ProblemCycleSection");
    const solIdx = pageContent.indexOf("<SolutionSection");
    expect(solIdx).toBeGreaterThan(probIdx);
  });

  it("renders HowFusion44xWorksSection after SolutionSection", () => {
    const solIdx = pageContent.indexOf("<SolutionSection");
    const hiwIdx = pageContent.indexOf("<HowFusion44xWorksSection");
    expect(hiwIdx).toBeGreaterThan(solIdx);
  });

  it("renders NextStepSection after HowFusion44xWorksSection", () => {
    const hiwIdx = pageContent.indexOf("<HowFusion44xWorksSection");
    const nsIdx = pageContent.indexOf("<NextStepSection");
    expect(nsIdx).toBeGreaterThan(hiwIdx);
  });

  it("renders FunnelExperience after NextStepSection", () => {
    const nsIdx = pageContent.indexOf("<NextStepSection");
    const funnelIdx = pageContent.indexOf("<FunnelExperience");
    expect(funnelIdx).toBeGreaterThan(nsIdx);
  });

  it("renders FaqSection after FunnelExperience", () => {
    const funnelIdx = pageContent.indexOf("<FunnelExperience");
    const faqIdx = pageContent.indexOf("<FaqSection");
    expect(faqIdx).toBeGreaterThan(funnelIdx);
  });

  it("renders Footer after FaqSection", () => {
    const faqIdx = pageContent.indexOf("<FaqSection");
    const footerIdx = pageContent.indexOf("<Footer />");
    expect(footerIdx).toBeGreaterThan(faqIdx);
  });

  it("has the correct consolidated section order", () => {
    const order = [
      "<Header />",
      "<HeroSection",
      "<ProofBar",
      "<TestimonialsSection",
      "<ProblemCycleSection",
      "<SolutionSection",
      "<HowFusion44xWorksSection",
      "<NextStepSection",
      "<FunnelExperience",
      "<FaqSection",
      "<Footer />",
    ];
    let lastIndex = -1;
    for (const tag of order) {
      const idx = pageContent.indexOf(tag);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("contact information appears after diagnostic completion in the funnel flow", () => {
    const funnelExperience = readFileSync(
      path.join(ROOT, "src/components/funnel/funnel-experience.tsx"),
      "utf-8",
    );
    const diagIdx = funnelExperience.indexOf("POOL_DIAGNOSTIC");
    const contactIdx = funnelExperience.indexOf("CONTACT_INFORMATION");
    expect(contactIdx).toBeGreaterThan(diagIdx);
  });

  it("includes the sticky assessment bar", () => {
    expect(pageContent).toContain("<StickyAssessmentBar />");
  });

  it("adds bottom padding to main for sticky bar clearance", () => {
    expect(pageContent).toMatch(/pb-\d+/);
  });

  it("does not render the old EducationSection", () => {
    expect(pageContent).not.toContain("EducationSection");
  });

  it("does not render the old HowFusionWorksSection", () => {
    expect(pageContent).not.toContain("HowFusionWorksSection");
  });

  it("does not render the old HowItWorksModal", () => {
    expect(pageContent).not.toContain("HowItWorksModal");
  });
});

describe("hero content", () => {
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it("hero headline is not a question (no question mark)", () => {
    const headingMatch = siteContent.match(/heading:\s*"([^"]+)"/);
    if (headingMatch) {
      expect(headingMatch[1]).not.toContain("?");
    }
  });

  it('does not contain "The problem may be the chemical cycle itself"', () => {
    expect(siteContent).not.toContain(
      "The problem may be the chemical cycle itself",
    );
  });

  it("uses the approved hero heading", () => {
    expect(siteContent).toContain(
      "Cleaner, More Comfortable Pool Water",
    );
  });

  it("hero eyebrow is Fusion44X Hydro-pH-Infusion System", () => {
    expect(siteContent).toContain("Fusion44X Hydro-pH-Infusion System");
  });

  it("hero secondary CTA is See How Fusion44X Works", () => {
    expect(siteContent).toContain("See How Fusion44X Works");
  });
});

describe("proof line", () => {
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it("customerCountVerified is false by default", () => {
    expect(siteContent).toContain("customerCountVerified: false");
  });

  it("does not display 1,000+ in the default line", () => {
    expect(siteContent).toContain(
      "Trusted by pool and spa owners looking for a different way to care for their water",
    );
  });

  it("verified line contains 1,000+", () => {
    expect(siteContent).toContain("1,000+");
  });
});

describe("testimonial content", () => {
  const testimonialsContent = readFileSync(
    path.join(ROOT, "src/components/sections/testimonials-section.tsx"),
    "utf-8",
  );
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it('does not contain "More customer stories coming soon"', () => {
    expect(testimonialsContent).not.toContain("More customer stories coming soon");
  });

  it("references the eyebrow from config", () => {
    expect(testimonialsContent).toContain("siteContent.testimonials.eyebrow");
  });

  it("references the heading from config", () => {
    expect(testimonialsContent).toContain("siteContent.testimonials.heading");
  });

  it("config contains the eyebrow Real Pool Owners. Real Experiences.", () => {
    expect(siteContent).toContain("Real Pool Owners. Real Experiences.");
  });

  it("config contains heading Why Families Choose Fusion44X", () => {
    expect(siteContent).toContain("Why Families Choose Fusion44X");
  });
});

describe("combined problem and chemical cycle section", () => {
  const problemCycleContent = readFileSync(
    path.join(ROOT, "src/components/sections/problem-cycle-section.tsx"),
    "utf-8",
  );
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it("references problem cards from config", () => {
    expect(problemCycleContent).toContain("problems");
    expect(problemCycleContent).toContain("siteContent.problem_cycle");
    expect(siteContent).toContain("Recurring Algae");
    expect(siteContent).toContain("Constant Chemical Balancing");
    expect(siteContent).toContain("Harsh-Feeling Water");
    expect(siteContent).toContain("Questions About What Is in the Water");
  });

  it("references chemical cycle steps from config", () => {
    expect(problemCycleContent).toContain("chemical_cycle_steps");
    expect(siteContent).toContain("Test");
    expect(siteContent).toContain("Add");
    expect(siteContent).toContain("Wait");
    expect(siteContent).toContain("React");
    expect(siteContent).toContain("Test Again");
  });

  it("renders the belief-shifting line from config", () => {
    expect(siteContent).toContain("If the same water keeps needing");
  });

  it("has one CTA for the combined section", () => {
    const ctaCount = (problemCycleContent.match(/<CtaButton /g) || []).length;
    expect(ctaCount).toBe(1);
  });
});

describe("combined solution section", () => {
  const solutionContent = readFileSync(
    path.join(ROOT, "src/components/sections/solution-section.tsx"),
    "utf-8",
  );
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it("references solution body copy from config", () => {
    expect(solutionContent).toContain("siteContent.solution.body");
    expect(siteContent).toContain("Fusion44X is not another chemical");
  });

  it("references benefits from config", () => {
    expect(solutionContent).toContain("siteContent.solution.benefits");
    expect(siteContent).toContain("Move away from chlorine");
    expect(siteContent).toContain("Move away from saltwater");
    expect(siteContent).toContain("Reduce the traditional chemical routine");
    expect(siteContent).toContain("Retrofit compatible");
  });

  it("renders the qualification line from config", () => {
    expect(solutionContent).toContain("siteContent.solution.qualification");
    expect(siteContent).toContain("Compatibility, installation requirements");
  });

  it("has one CTA", () => {
    const ctaCount = (solutionContent.match(/<CtaButton /g) || []).length;
    expect(ctaCount).toBe(1);
  });
});

describe("how fusion44x works product section", () => {
  const hiwContent = readFileSync(
    path.join(ROOT, "src/components/sections/how-fusion44x-works-section.tsx"),
    "utf-8",
  );
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it('has the id "how-it-works"', () => {
    expect(hiwContent).toContain('id="how-it-works"');
  });

  it("references heading from config", () => {
    expect(hiwContent).toContain("siteContent.how_fusion44x_works.heading");
    expect(siteContent).toContain("How Hydro-pH-Infusion Works");
  });

  it("renders all 6 product callouts from config", () => {
    expect(hiwContent).toContain("callouts");
    expect(hiwContent).toContain("siteContent.how_fusion44x_works");
    expect(siteContent).toContain("Probe Cap");
    expect(siteContent).toContain("Fusion44X Probe");
    expect(siteContent).toContain("Treatment Container");
    expect(siteContent).toContain("Digital Meter and Controller");
    expect(siteContent).toContain("Pool Equipment Connection");
    expect(siteContent).toContain("Pump Runtime");
  });

  it("renders system facts from config", () => {
    expect(hiwContent).toContain("system_facts");
    expect(siteContent).toContain("Hydrogen bubbles generated through electrolysis");
    expect(siteContent).toContain("Supports a pH range of 7.2");
    expect(siteContent).toContain("Annual probe replacement");
    expect(siteContent).toContain("Compatible with many existing pool systems");
  });

  it("uses the correct Fusion44X diagram image, not product-image.jpg", () => {
    expect(hiwContent).toContain("how_it_works_diagram");
    expect(hiwContent).not.toContain("product_photo");
    expect(hiwContent).not.toContain("product-image.jpg");
  });

  it("has SVG connector lines with numbered markers on desktop", () => {
    expect(hiwContent).toContain("<polyline");
    expect(hiwContent).toContain("markers");
    expect(hiwContent).toContain('viewBox="0 0 1024 1536"');
  });

  it("SVG overlay is hidden on mobile", () => {
    expect(hiwContent).toContain("hidden h-full w-full md:block");
  });

  it("mobile version removes connector lines (SVG className has hidden + md:block)", () => {
    expect(hiwContent).toContain("hidden h-full w-full md:block");
  });

  it("uses lucide-react icons in facts row", () => {
    expect(hiwContent).toContain("lucide-react");
  });
});

describe("next step section (renamed from how it works)", () => {
  const nextStepContent = readFileSync(
    path.join(ROOT, "src/components/sections/next-step-section.tsx"),
    "utf-8",
  );
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it("references eyebrow from config", () => {
    expect(nextStepContent).toContain("siteContent.next_step.eyebrow");
    expect(siteContent).toContain("Your Next Step");
  });

  it("references heading from config", () => {
    expect(nextStepContent).toContain("siteContent.next_step.heading");
    expect(siteContent).toContain("Start With Your Free Pool Assessment");
  });

  it("references steps from config", () => {
    expect(nextStepContent).toContain("siteContent.next_step");
    expect(siteContent).toContain("Tell Us About Your Pool");
    expect(siteContent).toContain("We Review Your Setup");
    expect(siteContent).toContain("Review Your Options");
  });

  it("does not call itself How It Works", () => {
    expect(nextStepContent).not.toContain("How It Works");
  });

  it("CTA is from config", () => {
    expect(nextStepContent).toContain("siteContent.next_step.cta");
    expect(siteContent).toContain("Start My Free Assessment");
  });
});

describe("brand assets", () => {
  it("icon.png exists as the favicon", () => {
    const iconPath = path.join(ROOT, "src/app/icon.png");
    expect(existsSync(iconPath)).toBe(true);
  });

  it("icon.png has reasonable file size", () => {
    const iconPath = path.join(ROOT, "src/app/icon.png");
    const stat = statSync(iconPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThan(1_000_000);
  });

  it("apple-icon.png exists for Apple touch icon", () => {
    const appleIconPath = path.join(ROOT, "src/app/apple-icon.png");
    expect(existsSync(appleIconPath)).toBe(true);
  });

  it("logo PNG exists at the permanent brand path", () => {
    const logoPath = path.join(ROOT, "public/brand/fusion44x-logo.png");
    expect(existsSync(logoPath)).toBe(true);
  });

  it("logo PNG has reasonable file size", () => {
    const logoPath = path.join(ROOT, "public/brand/fusion44x-logo.png");
    const stat = statSync(logoPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThan(10_000_000);
  });

  it("logo PNG dimensions are trimmed (not original 2048x2048)", () => {
    const logoPath = path.join(ROOT, "public/brand/fusion44x-logo.png");
    const content = readFileSync(logoPath);
    const width = content.readUInt32BE(16);
    const height = content.readUInt32BE(20);
    expect(width).toBeGreaterThan(100);
    expect(height).toBeGreaterThan(10);
    expect(width * height).toBeLessThan(2048 * 2048);
  });
});

describe("asset configuration", () => {
  const assetsContent = readFileSync(
    path.join(ROOT, "src/config/assets.ts"),
    "utf-8",
  );

  it("logo src points to the permanent brand path", () => {
    expect(assetsContent).toContain("/brand/fusion44x-logo.png");
  });

  it("favicon src points to the brand path", () => {
    expect(assetsContent).toContain("/brand/fusion44x-favicon.png");
  });

  it("product_photo src points to product-image.jpg", () => {
    expect(assetsContent).toContain("/brand/product-image.jpg");
  });
});

describe("header configuration", () => {
  const headerContent = readFileSync(
    path.join(ROOT, "src/components/sections/header.tsx"),
    "utf-8",
  );

  it("does not use sticky positioning", () => {
    expect(headerContent).not.toContain("sticky");
  });

  it("uses relative positioning for normal flow", () => {
    expect(headerContent).toContain("relative");
  });

  it("displays 775-600-5305 phone number", () => {
    expect(headerContent).toContain("775-600-5305");
  });

  it("uses tel:+17756005305 for phone links", () => {
    expect(headerContent).toContain("tel:+17756005305");
  });

  it("has a Schedule a Call button", () => {
    expect(headerContent).toContain("Schedule a Call");
  });

  it("Schedule a Call scrolls to the funnel viewport", () => {
    expect(headerContent).toContain("funnel-viewport");
    expect(headerContent).toContain("scrollIntoView");
  });

  it("Schedule a Call preserves the current funnel step", () => {
    expect(headerContent).toContain("state.current_step");
    expect(headerContent).toContain("goToStep");
  });

  it("renders the Logo component", () => {
    expect(headerContent).toContain("<Logo");
  });

  it("Logo uses responsive sizing (mobile smaller, desktop larger)", () => {
    expect(headerContent).toMatch(/h-\d+/);
  });
});

describe("footer configuration", () => {
  const footerContent = readFileSync(
    path.join(ROOT, "src/components/sections/footer.tsx"),
    "utf-8",
  );

  it("renders the logo image in the footer", () => {
    expect(footerContent).toContain("<img");
    expect(footerContent).toContain("assets.logo.src");
  });

  it("constrains footer logo max width", () => {
    expect(footerContent).toContain("max-w-");
  });

  it("uses width auto for responsive sizing", () => {
    expect(footerContent).toContain("w-auto");
  });
});

describe("logo component", () => {
  const logoContent = readFileSync(
    path.join(ROOT, "src/components/ui/logo.tsx"),
    "utf-8",
  );

  it("uses the assets config for logo source", () => {
    expect(logoContent).toContain("assets.logo.src");
  });

  it("provides proper alt text from config", () => {
    expect(logoContent).toContain("assets.logo.alt");
  });

  it("uses object-contain for aspect ratio preservation", () => {
    expect(logoContent).toContain("object-contain");
  });

  it("constrains logo size via max-h classes", () => {
    expect(logoContent).toContain("max-h-");
  });
});

describe("sticky assessment bar", () => {
  const barContent = readFileSync(
    path.join(ROOT, "src/components/sections/sticky-assessment-bar.tsx"),
    "utf-8",
  );

  it("uses fixed positioning at the bottom", () => {
    expect(barContent).toContain("fixed");
    expect(barContent).toContain("bottom-0");
  });

  it("hides on confirmation stage", () => {
    expect(barContent).toContain("CONFIRMATION");
    expect(barContent).toContain("return null");
  });

  it("scrolls to the funnel viewport on click", () => {
    expect(barContent).toContain("funnel-viewport");
    expect(barContent).toContain("scrollIntoView");
  });

  it("preserves the current funnel step", () => {
    expect(barContent).toContain("state.current_step");
    expect(barContent).toContain("goToStep");
  });

  it("displays the CTA question text", () => {
    expect(barContent).toContain("Ready to take your free pool assessment?");
  });

  it("displays the Start Now button", () => {
    expect(barContent).toContain("Start Now");
  });

  it("includes safe-area padding for iPhone", () => {
    expect(barContent).toContain("safe-area-inset-bottom");
  });

  it("uses a floating pill shape on desktop", () => {
    expect(barContent).toContain("rounded-2xl");
    expect(barContent).toContain("max-w-");
  });

  it("is full width on mobile", () => {
    expect(barContent).toContain("inset-x-0");
  });

  it("only shows on scroll down (scroll-based visibility)", () => {
    expect(barContent).toContain("addEventListener");
    expect(barContent).toContain("scroll");
    expect(barContent).toContain("passive");
  });

  it("hides at the top of the page (scrollY > 5)", () => {
    expect(barContent).toContain("scrollY > 5");
  });

  it("hides near the bottom of the page", () => {
    expect(barContent).toContain("maxScroll");
  });
});

describe("FAQ section accessibility", () => {
  const faqContent = readFileSync(
    path.join(ROOT, "src/components/sections/faq-section.tsx"),
    "utf-8",
  );

  it("uses aria-expanded on accordion buttons", () => {
    expect(faqContent).toContain("aria-expanded");
  });

  it("uses aria-controls on accordion buttons", () => {
    expect(faqContent).toContain("aria-controls");
  });

  it("has role=region on answer panels", () => {
    expect(faqContent).toContain('role="region"');
  });

  it("has aria-labelledby on answer panels", () => {
    expect(faqContent).toContain("aria-labelledby");
  });

  it("uses an h2 heading with id for the section", () => {
    expect(faqContent).toContain("faq-heading");
    expect(faqContent).toContain("<h2");
  });

  it("has aria-labelledby on the section element", () => {
    expect(faqContent).toContain('aria-labelledby="faq-heading"');
  });

  it("has an id=faq on the section", () => {
    expect(faqContent).toContain('id="faq"');
  });

  it("uses grid-based animation for smooth expand/collapse", () => {
    expect(faqContent).toContain("gridTemplateRows");
  });

  it("has the CTA button", () => {
    expect(faqContent).toContain("Get Your Free Pool Assessment");
  });

  it("CTA scrolls to the funnel viewport", () => {
    expect(faqContent).toContain("funnel-viewport");
    expect(faqContent).toContain("scrollIntoView");
  });

  it("CTA preserves the current funnel step", () => {
    expect(faqContent).toContain("state.current_step");
    expect(faqContent).toContain("goToStep");
  });
});

describe("diagnostic transition text", () => {
  const siteContent = readFileSync(
    path.join(ROOT, "src/config/site-content.ts"),
    "utf-8",
  );

  it("uses updated complete_label text", () => {
    expect(siteContent).toContain(
      "Your assessment is complete. Enter your details to view the recommended next step and available consultation times.",
    );
  });

  it("does not contain old complete_label text", () => {
    expect(siteContent).not.toContain(
      "Assessment complete \u2014 enter your details to see your recommendation",
    );
  });
});

describe("backend files not modified", () => {
  it("booking config still retains 30-minute appointments", () => {
    const bookingConfig = readFileSync(
      path.join(ROOT, "src/config/booking.ts"),
      "utf-8",
    );
    expect(bookingConfig).toContain("30");
  });

  it("booking config retains America/New_York timezone", () => {
    const bookingConfig = readFileSync(
      path.join(ROOT, "src/config/booking.ts"),
      "utf-8",
    );
    expect(bookingConfig).toContain("America/New_York");
  });

  it("funnel context still uses createBookingRequest", () => {
    const funnelContext = readFileSync(
      path.join(ROOT, "src/lib/funnel/funnel-context.tsx"),
      "utf-8",
    );
    expect(funnelContext).toContain("createBookingRequest");
  });

  it("funnel context still uses submitLeadApi", () => {
    const funnelContext = readFileSync(
      path.join(ROOT, "src/lib/funnel/funnel-context.tsx"),
      "utf-8",
    );
    expect(funnelContext).toContain("submitLeadApi");
  });

  it("diagnostic question config is unchanged", () => {
    const diagConfig = readFileSync(
      path.join(ROOT, "src/config/funnel-questions.ts"),
      "utf-8",
    );
    expect(diagConfig).toContain("water-feature");
    expect(diagConfig).toContain("installation-type");
    expect(diagConfig).toContain("pool-size");
    expect(diagConfig).toContain("current-treatment");
    expect(diagConfig).toContain("current-issues");
    expect(diagConfig).toContain("primary-goal");
  });

  it("funnel types are unchanged", () => {
    const funnelTypes = readFileSync(
      path.join(ROOT, "src/types/funnel.ts"),
      "utf-8",
    );
    expect(funnelTypes).toContain("FUNNEL_STEPS");
    expect(funnelTypes).toContain("POOL_DIAGNOSTIC");
    expect(funnelTypes).toContain("CONTACT_INFORMATION");
    expect(funnelTypes).toContain("BOOKING");
    expect(funnelTypes).toContain("CONFIRMATION");
  });
});
