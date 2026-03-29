import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, BookOpen, Hourglass, Users, Video } from "lucide-react";
import type { CoachDashboardMetrics } from "@/features/coach-dashboard/hooks/useCoachDashboardData";

type KpiGridProps = {
  metrics: CoachDashboardMetrics;
  onOpenFinancialAnalytics: () => void;
  onOpenWithdrawals: () => void;
  onOpenCourses: () => void;
  onOpenStudents: () => void;
  onOpenAnalytics: () => void;
};

export function KpiGrid({
  metrics,
  onOpenFinancialAnalytics,
  onOpenWithdrawals,
  onOpenCourses,
  onOpenStudents,
  onOpenAnalytics,
}: KpiGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onOpenFinancialAnalytics}>
        <CardHeader>
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Banknote className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Total Earnings</CardTitle>
          <CardDescription>Lifetime earnings from courses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2 text-green-600">CR {metrics.earnings.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground">Updated in real-time</p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onOpenWithdrawals}>
        <CardHeader>
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
            <Hourglass className="w-6 h-6 text-amber-600" />
          </div>
          <CardTitle>For Withdrawal</CardTitle>
          <CardDescription>Available credit balance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2 text-amber-600">CR {metrics.availableBalance.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground">Ready for payout</p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onOpenCourses}>
        <CardHeader>
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>My Courses</CardTitle>
          <CardDescription>Manage your course content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2 text-primary">{metrics.courses}</div>
          <p className="text-sm text-muted-foreground">
            {metrics.courses === 1 ? "Course created" : "Courses created"}
          </p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onOpenStudents}>
        <CardHeader>
          <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-accent" />
          </div>
          <CardTitle>Students</CardTitle>
          <CardDescription>View your enrolled students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2 text-accent">{metrics.students}</div>
          <p className="text-sm text-muted-foreground">
            {metrics.students === 1 ? "Student enrolled" : "Students enrolled"}
          </p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onOpenAnalytics}>
        <CardHeader>
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Video className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>Lessons</CardTitle>
          <CardDescription>Total lesson content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2 text-blue-600">{metrics.lessons}</div>
          <p className="text-sm text-muted-foreground">
            {metrics.lessons === 1 ? "Lesson created" : "Lessons created"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
