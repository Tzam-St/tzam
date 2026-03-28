interface TzamConfig {
    url: string;
    clientId: string;
    clientSecret: string;
}
interface User {
    id: string;
    email: string;
    name: string;
}
interface LoginResult {
    accessToken: string;
    refreshToken: string;
    user: User;
}
interface TokenPayload {
    userId: string;
    email: string;
    exp: number;
}
declare function createTzamClient(config: TzamConfig): {
    login: (email: string, password: string) => Promise<LoginResult>;
    register: (name: string, email: string, password: string) => Promise<LoginResult>;
    validateToken: (token: string) => Promise<TokenPayload | null>;
    refreshToken: (refreshTokenValue: string) => Promise<{
        accessToken: string;
    }>;
    logout: (accessToken: string, refreshTokenValue: string) => Promise<void>;
    requestMagicLink: (email: string, redirect?: string) => Promise<void>;
    getMagicLinkVerifyUrl: (token: string) => string;
    requestOtp: (email: string) => Promise<void>;
    verifyOtp: (email: string, code: string) => Promise<LoginResult>;
};
type TzamClient = ReturnType<typeof createTzamClient>;

export { type LoginResult, type TokenPayload, type TzamClient, type TzamConfig, type User, createTzamClient };
