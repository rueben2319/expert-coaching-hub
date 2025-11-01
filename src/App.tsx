import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { setupTokenSync } from "@/lib/tokenSync";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "./hooks/useTheme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ChunkLoadError } from "./components/ChunkLoadError";
import { Loader2 } from "lucide-react";

// Eager load critical pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load all other pages for code splitting
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const ClientCourses = lazy(() => import("./pages/client/Courses"));
const MyCourses = lazy(() => import("./pages/client/MyCourses"));
const CourseViewer = lazy(() => import("./pages/client/CourseViewer"));
const ClientSessions = lazy(() => import("./pages/client/Sessions"));
const ClientMeetingRoom = lazy(() => import("./pages/client/MeetingRoom"));
const ClientAnalytics = lazy(() => import("./pages/client/ClientAnalytics"));
const CoachDashboard = lazy(() => import("./pages/coach/CoachDashboard"));
const CoachCourses = lazy(() => import("./pages/coach/Courses"));
const CreateCourse = lazy(() => import("./pages/coach/CreateCourse"));
const EditCourse = lazy(() => import("./pages/coach/EditCourse"));
const Sessions = lazy(() => import("./pages/coach/Sessions"));
const CreateSession = lazy(() => import("./pages/coach/CreateSession"));
const MeetingRoom = lazy(() => import("./pages/coach/MeetingRoom"));
const Students = lazy(() => import("./pages/coach/Students"));
const Schedule = lazy(() => import("./pages/coach/Schedule"));
const CoachBilling = lazy(() => import("./pages/coach/Billing"));
const BillingSuccess = lazy(() => import("./pages/coach/BillingSuccess"));
const CoachSettings = lazy(() => import("./pages/coach/CoachSettings"));
const Withdrawals = lazy(() => import("./pages/coach/Withdrawals"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const UserDetail = lazy(() => import("./pages/admin/UserDetail"));
const AdminWithdrawals = lazy(() => import("./pages/admin/Withdrawals"));
const Profile = lazy(() => import("./pages/Profile"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: false,
    },
  },
});

const App = () => {
  // Set up automatic token synchronization
  React.useEffect(() => {
    const cleanup = setupTokenSync(60000); // Check every 60 seconds
    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="experts-coaching-hub-theme">
          <TooltipProvider>
            <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
            <ErrorBoundary FallbackComponent={ChunkLoadError}>
            <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />

            {/* Client Routes */}
            <Route 
              path="/client" 
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/client/courses" 
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientCourses />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/client/my-courses" 
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <MyCourses />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/client/course/:courseId" 
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <CourseViewer />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/client/sessions" 
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientSessions />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/client/meeting/:meetingId"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientMeetingRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/analytics"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientAnalytics />
                </ProtectedRoute>
              }
            />

            {/* Coach Routes */}
            <Route 
              path="/coach" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <CoachDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/courses" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <CoachCourses />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/courses/create" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <CreateCourse />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/courses/:courseId/edit" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <EditCourse />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/sessions" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <Sessions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/sessions/create" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <CreateSession />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/sessions/:meetingId" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <MeetingRoom />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/students" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <Students />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/coach/schedule" 
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <Schedule />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/coach/billing"
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <CoachBilling />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach/billing/success"
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <BillingSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach/settings"
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <CoachSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach/withdrawals"
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <Withdrawals />
                </ProtectedRoute>
              }
            />

            {/* Profile Route - Available to all authenticated users */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute allowedRoles={["client", "coach", "admin"]}>
                  <Profile />
                </ProtectedRoute>
              } 
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users/:id"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <UserDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/withdrawals"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminWithdrawals />
                </ProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
