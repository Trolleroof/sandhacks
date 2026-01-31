"use client";

import { useState, useCallback, useEffect } from "react";
import { useSpeechRecognition, useElevenLabsTTS } from "../hooks";

interface ObjectLocation {
    id: string;
    name: string;
    lastSeen: string;
    distance: string;
    direction: string;
    confidence: number;
    thumbnail?: string;
}

// Mock data for demonstration - in production, this would come from backend
const mockObjects: ObjectLocation[] = [
    {
        id: "water_bottle_001",
        name: "water bottle",
        lastSeen: "2 minutes ago",
        distance: "3.2 meters",
        direction: "to your left, near the window",
        confidence: 0.94,
    },
    {
        id: "keys_001",
        name: "keys",
        lastSeen: "15 minutes ago",
        distance: "5.1 meters",
        direction: "behind you, on the desk",
        confidence: 0.87,
    },
    {
        id: "backpack_001",
        name: "backpack",
        lastSeen: "1 hour ago",
        distance: "2.0 meters",
        direction: "to your right, by the chair",
        confidence: 0.91,
    },
    {
        id: "laptop_001",
        name: "laptop",
        lastSeen: "5 minutes ago",
        distance: "1.5 meters",
        direction: "in front of you, on the table",
        confidence: 0.98,
    },
    {
        id: "phone_001",
        name: "phone",
        lastSeen: "30 seconds ago",
        distance: "0.8 meters",
        direction: "to your right, on the couch",
        confidence: 0.95,
    },
];

