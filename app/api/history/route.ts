import { NextResponse } from "next/server";
import { getUsernameFromRequest } from "@/lib/auth";
import { getSearchHistory } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const username = getUsernameFromRequest(request);

    if (!username) {
      return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    const history = await getSearchHistory(username);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("History route failed:", error);
    return NextResponse.json(
      { message: "历史服务暂时不可用，请稍后重试" },
      { status: 500 },
    );
  }
}
