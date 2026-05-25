/**
 * Launch Flow — Full Multi-Agent QuickPick UI
 *
 * @module commands/launch-flow
 */

import * as vscode from 'vscode';
import { Models } from 'antigravity-sdk';
import { Orchestrator } from '../orchestrator';
import { AVAILABLE_MODELS, MODEL_NAMES } from '../types';
import { getConfig, MODEL_SETTING_MAP } from '../config/settings';

export async function launchFlow(orchestrator: Orchestrator): Promise<void> {
    // Step 1: How many sub-agents?
    const countStr = await vscode.window.showInputBox({
        title: 'Sub-Agents: How Many?',
        prompt: 'Number of sub-agents to launch',
        value: '3',
        validateInput: (v) => {
            const n = parseInt(v, 10);
            if (isNaN(n) || n < 1 || n > 20) return 'Enter a number between 1 and 20';
            return null;
        },
    });
    if (!countStr) return;
    const count = parseInt(countStr, 10);

    // Step 2: Pick model (default pre-selected)
    const defaultModel = getConfig().get<string>('defaultModel', 'flash');
    const modelPick = await vscode.window.showQuickPick(
        AVAILABLE_MODELS.map(m => ({
            label: m.label,
            description: m.description,
            id: m.id,
            picked: (MODEL_SETTING_MAP[defaultModel] ?? Models.GEMINI_FLASH) === m.id,
        })),
        {
            title: 'Sub-Agents: Choose Model',
            placeHolder: 'Select the model for all sub-agents',
        },
    );
    if (!modelPick) return;
    const model = (modelPick as any).id;

    // Step 3: Batch description
    const description = await vscode.window.showInputBox({
        title: 'Sub-Agents: Batch Description',
        prompt: 'Brief description of what these sub-agents will do',
        placeHolder: 'e.g., "Refactor auth module" or "Write unit tests"',
    });
    if (description === undefined) return; // cancelled

    // Step 4: Task prompts — one per sub-agent
    const tasks: string[] = [];
    for (let i = 0; i < count; i++) {
        const task = await vscode.window.showInputBox({
            title: `Sub-Agent ${i + 1}/${count}: Task`,
            prompt: `What should sub-agent ${i + 1} do?`,
            placeHolder: 'Enter the task prompt...',
        });
        if (task === undefined) return; // cancelled
        if (task.trim() === '') {
            vscode.window.showWarningMessage(`Skipped empty task for sub-agent ${i + 1}`);
            continue;
        }
        tasks.push(task);
    }

    if (tasks.length === 0) {
        vscode.window.showWarningMessage('No tasks provided — launch cancelled.');
        return;
    }

    // Step 5: Launch!
    const modelName = MODEL_NAMES[model] || 'Unknown';
    vscode.window.showInformationMessage(
        `🚀 Launching ${tasks.length} sub-agents with ${modelName}...`,
    );

    try {
        const ids = await orchestrator.launch({
            tasks,
            model,
            description: description || `${tasks.length} sub-agents`,
        });

        vscode.window.showInformationMessage(
            `✅ ${ids.ids.length} sub-agents launched successfully!`,
            'Open Panel',
        ).then(choice => {
            if (choice === 'Open Panel') {
                vscode.commands.executeCommand('subagents.active.focus');
            }
        });
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to launch sub-agents: ${err.message}`);
    }
}
