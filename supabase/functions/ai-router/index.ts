// @ts-ignore Deno typings provided at runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore Supabase client for Edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
// @ts-ignore OpenAI SDK for Deno
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
// @ts-ignore Anthropic SDK for Deno (used for some providers)
import Anthropic from "npm:@anthropic-ai/sdk@0.20.0";
// @ts-ignore Google GenAI SDK for Deno (used for Gemini)
import { GoogleGenAI } from "npm:@google/genai";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Max-Age": "86400",
};

interface AIRequestPayload {
  action_key: string;
  prompt?: string;
  context?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

interface AIResponsePayload {
  content: string;
  model: string;
  tokens_prompt: number;
  tokens_completion: number;
}

const RATE_LIMITS: Record<string, { limit: number; windowSeconds: number }> = {
  default: { limit: 50, windowSeconds: 60 * 30 }, // 50 requests per 30 minutes
};

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type SupabaseClient = ReturnType<typeof createClient>;

type ActionHandler = (params: {
  payload: AIRequestPayload;
  supabase: SupabaseClient;
  user: any;
}) => Promise<{
  prompt: string;
  metadata?: Record<string, unknown>;
  options?: Record<string, unknown>;
  model?: string;
}>;

async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  actionKey: string,
): Promise<void> {
  const { limit, windowSeconds } = RATE_LIMITS.default;
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_key", actionKey)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check failed", error);
    throw new HttpError("Failed to evaluate request quota", 500, error);
  }

  if ((count ?? 0) >= limit) {
    throw new HttpError("Rate limit exceeded. Please wait before trying again.", 429);
  }
}

function buildPrompt(body: AIRequestPayload): string {
  if (body.prompt) return body.prompt;

  const contextText = body.context
    ? `\nContext:\n${JSON.stringify(body.context, null, 2)}`
    : "";

  return `You are an assistant for the Expert Coaching Hub platform. Action: ${body.action_key}.${contextText}`;
}

interface AIProvider {
  name: string;
  call: (prompt: string, model: string, options?: Record<string, unknown>) => Promise<AIResponsePayload>;
}

async function callOpenAI(
  client: OpenAI,
  prompt: string,
  model: string,
  options?: Record<string, unknown>,
): Promise<AIResponsePayload> {
  const mergedOptions = options ? { ...options } : {};
  if (mergedOptions && "model" in mergedOptions) {
    delete (mergedOptions as Record<string, unknown>).model;
  }

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    ...mergedOptions,
  } as any);

  const content = response.choices?.[0]?.message?.content || "";
  const tokensPrompt = response.usage?.prompt_tokens ?? 0;
  const tokensCompletion = response.usage?.completion_tokens ?? 0;

  return {
    content,
    model: response.model ?? model,
    tokens_prompt: tokensPrompt,
    tokens_completion: tokensCompletion,
  };
}

async function callDeepSeek(
  apiKey: string,
  prompt: string,
  model: string,
  options?: Record<string, unknown>,
): Promise<AIResponsePayload> {
  const mergedOptions = options ? { ...options } : {};
  if (mergedOptions && "model" in mergedOptions) {
    delete (mergedOptions as Record<string, unknown>).model;
  }

  // DeepSeek uses OpenAI-compatible API
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: mergedOptions.response_format || undefined,
      ...mergedOptions,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const tokensPrompt = data.usage?.prompt_tokens ?? 0;
  const tokensCompletion = data.usage?.completion_tokens ?? 0;

  return {
    content,
    model: data.model ?? model,
    tokens_prompt: tokensPrompt,
    tokens_completion: tokensCompletion,
  };
}

