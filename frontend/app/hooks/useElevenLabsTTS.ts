"use client";

import { useState, useCallback, useRef } from "react";

interface UseElevenLabsTTSOptions {
    voiceId?: string;
    useFallback?: boolean; // Fall back to browser TTS if ElevenLabs fails
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
}

interface UseElevenLabsTTSReturn {
    speak: (text: string) => Promise<void>;
    stop: () => void;
    isSpeaking: boolean;
    isLoading: boolean;
    error: string | null;
    usingFallback: boolean;
}

export function useElevenLabsTTS(
    options: UseElevenLabsTTSOptions = {}
): UseElevenLabsTTSReturn {
    const { voiceId, useFallback = true, onStart, onEnd, onError } = options;

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [usingFallback, setUsingFallback] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Fallback to browser TTS
    const speakWithBrowser = useCallback(
        (text: string) => {
            if (!("speechSynthesis" in window)) {
                onError?.("Browser TTS not supported");
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1;
            utterance.pitch = 1;

            utterance.onstart = () => {
                setIsSpeaking(true);
                setIsLoading(false);
                setUsingFallback(true);
                onStart?.();
            };

            utterance.onend = () => {
                setIsSpeaking(false);
                onEnd?.();
            };

            utterance.onerror = () => {
                setIsSpeaking(false);
                setIsLoading(false);
            };

            speechSynthesis.speak(utterance);
        },
        [onStart, onEnd, onError]
    );

    const speak = useCallback(
        async (text: string) => {
            if (!text.trim()) return;

            // Stop any current playback
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            speechSynthesis.cancel();

            // Abort any pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            setIsLoading(true);
            setError(null);
            setUsingFallback(false);

            try {
                abortControllerRef.current = new AbortController();

                const response = await fetch("/api/tts", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ text, voiceId }),
                    signal: abortControllerRef.current.signal,
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(
                        errorData.error || "ElevenLabs API error"
                    );
                }

                // Get audio blob and create URL
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                // Create and play audio
                const audio = new Audio(audioUrl);
                audioRef.current = audio;

                audio.onplay = () => {
                    setIsSpeaking(true);
                    setIsLoading(false);
                    onStart?.();
                };

                audio.onended = () => {
                    setIsSpeaking(false);
                    URL.revokeObjectURL(audioUrl);
                    audioRef.current = null;
                    onEnd?.();
                };

                audio.onerror = () => {
                    const errorMsg = "Failed to play audio";
                    setError(errorMsg);
                    setIsSpeaking(false);
                    setIsLoading(false);
                    onError?.(errorMsg);
                };

                await audio.play();
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    return;
                }

                const errorMsg =
                    err instanceof Error ? err.message : "Failed to generate speech";

                console.warn("ElevenLabs failed, using browser TTS fallback:", errorMsg);
                setError(errorMsg);

                // Fall back to browser TTS
                if (useFallback) {
                    speakWithBrowser(text);
                } else {
                    setIsLoading(false);
                    onError?.(errorMsg);
                }
            }
        },
        [voiceId, useFallback, speakWithBrowser, onStart, onEnd, onError]
    );

    const stop = useCallback(() => {
        // Abort pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // Stop audio playback
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        // Stop browser TTS
        speechSynthesis.cancel();

        setIsSpeaking(false);
        setIsLoading(false);
    }, []);

    return {
        speak,
        stop,
        isSpeaking,
        isLoading,
        error,
        usingFallback,
    };
}

