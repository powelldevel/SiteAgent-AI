import OpenAI from "openai";
import { NextResponse } from "next/server";
import { extractedJobSchema, inferJobFromMessage } from "@/lib/ai";

export async function POST(request: Request) {
  const { message } = (await request.json()) as { message?: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Paste a WhatsApp message or voice-note transcript first." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      mode: "demo",
      job: inferJobFromMessage(message),
    });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content:
          "Extract South African contractor job requests into strict JSON. Price conservatively in ZAR. Include missing details and a concise WhatsApp follow-up message.",
      },
      {
        role: "user",
        content: `Return only JSON matching this shape: { customerName, phone, location, jobType, title, materials: string[], estimatedDate, urgency: "low"|"medium"|"high", missingDetails: string[], summary, quoteItems: [{ description, quantity, unitPrice, total }], followUpMessage }.\n\nMessage:\n${message}`,
      },
    ],
  });

  const text = response.output_text;
  const parsed = extractedJobSchema.safeParse(JSON.parse(text));

  if (!parsed.success) {
    return NextResponse.json({
      mode: "fallback",
      job: inferJobFromMessage(message),
      warning: "AI response was not valid enough, so SiteGent used the deterministic extractor.",
    });
  }

  return NextResponse.json({ mode: "ai", job: parsed.data });
}
