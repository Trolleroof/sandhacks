"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SpeechResult {
    transcript: string;
    confidence: number;
    isFinal: boolean;
}

interface UseSpeechRecognitionOptions {
    continuous?: boolean;
    interimResults?: boolean;
    language?: string;
    onResult?: (result: SpeechResult) => void;
    onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    isSupported: boolean;
    error: string | null;
}

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    length: number;
    isFinal: boolean;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
    const {
        continuous = false,
        interimResults = true,
        language = "en-US",
        onResult,
        onError,
    } = options;

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);

    const isSupported =
        typeof window !== "undefined" &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Check for browser support
    useEffect(() => {
        if (!isSupported) return;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = continuous;
        recognitionRef.current.interimResults = interimResults;
        recognitionRef.current.lang = language;
    }, [isSupported, continuous, interimResults, language]);

    // Set up event handlers
    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = "";
            let interim = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0].transcript;
                const confidence = result[0].confidence;

                if (result.isFinal) {
                    finalTranscript += text;
                    onResult?.({
                        transcript: text,
                        confidence,
                        isFinal: true,
                    });
                } else {
                    interim += text;
                }
            }

            if (finalTranscript) {
                setTranscript((prev) => prev + finalTranscript);
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            const errorMessage = event.error || "Speech recognition error";
            setError(errorMessage);
            onError?.(errorMessage);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimTranscript("");
        };

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };
    }, [onResult, onError]);

    const startListening = useCallback(() => {
        const recognition = recognitionRef.current;
        if (!recognition || isListening) return;

        setError(null);
        setInterimTranscript("");

        try {
            recognition.start();
        } catch (err) {
            // Recognition might already be running
            console.error("Failed to start speech recognition:", err);
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        const recognition = recognitionRef.current;
        if (!recognition || !isListening) return;

        recognition.stop();
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript("");
        setInterimTranscript("");
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        isSupported,
        error,
    };
}
