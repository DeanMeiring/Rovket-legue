import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";

export class ClaudeError extends Error {}

export type ChatTurn = { role: "user" | "assistant"; content: string };

// One Claude call with no tools: everything it needs is in the prompt.
export async function askClaude(system: string, messages: ChatTurn[]): Promise<{ text: string; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeError("AI features are off. Set ANTHROPIC_API_KEY in Railway to turn them on.");
  }
  const client = new Anthropic();

  try {
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system,
        messages,
      })
      .finalMessage();

    if (response.stop_reason === "refusal") throw new ClaudeError("The AI declined to answer this.");
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    if (!text) throw new ClaudeError("The AI returned nothing.");
    return { text, model: response.model };
  } catch (err) {
    if (err instanceof ClaudeError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new ClaudeError("ANTHROPIC_API_KEY is invalid.");
    if (err instanceof Anthropic.RateLimitError) throw new ClaudeError("The AI service is busy. Try again in a minute.");
    if (err instanceof Anthropic.APIError) throw new ClaudeError(`AI request failed (${err.status}).`);
    throw err;
  }
}
