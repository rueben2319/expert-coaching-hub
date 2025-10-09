import { Card, CardContent } from "@/components/ui/card";

interface TextContentProps {
  content: {
    text: string;
    format?: "html" | "markdown" | "plain";
  };
}

export function TextContent({ content }: TextContentProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div 
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: content.text }}
        />
      </CardContent>
    </Card>
  );
}
