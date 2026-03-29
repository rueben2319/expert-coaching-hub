import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RoleDistributionPoint } from '@/features/admin-user-analytics/types';

type RoleDistributionChartProps = {
  data: RoleDistributionPoint[];
};

export function RoleDistributionChart({ data }: RoleDistributionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Distribution</CardTitle>
        <CardDescription>Breakdown of user types on the platform</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`role-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No role data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
