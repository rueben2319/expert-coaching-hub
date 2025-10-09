import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Home,
  BookOpen,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface Lesson {
  id: string;
  title: string;
  isCompleted: boolean;
  order_index: number;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  order_index: number;
}

interface CourseTemplateLayoutProps {
  children: ReactNode;
  courseName: string;
  providerName: string;
  modules: Module[];
  currentView: "overview" | "lesson";
  currentModuleId?: string;
  currentLessonId?: string;
  onNavigateOverview: () => void;
  onNavigateLesson: (moduleId: string, lessonId: string) => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export function CourseTemplateLayout({
  children,
  courseName,
  providerName,
  modules,
  currentView,
  currentModuleId,
  currentLessonId,
  onNavigateOverview,
  onNavigateLesson,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
}: CourseTemplateLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openModules, setOpenModules] = useState<Set<string>>(
    new Set(currentModuleId ? [currentModuleId] : [])
  );

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const getCurrentLesson = () => {
    if (!currentModuleId || !currentLessonId) return null;
    const module = modules.find((m) => m.id === currentModuleId);
    return module?.lessons.find((l) => l.id === currentLessonId);
  };

  const getCurrentModule = () => {
    if (!currentModuleId) return null;
    return modules.find((m) => m.id === currentModuleId);
  };

  const getBreadcrumbs = () => {
    const crumbs = [
      { label: "My Courses", href: "/client/my-courses" },
      { label: courseName, href: null },
    ];

    if (currentView === "lesson") {
      const module = getCurrentModule();
      const lesson = getCurrentLesson();
      if (module) crumbs.push({ label: module.title, href: null });
      if (lesson) crumbs.push({ label: lesson.title, href: null });
    } else {
      crumbs.push({ label: "Overview", href: null });
    }

    return crumbs;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Course Header */}
      <div className="p-6 border-b">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm break-words">{courseName}</h2>
            <p className="text-xs text-muted-foreground mt-1 break-words">{providerName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Overview Item */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start",
              currentView === "overview" && "bg-primary/10 text-primary"
            )}
            onClick={() => {
              onNavigateOverview();
              setSidebarOpen(false);
            }}
          >
            <Home className="mr-2 h-4 w-4" />
            Overview
          </Button>

          <Separator className="my-2" />

          {/* Modules */}
          {modules.map((module) => (
            <Collapsible
              key={module.id}
              open={openModules.has(module.id)}
              onOpenChange={() => toggleModule(module.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between hover:bg-accent gap-2 h-auto py-2"
                >
                  <span className="text-sm font-medium text-left flex-1 min-w-0 break-words whitespace-normal">
                    {module.title}
                  </span>
                  {openModules.has(module.id) ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-2 space-y-1 mt-1">
                {module.lessons.map((lesson) => {
                  const isActive =
                    currentView === "lesson" &&
                    currentModuleId === module.id &&
                    currentLessonId === lesson.id;
                  return (
                    <Button
                      key={lesson.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-sm gap-2 h-auto py-2",
                        isActive && "bg-primary/10 text-primary"
                      )}
                      onClick={() => {
                        onNavigateLesson(module.id, lesson.id);
                        setSidebarOpen(false);
                      }}
                    >
                      {lesson.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <span className="text-left flex-1 min-w-0 break-words whitespace-normal">{lesson.title}</span>
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex h-14 items-center px-4 gap-4">
          {/* Mobile Menu Toggle */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/client/my-courses")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Courses
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-80 border-r bg-card/50">
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Sticky Breadcrumbs */}
          <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="px-6 py-4">
              <Breadcrumb>
                <BreadcrumbList>
                  {getBreadcrumbs().map((crumb, index) => (
                    <div key={index} className="flex items-center">
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {crumb.href ? (
                          <BreadcrumbLink
                            onClick={() => navigate(crumb.href!)}
                            className="cursor-pointer"
                          >
                            {crumb.label}
                          </BreadcrumbLink>
                        ) : index === getBreadcrumbs().length - 1 ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <span className="text-muted-foreground">
                            {crumb.label}
                          </span>
                        )}
                      </BreadcrumbItem>
                    </div>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="container max-w-4xl mx-auto p-6">
              {children}

              {/* Navigation Buttons */}
              {currentView === "lesson" && (
                <div className="flex justify-between items-center mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={onPrev}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <Button onClick={onNext} disabled={!hasNext}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
