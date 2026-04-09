// ─── Centralized Schedule Types ──────────────────────────
export type ApprovalStatusValue = "approved" | "under_review" | "rejected";

export type Schedule = {
  id: string;
  campaign_id: string;
  store_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  installation_os: string | null;
  installation_preference: string | null;
  team_id: string | null;
  store_approved: boolean;
  store_approved_at: string | null;
  team_approved: boolean;
  team_approved_at: string | null;
  store_approval_status: ApprovalStatusValue;
  team_approval_status: ApprovalStatusValue;
  responsibility: string | null;
  responsibility_at: string | null;
  suggested_date: string | null;
  suggested_time: string | null;
  suggested_date_2: string | null;
  suggested_time_2: string | null;
  // Reschedule fields
  reschedule_enabled: boolean;
  reschedule_date: string | null;
  reschedule_time: string | null;
  reschedule_os: string | null;
  reschedule_preference: string | null;
  reschedule_store_approval_status: ApprovalStatusValue;
  reschedule_store_approved_at: string | null;
  reschedule_team_approval_status: ApprovalStatusValue;
  reschedule_team_approved_at: string | null;
  reschedule_responsibility: string | null;
  reschedule_responsibility_at: string | null;
  reschedule_suggested_date: string | null;
  reschedule_suggested_time: string | null;
  reschedule_suggested_date_2: string | null;
  reschedule_suggested_time_2: string | null;
  locked: boolean;
  completed_at: string | null;
  completed_by: string | null;
  photo_checkin: boolean;
};
