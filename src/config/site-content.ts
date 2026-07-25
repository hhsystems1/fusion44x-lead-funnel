export const siteContent = {
  company: {
    name: "Fusion 44X",
    tagline: "Experience Water Like Never Before",
    description: "Intelligent water care for pools and spas.",
  },
  seo: {
    title: "Fusion 44X — Intelligent Water Care for Pools & Spas",
    description:
      "Fusion 44X delivers intelligent, automated water care for pools and spas. Take our quick diagnostic to get a personalized recommendation from a specialist.",
    og_title: "Fusion 44X — Intelligent Water Care",
    og_description:
      "Automated pool and spa water care that keeps your water crystal clear. Get your free diagnostic today.",
  },
  hero: {
    heading: "Crystal Clear Water, Zero Guesswork",
    subheading:
      "Fusion 44X uses intelligent automation to keep your pool or spa water perfectly balanced — so you can skip the testing, skip the chemicals, and just enjoy.",
    cta: "Get Your Free Diagnostic",
    trust_line: "Trusted by pool and spa owners across the country",
  },
  video_testimonials: {
    heading: "What Pool Owners Are Saying",
    subheading: "Hear directly from customers who transformed their water care with Fusion 44X.",
    testimonials: [
      {
        quote: "We went from testing water every day to barely thinking about it. The clarity is incredible.",
        name: "Sarah M.",
        detail: "Pool Owner",
      },
      {
        quote: "Our kids used to get rashes after swimming. Since installing Fusion 44X, that problem completely disappeared.",
        name: "David R.",
        detail: "Pool & Spa Owner",
      },
      {
        quote: "I was spending over $200 a month on chemicals. Fusion 44X cut that down dramatically.",
        name: "Michael T.",
        detail: "Spa Owner",
      },
    ],
  },
  how_it_works: {
    heading: "How It Works",
    subheading: "Three simple steps to better water.",
    steps: [
      {
        heading: "Tell Us About Your Pool",
        text: "Answer a few quick questions about your setup and what matters most to you.",
      },
      {
        heading: "Get Your Recommendation",
        text: "We analyze your needs and match you with the right Fusion 44X solution.",
      },
      {
        heading: "Enjoy Worry-Free Water",
        text: "Let automation handle the chemistry while you enjoy crystal clear water.",
      },
    ],
  },
  diagnostic: {
    heading: "Pool Diagnostic",
    subheading: "Help us understand your pool or spa so we can recommend the right solution.",
    next: "Next",
    back: "Back",
    complete: "See My Results",
    progress_label: "Question",
    of: "of",
  },
  contact: {
    heading: "Your Information",
    subheading:
      "We'll send your personalized recommendation and a specialist will follow up.",
    first_name: "First Name",
    last_name: "Last Name",
    email: "Email Address",
    phone: "Phone Number",
    zip_code: "ZIP Code",
    preferred_contact: "Preferred Contact Method",
    preferred_contact_placeholder: "No preference",
    contact_method_email: "Email",
    contact_method_phone: "Phone",
    contact_method_text: "Text",
    consent_to_contact:
      "I agree to be contacted about my inquiry. (Required)",
    marketing_consent:
      "I would like to receive tips, promotions, and product updates.",
    submit: "Get My Recommendation",
    submitting: "Submitting...",
    error_required: "This field is required",
    error_invalid_email: "Please enter a valid email address",
    error_invalid_phone: "Please enter a valid phone number",
    error_consent_required: "You must agree to be contacted to proceed",
  },
  confirmation: {
    heading: "Thank You!",
    subheading:
      "A confirmation email has been sent to your inbox with all the details of your inquiry.",
    what_happens_next: "What happens next?",
    steps: [
      "Review your personalized recommendation in the email we just sent.",
      "A Fusion 44X specialist will reach out to answer any questions.",
      "Schedule your installation at a time that works for you.",
    ],
    support_note: "Need help? Contact us at support@fusion44x.com or call (800) 555-0199.",
  },
  booking_placeholder: {
    heading: "Schedule Your Consultation",
    subheading: "Choose a time that works best for you.",
    message:
      "Booking will be available once a specialist confirms your recommendation.",
  },
  booking: {
    heading: "Schedule Your Consultation",
    subheading: "Select a date and time for your Fusion 44X consultation.",
    timezone_label: "All times are shown in",
    select_date: "Select a date",
    select_time: "Select a time",
    no_slots: "No available times for this date.",
    no_slots_sub: "Please select another date.",
    loading_slots: "Loading available times...",
    loading_error: "Could not load available times.",
    try_again: "Try again",
    review_heading: "Review your appointment",
    review_date: "Date",
    review_time: "Time",
    confirm: "Confirm Booking",
    confirming: "Confirming...",
    conflict: "This time is no longer available. Please select another.",
    success_heading: "Your consultation is scheduled!",
    success_subheading:
      "We look forward to speaking with you.",
    success_message:
      "A confirmation email has been sent with the details of your appointment. Please check your inbox.",
    add_to_calendar: "Add to calendar",
    google_calendar: "Google Calendar",
    outlook: "Outlook Web",
    apple_calendar: "Apple Calendar",
    download_ics: "Download .ics file",
    appointment_ref: "Appointment Reference",
  },
  footer: {
    tagline: "Intelligent water care for pools and spas.",
    support_email: "support@fusion44x.com",
    support_phone: "(800) 555-0199",
    privacy_label: "Privacy Policy",
    copyright: `\u00a9 ${new Date().getFullYear()} Fusion 44X. All rights reserved.`,
  },
} as const;
