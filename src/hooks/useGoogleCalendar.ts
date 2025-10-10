import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleCalendarService, GoogleCalendarEvent, GoogleCalendarResponse } from '@/integrations/google/calendar';
import { toast } from 'sonner';

export interface CreateMeetingData {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  timeZone?: string;
}

export const useGoogleCalendar = () => {
  const [isValidating, setIsValidating] = useState(false);
  const queryClient = useQueryClient();

  // Check if user has valid Google Calendar access
  const validateAccess = useCallback(async () => {
    setIsValidating(true);
    try {
      const isValid = await googleCalendarService.validateAccess();
      return isValid;
    } catch (error) {
      console.error('Calendar access validation error:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Query for listing calendar events
  const useCalendarEvents = (options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    enabled?: boolean;
  } = {}) => {
    return useQuery({
      queryKey: ['calendar-events', options],
      queryFn: () => googleCalendarService.listEvents('primary', {
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        maxResults: options.maxResults || 50,
        singleEvents: true,
        orderBy: 'startTime',
      }),
      enabled: options.enabled !== false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry if it's an auth error
        if (error?.message?.includes('access token') || error?.message?.includes('unauthorized')) {
          return false;
        }
        return failureCount < 2;
      },
    });
  };

  // Mutation for creating calendar events with Google Meet
  const createMeetingMutation = useMutation({
    mutationFn: (data: CreateMeetingData) => 
      googleCalendarService.createMeetingWithGoogleMeet(data),
    onSuccess: (data) => {
      toast.success('Meeting created successfully!');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      return data;
    },
    onError: (error: any) => {
      console.error('Failed to create meeting:', error);
      toast.error(error.message || 'Failed to create meeting');
      throw error;
    },
  });

  // Mutation for updating calendar events
  const updateEventMutation = useMutation({
    mutationFn: ({ eventId, event }: { eventId: string; event: Partial<GoogleCalendarEvent> }) =>
      googleCalendarService.updateEvent('primary', eventId, event),
    onSuccess: () => {
      toast.success('Meeting updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: (error: any) => {
      console.error('Failed to update meeting:', error);
      toast.error(error.message || 'Failed to update meeting');
    },
  });

  // Mutation for deleting calendar events
  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) =>
      googleCalendarService.deleteEvent('primary', eventId),
    onSuccess: () => {
      toast.success('Meeting deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete meeting:', error);
      toast.error(error.message || 'Failed to delete meeting');
    },
  });

  // Query for getting a specific event
  const useCalendarEvent = (eventId: string, enabled: boolean = true) => {
    return useQuery({
      queryKey: ['calendar-event', eventId],
      queryFn: () => googleCalendarService.getEvent('primary', eventId),
      enabled: enabled && !!eventId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return {
    // Access validation
    validateAccess,
    isValidating,

    // Event queries
    useCalendarEvents,
    useCalendarEvent,

    // Event mutations
    createMeeting: createMeetingMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,

    // Loading states
    isCreatingMeeting: createMeetingMutation.isPending,
    isUpdatingEvent: updateEventMutation.isPending,
    isDeletingEvent: deleteEventMutation.isPending,

    // Error states
    createMeetingError: createMeetingMutation.error,
    updateEventError: updateEventMutation.error,
    deleteEventError: deleteEventMutation.error,
  };
};
