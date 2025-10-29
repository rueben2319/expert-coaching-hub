import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { setupTokenSync } from "@/lib/tokenSync";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientCourses from "./pages/client/Courses";
import MyCourses from "./pages/client/MyCourses";
import CourseViewer from "./pages/client/CourseViewer";
import ClientSessions from "./pages/client/Sessions";
import ClientMeetingRoom from "./pages/client/MeetingRoom";
import ClientAnalytics from "./pages/client/ClientAnalytics";
import CoachDashboard from "./pages/coach/CoachDashboard";
import CoachCourses from "./pages/coach/Courses";
import CreateCourse from "./pages/coach/CreateCourse";
import EditCourse from "./pages/coach/EditCourse";
import Sessions from "./pages/coach/Sessions";
import CreateSession from "./pages/coach/CreateSession";
import MeetingRoom from "./pages/coach/MeetingRoom";
import Students from "./pages/coach/Students";
import Schedule from "./pages/coach/Schedule";
import Analytics from "./pages/coach/Analytics";
import CoachBilling from "./pages/coach/Billing";
import BillingSuccess from "./pages/coach/BillingSuccess";
import CoachSettings from "./pages/coach/CoachSettings";
import Withdrawals from "./pages/coach/Withdrawals";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/Users";
import UserDetail from "./pages/admin/UserDetail";
import AdminWithdrawals from "./pages/admin/Withdrawals";
import Profile from "./pages/Profile";
import { ThemeProvider } from "./hooks/useTheme";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

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
              path="/coach/analytics"
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  <Analytics />
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
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
