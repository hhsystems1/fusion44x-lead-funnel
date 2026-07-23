import { siteContent } from "@/config/site-content";

export default function Home() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">
        {siteContent.company.name}
      </h1>
      <p className="mt-4 text-lg text-center text-balance max-w-md">
        {siteContent.company.tagline}
      </p>
    </section>
  );
}
