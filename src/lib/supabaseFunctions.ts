import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Supabase anon key for function calls - using environment variable
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

export interface CancelGoogleMeetParams {
  meetingId: string;
  calendarEventId: string;
}

export interface CancelGoogleMeetResponse {
  success: boolean;
  message: string;
  error?: string;
}

export async function cancelGoogleMeet(params: CancelGoogleMeetParams): Promise<CancelGoogleMeetResponse> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }
    
    if (!session?.access_token) {
      throw new Error('No valid session found. Please sign in again.');
    }

    const { data, error } = await supabase.functions.invoke('cancel-google-meet', {
      body: params,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (error) {
      logger.error('Edge function error:', error);
      throw new Error(`Function call failed: ${error.message}`);
    }

    return data as CancelGoogleMeetResponse;
  } catch (error) {
    logger.error('Error canceling Google Meet:', error);
    throw error;
  }
}

export async function callSupabaseFunction<TParams = any, TResponse = any>(
  functionName: string,
  params: TParams
): Promise<TResponse> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }

    if (!session?.access_token) {
      throw new Error('No valid session found. Please sign in again.');
    }

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    if (!SUPABASE_URL) {
      throw new Error('VITE_SUPABASE_URL environment variable is not set');
    }
    const functionUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
    logger.log(`Calling function '${functionName}'`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Function call failed with status ${response.status}:`, errorText);
      throw new Error(`Function call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as TResponse;
  } catch (error) {
    logger.error(`Error calling function '${functionName}':`, error);
    throw error;
  }
}

export const useCancelGoogleMeetMutation = () => {
  return {
    mutationFn: cancelGoogleMeet,
    onError: (error: Error) => {
      logger.error('Failed to cancel Google Meet:', error.message);
    },
    onSuccess: (data: CancelGoogleMeetResponse) => {
      logger.log('Google Meet cancelled successfully:', data);
    },
  };
};

export const handleCancelMeeting = async (meetingId: string, calendarEventId: string) => {
  try {
    const result = await cancelGoogleMeet({ meetingId, calendarEventId });
    
    if (result.success) {
      logger.log('Meeting cancelled successfully');
      return result;
    } else {
      throw new Error(result.message || 'Failed to cancel meeting');
    }
  } catch (error) {
    logger.error('Error in handleCancelMeeting:', error);
    throw error;
  }
};
