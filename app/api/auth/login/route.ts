import { NextResponse } from "next/server";
import { MOCK_ADMIN, createMockSessionToken } from "@/lib/auth";
import { upsertUser } from "@/lib/db";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as LoginBody;
    const username = body.username?.trim();
    const password = body.password ?? "";

    if (username === MOCK_ADMIN.username && password === MOCK_ADMIN.password) {
      try {
        await upsertUser(MOCK_ADMIN.username, MOCK_ADMIN.role);
      } catch (dbError) {
        console.error("Failed to upsert user on login:", dbError);
      }

      return NextResponse.json({
        token: createMockSessionToken(),
        user: {
          username: MOCK_ADMIN.username,
          role: MOCK_ADMIN.role,
        },
      });
    }

    return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
  } catch (error) {
    console.error("Login route failed:", error);
    return NextResponse.json(
      { message: "登录服务暂时不可用，请稍后重试" },
      { status: 500 },
    );
  }
}
