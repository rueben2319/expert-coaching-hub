import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useCoachClients, type CoachClient } from '@/hooks/useCoachClients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ExternalLink, 
  Send, 
  Users, 
  Calendar, 
  Clock,
  ArrowLeft,
  MessageCircle,
  Video,
  AlertCircle,
  CheckCircle,
  Play,
  Pause
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Meeting {
  id: string;
  summary: string;
  description?: string;
  start_time: string;
  end_time: string;
  meet_link?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  attendees?: string[] | null; // Array of email strings
  user_id: string;
  course_id?: string;
  calendar_event_id?: string;
}

interface ChatMessage {
  id: string;
  meeting_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user: {
    email: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

interface TypingUser {
  user_id: string;
  user_name: string;
  timestamp: number;
}

export default function MeetingRoom() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: clients } = useCoachClients();
  
  // State management
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get attendee display information
  const getAttendeeInfo = (email: string) => {
    const client = clients?.find(c => c.email === email);
    if (client) {
      return {
        name: client.full_name,
        email: client.email,
        avatar: client.avatar_url,
        isClient: true
      };
    }
    return {
      name: null,
      email: email,
      avatar: null,
      isClient: false
    };
  };

  // Get meeting status info
  const getMeetingStatus = (meeting: Meeting) => {
    const now = new Date();
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(meeting.end_time);
    
    if (meeting.status === 'cancelled') return { status: 'cancelled', color: 'destructive', label: 'Cancelled' };
    if (meeting.status === 'completed') return { status: 'completed', color: 'secondary', label: 'Completed' };
    if (now >= startTime && now <= endTime) return { status: 'in_progress', color: 'default', label: 'In Progress' };
    if (now < startTime) return { status: 'scheduled', color: 'secondary', label: 'Scheduled' };
    return { status: 'completed', color: 'secondary', label: 'Ended' };
  };

  // Fetch meeting details
  const fetchMeeting = async () => {
    if (!meetingId) return;
    
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) throw error;
      
      // Transform the data to match our Meeting interface
      const transformedMeeting: Meeting = {
        ...data,
        status: data.status as Meeting['status'],
        attendees: Array.isArray(data.attendees) 
          ? data.attendees as string[]
          : data.attendees === null 
            ? null 
            : []
      };
      
