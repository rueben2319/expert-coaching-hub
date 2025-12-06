import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MeetingManager } from '@/lib/meetingUtils';
import { toast } from 'sonner';

interface GoogleCalendarStatusProps {
  onStatusChange?: (isConnected: boolean) => void;
  showReconnectButton?: boolean;
  compact?: boolean;
}

export const GoogleCalendarStatus = ({ 
  onStatusChange, 
  showReconnectButton = true,
  compact = false 
}: GoogleCalendarStatusProps) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { user } = useAuth();

  const checkCalendarAccess = async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      const hasAccess = await MeetingManager.validateGoogleCalendarAccess();
      setIsConnected(hasAccess);
      onStatusChange?.(hasAccess);
    } catch (error: any) {
      console.error('Failed to check calendar access:', error);
      setIsConnected(false);
      onStatusChange?.(false);
      
      // Only show error toast for unexpected errors, not for expected auth issues
      if (!error.message?.includes('Please reconnect') && 
          !error.message?.includes('Please sign in') &&
          !error.message?.includes('calendar permissions')) {
        toast.error('Failed to check Google Calendar status');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      console.log('[Calendar] Reconnecting with redirect:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly'
          ].join(' '),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'  // Changed from 'consent' to avoid re-consent issues
          }
        },
      });

      if (error) {
        throw error;
      }

      // Manual redirect fallback for mobile browsers
      if (data?.url) {
        console.log('[Calendar] Redirecting to:', data.url);
        window.location.href = data.url;
      } else {
        toast.success('Redirecting to Google for calendar access...');
      }
    } catch (error: any) {
      console.error('Failed to reconnect Google Calendar:', error);
      toast.error(error.message || 'Failed to reconnect Google Calendar');
      setIsReconnecting(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkCalendarAccess();
    }
  }, [user]);

  // Listen for auth state changes (when user returns from OAuth)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        // Small delay to ensure token is available
        timeoutId = setTimeout(() => {
          checkCalendarAccess();
        }, 1000);
      }
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  if (!user) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        <span className="text-sm">Google Calendar:</span>
        {isConnected === null || isChecking ? (
          <Badge variant="secondary">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Checking...
          </Badge>
        ) : isConnected ? (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        )}
        {!isConnected && isConnected !== null && showReconnectButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReconnect}
            disabled={isReconnecting}
          >
            {isReconnecting ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar Integration
        </CardTitle>
        <CardDescription>
          Connect your Google Calendar to create meetings with Google Meet links
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {isConnected === null || isChecking ? (
                <Badge variant="secondary">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Checking...
                </Badge>
              ) : isConnected ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={checkCalendarAccess}
              disabled={isChecking}
            >
              {isChecking ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {isConnected === false && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Google Calendar is not connected. To create meetings with Google Meet links, 
                you need to sign in with Google and grant calendar permissions.
              </AlertDescription>
            </Alert>
          )}

          {isConnected === true && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your Google Calendar is connected. You can now create meetings with automatic Google Meet links.
              </AlertDescription>
            </Alert>
          )}

          {!isConnected && isConnected !== null && showReconnectButton && (
            <Button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="w-full"
            >
              {isReconnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect Google Calendar
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
