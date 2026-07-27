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

  it("renders EducationSection after TestimonialsSection", () => {
    const testIdx = pageContent.indexOf("<TestimonialsSection");
    const eduIdx = pageContent.indexOf("<EducationSection");
    expect(eduIdx).toBeGreaterThan(testIdx);
  });

  it("renders HowFusionWorksSection after EducationSection", () => {
    const eduIdx = pageContent.indexOf("<EducationSection");
    const hfwIdx = pageContent.indexOf("<HowFusionWorksSection");
    expect(hfwIdx).toBeGreaterThan(eduIdx);
  });

  it("renders FunnelExperience after HowFusionWorksSection", () => {
    const hfwIdx = pageContent.indexOf("<HowFusionWorksSection");
    const funnelIdx = pageContent.indexOf("<FunnelExperience");
    expect(funnelIdx).toBeGreaterThan(hfwIdx);
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

  it("has the correct overall section order: Header, Hero, ProofBar, Testimonials, Education, HowFusionWorks, Funnel, FAQ, Footer", () => {
    const order = [
      "<Header />",
      "<HeroSection",
      "<ProofBar />",
      "<TestimonialsSection />",
      "<EducationSection />",
      "<HowFusionWorksSection />",
      "<FunnelExperience />",
      "<FaqSection />",
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
});

describe("brand assets", () => {
  it("favicon exists at the App Router location", () => {
    const faviconPath = path.join(ROOT, "src/app/favicon.ico");
    expect(existsSync(faviconPath)).toBe(true);
  });

  it("favicon has reasonable file size", () => {
    const faviconPath = path.join(ROOT, "src/app/favicon.ico");
    const stat = statSync(faviconPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThan(1_000_000);
  });

  it("logo SVG exists at the permanent brand path", () => {
    const logoPath = path.join(ROOT, "public/brand/fusion44x-logo.svg");
    expect(existsSync(logoPath)).toBe(true);
  });

  it("white logo SVG exists at the permanent brand path", () => {
    const logoPath = path.join(
      ROOT,
      "public/brand/fusion44x-logo-white.svg",
    );
    expect(existsSync(logoPath)).toBe(true);
  });

  it("logo SVG contains the Fusion 44X name", () => {
    const logoPath = path.join(ROOT, "public/brand/fusion44x-logo.svg");
    const content = readFileSync(logoPath, "utf-8");
    expect(content).toContain("Fusion");
    expect(content).toContain("44X");
  });

  it("white logo SVG contains the Fusion 44X name", () => {
    const logoPath = path.join(
      ROOT,
      "public/brand/fusion44x-logo-white.svg",
    );
    const content = readFileSync(logoPath, "utf-8");
    expect(content).toContain("Fusion");
    expect(content).toContain("44X");
  });
});

describe("asset configuration", () => {
  const assetsContent = readFileSync(
    path.join(ROOT, "src/config/assets.ts"),
    "utf-8",
  );

  it("logo src points to the permanent brand path", () => {
    expect(assetsContent).toContain("/brand/fusion44x-logo.svg");
  });

  it("white logo src points to the permanent brand path", () => {
    expect(assetsContent).toContain("/brand/fusion44x-logo-white.svg");
  });

  it("favicon src points to favicon.ico", () => {
    expect(assetsContent).toContain("/favicon.ico");
  });
});

describe("header configuration", () => {
  const headerContent = readFileSync(
    path.join(ROOT, "src/components/sections/header.tsx"),
    "utf-8",
  );

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
});

describe("footer configuration", () => {
  const footerContent = readFileSync(
    path.join(ROOT, "src/components/sections/footer.tsx"),
    "utf-8",
  );

  it("uses the white logo for dark footer background", () => {
    expect(footerContent).toContain("logo.src_white");
  });

  it("renders the logo image when src_white is available", () => {
    expect(footerContent).toContain("<img");
    expect(footerContent).toContain("assets.logo.src_white");
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

  it("includes explicit width and height attributes", () => {
    expect(logoContent).toContain("width=");
    expect(logoContent).toContain("height=");
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

describe("booking behavior unchanged", () => {
  const bookingConfig = readFileSync(
    path.join(ROOT, "src/config/booking.ts"),
    "utf-8",
  );

  it("retains 30-minute appointments", () => {
    expect(bookingConfig).toContain("30");
  });

  it("retains America/New_York timezone", () => {
    expect(bookingConfig).toContain("America/New_York");
  });

  const funnelContext = readFileSync(
    path.join(ROOT, "src/lib/funnel/funnel-context.tsx"),
    "utf-8",
  );

  it("still uses createBookingRequest for booking submission", () => {
    expect(funnelContext).toContain("createBookingRequest");
  });

  it("still uses submitLeadApi for lead submission", () => {
    expect(funnelContext).toContain("submitLeadApi");
  });
});