      setMeeting(transformedMeeting);
    } catch (error: any) {
      console.error('Error fetching meeting:', error);
      toast({
        title: 'Error',
        description: 'Failed to load meeting details',
        variant: 'destructive',
      });
    }
  };

  // Fetch chat messages
  const fetchMessages = async () => {
    if (!meetingId) return;
    
    try {
      const { data, error } = await supabase
        .from('meeting_chat')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get unique user IDs from messages
      const userIds = [...new Set((data || []).map(msg => msg.user_id))];
      
      // Fetch user profiles for all message senders
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      if (profileError) {
        console.error('Error fetching user profiles:', profileError);
      }

      // Map messages with user data
      const messagesWithUsers = (data || []).map(message => {
        const userProfile = profiles?.find(p => p.id === message.user_id);
        return {
          ...message,
          user: userProfile ? {
            email: userProfile.email || '',
            user_metadata: {
              full_name: userProfile.full_name || userProfile.email || 'Unknown User',
              avatar_url: userProfile.avatar_url
            }
          } : {
            email: `user-${message.user_id}`,
            user_metadata: {
              full_name: `User ${message.user_id.slice(0, 8)}`
            }
          }
        };
      });

      setMessages(messagesWithUsers as ChatMessage[]);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat messages',
        variant: 'destructive',
      });
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !meetingId || !user || isSending) return;
    
    try {
      setIsSending(true);
      
      const { error } = await supabase
        .from('meeting_chat')
        .insert({
          meeting_id: meetingId,
          user_id: user.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      // Track analytics
      await supabase.from('meeting_analytics').insert({
        meeting_id: meetingId,
        user_id: user.id,
        event_type: 'chat_message_sent',
        event_data: {
          message_length: newMessage.trim().length,
          timestamp: new Date().toISOString(),
        },
      });

      setNewMessage('');
      setIsTyping(false);
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && channelRef.current) {
      setIsTyping(true);
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user?.id,
          user_name: user?.user_metadata?.full_name || user?.email || 'Unknown User',
          typing: true,
        },
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            user_id: user?.id,
            user_name: user?.user_metadata?.full_name || user?.email || 'Unknown User',
            typing: false,
          },
        });
      }
    }, 2000);
  };

  // Join Google Meet
  const joinMeeting = () => {
    if (meeting?.meet_link) {
      // Track analytics
      supabase.from('meeting_analytics').insert({
        meeting_id: meetingId!,
        user_id: user?.id,
        event_type: 'join_clicked',
        event_data: {
          meet_link: meeting.meet_link,
          timestamp: new Date().toISOString(),
        },
      });

      window.open(meeting.meet_link, '_blank');
    }
  };

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await Promise.all([fetchMeeting(), fetchMessages()]);
      setIsLoading(false);

      // Track meeting joined
      if (meetingId && user) {
        supabase.from('meeting_analytics').insert({
          meeting_id: meetingId,
          user_id: user.id,
          event_type: 'meeting_joined',
          event_data: {
            timestamp: new Date().toISOString(),
          },
        });
      }
    };

    initialize();
  }, [meetingId, user]);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!meetingId) return;

    const channel = supabase
      .channel(`meeting-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_chat',
          filter: `meeting_id=eq.${meetingId}`,
        },
        async (payload) => {
          // Fetch user profile for the new message
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const newMessage: ChatMessage = {
            ...payload.new as any,
            user: userProfile ? {
              email: userProfile.email || '',
              user_metadata: {
                full_name: userProfile.full_name || userProfile.email || 'Unknown User',
                avatar_url: userProfile.avatar_url
              }
            } : {
              email: `user-${payload.new.user_id}`,
              user_metadata: {
                full_name: `User ${payload.new.user_id.slice(0, 8)}`
              }
            },
          };

          setMessages(prev => [...prev, newMessage]);
          setTimeout(scrollToBottom, 100);
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, user_name, typing } = payload.payload;
        
        if (user_id === user?.id) return; // Don't show own typing indicator

        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== user_id);
          if (typing) {
            return [...filtered, { user_id, user_name, timestamp: Date.now() }];
          }
          return filtered;
        });
      })
      .subscribe();

    channelRef.current = channel;

    // Cleanup typing indicators periodically
    const typingCleanup = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(u => now - u.timestamp < 5000));
    }, 1000);

    return () => {
      channel.unsubscribe();
      clearInterval(typingCleanup);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [meetingId, user]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
          <div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Meeting not found or you don't have permission to access it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusInfo = getMeetingStatus(meeting);

  return (
    <div className="h-screen flex flex-col">
      {/* Compact Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/coach/sessions')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-lg font-semibold">{meeting.summary}</h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{format(new Date(meeting.start_time), 'MMM d, yyyy')}</span>
                    <span>{format(new Date(meeting.start_time), 'h:mm a')} - {format(new Date(meeting.end_time), 'h:mm a')}</span>
                    <span>{meeting.attendees?.length || 0} attendees</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant={statusInfo.color as any}>
                {statusInfo.label}
              </Badge>
              {meeting.meet_link && (
                <Button onClick={joinMeeting} className="gap-2">
                  <Video className="h-4 w-4" />
                  Join Meet
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Height */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-6 py-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            
            {/* Attendees Sidebar */}
            <div className="lg:col-span-1">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Attendees ({meeting.attendees?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  <div className="space-y-3">
                    {meeting.attendees?.map((email, index) => {
                      const attendeeInfo = getAttendeeInfo(email);
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={attendeeInfo.avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {(attendeeInfo.name || attendeeInfo.email || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {attendeeInfo.name || attendeeInfo.email}
                            </div>
                            {attendeeInfo.name && (
                              <div className="text-xs text-muted-foreground truncate">{attendeeInfo.email}</div>
                            )}
                          </div>
                          <Badge variant={attendeeInfo.isClient ? "default" : "secondary"} className="text-xs">
                            {attendeeInfo.isClient ? 'Client' : 'Guest'}
                          </Badge>
                        </div>
                      );
                    })}
                    {(!meeting.attendees || meeting.attendees.length === 0) && (
                      <p className="text-muted-foreground text-sm">No attendees added</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chat Panel - Takes remaining space */}
            <div className="lg:col-span-3">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageCircle className="h-4 w-4" />
                    Meeting Chat
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                  {/* Messages */}
                  <ScrollArea className="flex-1 px-4">
                    <div className="space-y-3 pb-4">
                      {messages.map((message) => {
                        const isOwnMessage = message.user_id === user?.id;
                        return (
                          <div key={message.id} className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                            {!isOwnMessage && (
                              <Avatar className="h-7 w-7 mt-1 flex-shrink-0">
                                <AvatarImage src={message.user.user_metadata?.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {(message.user.user_metadata?.full_name || message.user.email || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={`max-w-[70%] ${isOwnMessage ? 'order-1' : 'order-2'}`}>
                              <div className={`rounded-lg px-3 py-2 ${
                                isOwnMessage 
                                  ? 'bg-primary text-primary-foreground ml-auto' 
                                  : 'bg-muted'
                              }`}>
                                {!isOwnMessage && (
                                  <div className="text-xs font-medium mb-1 opacity-70">
                                    {message.user.user_metadata?.full_name || message.user.email || 'Unknown User'}
                                  </div>
                                )}
                                <div className="text-sm leading-relaxed">
                                  {message.message}
                                </div>
                                <div className={`text-xs mt-1 ${
                                  isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                } text-right`}>
                                  {format(new Date(message.created_at), 'HH:mm')}
                                </div>
                              </div>
                            </div>
                            {isOwnMessage && (
                              <Avatar className="h-7 w-7 mt-1 flex-shrink-0 order-2">
                                <AvatarImage src={user?.user_metadata?.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {(user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Typing Indicators */}
                      {typingUsers.length > 0 && (
                        <div className="flex gap-2 justify-start">
                          <Avatar className="h-7 w-7 mt-1 flex-shrink-0">
                            <AvatarFallback className="text-xs">
                              <div className="animate-pulse">...</div>
                            </AvatarFallback>
                          </Avatar>
                          <div className="max-w-[70%]">
                            <div className="bg-muted rounded-lg px-3 py-2">
                              <div className="text-xs font-medium mb-1 opacity-70">
                                {typingUsers.map(u => u.user_name).join(', ')}
                              </div>
                              <div className="text-sm text-muted-foreground italic flex items-center gap-1">
                                <span>typing</span>
                                <div className="flex gap-1">
                                  <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                  <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                  <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  <Separator />
                  
                  {/* Message Input */}
                  <div className="p-4 flex-shrink-0">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          handleTyping();
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        disabled={isSending}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || isSending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
