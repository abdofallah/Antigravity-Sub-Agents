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
                // Reset expanded when agent count changes (new agents added/removed)
                if (uiState.lastAgentCount !== undefined && uiState.lastAgentCount !== totalCount) {
                    uiState.expanded = false;
                }
                uiState.lastAgentCount = totalCount;
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
                        chev.textContent = uiState.collapsed ? 'chevron_right' : 'keyboard_arrow_down';
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
                if (itemsList && totalCount === 0) {
                    // Empty state message
                    var emptyMsg = el('div', 'flex items-center gap-2 text-xs px-2');
                    emptyMsg.style.cssText = 'opacity:0.6;';
                    emptyMsg.appendChild(el('span', '', 'No subagents.'));
                    itemsList.appendChild(emptyMsg);
                }

                if (itemsList && totalCount > 0) {
                    agents.forEach(function(a, idx) {
                        var row = el('div', 'flex flex-col px-2 py-1.5 rounded-lg overflow-hidden cursor-pointer group relative');
                        row.title = a.fullTask;
                        row.setAttribute('data-sa-row', '' + idx);
                        row.style.cssText = 'transition:background 0.12s;' + (idx >= LIMIT && !uiState.expanded ? 'display:none;' : '');
                        row.addEventListener('mouseenter', function() { row.style.background = 'rgba(255,255,255,0.04)'; });
                        row.addEventListener('mouseleave', function() { row.style.background = ''; });

                        // Top row: icon + label + status indicator
                        var topRow = el('div', 'flex items-center gap-1.5');
                        topRow.style.cssText = 'height:20px;';

                        var nameSpan = el('span', 'text-sm truncate flex-1 min-w-0');
                        nameSpan.textContent = a.label;
                        nameSpan.style.cssText = 'color:var(--secondary-foreground,rgba(255,255,255,0.7));transition:color 0.12s;';
                        topRow.appendChild(nameSpan);

                        // Right icon area
                        var iconArea = el('div', 'flex items-center shrink-0');

                        if (a.status === 'waiting_for_action') {
                            // Notification icon with ping dot
                            var iWrap = el('div', '');
                            iWrap.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;width:16px;height:16px;';
                            var ns = 'http://www.w3.org/2000/svg';
                            var iSvg = document.createElementNS(ns, 'svg');
                            iSvg.setAttribute('width', '16'); iSvg.setAttribute('height', '16');
                            iSvg.setAttribute('viewBox', '0 0 24 24'); iSvg.setAttribute('fill', 'none');
                            iSvg.style.cssText = 'flex-shrink:0;opacity:0.7;';
                            var ip = document.createElementNS(ns, 'path');
                            ip.setAttribute('fill-rule', 'evenodd'); ip.setAttribute('clip-rule', 'evenodd');
                            ip.setAttribute('d', 'M4.02975 19.9703C4.38308 20.3234 4.80908 20.5 5.30775 20.5H18.6923C19.1909 20.5 19.6169 20.3234 19.9703 19.9703C20.3234 19.6169 20.5 19.1909 20.5 18.6923V5.30775C20.5 4.80908 20.3234 4.38308 19.9703 4.02975C19.6169 3.67658 19.1909 3.5 18.6923 3.5H5.30775C4.80908 3.5 4.38308 3.67658 4.02975 4.02975C3.67658 4.38308 3.5 4.80908 3.5 5.30775V18.6923C3.5 19.1909 3.67658 19.6169 4.02975 19.9703ZM5.09625 5.09625C5.16025 5.03208 5.23075 5 5.30775 5H18.6923C18.7693 5 18.8398 5.03208 18.9038 5.09625C18.9679 5.16025 19 5.23075 19 5.30775V18.6923C19 18.7693 18.9679 18.8398 18.9038 18.9038C18.8398 18.9679 18.7693 19 18.6923 19H5.30775C5.23075 19 5.16025 18.9679 5.09625 18.9038C5.03208 18.8398 5 18.7693 5 18.6923V5.30775C5 5.23075 5.03208 5.16025 5.09625 5.09625Z');
                            ip.setAttribute('fill', '#939394'); iSvg.appendChild(ip);
                            var ip2 = document.createElementNS(ns, 'path');
                            ip2.setAttribute('d', 'M11.25 15.8122C11.0375 15.8122 10.8594 15.7403 10.7158 15.5965C10.5719 15.4526 10.5 15.2745 10.5 15.062C10.5 14.8493 10.5719 14.6712 10.7158 14.5277C10.8594 14.384 11.0375 14.3122 11.25 14.3122H15.25C15.4625 14.3122 15.6406 14.3841 15.7842 14.528C15.9281 14.6718 16 14.85 16 15.0625C16 15.2751 15.9281 15.4532 15.7842 15.5967C15.6406 15.7404 15.4625 15.8122 15.25 15.8122H11.25Z');
                            ip2.setAttribute('fill', '#939394'); iSvg.appendChild(ip2);
                            var ip3 = document.createElementNS(ns, 'path');
                            ip3.setAttribute('d', 'M7.223 8.49222L8.72689 9.99995L7.22795 11.4915C7.07928 11.6401 7.00495 11.8167 7.00495 12.0212C7.00495 12.2257 7.07928 12.4023 7.22795 12.551C7.37661 12.6996 7.5517 12.774 7.7532 12.774C7.95453 12.774 8.1307 12.6996 8.2817 12.551L10.2076 10.6327C10.3883 10.4519 10.4786 10.2409 10.4786 9.99995C10.4786 9.75895 10.3883 9.54803 10.2076 9.3672L8.27675 7.43272C8.12575 7.28405 7.94959 7.20972 7.74825 7.20972C7.54675 7.20972 7.37166 7.28405 7.223 7.43272C7.07433 7.58138 7 7.75797 7 7.96247C7 8.16697 7.07433 8.34355 7.223 8.49222Z');
                            ip3.setAttribute('fill', '#939394'); iSvg.appendChild(ip3);
                            iWrap.appendChild(iSvg);
                            // Ping dot
                            var pDot = el('div', '');
                            pDot.style.cssText = 'position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--primary,#4fc3f7);border:2px solid var(--sidebar,#1a1a1a);animation:' + P + '-pulse 1.5s ease-in-out infinite;';
                            iWrap.appendChild(pDot);
                            iconArea.appendChild(iWrap);
                        } else if (a.isActive) {
                            // Spinning loader for running agents
                            var ns2 = 'http://www.w3.org/2000/svg';
                            var sSvg = document.createElementNS(ns2, 'svg');
                            sSvg.setAttribute('width', '16'); sSvg.setAttribute('height', '16');
                            sSvg.setAttribute('viewBox', '0 -960 960 960'); sSvg.setAttribute('fill', 'currentColor');
                            sSvg.style.cssText = 'flex-shrink:0;opacity:0.7;animation:' + P + '-spin 0.8s linear infinite;';
                            var sP = document.createElementNS(ns2, 'path');
                            sP.setAttribute('d', 'M332.55-129.9q-69.29-29.9-121.02-81.63T129.9-332.55T100-480.35t29.96-147.5t81.58-120.61t121.04-81.58T480-860q12.75,0 21.37,8.63T510-829.99t-8.62,21.37T480-800q-133,0-226.5,93.5T160-480t93.5,226.5T480-160t226.5-93.5T800-480q0-12.77 8.63-21.38T830.01-510t21.37,8.62T860-480q0,77.99-29.96,147.42T748.46-211.54T627.85-129.96T480.35-100t-147.8-29.9Z');
                            sSvg.appendChild(sP);
                            iconArea.appendChild(sSvg);
                        } else {
                            // Completed checkmark
                            var ns3 = 'http://www.w3.org/2000/svg';
                            var cSvg = document.createElementNS(ns3, 'svg');
                            cSvg.setAttribute('width', '16'); cSvg.setAttribute('height', '16');
                            cSvg.setAttribute('viewBox', '0 -960 960 960'); cSvg.setAttribute('fill', 'currentColor');
                            cSvg.style.cssText = 'flex-shrink:0;opacity:0.5;';
                            var cP = document.createElementNS(ns3, 'path');
                            if (a.statusClass === 'completed') {
                                cP.setAttribute('d', 'M423.23-309.85L692.15-578.77L650-620.92L423.23-394.15l-114-114L267.08-466L423.23-309.85ZM480.07-100q-78.84,0-148.2-29.92T211.18-211.13T129.93-331.76T100-479.93t29.92-148.2t81.21-120.68t120.63-81.25T479.93-860t148.2,29.92t120.68,81.21t81.25,120.63T860-480.07t-29.92,148.2T748.87-211.18T628.24-129.93T480.07-100ZM480-160q134,0 227-93t93-227T707-707T480-800T253-707T160-480t93,227t227,93Zm0-320Z');
                            } else {
                                // Failed X icon
                                cP.setAttribute('d', 'M480-424L304.46-248.46L248.46-304.46L424-480L248.46-655.54L304.46-711.54L480-536L655.54-711.54L711.54-655.54L536-480L711.54-304.46L655.54-248.46L480-424ZM480.07-100q-78.84,0-148.2-29.92T211.18-211.13T129.93-331.76T100-479.93t29.92-148.2t81.21-120.68t120.63-81.25T479.93-860t148.2,29.92t120.68,81.21t81.25,120.63T860-480.07t-29.92,148.2T748.87-211.18T628.24-129.93T480.07-100ZM480-160q134,0 227-93t93-227T707-707T480-800T253-707T160-480t93,227t227,93Zm0-320Z');
                                cSvg.style.cssText = 'flex-shrink:0;opacity:0.5;color:#ef5350;';
                            }
                            cSvg.appendChild(cP);
                            iconArea.appendChild(cSvg);
                        }

                        topRow.appendChild(iconArea);
                        row.appendChild(topRow);

                        // Subtitle row
                        var subtitleEl = el('div', '');
                        if (a.status === 'waiting_for_action' && a.pendingAction) {
                            // Show pending action description + Approve/Deny buttons
                            var actionDesc = el('span', 'text-xs truncate block');
                            actionDesc.style.cssText = 'color:var(--muted-foreground,rgba(255,255,255,0.4));';
                            actionDesc.textContent = (a.pendingAction.actionType === 'command' ? 'Run ' : '') + a.pendingAction.target;
                            subtitleEl.appendChild(actionDesc);

                            var btnRow = el('div', 'flex gap-1');
                            btnRow.style.cssText = 'padding-top:3px;';

                            var approveBtn = el('button', 'text-xs cursor-pointer rounded');
                            approveBtn.textContent = 'Approve';
                            approveBtn.style.cssText = 'padding:1px 6px;background:var(--primary,#2563eb);color:var(--primary-foreground,#fff);border:none;border-radius:4px;font-size:0.75rem;cursor:pointer;transition:opacity 0.12s;';
                            approveBtn.addEventListener('mouseenter', function() { approveBtn.style.opacity = '0.85'; });
                            approveBtn.addEventListener('mouseleave', function() { approveBtn.style.opacity = '1'; });
                            approveBtn.addEventListener('click', function(e) { e.stopPropagation(); actionHandler('approve', a.id); });

                            var denyBtn = el('button', 'text-xs cursor-pointer rounded');
                            denyBtn.textContent = 'Deny';
                            denyBtn.style.cssText = 'padding:1px 6px;background:var(--secondary,rgba(255,255,255,0.08));color:var(--secondary-foreground,rgba(255,255,255,0.7));border:none;border-radius:4px;font-size:0.75rem;cursor:pointer;transition:opacity 0.12s;';
                            denyBtn.addEventListener('mouseenter', function() { denyBtn.style.opacity = '0.85'; });
                            denyBtn.addEventListener('mouseleave', function() { denyBtn.style.opacity = '1'; });
                            denyBtn.addEventListener('click', function(e) { e.stopPropagation(); actionHandler('reject', a.id); });

                            btnRow.appendChild(approveBtn);
                            btnRow.appendChild(denyBtn);
                            subtitleEl.appendChild(btnRow);
                        } else {
                            var subText = el('span', 'text-xs truncate block');
                            subText.style.cssText = 'color:var(--muted-foreground,rgba(255,255,255,0.4));';
                            if (a.isActive) {
                                subText.textContent = a.steps > 0 ? a.steps + ' steps...' : 'Working...';
                            } else {
                                subText.textContent = 'Worked for ' + a.elapsed;
                            }
                            subtitleEl.appendChild(subText);
                        }
                        row.appendChild(subtitleEl);

                        // Stop button overlay (visible on hover) for active agents
                        if (a.isActive) {
                            var sOverlay = el('div', '');
                            sOverlay.style.cssText = 'position:absolute;top:0;bottom:0;right:0;padding-left:12px;display:flex;align-items:flex-start;justify-content:flex-end;gap:1px;transform:translateX(6px);visibility:hidden;padding-top:2px;background:linear-gradient(to right, transparent 0%, var(--content,rgba(18,18,18,0.95)) 25%);';
                            var sBtn = el('button', '');
                            sBtn.style.cssText = 'width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:none;background:none;cursor:pointer;padding:0;margin-right:10px;';
                            var ns4 = 'http://www.w3.org/2000/svg';
                            var sSvg2 = document.createElementNS(ns4, 'svg');
                            sSvg2.setAttribute('width', '16'); sSvg2.setAttribute('height', '16');
                            sSvg2.setAttribute('viewBox', '0 -960 960 960'); sSvg2.setAttribute('fill', 'currentColor');
                            sSvg2.style.cssText = 'color:var(--secondary-foreground,rgba(255,255,255,0.55));transition:color 0.12s;';
                            var sPath = document.createElementNS(ns4, 'path');
                            sPath.setAttribute('d', 'M330-330H630V-630H330v300ZM480.07-100q-78.84,0-148.2-29.92T211.18-211.13T129.93-331.76T100-479.93t29.92-148.2t81.21-120.68t120.63-81.25T479.93-860t148.2,29.92t120.68,81.21t81.25,120.63T860-480.07t-29.92,148.2T748.87-211.18T628.24-129.93T480.07-100ZM480-160q134,0 227-93t93-227T707-707T480-800T253-707T160-480t93,227t227,93Zm0-320Z');
                            sSvg2.appendChild(sPath);
                            sBtn.appendChild(sSvg2);
                            sBtn.addEventListener('click', function(e) { e.stopPropagation(); cancelAction('agent', a.id); });
                            sBtn.addEventListener('mouseenter', function() { sSvg2.style.color = 'var(--foreground,#fff)'; });
                            sBtn.addEventListener('mouseleave', function() { sSvg2.style.color = 'var(--secondary-foreground,rgba(255,255,255,0.55))'; });
                            sOverlay.appendChild(sBtn);
                            row.appendChild(sOverlay);
                            row.addEventListener('mouseenter', function() { sOverlay.style.visibility = 'visible'; });
                            row.addEventListener('mouseleave', function() { sOverlay.style.visibility = 'hidden'; });
                        }

                        row.addEventListener('click', function(e) { e.stopPropagation(); var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); });
                        itemsList.appendChild(row);
                    });

                    // "See all" footer
                    if (hiddenCount > 0) {
                        var seeAll = el('button', 'text-xs opacity-60 hover:opacity-80 cursor-pointer select-none pl-2 pr-2 pt-1 text-left transition-opacity',
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
                if (wr && uiState.collapsed) { wr.style.display = 'none'; if (cv) cv.textContent = 'chevron_right'; }

                debug.agentIds = agents.map(function(a) { return a.id.substring(0, 8); }).join(',');

                return JSON.stringify({ ok: true, state: totalCount > 0 ? 'updated' : 'empty', count: totalCount, activeCount: activeCount, debug: debug });
            } catch (e) {
                return JSON.stringify({ ok: false, reason: e.message, stack: e.stack ? e.stack.substring(0, 300) : '' });
            }
        })()`;
}
