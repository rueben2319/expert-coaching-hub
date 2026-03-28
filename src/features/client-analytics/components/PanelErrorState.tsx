import { AlertTriangle } from "lucide-react";

export function PanelErrorState({
  message = "We could not load this panel right now.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        Unable to load panel
      </div>
      <p className="mt-1 text-destructive/90">{message}</p>
    </div>
  );
}
