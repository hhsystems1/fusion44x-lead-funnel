export const assets = {
  logo: {
    src: null,
    alt: "Fusion 44X",
    placeholder: "Fusion 44X Logo",
  },
  favicon: {
    src: "/favicon.ico",
  },
  hero_image: {
    src: null,
    alt: "Fusion 44X pool water treatment system",
    placeholder: "Hero Product Image",
  },
  hero_video: {
    src: null,
    placeholder: "Hero Video",
  },
  product_photo: {
    src: null,
    alt: "Fusion 44X device",
    placeholder: "Fusion 44X Product Photo",
  },
  how_it_works_video: {
    src: null,
    placeholder: "How It Works Video Coming Soon",
  },
  testimonial_videos: [
    {
      src: null,
      thumbnail: null,
      customer_name: null,
      caption: null,
      placeholder: "Customer Story Video Placeholder",
    },
    {
      src: null,
      thumbnail: null,
      customer_name: null,
      caption: null,
      placeholder: "Customer Story Video Placeholder",
    },
    {
      src: null,
      thumbnail: null,
      customer_name: null,
      caption: null,
      placeholder: "Customer Story Video Placeholder",
    },
  ],
  og_image: {
    src: null,
    alt: "Fusion 44X — Water Made Perfect",
    placeholder: "Social Share Image",
  },
} as const;

export type AssetKey = keyof typeof assets;
