/**
 * Status Bar Widget — Live sub-agent counter in the bottom bar
 *
 * Shows: "🤖 3/5 running · ⚠️ 1 action"
 * Updates in REALTIME on every Orchestrator event.
 * Clicks to focus the Sub-Agents sidebar.
 *
 * @module status-bar
 */

import * as vscode from 'vscode';
import { Orchestrator } from './orchestrator';
import { SubAgentStatus } from './types';

export class StatusBarWidget implements vscode.Disposable {
    private readonly _item: vscode.StatusBarItem;
    private readonly _disposables: vscode.Disposable[] = [];

    constructor(private readonly _orchestrator: Orchestrator) {
        this._item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100, // Priority — show near other important indicators
        );
        this._item.command = 'subagents.active.focus';

        // REALTIME: update on every event
        this._disposables.push(
            this._orchestrator.onEvent(() => this._update()),
        );

        this._update();
    }

    private _update(): void {
        const all = this._orchestrator.getAll();
        const running = all.filter(a => a.status === SubAgentStatus.Running).length;
        const pending = all.filter(a => a.status === SubAgentStatus.Pending).length;
        const waiting = all.filter(a => a.status === SubAgentStatus.WaitingForAction).length;
        const active = running + pending + waiting;

        if (active === 0) {
            this._item.hide();
            return;
        }

        const parts: string[] = [`$(hubot) ${running} running`];

        if (pending > 0) {
            parts.push(`${pending} queued`);
        }
        if (waiting > 0) {
            parts.push(`$(bell-dot) ${waiting} action`);
        }

        this._item.text = parts.join(' · ');
        this._item.tooltip = new vscode.MarkdownString(
            `**Sub-Agents**\n\n`
            + `- 🟢 Running: ${running}\n`
            + `- ⏳ Pending: ${pending}\n`
            + `- ⚠️ Needs Action: ${waiting}\n\n`
            + `Click to open Sub-Agents panel`,
        );

        // Change color when action is needed
        this._item.backgroundColor = waiting > 0
            ? new vscode.ThemeColor('statusBarItem.warningBackground')
            : undefined;

        this._item.show();
    }

    dispose(): void {
        this._item.dispose();
        for (const d of this._disposables) d.dispose();
    }
}
