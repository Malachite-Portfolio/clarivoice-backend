"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layout/admin-layout";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/loader";
import { StatusBadge } from "@/components/ui/status-badge";
import { kycService } from "@/services/kyc.service";
import type { AdminKycDetail, AdminKycListResponse } from "@/types";
import { formatDateTime } from "@/utils/date";

export default function KycAdminDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const kycId = String(params.id || "");

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const detailQuery = useQuery({
    queryKey: ["admin-kyc-detail", kycId],
    queryFn: () => kycService.getKycById(kycId),
    enabled: Boolean(kycId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const updateCachedKycListRows = (updatedDetail: AdminKycDetail) => {
    const patchRows = (previousData: AdminKycListResponse | undefined) => {
      if (!previousData) {
        return previousData;
      }

      return {
        ...previousData,
        items: previousData.items.map((item) =>
          item.id === updatedDetail.id
            ? {
                ...item,
                hostListenerId: updatedDetail.hostListenerId,
                source: updatedDetail.source,
                fullName: updatedDetail.fullName,
                phone: updatedDetail.phone,
                email: updatedDetail.email,
                profilePhotoUrl: updatedDetail.profilePhotoUrl,
                role: updatedDetail.role,
                category: updatedDetail.category,
                languages: updatedDetail.languages,
                status: updatedDetail.status,
                submittedAt: updatedDetail.submittedAt,
                reviewedAt: updatedDetail.reviewedAt,
              }
            : item
        ),
      };
    };

    queryClient.setQueriesData<AdminKycListResponse>(
      { queryKey: ["admin-kyc-list"] },
      patchRows
    );
    queryClient.setQueriesData<AdminKycListResponse>(
      { queryKey: ["admin-host-kyc-list"] },
      patchRows
    );
  };

  const approveMutation = useMutation({
    mutationFn: () => kycService.approveKyc(kycId),
    onSuccess: async (updatedDetail) => {
      queryClient.setQueryData(["admin-kyc-detail", kycId], updatedDetail);
      updateCachedKycListRows(updatedDetail);
      toast.success("KYC approved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-kyc-list"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-host-kyc-list"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-kyc-detail", kycId] }),
      ]);
      setApproveModalOpen(false);
    },
    onError: () => {
      toast.error("Unable to approve KYC");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => kycService.rejectKyc(kycId, reviewNote.trim()),
    onSuccess: async (updatedDetail) => {
      queryClient.setQueryData(["admin-kyc-detail", kycId], updatedDetail);
      updateCachedKycListRows(updatedDetail);
      toast.success("KYC rejected");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-kyc-list"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-host-kyc-list"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-kyc-detail", kycId] }),
      ]);
      setReviewNote("");
      setRejectModalOpen(false);
    },
    onError: () => {
      toast.error("Unable to reject KYC");
    },
  });

  const mediaCards = useMemo(() => {
    if (!detailQuery.data) {
      return [] as Array<{ label: string; url: string | null }>;
    }

    const cards: Array<{ label: string; url: string | null }> = [
      { label: "Aadhaar Front", url: detailQuery.data.aadhaarFrontUrl },
      { label: "Aadhaar Back", url: detailQuery.data.aadhaarBackUrl },
      { label: "Selfie", url: detailQuery.data.selfieUrl },
    ];

    if (detailQuery.data.governmentIdUrl) {
      cards.push({
        label: detailQuery.data.governmentIdType
          ? `${detailQuery.data.governmentIdType} (Government ID)`
          : "Government ID",
        url: detailQuery.data.governmentIdUrl,
      });
    }

    return cards;
  }, [detailQuery.data]);

  if (detailQuery.isLoading) {
    return (
      <AdminLayout title="KYC Review">
        <PageLoader />
      </AdminLayout>
    );
  }

  if (!detailQuery.data) {
    return (
      <AdminLayout title="KYC Review">
        <EmptyState
          title="KYC submission not found"
          description="The requested submission does not exist or cannot be accessed."
        />
      </AdminLayout>
    );
  }

  const detail = detailQuery.data;
  const canReview = detail.status === "PENDING";

  return (
    <AdminLayout
      title="KYC Review Details"
      subtitle={`Reviewing submission ${detail.submissionId.slice(0, 12)}`}
    >
      <RoleGate roles={["super_admin", "admin"]}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {canReview ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRejectModalOpen(true)}>
                Reject
              </Button>
              <Button onClick={() => setApproveModalOpen(true)}>Approve</Button>
            </div>
          ) : (
            <div className="rounded-xl border border-app-border px-3 py-2 text-xs text-app-text-secondary">
              Review actions are available only when status is PENDING.
            </div>
          )}
        </div>

        <Card className="space-y-3">
          <CardTitle className="text-base">Submission Summary</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Submission ID</p>
              <p className="mt-1 font-medium text-app-text-primary">{detail.submissionId}</p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">User ID</p>
              <p className="mt-1 font-medium text-app-text-primary">{detail.userId}</p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Full Name</p>
              <p className="mt-1 font-medium text-app-text-primary">{detail.fullName || "N/A"}</p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Phone</p>
              <p className="mt-1 font-medium text-app-text-primary">{detail.phone || "N/A"}</p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Role</p>
              <p className="mt-1 font-medium text-app-text-primary">{detail.role || "N/A"}</p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Source</p>
              <p className="mt-1 font-medium text-app-text-primary">
                {detail.source === "LISTENER_ONBOARDING" ? "Listener Onboarding" : "KYC Form"}
              </p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Status</p>
              <div className="mt-2">
                <StatusBadge status={detail.status.toLowerCase()} />
              </div>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Submitted At</p>
              <p className="mt-1 font-medium text-app-text-primary">
                {detail.submittedAt ? formatDateTime(detail.submittedAt) : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Reviewed At</p>
              <p className="mt-1 font-medium text-app-text-primary">
                {detail.reviewedAt ? formatDateTime(detail.reviewedAt) : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">DOB</p>
              <p className="mt-1 font-medium text-app-text-primary">{detail.dob || "N/A"}</p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Aadhaar Last 4</p>
              <p className="mt-1 font-medium text-app-text-primary">{detail.aadhaarLast4 || "N/A"}</p>
            </div>
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Government ID Type</p>
              <p className="mt-1 font-medium text-app-text-primary">
                {detail.governmentIdType || "N/A"}
              </p>
            </div>
          </div>
          {detail.reviewNote ? (
            <div className="rounded-xl border border-app-border p-3">
              <p className="text-xs text-app-text-muted">Review Note</p>
              <p className="mt-1 text-app-text-primary">{detail.reviewNote}</p>
            </div>
          ) : null}
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {mediaCards.map((item) => (
            <Card key={item.label} className="space-y-2">
              <CardTitle className="text-sm">{item.label}</CardTitle>
              {item.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.label}
                    className="h-48 w-full rounded-xl border border-app-border object-cover"
                  />
                  <a
                    className="text-xs text-app-accent underline"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original
                  </a>
                </>
              ) : (
                <p className="text-sm text-app-text-secondary">Not uploaded</p>
              )}
            </Card>
          ))}
        </div>

        <ConfirmationModal
          open={approveModalOpen}
          title="Approve KYC"
          description="Approve this KYC submission and unlock host/listener verified actions."
          confirmLabel="Approve"
          isLoading={approveMutation.isPending}
          onCancel={() => setApproveModalOpen(false)}
          disableConfirm={!canReview}
          onConfirm={() => approveMutation.mutate()}
        />

        <ConfirmationModal
          open={rejectModalOpen}
          title="Reject KYC"
          description="Rejecting requires a clear review note."
          confirmLabel="Reject"
          isLoading={rejectMutation.isPending}
          onCancel={() => {
            setRejectModalOpen(false);
            setReviewNote("");
          }}
          disableConfirm={!canReview}
          onConfirm={() => {
            if (!reviewNote.trim()) {
              toast.error("Rejection reason is required");
              return;
            }
            rejectMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <p className="text-xs text-app-text-secondary">Rejection reason (required)</p>
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              className="min-h-[110px] w-full rounded-xl border border-app-border bg-[#120e21] px-3 py-2 text-sm text-app-text-primary outline-none focus:border-app-accent"
              placeholder="Add a clear reason for rejection"
            />
          </div>
        </ConfirmationModal>
      </RoleGate>
    </AdminLayout>
  );
}
