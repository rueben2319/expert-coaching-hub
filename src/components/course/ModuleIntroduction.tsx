import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, BookOpen, Clock, Target } from "lucide-react";

interface ModuleIntroductionProps {
  title: string;
  description?: string;
  moduleNumber: number;
  totalLessons: number;
  estimatedDuration?: number;
  learningObjectives?: string[];
  onStart?: () => void;
}

export function ModuleIntroduction({
  title,
  description,
  moduleNumber,
  totalLessons,
  estimatedDuration,
  learningObjectives = [],
  onStart,
}: ModuleIntroductionProps) {
  return (
    <div className="relative">
      {/* Hero Banner */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 rounded-lg overflow-hidden mb-8">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,0,0,0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        {/* Content */}
        <div className="relative h-full flex flex-col justify-center items-center text-center p-6">
          <Badge variant="secondary" className="mb-4">
            Module {moduleNumber}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-lg text-muted-foreground max-w-2xl">
              {description}
            </p>
          )}
          
          {/* Scroll Prompt */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-bounce">
            <Button variant="ghost" size="sm" onClick={onStart}>
              <ArrowDown className="mr-2 h-4 w-4" />
              Scroll to begin
            </Button>
          </div>
        </div>
      </div>

      {/* Module Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lessons</p>
                <p className="text-2xl font-bold">{totalLessons}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {estimatedDuration && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-2xl font-bold">{estimatedDuration}m</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Objectives</p>
                <p className="text-2xl font-bold">{learningObjectives.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Objectives */}
      {learningObjectives.length > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Learning Objectives
            </h3>
            <ul className="space-y-3">
              {learningObjectives.map((objective, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">{index + 1}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{objective}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
