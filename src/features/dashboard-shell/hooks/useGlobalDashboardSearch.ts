import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type DashboardRole = "coach" | "client" | "admin" | null;

const desktopPlaceholders: Record<Exclude<DashboardRole, null>, string> = {
  coach: "Search courses, students, sessions...",
  client: "Search courses, lessons, coaches...",
  admin: "Search users, transactions, courses...",
};

const mobilePlaceholders: Record<Exclude<DashboardRole, null>, string> = {
  coach: "Search courses, students...",
  client: "Search courses...",
  admin: "Search users...",
};

export function useGlobalDashboardSearch(role: DashboardRole) {
  const navigate = useNavigate();

  const desktopPlaceholder = useMemo(() => {
    return role ? desktopPlaceholders[role] : "Search...";
  }, [role]);

  const mobilePlaceholder = useMemo(() => {
    return role ? mobilePlaceholders[role] : "Search...";
  }, [role]);

  const submitSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      if (role === "coach") {
        navigate(`/coach/courses?search=${encodeURIComponent(trimmed)}`);
        return;
      }

      if (role === "client") {
        navigate(`/client/courses?search=${encodeURIComponent(trimmed)}`);
        return;
      }

      if (role === "admin") {
        navigate(`/admin/users?search=${encodeURIComponent(trimmed)}`);
      }
    },
    [navigate, role]
  );

  return {
    desktopPlaceholder,
    mobilePlaceholder,
    submitSearch,
  };
}
