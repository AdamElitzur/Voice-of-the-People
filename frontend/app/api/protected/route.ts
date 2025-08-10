import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../_lib/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let supabaseStatus = "unconfigured";
  if (supabase) {
    try {
      // simple call to verify connectivity; requires service role
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) throw error;
      supabaseStatus = data?.user ? "ok" : "ok";
    } catch (e: any) {
      supabaseStatus = `error: ${e.message}`;
    }
  }

  return NextResponse.json({
    message: "You have access to a protected route.",
    userId,
    supabaseStatus,
  });
}
