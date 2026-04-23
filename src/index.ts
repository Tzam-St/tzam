export interface TzamConfig {
  url: string;
  clientId: string;
  clientSecret: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
}

interface ApiError {
  message?: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface ValidateResponse {
  userId: string;
  email: string;
}

export interface AppConfig {
  clientId: string;
  active: boolean;
  methods: {
    password: boolean;
    magicLink: boolean;
    otp: boolean;
    oauth: { github: boolean; google: boolean };
  };
}

export function createTzamClient(config: TzamConfig) {
  const { url, clientId, clientSecret } = config;

  async function login(email: string, password: string): Promise<LoginResult> {
    const response = await fetch(`${url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, client_id: clientId, client_secret: clientSecret }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ message: 'Login failed' }))) as ApiError;
      throw new Error(error.message || 'Login failed');
    }

    const data = (await response.json()) as LoginResponse;
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  }

  async function register(name: string, email: string, password: string): Promise<LoginResult> {
    const response = await fetch(`${url}/auth/register/app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, clientId, clientSecret }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ message: 'Registration failed' }))) as ApiError;
      throw new Error(error.message || 'Registration failed');
    }

    const data = (await response.json()) as LoginResponse;
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  }

  async function validateToken(token: string): Promise<TokenPayload | null> {
    try {
      const response = await fetch(`${url}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as ValidateResponse;
      return { userId: data.userId, email: data.email, exp: 0 };
    } catch {
      return null;
    }
  }

  async function refreshToken(refreshTokenValue: string): Promise<{ accessToken: string }> {
    const response = await fetch(`${url}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `refresh_token=${refreshTokenValue}` },
    });

    if (!response.ok) throw new Error('Token refresh failed');
    const data = (await response.json()) as { accessToken: string };
    return { accessToken: data.accessToken };
  }

  async function logout(accessToken: string, refreshTokenValue: string): Promise<void> {
    try {
      await fetch(`${url}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Cookie: `refresh_token=${refreshTokenValue}`,
        },
      });
    } catch {
      // Best-effort — don't block client logout if IdP is unreachable
    }
  }

  async function requestMagicLink(email: string, redirect?: string): Promise<void> {
    const response = await fetch(`${url}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirect, client_id: clientId }),
    });

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({ message: 'Magic link request failed' }))) as ApiError;
      throw new Error(error.message || 'Magic link request failed');
    }
  }

  function getMagicLinkVerifyUrl(token: string): string {
    return `${url}/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
  }

  /**
   * Probe which auth methods are currently enabled for this client_id.
   * Use this to decide what UI to render — forgotPassword() below is
   * silent on failure (204) by design so it cannot be used as a signal.
   */
  async function getAuthMethods(): Promise<AppConfig> {
    const response = await fetch(`${url}/auth/app-config?client_id=${encodeURIComponent(clientId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ message: 'Auth methods lookup failed' }))) as ApiError;
      throw new Error(error.message || 'Auth methods lookup failed');
    }

    return (await response.json()) as AppConfig;
  }

  /**
   * Request a password-reset email. The Tzam IdP routes the email through
   * the calling app's organization-scoped email provider when client_id is
   * configured (per-org branding, custom from-address). Server intentionally
   * returns 204 even when the email does not exist — never reveals whether
   * an account is registered.
   *
   * 204 does NOT guarantee an email was sent: if the app is inactive or the
   * Email/Senha method is disabled for the app, the server silently drops
   * the request (same status) to avoid leaking configuration. Call
   * getAuthMethods() first to check methods.password before offering the
   * reset flow to the user.
   */
  async function forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${url}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, clientId }),
    });

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({ message: 'Forgot password failed' }))) as ApiError;
      throw new Error(error.message || 'Forgot password failed');
    }
  }

  /**
   * Complete a password reset using the token delivered by forgotPassword.
   * Throws on invalid/expired token.
   */
  async function resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${url}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({ message: 'Password reset failed' }))) as ApiError;
      throw new Error(error.message || 'Password reset failed');
    }
  }

  async function requestOtp(email: string): Promise<void> {
    const response = await fetch(`${url}/auth/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, client_id: clientId }),
    });

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({ message: 'OTP request failed' }))) as ApiError;
      throw new Error(error.message || 'OTP request failed');
    }
  }

  async function verifyOtp(email: string, code: string): Promise<LoginResult> {
    const response = await fetch(`${url}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ message: 'Invalid code' }))) as ApiError;
      throw new Error(error.message || 'Invalid code');
    }

    const data = (await response.json()) as LoginResponse;
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  }

  return {
    login,
    register,
    validateToken,
    refreshToken,
    logout,
    requestMagicLink,
    getMagicLinkVerifyUrl,
    requestOtp,
    verifyOtp,
    forgotPassword,
    resetPassword,
    getAuthMethods,
  };
}

export type TzamClient = ReturnType<typeof createTzamClient>;
