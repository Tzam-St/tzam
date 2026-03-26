import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createTzamClient, type TzamConfig } from './index';

export interface TzamProxyConfig extends TzamConfig {
  publicRoutes?: string[];
  loginUrl?: string;
}

export function createTzamProxy(config: TzamProxyConfig) {
  const client = createTzamClient(config);
  const publicRoutes = config.publicRoutes || ['/', '/auth/login', '/auth/register', '/api/auth'];
  const loginUrl = config.loginUrl || '/auth/login';

  const isPublicRoute = (pathname: string) => {
    return publicRoutes.some((route) =>
      route === '/' ? pathname === '/' : pathname.startsWith(route),
    );
  };

  return async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    const sessionCookie = request.cookies.get('session');
    const refreshCookie = request.cookies.get('refresh_token');

    // Try validate existing session
    let validation = sessionCookie
      ? await client.validateToken(sessionCookie.value)
      : null;

    // If session invalid/missing but refresh_token exists, try refresh
    if (!validation && refreshCookie) {
      try {
        const refreshed = await client.refreshToken(refreshCookie.value);
        validation = await client.validateToken(refreshed.accessToken);

        if (validation) {
          const response = NextResponse.next();
          response.headers.set('x-user-id', validation.userId);
          response.headers.set('x-user-email', validation.email);
          response.cookies.set('session', refreshed.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60,
            path: '/',
          });
          return response;
        }
      } catch {
        // Refresh failed — fall through to redirect
      }
    }

    if (!validation) {
      const response = NextResponse.redirect(
        new URL(`${loginUrl}?redirect=${encodeURIComponent(pathname)}`, request.url),
      );
      response.cookies.delete('session');
      response.cookies.delete('refresh_token');
      return response;
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', validation.userId);
    response.headers.set('x-user-email', validation.email);
    return response;
  };
}
