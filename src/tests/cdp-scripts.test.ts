/**
 * CDP Script Smoke Tests
 *
 * Validates that all CDP injection script builders produce valid JavaScript.
 * Run as part of `npm run build` or `npm test` to catch syntax errors
 * in the generated scripts before packaging the extension.
 *
 * These tests DON'T run in a browser — they just verify:
 * 1. Script builders return non-empty strings
 * 2. The returned strings are valid JavaScript (parseable by Function constructor)
 * 3. JSON serialization within scripts is well-formed
 *
 * @module tests/cdp-scripts.test
 */

import { buildCSS } from '../cdp/scripts/css';
import { buildRouterSubscription } from '../cdp/scripts/build-router-sub';
import { buildChatboxUI } from '../cdp/scripts/build-chatbox-ui';
import { buildLockWatcher } from '../cdp/scripts/build-lock-watcher';
import { buildPanelScript, PanelInjectionData, AgentUIData } from '../cdp/scripts/build-panel-script';

// ─── Test Helpers ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
    if (condition) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ ${message}`);
    }
}

function assertNoThrow(fn: () => any, message: string): void {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${message}`);
    } catch (err: any) {
        failed++;
        console.error(`  ❌ ${message}: ${err.message}`);
    }
}

/**
 * Validate that a string is parseable JavaScript.
 * Uses the Function constructor to syntax-check without executing.
 */
