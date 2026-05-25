/**
 * Panel Injection Script Builder
 *
 * Builds the main JavaScript IIFE that is evaluated via CDP Runtime.evaluate
 * to inject the sub-agent status panel into the Antigravity Manager sidebar.
 *
 * The script handles:
 * - Conversation detection via TanStack Router
 * - Hash-based change detection to skip unnecessary DOM updates
 * - Agent filtering and sorting by parent conversation
 * - Shared UI helpers (el, cancelAction, stopBtn, actionBtn, buildAgentRow)
 * - Delegates to chatbox UI, lock watcher, and panel shell fragments
 *
 * @module cdp/scripts/build-panel-script
 */

import { buildChatboxUI } from './build-chatbox-ui';
import { buildLockWatcher } from './build-lock-watcher';

/** Data shape for agent UI rendering */
export interface AgentUIData {
    id: string;
    parentId: string;
    batchId: string;
    label: string;
    task: string;
    fullTask: string;
    status: string;
    statusClass: string;
    icon: string;
    model: string;
    elapsed: string;
    steps: number;
    isActive: boolean;
    completedAt: number;
    createdAt: number;
    pendingAction: { actionType: string; target: string } | null;
}

/** Input data for the panel injection script */
export interface PanelInjectionData {
    prefix: string;
    agents: AgentUIData[];
    visibleLimit: number;
    dataHash: string;
    subAgentIds: string[];
    pendingActions: Record<string, { actionType: string; target: string }>;
}

/**
 * Build the main panel injection script.
 * Returns a complete self-executing JavaScript IIFE string.
 */
