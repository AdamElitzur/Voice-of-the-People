import { NextResponse } from "next/server";
import { ensureSupabaseConfigured, supabase } from "../../../_lib/server";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    ensureSupabaseConfigured();
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "id, title, description, form_schema, share_slug, is_published, published"
      )
      .eq("share_slug", params.slug)
      .or("is_published.eq.true,published.eq.true")
      .single();
    if (error) {
      return NextResponse.json(
        { notFound: true, message: "Campaign is not available" },
        { status: 200 }
      );
    }
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { notFound: true, message: "Campaign is not available" },
      { status: 200 }
    );
  }
}
