/**
 * CDP Target Manager
 *
 * Handles target discovery via HTTP /json endpoint, WebSocket module
 * resolution, and port scanning for the Chrome DevTools Protocol.
 *
 * @module cdp/target-manager
 */

import * as http from 'http';

// --- Types ---

export interface CdpTarget {
    id: string;
    type: string;
    title: string;
    url: string;
    webSocketDebuggerUrl?: string;
}

// --- Output ---

let _log: (msg: string) => void = () => {};
export function setLogger(fn: (msg: string) => void): void { _log = fn; }

// --- HTTP Target Discovery ---

export function getTargets(port: number): Promise<CdpTarget[]> {
    return new Promise((resolve) => {
        const req = http.get(
            { hostname: '127.0.0.1', port, path: '/json', timeout: 3000 },
            (res) => {
                let data = '';
                res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve([]); }
                });
            },
        );
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
    });
}

// --- WebSocket Module Resolution ---

let _wsModule: any = undefined;

/**
 * Load the `ws` WebSocket module. Tries:
 * 1. Normal require('ws')
 * 2. Antigravity's bundled ws (resources/app/node_modules/ws)
 *
 * Returns the ws constructor or null if not found.
 */
export function loadWs(): any {
    if (_wsModule !== undefined) return _wsModule;

    const pathMod = require('path');
    const exeDir = pathMod.dirname(process.execPath);
    const agWsPath = pathMod.join(exeDir, 'resources', 'app', 'node_modules', 'ws');
    const paths = ['ws', agWsPath];
    _log(`ws search: execPath=${process.execPath}, wsPath=${agWsPath}`);

    for (const p of paths) {
        try {
            const mod = require(p);
            _log(`ws module loaded from: ${p}`);
            _wsModule = mod;
            return mod;
        } catch { /* next */ }
    }

    _log(`ws NOT found. Tried: ${paths.join(', ')}`);
    _wsModule = null;
    return null;
}

/**
 * Find the best CDP target from a list.
 * Prefers "Manager" page, then any page with a WebSocket URL.
 */
export function findBestTarget(targets: CdpTarget[]): CdpTarget | null {
    const managerTarget = targets.find(t => t.type === 'page' && t.title === 'Manager');
    const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    return managerTarget || pageTarget || null;
}
