import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { useAIAction } from "@/hooks/useAIAction";
import type { AIResponsePayload } from "@/lib/ai/aiClient";

interface CoachAIAsideProps {
  title: string;
  description?: string;
  actionKey: "course_outline_suggest" | "module_outline_suggest" | "lesson_draft_suggest" | "content_draft_suggest" | "quiz_builder_suggest" | "lesson_summarize" | "course_recommend";
  context: Record<string, unknown>;
  prompt?: string;
  onInsert?: (output: string) => void;
  customRenderer?: (data: AIResponsePayload) => React.ReactNode;
}

export function CoachAIAside({
  title,
  description,
  actionKey,
  context,
  prompt,
  onInsert,
  customRenderer,
}: CoachAIAsideProps) {
  const {
    generate,
    isLoading,
    isSuccess,
    data,
    isError,
    error,
    reset,
  } = useAIAction();

  const requestPayload = useMemo(() => {
    return { actionKey, context, prompt };
  }, [actionKey, context, prompt]);

  const showInsert = Boolean(isSuccess && data?.output && onInsert);

  return (
    <Card className="shadow-none border-muted">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground leading-snug">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => generate(requestPayload)}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate</span>
              </>
            )}
          </Button>
          {isSuccess && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => generate(requestPayload)}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Regenerate</span>
            </Button>
          )}
          {isSuccess && (
            <Button type="button" size="sm" variant="ghost" onClick={() => reset()}>
              Clear
            </Button>
          )}
        </div>

        {isError && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-md p-3">
            {error?.message ?? "Something went wrong."}
          </div>
        )}

        {isLoading && (
          <div className="text-sm text-muted-foreground">Thinking about the best suggestion…</div>
        )}

        {!isLoading && isSuccess && data && (
          <ScrollArea className="max-h-80 border rounded-md">
            <div className="p-3 space-y-3">
              {customRenderer ? (
                customRenderer(data)
              ) : (
                <Textarea
                  value={data.output}
                  readOnly
                  className="min-h-[240px] text-sm"
                />
              )}
            </div>
          </ScrollArea>
        )}

        {showInsert && (
          <Button type="button" size="sm" className="w-full" onClick={() => onInsert?.(data!.output)}>
            Insert into editor
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
