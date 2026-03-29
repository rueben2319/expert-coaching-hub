import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type AppRole = "client" | "coach" | "admin";

export type AuthenticatedUser = {
  id: string;
  role: AppRole | null;
};

type GuardSuccess<T> = T & { errorResponse?: never };
type GuardFailure = { errorResponse: NextResponse };

export async function requireAuthenticatedUser(): Promise<GuardSuccess<AuthenticatedUser> | GuardFailure> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const sessionUser = session.user as typeof session.user & {
    role?: unknown;
    app_metadata?: { role?: unknown };
    user_metadata?: { role?: unknown };
  };

  const rawRole = sessionUser.role ?? sessionUser.app_metadata?.role ?? sessionUser.user_metadata?.role;
  const role = isAppRole(rawRole) ? rawRole : null;

  return {
    id: session.user.id,
    role,
  };
}

export function requireRole(
  user: AuthenticatedUser,
  allowedRoles: readonly AppRole[],
): GuardSuccess<{ user: AuthenticatedUser }> | GuardFailure {
  if (!user.role || !allowedRoles.includes(user.role)) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user };
}

export function requireOwnership(
  userId: string,
  resourceUserId: string,
  message = "Forbidden: resource does not belong to authenticated user",
): GuardSuccess<{ ownedResourceUserId: string }> | GuardFailure {
  if (userId !== resourceUserId) {
    return {
      errorResponse: NextResponse.json({ error: message }, { status: 403 }),
    };
  }

  return { ownedResourceUserId: resourceUserId };
}

function isAppRole(value: unknown): value is AppRole {
  return value === "client" || value === "coach" || value === "admin";
}
