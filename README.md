# Tzam - IDP Authentication for Next.js

**Tzam** (צם) - Hebraico para "vigiar e proteger"

A simple and secure authentication client for Next.js applications integrated with the IDP identity provider.

## Installation

```bash
npm install @rpappio/tzam
# or
pnpm add @rpappio/tzam
```

## Setup

### 1. Environment Variables

Add to your `.env` file:

```env
IDP_URL=http://localhost:3001
```

### 2. Create the Proxy

Create `proxy.ts` in your Next.js app root:

```typescript
import { proxy, config } from '@rpappio/tzam/proxy';

export { config };
export default proxy;
```

### 3. Create Login API Route

Create `app/api/auth/login/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { loginToIDP } from '@rpappio/tzam';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const result = await loginToIDP(email, password);

    const response = NextResponse.json({ success: true, user: result.user });

    response.cookies.set('session', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    if (result.refreshToken) {
      response.cookies.set('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
  }
}
```

### 4. Create Register API Route

Create `app/api/auth/register/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { registerToIDP } from '@rpappio/tzam';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const result = await registerToIDP(name, email, password);

    const response = NextResponse.json({ success: true, user: result.user });

    response.cookies.set('session', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Registration failed. Email may already be in use.' },
      { status: 400 },
    );
  }
}
```

### 5. Create Login Page

Create `app/auth/login/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid credentials');
        return;
      }

      window.location.href = redirectTo;
    } catch {
      setError('Login error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

### 6. Get User Info in Server Components

```typescript
import { headers } from 'next/headers';

export default async function DashboardPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');
  const userEmail = headersList.get('x-user-email');

  return (
    <div>
      <h1>Welcome, {userEmail}!</h1>
      <p>User ID: {userId}</p>
    </div>
  );
}
```

## Features

- **JWT-based authentication** with IDP
- **Automatic token validation** in middleware
- **User headers** for server components
- **Configurable public routes**
- **TypeScript support**

## API

### `loginToIDP(email, password)`

Login with email and password.

### `registerToIDP(name, email, password)`

Register a new user.

### `validateIDPToken(token)`

Validate an access token.

### `refreshIDPToken(refreshToken)`

Refresh an expired access token.

## License

MIT
