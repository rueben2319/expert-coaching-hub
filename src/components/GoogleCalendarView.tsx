import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { googleCalendarService } from "@/integrations/google/calendar";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, endOfWeek, parseISO, isToday, isSameDay } from "date-fns";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  htmlLink: string;
  creator?: {
    email: string;
    displayName?: string;
  };
}

interface GoogleCalendarViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  showNavigation?: boolean;
}

export const GoogleCalendarView = ({ 
  currentDate, 
  onDateChange, 
  showNavigation = true 
}: GoogleCalendarViewProps) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const { toast } = useToast();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  const loadCalendarEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First validate calendar access
      const hasAccess = await googleCalendarService.validateAccess();
      setIsConnected(hasAccess);

      if (!hasAccess) {
        setEvents([]);
        return;
      }

      // Load events for the current week
      const calendarEvents = await googleCalendarService.listEvents('primary', {
        timeMin: weekStart.toISOString(),
        timeMax: weekEnd.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime'
      });

      setEvents(calendarEvents.items || []);
    } catch (err: any) {
      console.error('Failed to load calendar events:', err);
      setError(err.message);
      setIsConnected(false);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarEvents();
  }, [currentDate]);

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(weekStart, i));
    }
    return dates;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = event.start.dateTime 
        ? parseISO(event.start.dateTime)
        : parseISO(event.start.date!);
      return isSameDay(eventDate, date);
    });
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.dateTime) {
      const startTime = parseISO(event.start.dateTime);
      const endTime = parseISO(event.end.dateTime!);
      return `${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}`;
    }
    return 'All day';
  };

  const getMeetLink = (event: CalendarEvent) => {
    return event.hangoutLink || 
           event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    onDateChange(newDate);
  };

  const refreshEvents = () => {
    loadCalendarEvents();
    toast({
      title: "Calendar Refreshed",
      description: "Events have been reloaded from Google Calendar",
    });
  };

  if (isConnected === false) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Google Calendar is not connected. Please connect your account to view calendar events.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Google Calendar</h2>
          <p className="text-sm text-muted-foreground">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshEvents}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {showNavigation && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Weekly Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {getWeekDates().map((date, index) => {
          const dayEvents = getEventsForDate(date);
          const isCurrentDay = isToday(date);
          
          return (
            <Card key={index} className={`min-h-[200px] ${isCurrentDay ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-2">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">
                    {format(date, 'EEE')}
                  </div>
                  <div className={`text-sm font-semibold ${isCurrentDay ? 'text-primary' : ''}`}>
                    {format(date, 'd')}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-6 w-3/4" />
                    </>
                  ) : (
                    dayEvents.map((event) => {
                      const meetLink = getMeetLink(event);
                      return (
                        <div
                          key={event.id}
                          className="bg-blue-50 border-l-2 border-blue-500 p-2 rounded text-xs"
                        >
                          <div className="font-medium text-blue-900 mb-1 line-clamp-2">
                            {event.summary}
                          </div>
                          <div className="flex items-center gap-1 text-blue-700 mb-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatEventTime(event)}</span>
                          </div>
                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center gap-1 text-blue-700 mb-1">
                              <Users className="h-3 w-3" />
                              <span>{event.attendees.length}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            {meetLink && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs text-blue-600 hover:text-blue-800"
                                onClick={() => window.open(meetLink, '_blank')}
                              >
                                <Video className="h-3 w-3 mr-1" />
                                Meet
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 text-xs text-blue-600 hover:text-blue-800"
                              onClick={() => window.open(event.htmlLink, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {!isLoading && dayEvents.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No events
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upcoming Events List */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">This Week's Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.slice(0, 5).map((event) => {
                const meetLink = getMeetLink(event);
                const eventDate = event.start.dateTime 
                  ? parseISO(event.start.dateTime)
                  : parseISO(event.start.date!);
                
                return (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{event.summary}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(eventDate, 'EEE, MMM d')} • {formatEventTime(event)}
                      </div>
                      {event.location && (
                        <div className="text-xs text-muted-foreground">📍 {event.location}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {meetLink && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(meetLink, '_blank')}
                        >
                          <Video className="h-4 w-4 mr-1" />
                          Join
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(event.htmlLink, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
