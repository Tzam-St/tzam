import { createTzamClient } from './index';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('createTzamClient', () => {
  const client = createTzamClient({
    url: 'http://localhost:4000',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('refreshToken', () => {
    it('should call refresh endpoint with refresh token in Cookie header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'new-access-token' }),
      });

      const result = await client.refreshToken('my-refresh-token');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'refresh_token=my-refresh-token' },
      });
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw when refresh fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      await expect(client.refreshToken('bad-token')).rejects.toThrow('Token refresh failed');
    });
  });

  describe('validateToken', () => {
    it('should return payload for valid token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ userId: 'u1', email: 'a@b.com' }),
      });

      const result = await client.validateToken('valid-token');
      expect(result).toEqual({ userId: 'u1', email: 'a@b.com', exp: 0 });
    });

    it('should return null for invalid token', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const result = await client.validateToken('bad-token');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.validateToken('any-token');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should send credentials with client_id and client_secret', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: 'at',
          refreshToken: 'rt',
          user: { id: 'u1', email: 'a@b.com', name: 'Test' },
        }),
      });

      const result = await client.login('a@b.com', 'pass123');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'a@b.com',
          password: 'pass123',
          client_id: 'test-client',
          client_secret: 'test-secret',
        }),
      });
      expect(result.accessToken).toBe('at');
      expect(result.refreshToken).toBe('rt');
    });

    it('should throw on login failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(client.login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });
});
