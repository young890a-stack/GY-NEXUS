import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberPlan, MEMBER_AI_FEATURE, type MemberPlanKey } from "./plans";

export type MemberAccess = {
  planKey: MemberPlanKey;
  planName: string;
  monthlyLimit: number;
  used: number;
  remaining: number;
  periodEndsAt: string | null;
  setupRequired: boolean;
};

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getMemberAccess(userId: string): Promise<MemberAccess> {
  try {
    const supabase = createAdminClient();
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan_key, status, current_period_end")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;
    const plan = getMemberPlan(subscription?.plan_key);
    const { data: events, error: usageError } = await supabase
      .from("usage_events")
      .select("units")
      .eq("user_id", userId)
      .eq("feature", MEMBER_AI_FEATURE)
      .in("status", ["reserved", "succeeded"])
      .gte("created_at", monthStartIso());

    if (usageError) throw usageError;
    const used = (events ?? []).reduce((total, event) => total + Number(event.units || 0), 0);

    return {
      planKey: plan.key,
      planName: plan.name,
      monthlyLimit: plan.monthlyAiRequests,
      used,
      remaining: Math.max(0, plan.monthlyAiRequests - used),
      periodEndsAt: subscription?.current_period_end ?? null,
      setupRequired: false,
    };
  } catch (error) {
    console.warn("Subscription foundation is not ready:", error);
    const plan = getMemberPlan("free");
    return {
      planKey: plan.key,
      planName: plan.name,
      monthlyLimit: plan.monthlyAiRequests,
      used: 0,
      remaining: plan.monthlyAiRequests,
      periodEndsAt: null,
      setupRequired: true,
    };
  }
}

export async function reserveMemberUsage(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reserve_member_usage", {
    p_user_id: userId,
    p_feature: MEMBER_AI_FEATURE,
    p_units: 1,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

export async function finalizeMemberUsage(eventId: string, succeeded: boolean, metadata: Record<string, unknown> = {}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("usage_events")
    .update({ status: succeeded ? "succeeded" : "failed", metadata })
    .eq("id", eventId);
  if (error) throw error;
}
