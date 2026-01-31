"use client";

import { useState, useCallback, useEffect } from "react";
import { Mic, MicOff, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "../hooks";

interface QueryBarProps {
  onSearch: (query: string) => void;
  isSearching?: boolean;
  className?: string;
}

const exampleQueries = ["water bottle", "keys", "backpack", "laptop", "phone"];

export function QueryBar({ onSearch, isSearching = false, className }: QueryBarProps) {
  const [query, setQuery] = useState("");
  const [hasMounted, setHasMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: sttSupported,
    error: sttError,
  } = useSpeechRecognition({
    continuous: false,
    interimResults: true,
    language: "en-US",
    onResult: (result) => {
      if (result.isFinal) {
        const nextQuery = result.transcript.trim();
        setQuery(result.transcript);
        if (nextQuery && !isSearching) {
          onSearch(nextQuery);
        }
      }
    },
  });

  // Use consistent values until mounted to avoid hydration mismatch
  const isVoiceAvailable = hasMounted && sttSupported;

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setQuery("");
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim() && !isSearching) {
        onSearch(query.trim());
      }
    },
    [query, isSearching, onSearch]
  );

  const handleExampleClick = useCallback(
    (example: string) => {
      setQuery(example);
      onSearch(example);
    },
    [onSearch]
  );

  const displayValue = interimTranscript || query;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={displayValue}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find my water bottle..."
            disabled={isListening || isSearching}
            className="pr-10"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-denim" />
          )}
        </div>

        {/* Voice button */}
        <Button
          type="button"
          variant={isListening ? "default" : "outline"}
          size="icon"
          onClick={handleMicClick}
          disabled={!isVoiceAvailable || isSearching}
          className={cn(
            isListening && "bg-slateblue animate-pulse"
          )}
          title={isVoiceAvailable ? (isListening ? "Stop listening" : "Start voice input") : "Loading..."}
        >
          {isListening ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        {/* Search button */}
        <Button
          type="submit"
          disabled={!query.trim() || isSearching || isListening}
        >
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </form>

      {/* Status message */}
      {isListening && (
        <p className="text-sm text-denim animate-pulse">
          Listening... say something like &quot;Find my water bottle&quot;
        </p>
      )}

      {sttError && (
        <p className="text-sm text-red-400">{sttError}</p>
      )}

      {/* Example queries */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-denim">Try:</span>
        {exampleQueries.map((example) => (
          <Badge
            key={example}
            variant="outline"
            className="cursor-pointer hover:bg-slateblue/20 transition-colors"
            onClick={() => handleExampleClick(example)}
          >
            {example}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default QueryBar;