function isValidJS(script: string): boolean {
    try {
        // Wrap in function body to validate as expression/statement
        new Function(script);
        return true;
    } catch {
        return false;
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────

console.log('\n🧪 CDP Script Smoke Tests\n');

// --- buildCSS ---
console.log('📋 buildCSS');
const css = buildCSS('sa');
assert(typeof css === 'string' && css.length > 0, 'Returns non-empty string');
assert(css.includes('.sa-dot'), 'Contains dot class');
assert(css.includes('.sa-spinner'), 'Contains spinner class');
assert(css.includes('@keyframes sa-pulse'), 'Contains pulse animation');
assert(css.includes('@keyframes sa-spin'), 'Contains spin animation');

// --- buildRouterSubscription ---
console.log('\n📋 buildRouterSubscription');
const routerScript = buildRouterSubscription();
assert(typeof routerScript === 'string' && routerScript.length > 0, 'Returns non-empty string');
assert(routerScript.includes('__saRouterSub'), 'References router subscription global');
assert(routerScript.includes('__TSR_ROUTER__'), 'References TanStack Router');
assert(isValidJS(routerScript), 'Is valid JavaScript');

// --- buildChatboxUI ---
console.log('\n📋 buildChatboxUI');
const chatboxScript = buildChatboxUI();
assert(typeof chatboxScript === 'string' && chatboxScript.length > 0, 'Returns non-empty string');
assert(chatboxScript.includes('running-dropdown'), 'Contains dropdown ID');
assert(chatboxScript.includes('lock watcher'), 'References lock watcher for badges');
assert(chatboxScript.includes('data-sa-drop-hash'), 'Contains dropdown state guard attribute');

// --- buildLockWatcher ---
console.log('\n📋 buildLockWatcher');
const lockScript = buildLockWatcher();
assert(typeof lockScript === 'string' && lockScript.length > 0, 'Returns non-empty string');
assert(lockScript.includes('__saLockWatcher'), 'References lock watcher global');
assert(lockScript.includes('enforceLocks'), 'Contains enforcement function');
assert(lockScript.includes('chat-notify'), 'Contains notification badge class');
assert(lockScript.includes('setInterval(enforceLocks, 300)'), 'Default interval is 300ms');
// Test custom interval
const lockScript500 = buildLockWatcher(500);
assert(lockScript500.includes('setInterval(enforceLocks, 500)'), 'Custom interval: 500ms');
// State guard attributes
assert(lockScript.includes('data-sa-badge-state'), 'Contains badge state guard attribute');
assert(lockScript.includes('data-sa-lock-state'), 'Contains lock state guard attribute');

// --- buildPanelScript ---
console.log('\n📋 buildPanelScript');

const mockAgents: AgentUIData[] = [
    {
        id: 'test-agent-1',
        parentId: 'parent-1',
        batchId: 'batch-1',
        label: 'Test Agent 1',
        task: 'Do something useful',
        fullTask: 'Do something useful and important',
        status: 'running',
        statusClass: 'running',
        icon: '🔄',
        model: 'Flash',
        elapsed: '2m ago',
        steps: 5,
        isActive: true,
        completedAt: 0,
        createdAt: Date.now(),
        pendingAction: null,
    },
    {
        id: 'test-agent-2',
        parentId: 'parent-1',
        batchId: 'batch-1',
        label: 'Test Agent 2',
        task: 'Another task',
        fullTask: 'Another task with more details',
        status: 'completed',
        statusClass: 'completed',
        icon: '✅',
        model: 'Pro',
        elapsed: '5m ago',
        steps: 12,
        isActive: false,
        completedAt: Date.now() - 60000,
        createdAt: Date.now() - 300000,
        pendingAction: null,
    },
    {
        id: 'test-agent-3',
        parentId: 'parent-1',
        batchId: 'batch-1',
        label: 'Action Agent',
        task: 'Needs approval',
        fullTask: 'Agent waiting for tool approval',
        status: 'waiting_for_action',
        statusClass: 'waiting',
        icon: '⏳',
        model: 'Flash',
        elapsed: '1m ago',
        steps: 3,
        isActive: true,
        completedAt: 0,
        createdAt: Date.now() - 60000,
        pendingAction: { actionType: 'command', target: 'npm install' },
    },
];

const injectionData: PanelInjectionData = {
    prefix: 'sa',
    agents: mockAgents,
    visibleLimit: 5,
    dataHash: 'test-hash-123',
    subAgentIds: ['test-agent-1', 'test-agent-2', 'test-agent-3'],
    pendingActions: {
        'test-agent-3': { actionType: 'command', target: 'npm install' },
    },
    parentMap: {
        'test-agent-1': 'parent-1',
        'test-agent-2': 'parent-1',
        'test-agent-3': 'parent-1',
    },
    parentTitles: {
        'parent-1': 'Main Development Chat',
    },
};

const panelScript = buildPanelScript(injectionData);
assert(typeof panelScript === 'string' && panelScript.length > 0, 'Returns non-empty string');
assert(panelScript.length > 1000, `Script is substantial (${panelScript.length} chars)`);
assert(panelScript.includes('test-agent-1'), 'Contains agent ID');
assert(panelScript.includes('test-hash-123'), 'Contains data hash');
assert(panelScript.includes('__saCancelAction'), 'Contains cancel binding');
assert(panelScript.includes('__saActionHandler'), 'Contains action binding');
assert(panelScript.includes('parentMap'), 'Contains parentMap variable');
assert(panelScript.includes('parentTitles'), 'Contains parentTitles variable');
assert(panelScript.includes('Main Development Chat'), 'Contains parent title text');
// Sections tracking
assert(panelScript.includes('sections.chatbox'), 'Contains chatbox section status');
assert(panelScript.includes('sections.watcher'), 'Contains watcher section status');
assert(panelScript.includes('sections.sidebar'), 'Contains sidebar section status');
assert(panelScript.includes('sections: sections'), 'Return value includes sections object');
assert(isValidJS(panelScript), 'Is valid JavaScript');

// Edge case: empty agents
const emptyData: PanelInjectionData = {
    prefix: 'sa',
    agents: [],
    visibleLimit: 5,
    dataHash: 'empty-hash',
    subAgentIds: [],
    pendingActions: {},
    parentMap: {},
    parentTitles: {},
};
const emptyScript = buildPanelScript(emptyData);
assert(isValidJS(emptyScript), 'Empty agents: is valid JavaScript');

// Edge case: special characters in task text
const specialData: PanelInjectionData = {
    prefix: 'sa',
    agents: [{
        ...mockAgents[0],
        task: 'Fix "quotes" & <brackets> \\ backslash',
        fullTask: 'Fix "quotes" & <brackets> \\ backslash and more',
    }],
    visibleLimit: 5,
    dataHash: 'special-hash',
    subAgentIds: ['test-agent-1'],
    pendingActions: {},
    parentMap: { 'test-agent-1': 'parent-1' },
    parentTitles: { 'parent-1': 'Special "Chars" Chat' },
};
const specialScript = buildPanelScript(specialData);
assert(isValidJS(specialScript), 'Special chars in task: is valid JavaScript');

// ─── Summary ────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(40)}`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}\n`);

if (failed > 0) {
    process.exit(1);
}
