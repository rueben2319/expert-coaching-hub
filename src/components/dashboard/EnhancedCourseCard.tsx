import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { CourseCardViewModel } from "@/hooks/useEnrollmentProgress";

interface EnhancedCourseCardProps {
  card: CourseCardViewModel;
  onContinue: (courseId: string) => void;
}

export function EnhancedCourseCard({ card, onContinue }: EnhancedCourseCardProps) {
  const getLevelColor = (level: string | null) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-500/10 text-green-700 hover:bg-green-500/20';
      case 'intermediate':
        return 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20';
      case 'advanced':
        return 'bg-purple-500/10 text-purple-700 hover:bg-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 hover:bg-gray-500/20';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="line-clamp-2 flex-1">{card.title}</CardTitle>
          {card.level && (
            <Badge variant="outline" className={`text-xs ${getLevelColor(card.level)}`}>
              {card.level}
            </Badge>
          )}
        </div>
        <CardDescription className="line-clamp-2">{card.description}</CardDescription>
        {card.category && (
          <Badge variant="secondary" className="text-xs mt-2">
            {card.category}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{card.progress}%</span>
            </div>
            <Progress value={Math.max(card.progress, 5)} />
          </div>
          <Button 
            className="w-full" 
            onClick={() => onContinue(card.courseId)}
            variant={card.progress === 100 ? "outline" : "default"}
          >
            {card.progress === 100 ? "Review Course" : "Continue Learning"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
