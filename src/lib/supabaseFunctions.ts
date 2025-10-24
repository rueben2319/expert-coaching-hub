import { supabase } from '@/integrations/supabase/client';

// Supabase anon key for function calls - using environment variable
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

/**
 * Utility functions for calling Supabase Edge Functions with proper authorization
 */

export interface CancelGoogleMeetParams {
  meetingId: string;
  calendarEventId: string;
}

export interface CancelGoogleMeetResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Cancel a Google Meet event via Supabase Edge Function
 * This function properly forwards the user's authorization token
 */
export async function cancelGoogleMeet(params: CancelGoogleMeetParams): Promise<CancelGoogleMeetResponse> {
  try {
    // Get the current session to access the access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }
    
    if (!session?.access_token) {
      throw new Error('No valid session found. Please sign in again.');
    }

    // Call the Edge Function with proper authorization headers
    const { data, error } = await supabase.functions.invoke('cancel-google-meet', {
      body: params,
      headers: {
        // Forward the user's authorization token
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(`Function call failed: ${error.message}`);
    }

    return data as CancelGoogleMeetResponse;
  } catch (error) {
    console.error('Error canceling Google Meet:', error);
    throw error;
  }
}

/**
 * Generic function to call any Supabase Edge Function with proper auth
 */
export async function callSupabaseFunction<TParams = any, TResponse = any>(
  functionName: string,
  params: TParams
): Promise<TResponse> {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }

    if (!session?.access_token) {
      console.log('No session found, current session state:', session);
      throw new Error('No valid session found. Please sign in again.');
    }

    console.log('Session token present:', !!session.access_token);

    // Use direct fetch instead of supabase.functions.invoke
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    if (!SUPABASE_URL) {
      throw new Error('VITE_SUPABASE_URL environment variable is not set');
    }
    const functionUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
    console.log(`Calling function '${functionName}' with params:`, JSON.stringify(params, null, 2));
    console.log(`Function URL: ${functionUrl}`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY, // Add the anon key
      },
      body: JSON.stringify(params),
    });

    console.log('Request headers:', {
      'Authorization': `Bearer ${session.access_token ? 'present' : 'missing'}`,
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY ? 'present' : 'missing',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Function call failed with status ${response.status}:`, errorText);
      throw new Error(`Function call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as TResponse;
  } catch (error) {
    console.error(`Error calling function '${functionName}':`, error);
    throw error;
  }
}

/**
 * Example usage patterns for different scenarios
 */

// For React Query mutations
export const useCancelGoogleMeetMutation = () => {
  return {
    mutationFn: cancelGoogleMeet,
    onError: (error: Error) => {
      console.error('Failed to cancel Google Meet:', error.message);
    },
    onSuccess: (data: CancelGoogleMeetResponse) => {
      console.log('Google Meet cancelled successfully:', data);
    },
  };
};

// For direct async/await usage
export const handleCancelMeeting = async (meetingId: string, calendarEventId: string) => {
  try {
    const result = await cancelGoogleMeet({ meetingId, calendarEventId });
    
    if (result.success) {
      console.log('Meeting cancelled successfully');
      return result;
    } else {
      throw new Error(result.message || 'Failed to cancel meeting');
    }
  } catch (error) {
    console.error('Error in handleCancelMeeting:', error);
    throw error;
  }
};
