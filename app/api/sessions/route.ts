import { requireAuthenticatedUser } from "@/app/api/_lib/guards";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const authResult = await requireAuthenticatedUser();
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const sessions = await prisma.meeting.findMany({
    where: {
      OR: [
        {
          userId: authResult.id,
        },
        {
          attendees: {
            some: {
              userId: authResult.id,
            },
          },
        },
      ],
    },
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
    orderBy: {
      startTime: "asc",
    },
  });

  return NextResponse.json({ sessions });
}
