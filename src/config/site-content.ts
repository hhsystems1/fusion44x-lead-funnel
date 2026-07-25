export const siteContent = {
  company: {
    name: "Fusion 44X",
    slogan: "Water Made Perfect",
    description: "A probe-based water treatment system for pools and spas.",
  },
  seo: {
    title: "Fusion 44X — Water Made Perfect",
    description:
      "Fusion 44X is a probe-based water treatment system for pools and spas. Take our free pool assessment to find the right solution for your setup.",
    og_title: "Fusion 44X — Water Made Perfect",
    og_description:
      "A different approach to pool and spa water treatment. Take the free assessment.",
  },
  hero: {
    heading: "Water Made Perfect",
    subheading:
      "Fusion 44X is a probe-based treatment system that retrofits onto your existing pool or spa equipment. Take our free assessment to find the right solution for your setup.",
    cta_primary: "Get Your Free Pool Assessment",
    cta_secondary: "How It Works",
  },
  proof_bar: {
    enabled: true,
    claim: "Approved customer-count proof goes here",
    supporting_items: [
      "Free pool assessment",
      "No-obligation consultation",
      "Direct manufacturer support",
    ],
  },
  education: {
    heading: "Pool Care Shouldn't Be This Hard",
    subheading: "If any of this sounds familiar, you are not alone.",
    problems: [
      {
        heading: "Recurring Algae Problems",
        text: "You treat the water, the algae comes back. It is frustrating and it wastes your time and money.",
      },
      {
        heading: "Constant Chemical Maintenance",
        text: "Testing, adjusting, re-testing. The cycle never ends and it is hard to keep up.",
      },
      {
        heading: "Uncomfortable Water",
        text: "Dry skin, irritated eyes, and a strong chemical smell make swimming less enjoyable for you and your family.",
      },
      {
        heading: "Ongoing Pool-Care Frustration",
        text: "You have tried different products and methods. Nothing seems to solve the problem for good.",
      },
    ],
    cta: "Take the Free Assessment",
  },
  how_fusion_works: {
    heading: "How Fusion 44X Works",
    subheading: "A different approach to water treatment.",
    features: [
      {
        heading: "Retrofits to Your Existing Equipment",
        text: "Fusion 44X connects to your current pool or spa equipment. No full system replacement needed.",
      },
      {
        heading: "Probe-Based Monitoring",
        text: "A sensor probe continuously reads your water conditions and responds in real time.",
      },
      {
        heading: "Professional or DIY Installation",
        text: "Install it yourself or have your local pool technician set it up. Both options are supported.",
      },
      {
        heading: "Direct Manufacturer Support",
        text: "Questions about setup or operation? You get direct support from the Fusion 44X team.",
      },
    ],
  },
  how_it_works_modal: {
    heading: "How It Works",
    video_label: "How It Works Video Coming Soon",
  },
  testimonials: {
    heading: "Customer Stories",
    subheading: "Real pool and spa owners share their experience with Fusion 44X.",
  },
  diagnostic: {
    heading: "Pool Assessment",
    subheading: "Tell us about your pool or spa so we can recommend the right solution.",
    complete_label: "Assessment complete \u2014 enter your details to see your recommendation and available consultation times.",
    next: "Continue",
    back: "Back",
    complete: "Complete Assessment",
    progress_label: "Question",
    of: "of",
  },
  contact: {
    heading: "Your Information",
    subheading:
      "Enter your details so we can send your recommendation and connect you with a specialist.",
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
    submit: "Submit Information",
    submitting: "Submitting...",
    error_required: "This field is required",
    error_invalid_email: "Please enter a valid email address",
    error_invalid_phone: "Please enter a valid phone number",
    error_consent_required: "You must agree to be contacted to proceed",
  },
  booking: {
    heading: "Schedule Your Consultation",
    subheading: "Select a date and time for your Fusion 44X consultation.",
    timezone_label: "All times shown in",
    timezone_display: "Eastern Time",
    select_date: "Select a date",
    select_time: "Select a time",
    no_slots: "No available times for this date.",
    no_slots_sub: "Please select another date.",
    loading_slots: "Loading available times...",
    loading_error: "Could not load available times.",
    try_again: "Try again",
    review_heading: "Review Your Appointment",
    review_date: "Date",
    review_time: "Time",
    review_name: "Name",
    review_email: "Email",
    confirm: "Confirm Appointment",
    confirming: "Confirming...",
    conflict: "That time was just taken. Please choose another available time.",
    error_missing_fields:
      "We\u2019re missing part of your booking information. Please go back and select your date and time again.",
    error_server_error:
      "We couldn\u2019t confirm your appointment right now. Please try again.",
    error_network_error:
      "We lost the connection while confirming your appointment. Please check your connection and try again.",
    error_unknown_error:
      "Something went wrong. Please try again.",
  },
  confirmation: {
    heading: "Your Consultation Is Confirmed",
    subheading: "A confirmation email has been sent.",
    details_heading: "Appointment Details",
    date_label: "Date",
    time_label: "Time",
    timezone_label: "Timezone",
    add_to_calendar: "Add to Calendar",
    google_calendar: "Google Calendar",
    outlook: "Outlook Web",
    download_ics: "Download .ics file",
    appointment_ref: "Reference",
    support_line: "Questions? Contact us at",
    support_phone: "775-600-5305",
  },
  footer: {
    tagline: "Water Made Perfect",
    support_email: "support@fusion44x.com",
    support_phone: "775-600-5305",
    copyright: `\u00a9 ${new Date().getFullYear()} Fusion 44X. All rights reserved.`,
  },
} as const;
