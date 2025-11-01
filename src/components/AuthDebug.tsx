import { useAuth } from "@/hooks/useAuth";

/**
 * Debug component to display auth state
 * Add this to your app temporarily to see what's happening
 */
export function AuthDebug() {
  const { user, role, loading } = useAuth();

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'black',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px',
    }}>
      <div><strong>Auth Debug:</strong></div>
      <div>Loading: {loading ? '✅ TRUE' : '❌ FALSE'}</div>
      <div>User: {user ? `✅ ${user.email}` : '❌ NULL'}</div>
      <div>Role: {role ? `✅ ${role}` : '❌ NULL'}</div>
      <div>User ID: {user?.id || 'N/A'}</div>
    </div>
  );
}
