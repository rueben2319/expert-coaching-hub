import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Users, Shield, Settings, BarChart3, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalCourses, setTotalCourses] = useState<number | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: "Courses", href: "/admin/courses" },
    { label: "Settings", href: "/admin/settings" },
  ];

  const sidebarSections = [
    {
      title: "Management",
      items: [
        {
          icon: <Users className="h-4 w-4" />,
          label: "User Management",
          href: "/admin/users",
        },
        {
          icon: <BookOpen className="h-4 w-4" />,
          label: "Course Management",
          href: "/admin/courses",
        },
        {
          icon: <Shield className="h-4 w-4" />,
          label: "Roles & Permissions",
          href: "/admin/roles",
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          icon: <BarChart3 className="h-4 w-4" />,
          label: "Analytics",
          href: "/admin/analytics",
        },
        {
          icon: <Settings className="h-4 w-4" />,
          label: "System Settings",
          href: "/admin/settings",
        },
        {
          icon: <AlertCircle className="h-4 w-4" />,
          label: "Reports",
          href: "/admin/reports",
        },
      ],
    },
  ];

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        // total users from profiles
        const usersCountRes = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (mounted) setTotalUsers(usersCountRes.count ?? 0);

        // total courses
        const coursesCountRes = await supabase.from('courses').select('*', { count: 'exact', head: true });
        if (mounted) setTotalCourses(coursesCountRes.count ?? 0);

        // recent users
        const { data: recent, error: recentErr } = await supabase
          .from('profiles')
          .select('id, full_name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(6);
        if (recentErr) console.error('Error loading recent users', recentErr);

        if (recent && recent.length > 0) {
          // fetch roles for those users
          const ids = recent.map((r: any) => r.id);
          const { data: roleRows, error: roleErr } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', ids as string[]);
          if (roleErr) console.error('Error fetching roles for recent users', roleErr);
          const roleMap: Record<string, string> = {};
          (roleRows || []).forEach((row: any) => {
            roleMap[row.user_id] = row.role;
          });

          const enriched = recent.map((r: any) => ({ ...r, role: roleMap[r.id] || 'client' }));
          if (mounted) setRecentUsers(enriched);
        } else {
          if (mounted) setRecentUsers([]);
        }
      } catch (e) {
        console.error('Error loading admin stats', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarSections={sidebarSections}
      brandName="Admin Panel"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Monitor and manage platform activity</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Total Users</CardTitle>
            <CardDescription>Registered platform users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-primary">{loading ? '...' : totalUsers ?? 0}</div>
            <p className="text-sm text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>Total Courses</CardTitle>
            <CardDescription>Published courses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-accent">{loading ? '...' : totalCourses ?? 0}</div>
            <p className="text-sm text-muted-foreground">Courses available</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and access</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/admin/users'}>Manage Users</Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Users</h2>
        <div className="overflow-x-auto">
          {recentUsers.length === 0 ? (
            <div className="text-muted-foreground">No recent users</div>
          ) : (
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted-foreground/5">
                    <td className="py-3 px-4 align-top">{u.full_name || 'Unnamed'}</td>
                    <td className="py-3 px-4 align-top text-sm text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4 align-top text-sm">{u.role}</td>
                    <td className="py-3 px-4 align-top text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 align-top text-sm">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/users/${u.id}`)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
