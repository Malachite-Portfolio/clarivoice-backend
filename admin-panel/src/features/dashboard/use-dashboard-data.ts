"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard.service";

export function useDashboardData() {
  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardService.summary,
  });

  const revenueSeries = useQuery({
    queryKey: ["dashboard-revenue-series"],
    queryFn: dashboardService.revenueSeries,
  });

  const topHosts = useQuery({
    queryKey: ["dashboard-top-hosts"],
    queryFn: dashboardService.topEarningHosts,
  });

  const recentSessions = useQuery({
    queryKey: ["dashboard-recent-sessions"],
    queryFn: dashboardService.recentSessions,
  });

  const recentRecharges = useQuery({
    queryKey: ["dashboard-recent-recharges"],
    queryFn: dashboardService.recentRecharges,
  });

  return {
    summary,
    revenueSeries,
    topHosts,
    recentSessions,
    recentRecharges,
  };
}
