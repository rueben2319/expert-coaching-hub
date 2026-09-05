import { ArrowRight, Users, BookOpen, CreditCard, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickLinksRowProps {
  onNavigate: (path: string) => void;
}

export function QuickLinksRow({ onNavigate }: QuickLinksRowProps) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
      <Button variant="outline" className="justify-start h-auto py-3 hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => onNavigate("/admin/users")}>
        <Users className="h-4 w-4 mr-2 text-primary" />
        <div className="text-left flex-1">
          <p className="font-medium text-sm">User Analytics</p>
          <p className="text-[10px] text-muted-foreground">Demographics & trends</p>
        </div>
        <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground" />
      </Button>
      <Button variant="outline" className="justify-start h-auto py-3 hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => onNavigate("/admin/courses")}>
        <BookOpen className="h-4 w-4 mr-2 text-primary" />
        <div className="text-left flex-1">
          <p className="font-medium text-sm">Course Analytics</p>
          <p className="text-[10px] text-muted-foreground">Stats & insights</p>
        </div>
        <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground" />
      </Button>
      <Button variant="outline" className="justify-start h-auto py-3 hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => onNavigate("/admin/transactions")}>
        <CreditCard className="h-4 w-4 mr-2 text-primary" />
        <div className="text-left flex-1">
          <p className="font-medium text-sm">Transactions</p>
          <p className="text-[10px] text-muted-foreground">Payment history</p>
        </div>
        <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground" />
      </Button>
      <Button variant="outline" className="justify-start h-auto py-3 hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => onNavigate("/admin/system-health")}>
        <Activity className="h-4 w-4 mr-2 text-primary" />
        <div className="text-left flex-1">
          <p className="font-medium text-sm">System Health</p>
          <p className="text-[10px] text-muted-foreground">Technical metrics</p>
        </div>
        <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
}
