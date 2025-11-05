import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { adminSidebarSections } from "@/config/navigation";
import { BookOpen, Search, Eye } from "lucide-react";

export default function AdminCourses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses", page, search, statusFilter],
    queryFn: async () => {
      const offset = page * pageSize;
      let query = supabase
        .from("courses")
        .select(`
          *,
          coach:coach_id (full_name, email),
          enrollments:course_enrollments(count)
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      if (search.trim()) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { data: data || [], total: count || 0 };
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      published: "default",
      draft: "secondary",
      archived: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Course Management
        </h1>
        <p className="text-muted-foreground">Monitor and manage all platform courses</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter courses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-12">Loading courses...</div>
        ) : courses && courses.data.length > 0 ? (
          courses.data.map((course: any) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  {getStatusBadge(course.status)}
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                </div>
                <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {course.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coach:</span>
                    <span className="font-medium">{course.coach?.full_name || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Enrollments:</span>
                    <span className="font-medium">{course.enrollments?.[0]?.count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">
                      {course.is_free ? "Free" : formatCurrency(Number(course.price_credits))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Level:</span>
                    <span className="font-medium">{course.level || "N/A"}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => navigate(`/coach/courses/${course.id}/edit`)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Course
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No courses found
          </div>
        )}
      </div>

      {/* Pagination */}
      {courses && courses.data.length > 0 && (
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Showing {courses.data.length} of {courses.total} courses
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={courses.data.length < pageSize}
          >
            Next
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
