export function buildStreak(
  progressItems: Array<{ started_at: string | null; completed_at: string | null }>,
): number {
  const progressByDate = new Set<string>();

  progressItems.forEach((progress) => {
    const sourceDate = progress.completed_at || progress.started_at;
    if (!sourceDate) return;

    const date = new Date(sourceDate);
    if (Number.isNaN(date.getTime())) return;

    progressByDate.add(date.toDateString());
  });

  let currentStreak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i += 1) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);

    if (progressByDate.has(checkDate.toDateString())) {
      currentStreak += 1;
      continue;
    }

    if (i > 0) break;
  }

  return currentStreak;
}
