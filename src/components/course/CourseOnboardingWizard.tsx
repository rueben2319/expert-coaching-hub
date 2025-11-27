import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  Circle,
  GraduationCap,
  BookOpen,
  Users,
  DollarSign,
  Rocket,
  Lightbulb
} from "lucide-react";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  action?: () => void;
  actionText?: string;
}

interface CourseOnboardingWizardProps {
  onStepComplete?: (stepId: string) => void;
  onComplete?: () => void;
  initialStep?: number;
}

export function CourseOnboardingWizard({ 
  onStepComplete, 
  onComplete,
  initialStep = 0 
}: CourseOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const steps: WizardStep[] = [
    {
      id: "basics",
      title: "Course Basics",
      description: "Fill in your course title, description, and basic information",
      icon: <BookOpen className="w-6 h-6" />,
      completed: completedSteps.has("basics"),
      action: () => {
        // Navigate to course basics section
        console.log("Navigate to course basics");
        markStepComplete("basics");
      },
      actionText: "Add Course Details"
    },
    {
      id: "pricing",
      title: "Pricing Setup",
      description: "Set whether your course is free or paid, and configure pricing",
      icon: <DollarSign className="w-6 h-6" />,
      completed: completedSteps.has("pricing"),
      action: () => {
        // Navigate to pricing section
        console.log("Navigate to pricing");
        markStepComplete("pricing");
      },
      actionText: "Configure Pricing"
    },
    {
      id: "modules",
      title: "Create Modules",
      description: "Add course modules to structure your content",
      icon: <GraduationCap className="w-6 h-6" />,
      completed: completedSteps.has("modules"),
      action: () => {
        // Navigate to modules section
        console.log("Navigate to modules");
        markStepComplete("modules");
      },
      actionText: "Add First Module"
    },
    {
      id: "lessons",
      title: "Add Lessons",
      description: "Create lessons within your modules with engaging content",
      icon: <Lightbulb className="w-6 h-6" />,
      completed: completedSteps.has("lessons"),
      action: () => {
        // Navigate to lessons section
        console.log("Navigate to lessons");
        markStepComplete("lessons");
      },
      actionText: "Create First Lesson"
    },
    {
      id: "content",
      title: "Add Content",
      description: "Upload videos, add text, create quizzes, and enrich your lessons",
      icon: <Rocket className="w-6 h-6" />,
      completed: completedSteps.has("content"),
      action: () => {
        // Navigate to content section
        console.log("Navigate to content");
        markStepComplete("content");
      },
      actionText: "Add Course Content"
    },
    {
      id: "publish",
      title: "Publish Course",
      description: "Review your course and publish it for students to enroll",
      icon: <Users className="w-6 h-6" />,
      completed: completedSteps.has("publish"),
      action: () => {
        // Navigate to publish section
        console.log("Navigate to publish");
        markStepComplete("publish");
      },
      actionText: "Publish Course"
    }
  ];

  const markStepComplete = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepId);
    setCompletedSteps(newCompleted);
    onStepComplete?.(stepId);
    
    // Auto-advance to next step
    const currentIndex = steps.findIndex(step => step.id === stepId);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(currentIndex + 1);
    } else {
      onComplete?.();
    }
  };

  const progress = (completedSteps.size / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Rocket className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Course Creation Wizard</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Follow these steps to create your first course. We'll guide you through each phase of the process.
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your Progress</h3>
              <span className="text-sm text-muted-foreground">
                {completedSteps.size} of {steps.length} steps completed
              </span>
            </div>
            
            <Progress value={progress} className="h-2" />
            
            <div className="flex flex-wrap gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 px-3 py-1 rounded-full border text-sm"
                >
                  {step.completed ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={step.completed ? "text-green-700" : "text-muted-foreground"}>
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Step */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              currentStepData.completed 
                ? "bg-green-100 text-green-700" 
                : "bg-primary/10 text-primary"
            }`}>
              {currentStepData.icon}
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {currentStepData.title}
                {currentStepData.completed && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Completed
                  </Badge>
                )}
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                {currentStepData.description}
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Step Content */}
          <div className="bg-muted/30 rounded-lg p-6">
            <h4 className="font-semibold mb-3">What you need to do:</h4>
            <ul className="space-y-2 text-sm">
              {getStepInstructions(currentStepData.id).map((instruction, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {instruction}
                </li>
              ))}
            </ul>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="font-semibold text-blue-900 mb-1">Pro Tip</h5>
                <p className="text-sm text-blue-800">
                  {getStepTip(currentStepData.id)}
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          {currentStepData.action && (
            <div className="flex justify-center">
              <Button
                onClick={currentStepData.action}
                size="lg"
                className="flex items-center gap-2"
              >
                {currentStepData.actionText}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous Step
        </Button>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </div>
        
        <Button
          variant="outline"
          onClick={nextStep}
          disabled={currentStep === steps.length - 1}
          className="flex items-center gap-2"
        >
          Next Step
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function getStepInstructions(stepId: string): string[] {
  const instructions: Record<string, string[]> = {
    basics: [
      "Choose a clear, descriptive title for your course",
      "Write a compelling description that highlights what students will learn",
      "Select the appropriate difficulty level (beginner, intermediate, advanced)",
      "Add relevant tags and categories for better discoverability"
    ],
    pricing: [
      "Decide whether your course will be free or paid",
      "If paid, set a reasonable price based on course value and length",
      "Consider offering a free introductory module to attract students",
      "Review platform fees and payment processing options"
    ],
    modules: [
      "Break your course into logical modules or sections",
      "Give each module a clear title and brief description",
      "Arrange modules in a progressive order",
      "Aim for 3-7 modules for optimal student engagement"
    ],
    lessons: [
      "Create individual lessons within each module",
      "Keep lessons focused on specific topics or skills",
      "Estimate lesson duration to help students plan their time",
      "Mix different lesson types (video, text, interactive)"
    ],
    content: [
      "Upload video content or add text-based lessons",
      "Create quizzes to test student understanding",
      "Add supplementary materials like PDFs or links",
      "Ensure all content is high-quality and engaging"
    ],
    publish: [
      "Review all course content for accuracy and completeness",
      "Test all videos, links, and interactive elements",
      "Write a compelling course announcement",
      "Set your course live and start promoting it"
    ]
  };
  
  return instructions[stepId] || [];
}

function getStepTip(stepId: string): string {
  const tips: Record<string, string> = {
    basics: "Look at similar courses in your field for inspiration on titles and descriptions that attract students.",
    pricing: "Research what competitors charge for similar courses. Consider offering a lower price initially to build reviews.",
    modules: "Think about the learning journey - what should students know after each module?",
    lessons: "Keep lessons between 5-20 minutes for better attention retention. Break complex topics into multiple lessons.",
    content: "Mix different content types to keep students engaged. Videos work well for demonstrations, text for detailed explanations.",
    publish: "Consider launching with a promotional offer or early-bird discount to generate initial enrollment."
  };
  
  return tips[stepId] || "Take your time to get this step right - quality matters more than speed.";
}
