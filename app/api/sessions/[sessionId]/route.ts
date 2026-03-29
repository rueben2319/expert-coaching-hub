import { requireAuthenticatedUser, requireOwnership } from "@/app/api/_lib/guards";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    sessionId: string;
  };
};

async function authorizeSessionAccess(sessionId: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      attendees: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!meeting) {
    return { errorResponse: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }

  const ownsMeeting = meeting.userId === userId;
  const isAttendee = meeting.attendees.some((attendee) => attendee.userId === userId);

  if (!ownsMeeting && !isAttendee) {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden: session does not belong to the authenticated user" },
        { status: 403 },
      ),
    };
  }

  return { meetingId: meeting.id, meetingOwnerId: meeting.userId };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireAuthenticatedUser();
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const accessResult = await authorizeSessionAccess(params.sessionId, authResult.id);
  if ("errorResponse" in accessResult) return accessResult.errorResponse;

  const session = await prisma.meeting.findUnique({
    where: { id: accessResult.meetingId },
    select: {
      id: true,
      summary: true,
      startTime: true,
      endTime: true,
      status: true,
      meetLink: true,
      userId: true,
      course: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return NextResponse.json({ session });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireAuthenticatedUser();
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const accessResult = await authorizeSessionAccess(params.sessionId, authResult.id);
  if ("errorResponse" in accessResult) return accessResult.errorResponse;

  const ownershipResult = requireOwnership(
    authResult.id,
    accessResult.meetingOwnerId,
    "Forbidden: only the meeting owner can delete this session",
  );
  if ("errorResponse" in ownershipResult) return ownershipResult.errorResponse;

  await prisma.meeting.delete({
    where: { id: accessResult.meetingId },
  });

  return NextResponse.json({ ok: true });
}
