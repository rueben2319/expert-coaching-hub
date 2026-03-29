import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Users, AlertTriangle } from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { coachSidebarSections } from "@/config/navigation";
import { useAuth } from "@/hooks/useAuth";
import { StudentsDesktopTable } from "@/features/coach-students/components/StudentsDesktopTable";
import { StudentsMobileCards } from "@/features/coach-students/components/StudentsMobileCards";
import { useCoachStudentsData } from "@/features/coach-students/hooks/useCoachStudentsData";
import { selectFilteredStudents } from "@/features/coach-students/selectors";
import type { StudentSortOption } from "@/features/coach-students/types";

export default function Students() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [sort, setSort] = useState<StudentSortOption>("last-active-desc");

  const { students, isLoading, isError, refetch } = useCoachStudentsData({ coachId: user?.id });

  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    if (urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams, searchTerm]);

  const filteredStudents = useMemo(
    () =>
      selectFilteredStudents({
        students,
        searchTerm,
        sort,
      }),
    [students, searchTerm, sort],
  );

  return (
    <DashboardLayout sidebarSections={coachSidebarSections} brandName="Experts Coaching Hub">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground">Manage and track your students&apos; progress</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchTerm(value);

                  if (value) {
                    setSearchParams({ search: value });
                  } else {
                    setSearchParams({});
                  }
                }}
                className="pl-10"
              />
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value as StudentSortOption)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-active-desc">Recently Active</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="progress-desc">Highest Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading && (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-2 text-muted-foreground">Loading students...</p>
          </div>
        )}

        {!isLoading && isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h3 className="text-lg font-semibold">Couldn&apos;t load students</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We hit an error fetching courses, enrollments, or lesson progress.
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && filteredStudents.length > 0 && (
          <>
            <StudentsDesktopTable students={filteredStudents} />
            <StudentsMobileCards students={filteredStudents} />
          </>
        )}

        {!isLoading && !isError && filteredStudents.length === 0 && (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">
              {searchTerm ? "No students found" : "No students yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Try a different name or email, then retry if data is stale."
                : "Students will appear here once they enroll in your courses."}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
