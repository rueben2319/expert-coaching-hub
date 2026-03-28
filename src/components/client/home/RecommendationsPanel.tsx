import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecommendedCourses } from "@/components/student/RecommendedCourses";

interface RecommendationsPanelProps {
  isLoading?: boolean;
}

export function RecommendationsPanel({ isLoading = false }: RecommendationsPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  return <RecommendedCourses />;
}
