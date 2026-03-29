import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    sessionId: string;
  };
};

async function requireSessionUserId() {
  const session = await auth();

  if (!session?.user?.id) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { userId: session.user.id };
}

async function authorizeMeetingAccess(sessionId: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
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

  const canAccess = meeting.attendees.some((attendee) => attendee.userId === userId);

  if (!canAccess) {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden: session does not belong to the authenticated user" },
        { status: 403 },
      ),
    };
  }

  return { meetingId: meeting.id };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireSessionUserId();
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const accessResult = await authorizeMeetingAccess(params.sessionId, authResult.userId);
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
  const authResult = await requireSessionUserId();
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const accessResult = await authorizeMeetingAccess(params.sessionId, authResult.userId);
  if ("errorResponse" in accessResult) return accessResult.errorResponse;

  await prisma.meeting.delete({
    where: { id: accessResult.meetingId },
  });

  return NextResponse.json({ ok: true });
}
