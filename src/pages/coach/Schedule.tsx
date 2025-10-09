import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Plus, Users, BarChart3, Calendar, Video, Clock, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";

const Schedule = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const events = [
    {
      id: 1,
      title: "JavaScript Q&A Session",
      type: "session",
      date: "2024-01-15",
      time: "14:00",
      duration: "60 min",
      attendees: 12,
      course: "JavaScript Fundamentals"
    },
    {
      id: 2,
      title: "Course Content Review",
      type: "task",
      date: "2024-01-15",
      time: "16:00",
      duration: "30 min",
      course: "React Masterclass"
    },
    {
      id: 3,
      title: "Portfolio Review Session",
      type: "session",
      date: "2024-01-18",
      time: "10:00",
      duration: "120 min",
      attendees: 15,
      course: "Web Development Bootcamp"
    },
    {
      id: 4,
      title: "Student Progress Check",
      type: "task",
      date: "2024-01-16",
      time: "09:00",
      duration: "45 min",
      course: "Node.js Backend"
    }
  ];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(currentDate);

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "session": return "bg-blue-100 text-blue-800";
      case "task": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  return (
    <DashboardLayout
      navItems={coachNavItems}
      sidebarSections={coachSidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Schedule</h1>
            <p className="text-muted-foreground">Manage your coaching schedule and appointments</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">
            {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Weekly Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDates.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div key={index} className={`bg-muted/30 rounded-lg p-4 min-h-[200px] ${isToday ? 'ring-2 ring-primary' : ''}`}>
                <div className="text-center mb-3">
                  <div className="text-sm text-muted-foreground">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                    {date.getDate()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="bg-white rounded p-2 text-xs border-l-2 border-primary">
                      <div className="flex items-center gap-1 mb-1">
                        <Badge className={getEventTypeColor(event.type)} variant="secondary">
                          {event.type}
                        </Badge>
                      </div>
                      <div className="font-medium text-sm mb-1">{event.title}</div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {event.time}
                      </div>
                      {event.attendees && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {event.attendees}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upcoming Events List */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Upcoming Events</h3>
          <div className="grid gap-3">
            {events.slice(0, 3).map((event) => (
              <div key={event.id} className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{event.title}</h4>
                      <Badge className={getEventTypeColor(event.type)}>
                        {event.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.course}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {event.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {event.time} ({event.duration})
                      </div>
                      {event.attendees && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {event.attendees} attendees
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="outline" size="sm">Cancel</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Schedule;