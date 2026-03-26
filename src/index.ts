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

  return { login, register, validateToken, refreshToken };
}

export type TzamClient = ReturnType<typeof createTzamClient>;
