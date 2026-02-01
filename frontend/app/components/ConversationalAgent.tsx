"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, Navigation, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "../hooks";
import type { ObjectLocation, GuidanceData } from "../lib/mockData";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  objectData?: ObjectLocation;
  multipleResults?: Array<{ number: number; result: ObjectLocation }>;
}

interface ConversationalAgentProps {
  onSearch: (query: string) => void;
  searchResults: ObjectLocation[];
  isSearching?: boolean;
  guidance: GuidanceData | null;
  target: ObjectLocation | null;
  onSpeak: (text: string) => void;
  onMarkFound: () => void;
  onCancel: () => void;
  isSpeaking?: boolean;
  onGuideMe: (result: ObjectLocation) => void;
  externalAgentMessages?: Array<{ id: string; content: string }>;
  onExternalMessagesHandled?: (ids: string[]) => void;
  className?: string;
}

export function ConversationalAgent({
  onSearch,
  searchResults,
  isSearching = false,
  guidance,
  target,
  onSpeak,
  onMarkFound,
  onCancel,
  isSpeaking = false,
  onGuideMe,
  externalAgentMessages,
  onExternalMessagesHandled,
  className,
}: ConversationalAgentProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content: "Hey! I'm your spatial memory assistant. Just ask me to find something, and I'll guide you there!",
      timestamp: new Date(),
    },
  ]);
  const [hasMounted, setHasMounted] = useState(false);
  const [lastProcessedResults, setLastProcessedResults] = useState<string>("");
  const [pendingSelection, setPendingSelection] = useState<Array<{ number: number; result: ObjectLocation }> | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const handledExternalIdsRef = useRef<Set<string>>(new Set());

  // Avoid hydration mismatch
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-speak agent responses
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role !== "agent" || !lastMessage.content) return;
      if (lastMessage.id === "welcome") return;
      if (lastMessage.id === lastSpokenMessageIdRef.current) return;
      if (isSpeaking) return;

      onSpeak(lastMessage.content);
      lastSpokenMessageIdRef.current = lastMessage.id;
    }
  }, [messages, onSpeak, isSpeaking]);

  // Add externally generated agent messages to the chat
  useEffect(() => {
    if (!externalAgentMessages || externalAgentMessages.length === 0) return;

    const newMessages = externalAgentMessages.filter(
      (message) => !handledExternalIdsRef.current.has(message.id)
    );

    if (newMessages.length === 0) return;

    const agentMessages: Message[] = newMessages.map((message) => ({
      id: message.id,
      role: "agent",
      content: message.content,
      timestamp: new Date(),
    }));

    setMessages((prev) => [...prev, ...agentMessages]);

    newMessages.forEach((message) => handledExternalIdsRef.current.add(message.id));
    onExternalMessagesHandled?.(newMessages.map((message) => message.id));
  }, [externalAgentMessages, onExternalMessagesHandled]);

  // Handle search results automatically
  useEffect(() => {
    if (searchResults.length > 0 && !isSearching) {
      // Create a unique key for these results to prevent duplicate processing
      const resultsKey = searchResults.map(r => r.id).sort().join(",");

      // Skip if we've already processed these exact results
      if (resultsKey === lastProcessedResults) {
        return;
      }

      setLastProcessedResults(resultsKey);

      if (searchResults.length === 1) {
        // Single result - auto-guide
        const result = searchResults[0];

        // Don't add a message here - let the external agent message from API handle it
        // Automatically start guidance for single result
        setTimeout(() => {
          onGuideMe(result);
        }, 500);
      } else {
        // Multiple results - let user choose
        const sortedResults = [...searchResults].sort((a, b) => {
          // Sort by recency (most recent first), then by confidence
          const timeA = a.timestamp.getTime();
          const timeB = b.timestamp.getTime();
          if (Math.abs(timeA - timeB) > 60000) { // More than 1 minute difference
            return timeB - timeA; // Most recent first
          }
          return b.confidence - a.confidence; // Higher confidence first
        });

        // Number the results 1-4 (most to least recent)
        const numberedResults = sortedResults.map((result, index) => ({
          number: index + 1,
          result,
        }));

        setPendingSelection(numberedResults);

        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: `I found ${searchResults.length} matches! Which one do you want?`,
          timestamp: new Date(),
          multipleResults: numberedResults,
        };

        setMessages((prev) => [...prev, agentMessage]);
      }
    }
  }, [searchResults, isSearching, onGuideMe, lastProcessedResults]);

  // Don't add guidance updates as messages - they'll spam the chat
  // The guidance panel itself shows the instruction

  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: sttSupported,
    error: sttError,
  } = useSpeechRecognition({
    continuous: true, // Enable continuous listening
    interimResults: true,
    language: "en-US",
    onResult: (result) => {
      if (result.isFinal) {
        const userQuery = result.transcript.trim().toLowerCase();
        if (userQuery) {
          // Add user message
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: result.transcript.trim(),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, userMessage]);

          // Check if user is selecting from multiple results
          if (pendingSelection && pendingSelection.length > 0) {
            // Parse number selection (e.g., "one", "1", "the first one", "number two")
            const numberWords = ["zero", "one", "two", "three", "four", "five"];
            let selectedNumber: number | null = null;

            // Try to find a number in the query
            for (let i = 1; i <= Math.min(pendingSelection.length, 4); i++) {
              if (
                userQuery.includes(String(i)) ||
                userQuery.includes(numberWords[i]) ||
                (i === 1 && (userQuery.includes("first") || userQuery.includes("1st"))) ||
                (i === 2 && (userQuery.includes("second") || userQuery.includes("2nd"))) ||
                (i === 3 && (userQuery.includes("third") || userQuery.includes("3rd"))) ||
                (i === 4 && (userQuery.includes("fourth") || userQuery.includes("4th")))
              ) {
                selectedNumber = i;
                break;
              }
            }

            if (selectedNumber && selectedNumber <= pendingSelection.length) {
              const selected = pendingSelection.find((item) => item.number === selectedNumber);
              if (selected) {
                handleSelectObject(selected.result);
                setPendingSelection(null);
                resetTranscript();
                return;
              }
            }
          }

          // Otherwise, process as a search query
          onSearch(result.transcript.trim());

          // Reset transcript for next input
          resetTranscript();
        }
      }
    },
  });

  const isVoiceAvailable = hasMounted && sttSupported;

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  const handleSelectObject = useCallback((object: ObjectLocation) => {
    // Add user's selection as a message
    const userMessage: Message = {
      id: `user-select-${Date.now()}`,
      role: "user",
      content: `Guide me to this one`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Don't add agent confirmation here - let the external agent message from API handle it
    // Start guidance
    setTimeout(() => {
      onGuideMe(object);
    }, 300);
  }, [onGuideMe]);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardContent className="flex flex-col h-full p-0">
        {/* Conversation Area */}
        <div className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-[14px] p-3",
                      message.role === "user"
                        ? "bg-slateblue text-eggshell"
                        : "bg-space/50 text-eggshell border border-denim/30"
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.objectData && (
                      <div className="mt-2 pt-2 border-t border-denim/30 text-xs text-denim">
                        <div className="flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          <span>{message.objectData.distance}</span>
                          <span>&middot;</span>
                          <span>{message.objectData.direction}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multiple results selection */}
                {message.multipleResults && message.multipleResults.length > 0 && (
                  <div className="space-y-2 pl-2">
                    {message.multipleResults.map((item) => {
                      const confidencePercent = Math.round(item.result.confidence * 100);
                      return (
                        <button
                          key={item.result.id}
                          onClick={() => handleSelectObject(item.result)}
                          className="w-full text-left p-3 rounded-[14px] bg-space/30 hover:bg-space/50 border border-denim/30 hover:border-slateblue transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            {/* Number badge */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slateblue flex items-center justify-center group-hover:bg-slateblue/80 transition-colors">
                              <span className="text-lg font-bold text-eggshell">{item.number}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className="text-sm font-medium text-eggshell capitalize truncate">
                                  {item.result.name}
                                </h4>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {confidencePercent}%
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-denim mb-1">
                                <Clock className="h-3 w-3" />
                                <span>{item.result.lastSeen}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-eggshell">
                                <Navigation className="h-3 w-3 text-denim" />
                                <span>{item.result.distance}</span>
                                <span className="text-denim">&middot;</span>
                                <span>{item.result.direction}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 self-center">
                              <Navigation className="h-4 w-4 text-denim group-hover:text-slateblue transition-colors" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Interim transcript preview */}
            {isListening && interimTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[14px] p-3 bg-slateblue/50 text-eggshell/70 animate-pulse">
                  <p className="text-sm italic">{interimTranscript}</p>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isSearching && (
              <div className="flex justify-start">
                <div className="bg-space/50 rounded-[14px] p-3 border border-denim/30">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-denim rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-denim rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-denim rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm text-denim">Searching...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Voice Input Area */}
        <div className="border-t border-denim/30 p-4 bg-ink/50">
          <div className="flex items-center gap-3">
            <Button
              size="lg"
              variant={isListening ? "default" : "outline"}
              onClick={handleMicClick}
              disabled={!isVoiceAvailable}
              className={cn(
                "flex-1 h-14",
                isListening && "bg-slateblue animate-pulse"
              )}
            >
              {isListening ? (
                <>
                  <MicOff className="h-5 w-5 mr-2" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  Start Conversation
                </>
              )}
            </Button>
          </div>

          {/* Status Messages */}
          {isListening && (
            <p className="text-xs text-denim text-center mt-2 animate-pulse">
              Listening... Say something like "Find my water bottle"
            </p>
          )}

          {sttError && (
            <p className="text-xs text-red-400 text-center mt-2">{sttError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConversationalAgent;
