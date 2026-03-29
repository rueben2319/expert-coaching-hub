import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickLinksRowProps {
  onNavigate: (path: string) => void;
}

export function QuickLinksRow({ onNavigate }: QuickLinksRowProps) {
  return (
    <div className="grid gap-3 md:grid-cols-4 mb-8">
      <Button variant="outline" className="justify-start h-auto py-3" onClick={() => onNavigate("/admin/users")}>
        <div className="text-left">
          <p className="font-medium">User Analytics</p>
          <p className="text-xs text-muted-foreground">Demographics & trends</p>
        </div>
        <ArrowRight className="ml-auto h-4 w-4" />
      </Button>
      <Button variant="outline" className="justify-start h-auto py-3" onClick={() => onNavigate("/admin/courses")}>
        <div className="text-left">
          <p className="font-medium">Course Analytics</p>
          <p className="text-xs text-muted-foreground">Stats & insights</p>
        </div>
        <ArrowRight className="ml-auto h-4 w-4" />
      </Button>
      <Button variant="outline" className="justify-start h-auto py-3" onClick={() => onNavigate("/admin/transactions")}>
        <div className="text-left">
          <p className="font-medium">Transactions</p>
          <p className="text-xs text-muted-foreground">Payment history</p>
        </div>
        <ArrowRight className="ml-auto h-4 w-4" />
      </Button>
      <Button variant="outline" className="justify-start h-auto py-3" onClick={() => onNavigate("/admin/system-health")}>
        <div className="text-left">
          <p className="font-medium">System Health</p>
          <p className="text-xs text-muted-foreground">Technical metrics</p>
        </div>
        <ArrowRight className="ml-auto h-4 w-4" />
      </Button>
    </div>
  );
}
