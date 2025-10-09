import { Toaster } from "@/components/ui/toaster";
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
import CoachDashboard from "./pages/coach/CoachDashboard";
import CoachCourses from "./pages/coach/Courses";
import CreateCourse from "./pages/coach/CreateCourse";
import EditCourse from "./pages/coach/EditCourse";
import AdminDashboard from "./pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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

            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
