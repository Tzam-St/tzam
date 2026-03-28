import { NextRequest, NextResponse } from 'next/server';
import { TzamConfig } from './index.js';

interface TzamProxyConfig extends TzamConfig {
    publicRoutes?: string[];
    loginUrl?: string;
}
declare function createTzamProxy(config: TzamProxyConfig): (request: NextRequest) => Promise<NextResponse<unknown>>;

export { type TzamProxyConfig, createTzamProxy };
