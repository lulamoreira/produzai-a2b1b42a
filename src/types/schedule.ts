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
  photo_checkin_at: string | null;
  // Install code fields
  install_code: string | null;
  install_code_generated_at: string | null;
  install_code_expires_at: string | null;
  code_sent_at: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_accuracy: number | null;
  checkin_timestamp: string | null;
  checkin_device_info: any;
  // Manual check-in / check-out (registered by agency staff)
  manual_checkin_at: string | null;
  manual_checkin_by: string | null;
  manual_checkin_by_name: string | null;
  manual_checkout_at: string | null;
  manual_checkout_by: string | null;
  manual_checkout_by_name: string | null;
};
