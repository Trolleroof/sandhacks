import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { NextRequest, NextResponse } from "next/server";

const cerebras = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY,
});

// System prompt for the spatial memory assistant
const SYSTEM_PROMPT = `You are a helpful spatial memory assistant called Recall. Your job is to help users find objects they've misplaced.

When given information about an object's location, provide clear, natural navigation guidance. Be concise but friendly. Include:
- Confirmation of what you found
- Distance and direction
- Helpful landmarks or context

If no object is found, be helpful and suggest alternatives or ask clarifying questions.

Keep responses under 2-3 sentences for voice interaction. Be conversational, not robotic.`;

interface ObjectData {
    name: string;
    lastSeen: string;
    distance: string;
    direction: string;
    confidence: number;
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
        let userMessage = `User query: "${query}"`;

        if (objectData) {
            const obj = objectData as ObjectData;
            userMessage += `\n\nObject found in spatial memory:
- Object: ${obj.name}
- Last seen: ${obj.lastSeen}
- Distance: ${obj.distance}
- Direction: ${obj.direction}
- Confidence: ${Math.round(obj.confidence * 100)}%

Generate a natural voice response to guide the user to this object.`;
        } else {
            userMessage += `\n\nNo matching object was found in spatial memory. Generate a helpful response.`;
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
    } catch (error) {
        console.error("Cerebras API error:", error);
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}
