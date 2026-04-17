"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { kycService } from "@/services/kyc.service";
import type { AdminKycListItem } from "@/types";
import { formatDateTime } from "@/utils/date";

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export default function KycAdminListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const kycQuery = useQuery({
    queryKey: ["admin-kyc-list", page, status],
    queryFn: () =>
      kycService.getKycList({
        page,
        limit: 20,
        status,
      }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const rows = useMemo(() => kycQuery.data?.items || [], [kycQuery.data?.items]);
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return rows;
    }
    return rows.filter((row) => {
      return (
        String(row.fullName || "").toLowerCase().includes(needle) ||
        String(row.phone || "").toLowerCase().includes(needle) ||
        String(row.userId || "").toLowerCase().includes(needle) ||
        String(row.submissionId || "").toLowerCase().includes(needle)
      );
    });
  }, [rows, search]);

  const columns: DataColumn<AdminKycListItem>[] = useMemo(
    () => [
      {
        key: "submissionId",
        header: "Submission",
        render: (row) => (
          <div>
            <p className="font-medium text-app-text-primary">{row.submissionId.slice(0, 12)}</p>
            <p className="text-xs text-app-text-secondary">{row.userId.slice(0, 12)}</p>
          </div>
        ),
      },
      {
        key: "name",
        header: "Name",
        render: (row) => <span>{row.fullName || "N/A"}</span>,
      },
      {
        key: "phone",
        header: "Phone",
        render: (row) => <span>{row.phone || "N/A"}</span>,
      },
      {
        key: "role",
        header: "Role",
        render: (row) => <span>{row.role || "N/A"}</span>,
      },
      {
        key: "source",
        header: "Source",
        render: (row) => (
          <span>{row.source === "LISTENER_ONBOARDING" ? "Listener Onboarding" : "KYC Form"}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status.toLowerCase()} />,
      },
      {
        key: "submittedAt",
        header: "Submitted",
        render: (row) => <span>{row.submittedAt ? formatDateTime(row.submittedAt) : "-"}</span>,
      },
      {
        key: "reviewedAt",
        header: "Reviewed",
        render: (row) => <span>{row.reviewedAt ? formatDateTime(row.reviewedAt) : "-"}</span>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <Link href={`/kyc/${row.id}`}>
            <Button size="sm" variant="secondary">
              Review
            </Button>
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <AdminLayout
      title="KYC Reviews"
      subtitle="Review KYC submissions, approve valid records, and reject with actionable notes."
    >
      <RoleGate roles={["super_admin", "admin"]}>
        {kycQuery.isError ? (
          <EmptyState
            title="Unable to load KYC submissions"
            description="Please try again. If this continues, verify backend admin KYC APIs are reachable."
          />
        ) : null}

        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          onFilterChange={(_key, value) => {
            const nextStatus = String(value || "ALL");
            if (nextStatus === status) {
              return;
            }
            setStatus(nextStatus);
            setPage(1);
          }}
          onResetFilters={() => {
            setStatus("ALL");
            setPage(1);
          }}
          filters={[
            {
              key: "status",
              label: "Status",
              value: status,
              options: STATUS_FILTERS,
            },
          ]}
        />

        <DataTable
          data={filteredRows}
          columns={columns}
          loading={kycQuery.isLoading && !kycQuery.data}
          page={kycQuery.data?.page}
          totalPages={kycQuery.data?.totalPages}
          onPageChange={setPage}
          emptyLabel={
            kycQuery.isError
              ? "Unable to load KYC submissions."
              : "No KYC submissions found."
          }
        />
      </RoleGate>
    </AdminLayout>
  );
}
