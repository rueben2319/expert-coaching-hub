import { Skeleton } from "@/components/ui/skeleton";

export function ChartPanelSkeleton() {
  return (
    <div className="h-[250px] space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-[210px] w-full" />
    </div>
  );
}
