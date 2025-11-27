import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Database, CheckCircle } from "lucide-react";

interface DatabaseStatusProps {
  tableName: string;
  isLoading?: boolean;
  hasError?: boolean;
  children?: React.ReactNode;
}

export function DatabaseStatus({ 
  tableName, 
  isLoading = false, 
  hasError = false,
  children 
}: DatabaseStatusProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="w-4 h-4 animate-pulse" />
            <span>Loading {tableName}...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            Database Setup Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            The <code className="bg-muted px-1 rounded">{tableName}</code> table needs to be created. 
            Please run the database migrations to enable this feature.
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">To fix this:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Run: <code className="bg-muted px-1 rounded">supabase db push --include-all</code></li>
              <li>Or apply migrations manually in Supabase Dashboard</li>
              <li>Refresh the page after migrations complete</li>
            </ol>
          </div>
          <Badge variant="outline" className="text-orange-600">
            Feature temporarily unavailable
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
