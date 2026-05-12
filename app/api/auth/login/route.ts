import { NextResponse } from "next/server";
import { MOCK_ADMIN, createMockSessionToken } from "@/lib/auth";
import { upsertUser } from "@/lib/db";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const username = body.username?.trim();
  const password = body.password ?? "";

  if (username === MOCK_ADMIN.username && password === MOCK_ADMIN.password) {
    await upsertUser(MOCK_ADMIN.username, MOCK_ADMIN.role);

    return NextResponse.json({
      token: createMockSessionToken(),
      user: {
        username: MOCK_ADMIN.username,
        role: MOCK_ADMIN.role,
      },
    });
  }

  return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
}
