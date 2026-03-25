export interface User {
  id: string;
  email: string;
  name: string;
  plan?: 'free' | 'pro';
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

export interface AuthError {
  message: string;
  code?: string;
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

const IDP_URL = process.env.IDP_URL || 'http://localhost:3001';

export async function loginToIDP(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${IDP_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Login failed' }))) as ApiError;
    throw new Error(error.message || 'Login failed');
  }

  const data = (await response.json()) as LoginResponse;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

export async function registerToIDP(
  name: string,
  email: string,
  password: string,
): Promise<LoginResult> {
  const response = await fetch(`${IDP_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ message: 'Registration failed' }))) as ApiError;
    throw new Error(error.message || 'Registration failed');
  }

  const data = (await response.json()) as LoginResponse;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

export async function validateIDPToken(token: string): Promise<TokenPayload | null> {
  try {
    const response = await fetch(`${IDP_URL}/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as ValidateResponse;
    return {
      userId: data.userId,
      email: data.email,
      exp: 0,
    };
  } catch {
    return null;
  }
}

export async function refreshIDPToken(refreshToken: string): Promise<{ accessToken: string }> {
  const response = await fetch(`${IDP_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `refresh_token=${refreshToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = (await response.json()) as { accessToken: string };
  return { accessToken: data.accessToken };
}
