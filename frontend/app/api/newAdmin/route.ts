import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureSupabaseConfigured, supabase } from "../_lib/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await req.json().catch(() => undefined); // body is optional
    ensureSupabaseConfigured();

    const { data: existing, error: selectError } = await supabase
      .from("admin_users")
      .select("*")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (selectError) throw selectError;

    if (!existing) {
      const { data: inserted, error: insertError } = await supabase
        .from("admin_users")
        .insert({ clerk_user_id: userId })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return NextResponse.json(inserted, { status: 201 });
    }

    return NextResponse.json(existing, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "newAdmin failed" },
      { status: 500 }
    );
  }
}
