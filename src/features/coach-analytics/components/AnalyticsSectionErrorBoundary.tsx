import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AnalyticsSectionErrorBoundaryProps = {
  sectionName: string;
  children: ReactNode;
};

export function AnalyticsSectionErrorBoundary({
  sectionName,
  children,
}: AnalyticsSectionErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Unable to load {sectionName}
            </CardTitle>
            <CardDescription>
              Please refresh the page or try again later.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This section encountered an unexpected error.
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
