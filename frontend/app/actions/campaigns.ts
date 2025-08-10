"use server";

import { auth } from "@clerk/nextjs/server";
import { ensureSupabaseConfigured, supabase } from "../api/_lib/server";
import { generateShareSlug } from "../api/_lib/server";

type CampaignInsert = {
  title: string;
  description?: string | null;
  form_schema: any;
  example_inputs?: any | null;
  multiple_choice_options?: any | null;
  is_published?: boolean;
};

export async function ensureAdmin(): Promise<
  { status: "created" | "exists" } | { error: string }
> {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Unauthorized" };
    ensureSupabaseConfigured();

    const { data: existing, error: selectError } = await supabase
      .from("admin_users")
      .select("*")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (selectError) throw selectError;

    if (!existing) {
      const { error: insertError } = await supabase
        .from("admin_users")
        .insert({ clerk_user_id: userId });
      if (insertError) throw insertError;
      return { status: "created" };
    }
    return { status: "exists" };
  } catch (err: any) {
    return { error: err.message || "ensureAdmin failed" };
  }
}

export async function createCampaign(input: CampaignInsert): Promise<any> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  ensureSupabaseConfigured();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      title: input.title,
      description: input.description ?? null,
      form_schema: input.form_schema,
      example_inputs: input.example_inputs ?? null,
      multiple_choice_options: input.multiple_choice_options ?? null,
      is_published: Boolean(input.is_published),
      share_slug: generateShareSlug(),
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getCampaignById(id: string): Promise<any> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  ensureSupabaseConfigured();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("created_by", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(
  id: string,
  updates: Record<string, unknown>
): Promise<any> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  ensureSupabaseConfigured();
  const safe = { ...updates } as any;
  delete safe.id;
  delete safe.created_by;
  const { data, error } = await supabase
    .from("campaigns")
    .update(safe)
    .eq("id", id)
    .eq("created_by", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listDashboardCampaigns(): Promise<any[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  ensureSupabaseConfigured();
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const campaignIds = (campaigns || []).map((c: any) => c.id);
  let countsByCampaign: Record<string, number> = {};
  if (campaignIds.length) {
    const { data: respRows, error: respErr } = await supabase
      .from("form_responses")
      .select("campaign_id")
      .in("campaign_id", campaignIds);
    if (respErr) throw respErr;
    for (const row of respRows || []) {
      const key = String((row as any).campaign_id);
      countsByCampaign[key] = (countsByCampaign[key] || 0) + 1;
    }
  }
  return (campaigns || []).map((c: any) => ({
    ...c,
    response_count: countsByCampaign[String(c.id)] || 0,
  }));
}
