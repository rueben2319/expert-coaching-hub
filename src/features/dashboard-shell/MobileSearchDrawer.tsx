import { memo, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface MobileSearchDrawerProps {
  open: boolean;
  query: string;
  placeholder: string;
  onChangeQuery: (query: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const MobileSearchDrawer = memo(function MobileSearchDrawer({
  open,
  query,
  placeholder,
  onChangeQuery,
  onClose,
  onSubmit,
}: MobileSearchDrawerProps) {
  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      onSubmit();
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="sm:hidden border-t px-4 py-3 bg-background">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          className="pl-10 pr-10 h-10 w-full"
          autoFocus
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            onClick={() => onChangeQuery("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
});