async function callGemini(
  apiKey: string,
  prompt: string,
  model: string,
  options?: Record<string, unknown>,
): Promise<AIResponsePayload> {
  // Use v1beta API with Gemini 2.0 Flash experimental
  const modelName = model || "gemini-2.0-flash-exp";
  
  // Build request body with optional thinking config
  const requestBody: any = {
    contents: [{
      parts: [{ text: prompt }]
    }],
  };

  // Add generation config if provided
  if (options?.generationConfig) {
    requestBody.generationConfig = options.generationConfig;
  }

  // Add thinking config if provided (for extended reasoning)
  if (options?.thinkingConfig) {
    requestBody.thinkingConfig = options.thinkingConfig;
  }

  // Merge any additional options
  if (options?.response_format) {
    // Handle JSON schema for structured output (Gemini format)
    const schema = (options.response_format as any)?.json_schema?.schema || options.response_format;
    requestBody.generationConfig = {
      ...requestBody.generationConfig,
      responseMimeType: "application/json",
      responseSchema: schema,
    };
  }
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  
  // Extract text from all parts (including thoughts if present)
  let content = "";
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.text) {
      content += part.text;
    }
  }
  
  const tokensPrompt = data.usageMetadata?.promptTokenCount ?? 0;
  const tokensCompletion = data.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    content: content || "",
    model: modelName,
    tokens_prompt: tokensPrompt,
    tokens_completion: tokensCompletion,
  };
}

async function callAIWithFallback(
  providers: AIProvider[],
  prompt: string,
  model: string,
  options?: Record<string, unknown>,
): Promise<AIResponsePayload & { provider: string }> {
  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`Attempting AI call with provider: ${provider.name}`);
      const result = await provider.call(prompt, model, options);
      console.log(`✅ Success with provider: ${provider.name}`);
      return { ...result, provider: provider.name };
    } catch (error) {
      console.error(`❌ Provider ${provider.name} failed:`, error);
      lastError = error as Error;
      // Continue to next provider
    }
  }

  // All providers failed
  throw new HttpError(
    `All AI providers failed. Last error: ${lastError?.message || "Unknown error"}`,
    503,
    { lastError: lastError?.message }
  );
}

async function persistGeneration(
  supabase: SupabaseClient,
  userId: string,
  actorRole: string | null,
  actionKey: string,
  prompt: string,
  aiPayload: AIResponsePayload,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("ai_generations")
    .insert({
      user_id: userId,
      actor_role: actorRole ?? "client",
      action_key: actionKey,
      prompt,
      response: aiPayload.content,
      response_format: (metadata.response_format as string) ?? "markdown",
      tokens_prompt: aiPayload.tokens_prompt,
      tokens_completion: aiPayload.tokens_completion,
      provider: "openai",
      model: aiPayload.model,
      metadata,
    });

  if (error) {
    console.error("Failed to persist ai_generation", error);
    throw new HttpError("Unable to record AI generation", 500, error);
  }
}

function pickContextString(context: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!context) return undefined;
  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function requireContextString(context: Record<string, unknown> | undefined, keys: string[], label: string): string {
  const value = pickContextString(context, keys);
  if (!value) {
    throw new HttpError(`${label} is required in context`, 400);
  }
  return value;
}

function truncateText(text: string | null | undefined, max = 800): string | undefined {
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function fetchCourseWithStructure(supabase: SupabaseClient, courseId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select(
      `id, title, description, level, tag, category, coach_id,
       course_modules(id, title, description, order_index,
         lessons(id, title, description, order_index))`
    )
    .eq("id", courseId)
    .single();

  if (error || !data) {
    throw new HttpError("Unable to load course context", 404, error);
  }

  return data as any;
}

async function fetchLessonContext(supabase: SupabaseClient, lessonId: string) {
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, description, estimated_duration, order_index, module_id")
    .eq("id", lessonId)
    .single();

  if (lessonError || !lesson) {
    throw new HttpError("Lesson not found", 404, lessonError);
  }

  const { data: module, error: moduleError } = await supabase
    .from("course_modules")
    .select("id, course_id, title, description, order_index")
    .eq("id", lesson.module_id)
    .single();

  if (moduleError || !module) {
    throw new HttpError("Module context unavailable", 404, moduleError);
  }

  const course = await fetchCourseWithStructure(supabase, module.course_id);

  const { data: content, error: contentError } = await supabase
    .from("lesson_content")
    .select("id, content_type, is_required, order_index, content_data")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });

  if (contentError) {
    throw new HttpError("Unable to load lesson content", 500, contentError);
  }

  return { lesson, module, course, content }; // content can be null which is fine
}

