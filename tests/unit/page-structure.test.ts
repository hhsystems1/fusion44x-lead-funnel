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

  it("includes the sticky assessment bar", () => {
    expect(pageContent).toContain("<StickyAssessmentBar />");
  });

  it("adds bottom padding to main for sticky bar clearance", () => {
    expect(pageContent).toMatch(/pb-\d+/);
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

  it("logoandslogan PNG exists at the permanent brand path", () => {
    const logoPath = path.join(
      ROOT,
      "public/brand/fusion44x-logoandslogan.png",
    );
    expect(existsSync(logoPath)).toBe(true);
  });

  it("logo PNG has reasonable file size", () => {
    const logoPath = path.join(ROOT, "public/brand/fusion44x-logo.png");
    const stat = statSync(logoPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThan(10_000_000);
  });

  it("logoandslogan PNG has reasonable file size", () => {
    const logoPath = path.join(
      ROOT,
      "public/brand/fusion44x-logoandslogan.png",
    );
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

  it("logoandslogan PNG dimensions are trimmed (not original 2048x2048)", () => {
    const logoPath = path.join(
      ROOT,
      "public/brand/fusion44x-logoandslogan.png",
    );
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

  it("logoandslogan src points to the permanent brand path", () => {
    expect(assetsContent).toContain("/brand/fusion44x-logoandslogan.png");
  });

  it("favicon src points to the brand path", () => {
    expect(assetsContent).toContain("/brand/fusion44x-favicon.png");
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

  it("uses the logoandslogan for dark footer background", () => {
    expect(footerContent).toContain("logo.src_white");
  });

  it("renders the logo image when src_white is available", () => {
    expect(footerContent).toContain("<img");
    expect(footerContent).toContain("assets.logo.src_white");
  });

  it("uses object-contain for the footer logo", () => {
    expect(footerContent).toContain("object-contain");
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
    expect(barContent).toContain("rounded-xl");
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

  it("hides at the top of the page", () => {
    expect(barContent).toContain("isAtTop");
  });

  it("hides near the bottom of the page", () => {
    expect(barContent).toContain("isNearBottom");
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
