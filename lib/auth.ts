export const MOCK_ADMIN = {
  username: "admin",
  password: "admin123",
  role: "admin" as const,
};

const SESSION_TOKEN = "mock-admin-token";

export function createMockSessionToken() {
  return SESSION_TOKEN;
}

export function getUsernameFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || token !== SESSION_TOKEN) return null;

  return MOCK_ADMIN.username;
}
