import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callSupabaseFunction } from '@/lib/supabaseFunctions';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const queryClient = useQueryClient();

  const fetchUsers = async ({ queryKey }: any) => {
    const [_key, page, search] = queryKey;
    const offset = page * pageSize;

    let query = supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (search && search.trim()) {
      query = query.ilike('full_name', `%${search}%`).or(`email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const ids = (data || []).map((d: any) => d.id);
    if (ids.length === 0) return { data: [], total: 0 };

    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', ids as string[]);
    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

    const enriched = (data || []).map((d: any) => ({ ...d, role: roleMap[d.id] || 'client' }));
    return { data: enriched, total: enriched.length };
  };

  const { data, isLoading, refetch } = useQuery(['admin-users', page, search], fetchUsers, { keepPreviousData: true });

  const mutation = useMutation((payload: { user_id: string; role: string }) => callSupabaseFunction('upsert-user-role', payload), {
    onSuccess: async () => {
      toast.success('Role updated');
      queryClient.invalidateQueries(['admin-users']);
      refetch();
    },
    onError: (err: any) => {
      console.error('Role update failed', err);
      toast.error(err?.message || 'Failed to update role');
    },
  });

  const handleChangeRole = async (userId: string, role: string) => {
    if (!userId) return;
    mutation.mutate({ user_id: userId, role });
  };

  const navItems = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Courses', href: '/admin/courses' },
    { label: 'Settings', href: '/admin/settings' },
  ];

  const sidebarSections = [];

  return (
    <DashboardLayout navItems={navItems} sidebarSections={sidebarSections} brandName="Admin Panel">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Search and manage platform users</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search by name or email" value={search} onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
          <Button onClick={() => { setPage(0); refetch(); }}>Search</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>List of registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                {isLoading ? (
                  <tr><td colSpan={5} className="py-6 px-4 text-center">Loading...</td></tr>
                ) : data && data.data && data.data.length > 0 ? (
                  data.data.map((u: any) => (
                    <tr key={u.id} className="hover:bg-muted-foreground/5">
                      <td className="py-3 px-4 align-top">{u.full_name || 'Unnamed'}</td>
                      <td className="py-3 px-4 align-top text-sm text-muted-foreground">{u.email}</td>
                      <td className="py-3 px-4 align-top text-sm">
                        <select value={u.role} onChange={(e) => handleChangeRole(u.id, e.target.value)} className="border px-2 py-1 rounded">
                          <option value="client">Client</option>
                          <option value="coach">Coach</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 align-top text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 align-top text-sm">
                        <Button variant="ghost" size="sm" onClick={() => window.location.href = `/admin/users/${u.id}`}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="py-6 px-4 text-center">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => { setPage(Math.max(0, page - 1)); refetch(); }} disabled={page === 0}>Previous</Button>
              <Button variant="ghost" size="sm" onClick={() => { setPage(page + 1); refetch(); }} className="ml-2">Next</Button>
            </div>
            <div className="text-sm text-muted-foreground">Showing {data?.data?.length ?? 0} users</div>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
