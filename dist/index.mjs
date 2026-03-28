// src/index.ts
function createTzamClient(config) {
  const { url, clientId, clientSecret } = config;
  async function login(email, password) {
    const response = await fetch(`${url}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, client_id: clientId, client_secret: clientSecret })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Login failed" }));
      throw new Error(error.message || "Login failed");
    }
    const data = await response.json();
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  }
  async function register(name, email, password) {
    const response = await fetch(`${url}/auth/register/app`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, clientId, clientSecret })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Registration failed" }));
      throw new Error(error.message || "Registration failed");
    }
    const data = await response.json();
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  }
  async function validateToken(token) {
    try {
      const response = await fetch(`${url}/auth/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token })
      });
      if (!response.ok) return null;
      const data = await response.json();
      return { userId: data.userId, email: data.email, exp: 0 };
    } catch {
      return null;
    }
  }
  async function refreshToken(refreshTokenValue) {
    const response = await fetch(`${url}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `refresh_token=${refreshTokenValue}` }
    });
    if (!response.ok) throw new Error("Token refresh failed");
    const data = await response.json();
    return { accessToken: data.accessToken };
  }
  async function logout(accessToken, refreshTokenValue) {
    try {
      await fetch(`${url}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          Cookie: `refresh_token=${refreshTokenValue}`
        }
      });
    } catch {
    }
  }
  async function requestMagicLink(email, redirect) {
    const response = await fetch(`${url}/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirect })
    });
    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({ message: "Magic link request failed" }));
      throw new Error(error.message || "Magic link request failed");
    }
  }
  function getMagicLinkVerifyUrl(token) {
    return `${url}/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
  }
  async function requestOtp(email) {
    const response = await fetch(`${url}/auth/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({ message: "OTP request failed" }));
      throw new Error(error.message || "OTP request failed");
    }
  }
  async function verifyOtp(email, code) {
    const response = await fetch(`${url}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Invalid code" }));
      throw new Error(error.message || "Invalid code");
    }
    const data = await response.json();
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  }
  return { login, register, validateToken, refreshToken, logout, requestMagicLink, getMagicLinkVerifyUrl, requestOtp, verifyOtp };
}
export {
  createTzamClient
};
//# sourceMappingURL=index.mjs.map