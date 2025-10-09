interface TextContentProps {
  content: {
    text: string;
    format?: "html" | "markdown" | "plain";
  };
}

export function TextContent({ content }: TextContentProps) {
  return (
    <div 
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: content.text }}
    />
  );
}
