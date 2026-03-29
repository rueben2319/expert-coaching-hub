import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.meeting.findMany({
    where: {
      attendees: {
        some: {
          userId: session.user.id,
        },
      },
    },
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
    orderBy: {
      startTime: "asc",
    },
  });

  return NextResponse.json({ sessions });
}
