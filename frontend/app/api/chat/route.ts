import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { NextRequest, NextResponse } from "next/server";

const cerebras = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY,
});

// System prompt for the spatial memory assistant
const SYSTEM_PROMPT = `You are Recall, a friendly and warm spatial memory assistant who helps people find their misplaced items. Think of yourself as a helpful friend who's great at remembering where things are.

When you've found an object, respond naturally and conversationally - like you're talking to a friend:
- Start with something warm like "Found it!" or "I've got you!"
- Tell them where it is in plain, casual language
- Make it feel like a conversation, not a robot report
- Use phrases like "your [item] is" instead of formal language

If you can't find something, be encouraging and helpful - maybe suggest similar items or ask if they meant something else.

Keep it short and sweet (1-2 sentences max) since this is for voice. Sound human and friendly, not like a GPS or instruction manual. Use casual language and be warm!`;

interface NearbyObject {
    name: string;
    distance: number;
}

interface ObjectData {
    name: string;
    lastSeen: string;
    distance: string;
    direction: string;
    confidence: number;
    nearbyObjects?: NearbyObject[];
}

export async function POST(request: NextRequest) {
    try {
        const { query, objectData } = await request.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "Query is required" },
                { status: 400 }
            );
        }

        // Build the user message with context
        let userMessage = `The user asked: "${query}"`;

        if (objectData) {
            const obj = objectData as ObjectData;
            userMessage += `\n\nGreat news - I found their ${obj.name}! Here's what I know:
It's about ${obj.distance} away, ${obj.direction}. I'm ${Math.round(obj.confidence * 100)}% sure this is it. Last spotted ${obj.lastSeen}.`;

            // Add nearby objects context if available
            if (obj.nearbyObjects && obj.nearbyObjects.length > 0) {
                userMessage += `\n\nContext: `;
                const nearbyDescriptions = obj.nearbyObjects.map(
                    (nearby) => `their ${nearby.name} is ${nearby.distance.toFixed(1)}m from the ${obj.name}`
                );
                userMessage += nearbyDescriptions.join(", and ") + ". These nearby objects might help locate it.";
            }

            userMessage += `\n\nGive them a warm, friendly response to help them find it. Make it conversational and natural!`;
        } else {
            userMessage += `\n\nHmm, I couldn't find what they're looking for in my memory. Help them out with a friendly, encouraging response. Maybe ask if they meant something else or suggest what we do have.`;
        }

        const completion = await cerebras.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMessage },
            ],
            model: "llama-3.3-70b",
            max_completion_tokens: 256,
            temperature: 0.7,
            top_p: 1,
            stream: false,
        }) as {
            choices: Array<{ message?: { content?: string } }>;
            model?: string;
            usage?: unknown;
        };

        const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

        return NextResponse.json({
            response,
            model: completion.model,
            usage: completion.usage,
        });
    } catch (error: unknown) {
        console.error("Cerebras API error:", error);

        // Detect payment/quota (402) or rate limit (429) so clients can back off or stop
        const status =
            typeof (error as { status?: number }).status === "number"
                ? (error as { status: number }).status
                : (error as { statusCode?: number }).statusCode;
        const message = String(
            (error as { message?: string }).message ?? (error as { error?: string }).error ?? ""
        ).toLowerCase();

        if (status === 402 || message.includes("payment") || message.includes("quota") || message.includes("billing")) {
            return NextResponse.json(
                { error: "Payment or quota required", code: "PAYMENT_REQUIRED" },
                { status: 402 }
            );
        }
        if (status === 429 || message.includes("rate limit")) {
            return NextResponse.json(
                { error: "Rate limited", code: "RATE_LIMITED" },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}
