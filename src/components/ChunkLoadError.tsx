import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ChunkLoadErrorProps {
  error: Error;
  resetError: () => void;
}

/**
 * Error boundary fallback for lazy-loaded chunk failures
 * Handles network errors, cache issues, and deployment mismatches
 */
export function ChunkLoadError({ error, resetError }: ChunkLoadErrorProps) {
  const isChunkError = error.message?.includes('chunk') || 
                       error.message?.includes('Failed to fetch') ||
                       error.message?.includes('Loading chunk');

  const handleReload = () => {
    // Clear any cached chunks
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {isChunkError ? 'Failed to Load Page' : 'Something Went Wrong'}
          </h2>
          <p className="text-muted-foreground">
            {isChunkError 
              ? "The page failed to load. This might be due to a network issue or a recent update."
              : error.message || "An unexpected error occurred."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={handleReload}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
          <Button 
            variant="outline"
            onClick={resetError}
          >
            Try Again
          </Button>
        </div>

        {isChunkError && (
          <p className="text-xs text-muted-foreground">
            💡 If this persists, try clearing your browser cache or using an incognito window.
          </p>
        )}
      </div>
    </div>
  );
}
