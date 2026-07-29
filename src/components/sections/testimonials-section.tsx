"use client";

import { useState } from "react";
import Image from "next/image";
import { siteContent } from "@/config/site-content";
import { assets } from "@/config/assets";

export function TestimonialsSection() {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const hasVideos = assets.testimonial_videos.some((v) => v.src);
  if (!hasVideos) return null;

  return (
    <section
      className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-brand-aqua">
            {siteContent.testimonials.eyebrow}
          </p>
          <h2
            id="testimonials-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {siteContent.testimonials.heading}
          </h2>
          <p className="mt-3 text-neutral-600">
            {siteContent.testimonials.subheading}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {assets.testimonial_videos.map((video, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-brand-surface/30"
            >
              {playingIndex === i ? (
                <div className="relative aspect-[9/16] w-full bg-black">
                  <iframe
                    src={`https://player.vimeo.com/video/${video.src}?autoplay=1&muted=0&controls=1&title=0&byline=0&portrait=0&playsinline=1&dnt=1`}
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <button
                  onClick={() => setPlayingIndex(i)}
                  className="group relative aspect-[9/16] w-full overflow-hidden bg-neutral-100"
                  aria-label="Play testimonial video"
                >
                  <Image
                    src={video.thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110">
                      <svg
                        className="ml-0.5 h-5 w-5 text-brand-navy"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              )}
              {video.caption && (
                <div className="px-3 py-2.5">
                  <p className="text-center text-xs font-medium text-neutral-700">
                    {video.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
