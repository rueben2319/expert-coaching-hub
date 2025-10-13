import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { callSupabaseFunction } from '@/lib/supabaseFunctions';
import { toast } from 'sonner';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: currentRoleRow, isLoading: loadingRole } = useQuery({
    queryKey: ['admin-user-role', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('role, created_at').eq('user_id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: roleHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['admin-user-role-history', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_role_changes').select('role, changed_by, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const mutation = useMutation((payload: { user_id: string; role: string }) => callSupabaseFunction('upsert-user-role', payload), {
    onSuccess: async () => {
      toast.success('Role updated');
      queryClient.invalidateQueries(['admin-user-role', 'admin-user-role-history', 'admin-users']);
      // reload data
      await queryClient.refetchQueries({ queryKey: ['admin-user', id] });
      await queryClient.refetchQueries({ queryKey: ['admin-user-role', id] });
      await queryClient.refetchQueries({ queryKey: ['admin-user-role-history', id] });
    },
    onError: (err: any) => {
      console.error('Role update failed', err);
      toast.error(err?.message || 'Failed to update role');
    },
  });

  const handleChangeRole = (newRole: string) => {
    if (!id) return;
    if (!confirm(`Change role for this user to '${newRole}'?`)) return;
    mutation.mutate({ user_id: id, role: newRole });
  };

  const navItems = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Courses', href: '/admin/courses' },
    { label: 'Settings', href: '/admin/settings' },
  ];

  return (
    <DashboardLayout navItems={navItems} sidebarSections={[]} brandName="Admin Panel">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Detail</h1>
          <p className="text-muted-foreground">View and manage user information</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/admin/users')}>Back to Users</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>User profile information</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProfile ? (
              <div>Loading...</div>
            ) : profile ? (
              <div className="space-y-2">
                <div><strong>Name:</strong> {profile.full_name || 'Unnamed'}</div>
                <div><strong>Email:</strong> {profile.email}</div>
                <div><strong>Joined:</strong> {new Date(profile.created_at).toLocaleString()}</div>
              </div>
            ) : (
              <div>No profile found</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role</CardTitle>
            <CardDescription>Current role and quick actions</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRole ? (
              <div>Loading...</div>
            ) : (
              <div className="space-y-3">
                <div><strong>Current Role:</strong> {currentRoleRow?.role ?? 'client'}</div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => handleChangeRole('client')}>Make Client</Button>
                  <Button variant="ghost" onClick={() => handleChangeRole('coach')}>Make Coach</Button>
                  <Button variant="destructive" onClick={() => handleChangeRole('admin')}>Make Admin</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Role History</CardTitle>
            <CardDescription>Recent changes to this user's roles</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div>Loading...</div>
            ) : roleHistory && roleHistory.length > 0 ? (
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Changed By</th>
                    <th className="py-2 px-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {roleHistory.map((r: any) => (
                    <tr key={`${r.role}-${r.created_at}`} className="hover:bg-muted-foreground/5">
                      <td className="py-2 px-3">{r.role}</td>
                      <td className="py-2 px-3 text-sm text-muted-foreground">{r.changed_by || 'system'}</td>
                      <td className="py-2 px-3 text-sm text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-muted-foreground">No role changes recorded</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
