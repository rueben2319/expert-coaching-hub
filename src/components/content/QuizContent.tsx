import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface QuizQuestion {
  id: string;
  question: string;
  type: "single" | "multiple";
  options: string[];
  correctAnswers: number[]; // indices of correct answers
  explanation?: string;
}

interface QuizContentProps {
  content: {
    title?: string;
    description?: string;
    question?: string;
    options?: string[];
    correct?: number;
    explanation?: string;
    // Legacy format support
    questions?: QuizQuestion[];
    passingScore?: number; // percentage
  };
  contentId: string;
  onComplete?: () => void;
}

export function QuizContent({ content, contentId, onComplete }: QuizContentProps) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  // Convert new format to legacy format for compatibility
  const questions = content.questions || (content.question ? [{
    id: 'quiz-question',
    question: content.question,
    type: 'single' as const,
    options: content.options || [],
    correctAnswers: [content.correct || 0],
    explanation: content.explanation
  }] : []);

  const handleSingleAnswer = (questionId: string, answerIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: [answerIndex],
    }));
  };

  const handleMultipleAnswer = (questionId: string, answerIndex: number, checked: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, answerIndex].sort() };
      } else {
        return { ...prev, [questionId]: current.filter((i) => i !== answerIndex) };
      }
    });
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question) => {
      const userAnswer = answers[question.id] || [];
      const correctAnswer = question.correctAnswers;

      if (
        userAnswer.length === correctAnswer.length &&
        userAnswer.every((val, idx) => val === correctAnswer[idx])
      ) {
        correct++;
      }
    });

    return (correct / questions.length) * 100;
  };

  const isAnswerCorrect = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return false;

    const userAnswer = answers[questionId] || [];
    const correctAnswer = question.correctAnswers;

    return (
      userAnswer.length === correctAnswer.length &&
      userAnswer.every((val, idx) => val === correctAnswer[idx])
    );
  };

  const handleSubmit = async () => {
    const calculatedScore = calculateScore();
    setScore(calculatedScore);
    setSubmitted(true);

    const passed = calculatedScore >= (content.passingScore || 70);

    // Save to database
    if (user) {
      await supabase.from("content_interactions").upsert({
        user_id: user.id,
        content_id: contentId,
        is_completed: passed,
        interaction_data: {
          score: calculatedScore,
          answers,
          passed,
        },
      });
    }

    if (passed) {
      toast({ title: "Quiz passed!", description: `You scored ${calculatedScore.toFixed(0)}%` });
      if (onComplete) onComplete();
    } else {
      toast({
        title: "Quiz not passed",
        description: `You scored ${calculatedScore.toFixed(0)}%. Try again!`,
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
  };

  const allQuestionsAnswered = questions.every(
    (q) => answers[q.id] && answers[q.id].length > 0
  );

  return (
    <div className="space-y-6">
      {content.title && (
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">{content.title}</h3>
            {content.description && (
              <p className="text-sm text-muted-foreground mt-2">{content.description}</p>
            )}
          </div>
          {submitted && (
            <Badge
              variant={score >= (content.passingScore || 70) ? "default" : "destructive"}
              className="text-lg px-4 py-1"
            >
              {score.toFixed(0)}%
            </Badge>
          )}
        </div>
      )}
      
      <div className="space-y-6">
        {questions.map((question, qIndex) => (
          <div key={question.id} className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-sm text-muted-foreground">
                Q{qIndex + 1}.
              </span>
              <div className="flex-1">
                <p className="font-medium">{question.question}</p>
                {submitted && (
                  <div className="mt-2">
                    {isAnswerCorrect(question.id) ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Correct!</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Incorrect</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 ml-6">
              {question.type === "single" ? (
                <RadioGroup
                  value={answers[question.id]?.[0]?.toString()}
                  onValueChange={(value) =>
                    handleSingleAnswer(question.id, parseInt(value))
                  }
                  disabled={submitted}
                >
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={optIndex.toString()}
                        id={`${question.id}-${optIndex}`}
                      />
                      <Label
                        htmlFor={`${question.id}-${optIndex}`}
                        className={
                          submitted
                            ? question.correctAnswers.includes(optIndex)
                              ? "text-green-600 font-medium"
                              : answers[question.id]?.includes(optIndex)
                              ? "text-red-600"
                              : ""
                            : ""
                        }
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${question.id}-${optIndex}`}
                        checked={answers[question.id]?.includes(optIndex)}
                        onCheckedChange={(checked) =>
                          handleMultipleAnswer(question.id, optIndex, checked as boolean)
                        }
                        disabled={submitted}
                      />
                      <Label
                        htmlFor={`${question.id}-${optIndex}`}
                        className={
                          submitted
                            ? question.correctAnswers.includes(optIndex)
                              ? "text-green-600 font-medium"
                              : answers[question.id]?.includes(optIndex)
                              ? "text-red-600"
                              : ""
                            : ""
                        }
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submitted && question.explanation && (
              <div className="ml-6 mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {question.explanation}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-4 pt-4">
          {!submitted ? (
            <Button
              onClick={handleSubmit}
              disabled={!allQuestionsAnswered}
              className="w-full"
            >
              Submit Quiz
            </Button>
          ) : (
            <>
              {score < (content.passingScore || 70) && (
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  Retry Quiz
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