const actionHandlers: Record<string, ActionHandler> = {
  "course_outline_suggest": async ({ payload, supabase, user }) => {
    const context = payload.context ?? {};
    const courseId = pickContextString(context, ["courseId", "course_id"]);

    let course: any | undefined;

    // If courseId exists, fetch existing course
    if (courseId) {
      course = await fetchCourseWithStructure(supabase, courseId);
    }

    // Build course input from context (for new courses) or database (for existing)
    const courseInput = {
      id: course?.id,
      title: context.courseTitle ?? course?.title,
      description: truncateText((context.courseDescription as string) ?? course?.description, 600),
      level: context.courseLevel ?? course?.level,
      tag: context.courseTag ?? course?.tag,
      category: context.courseCategory ?? course?.category,
    };

    const prompt = `You are an expert instructional designer helping a coach refine their course metadata.

Analyze the course information and provide improved suggestions for:
1. Title - Make it compelling, clear, and SEO-friendly
2. Description - Expand it to be engaging and informative (2-3 paragraphs)
3. Tag - Suggest a relevant tag/keyword
4. Category - Suggest the most appropriate category

Return your response as a JSON object with this exact structure:
{
  "title": "Improved course title",
  "description": "Enhanced course description with clear value proposition and learning outcomes",
  "tag": "relevant-tag",
  "category": "appropriate-category"
}

Current course information:
${JSON.stringify(courseInput, null, 2)}

Coach role: ${user?.app_metadata?.role ?? "coach"}
`;

    const options = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "course_metadata_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              tag: { type: "string" },
              category: { type: "string" },
            },
            required: ["title", "description", "tag", "category"],
          },
        },
      },
    };

    return {
      prompt,
      options,
      metadata: {
        course_id: courseId,
        action: "course_outline_suggest",
      },
    };
  },

  "module_outline_suggest": async ({ payload, supabase, user }) => {
    const context = payload.context ?? {};
    const moduleId = pickContextString(context, ["moduleId", "module_id"]);
    const courseId = requireContextString(context, ["courseId", "course_id"], "courseId");

    let module: any | undefined;
    let course: any | undefined;

    // If moduleId exists, fetch existing module
    if (moduleId) {
      const { data, error } = await supabase
        .from("course_modules")
        .select("id, title, description, order_index")
        .eq("id", moduleId)
        .single();
      
      if (!error && data) {
        module = data;
      }
    }

    // Fetch course information
    course = await fetchCourseWithStructure(supabase, courseId);

    const moduleInput = {
      id: module?.id,
      title: context.moduleTitle ?? module?.title,
      description: context.moduleDescription ?? module?.description,
      courseTitle: course.title,
      courseDescription: truncateText(course.description, 400),
      courseLevel: course.level,
      courseTag: course.tag,
    };

    const prompt = `You are an expert instructional designer helping a coach refine their module metadata.

Analyze the module and course information and provide improved suggestions for:
1. Title - Make it compelling and aligned with the course
2. Description - Expand it to be engaging and informative (2-3 paragraphs)

Return your response as a JSON object with this exact structure:
{
  "title": "Improved module title",
  "description": "Enhanced module description with clear learning outcomes and connection to the course"
}

Current module and course information:
${JSON.stringify(moduleInput, null, 2)}

Coach role: ${user?.app_metadata?.role ?? "coach"}
`;

    const options = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "module_metadata_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "description"],
          },
        },
      },
    };

    return {
      prompt,
      options,
      metadata: {
        course_id: courseId,
        module_id: moduleId,
        action: "module_outline_suggest",
      },
    };
  },

  "lesson_draft_suggest": async ({ payload, supabase, user }) => {
    const context = payload.context ?? {};
    const lessonId = pickContextString(context, ["lessonId", "lesson_id"]);
    const moduleId = requireContextString(context, ["moduleId", "module_id"], "moduleId");

    let lesson: any | undefined;
    let module: any;
    let course: any;
    let content: any[] = [];

    // If lessonId exists, fetch full lesson context
    if (lessonId) {
      const lessonContext = await fetchLessonContext(supabase, lessonId);
      lesson = lessonContext.lesson;
      module = lessonContext.module;
      course = lessonContext.course;
      content = lessonContext.content || [];
    } else {
      // For new lessons, fetch module and course context
      const { data: moduleData, error: moduleError } = await supabase
        .from("course_modules")
        .select("id, course_id, title, description, order_index")
        .eq("id", moduleId)
        .single();

      if (moduleError || !moduleData) {
        throw new HttpError("Module context unavailable", 404, moduleError);
      }

      module = moduleData;
      course = await fetchCourseWithStructure(supabase, module.course_id);
    }

    // Build lesson input from context or database
    const lessonInput = {
      id: lesson?.id,
      title: context.lessonTitle ?? lesson?.title,
      description: context.lessonDescription ?? lesson?.description,
      estimated_duration: lesson?.estimated_duration,
    };

    const prompt = `You are an expert instructional designer helping a coach refine their lesson metadata.

Analyze the lesson, module, and course information and provide improved suggestions for:
1. Title - Make it compelling and aligned with the module
2. Description - Expand it to be engaging and informative (2-3 paragraphs)

Return your response as a JSON object with this exact structure:
{
  "title": "Improved lesson title",
  "description": "Enhanced lesson description with clear learning outcomes and connection to the module"
}

Current context:
${JSON.stringify({
      course: {
        title: course.title,
        description: truncateText(course.description, 400),
        level: course.level,
      },
      module: {
        title: module.title,
        description: truncateText(module.description, 400),
      },
      lesson: lessonInput,
    }, null, 2)}

Coach role: ${user?.app_metadata?.role ?? "coach"}
`;

    const options = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lesson_metadata_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "description"],
          },
        },
      },
    };

    return {
      prompt,
      options,
      metadata: {
        course_id: course.id,
        module_id: module.id,
        lesson_id: lessonId,
        action: "lesson_draft_suggest",
      },
    };
  },

  "content_draft_suggest": async ({ payload, supabase, user }) => {
    const context = payload.context ?? {};
    const contentId = pickContextString(context, ["contentId", "content_id"]);
    const lessonId = requireContextString(context, ["lessonId", "lesson_id"], "lessonId");
    const contentType = requireContextString(context, ["contentType", "content_type"], "contentType");

    const { lesson, module, course } = await fetchLessonContext(supabase, lessonId);

    const contentInput = {
      type: contentType,
      title: context.contentTitle,
      description: context.contentDescription,
      existingContent: context.existingContent,
    };

    let prompt = "";
    let options: any = {};

    // Generate different prompts based on content type
    if (contentType === "text") {
      prompt = `You are an expert content writer helping create engaging educational text content.

Create a comprehensive, well-structured blog-style article for this lesson.

Guidelines:
- Write in a clear, engaging style appropriate for ${course.level} level
- Include an introduction, main sections with headings, and a conclusion
- Use examples and analogies to explain concepts
- Keep paragraphs concise and readable
- Format using Markdown (headings, lists, bold, italic)

Context:
${JSON.stringify({
        course: { title: course.title, level: course.level },
        module: { title: module.title, description: truncateText(module.description, 300) },
        lesson: { title: lesson.title, description: truncateText(lesson.description, 300) },
        content: contentInput,
      }, null, 2)}

Return a JSON object with:
{
  "title": "Suggested content title",
  "content": "Full markdown article content"
}`;

      options = {
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "text_content_schema",
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["title", "content"],
            },
          },
        },
      };
    } else if (contentType === "video") {
      prompt = `You are a video script writer helping create educational video content.

Create a detailed video script and production guide for this lesson.

Guidelines:
- Write a conversational, engaging script
- Include visual suggestions and on-screen text ideas
- Break down into scenes/segments with timing
- Suggest b-roll, graphics, or demonstrations
- Keep tone appropriate for ${course.level} level learners

Context:
${JSON.stringify({
        course: { title: course.title, level: course.level },
        module: { title: module.title, description: truncateText(module.description, 300) },
        lesson: { title: lesson.title, description: truncateText(lesson.description, 300) },
        content: contentInput,
      }, null, 2)}

Return a JSON object with:
{
  "title": "Suggested video title",
  "script": "Full video script with timing and visual notes",
  "layout": "Video structure and production notes"
}`;

      options = {
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "video_content_schema",
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                script: { type: "string" },
                layout: { type: "string" },
              },
              required: ["title", "script", "layout"],
            },
          },
        },
      };
    }

    return {
      prompt,
      options,
      metadata: {
        course_id: course.id,
        module_id: module.id,
        lesson_id: lessonId,
        content_id: contentId,
        content_type: contentType,
        action: "content_draft_suggest",
      },
    };
  },

  "lesson_summarize": async ({ payload, supabase, user }) => {
    const context = payload.context ?? {};
    const lessonId = requireContextString(context, ["lessonId", "lesson_id"], "lessonId");
    
    const { lesson, module, course, content } = await fetchLessonContext(supabase, lessonId);

    // Extract text content from lesson
    const textContent = (content || [])
      .filter((item: any) => item.content_type === "text")
      .map((item: any) => item.content_data?.text ?? item.content_data?.html ?? "")
      .filter(Boolean)
      .join("\n\n");

    const prompt = `You are an AI study assistant helping a student understand their lesson.

Create a comprehensive yet concise summary of this lesson that includes:
1. **Key Concepts** - Main ideas and topics covered
2. **Learning Objectives** - What the student should be able to do after this lesson
3. **Key Takeaways** - 3-5 bullet points of the most important information
4. **Suggested Study Actions** - 2-3 actionable next steps for the student

Return your response as a JSON object with this structure:
{
  "summary": "Brief overview paragraph",
  "keyConcepts": ["concept1", "concept2", ...],
  "learningObjectives": ["objective1", "objective2", ...],
  "keyTakeaways": ["takeaway1", "takeaway2", ...],
  "suggestedActions": ["action1", "action2", ...]
}

Lesson Information:
${JSON.stringify({
      course: { title: course.title, level: course.level },
      module: { title: module.title },
      lesson: {
        title: lesson.title,
        description: truncateText(lesson.description, 500),
        duration: lesson.estimated_duration,
      },
      content: textContent ? truncateText(textContent, 2000) : "No detailed content available yet",
    }, null, 2)}
`;

    const options = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lesson_summary_schema",
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              keyConcepts: {
                type: "array",
                items: { type: "string" },
              },
              learningObjectives: {
                type: "array",
                items: { type: "string" },
              },
              keyTakeaways: {
                type: "array",
                items: { type: "string" },
              },
              suggestedActions: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["summary", "keyConcepts", "learningObjectives", "keyTakeaways", "suggestedActions"],
          },
        },
      },
    };

    return {
      prompt,
      options,
      metadata: {
        course_id: course.id,
        module_id: module.id,
        lesson_id: lessonId,
        action: "lesson_summarize",
      },
    };
  },

  "quiz_builder_suggest": async ({ payload, supabase }) => {
    const lessonId = requireContextString(payload.context, ["lessonId", "lesson_id"], "lessonId");
    const { lesson, module, course, content } = await fetchLessonContext(supabase, lessonId);

    const textualContent = (content || [])
      .filter((item: any) => item.content_type === "text")
      .map((item: any) => truncateText(item.content_data?.text ?? item.content_data?.html ?? "", 800))
      .filter(Boolean);

    const hasContent = textualContent.length > 0;

    const prompt = `You are creating a multiple-choice quiz to assess learner understanding of a lesson.

Generate 4-6 high-quality questions.
Each question must include 4 answer options, indicate the correct option index, and provide a brief explanation.

${hasContent 
  ? 'Base your questions on the provided lesson content snippets below.' 
  : 'Note: No text content is available yet for this lesson. Generate general questions based on the lesson title and description.'}

Return JSON with the structure:
{
  "questions": [
    {
      "question": string,
      "options": string[4],
      "answerIndex": number,
      "explanation": string,
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Context:
${JSON.stringify({
      course: { id: course.id, title: course.title },
      module: { id: module.id, title: module.title },
      lesson: { id: lesson.id, title: lesson.title, description: truncateText(lesson.description, 500) },
      contentSnippets: hasContent ? textualContent : "No text content available yet",
    }, null, 2)}
`;

    const options = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "quiz_schema",
          schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                minItems: 4,
                items: {
                  type: "object",
                  required: ["question", "options", "answerIndex", "explanation", "difficulty"],
                  properties: {
                    question: { type: "string" },
                    options: {
                      type: "array",
                      minItems: 4,
                      maxItems: 6,
                      items: { type: "string" },
                    },
                    answerIndex: { type: "integer", minimum: 0 },
                    explanation: { type: "string" },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                  },
                },
              },
            },
            required: ["questions"],
          },
        },
      },
    };

    return {
      prompt,
      options,
      metadata: {
        course_id: course.id,
        module_id: module.id,
        lesson_id: lesson.id,
        action: "quiz_builder_suggest",
      },
    };
  },

  "course_recommend": async ({ payload, supabase, user }) => {
    const context = payload.context ?? {};
    const userId = user?.id;
    
    if (!userId) {
      throw new Error("User must be authenticated for recommendations");
    }

    // Get user's enrolled courses and completed lessons
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select(`
        course_id,
        courses (
          id,
          title,
          description,
          category,
          tags,
          level
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active");

    // Get user's interests from their enrolled courses
    const userTags = new Set<string>();
    const userCategories = new Set<string>();
    const userLevels = new Set<string>();
    
    enrollments?.forEach((enrollment: any) => {
      const course = enrollment.courses;
      if (course.tags) {
        course.tags.forEach((tag: string) => userTags.add(tag));
      }
      if (course.category) userCategories.add(course.category);
      if (course.level) userLevels.add(course.level);
    });

    // Find similar courses using tags and categories (hybrid approach)
    const { data: similarCourses } = await supabase
      .from("courses")
      .select("id, title, description, category, tags, level, coach_id")
      .eq("status", "published")
      .not("id", "in", `(${enrollments?.map((e: any) => e.course_id).join(",") || "null"})`)
      .limit(20);

    // Score courses based on tag/category overlap
    const scoredCourses = similarCourses?.map((course: any) => {
      let score = 0;
      
      // Tag matching (higher weight)
      if (course.tags) {
        const matchingTags = course.tags.filter((tag: string) => userTags.has(tag));
        score += matchingTags.length * 3;
      }
      
      // Category matching
      if (course.category && userCategories.has(course.category)) {
        score += 2;
      }
      
      // Level progression (prefer same or next level)
      if (course.level && userLevels.has(course.level)) {
        score += 1;
      }
      
      return { ...course, score };
    }).sort((a: any, b: any) => b.score - a.score).slice(0, 5);

    const prompt = `You are a course recommendation assistant. Based on the user's learning history, suggest why they should take these courses.

User's Learning Profile:
- Interests: ${Array.from(userTags).join(", ") || "General learning"}
- Categories: ${Array.from(userCategories).join(", ") || "Various"}
- Current Level: ${Array.from(userLevels).join(", ") || "Mixed"}

Recommended Courses:
${JSON.stringify(scoredCourses, null, 2)}

For each course, provide a brief, personalized reason (1-2 sentences) why this course would be valuable for the user based on their learning history.

Return as JSON array:
[
  {
    "course_id": "uuid",
    "reason": "Personalized recommendation reason"
  }
]`;

    const options = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "course_recommendations_schema",
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    course_id: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["course_id", "reason"],
                },
              },
            },
            required: ["recommendations"],
          },
        },
      },
    };

    return {
      prompt,
      options,
      metadata: {
        user_id: userId,
        action: "course_recommend",
        scored_courses: scoredCourses,
      },
    };
  },

  "content_analyze": async ({ payload, supabase, user }) => {
    const context = payload.context ?? {};
    const contentId = requireContextString(context, "contentId", "content_analyze");
    
    // Fetch content details
    const { data: content, error: contentError } = await supabase
      .from("lesson_content")
      .select(`
        id,
        title,
        content_type,
        content_data,
        order_index,
        lessons (
          id,
          title,
          description,
          learning_objectives,
          estimated_duration
        )
      `)
      .eq("id", contentId)
      .single();

    if (contentError || !content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    const lesson = content.lessons;
    
    // Extract text content
    let textContent = "";
    if (content.content_type === "text" && content.content_data?.text) {
      textContent = content.content_data.text;
    } else if (content.content_type === "quiz" && content.content_data?.questions) {
      textContent = JSON.stringify(content.content_data.questions, null, 2);
    }

    const prompt = `You are a content quality expert analyzing educational material. Evaluate this lesson content and provide actionable improvement suggestions.

**Lesson Context:**
- Title: ${lesson?.title || "Untitled"}
- Description: ${lesson?.description || "No description"}
- Learning Objectives: ${lesson?.learning_objectives?.join(", ") || "Not specified"}
- Estimated Duration: ${lesson?.estimated_duration || "Not set"} minutes

**Content Being Analyzed:**
- Type: ${content.content_type}
- Title: ${content.title}
- Content: ${textContent.substring(0, 3000)}${textContent.length > 3000 ? "..." : ""}

**Analyze the following aspects:**

1. **Readability** (1-10 score)
   - Is the language clear and appropriate for the target audience?
   - Are sentences concise and well-structured?
   - Is technical jargon explained?

2. **Completeness** (1-10 score)
   - Does it cover the learning objectives?
   - Are there sufficient examples?
   - Is there a clear introduction and conclusion?

3. **Engagement** (1-10 score)
   - Is the content interesting and engaging?
   - Are there interactive elements or questions?
   - Does it use varied formats (lists, examples, scenarios)?

4. **Structure** (1-10 score)
   - Is the content well-organized?
   - Are headings and sections logical?
   - Is there a clear flow of ideas?

5. **Accessibility** (1-10 score)
   - Is the content accessible to diverse learners?
   - Are there alternative explanations for complex concepts?
   - Is formatting consistent?

**Provide:**
- Overall quality score (average of 5 aspects)
- 3-5 specific, actionable improvement suggestions
- Missing elements that should be added
- Strengths to maintain

Return as JSON:`;

    const options = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "content_quality_analysis_schema",
          schema: {
            type: "object",
            properties: {
              scores: {
                type: "object",
                properties: {
                  readability: { type: "number" },
                  completeness: { type: "number" },
                  engagement: { type: "number" },
                  structure: { type: "number" },
                  accessibility: { type: "number" },
                  overall: { type: "number" },
                },
                required: ["readability", "completeness", "engagement", "structure", "accessibility", "overall"],
              },
              improvements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    suggestion: { type: "string" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["category", "suggestion", "priority"],
                },
              },
              missing_elements: {
                type: "array",
                items: { type: "string" },
              },
              strengths: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["scores", "improvements", "missing_elements", "strengths"],
          },
        },
      },
    };

    return {
      prompt,
      options,
      metadata: {
        content_id: contentId,
        lesson_id: lesson?.id,
        content_type: content.content_type,
        action: "content_analyze",
      },
    };
  },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const deepSeekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const defaultModel = Deno.env.get("AI_DEFAULT_MODEL") ?? "gpt-4o-mini";

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase configuration");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!openAIApiKey && !deepSeekApiKey && !geminiApiKey) {
      console.error("No AI provider API keys configured");
      return new Response(JSON.stringify({ error: "No AI providers available" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai = openAIApiKey ? new OpenAI({ apiKey: openAIApiKey }) : null;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as AIRequestPayload;
    if (!body?.action_key) {
      return new Response(JSON.stringify({ error: "action_key is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await enforceRateLimit(supabase, user.id, body.action_key);

    const handler = actionHandlers[body.action_key];
    let prompt: string;
    let handlerOptions: Record<string, unknown> | undefined;
    let handlerMetadata: Record<string, unknown> | undefined;
    let handlerModel: string | undefined;

    if (handler) {
      const result = await handler({ payload: body, supabase, user });
      prompt = result.prompt;
      handlerOptions = result.options;
      handlerMetadata = result.metadata;
      handlerModel = result.model;
    } else {
      prompt = buildPrompt(body);
    }

    const mergedOptions = {
      ...(handlerOptions ?? {}),
      ...(body.options ?? {}),
    };

    const model = (handlerModel as string | undefined) ?? (mergedOptions.model as string | undefined) ?? (body.options?.model as string | undefined) ?? defaultModel;

    // Build provider list based on available API keys
    // DeepSeek is first (default) for cost-effectiveness
    const providers: AIProvider[] = [];
    
    if (deepSeekApiKey) {
      // Use deepseek-reasoner for complex reasoning tasks, deepseek-chat for general tasks
      const deepseekModel = mergedOptions.useReasoning ? "deepseek-reasoner" : "deepseek-chat";
      providers.push({
        name: "DeepSeek",
        call: (p, m, o) => callDeepSeek(deepSeekApiKey, p, deepseekModel, o),
      });
    }
    
    if (openai && openAIApiKey) {
      providers.push({
        name: "OpenAI",
        call: (p, m, o) => callOpenAI(openai, p, m || "gpt-4o-mini", o),
      });
    }
    
    if (geminiApiKey) {
      providers.push({
        name: "Gemini",
        call: (p, m, o) => callGemini(geminiApiKey, p, "gemini-2.0-flash-exp", o),
      });
    }

    // Call AI with fallback
    const aiResult = await callAIWithFallback(providers, prompt, model, mergedOptions);

    const metadataPayload: Record<string, unknown> = {
      ...(body.context ?? {}),
      ...(handlerMetadata ?? {}),
      provider: aiResult.provider,
    };

    if ((mergedOptions as Record<string, unknown>)?.response_format) {
      metadataPayload.response_format = (mergedOptions as Record<string, unknown>).response_format;
    }

    await persistGeneration(
      supabase,
      user.id,
      user.app_metadata?.role ?? null,
      body.action_key,
      prompt,
      aiResult,
      metadataPayload,
    );

    const response = {
      success: true,
      action: body.action_key,
      model: aiResult.model,
      provider: aiResult.provider,
      output: aiResult.content,
      tokens: {
        prompt: aiResult.tokens_prompt,
        completion: aiResult.tokens_completion,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-router error", error);
    if (error instanceof HttpError) {
      return new Response(JSON.stringify({ error: error.message, details: error.details }), {
        status: error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected server error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
