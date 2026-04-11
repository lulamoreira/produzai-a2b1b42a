import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Schedule } from "@/types/schedule";

function generateInstallCode(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const l1 = letters[Math.floor(Math.random() * 26)];
  const l2 = letters[Math.floor(Math.random() * 26)];
  const nums = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${l1}${l2}${nums}`;
}

/**
 * Auto-generates a 5-char install_code for a schedule when:
 * - scheduled_date and scheduled_time are set
 * - store_approval_status === "approved"
 * - team_approval_status === "approved"
 * - install_code is NULL
 */
export function useInstallCodeGeneration(schedules: Schedule[], campaignId: string) {
  useEffect(() => {
    if (!schedules.length || !campaignId) return;

    const eligibleSchedules = schedules.filter((s) => {
      const hasDate = s.reschedule_enabled
        ? !!(s.reschedule_date && s.reschedule_time)
        : !!(s.scheduled_date && s.scheduled_time);
      const storeApproved = s.reschedule_enabled
        ? s.reschedule_store_approval_status === "approved"
        : s.store_approval_status === "approved";
      const teamApproved = s.reschedule_enabled
        ? s.reschedule_team_approval_status === "approved"
        : s.team_approval_status === "approved";

      return hasDate && storeApproved && teamApproved && !s.install_code;
    });

    if (eligibleSchedules.length === 0) return;

    const generateCodes = async () => {
      for (const schedule of eligibleSchedules) {
        let attempts = 0;
        let success = false;

        while (attempts < 10 && !success) {
          const newCode = generateInstallCode();
          const { error } = await supabase
            .from("campaign_schedules")
            .update({
              install_code: newCode,
              install_code_generated_at: new Date().toISOString(),
            } as any)
            .eq("id", schedule.id)
            .is("install_code" as any, null);

          if (!error) {
            success = true;
            // Log code generation activity (fire and forget)
            supabase.from("campaign_activity_log" as any).insert({
              campaign_id: campaignId,
              store_id: schedule.store_id,
              actor_name: "Sistema",
              actor_type: "system",
              action: "codigo_gerado",
              description: `Código de acesso gerado para loja`,
            }).then(() => {}).catch(() => {});
          }
          attempts++;
        }
      }
    };

    generateCodes();
  }, [schedules, campaignId]);
}
