import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextRequest, NextResponse } from "next/server";

// Initialize ElevenLabs client with API key
const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

// George voice - clear, natural male voice great for navigation
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export async function POST(request: NextRequest) {
    try {
        const { text, voiceId } = await request.json();

        if (!text || typeof text !== "string") {
            return NextResponse.json(
                { error: "Text is required" },
                { status: 400 }
            );
        }

        // Generate audio using ElevenLabs
        const audio = await elevenlabs.textToSpeech.convert(
            voiceId || DEFAULT_VOICE_ID,
            {
                text,
                modelId: "eleven_multilingual_v2",
                outputFormat: "mp3_44100_128",
            }
        );

        // Convert the readable stream to a buffer
        const chunks: Uint8Array[] = [];
        const reader = audio.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
        }

        const audioBuffer = Buffer.concat(chunks);

        // Return audio as MP3
        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": "audio/mpeg",
                "Content-Length": audioBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error("ElevenLabs TTS error:", error);
        return NextResponse.json(
            { error: "Failed to generate speech" },
            { status: 500 }
        );
    }
}

// Get available voices
export async function GET() {
    try {
        const voices = await elevenlabs.voices.getAll();
        return NextResponse.json({
            voices: voices.voices?.map((v) => ({
                id: v.voiceId,
                name: v.name,
                category: v.category,
                labels: v.labels,
            })),
        });
    } catch (error) {
        console.error("Failed to fetch voices:", error);
        return NextResponse.json(
            { error: "Failed to fetch voices" },
            { status: 500 }
        );
    }
}
