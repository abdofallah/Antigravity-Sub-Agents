/**
 * Chatbox UI Script Fragment
 *
 * Generates the JavaScript fragment that builds the active agents dropdown
 * above the chat input box and the notification badge on the parent chat.
 *
 * This is a FRAGMENT — it assumes shared variables from the main injection
 * script are already in scope (P, allAgents, agents, activeConvoId,
 * uiState, el, cancelAction, stopBtn, actionBtn, actionHandler, buildAgentRow,
 * waitingAgents, runningAgents, activeAgents, activeCount).
 *
 * @module cdp/scripts/build-chatbox-ui
 */

/**
 * Build the chatbox dropdown + notification badge script fragment.
 * Must be embedded inside the main injection IIFE.
 */
export function buildChatboxUI(): string {
    return `
                // --- Active agents dropdown above chat input ---
                var inputBox = document.getElementById('antigravity.agentSidePanelInputBox');
                var oldDrop = document.getElementById(P + '-running-dropdown');
                if (oldDrop) oldDrop.remove();

                var activeAgents = agents.filter(function(a) { return a.status === 'running' || a.status === 'waiting_for_action'; });
                var runningAgents = agents.filter(function(a) { return a.status === 'running'; });
                var waitingAgents = agents.filter(function(a) { return a.status === 'waiting_for_action'; });
                var activeCount = activeAgents.length;

                if (inputBox && activeCount > 0) {
                    var z30 = null;
                    var ii = inputBox.querySelector('.bg-input');
                    if (ii) z30 = ii.querySelector('.absolute.bottom-full');
                    if (z30) {
                        var dd = el('div', 'flex flex-col gap-1 p-3 rounded-xl mb-1');
                        dd.id = P + '-running-dropdown';
                        var borderColor = waitingAgents.length > 0 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)';
                        dd.style.cssText = 'background:var(--ag-input-background, rgba(30,30,30,0.95));border:1px solid ' + borderColor + ';max-height:300px;overflow-y:auto;';

                        // --- Global header with collapse + summary ---
                        var dh = el('div', 'flex items-center justify-between pb-1');
                        var headerParts = [];
                        if (runningAgents.length > 0) headerParts.push(runningAgents.length + ' running');
                        if (waitingAgents.length > 0) headerParts.push(waitingAgents.length + ' needs action');
                        var headerLeft = el('div', 'flex items-center gap-2');
                        headerLeft.appendChild(el('span', 'text-xs opacity-70', headerParts.join(', ')));

                        var headerRight = el('div', 'flex items-center gap-2');
                        // Stop all button
                        headerRight.appendChild(stopBtn('Stop All', 'all', null, true));
                        // Collapse toggle
                        var dc = el('span', 'google-symbols opacity-50 hover:opacity-80 cursor-pointer', uiState.dropdownCollapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up');
                        dc.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:14px;user-select:none;';
                        dc.addEventListener('click', function(e) { e.stopPropagation(); uiState.dropdownCollapsed = !uiState.dropdownCollapsed; });
                        headerRight.appendChild(dc);

                        dh.appendChild(headerLeft);
                        dh.appendChild(headerRight);
                        dd.appendChild(dh);

                        if (!uiState.dropdownCollapsed) {
                            // Group agents by batchId
                            var batches = {};
                            var batchOrder = [];
                            activeAgents.forEach(function(a) {
                                if (!batches[a.batchId]) { batches[a.batchId] = []; batchOrder.push(a.batchId); }
                                batches[a.batchId].push(a);
                            });

                            batchOrder.forEach(function(bid) {
                                var bAgents = batches[bid];
                                var isBatch = bAgents.length > 1;

                                if (isBatch) {
                                    // --- Batch group header ---
                                    if (!uiState.batchCollapsed) uiState.batchCollapsed = {};
                                    var bCollapsed = uiState.batchCollapsed[bid] || false;

                                    var bHeader = el('div', 'flex items-center justify-between py-1 cursor-pointer');
                                    bHeader.style.cssText = 'border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:6px;';

                                    var bLeft = el('div', 'flex items-center gap-2');
                                    var bIcon = el('span', 'google-symbols');
                                    bIcon.textContent = bCollapsed ? 'expand_more' : 'expand_less';
                                    bIcon.style.cssText = 'font-size:14px;opacity:0.5;';
                                    bLeft.appendChild(bIcon);

                                    // Batch summary when collapsed
                                    var bRunning = bAgents.filter(function(a) { return a.status === 'running'; }).length;
                                    var bWaiting = bAgents.filter(function(a) { return a.status === 'waiting_for_action'; }).length;
                                    var bParts = [];
                                    if (bRunning) bParts.push(bRunning + ' running');
                                    if (bWaiting) bParts.push(bWaiting + ' action');
                                    bLeft.appendChild(el('span', 'text-xs opacity-60', 'Batch (' + bAgents.length + ' agents' + (bParts.length ? ': ' + bParts.join(', ') : '') + ')'));

                                    var bRight = el('div', 'flex items-center gap-1');
                                    bRight.appendChild(stopBtn('Stop Batch', 'batch', bid, true));

                                    bHeader.appendChild(bLeft);
                                    bHeader.appendChild(bRight);
                                    bHeader.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        if (!uiState.batchCollapsed) uiState.batchCollapsed = {};
                                        uiState.batchCollapsed[bid] = !uiState.batchCollapsed[bid];
                                    });
                                    dd.appendChild(bHeader);

                                    if (!bCollapsed) {
                                        bAgents.forEach(function(a) {
                                            dd.appendChild(buildAgentRow(a, true));
                                        });
                                    }
                                } else {
                                    // Solo agent
                                    dd.appendChild(buildAgentRow(bAgents[0], false));
                                }
                            });
                        }
                        z30.appendChild(dd);
                    }
                }

                // --- Notification badge on parent chat in left sidebar ---
                var oldBadges = document.querySelectorAll('.' + P + '-chat-notify');
                oldBadges.forEach(function(b) { b.remove(); });
                if (waitingAgents.length > 0 && activeConvoId) {
                    var pill = document.querySelector('span[data-testid="convo-pill-' + activeConvoId + '"]');
                    if (pill) {
                        var badge = el('span', P + '-chat-notify google-symbols');
                        badge.textContent = 'notifications';
                        badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:#fbbf24;margin-right:4px;animation:' + P + '-pulse 1.5s ease-in-out infinite;flex-shrink:0;';
                        pill.parentNode.insertBefore(badge, pill);
                    }
                }
`;
}
