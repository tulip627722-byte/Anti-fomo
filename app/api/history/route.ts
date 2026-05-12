import { NextResponse } from "next/server";
import { getUsernameFromRequest } from "@/lib/auth";
import { getSearchHistory } from "@/lib/db";

export async function GET(request: Request) {
  const username = getUsernameFromRequest(request);

  if (!username) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const history = await getSearchHistory(username);
  return NextResponse.json({ history });
}
