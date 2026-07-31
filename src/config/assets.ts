export const assets = {
  logo: {
    src: "/brand/fusion44x-logo.png",
    alt: "Fusion44X",
    placeholder: "Fusion44X Logo",
  },
  favicon: {
    src: "/brand/fusion44x-favicon.png",
  },
  hero_image: {
    src: "/brand/product-image.png",
    alt: "Fusion44X pool water treatment system",
    placeholder: "Hero Product Image",
  },
  hero_video: {
    src: "BY2L2uy3hH0",
    placeholder: "Hero Video",
  },
  product_photo: {
    src: "/brand/product-image.png",
    alt: "Fusion44X Hydro-pH-Infusion system",
    placeholder: "Fusion44X Product Photo",
  },
  how_it_works_video: {
    src: null,
    placeholder: "How It Works Video Coming Soon",
  },
  how_it_works_diagram: {
    src: "/brand/how-it-works-new-image.png",
    alt: "Fusion44X Hydro-pH-Infusion system diagram with numbered part callouts",
  },
  testimonial_videos: [
    {
      src: "1071565091",
      thumbnail:
        "https://i.vimeocdn.com/video/2000312141-f5f2522d5cd2e412e19feeb8da2396226fe2ec140f7385056bba31734d88120a-d_640?region=us",
      customer_name: null,
      caption: "Carlos, Miami Beach",
      placeholder: "Customer Story Video Placeholder",
    },
    {
      src: "1079914507",
      thumbnail:
        "https://i.vimeocdn.com/video/2010396448-1d8c70cd2edf046a24732cf822107a1ee6cd178f5161ab16aa9aaa28d59c9d11-d_640?region=us",
      customer_name: null,
      caption: "Bryan, Arizona",
      placeholder: "Customer Story Video Placeholder",
    },
    {
      src: "1077748658",
      thumbnail:
        "https://i.vimeocdn.com/video/2007836280-7bcf052dbdac6f6eee1254a6bb6ef4002e901d53be4a749276f160c1f08b99dc-d_640?region=us",
      customer_name: null,
      caption: "Geoff, California",
      placeholder: "Customer Story Video Placeholder",
    },
  ],
  og_image: {
    src: null,
    alt: "Fusion44X \u2014 Cleaner Pool Water Without the Chemical Cycle",
    placeholder: "Social Share Image",
  },
} as const;

export type AssetKey = keyof typeof assets;
