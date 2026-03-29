export type AuthRole = "client" | "coach" | "admin";

const sanitizePath = (path?: string | null): string | null => {
  if (!path || typeof path !== "string") return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  return path;
};

export const resolvePostAuthRoute = (
  role: AuthRole | null,
  intendedPath?: string | null
): string => {
  if (!role) return "/auth";

  const safeIntendedPath = sanitizePath(intendedPath);
  if (safeIntendedPath && safeIntendedPath !== "/auth" && safeIntendedPath.startsWith(`/${role}`)) {
    return safeIntendedPath;
  }

  return `/${role}`;
};
