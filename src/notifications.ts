/**
 * Notification Manager — Action-required alerts for sub-agents
 *
 * Watches Orchestrator events and fires VS Code notifications when:
 * - A sub-agent needs user approval (WaitingForAction)
 * - A batch completes entirely
 * - A sub-agent fails
 *
 * Notifications include actionable buttons (View, Accept, Cancel).
 *
 * @module notifications
 */

import * as vscode from 'vscode';
import { Orchestrator } from './orchestrator';
import { ISubAgentEvent, SubAgentStatus, STATUS_ICONS, MODEL_LABELS } from './types';

export class NotificationManager implements vscode.Disposable {
    private readonly _disposables: vscode.Disposable[] = [];
    /** Track which agents we've already notified about (prevent spam) */
    private readonly _notified = new Set<string>();
    /** Track batch completion */
    private readonly _completedBatches = new Set<string>();

    constructor(private readonly _orchestrator: Orchestrator) {
        this._disposables.push(
            this._orchestrator.onEvent((e) => this._handleEvent(e)),
        );
    }

    private async _handleEvent(event: ISubAgentEvent): Promise<void> {
        switch (event.type) {
            case 'action_required':
                await this._notifyActionRequired(event);
                break;
            case 'completed':
                await this._notifyCompletion(event);
                this._checkBatchCompletion(event);
                break;
            case 'status_change':
                if (event.agent.status === SubAgentStatus.Failed) {
                    await this._notifyFailure(event);
                }
                break;
        }
    }

    /**
     * Notify when a sub-agent needs user action (step approval, terminal command, etc.)
     */
    private async _notifyActionRequired(event: ISubAgentEvent): Promise<void> {
        const key = `action-${event.agent.id}`;
        if (this._notified.has(key)) return;
        this._notified.add(key);

        const model = MODEL_LABELS[event.agent.model] || '?';
        const result = await vscode.window.showWarningMessage(
            `⚠️ Sub-Agent "${event.agent.label}" [${model}] needs your approval`,
            'View Chat',
            'Dismiss',
        );

        if (result === 'View Chat') {
            await this._orchestrator.viewChat(event.agent.id);
        }

        // Allow re-notification after 30s
        setTimeout(() => this._notified.delete(key), 30_000);
    }

    /**
     * Notify when a sub-agent completes.
     */
    private async _notifyCompletion(event: ISubAgentEvent): Promise<void> {
        const key = `done-${event.agent.id}`;
        if (this._notified.has(key)) return;
        this._notified.add(key);

        const model = MODEL_LABELS[event.agent.model] || '?';
        const result = await vscode.window.showInformationMessage(
            `✅ Sub-Agent "${event.agent.label}" [${model}] completed (${event.agent.stepCount} steps)`,
            'View Chat',
        );

        if (result === 'View Chat') {
            await this._orchestrator.viewChat(event.agent.id);
        }
    }

    /**
     * Notify when a sub-agent fails.
     */
    private async _notifyFailure(event: ISubAgentEvent): Promise<void> {
        const key = `fail-${event.agent.id}`;
        if (this._notified.has(key)) return;
        this._notified.add(key);

        const error = event.agent.error || 'Unknown error';
        const result = await vscode.window.showErrorMessage(
            `❌ Sub-Agent "${event.agent.label}" failed: ${error.substring(0, 100)}`,
            'View Chat',
            'Dismiss',
        );

        if (result === 'View Chat') {
            await this._orchestrator.viewChat(event.agent.id);
        }
    }

    /**
     * Check if an entire batch has completed and notify.
     */
    private async _checkBatchCompletion(event: ISubAgentEvent): Promise<void> {
        const batchId = event.agent.batchId;
        if (this._completedBatches.has(batchId)) return;

        const agents = this._orchestrator.getBatchAgents(batchId);
        const allDone = agents.every(a =>
            a.status === SubAgentStatus.Completed
            || a.status === SubAgentStatus.Failed
            || a.status === SubAgentStatus.Cancelled,
        );

        if (!allDone || agents.length === 0) return;

        this._completedBatches.add(batchId);

        const completed = agents.filter(a => a.status === SubAgentStatus.Completed).length;
        const failed = agents.filter(a => a.status === SubAgentStatus.Failed).length;
        const cancelled = agents.filter(a => a.status === SubAgentStatus.Cancelled).length;

        const batch = this._orchestrator.getBatch(batchId);
        const desc = batch?.description || 'Batch';

        await vscode.window.showInformationMessage(
            `🏁 ${desc} complete — ✅ ${completed} succeeded, ❌ ${failed} failed, 🚫 ${cancelled} cancelled`,
            'Open Sub-Agents',
        ).then(result => {
            if (result === 'Open Sub-Agents') {
                vscode.commands.executeCommand('subagents.active.focus');
            }
        });
    }

    dispose(): void {
        for (const d of this._disposables) d.dispose();
    }
}
