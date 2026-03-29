import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseThumbnailProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

export function CourseThumbnail({ src, alt, className, iconClassName }: CourseThumbnailProps) {
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoading(Boolean(src));
    setHasError(false);
  }, [src]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900",
        className,
      )}
    >
      {src && !hasError ? (
        <>
          <img
            src={src}
            alt={alt}
            className={cn("h-full w-full object-cover transition-opacity", isLoading ? "opacity-0" : "opacity-100")}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
            loading="lazy"
          />
          {isLoading && <div className="absolute inset-0 animate-pulse bg-muted/50" aria-hidden="true" />}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className={cn("h-8 w-8 text-purple-600", iconClassName)} />
        </div>
      )}
    </div>
  );
}
