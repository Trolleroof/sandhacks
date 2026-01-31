"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTextToSpeechOptions {
    rate?: number; // 0.1 to 10, default 1
    pitch?: number; // 0 to 2, default 1
    volume?: number; // 0 to 1, default 1
    voice?: string; // Voice name or URI
    language?: string; // BCP 47 language tag
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
}

interface UseTextToSpeechReturn {
    speak: (text: string) => void;
    cancel: () => void;
    pause: () => void;
    resume: () => void;
    isSpeaking: boolean;
    isPaused: boolean;
    isSupported: boolean;
    voices: SpeechSynthesisVoice[];
    setVoice: (voice: SpeechSynthesisVoice | string) => void;
    currentVoice: SpeechSynthesisVoice | null;
    error: string | null;
}

export function useTextToSpeech(
    options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn {
    const {
        rate = 1,
        pitch = 1,
        volume = 1,
        voice: initialVoice,
        language = "en-US",
        onStart,
        onEnd,
        onError,
    } = options;

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);

    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Check for browser support and load voices
    useEffect(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            setIsSupported(true);

            const loadVoices = () => {
                const availableVoices = speechSynthesis.getVoices();
                setVoices(availableVoices);

                // Set default voice
                if (availableVoices.length > 0) {
                    // Try to find a voice matching the language preference
                    const preferredVoice =
                        availableVoices.find(
                            (v) =>
                                v.lang.startsWith(language.split("-")[0]) && v.localService
                        ) ||
                        availableVoices.find((v) =>
                            v.lang.startsWith(language.split("-")[0])
                        ) ||
                        availableVoices.find((v) => v.default) ||
                        availableVoices[0];

                    if (initialVoice) {
                        const matchedVoice = availableVoices.find(
                            (v) => v.name === initialVoice || v.voiceURI === initialVoice
                        );
                        if (matchedVoice) {
                            setCurrentVoice(matchedVoice);
                            return;
                        }
                    }

                    setCurrentVoice(preferredVoice);
                }
            };

            // Voices might not be loaded immediately
            loadVoices();
            speechSynthesis.onvoiceschanged = loadVoices;

            return () => {
                speechSynthesis.onvoiceschanged = null;
            };
        }
    }, [language, initialVoice]);

    const speak = useCallback(
        (text: string) => {
            if (!isSupported || !text.trim()) return;

            // Cancel any ongoing speech
            speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utteranceRef.current = utterance;

            // Configure utterance
            utterance.rate = rate;
            utterance.pitch = pitch;
            utterance.volume = volume;

            if (currentVoice) {
                utterance.voice = currentVoice;
                utterance.lang = currentVoice.lang;
            } else {
                utterance.lang = language;
            }

            // Event handlers
            utterance.onstart = () => {
                setIsSpeaking(true);
                setIsPaused(false);
                setError(null);
                onStart?.();
            };

            utterance.onend = () => {
                setIsSpeaking(false);
                setIsPaused(false);
                onEnd?.();
            };

            utterance.onerror = (event) => {
                const errorMessage = event.error || "Speech synthesis error";
                setError(errorMessage);
                setIsSpeaking(false);
                setIsPaused(false);
                onError?.(errorMessage);
            };

            utterance.onpause = () => {
                setIsPaused(true);
            };

            utterance.onresume = () => {
                setIsPaused(false);
            };

            speechSynthesis.speak(utterance);
        },
        [
            isSupported,
            rate,
            pitch,
            volume,
            currentVoice,
            language,
            onStart,
            onEnd,
            onError,
        ]
    );

    const cancel = useCallback(() => {
        if (!isSupported) return;
        speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
    }, [isSupported]);

    const pause = useCallback(() => {
        if (!isSupported || !isSpeaking) return;
        speechSynthesis.pause();
    }, [isSupported, isSpeaking]);

    const resume = useCallback(() => {
        if (!isSupported || !isPaused) return;
        speechSynthesis.resume();
    }, [isSupported, isPaused]);

    const setVoice = useCallback(
        (voice: SpeechSynthesisVoice | string) => {
            if (typeof voice === "string") {
                const matchedVoice = voices.find(
                    (v) => v.name === voice || v.voiceURI === voice
                );
                if (matchedVoice) {
                    setCurrentVoice(matchedVoice);
                }
            } else {
                setCurrentVoice(voice);
            }
        },
        [voices]
    );

    return {
        speak,
        cancel,
        pause,
        resume,
        isSpeaking,
        isPaused,
        isSupported,
        voices,
        setVoice,
        currentVoice,
        error,
    };
}
