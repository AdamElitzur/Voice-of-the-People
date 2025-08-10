import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

export async function GET() {
  const { getToken } = auth();
  const token = await getToken();

  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/protected`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
