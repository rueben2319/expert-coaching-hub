import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Shield,
  Calendar,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';

interface TokenStatus {
  hasTokens: boolean;
  isExpired: boolean;
  expiresAt?: Date;
  refreshCount: number;
  lastRefresh?: Date;
  scope?: string;
  isValid?: boolean;
}

// Helper function to safely parse ISO date strings
const parseISODate = (isoString: string | null | undefined): Date | undefined => {
  if (!isoString) return undefined;
  try {
    const date = new Date(isoString);
    return isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
};

export function TokenManagementDashboard({
  compact = false,
  onTokenRefresh,
}: {
  compact?: boolean;
  onTokenRefresh?: () => void;
}) {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchTokenStatus = async () => {
    try {
      setIsLoading(true);
      
      // Call Edge Function to get token status
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const response = await fetch(`/functions/v1/get-token-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch token status');
      }

      const result = await response.json();
      
      // Convert ISO date strings to Date objects
      const normalizedTokenStatus: TokenStatus = {
        ...result.tokenStatus,
        expiresAt: parseISODate(result.tokenStatus.expiresAt),
        lastRefresh: parseISODate(result.tokenStatus.lastRefresh),
      };
      
      setTokenStatus(normalizedTokenStatus);
    } catch (error: any) {
      console.error('Token status fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch token status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      setIsRefreshing(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const response = await fetch(`/functions/v1/refresh-google-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Token Refreshed',
          description: 'Google OAuth token has been refreshed successfully',
        });
        
        await fetchTokenStatus();
        onTokenRefresh?.();
      } else {
        throw new Error(result.error || 'Token refresh failed');
      }
    } catch (error: any) {
      console.error('Token refresh error:', error);
      toast({
        title: 'Refresh Failed',
        description: error.message || 'Failed to refresh token',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokenStatus();
  }, []);

  if (isLoading) {
    return (
      <Card className={compact ? "border-dashed" : ""}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading token status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tokenStatus) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load token status. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusIcon = () => {
    if (!tokenStatus.hasTokens) return <XCircle className="h-4 w-4 text-red-500" />;
    if (tokenStatus.isExpired) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!tokenStatus.hasTokens) return 'No Google OAuth token';
    if (tokenStatus.isExpired) return 'Token expired';
    return 'Token valid';
  };

  const getStatusColor = (): 'default' | 'secondary' | 'destructive' => {
    if (!tokenStatus.hasTokens) return 'destructive';
    if (tokenStatus.isExpired) return 'secondary';
    return 'default';
  };

  if (compact) {
    return (
      <Card className="border-dashed border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
              <Badge variant={getStatusColor()}>
                {tokenStatus.hasTokens && tokenStatus.expiresAt && !tokenStatus.isExpired
                  ? `Expires ${formatDistanceToNow(tokenStatus.expiresAt, { addSuffix: true })}`
                  : 'Needs attention'
                }
              </Badge>
            </div>
            
            {tokenStatus.hasTokens && (
              <Button
                size="sm"
                variant="outline"
                onClick={refreshToken}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          OAuth Token Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token Status */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <div className="font-medium">{getStatusText()}</div>
              {tokenStatus.expiresAt && (
                <div className="text-sm text-muted-foreground">
                  {tokenStatus.isExpired 
                    ? `Expired ${formatDistanceToNow(tokenStatus.expiresAt, { addSuffix: true })}`
                    : `Expires ${formatDistanceToNow(tokenStatus.expiresAt, { addSuffix: true })}`
                  }
                </div>
              )}
            </div>
          </div>
          
          <Badge variant={getStatusColor()}>
            {tokenStatus.hasTokens ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Token Details */}
        {tokenStatus.hasTokens && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Expiry:</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {tokenStatus.expiresAt 
                  ? format(tokenStatus.expiresAt, 'MMM d, yyyy h:mm a')
                  : 'Unknown'
                }
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" />
                <span className="font-medium">Refreshes:</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {tokenStatus.refreshCount} times
                {tokenStatus.lastRefresh && (
                  <div className="text-xs">
                    Last: {formatDistanceToNow(tokenStatus.lastRefresh, { addSuffix: true })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scope Information */}
        {tokenStatus.scope && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Permissions:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {tokenStatus.scope.split(' ').map((scope, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {scope.replace('https://www.googleapis.com/auth/', '')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={refreshToken}
            disabled={isRefreshing || !tokenStatus.hasTokens}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Token'}
          </Button>
          
          <Button
            onClick={fetchTokenStatus}
            variant="outline"
            size="sm"
          >
            <Info className="h-4 w-4 mr-2" />
            Check Status
          </Button>
        </div>

        {/* Warning for expired tokens */}
        {tokenStatus.isExpired && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your Google OAuth token has expired. Some features may not work until you refresh the token or sign in again.
            </AlertDescription>
          </Alert>
        )}

        {/* Info about token management */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Google OAuth tokens expire after 1 hour. The system automatically refreshes them when needed, 
            but you can manually refresh here if experiencing issues.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
