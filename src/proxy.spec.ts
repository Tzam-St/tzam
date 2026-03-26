import { createTzamProxy } from './proxy';

// Mock Next.js types
const createMockRequest = (
  pathname: string,
  cookies: Record<string, string> = {},
): any => ({
  nextUrl: { pathname },
  url: `http://localhost:3000${pathname}`,
  cookies: {
    get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
  },
});

// Track calls to NextResponse methods
let nextCalled: boolean;
let redirectUrl: string | null;
let responseCookies: Record<string, { value: string; options: any }>;
let deletedCookies: string[];
let responseHeaders: Record<string, string>;

jest.mock('next/server', () => ({
  NextResponse: {
    next: () => {
      nextCalled = true;
      return {
        headers: {
          set: (key: string, value: string) => {
            responseHeaders[key] = value;
          },
        },
        cookies: {
          set: (name: string, value: string, options?: any) => {
            responseCookies[name] = { value, options };
          },
          delete: (name: string) => {
            deletedCookies.push(name);
          },
        },
      };
    },
    redirect: (url: URL | string) => {
      redirectUrl = typeof url === 'string' ? url : url.toString();
      return {
        cookies: {
          set: (name: string, value: string, options?: any) => {
            responseCookies[name] = { value, options };
          },
          delete: (name: string) => {
            deletedCookies.push(name);
          },
        },
      };
    },
  },
}));

// Mock createTzamClient
const mockValidateToken = jest.fn();
const mockRefreshToken = jest.fn();

jest.mock('./index', () => ({
  createTzamClient: () => ({
    validateToken: mockValidateToken,
    refreshToken: mockRefreshToken,
  }),
}));

describe('createTzamProxy', () => {
  let proxy: ReturnType<typeof createTzamProxy>;

  beforeEach(() => {
    jest.clearAllMocks();
    nextCalled = false;
    redirectUrl = null;
    responseCookies = {};
    deletedCookies = [];
    responseHeaders = {};

    proxy = createTzamProxy({
      url: 'http://localhost:4000',
      clientId: 'test',
      clientSecret: 'secret',
    });
  });

  it('should allow public routes without auth', async () => {
    const request = createMockRequest('/');
    await proxy(request);
    expect(nextCalled).toBe(true);
    expect(redirectUrl).toBeNull();
  });

  it('should redirect to login when no session and no refresh_token', async () => {
    const request = createMockRequest('/dashboard');
    await proxy(request);
    expect(redirectUrl).toContain('/auth/login');
    expect(nextCalled).toBe(false);
  });

  it('should continue when session token is valid', async () => {
    mockValidateToken.mockResolvedValue({ userId: 'u1', email: 'a@b.com' });
    const request = createMockRequest('/dashboard', { session: 'valid-token' });
    await proxy(request);
    expect(nextCalled).toBe(true);
    expect(responseHeaders['x-user-id']).toBe('u1');
  });

  describe('auto-refresh', () => {
    it('should refresh token when session is expired but refresh_token exists', async () => {
      mockValidateToken
        .mockResolvedValueOnce(null) // first call: expired
        .mockResolvedValueOnce({ userId: 'u1', email: 'a@b.com' }); // after refresh
      mockRefreshToken.mockResolvedValue({ accessToken: 'new-access-token' });

      const request = createMockRequest('/dashboard', {
        session: 'expired-token',
        refresh_token: 'valid-refresh',
      });

      await proxy(request);

      expect(mockRefreshToken).toHaveBeenCalledWith('valid-refresh');
      expect(nextCalled).toBe(true);
      expect(responseCookies['session']).toBeDefined();
      expect(responseCookies['session'].value).toBe('new-access-token');
      expect(responseHeaders['x-user-id']).toBe('u1');
    });

    it('should refresh when no session cookie but refresh_token exists', async () => {
      mockRefreshToken.mockResolvedValue({ accessToken: 'new-access-token' });
      mockValidateToken.mockResolvedValue({ userId: 'u1', email: 'a@b.com' });

      const request = createMockRequest('/dashboard', {
        refresh_token: 'valid-refresh',
      });

      await proxy(request);

      expect(mockRefreshToken).toHaveBeenCalledWith('valid-refresh');
      expect(nextCalled).toBe(true);
      expect(responseCookies['session'].value).toBe('new-access-token');
    });

    it('should redirect to login when refresh also fails', async () => {
      mockValidateToken.mockResolvedValue(null);
      mockRefreshToken.mockRejectedValue(new Error('Token refresh failed'));

      const request = createMockRequest('/dashboard', {
        session: 'expired-token',
        refresh_token: 'invalid-refresh',
      });

      await proxy(request);

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(redirectUrl).toContain('/auth/login');
      expect(deletedCookies).toContain('session');
      expect(deletedCookies).toContain('refresh_token');
    });

    it('should set httpOnly cookie with correct options on refresh', async () => {
      mockValidateToken
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: 'u1', email: 'a@b.com' });
      mockRefreshToken.mockResolvedValue({ accessToken: 'new-token' });

      const request = createMockRequest('/dashboard', {
        session: 'expired',
        refresh_token: 'valid-refresh',
      });

      await proxy(request);

      expect(responseCookies['session'].options).toEqual(
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });
  });
});
