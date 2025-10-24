import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { clientSidebarSections } from "@/config/navigation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar,
  Clock,
  Video,
  Users,
  Search,
  ExternalLink,
  MessageCircle,
  Eye,
  AlertCircle,
  User,
  Check
} from 'lucide-react';
import { format, formatDistanceToNow, isAfter, isBefore, addHours, addMinutes } from 'date-fns';

interface Meeting {
  id: string;
  summary: string;
  description?: string;
  start_time: string;
  end_time: string;
  meet_link?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  attendees?: string[];
  user_id: string;
  course_id?: string;
  calendar_event_id?: string;
  created_at: string;
}

export default function ClientSessions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // Update search query when URL params change
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  // Fetch meetings where user is an attendee
  const { data: meetings, isLoading, error } = useQuery({
    queryKey: ['client-meetings', user?.id],
    queryFn: async () => {
      if (!user?.email) throw new Error('User email not available');

      console.log('=== CLIENT SESSIONS DEBUG ===');
      console.log('Current user:', { id: user.id, email: user.email });
      console.log('Fetching meetings for client:', user.email);

      // First get all meetings, then filter client-side
      // This is more reliable than complex JSONB queries
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          user_id
        `)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching meetings:', error);
        throw error;
      }

      console.log(`=== DATABASE QUERY RESULTS ===`);
      console.log(`Total meetings in database: ${data?.length || 0}`);
      
      if (data && data.length > 0) {
        console.log('All meetings in database:');
        data.forEach((meeting, index) => {
          console.log(`${index + 1}. ID: ${meeting.id}, Summary: "${meeting.summary}", Attendees:`, meeting.attendees, `User ID: ${meeting.user_id}`);
        });
      }

      // Filter meetings where user is an attendee
      const userMeetings = (data || []).filter(meeting => {
        const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : [];
        const isAttendee = attendees.includes(user.email);
        console.log(`=== FILTERING MEETING ${meeting.id} ===`);
        console.log(`Summary: "${meeting.summary}"`);
        console.log(`Attendees array:`, attendees);
        console.log(`User email: "${user.email}"`);
        console.log(`Is attendee: ${isAttendee}`);
        return isAttendee;
      });

      console.log(`=== FINAL RESULTS ===`);
      console.log(`Filtered to ${userMeetings.length} meetings for this client`);
      if (userMeetings.length > 0) {
        userMeetings.forEach((meeting, index) => {
          const attendeesArray = Array.isArray(meeting.attendees) ? meeting.attendees : [];
          console.log(`${index + 1}. "${meeting.summary}" - ${attendeesArray.length} attendees`);
        });
      }

      return userMeetings as Meeting[];
    },
    enabled: !!user?.email,
  });

  // TEMPORARY: Check all meetings in database (remove after debugging)
  const { data: allMeetings } = useQuery({
    queryKey: ['all-meetings-debug'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching all meetings:', error);
        return [];
      }

      console.log('=== ALL MEETINGS IN DATABASE (LAST 10) ===');
      data.forEach((meeting, index) => {
        console.log(`${index + 1}. ${meeting.summary} - Created: ${meeting.created_at}`);
        console.log(`   Attendees:`, meeting.attendees);
        console.log(`   Status: ${meeting.status}, User ID: ${meeting.user_id}`);
        console.log(`   Calendar Event ID: ${meeting.calendar_event_id}`);
        console.log(`   Meet Link: ${meeting.meet_link}`);
      });

      return data;
    },
  });

  // Get coach info for meetings
  const { data: coachEmails } = useQuery({
    queryKey: ['coach-emails', meetings?.map(m => m.user_id)],
    queryFn: async () => {
      if (!meetings?.length) return {};

      const coachIds = [...new Set(meetings.map(m => m.user_id))];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', coachIds);

      if (error) {
        console.error('Error fetching coach emails:', error);
        return {};
      }

      const emailMap = data.reduce((acc: Record<string, string>, profile) => {
        acc[profile.id] = profile.email;
        return acc;
      }, {});

      console.log('Coach emails:', emailMap);
      return emailMap;
    },
    enabled: !!meetings?.length,
  });

  // Get acceptance status for meetings
  const { data: acceptedMeetings } = useQuery({
    queryKey: ['client-meeting-acceptances', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};

      const { data, error } = await supabase
        .from('meeting_analytics')
        .select('meeting_id, event_type')
        .eq('user_id', user.id)
        .eq('event_type', 'invitation_accepted');

      if (error) {
        console.error('Error fetching meeting acceptances:', error);
        return {};
      }

      // Create a map of meeting_id -> accepted status
      const acceptanceMap: Record<string, boolean> = {};
      data.forEach(record => {
        acceptanceMap[record.meeting_id] = true;
      });

      return acceptanceMap;
    },
    enabled: !!user?.id,
  });

  // Accept meeting invitation
  const acceptInvitation = async (meeting: Meeting) => {
    try {
      await supabase.from('meeting_analytics').insert({
        meeting_id: meeting.id,
        user_id: user?.id,
        event_type: 'invitation_accepted',
        event_data: {
          timestamp: new Date().toISOString(),
          user_role: 'client'
        },
      });

      // Refresh the acceptance status
      queryClient.invalidateQueries({ queryKey: ['client-meeting-acceptances', user?.id] });

      // Could also send a notification or update to coach here
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  // Get meeting status with color coding
  const getMeetingStatus = (meeting: Meeting) => {
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(meeting.end_time);
    
    if (meeting.status === 'cancelled') return { status: 'cancelled', color: 'destructive', label: 'Cancelled' };
    if (meeting.status === 'completed') return { status: 'completed', color: 'secondary', label: 'Completed' };
    if (now >= startTime && now <= endTime) return { status: 'in_progress', color: 'default', label: 'In Progress' };
    if (now < startTime) return { status: 'scheduled', color: 'secondary', label: 'Scheduled' };
    return { status: 'completed', color: 'secondary', label: 'Completed' };
  };

  // Check if coach is attending the meeting
  const isCoachAttending = (meeting: Meeting) => {
    const coachEmail = coachEmails?.[meeting.user_id];
    if (!coachEmail) {
      console.log(`No coach email found for meeting ${meeting.id}, user_id: ${meeting.user_id}`);
      return false;
    }
    
    const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : [];
    const isAttending = attendees.includes(coachEmail);
    
    console.log(`Meeting ${meeting.id}: Coach email ${coachEmail}, attendees: ${attendees.join(', ')}, is attending: ${isAttending}`);
    return isAttending;
  };

  // Check if meeting can be joined (within 15 minutes of start time)
  const canJoinMeeting = (meeting: Meeting) => {
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(meeting.end_time);
    const joinWindowStart = addMinutes(startTime, -15); // 15 minutes before

    return now >= joinWindowStart && now <= endTime && meeting.status !== 'cancelled';
  };

  // Join Google Meet
  const joinMeeting = (meeting: Meeting) => {
    if (meeting.meet_link) {
      // Track analytics
      supabase.from('meeting_analytics').insert({
        meeting_id: meeting.id,
        user_id: user?.id,
        event_type: 'join_clicked',
        event_data: {
          timestamp: new Date().toISOString(),
          user_role: 'client'
        },
      });

      window.open(meeting.meet_link, '_blank');
    }
  };

  // Filter meetings based on search query
  const filteredMeetings = meetings?.filter(meeting =>
    meeting.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Group meetings by status
  const upcomingMeetings = filteredMeetings.filter(m => {
    const status = getMeetingStatus(m);
    return status.status === 'scheduled' || status.status === 'in_progress';
  });

  const pastMeetings = filteredMeetings.filter(m => {
    const status = getMeetingStatus(m);
    return status.status === 'completed' || status.status === 'cancelled';
  });

  if (isLoading) {
    return (
      <DashboardLayout
        sidebarSections={clientSidebarSections}
        brandName="Experts Coaching Hub"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          
          <Skeleton className="h-10 w-full max-w-sm" />
          
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        sidebarSections={clientSidebarSections}
        brandName="Experts Coaching Hub"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load your sessions. Please try again later.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebarSections={clientSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Sessions</h1>
            <p className="text-muted-foreground">
              View and join your coaching sessions
            </p>
          </div>
        </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) {
                setSearchParams({ search: e.target.value });
              } else {
                setSearchParams({});
              }
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Upcoming Sessions */}
      {upcomingMeetings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
          <div className="grid gap-4">
            {upcomingMeetings.map((meeting) => {
              const statusInfo = getMeetingStatus(meeting);
              const canJoin = canJoinMeeting(meeting);
              
              return (
                <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{meeting.summary}</CardTitle>
                        {meeting.description && (
                          <p className="text-sm text-muted-foreground">{meeting.description}</p>
                        )}
                      </div>
                      <Badge variant={statusInfo.color as any}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Date & Time */}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="font-medium">
                            {format(new Date(meeting.start_time), 'MMM d, yyyy')}
                          </div>
                          <div className="text-muted-foreground">
                            {format(new Date(meeting.start_time), 'h:mm a')} - {format(new Date(meeting.end_time), 'h:mm a')}
                          </div>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="font-medium">Duration</div>
                          <div className="text-muted-foreground">
                            {Math.round((new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / (1000 * 60))} minutes
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Accept Invitation Button - only show if not accepted yet */}
                      {!acceptedMeetings?.[meeting.id] && (
                        <Button onClick={() => acceptInvitation(meeting)} className="gap-2 bg-green-600 hover:bg-green-700">
                          <Check className="h-4 w-4" />
                          Accept Invitation
                        </Button>
                      )}

                      {/* Show accepted badge if invitation was accepted */}
                      {acceptedMeetings?.[meeting.id] && (
                        <div className="flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" />
                          <span className="text-sm font-medium">Accepted</span>
                        </div>
                      )}

                      {meeting.meet_link && canJoin && (
                        <Button onClick={() => joinMeeting(meeting)} className="gap-2">
                          <Video className="h-4 w-4" />
                          Join Meeting
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/client/sessions/${meeting.id}`)}
                        className="gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        View Details
                      </Button>

                      {!canJoin && meeting.meet_link && (
                        <p className="text-sm text-muted-foreground ml-auto">
                          Join available 15 minutes before start time
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {pastMeetings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Past Sessions</h2>
          <div className="grid gap-4">
            {pastMeetings.map((meeting) => {
              const statusInfo = getMeetingStatus(meeting);
              
              return (
                <Card key={meeting.id} className="opacity-75 hover:opacity-100 transition-opacity">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{meeting.summary}</CardTitle>
                        {meeting.description && (
                          <p className="text-sm text-muted-foreground">{meeting.description}</p>
                        )}
                      </div>
                      <Badge variant={statusInfo.color as any}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Date & Time */}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="font-medium">
                            {format(new Date(meeting.start_time), 'MMM d, yyyy')}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDistanceToNow(new Date(meeting.start_time), { addSuffix: true })}
                          </div>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="font-medium">Duration</div>
                          <div className="text-muted-foreground">
                            {Math.round((new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / (1000 * 60))} minutes
                          </div>
                        </div>
                      </div>

                      {/* Attendees */}
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="font-medium flex items-center gap-2">
                            {meeting.attendees?.length || 0} participants
                            {isCoachAttending(meeting) && (
                              <div className="flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                <User className="h-3 w-3" />
                                Coach attending
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/client/sessions/${meeting.id}`)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredMeetings.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Sessions Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? "No sessions match your search criteria." 
                : "You don't have any scheduled sessions yet. Your coach will invite you to sessions when they're created."
              }
            </p>
            {searchQuery && (
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </DashboardLayout>
  );
}
