import { ReactNode } from "react";

export interface DashboardNavItem {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface DashboardNavSection {
  title?: string;
  items: DashboardNavItem[];
}
