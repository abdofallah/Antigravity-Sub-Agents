/**
 * Simulation Panel — Webview HTML Generator
 *
 * Generates a rich, premium dark UI for the simulation panel.
 * Controls allow spawning fake agents, transitioning states,
 * adding pending actions, and clearing everything.
 *
 * Communicates with the extension host via vscode.postMessage().
 *
 * @module simulation/webview
 */

/**
 * Generate the full HTML content for the simulation webview panel.
 */
export function getSimulationWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sub-Agent Simulator</title>
    <style>
        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --bg-card: #1c2128;
            --border: #30363d;
            --border-accent: #388bfd40;
            --text-primary: #e6edf3;
            --text-secondary: #8b949e;
            --text-muted: #484f58;
            --accent: #58a6ff;
            --accent-hover: #79c0ff;
            --green: #3fb950;
            --green-bg: rgba(63, 185, 80, 0.1);
            --yellow: #d29922;
            --yellow-bg: rgba(210, 153, 34, 0.1);
            --red: #f85149;
            --red-bg: rgba(248, 81, 73, 0.1);
            --purple: #a371f7;
            --purple-bg: rgba(163, 113, 247, 0.1);
            --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            --radius: 8px;
            --radius-sm: 6px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--font);
            background: var(--bg-primary);
            color: var(--text-primary);
            font-size: 13px;
            line-height: 1.5;
            padding: 16px;
            overflow-y: auto;
        }

        h1 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        h1 .badge {
            font-size: 10px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 12px;
            background: var(--purple-bg);
            color: var(--purple);
            border: 1px solid rgba(163, 113, 247, 0.2);
        }
        .subtitle {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }

        /* Sections */
        .section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 16px;
            margin-bottom: 16px;
        }
        .section-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--text-primary);
        }
        .section-title .icon { font-size: 14px; opacity: 0.7; }

        /* Form controls */
        .form-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            align-items: center;
        }
        .form-row.stacked {
            flex-direction: column;
            align-items: stretch;
        }
        label {
            font-size: 11px;
            font-weight: 500;
            color: var(--text-secondary);
            min-width: 70px;
            flex-shrink: 0;
        }
        label.required::after {
            content: ' *';
            color: var(--red);
        }
        input, select, textarea {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 6px 10px;
            color: var(--text-primary);
            font-size: 12px;
            font-family: var(--font);
            flex: 1;
            outline: none;
            transition: border-color 0.15s;
        }
        input:focus, select:focus, textarea:focus {
            border-color: var(--accent);
        }
        input.error { border-color: var(--red); }
        .hint {
            font-size: 10px;
            color: var(--text-muted);
            margin-top: -4px;
            margin-bottom: 6px;
            padding-left: 78px;
        }
        textarea { resize: vertical; min-height: 60px; }
        select { cursor: pointer; }

        /* Buttons */
        .btn {
            padding: 6px 14px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            background: var(--bg-tertiary);
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
            white-space: nowrap;
        }
        .btn:hover { border-color: var(--accent); background: var(--bg-secondary); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn:disabled:hover { border-color: var(--border); background: var(--bg-tertiary); }
        .btn-primary {
            background: var(--accent);
            border-color: var(--accent);
            color: #fff;
        }
        .btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
        .btn-danger {
            background: var(--red-bg);
            border-color: rgba(248, 81, 73, 0.3);
            color: var(--red);
        }
        .btn-danger:hover { background: rgba(248, 81, 73, 0.2); border-color: var(--red); }
        .btn-success {
            background: var(--green-bg);
            border-color: rgba(63, 185, 80, 0.3);
            color: var(--green);
        }
        .btn-success:hover { background: rgba(63, 185, 80, 0.2); border-color: var(--green); }
        .btn-warning {
            background: var(--yellow-bg);
            border-color: rgba(210, 153, 34, 0.3);
            color: var(--yellow);
        }
        .btn-warning:hover { background: rgba(210, 153, 34, 0.2); border-color: var(--yellow); }
        .btn-sm { padding: 3px 8px; font-size: 11px; }

        /* Presets */
        .presets {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
        }

        /* Agent list */
        .agent-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .agent-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: border-color 0.15s;
        }
        .agent-card:hover { border-color: var(--border-accent); }
        .agent-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        .agent-card-label {
            font-weight: 500;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .agent-card-meta {
            font-size: 11px;
            color: var(--text-secondary);
        }
        .agent-card-id {
            font-size: 10px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            color: var(--text-muted);
            padding: 1px 5px;
            background: var(--bg-tertiary);
            border-radius: 3px;
        }
        .agent-card-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        /* Status badges */
        .status-badge {
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 500;
        }
        .status-pending { background: var(--bg-tertiary); color: var(--text-secondary); }
        .status-running { background: var(--green-bg); color: var(--green); border: 1px solid rgba(63, 185, 80, 0.2); }
        .status-waiting { background: var(--yellow-bg); color: var(--yellow); border: 1px solid rgba(210, 153, 34, 0.2); }
        .status-completed { background: var(--green-bg); color: var(--green); border: 1px solid rgba(63, 185, 80, 0.2); }
        .status-failed { background: var(--red-bg); color: var(--red); border: 1px solid rgba(248, 81, 73, 0.2); }
        .status-cancelled { background: var(--bg-tertiary); color: var(--text-muted); }

        /* Toolbar */
        .toolbar {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 16px;
            padding: 8px 12px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
        }
        .toolbar-label {
            font-size: 11px;
            color: var(--text-muted);
        }

        /* Divider */
        .divider { border-top: 1px solid var(--border); margin: 12px 0; }

        /* Empty state */
        .empty-state {
            text-align: center;
            padding: 24px;
            color: var(--text-muted);
            font-size: 12px;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
    </style>
</head>
<body>
    <h1>🧪 Sub-Agent Simulator <span class="badge">DEV ONLY</span></h1>
    <p class="subtitle">Spawn fake agents and control their states to test all UI surfaces in real-time.</p>

    <!-- Dev toolbar -->
    <div class="toolbar">
        <span class="toolbar-label">Dev Tools:</span>
        <button class="btn btn-sm" onclick="restartExtHost()">🔄 Restart Extension Host</button>
        <button class="btn btn-sm" onclick="reloadWindow()">♻️ Reload Window</button>
    </div>

    <!-- Spawn Section -->
    <div class="section">
        <div class="section-title"><span class="icon">🚀</span> Spawn Agent</div>
        <div class="form-row">
            <label class="required">Parent ID</label>
            <input type="text" id="spawn-parent" placeholder="Cascade ID of parent conversation (required)" />
        </div>
        <div class="hint">Paste the cascade ID of the chat you want agents to appear under</div>
        <div class="form-row">
            <label>Chat ID</label>
            <input type="text" id="spawn-chatid" placeholder="(optional) Real cascade ID to use as agent ID" />
        </div>
        <div class="hint">If set, this chat will appear as a sub-agent. Leave empty for auto-generated ID.</div>
        <div class="form-row">
            <label>Label</label>
            <input type="text" id="spawn-label" placeholder="e.g. File Analyzer" value="Test Agent" />
        </div>
        <div class="form-row">
            <label>Task</label>
            <input type="text" id="spawn-task" placeholder="e.g. Analyze the codebase structure" value="Analyze and report on the project structure" />
        </div>
        <div class="form-row">
            <label>Model</label>
            <select id="spawn-model">
                <option value="flash">⚡ Gemini Flash</option>
                <option value="pro-low">🧠 Gemini Pro (Low)</option>
                <option value="pro-high">🧠 Gemini Pro (High)</option>
                <option value="sonnet">🎵 Claude Sonnet</option>
                <option value="opus">🎭 Claude Opus</option>
                <option value="gpt">🤖 GPT OSS</option>
            </select>
        </div>
        <div class="form-row">
            <label>Status</label>
            <select id="spawn-status">
                <option value="running">🟢 Running</option>
                <option value="pending">⏳ Pending</option>
                <option value="waiting_for_action">🔔 Waiting for Action</option>
                <option value="completed">✅ Completed</option>
                <option value="failed">❌ Failed</option>
                <option value="cancelled">🚫 Cancelled</option>
            </select>
        </div>
        <div class="form-row" style="justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button class="btn btn-primary" id="btn-spawn" onclick="spawnAgent()">Spawn Agent</button>
            <button class="btn" id="btn-batch" onclick="spawnBatch()">Spawn Batch (3)</button>
        </div>
    </div>

    <!-- Quick Presets -->
    <div class="section">
        <div class="section-title"><span class="icon">⚡</span> Quick Presets</div>
        <p class="hint" style="padding-left: 0; margin-bottom: 8px;">Requires Parent ID to be set above.</p>
        <div class="presets">
            <button class="btn btn-sm btn-success" onclick="preset('running3')">3 Running</button>
            <button class="btn btn-sm btn-warning" onclick="preset('waiting')">1 Waiting</button>
            <button class="btn btn-sm" onclick="preset('mixed')">Mixed (5 agents)</button>
            <button class="btn btn-sm" onclick="preset('batch2')">2 Batches</button>
            <button class="btn btn-sm btn-danger" onclick="preset('failed')">Failed + Error</button>
            <button class="btn btn-sm" onclick="preset('allStates')">All States</button>
        </div>
    </div>

    <!-- Active Agents -->
    <div class="section">
        <div class="section-title" style="justify-content: space-between;">
            <span><span class="icon">📋</span> Simulated Agents (<span id="agent-count">0</span>)</span>
            <button class="btn btn-sm btn-danger" onclick="clearAll()">Clear All</button>
        </div>
        <div id="agent-list" class="agent-list">
            <div class="empty-state">No simulated agents yet. Spawn one above!</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let agents = [];
        let counter = 0;
        let usedIds = new Set();

        const MODELS = { flash: 1, 'pro-low': 2, 'pro-high': 3, sonnet: 4, opus: 5, gpt: 6 };
        const MODEL_LABELS = { 1: '⚡ Flash', 2: '🧠 Pro-L', 3: '🧠 Pro-H', 4: '🎵 Sonnet', 5: '🎭 Opus', 6: '🤖 GPT' };
        const STATUS_LABELS = {
            pending: '⏳ Pending',
            running: '🟢 Running',
            waiting_for_action: '🔔 Waiting',
            completed: '✅ Completed',
            failed: '❌ Failed',
            cancelled: '🚫 Cancelled',
        };

        function genId() { return 'sim-' + Date.now().toString(36) + '-' + (++counter).toString(36); }

        function getParentId() {
            return document.getElementById('spawn-parent').value.trim();
        }

        function validateParentId() {
            const el = document.getElementById('spawn-parent');
            const val = el.value.trim();
            if (!val) {
                el.classList.add('error');
                return false;
            }
            el.classList.remove('error');
            return true;
        }

        // Validate on input
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('spawn-parent').addEventListener('input', validateParentId);
        });

        function restartExtHost() {
            vscode.postMessage({ type: 'command', command: 'workbench.action.restartExtensionHost' });
        }

        function reloadWindow() {
            vscode.postMessage({ type: 'command', command: 'workbench.action.reloadWindow' });
        }

        function spawnAgent(overrides) {
            const parentId = overrides?.parentId || getParentId();
            if (!parentId) {
                if (!overrides?.parentId) {
                    document.getElementById('spawn-parent').classList.add('error');
                    document.getElementById('spawn-parent').focus();
                }
                return;
            }

            const label = overrides?.label || document.getElementById('spawn-label').value || 'Test Agent';
            const task = overrides?.task || document.getElementById('spawn-task').value || 'Simulated task';
            const modelKey = overrides?.model || document.getElementById('spawn-model').value || 'flash';
            const status = overrides?.status || document.getElementById('spawn-status').value || 'running';
            const batchId = overrides?.batchId || genId();

            // Determine agent ID: use chatId field if provided, otherwise auto-generate
            let agentId;
            if (overrides?.chatId) {
                agentId = overrides.chatId;
            } else {
                const chatIdInput = document.getElementById('spawn-chatid').value.trim();
                agentId = chatIdInput || genId();
            }

            // Prevent duplicate agent IDs
            if (usedIds.has(agentId)) {
                alert('An agent with ID "' + agentId.substring(0, 12) + '..." already exists in simulation. Use a different Chat ID.');
                return;
            }

            const agent = {
                id: agentId,
                label,
                task,
                model: MODELS[modelKey] || 1,
                parentId,
                batchId,
                status,
                stepCount: status === 'running' ? Math.floor(Math.random() * 12) + 1 : 0,
                createdAt: Date.now() - Math.floor(Math.random() * 60000),
                completedAt: ['completed', 'failed', 'cancelled'].includes(status) ? Date.now() : undefined,
                error: status === 'failed' ? (overrides?.error || 'Simulated failure') : undefined,
                pendingAction: status === 'waiting_for_action' ? {
                    trajectoryId: 'traj-sim',
                    stepIndex: 3,
                    actionType: overrides?.actionType || 'command',
                    target: overrides?.actionTarget || 'npm run build',
                } : undefined,
            };

            usedIds.add(agentId);
            agents.push(agent);
            vscode.postMessage({ type: 'spawn', agent, batchId });
            renderAgents();
        }

        function spawnBatch() {
            const parentId = getParentId();
            if (!parentId) {
                document.getElementById('spawn-parent').classList.add('error');
                document.getElementById('spawn-parent').focus();
                return;
            }

            const batchId = genId();
            const tasks = ['Analyze codebase', 'Run tests', 'Generate report'];
            const models = ['flash', 'sonnet', 'pro-high'];

            tasks.forEach((task, i) => {
                spawnAgent({
                    label: 'Batch Agent ' + (i + 1),
                    task,
                    model: models[i],
                    parentId,
                    batchId,
                    status: 'running',
                });
            });
        }

        function preset(name) {
            const parentId = getParentId();
            if (!parentId) {
                document.getElementById('spawn-parent').classList.add('error');
                document.getElementById('spawn-parent').focus();
                return;
            }

            clearAll();
            const batchId = genId();

            switch (name) {
                case 'running3':
                    for (let i = 1; i <= 3; i++) spawnAgent({ label: 'Worker ' + i, task: 'Processing chunk ' + i, model: 'flash', parentId, batchId, status: 'running' });
                    break;
                case 'waiting':
                    spawnAgent({ label: 'Permission Agent', task: 'Needs user approval to run command', model: 'sonnet', parentId, batchId, status: 'waiting_for_action', actionType: 'command', actionTarget: 'rm -rf node_modules' });
                    break;
                case 'mixed': {
                    const bid = batchId;
                    spawnAgent({ label: 'File Analyzer', task: 'Scanning project files', model: 'flash', parentId, batchId: bid, status: 'running' });
                    spawnAgent({ label: 'Test Runner', task: 'Running unit tests', model: 'pro-high', parentId, batchId: bid, status: 'running' });
                    spawnAgent({ label: 'Linter', task: 'Checking code quality', model: 'flash', parentId, batchId: bid, status: 'waiting_for_action', actionType: 'edit', actionTarget: 'utils.ts:L45' });
                    spawnAgent({ label: 'Doc Generator', task: 'Generate API docs', model: 'sonnet', parentId, batchId: bid, status: 'completed' });
                    spawnAgent({ label: 'Deploy Bot', task: 'Deploy to staging', model: 'gpt', parentId, batchId: bid, status: 'failed', error: 'Network timeout' });
                    break;
                }
                case 'batch2': {
                    const bid1 = genId();
                    const bid2 = genId();
                    spawnAgent({ label: 'Batch1 Agent A', task: 'First batch task A', model: 'flash', parentId, batchId: bid1, status: 'running' });
                    spawnAgent({ label: 'Batch1 Agent B', task: 'First batch task B', model: 'flash', parentId, batchId: bid1, status: 'running' });
                    spawnAgent({ label: 'Batch2 Agent A', task: 'Second batch task A', model: 'opus', parentId, batchId: bid2, status: 'waiting_for_action', actionType: 'command', actionTarget: 'git push --force' });
                    spawnAgent({ label: 'Batch2 Agent B', task: 'Second batch task B', model: 'opus', parentId, batchId: bid2, status: 'completed' });
                    break;
                }
                case 'failed':
                    spawnAgent({ label: 'Crashed Agent', task: 'Task that failed', model: 'pro-low', parentId, batchId, status: 'failed', error: 'RuntimeError: maximum recursion depth exceeded' });
                    spawnAgent({ label: 'Timeout Agent', task: 'Task that timed out', model: 'gpt', parentId, batchId, status: 'failed', error: 'TimeoutError: agent stale for 300s' });
                    break;
                case 'allStates': {
                    const bid = batchId;
                    spawnAgent({ label: 'Pending Bot', task: 'Waiting to start', model: 'flash', parentId, batchId: bid, status: 'pending' });
                    spawnAgent({ label: 'Running Bot', task: 'Actively working', model: 'sonnet', parentId, batchId: bid, status: 'running' });
                    spawnAgent({ label: 'Action Bot', task: 'Needs approval', model: 'opus', parentId, batchId: bid, status: 'waiting_for_action', actionType: 'command', actionTarget: 'docker compose up' });
                    spawnAgent({ label: 'Done Bot', task: 'Already finished', model: 'pro-high', parentId, batchId: bid, status: 'completed' });
                    spawnAgent({ label: 'Failed Bot', task: 'Errored out', model: 'gpt', parentId, batchId: bid, status: 'failed', error: 'API rate limit exceeded' });
                    spawnAgent({ label: 'Cancelled Bot', task: 'User stopped it', model: 'flash', parentId, batchId: bid, status: 'cancelled' });
                    break;
                }
            }
        }

        function updateAgent(id, updates) {
            const agent = agents.find(a => a.id === id);
            if (!agent) return;
            Object.assign(agent, updates);
            if (updates.status === 'waiting_for_action' && !agent.pendingAction) {
                agent.pendingAction = { trajectoryId: 'traj-sim', stepIndex: 3, actionType: 'command', target: 'simulated command' };
                updates.pendingAction = agent.pendingAction;
            }
            if (updates.status && updates.status !== 'waiting_for_action') {
                agent.pendingAction = undefined;
                updates.pendingAction = null;
            }
            if (['completed', 'failed', 'cancelled'].includes(updates.status)) {
                agent.completedAt = Date.now();
                updates.completedAt = agent.completedAt;
            }
            vscode.postMessage({ type: 'update', id, updates });
            renderAgents();
        }

        function removeAgent(id) {
            agents = agents.filter(a => a.id !== id);
            usedIds.delete(id);
            vscode.postMessage({ type: 'remove', id });
            renderAgents();
        }

        function clearAll() {
            agents = [];
            usedIds.clear();
            vscode.postMessage({ type: 'clearAll' });
            renderAgents();
        }

        function incrementSteps(id) {
            const agent = agents.find(a => a.id === id);
            if (!agent) return;
            agent.stepCount = (agent.stepCount || 0) + 1;
            updateAgent(id, { stepCount: agent.stepCount });
        }

        function statusClass(status) {
            if (status === 'waiting_for_action') return 'waiting';
            return status;
        }

        function shortId(id) {
            if (id.startsWith('sim-')) return id.substring(0, 12);
            return id.substring(0, 8) + '...';
        }

        function renderAgents() {
            const list = document.getElementById('agent-list');
            document.getElementById('agent-count').textContent = agents.length;

            if (agents.length === 0) {
                list.innerHTML = '<div class="empty-state">No simulated agents yet. Spawn one above!</div>';
                return;
            }

            list.innerHTML = agents.map(a => \`
                <div class="agent-card">
                    <div class="agent-card-header">
                        <span class="agent-card-label">
                            <span class="status-badge status-\${statusClass(a.status)}">\${STATUS_LABELS[a.status] || a.status}</span>
                            \${a.label}
                        </span>
                        <span class="agent-card-meta">\${MODEL_LABELS[a.model] || '?'} · \${a.stepCount || 0} steps</span>
                    </div>
                    <div class="agent-card-meta">
                        \${a.task}
                        <span class="agent-card-id" title="\${a.id}">id: \${shortId(a.id)}</span>
                    </div>
                    <div class="agent-card-controls">
                        <button class="btn btn-sm" onclick="updateAgent('\${a.id}', {status:'pending'})">⏳ Pending</button>
                        <button class="btn btn-sm btn-success" onclick="updateAgent('\${a.id}', {status:'running'})">🟢 Run</button>
                        <button class="btn btn-sm btn-warning" onclick="updateAgent('\${a.id}', {status:'waiting_for_action'})">🔔 Wait</button>
                        <button class="btn btn-sm btn-success" onclick="updateAgent('\${a.id}', {status:'completed'})">✅ Done</button>
                        <button class="btn btn-sm btn-danger" onclick="updateAgent('\${a.id}', {status:'failed', error:'Simulated error'})">❌ Fail</button>
                        <button class="btn btn-sm" onclick="updateAgent('\${a.id}', {status:'cancelled'})">🚫 Cancel</button>
                        <button class="btn btn-sm" onclick="incrementSteps('\${a.id}')">+Step</button>
                        <button class="btn btn-sm btn-danger" onclick="removeAgent('\${a.id}')">🗑️</button>
                    </div>
                </div>
            \`).join('');
        }

        // Initial render
        renderAgents();
    </script>
</body>
</html>`;
}