export function buildPanelScript(data: PanelInjectionData): string {
    const { prefix, agents, visibleLimit, dataHash, subAgentIds, pendingActions } = data;
    const dataJson = JSON.stringify(agents);

    // The chatbox UI fragment and lock watcher fragment
    const chatboxFragment = buildChatboxUI();
    const lockWatcherFragment = buildLockWatcher();

    return `(() => {
            try {
                var P = '${prefix}';
                var allAgents = ${dataJson};
                var LIMIT = ${visibleLimit};
                var dataHash = '${dataHash}';
                var subAgentIds = ${JSON.stringify(subAgentIds)};
                var pendingActions = ${JSON.stringify(pendingActions)};
                var debug = {};

                if (!window.__saState) window.__saState = {};
                var uiState = window.__saState;

                function el(tag, cls, text) {
                    var e = document.createElement(tag);
                    if (cls) e.className = cls;
                    if (text) e.textContent = text;
                    return e;
                }

                // Detect active conversation via TanStack Router
                var activeConvoId = null;
                try {
                    var router = window.__TSR_ROUTER__;
                    if (router && router.state && router.state.matches) {
                        var matches = router.state.matches;
                        for (var i = 0; i < matches.length; i++) {
                            if (matches[i].params && matches[i].params.cascadeId) {
                                activeConvoId = matches[i].params.cascadeId;
                                break;
                            }
                        }
                    }
                } catch(e) {}
                if (!activeConvoId) {
                    var pill = document.querySelector('[role="button"][class*="bg-list-hover"] span[data-testid^="convo-pill-"]');
                    if (pill) activeConvoId = (pill.getAttribute('data-testid') || '').replace('convo-pill-', '');
                }
                debug.activeConvoId = activeConvoId ? activeConvoId.substring(0, 8) : 'none';

                // Hash check - skip if nothing changed
                var fullHash = dataHash + '|' + (activeConvoId || 'none');
                if (uiState._dataHash === fullHash && document.getElementById(P + '-section')) {
                    return JSON.stringify({ ok: true, state: 'unchanged' });
                }
                uiState._dataHash = fullHash;

                // Filter & sort agents for active conversation
                var agents = activeConvoId ? allAgents.filter(function(a) { return a.parentId === activeConvoId; }) : [];
                agents.sort(function(a, b) {
                    if (a.isActive && !b.isActive) return -1;
                    if (!a.isActive && b.isActive) return 1;
                    return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
                });

                var activeCount = agents.filter(function(a) { return a.isActive; }).length;
                var totalCount = agents.length;
                var hiddenCount = Math.max(0, totalCount - LIMIT);

                // Reset UI state on conversation change
                if (uiState.lastConvoId && uiState.lastConvoId !== activeConvoId) {
                    uiState.collapsed = false;
                    uiState.expanded = false;
                    uiState.dropdownCollapsed = false;
                }
                if (uiState.dropdownCollapsed === undefined) uiState.dropdownCollapsed = false;
                uiState.lastConvoId = activeConvoId;

                debug.filteredCount = totalCount;
                debug.totalAgentsInStore = allAgents.length;

                // Cleanup legacy injection
                var oldRoot = document.getElementById('sa-inject-root');
                if (oldRoot) oldRoot.remove();

                // Cancel helper — calls CDP binding
                function cancelAction(type, id) {
                    try { window.__saCancelAction(JSON.stringify({ type: type, id: id || '' })); } catch(e) { console.warn('Cancel failed', e); }
                }

                // Build stop button helper
                function stopBtn(text, type, id, small) {
                    var b = el('span', '');
                    b.textContent = text || 'Stop';
                    b.style.cssText = 'cursor:pointer;color:#ef4444;font-size:' + (small ? '11' : '12') + 'px;padding:1px 6px;border:1px solid rgba(239,68,68,0.3);border-radius:4px;opacity:0.7;transition:opacity 0.15s;flex-shrink:0;';
                    b.addEventListener('mouseenter', function() { b.style.opacity = '1'; });
                    b.addEventListener('mouseleave', function() { b.style.opacity = '0.7'; });
                    b.addEventListener('click', function(e) { e.stopPropagation(); cancelAction(type, id); });
                    return b;
                }

                // Action handler — calls CDP binding for approve/respond/reject
                function actionHandler(type, id, message) {
                    try { window.__saActionHandler(JSON.stringify({ type: type, id: id, message: message || '' })); } catch(e) { console.warn('Action failed', e); }
                }

                // Build action button helper (approve/deny style)
                function actionBtn(text, type, id, color, bgColor) {
                    var b = el('span', '');
                    b.textContent = text;
                    b.style.cssText = 'cursor:pointer;color:' + color + ';background:' + bgColor + ';font-size:11px;font-weight:500;padding:2px 10px;border-radius:4px;transition:opacity 0.15s,filter 0.15s;flex-shrink:0;user-select:none;';
                    b.addEventListener('mouseenter', function() { b.style.filter = 'brightness(1.2)'; });
                    b.addEventListener('mouseleave', function() { b.style.filter = ''; });
                    b.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (type === 'respond') {
                            var msg = prompt('Tell the agent what to do instead:');
                            if (msg !== null) actionHandler('respond', id, msg);
                        } else {
                            actionHandler(type, id);
                        }
                    });
                    return b;
                }

                // Build an agent row (shared between solo and batch agents)
                function buildAgentRow(a, inBatch) {
                    if (a.status === 'waiting_for_action') {
                        // ── Waiting agent: show label + task desc + Approve/Deny buttons ──
                        var wrapper = el('div', '');
                        wrapper.style.cssText = 'padding:4px 6px;border-radius:6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15);margin:2px 0;' + (inBatch ? 'margin-left:16px;' : '');

                        // Top row: icon + label + view link
                        var topRow = el('div', 'flex items-center gap-2');
                        topRow.style.cssText = 'margin-bottom:4px;cursor:pointer;';
                        var bell = el('span', 'google-symbols');
                        bell.textContent = 'notifications';
                        bell.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:13px;color:#fbbf24;animation:' + P + '-pulse 1.5s ease-in-out infinite;';
                        topRow.appendChild(bell);

                        var nameSpan = el('span', 'text-sm truncate flex-1');
                        nameSpan.textContent = a.label;
                        nameSpan.style.cssText = 'color:#fbbf24;font-weight:500;';
                        topRow.appendChild(nameSpan);

                        // View icon (open in chat)
                        var viewIcon = el('span', 'google-symbols');
                        viewIcon.textContent = 'open_in_new';
                        viewIcon.style.cssText = 'display:flex;align-items:center;font-size:12px;opacity:0.5;cursor:pointer;';
                        viewIcon.addEventListener('click', function(e) { e.stopPropagation(); var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); });
                        topRow.appendChild(viewIcon);

                        topRow.addEventListener('click', function(e) { if (e.target === viewIcon) return; var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); });
                        wrapper.appendChild(topRow);

                        // Task description (from pending action or task)
                        if (a.pendingAction) {
                            var desc = el('div', 'text-xs truncate');
                            desc.style.cssText = 'opacity:0.6;margin-bottom:6px;padding-left:21px;font-family:monospace;';
                            desc.textContent = (a.pendingAction.actionType === 'command' ? 'Run ' : '') + a.pendingAction.target;
                            wrapper.appendChild(desc);
                        }

                        // Action buttons row: Approve + Deny
                        var btnRow = el('div', 'flex items-center gap-2');
                        btnRow.style.cssText = 'padding-left:21px;';
                        btnRow.appendChild(actionBtn('Approve', 'approve', a.id, '#fff', '#2563eb'));
                        btnRow.appendChild(actionBtn('Deny', 'reject', a.id, '#fff', 'rgba(239,68,68,0.8)'));
                        wrapper.appendChild(btnRow);

                        return wrapper;
                    }

                    // ── Running agent: standard row ──
                    var r = el('div', 'flex items-center gap-2 py-0.5 group');
                    r.style.cssText = 'cursor:pointer;opacity:0.8;transition:opacity 0.15s;' + (inBatch ? 'padding-left:20px;' : '');
                    r.addEventListener('mouseenter', function() { r.style.opacity = '1'; r.querySelector('.' + P + '-row-stop').style.display = 'inline'; });
                    r.addEventListener('mouseleave', function() { r.style.opacity = '0.8'; r.querySelector('.' + P + '-row-stop').style.display = 'none'; });

                    r.appendChild(el('span', P + '-spinner'));
                    r.appendChild(el('span', 'text-sm truncate flex-1', a.label));

                    // Per-agent stop button (visible on hover)
                    var agentStop = stopBtn('', 'agent', a.id, true);
                    agentStop.className = P + '-row-stop google-symbols';
                    agentStop.textContent = 'stop_circle';
                    agentStop.style.cssText += 'display:none;border:none;padding:0;font-size:14px;';
                    r.appendChild(agentStop);

                    r.addEventListener('click', function(e) { if (e.target !== agentStop) { e.stopPropagation(); var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); } });
                    return r;
                }

                // ═══════════════════════════════════════════
                // Chatbox UI (dropdown + notification badge)
                // ═══════════════════════════════════════════
${chatboxFragment}

                // ═══════════════════════════════════════════
                // Lock Watcher (sub-agent chat restrictions)
                // ═══════════════════════════════════════════
${lockWatcherFragment}

                // ========================================
                // Phase 1: Ensure section shell exists
                // ========================================
                var section = document.getElementById(P + '-section');
                var itemsList = section ? document.getElementById(P + '-items') : null;
                var badge = section ? document.getElementById(P + '-badge') : null;
                var runBadge = section ? document.getElementById(P + '-run-badge') : null;

                if (!section) {
                    // Find scroll area in right sidebar
                    var allPanels = document.querySelectorAll('[class*="bg-agent-convo-background"]');
                    var rp = null;
                    for (var i = 0; i < allPanels.length; i++) {
                        var c = allPanels[i].className || '';
                        if (c.includes('items-stretch') && !c.includes('sticky')) { rp = allPanels[i]; break; }
                    }
                    if (!rp) {
                        for (var i = 0; i < allPanels.length; i++) {
                            if (allPanels[i].querySelector('[class*="overflow-y-auto"]')) { rp = allPanels[i]; break; }
                        }
                    }
                    var scrollArea = rp ? rp.querySelector('[class*="overflow-y-auto"]') : null;
                    if (!scrollArea) {
                        return JSON.stringify({ ok: true, state: 'no-scroll-area', debug: debug });
                    }

                    // Build shell
                    section = el('div', 'w-full flex flex-col gap-2');
                    section.id = P + '-section';

                    var hdr = el('div', 'flex items-center justify-between gap-1.5 cursor-pointer select-none pl-4 pr-3 group');
                    var hl = el('div', 'flex items-center gap-1.5');
                    hl.appendChild(el('span', 'text-xs opacity-80 group-hover:opacity-100 transition-opacity', 'Sub-Agents'));

                    badge = el('span', 'text-[10px] opacity-80 bg-white/10 rounded-full px-1.5 py-0.5 leading-none', '0');
                    badge.id = P + '-badge';
                    hl.appendChild(badge);

                    runBadge = el('span', 'text-[10px] rounded-full px-1.5 py-0.5 leading-none');
                    runBadge.id = P + '-run-badge';
                    runBadge.style.cssText = 'background:rgba(79,195,247,0.15);color:#4fc3f7;display:none;';
                    hl.appendChild(runBadge);
                    hdr.appendChild(hl);

                    var chev = el('span', 'google-symbols opacity-80 group-hover:opacity-100 transition-opacity', 'keyboard_arrow_down');
                    chev.id = P + '-chevron';
                    chev.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:16px;user-select:none;';
                    hdr.appendChild(chev);

                    var iw = el('div', 'px-2');
                    iw.id = P + '-items-wrapper';
                    itemsList = el('div', 'flex flex-col gap-px');
                    itemsList.id = P + '-items';
                    iw.appendChild(itemsList);

                    hdr.addEventListener('click', function() {
                        uiState.collapsed = !uiState.collapsed;
                        iw.style.display = uiState.collapsed ? 'none' : '';
                        chev.textContent = uiState.collapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_down';
                    });

                    section.appendChild(hdr);
                    section.appendChild(iw);

                    if (scrollArea.firstChild) scrollArea.insertBefore(section, scrollArea.firstChild);
                    else scrollArea.appendChild(section);

                    debug.createdShell = true;
                }

                // ========================================
                // Phase 2: Update children in place
                // ========================================

                // Update badge counts
                if (badge) badge.textContent = '' + totalCount;
                if (runBadge) {
                    if (activeCount > 0) { runBadge.textContent = activeCount + ' running'; runBadge.style.display = ''; }
                    else { runBadge.style.display = 'none'; }
                }

                // Clear existing rows
                if (itemsList) while (itemsList.firstChild) itemsList.removeChild(itemsList.firstChild);

                // Populate with current agents
                if (itemsList && totalCount > 0) {
                    agents.forEach(function(a, idx) {
                        var row = el('div', 'flex w-full items-center gap-2 px-2 py-1 rounded-md opacity-90 hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer');
                        row.title = a.fullTask;
                        if (idx >= LIMIT && !uiState.expanded) row.style.display = 'none';
                        row.setAttribute('data-sa-row', '' + idx);

                        if (a.isActive) row.appendChild(el('span', P + '-spinner'));
                        else row.appendChild(el('span', P + '-dot ' + P + '-dot-' + a.statusClass));

                        var info = el('div', 'flex flex-col min-w-0 flex-1');
                        info.appendChild(el('div', 'text-sm truncate', a.label));
                        info.appendChild(el('div', 'text-xs opacity-50 truncate', a.task));
                        row.appendChild(info);

                        var ri = el('div', 'flex flex-col items-end gap-0.5 shrink-0');
                        ri.appendChild(el('span', 'text-[10px] opacity-60 bg-white/5 rounded px-1 py-0.5', a.model));
                        ri.appendChild(el('span', 'text-[10px] opacity-40', a.isActive && a.steps > 0 ? a.steps + ' steps' : a.elapsed));
                        row.appendChild(ri);

                        row.addEventListener('click', function(e) { e.stopPropagation(); var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); });
                        itemsList.appendChild(row);
                    });

                    // "See all" footer
                    if (hiddenCount > 0) {
                        var seeAll = el('button', 'text-xs opacity-60 hover:opacity-80 cursor-pointer select-none pl-4 pr-3 text-left transition-opacity',
                            uiState.expanded ? 'Show less' : 'See all (' + totalCount + ')');
                        seeAll.addEventListener('click', function(e) {
                            e.stopPropagation();
                            uiState.expanded = !uiState.expanded;
                            var rows = itemsList.querySelectorAll('[data-sa-row]');
                            if (uiState.expanded) { rows.forEach(function(r) { r.style.display = ''; }); seeAll.textContent = 'Show less'; }
                            else { rows.forEach(function(r) { if (parseInt(r.getAttribute('data-sa-row')) >= LIMIT) r.style.display = 'none'; }); seeAll.textContent = 'See all (' + totalCount + ')'; }
                        });
                        itemsList.appendChild(seeAll);
                    }
                }

                // Restore collapse state for items wrapper
                var wr = document.getElementById(P + '-items-wrapper');
                var cv = document.getElementById(P + '-chevron');
                if (wr && uiState.collapsed) { wr.style.display = 'none'; if (cv) cv.textContent = 'keyboard_arrow_right'; }

                debug.agentIds = agents.map(function(a) { return a.id.substring(0, 8); }).join(',');

                return JSON.stringify({ ok: true, state: totalCount > 0 ? 'updated' : 'empty', count: totalCount, activeCount: activeCount, debug: debug });
            } catch (e) {
                return JSON.stringify({ ok: false, reason: e.message, stack: e.stack ? e.stack.substring(0, 300) : '' });
            }
        })()`;
}
