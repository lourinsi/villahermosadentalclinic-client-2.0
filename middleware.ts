import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "clinic_gateway_pass";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

const gatewayHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Workspace Gateway</title>
</head>
<body>
  <form method="POST">
    <label>
      Password
      <input name="password" type="password" autocomplete="current-password" required />
    </label>
    <button type="submit">Enter</button>
  </form>
</body>
</html>`;

const htmlResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });

export const config = {
  matcher: ["/workspace-portal-auth", "/workspace-portal-auth/:path*"],
};

export default async function middleware(request: NextRequest) {
  const secret = process.env.GATEWAY_SECRET ?? "";
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  const hasValidCookie = cookie !== undefined && cookie === secret;

  if (request.method === "POST") {
    if (!secret) {
      return new Response("Gateway secret not configured.", { status: 500 });
    }

    const formData = await request.formData();
    const password = String(formData.get("password") ?? "");

    if (password !== secret) {
      return new Response("Incorrect Password", {
        status: 401,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const response = NextResponse.redirect(
      new URL("/workspace-portal-auth", request.url)
    );

    response.cookies.set(COOKIE_NAME, secret, {
      httpOnly: true,
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });

    return response;
  }

  if (hasValidCookie) {
    return NextResponse.next();
  }

  return htmlResponse(gatewayHtml);
}