function findObject(query: string): ObjectLocation | null {
    const normalizedQuery = query.toLowerCase().trim();

    // Common query patterns
    const patterns = [
        /(?:find|where(?:'s| is)?|locate|look for|search for)\s+(?:my\s+)?(.+)/i,
        /(?:my\s+)?(.+)\s+(?:is\s+)?(?:where|location)/i,
        /(.+)/i, // Fallback to full query
    ];

    let objectName = normalizedQuery;

    for (const pattern of patterns) {
        const match = normalizedQuery.match(pattern);
        if (match && match[1]) {
            objectName = match[1].trim();
            break;
        }
    }

    // Remove common articles and possessives
    objectName = objectName.replace(/^(the|a|an|my)\s+/i, "").trim();

    return (
        mockObjects.find(
            (obj) =>
                obj.name.toLowerCase().includes(objectName) ||
                objectName.includes(obj.name.toLowerCase())
        ) || null
    );
}

export function VoiceInterface() {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<ObjectLocation | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showNotSupported, setShowNotSupported] = useState(false);

    const {
        isListening,
        transcript,
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
    });

    const {
        speak,
        stop: cancelSpeech,
        isSpeaking,
        isLoading: ttsLoading,
        error: ttsError,
    } = useElevenLabsTTS();

    // Update query when transcript changes
    useEffect(() => {
        if (transcript) {
            setQuery(transcript);
        }
    }, [transcript]);

    // Process query when listening stops
    useEffect(() => {
        if (!isListening && transcript) {
            handleSearch(transcript);
        }
    }, [isListening, transcript, handleSearch]);

    const handleSearch = useCallback(
        async (searchQuery: string) => {
            if (!searchQuery.trim()) return;

            setIsSearching(true);
            setResult(null);

            // Find object in mock database
            const found = findObject(searchQuery);
            setResult(found);

            try {
                // Call Cerebras API to generate intelligent response
                const response = await fetch("/api/chat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        query: searchQuery,
                        objectData: found ? {
                            name: found.name,
                            lastSeen: found.lastSeen,
                            distance: found.distance,
                            direction: found.direction,
                            confidence: found.confidence,
                        } : null,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    speak(data.response);
                } else {
                    // Fallback to template if Cerebras fails
                    if (found) {
                        speak(`Found your ${found.name}! It's ${found.distance} away, ${found.direction}.`);
                    } else {
                        speak("I couldn't find that object. Try asking about something else.");
                    }
                }
            } catch (error) {
                console.error("Chat API error:", error);
                // Fallback to template
                if (found) {
                    speak(`Found your ${found.name}! It's ${found.distance} away, ${found.direction}.`);
                } else {
                    speak("I couldn't find that object. Try asking about something else.");
                }
            } finally {
                setIsSearching(false);
            }
        },
        [speak]
    );

    const handleVoiceButtonClick = () => {
        if (!sttSupported) {
            setShowNotSupported(true);
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            resetTranscript();
            setQuery("");
            setResult(null);
            cancelSpeech();
            startListening();
        }
    };

    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            handleSearch(query);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleTextSubmit(e);
        }
    };

    return (
        <div className="voice-interface">
            {/* Voice Status Indicator */}
            <div className="status-bar">
                <div className="status-indicators">
                    <div className={`indicator ${sttSupported ? "supported" : "unsupported"}`}>
                        <span className="indicator-dot" />
                        <span>Speech Recognition</span>
                    </div>
                    <div className="indicator supported">
                        <span className="indicator-dot" />
                        <span>Cerebras LLM</span>
                    </div>
                    <div className="indicator supported">
                        <span className="indicator-dot" />
                        <span>ElevenLabs TTS</span>
                    </div>
                </div>
                {ttsError && (
                    <div className="tts-error">
                        <span>⚠️ {ttsError}</span>
                    </div>
                )}
            </div>

            {/* Main Voice Button */}
            <div className="voice-button-container">
                <button
                    className={`voice-button ${isListening ? "listening" : ""} ${isSpeaking || ttsLoading ? "speaking" : ""}`}
                    onClick={handleVoiceButtonClick}
                    aria-label={isListening ? "Stop listening" : "Start voice search"}
                >
                    <div className="voice-button-inner">
                        {isListening ? (
                            <div className="listening-animation">
                                <span className="wave" />
                                <span className="wave" />
                                <span className="wave" />
                            </div>
                        ) : ttsLoading ? (
                            <div className="loading-icon">
                                <div className="spinner" />
                            </div>
                        ) : isSpeaking ? (
                            <div className="speaking-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                </svg>
                            </div>
                        ) : (
                            <div className="mic-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                </svg>
                            </div>
                        )}
                    </div>
                </button>
                <p className="voice-hint">
                    {isListening
                        ? "Listening... say something like 'Find my water bottle'"
                        : ttsLoading
                            ? "Generating voice..."
                            : isSpeaking
                                ? "Speaking with ElevenLabs..."
                                : "Tap to speak or type below"}
                </p>
            </div>

            {/* Text Input Fallback */}
            <form className="text-input-form" onSubmit={handleTextSubmit}>
                <div className="input-wrapper">
                    <input
                        type="text"
                        value={interimTranscript || query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Find my water bottle..."
                        className="text-input"
                        disabled={isListening}
                    />
                    <button
                        type="submit"
                        className="submit-button"
                        disabled={isListening || isSearching || !query.trim()}
                    >
                        {isSearching ? (
                            <div className="spinner" />
                        ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                            </svg>
                        )}
                    </button>
                </div>
            </form>

            {/* Error Display */}
            {(sttError || showNotSupported) && (
                <div className="error-message">
                    {sttError || "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari."}
                </div>
            )}

            {/* Result Display */}
            {result && (
                <div className="result-card">
                    <div className="result-header">
                        <div className="result-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                        </div>
                        <div className="result-title">
                            <h3>Found: {result.name}</h3>
                            <span className="confidence">
                                {Math.round(result.confidence * 100)}% confidence
                            </span>
                        </div>
                    </div>
                    <div className="result-details">
                        <div className="detail-row">
                            <span className="label">Last seen:</span>
                            <span className="value">{result.lastSeen}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">Distance:</span>
                            <span className="value">{result.distance}</span>
                        </div>
                        <div className="detail-row direction">
                            <span className="label">Direction:</span>
                            <span className="value">{result.direction}</span>
                        </div>
                    </div>
                    <button
                        className="repeat-button"
                        onClick={() => {
                            const guidance = `Your ${result.name} is ${result.distance} away, ${result.direction}.`;
                            speak(guidance);
                        }}
                        disabled={isSpeaking || ttsLoading}
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                        </svg>
                        Repeat directions
                    </button>
                </div>
            )}

            {/* No Result Display */}
            {result === null && !isSearching && query && !isListening && (
                <div className="no-result">
                    <div className="no-result-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                    </div>
                    <p>Object not found in spatial memory</p>
                    <p className="hint">
                        Try: &quot;water bottle&quot;, &quot;keys&quot;, &quot;backpack&quot;, &quot;laptop&quot;, or &quot;phone&quot;
                    </p>
                </div>
            )}

            {/* Speaking Indicator */}
            {(isSpeaking || ttsLoading) && (
                <button className="stop-speaking" onClick={cancelSpeech}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 6h12v12H6z" />
                    </svg>
                    {ttsLoading ? "Cancel" : "Stop speaking"}
                </button>
            )}
        </div>
    );
}
