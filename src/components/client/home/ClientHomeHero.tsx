import { Skeleton } from "@/components/ui/skeleton";

interface ClientHomeHeroProps {
  fullName?: string;
  isLoading?: boolean;
}

export function ClientHomeHero({ fullName, isLoading = false }: ClientHomeHeroProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 mb-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-8">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        Welcome back, {fullName || "Learner"}
      </h1>
      <p className="text-muted-foreground">Track your learning journey and pick up where you left off.</p>
    </div>
  );
}
