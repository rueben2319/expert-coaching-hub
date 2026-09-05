import { ReactNode, useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  Search,
  FileText,
  BarChart3,
  RefreshCw,
  Moon,
  Sun,
  Globe,
  Maximize2,
  Minimize2,
  Settings,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Lesson {
  id: string;
  title: string;
  isCompleted: boolean;
  order_index: number;
  lessonNumber: string; // e.g., "1.1"
}

interface Module {
  id: string;
  title: string;
  description?: string;
  lessons: Lesson[];
  order_index: number;
  moduleNumber: string; // e.g., "1"
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
  resources?: { title: string; url: string; type: string }[];
  currentLessonNumber?: string; // e.g., "1.1.2"
  currentContentNumber?: string; // e.g., "1.1.2.1"
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
  resources = [],
  currentLessonNumber,
  currentContentNumber,
}: CourseTemplateLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openModules, setOpenModules] = useState<Set<string>>(
    new Set(currentModuleId ? [currentModuleId] : [])
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"outline" | "resources">("outline");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

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

  // Calculate module progress
  const calculateModuleProgress = (module: Module) => {
    if (module.lessons.length === 0) return 0;
    const completedLessons = module.lessons.filter(l => l.isCompleted).length;
    return Math.round((completedLessons / module.lessons.length) * 100);
  };

  // Filter modules and lessons based on search query
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;

    const query = searchQuery.toLowerCase();
    return modules
      .map(module => ({
        ...module,
        lessons: module.lessons.filter(lesson =>
          lesson.title.toLowerCase().includes(query) ||
          module.title.toLowerCase().includes(query)
        )
      }))
      .filter(module => module.lessons.length > 0 || module.title.toLowerCase().includes(query));
  }, [modules, searchQuery]);

  // Auto-expand modules when searching
  useMemo(() => {
    if (searchQuery.trim()) {
      const matchingModuleIds = new Set(
        filteredModules.map(m => m.id)
      );
      setOpenModules(matchingModuleIds);
    }
  }, [searchQuery, filteredModules]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle fullscreen with 'F' key
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
      
      // Show keyboard shortcuts with '?' key
      if (e.key === '?') {
        e.preventDefault();
        setShowKeyboardShortcuts(prev => !prev);
      }
      
      // Hide controls when typing in fullscreen
      if (isFullscreen && e.key === 'Escape') {
        if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false);
        } else {
          setIsFullscreen(false);
        }
      }
      
      // Navigation shortcuts (only in lesson view)
      if (currentView === "lesson") {
        if (e.key === 'ArrowRight' && hasNext) {
          e.preventDefault();
          onNext?.();
        }
        if (e.key === 'ArrowLeft' && hasPrev) {
          e.preventDefault();
          onPrev?.();
        }
      }
    };

    // Show/hide fullscreen controls on mouse movement
    let controlsTimeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      if (isFullscreen) {
        setShowFullscreenControls(true);
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
          setShowFullscreenControls(false);
        }, 3000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(controlsTimeout);
    };
  }, [isFullscreen, showKeyboardShortcuts, currentView, hasNext, hasPrev, onNext, onPrev]);

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    setShowFullscreenControls(true);
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
      <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm break-words line-clamp-2">{courseName}</h2>
            <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-1">{providerName}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "outline" | "resources")} className="flex-1 flex flex-col">
        <div className="border-b bg-background/95 backdrop-blur">
          <TabsList className="w-full h-10 rounded-none border-0 bg-transparent">
            <TabsTrigger 
              value="outline" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Course Outline
            </TabsTrigger>
            <TabsTrigger 
              value="resources" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Resources
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="outline" className="flex-1 flex flex-col m-0 p-0">
          {/* Search Bar */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search course outline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {/* Overview Item */}
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start h-9",
                  currentView === "overview" && "bg-primary/10 text-primary font-medium"
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

              {/* Knowledge Check Section */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    My Knowledge Check
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="px-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Progress value={75} className="h-1.5 flex-1" />
                    <span className="font-medium">75%</span>
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {/* Modules */}
              {filteredModules.map((module) => {
                const moduleProgress = calculateModuleProgress(module);
                const completedLessons = module.lessons.filter(l => l.isCompleted).length;
                
                return (
                  <Collapsible
                    key={module.id}
                    open={openModules.has(module.id)}
                    onOpenChange={() => toggleModule(module.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between hover:bg-accent gap-2 h-auto py-2 px-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">
                            {module.moduleNumber}
                          </span>
                          <span className="text-sm font-medium text-left flex-1 min-w-0 break-words whitespace-normal">
                            {module.title}
                          </span>
                          <Badge variant="secondary" className="text-xs h-5 px-2">
                            {completedLessons}/{module.lessons.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {moduleProgress}%
                          </span>
                          {openModules.has(module.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-2 space-y-1 mt-1">
                      <div className="px-2 mb-2">
                        <Progress value={moduleProgress} className="h-1" />
                      </div>
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
                              "w-full justify-start text-sm gap-2 h-auto py-2 px-2",
                              isActive && "bg-primary/10 text-primary font-medium"
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
                            <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">
                              {lesson.lessonNumber}
                            </span>
                            <span className="text-left flex-1 min-w-0 break-words whitespace-normal text-xs">
                              {lesson.title}
                            </span>
                          </Button>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="resources" className="flex-1 flex flex-col m-0 p-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {resources.length > 0 ? (
                resources.map((resource, index) => (
                  <a
                    key={index}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{resource.title}</p>
                      <p className="text-xs text-muted-foreground">{resource.type}</p>
                    </div>
                  </a>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No resources available</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className={cn(
      "h-screen flex flex-col bg-background overflow-hidden",
      isFullscreen && "bg-background"
    )}>
      {/* Top Navigation Bar - Hidden in Fullscreen */}
      {!isFullscreen && (
        <header className="flex-shrink-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="flex h-14 items-center px-4 gap-4">
            {/* Mobile Menu Toggle */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 max-h-screen overflow-hidden">
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

            {/* Spacer */}
            <div className="flex-1" />

            {/* Top Navigation Controls */}
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                title="Dark Mode"
              >
                <Moon className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                title="Accessibility"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                title="Language"
              >
                <Globe className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                title="Fullscreen (F)"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                title="Keyboard Shortcuts (?)"
                onClick={() => setShowKeyboardShortcuts(true)}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar - Hidden in Fullscreen */}
        {!isFullscreen && (
          <aside className="hidden md:flex w-80 border-r bg-card/50 flex-shrink-0">
            <SidebarContent />
          </aside>
        )}

        {/* Main Content */}
        <main className={cn(
          "flex-1 flex flex-col overflow-hidden",
          isFullscreen && "w-full"
        )}>
          {/* Sticky Breadcrumbs - Hidden in Fullscreen */}
          {!isFullscreen && (
            <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className={cn(
                "container mx-auto",
                isFullscreen ? "max-w-7xl px-4 py-4" : "max-w-6xl px-6 py-6"
              )}>
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
          </div>
        </main>
      </div>

      {/* Fullscreen Controls Overlay */}
      {isFullscreen && (
        <div 
          className={cn(
            "fixed top-0 right-0 z-50 p-4 transition-opacity duration-300",
            showFullscreenControls ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center gap-2 bg-background/95 backdrop-blur rounded-lg border shadow-lg p-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              title="Exit Fullscreen (Esc)"
              onClick={toggleFullscreen}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              title="Keyboard Shortcuts (?)"
              onClick={() => setShowKeyboardShortcuts(true)}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-lg shadow-xl border max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowKeyboardShortcuts(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Toggle Fullscreen</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">F</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Show Shortcuts</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">?</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Exit Fullscreen</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">Esc</kbd>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Next Lesson</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">→</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Previous Lesson</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">←</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
