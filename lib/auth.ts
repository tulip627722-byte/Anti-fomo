export const MOCK_ADMIN = {
  username: "admin",
  password: "admin123",
  role: "admin" as const,
};

const SESSION_TOKEN = "mock-admin-session";

export function createMockSessionToken() {
  return SESSION_TOKEN;
}

export function getUsernameFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [, token] = authHeader.split(" ");
  if (token !== SESSION_TOKEN) return null;

  return MOCK_ADMIN.username;
}
