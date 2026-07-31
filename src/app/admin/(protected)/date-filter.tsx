"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter") ?? "last7";
  const [isPending, startTransition] = useTransition();

  const filters = [
    { value: "today", label: "Today" },
    { value: "last7", label: "Last 7 days" },
    { value: "last30", label: "Last 30 days" },
  ];

  function setFilter(value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("filter", value);
      params.delete("from");
      params.delete("to");
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => setFilter(f.value)}
          disabled={isPending}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            currentFilter === f.value
              ? "bg-brand-aqua text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          } disabled:opacity-50`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
