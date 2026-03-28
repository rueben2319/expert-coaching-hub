import type { CoachStudent, StudentSortOption } from "@/features/coach-students/types";

function sortStudents(students: CoachStudent[], sort: StudentSortOption): CoachStudent[] {
  const sorted = [...students];

  switch (sort) {
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "last-active-desc":
      return sorted.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
    case "progress-desc":
      return sorted.sort((a, b) => b.progress - a.progress);
    case "name-asc":
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function selectFilteredStudents({
  students,
  searchTerm,
  sort,
}: {
  students: CoachStudent[];
  searchTerm: string;
  sort: StudentSortOption;
}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filtered = normalizedSearch
    ? students.filter(
        (student) =>
          student.name.toLowerCase().includes(normalizedSearch) ||
          student.email.toLowerCase().includes(normalizedSearch),
      )
    : students;

  return sortStudents(filtered, sort);
}
