import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Play, Sparkles, Target } from "lucide-react";
import type { EnrichedEnrollment } from "@/hooks/useClientHomeData";

interface UpNextCardProps {
  upNextCourse?: EnrichedEnrollment;
  isLoading?: boolean;
}

export function UpNextCard({ upNextCourse, isLoading = false }: UpNextCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="bg-card/70 backdrop-blur">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/70 backdrop-blur">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Up next
          </CardTitle>
          <CardDescription>
            {upNextCourse
              ? `Continue your progress on ${upNextCourse.courses.title}.`
              : "No courses in progress yet. Start a new journey today."}
          </CardDescription>
        </div>
        {upNextCourse && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Enrolled{" "}
              {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                new Date(upNextCourse.enrolled_at),
              )}
            </Badge>
            <Badge variant="outline" className="text-xs uppercase">
              {upNextCourse.courses.status}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {upNextCourse ? (
          <>
            <div className="space-y-2 max-w-xl">
              <h2 className="text-2xl font-semibold leading-tight">{upNextCourse.courses.title}</h2>
              <p className="text-muted-foreground text-sm line-clamp-2">
                {upNextCourse.courses.description || "Stay engaged and complete your course milestones."}
              </p>
              <div className="max-w-md">
                <Progress value={Math.max(upNextCourse.calculatedProgress, 5)} />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(upNextCourse.calculatedProgress)}% complete
                </p>
              </div>
            </div>
            <Button
              className="w-full md:w-auto"
              onClick={() => navigate(`/client/course/${upNextCourse.courses.id}`)}
            >
              <Play className="mr-2 h-4 w-4" />
              Continue learning
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
            <div>
              <h2 className="text-2xl font-semibold">Ready to start learning?</h2>
              <p className="text-muted-foreground text-sm">
                Browse curated courses and begin your first lesson.
              </p>
            </div>
            <Button className="md:w-auto" onClick={() => navigate(`/client/courses`)}>
              <Target className="mr-2 h-4 w-4" />
              Find courses
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
