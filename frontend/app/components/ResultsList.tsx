"use client";

import { SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResultCard } from "./ResultCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { ObjectLocation } from "../lib/mockData";

interface ResultsListProps {
  results: ObjectLocation[];
  activeTargetId?: string | null;
  onGuideMe: (result: ObjectLocation) => void;
  isLoading?: boolean;
  query?: string;
  className?: string;
}

export function ResultsList({
  results,
  activeTargetId,
  onGuideMe,
  isLoading = false,
  query,
  className,
}: ResultsListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  // No results
  if (results.length === 0 && query) {
    return (
      <div className={cn("text-center py-8", className)}>
        <SearchX className="h-12 w-12 mx-auto text-denim/50 mb-4" />
        <p className="text-eggshell mb-2">No objects found for &quot;{query}&quot;</p>
        <p className="text-sm text-denim">
          Try: &quot;water bottle&quot;, &quot;keys&quot;, &quot;backpack&quot;, &quot;laptop&quot;, or &quot;phone&quot;
        </p>
      </div>
    );
  }

  // Empty state (no search yet)
  if (results.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-denim">
          Search for objects to see results here
        </p>
      </div>
    );
  }

  // Results list
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-denim">
          {results.length} result{results.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {results.map((result) => (
        <ResultCard
          key={result.id}
          result={result}
          onGuideMe={onGuideMe}
          isActive={result.id === activeTargetId}
        />
      ))}
    </div>
  );
}

export default ResultsList;
