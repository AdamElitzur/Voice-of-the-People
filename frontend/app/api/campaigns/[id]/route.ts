import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureSupabaseConfigured, supabase } from "../../_lib/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", params.id)
      .eq("created_by", userId)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "fetch failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const updates = (await req.json().catch(() => ({}))) || {};
    delete (updates as any).id;
    delete (updates as any).created_by;
    const { data, error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", params.id)
      .eq("created_by", userId)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", params.id)
      .eq("created_by", userId);
    if (error) throw error;
    return NextResponse.json({}, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "delete failed" }, { status: 500 });
  }
}
