import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { callSupabaseFunction } from '@/lib/supabaseFunctions';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { adminSidebarSections } from '@/config/navigation';

interface UserData {
  data: any[];
  total: number;
}

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const queryClient = useQueryClient();

  // Update search when URL params change
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

  const fetchUsers = async ({ queryKey }: any) => {
    const [_key, page, search] = queryKey;
    const offset = page * pageSize;

    // Optimized query: Fetch profiles with roles in a single query using join
    let profilesQuery = supabase
      .from('profiles')
      .select(`
        id, 
        full_name, 
        email, 
        created_at,
        user_roles!left(role)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (search && search.trim()) {
      const trimmedSearch = search.trim();
      
      // Limit search length to prevent DoS attacks
      if (trimmedSearch.length > 100) {
        throw new Error("Search query too long (max 100 characters)");
      }
      
      // Sanitize special LIKE characters (% and _) to prevent injection
      // Escape backslashes first, then escape % and _
      const sanitizedSearch = trimmedSearch
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/%/g, '\\%')     // Escape % 
        .replace(/_/g, '\\_');    // Escape _
      
      const searchPattern = `%${sanitizedSearch}%`;
      profilesQuery = profilesQuery.or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`);
    }

    const { data: profiles, error, count } = await profilesQuery;
    if (error) throw error;

    if (!profiles || profiles.length === 0) return { data: [], total: 0 };

    // Enrich profiles with roles from the joined data
    // user_roles is an array (left join), take the first role if available
    const enriched = profiles.map((p: any) => {
      const roleData = Array.isArray(p.user_roles) && p.user_roles.length > 0 
        ? p.user_roles[0] 
        : null;
      
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        created_at: p.created_at,
        role: roleData?.role || 'client'
      };
    });

    return { data: enriched, total: count ?? enriched.length };
  };

  const { data, isLoading, refetch } = useQuery<UserData>({
    queryKey: ['admin-users', page, search],
    queryFn: fetchUsers,
    placeholderData: (previousData) => previousData, // Replaces keepPreviousData in v5
  });

  const mutation = useMutation({
    mutationFn: (payload: { user_id: string; role: string }) => callSupabaseFunction('upsert-user-role', payload),
    onSuccess: async () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Search and manage platform users</p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Search by name or email" 
            value={search} 
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) {
                setSearchParams({ search: e.target.value });
              } else {
                setSearchParams({});
              }
            }} 
          />
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
