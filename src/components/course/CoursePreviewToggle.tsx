import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Eye, 
  EyeOff, 
  User, 
  GraduationCap,
  Lock,
  Unlock,
  AlertTriangle
} from "lucide-react";
import { usePreviewMode } from "./PreviewModeProvider";

interface CoursePreviewToggleProps {
  courseStatus?: "draft" | "published" | "archived";
  hasContent?: boolean;
  isPublished?: boolean;
}

export function CoursePreviewToggle({ 
  courseStatus = "draft",
  hasContent = true,
  isPublished = false
}: CoursePreviewToggleProps) {
  const { isPreviewMode, togglePreviewMode, previewAsRole, setPreviewAsRole } = usePreviewMode();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPreviewWarnings = () => {
    const warnings = [];
    
    if (!hasContent) {
      warnings.push("No course content added yet");
    }
    
    if (!isPublished && courseStatus === "draft") {
      warnings.push("Course is not published");
    }
    
    if (previewAsRole === "student" && courseStatus !== "published") {
      warnings.push("Students can only view published courses");
    }
    
    return warnings;
  };

  const warnings = getPreviewWarnings();

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            {isPreviewMode ? (
              <>
                <Eye className="w-5 h-5 text-blue-600" />
                Preview Mode
              </>
            ) : (
              <>
                <EyeOff className="w-5 h-5 text-gray-400" />
                Edit Mode
              </>
            )}
          </span>
          
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(courseStatus)}>
              {courseStatus}
            </Badge>
            
            <Button
              onClick={togglePreviewMode}
              variant={isPreviewMode ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-2"
            >
              {isPreviewMode ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Exit Preview
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Preview
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      {isPreviewMode && (
        <CardContent className="space-y-4">
          {/* Role Selection */}
          <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-blue-900">Preview as:</span>
            <div className="flex gap-2">
              <Button
                variant={previewAsRole === "student" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewAsRole("student")}
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Student
              </Button>
              <Button
                variant={previewAsRole === "coach" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewAsRole("coach")}
                className="flex items-center gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                Coach
              </Button>
            </div>
          </div>

          {/* Preview Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {previewAsRole === "student" ? (
                <>
                  <Lock className="w-4 h-4 text-orange-500" />
                  <span className="text-orange-700">
                    Student View: Limited access to course content
                  </span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 text-green-500" />
                  <span className="text-green-700">
                    Coach View: Full access to all course content
                  </span>
                </>
              )}
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
                  <AlertTriangle className="w-4 h-4" />
                  Preview Limitations:
                </div>
                <ul className="space-y-1 ml-6">
                  {warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-orange-600 flex items-start gap-2">
                      <span className="w-1 h-1 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Actions Available */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Available Actions in {previewAsRole === "student" ? "Student" : "Coach"} View:
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                {previewAsRole === "student" ? (
                  <>
                    <div>✓ View course content</div>
                    <div>✓ Watch videos</div>
                    <div>✓ Take quizzes</div>
                    <div>✓ Leave reviews</div>
                    <div>✗ Edit course</div>
                    <div>✗ Manage modules</div>
                    <div>✗ Publish/unpublish</div>
                    <div>✗ View analytics</div>
                  </>
                ) : (
                  <>
                    <div>✓ View course content</div>
                    <div>✓ Edit course details</div>
                    <div>✓ Manage modules</div>
                    <div>✓ Add/edit lessons</div>
                    <div>✓ Publish/unpublish</div>
                    <div>✓ View analytics</div>
                    <div>✓ Manage enrollments</div>
                    <div>✓ View reviews</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
