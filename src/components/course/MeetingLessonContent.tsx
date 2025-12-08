import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Users, Video } from "lucide-react";
import { format } from "date-fns";

interface MeetingLessonContentProps {
  onSave: (content: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function MeetingLessonContent({ onSave, onCancel, initialData }: MeetingLessonContentProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    startTime: initialData?.startTime || "",
    endTime: initialData?.endTime || "",
    duration: initialData?.duration || 60,
    maxAttendees: initialData?.maxAttendees || null,
    isRequired: initialData?.isRequired ?? true,
    enableRecording: initialData?.enableRecording ?? false,
    enableWaitingRoom: initialData?.enableWaitingRoom ?? false,
    agenda: initialData?.agenda || "",
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.startTime || !formData.endTime) {
      return;
    }

    const content = {
      type: "meeting",
      title: formData.title,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      duration: formData.duration,
      maxAttendees: formData.maxAttendees,
      isRequired: formData.isRequired,
      enableRecording: formData.enableRecording,
      enableWaitingRoom: formData.enableWaitingRoom,
      agenda: formData.agenda,
    };

    onSave(content);
  };

  const handleTimeChange = (field: "startTime" | "endTime", value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-calculate duration if both times are set
    if (field === "endTime" && formData.startTime) {
      const start = new Date(formData.startTime);
      const end = new Date(value);
      const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      if (duration > 0) {
        setFormData(prev => ({ ...prev, duration }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Meeting Lesson Content</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Meeting Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Live Q&A Session, Workshop, Office Hours"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
            min="15"
            max="240"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="What will this meeting cover? What should students prepare?"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Start Time *</Label>
          <Input
            id="startTime"
            type="datetime-local"
            value={formData.startTime}
            onChange={(e) => handleTimeChange("startTime", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime">End Time *</Label>
          <Input
            id="endTime"
            type="datetime-local"
            value={formData.endTime}
            onChange={(e) => handleTimeChange("endTime", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agenda">Meeting Agenda</Label>
        <Textarea
          id="agenda"
          value={formData.agenda}
          onChange={(e) => setFormData(prev => ({ ...prev, agenda: e.target.value }))}
          placeholder="1. Introduction&#10;2. Main topic discussion&#10;3. Q&A&#10;4. Wrap-up"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxAttendees">Max Attendees (optional)</Label>
          <Input
            id="maxAttendees"
            type="number"
            value={formData.maxAttendees || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, maxAttendees: e.target.value ? parseInt(e.target.value) : null }))}
            placeholder="Leave empty for unlimited"
            min="1"
          />
        </div>

        <div className="space-y-2">
          <Label>Meeting Options</Label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData(prev => ({ ...prev, isRequired: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Required for lesson completion</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.enableRecording}
                onChange={(e) => setFormData(prev => ({ ...prev, enableRecording: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Enable recording</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.enableWaitingRoom}
                onChange={(e) => setFormData(prev => ({ ...prev, enableWaitingRoom: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Enable waiting room</span>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Meeting Details</p>
            <p className="text-blue-700 mt-1">
              This will create a scheduled meeting that enrolled students can join. 
              The meeting will be automatically created with Google Meet integration.
            </p>
            {formData.startTime && formData.endTime && (
              <div className="mt-2 text-blue-600">
                <p>Scheduled: {format(new Date(formData.startTime), "PPP 'at' p")} - {format(new Date(formData.endTime), "p")}</p>
                <p>Duration: {formData.duration} minutes</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!formData.title || !formData.startTime || !formData.endTime}>
          Create Meeting Content
        </Button>
      </div>
    </div>
  );
}
