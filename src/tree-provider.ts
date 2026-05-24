/**
 * Sub-Agent TreeView — Live sidebar showing all sub-agents
 *
 * Two panels:
 * - "Active Sub-Agents" — grouped by batch, showing running/pending/waiting
 * - "History" — completed/failed/cancelled agents
 *
 * Updates in REALTIME: every Orchestrator event triggers a full refresh.
 * TreeView items show: status icon, label, model badge, step count, elapsed time.
 *
 * @module tree-provider
 */

import * as vscode from 'vscode';
import { Orchestrator } from './orchestrator';
import {
    ISubAgent,
    ISubAgentBatch,
    SubAgentStatus,
    STATUS_ICONS,
    MODEL_LABELS,
    isActiveStatus,
    isTerminalStatus,
    formatElapsed,
} from './types';

// ─── Tree Item Types ────────────────────────────────────────────────────

class BatchItem extends vscode.TreeItem {
    constructor(
        public readonly batch: ISubAgentBatch,
        public readonly agents: ISubAgent[],
    ) {
        const running = agents.filter(a => a.status === SubAgentStatus.Running).length;
        const total = agents.length;
        const done = agents.filter(a => isTerminalStatus(a.status)).length;
        const waiting = agents.filter(a => a.status === SubAgentStatus.WaitingForAction).length;

        let icon = '🚀';
        if (done === total) icon = '✅';
        else if (waiting > 0) icon = '🔔';

        super(
            `${icon} Batch: ${batch.description} (${done}/${total})`,
            vscode.TreeItemCollapsibleState.Expanded,
        );

        this.description = formatElapsed(batch.createdAt);
        this.tooltip = new vscode.MarkdownString(
            `**Batch:** ${batch.description}\n\n`
            + `- Running: ${running}\n`
            + `- Waiting: ${waiting}\n`
            + `- Completed: ${done}\n`
            + `- Total: ${total}\n\n`
            + `Created: ${new Date(batch.createdAt).toLocaleTimeString()}`,
        );
        this.contextValue = 'batch';
    }
}

class SubAgentItem extends vscode.TreeItem {
    constructor(public readonly agent: ISubAgent) {
        const icon = STATUS_ICONS[agent.status];
        const modelBadge = MODEL_LABELS[agent.model] || '?';

        super(
            `${icon} ${agent.label}`,
            vscode.TreeItemCollapsibleState.None,
        );

        // Description shows model + step count
        const parts: string[] = [modelBadge];
        if (agent.stepCount > 0) {
            parts.push(`${agent.stepCount} steps`);
        }
        if (isActiveStatus(agent.status)) {
            parts.push(formatElapsed(agent.createdAt));
        }
        this.description = parts.join(' · ');

        // Rich tooltip
        const lines = [
            `**${agent.label}**`,
            '',
            `**Status:** ${icon} ${agent.status}`,
            `**Model:** ${modelBadge}`,
            `**Steps:** ${agent.stepCount}`,
            `**Task:** ${agent.task.substring(0, 200)}${agent.task.length > 200 ? '...' : ''}`,
            '',
            `**Created:** ${new Date(agent.createdAt).toLocaleTimeString()}`,
        ];
        if (agent.completedAt) {
            lines.push(`**Completed:** ${new Date(agent.completedAt).toLocaleTimeString()}`);
        }
        if (agent.error) {
            lines.push(`\n**Error:** ${agent.error}`);
        }
        this.tooltip = new vscode.MarkdownString(lines.join('\n'));

        // Context value for context menu — encodes status for "when" clause matching
        this.contextValue = `subagent-${agent.status}`;

        // Click to view the chat
        this.command = {
            command: 'subagents.viewChat',
            title: 'View Chat',
            arguments: [agent.id],
        };

        // Icon color based on status
        this.iconPath = this._getStatusIcon(agent.status);
    }

    private _getStatusIcon(status: SubAgentStatus): vscode.ThemeIcon {
        switch (status) {
            case SubAgentStatus.Running:
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.green'));
            case SubAgentStatus.WaitingForAction:
                return new vscode.ThemeIcon('bell-dot', new vscode.ThemeColor('charts.yellow'));
            case SubAgentStatus.Completed:
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            case SubAgentStatus.Failed:
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case SubAgentStatus.Cancelled:
                return new vscode.ThemeIcon('circle-slash');
            case SubAgentStatus.Pending:
            default:
                return new vscode.ThemeIcon('loading~spin');
        }
    }
}

// ─── Active Sub-Agents TreeView ─────────────────────────────────────────

export class ActiveTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _orchestrator: Orchestrator) {
        // REALTIME: refresh on EVERY orchestrator event
        this._disposables.push(
            this._orchestrator.onEvent(() => this.refresh()),
        );
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            // Root level: show batches that have active agents
            const batches = this._orchestrator.getBatches();
            const activeBatches = batches.filter(b => {
                const agents = this._orchestrator.getBatchAgents(b.id);
                return agents.some(a => isActiveStatus(a.status));
            });

            if (activeBatches.length === 0) {
                // Show a placeholder
                const empty = new vscode.TreeItem('No active sub-agents');
                empty.description = 'Use 🚀 to launch';
                empty.iconPath = new vscode.ThemeIcon('info');
                return [empty];
            }

            return activeBatches.map(b => {
                const agents = this._orchestrator.getBatchAgents(b.id);
                return new BatchItem(b, agents);
            });
        }

        if (element instanceof BatchItem) {
            // Show sub-agents in this batch
            return element.agents
                .filter(a => isActiveStatus(a.status))
                .map(a => new SubAgentItem(a));
        }

        return [];
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
        for (const d of this._disposables) d.dispose();
    }
}

// ─── History TreeView ───────────────────────────────────────────────────

export class HistoryTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _orchestrator: Orchestrator) {
        this._disposables.push(
            this._orchestrator.onEvent(() => this.refresh()),
        );
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            const history = this._orchestrator.getHistory();
            if (history.length === 0) {
                const empty = new vscode.TreeItem('No history yet');
                empty.iconPath = new vscode.ThemeIcon('history');
                return [empty];
            }

            // Sort by completedAt descending (most recent first)
            return history
                .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
                .slice(0, 50) // Limit to 50 most recent
                .map(a => new SubAgentItem(a));
        }
        return [];
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
        for (const d of this._disposables) d.dispose();
    }
}
