import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable");
}

export interface AIRequestPayload {
  actionKey: string;
  prompt?: string;
  context?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface AIResponsePayload {
  success: boolean;
  action: string;
  model: string;
  provider?: string;
  output: string;
  tokens: {
    prompt: number;
    completion: number;
  };
}

export interface AIRequestError extends Error {
  status?: number;
  details?: unknown;
}

export async function invokeAIAction(payload: AIRequestPayload): Promise<AIResponsePayload> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Failed to load Supabase session", sessionError);
    const err: AIRequestError = new Error("Unable to load current session");
    err.details = sessionError;
    throw err;
  }

  if (!session?.access_token) {
    const err: AIRequestError = new Error("No active session. Please sign in again.");
    err.status = 401;
    throw err;
  }

  const functionUrl = `${SUPABASE_URL}/functions/v1/ai-router`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action_key: payload.actionKey,
      prompt: payload.prompt,
      context: payload.context,
      options: payload.options,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("AI function call failed", response.status, text);
    let errorMessage = `AI request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) {
        errorMessage = parsed.error;
      }
    } catch (parseError) {
      // Non-JSON error response
    }
    const err: AIRequestError = new Error(errorMessage);
    err.status = response.status;
    err.details = text;
    throw err;
  }

  const data = (await response.json()) as AIResponsePayload;
  return data;
}
