/**
 * Quick Launch Flow — Single Sub-Agent Launch UI
 *
 * @module commands/quick-launch
 */

import * as vscode from 'vscode';
import { Models } from 'antigravity-sdk';
import { Orchestrator } from '../orchestrator';
import { AVAILABLE_MODELS } from '../types';
import { getConfig, MODEL_SETTING_MAP } from '../config/settings';

export async function quickLaunchFlow(orchestrator: Orchestrator): Promise<void> {
    // Step 1: Task
    const task = await vscode.window.showInputBox({
        title: 'Quick Launch: Task',
        prompt: 'What should this sub-agent do?',
        placeHolder: 'Enter the task prompt...',
    });
    if (!task) return;

    // Step 2: Model (quick pick with default pre-selected)
    const defaultModel = getConfig().get<string>('defaultModel', 'flash');
    const modelPick = await vscode.window.showQuickPick(
        AVAILABLE_MODELS.map(m => ({
            label: m.label,
            description: m.description,
            id: m.id,
            picked: (MODEL_SETTING_MAP[defaultModel] ?? Models.GEMINI_FLASH) === m.id,
        })),
        {
            title: 'Quick Launch: Model',
            placeHolder: 'Select model',
        },
    );
    if (!modelPick) return;

    // Launch
    try {
        const id = await orchestrator.quickLaunch({
            task,
            model: (modelPick as any).id,
        });

        if (id) {
            vscode.window.showInformationMessage(
                `🚀 Sub-agent launched!`,
                'View Chat',
            ).then(choice => {
                if (choice === 'View Chat') {
                    orchestrator.viewChat(id);
                }
            });
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to launch: ${err.message}`);
    }
}
