import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type AdminUserChartSkeletonProps = {
  title: string;
  description: string;
  heightClassName?: string;
};

export function AdminUserChartSkeleton({
  title,
  description,
  heightClassName = 'h-[250px]',
}: AdminUserChartSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Skeleton className={`w-full ${heightClassName}`} />
      </CardContent>
    </Card>
  );
}
