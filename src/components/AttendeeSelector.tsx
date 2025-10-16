import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Users, Mail, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCoachClients, type CoachClient } from "@/hooks/useCoachClients";
import { cn } from "@/lib/utils";

interface AttendeeSelectorProps {
  courseId?: string;
  selectedEmails: string[];
  onEmailsChange: (emails: string[]) => void;
  error?: string;
}

export const AttendeeSelector = ({ 
  courseId, 
  selectedEmails, 
  onEmailsChange, 
  error 
}: AttendeeSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [manualEmails, setManualEmails] = useState("");
  const { data: clients, isLoading } = useCoachClients(courseId);

  // Parse manual emails and combine with selected clients
  useEffect(() => {
    const manualEmailList = manualEmails
      .split(",")
      .map(email => email.trim())
      .filter(email => email && email.includes("@"));
    
    const clientEmails = selectedEmails.filter(email => 
      clients?.some(client => client.email === email)
    );
    
    const allEmails = [...new Set([...clientEmails, ...manualEmailList])];
    onEmailsChange(allEmails);
  }, [manualEmails, clients]);

  const handleClientToggle = (client: CoachClient) => {
    const isSelected = selectedEmails.includes(client.email);
    if (isSelected) {
      onEmailsChange(selectedEmails.filter(email => email !== client.email));
    } else {
      onEmailsChange([...selectedEmails, client.email]);
    }
  };

  const removeEmail = (emailToRemove: string) => {
    onEmailsChange(selectedEmails.filter(email => email !== emailToRemove));
    
    // If it's a manual email, remove it from the textarea
    const manualEmailList = manualEmails
      .split(",")
      .map(email => email.trim())
      .filter(email => email !== emailToRemove);
    setManualEmails(manualEmailList.join(", "));
  };

  const getClientByEmail = (email: string) => {
    return clients?.find(client => client.email === email);
  };

  const isManualEmail = (email: string) => {
    return !clients?.some(client => client.email === email);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Select Attendees
        </Label>
        
        {courseId && (
          <p className="text-xs text-muted-foreground">
            Showing clients enrolled in the selected course
          </p>
        )}
        
        {!courseId && (
          <p className="text-xs text-muted-foreground">
            Showing all clients from your courses
          </p>
        )}

        {/* Quick Select All Button */}
        {!courseId && clients && clients.length > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const allClientEmails = clients.map(client => client.email);
                const newEmails = selectedEmails.length === clients.length 
                  ? [] // If all are selected, deselect all
                  : [...new Set([...selectedEmails.filter(email => !clients.some(client => client.email === email)), ...allClientEmails])];
                onEmailsChange(newEmails);
              }}
              className="text-xs"
            >
              {selectedEmails.filter(email => clients.some(client => client.email === email)).length === clients.length
                ? "Deselect All"
                : "Select All Clients"
              }
            </Button>
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={isLoading}
            >
              {isLoading ? (
                "Loading clients..."
              ) : clients?.length === 0 ? (
                "No clients available"
              ) : (
                `Select from ${clients?.length || 0} available clients`
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search clients..." />
              <CommandEmpty>No clients found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {clients?.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.full_name} ${client.email}`}
                    onSelect={() => handleClientToggle(client)}
                  >
                    <div className="flex items-center space-x-3 w-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={client.avatar_url} />
                        <AvatarFallback>
                          {client.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{client.full_name}</div>
                        <div className="text-sm text-muted-foreground truncate">{client.email}</div>
                        {client.course_title && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {client.course_title}
                          </div>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedEmails.includes(client.email) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Manual Email Input - Primary Option */}
      <div className="space-y-2">
        <Label htmlFor="manual-emails" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Add Attendee Emails
        </Label>
        <Textarea
          id="manual-emails"
          placeholder="Enter email addresses separated by commas&#10;Example: client1@example.com, client2@example.com"
          rows={3}
          value={manualEmails}
          onChange={(e) => setManualEmails(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Add attendee email addresses. You can also select from enrolled clients above.
        </p>
      </div>

      {/* Selected Attendees */}
      {selectedEmails.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selected Attendees ({selectedEmails.length})</Label>
          <div className="flex flex-wrap gap-2">
            {selectedEmails.map((email) => {
              const client = getClientByEmail(email);
              const manual = isManualEmail(email);
              
              return (
                <Badge
                  key={email}
                  variant={manual ? "secondary" : "default"}
                  className="flex items-center gap-1 pr-1"
                >
                  {client ? (
                    <div className="flex items-center gap-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={client.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {client.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-32">{client.full_name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-32">{email}</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeEmail(email)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {selectedEmails.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Select clients from the list above or add email addresses manually
        </p>
      )}
    </div>
  );
};
