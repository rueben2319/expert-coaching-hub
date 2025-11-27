import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Loader2
} from "lucide-react";
import { useAutoSave } from "./AutoSaveProvider";

interface AutoSaveIndicatorProps {
  showManualSave?: boolean;
  className?: string;
}

export function AutoSaveIndicator({ 
  showManualSave = true, 
  className = "" 
}: AutoSaveIndicatorProps) {
  const { autoSaveState, manualSave } = useAutoSave();

  const { isSaving, lastSaved, hasUnsavedChanges, saveCount } = autoSaveState;

  const getStatusIcon = () => {
    if (isSaving) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
    }
    
    if (hasUnsavedChanges) {
      return <AlertCircle className="w-4 h-4 text-orange-600" />;
    }
    
    if (lastSaved) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (isSaving) {
      return "Saving...";
    }
    
    if (hasUnsavedChanges) {
      return "Unsaved changes";
    }
    
    if (lastSaved) {
      const timeAgo = new Date().getTime() - lastSaved.getTime();
      const minutes = Math.floor(timeAgo / 60000);
      
      if (minutes < 1) {
        return "Just saved";
      } else if (minutes < 60) {
        return `Saved ${minutes}m ago`;
      } else {
        const hours = Math.floor(minutes / 60);
        return `Saved ${hours}h ago`;
      }
    }
    
    return "No changes";
  };

  const getStatusColor = () => {
    if (isSaving) {
      return "bg-blue-100 text-blue-800";
    }
    
    if (hasUnsavedChanges) {
      return "bg-orange-100 text-orange-800";
    }
    
    if (lastSaved) {
      return "bg-green-100 text-green-800";
    }
    
    return "bg-gray-100 text-gray-800";
  };

  return (
    <Card className={`border-0 shadow-sm ${className}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {getStatusText()}
                </span>
                <Badge className={getStatusColor()} variant="secondary">
                  {saveCount} save{saveCount !== 1 ? "s" : ""}
                </Badge>
              </div>
              
              {hasUnsavedChanges && (
                <p className="text-xs text-muted-foreground">
                  Changes are being saved automatically
                </p>
              )}
            </div>
          </div>

          {showManualSave && (
            <Button
              size="sm"
              variant={hasUnsavedChanges ? "default" : "outline"}
              onClick={manualSave}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Now"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
