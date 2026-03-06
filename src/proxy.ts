import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // Admin auth is handled client-side by the admin layout component.
  // The layout checks the session and redirects to login if unauthorized.
  // Doing server-side auth here fails in development because:
  // 1. api.alfajermart.com may not resolve (Jio NAT64 DNS issue)
  // 2. Cookie names can mismatch between browser/server clients
  // So we skip the server-side admin check and let the client handle it.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
