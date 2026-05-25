/**
 * Chatbox UI Script Fragment
 *
 * Generates the JavaScript fragment that builds the active agents section
 * INSIDE the chat input box (#antigravity.agentSidePanelInputBox), injected
 * before the inner card element so it appears as a connected top section of
 * the same rounded container — matching the native Antigravity design language.
 *
 * This is a FRAGMENT — it assumes shared variables from the main injection
 * script are already in scope (P, allAgents, agents, activeConvoId,
 * uiState, el, cancelAction, stopBtn, actionBtn, buildAgentRow,
 * waitingAgents, runningAgents, activeAgents, activeCount).
 *
 * @module cdp/scripts/build-chatbox-ui
 */

/**
 * Build the chatbox connected-section + notification badge script fragment.
 * Must be embedded inside the main injection IIFE.
 */
export function buildChatboxUI(): string {
    return `
                // --- Active agents: connected section inside chat input box ---
                var inputBox = document.getElementById('antigravity.agentSidePanelInputBox');
                var oldDrop = document.getElementById(P + '-running-dropdown');
                if (oldDrop) oldDrop.remove();

                var activeAgents = agents.filter(function(a) { return a.status === 'running' || a.status === 'waiting_for_action'; });
                var runningAgents = agents.filter(function(a) { return a.status === 'running'; });
                var waitingAgents = agents.filter(function(a) { return a.status === 'waiting_for_action'; });
                var activeCount = activeAgents.length;

                if (inputBox && activeCount > 0) {
                    var _ns = 'http://www.w3.org/2000/svg';

                    // Build a row specifically styled for the chatbox connected section
                    function buildChatboxRow(a) {
                        var row = el('div', 'flex items-center gap-1.5 h-6 group relative overflow-hidden cursor-pointer shrink-0');
                        row.style.cssText = 'color:var(--secondary-foreground,rgba(255,255,255,0.55));transition:color 0.12s;';

                        var innerBtn = el('button', 'flex items-center gap-1.5 flex-1 min-w-0 text-left');
                        innerBtn.style.cssText = 'background:none;border:none;padding:0;cursor:pointer;color:inherit;min-width:0;overflow:hidden;';

                        if (a.status === 'waiting_for_action') {
                            // ── Icon wrapper with pinging notification dot ──
                            var iconWrap = el('div', 'relative flex items-center justify-center');
                            iconWrap.style.cssText = 'width:16px;height:16px;flex-shrink:0;';

                            // Terminal/prompt SVG icon
                            var icoSvg = document.createElementNS(_ns, 'svg');
                            icoSvg.setAttribute('width', '16'); icoSvg.setAttribute('height', '16');
                            icoSvg.setAttribute('viewBox', '0 0 24 24'); icoSvg.setAttribute('fill', 'none');
                            icoSvg.setAttribute('xmlns', _ns);
                            icoSvg.style.cssText = 'flex-shrink:0;opacity:0.7;';

                            var maskId = P + '-m-' + a.id.substring(0, 4);
                            var defs = document.createElementNS(_ns, 'defs');
                            var mask = document.createElementNS(_ns, 'mask');
                            mask.setAttribute('id', maskId); mask.setAttribute('maskUnits', 'userSpaceOnUse');
                            mask.setAttribute('x', '0'); mask.setAttribute('y', '0');
                            mask.setAttribute('width', '24'); mask.setAttribute('height', '24');
                            mask.style.cssText = 'mask-type:alpha;';
                            var mRect = document.createElementNS(_ns, 'rect');
                            mRect.setAttribute('width', '24'); mRect.setAttribute('height', '24'); mRect.setAttribute('fill', '#D9D9D9');
                            mask.appendChild(mRect); defs.appendChild(mask); icoSvg.appendChild(defs);

                            var g = document.createElementNS(_ns, 'g');
                            g.setAttribute('mask', 'url(#' + maskId + ')');

                            var ip1 = document.createElementNS(_ns, 'path');
                            ip1.setAttribute('fill-rule', 'evenodd'); ip1.setAttribute('clip-rule', 'evenodd');
                            ip1.setAttribute('d', 'M4.02975 19.9703C4.38308 20.3234 4.80908 20.5 5.30775 20.5H18.6923C19.1909 20.5 19.6169 20.3234 19.9703 19.9703C20.3234 19.6169 20.5 19.1909 20.5 18.6923V5.30775C20.5 4.80908 20.3234 4.38308 19.9703 4.02975C19.6169 3.67658 19.1909 3.5 18.6923 3.5H5.30775C4.80908 3.5 4.38308 3.67658 4.02975 4.02975C3.67658 4.38308 3.5 4.80908 3.5 5.30775V18.6923C3.5 19.1909 3.67658 19.6169 4.02975 19.9703ZM5.09625 5.09625C5.16025 5.03208 5.23075 5 5.30775 5H18.6923C18.7693 5 18.8398 5.03208 18.9038 5.09625C18.9679 5.16025 19 5.23075 19 5.30775V18.6923C19 18.7693 18.9679 18.8398 18.9038 18.9038C18.8398 18.9679 18.7693 19 18.6923 19H5.30775C5.23075 19 5.16025 18.9679 5.09625 18.9038C5.03208 18.8398 5 18.7693 5 18.6923V5.30775C5 5.23075 5.03208 5.16025 5.09625 5.09625Z');
                            ip1.setAttribute('fill', '#939394'); g.appendChild(ip1);

                            var ip2 = document.createElementNS(_ns, 'path');
                            ip2.setAttribute('d', 'M11.25 15.8122C11.0375 15.8122 10.8594 15.7403 10.7158 15.5965C10.5719 15.4526 10.5 15.2745 10.5 15.062C10.5 14.8493 10.5719 14.6712 10.7158 14.5277C10.8594 14.384 11.0375 14.3122 11.25 14.3122H15.25C15.4625 14.3122 15.6406 14.3841 15.7842 14.528C15.9281 14.6718 16 14.85 16 15.0625C16 15.2751 15.9281 15.4532 15.7842 15.5967C15.6406 15.7404 15.4625 15.8122 15.25 15.8122H11.25Z');
                            ip2.setAttribute('fill', '#939394'); g.appendChild(ip2);

                            var ip3 = document.createElementNS(_ns, 'path');
                            ip3.setAttribute('d', 'M7.223 8.49222L8.72689 9.99995L7.22795 11.4915C7.07928 11.6401 7.00495 11.8167 7.00495 12.0212C7.00495 12.2257 7.07928 12.4023 7.22795 12.551C7.37661 12.6996 7.5517 12.774 7.7532 12.774C7.95453 12.774 8.1307 12.6996 8.2817 12.551L10.2076 10.6327C10.3883 10.4519 10.4786 10.2409 10.4786 9.99995C10.4786 9.75895 10.3883 9.54803 10.2076 9.3672L8.27675 7.43272C8.12575 7.28405 7.94959 7.20972 7.74825 7.20972C7.54675 7.20972 7.37166 7.28405 7.223 7.43272C7.07433 7.58138 7 7.75797 7 7.96247C7 8.16697 7.07433 8.34355 7.223 8.49222Z');
                            ip3.setAttribute('fill', '#939394'); g.appendChild(ip3);

                            icoSvg.appendChild(g);
                            iconWrap.appendChild(icoSvg);

                            // Notification ping dot
                            var notifDot = el('div', '');
                            notifDot.style.cssText = 'position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--primary,#4fc3f7);border:2px solid var(--sidebar,#1a1a1a);animation:' + P + '-pulse 1.5s ease-in-out infinite;';
                            iconWrap.appendChild(notifDot);
                            innerBtn.appendChild(iconWrap);

                            // Label + "Needs Attention" tag
                            var labelWrap = el('div', 'flex items-center gap-1 min-w-0');
                            labelWrap.appendChild(el('span', 'text-sm truncate', a.label));
                            var attTag = el('span', 'text-sm whitespace-nowrap');
                            attTag.style.cssText = 'color:var(--muted-foreground,rgba(255,255,255,0.35));';
                            attTag.textContent = 'Needs Attention';
                            labelWrap.appendChild(attTag);
                            innerBtn.appendChild(labelWrap);

                        } else {
                            // ── Spinning circle for running agents ──
                            var spinSvg = document.createElementNS(_ns, 'svg');
                            spinSvg.setAttribute('width', '16'); spinSvg.setAttribute('height', '16');
                            spinSvg.setAttribute('viewBox', '0 -960 960 960'); spinSvg.setAttribute('fill', 'currentColor');
                            spinSvg.style.cssText = 'flex-shrink:0;opacity:0.7;animation:' + P + '-spin 0.8s linear infinite;';
                            var spinPath = document.createElementNS(_ns, 'path');
                            spinPath.setAttribute('d', 'M332.55-129.9q-69.29-29.9-121.02-81.63T129.9-332.55T100-480.35t29.96-147.5t81.58-120.61t121.04-81.58T480-860q12.75,0 21.37,8.63T510-829.99t-8.62,21.37T480-800q-133,0-226.5,93.5T160-480t93.5,226.5T480-160t226.5-93.5T800-480q0-12.77 8.63-21.38T830.01-510t21.37,8.62T860-480q0,77.99-29.96,147.42T748.46-211.54T627.85-129.96T480.35-100t-147.8-29.9Z');
                            spinSvg.appendChild(spinPath);
                            innerBtn.appendChild(spinSvg);

                            var labelWrap2 = el('div', 'flex items-center gap-1 min-w-0');
                            labelWrap2.appendChild(el('span', 'text-sm truncate', a.label));
                            innerBtn.appendChild(labelWrap2);
                        }

                        innerBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            var rt = window.__TSR_ROUTER__;
                            if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id });
                        });
                        row.appendChild(innerBtn);

                        // Stop button overlay: visible on hover, fades in from the right
                        var stopOverlay = el('div', '');
                        stopOverlay.style.cssText = 'position:absolute;top:0;bottom:0;right:0;padding-left:12px;display:flex;align-items:center;justify-content:flex-end;gap:1px;transform:translateX(6px);visibility:hidden;background:linear-gradient(to right, transparent 0%, var(--card-border,rgba(18,18,18,0.95)) 25%);';

                        var stopBtnEl = el('button', '');
                        stopBtnEl.style.cssText = 'width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:none;background:none;cursor:pointer;padding:0;margin-right:2px;';
                        var stopCircleSvg = document.createElementNS(_ns, 'svg');
                        stopCircleSvg.setAttribute('width', '16'); stopCircleSvg.setAttribute('height', '16');
                        stopCircleSvg.setAttribute('viewBox', '0 -960 960 960'); stopCircleSvg.setAttribute('fill', 'currentColor');
                        stopCircleSvg.style.cssText = 'color:var(--secondary-foreground,rgba(255,255,255,0.55));transition:color 0.12s;';
                        var scPath = document.createElementNS(_ns, 'path');
                        scPath.setAttribute('d', 'M330-330H630V-630H330v300ZM480.07-100q-78.84,0-148.2-29.92T211.18-211.13T129.93-331.76T100-479.93t29.92-148.2t81.21-120.68t120.63-81.25T479.93-860t148.2,29.92t120.68,81.21t81.25,120.63T860-480.07t-29.92,148.2T748.87-211.18T628.24-129.93T480.07-100ZM480-160q134,0 227-93t93-227T707-707T480-800T253-707T160-480t93,227t227,93Zm0-320Z');
                        stopCircleSvg.appendChild(scPath);
                        stopBtnEl.appendChild(stopCircleSvg);
                        stopBtnEl.addEventListener('click', function(e) { e.stopPropagation(); cancelAction('agent', a.id); });
                        stopBtnEl.addEventListener('mouseenter', function() { stopCircleSvg.style.color = 'var(--foreground,#fff)'; });
                        stopBtnEl.addEventListener('mouseleave', function() { stopCircleSvg.style.color = 'var(--secondary-foreground,rgba(255,255,255,0.55))'; });
                        stopOverlay.appendChild(stopBtnEl);
                        row.appendChild(stopOverlay);

                        row.addEventListener('mouseenter', function() {
                            row.style.color = 'var(--foreground,#fff)';
                            stopOverlay.style.visibility = 'visible';
                        });
                        row.addEventListener('mouseleave', function() {
                            row.style.color = 'var(--secondary-foreground,rgba(255,255,255,0.55))';
                            stopOverlay.style.visibility = 'hidden';
                        });

                        return row;
                    }

                    // ── Outer wrapper: injected as the top section of the input box ──
                    var dd = el('div', 'flex flex-col px-3 w-full');
                    dd.id = P + '-running-dropdown';
                    dd.style.cssText = 'padding-top:6px;padding-bottom:4px;';

                    // ── Summary header button with chevron ──
                    var headerParts = [];
                    if (runningAgents.length > 0) headerParts.push(runningAgents.length + ' subagent' + (runningAgents.length > 1 ? 's' : '') + ' running');
                    if (waitingAgents.length > 0) headerParts.push(waitingAgents.length + ' subagent' + (waitingAgents.length > 1 ? 's' : '') + ' blocked');

                    var hBtn = el('button', 'flex items-center justify-between cursor-pointer h-6 shrink-0 w-full');
                    hBtn.style.cssText = 'background:none;border:none;padding:0;text-align:left;color:var(--secondary-foreground,rgba(255,255,255,0.55));transition:color 0.12s;';
                    hBtn.addEventListener('mouseenter', function() { hBtn.style.color = 'var(--foreground,#fff)'; });
                    hBtn.addEventListener('mouseleave', function() { hBtn.style.color = 'var(--secondary-foreground,rgba(255,255,255,0.55))'; });

                    var hLabel = el('span', 'text-sm');
                    hLabel.textContent = headerParts.join(', ');
                    hBtn.appendChild(hLabel);

                    // Chevron SVG — rotated 90° when expanded
                    var chevSvg = document.createElementNS(_ns, 'svg');
                    chevSvg.setAttribute('width', '16'); chevSvg.setAttribute('height', '16');
                    chevSvg.setAttribute('viewBox', '0 -960 960 960'); chevSvg.setAttribute('fill', 'currentColor');
                    chevSvg.style.cssText = 'flex-shrink:0;transition:transform 0.15s;' + (!uiState.dropdownCollapsed ? 'transform:rotate(90deg);' : '');
                    var chevPath = document.createElementNS(_ns, 'path');
                    chevPath.setAttribute('d', 'M517.85-480l-184-184L376-706.15L602.15-480L376-253.85L333.85-296l184-184Z');
                    chevSvg.appendChild(chevPath);
                    hBtn.appendChild(chevSvg);

                    // ── Agents list (collapsible) ──
                    var agentList = el('div', 'flex flex-col gap-0.5 my-1');
                    agentList.style.cssText = 'max-height:128px;overflow-y:auto;' + (uiState.dropdownCollapsed ? 'display:none;' : '');

                    hBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        uiState.dropdownCollapsed = !uiState.dropdownCollapsed;
                        agentList.style.display = uiState.dropdownCollapsed ? 'none' : '';
                        chevSvg.style.transform = uiState.dropdownCollapsed ? '' : 'rotate(90deg)';
                    });
                    dd.appendChild(hBtn);

                    // ── Group agents by batchId ──
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
                            if (!uiState.batchCollapsed) uiState.batchCollapsed = {};
                            var bCollapsed = uiState.batchCollapsed[bid] || false;

                            var bHeader = el('div', '');
                            bHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:2px 0 4px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.06);margin-top:2px;';

                            var bRunningN = bAgents.filter(function(a) { return a.status === 'running'; }).length;
                            var bWaitingN = bAgents.filter(function(a) { return a.status === 'waiting_for_action'; }).length;
                            var bPartsN = [];
                            if (bRunningN) bPartsN.push(bRunningN + ' running');
                            if (bWaitingN) bPartsN.push(bWaitingN + ' action');

                            var bLabelEl = el('span', '');
                            bLabelEl.style.cssText = 'font-size:0.75rem;opacity:0.6;';
                            bLabelEl.textContent = 'Batch (' + bAgents.length + ' agents' + (bPartsN.length ? ': ' + bPartsN.join(', ') : '') + ')';

                            // Collapse chevron: up = expanded, down = collapsed
                            var bChevSvg = document.createElementNS(_ns, 'svg');
                            bChevSvg.setAttribute('width', '14'); bChevSvg.setAttribute('height', '14');
                            bChevSvg.setAttribute('viewBox', '0 -960 960 960'); bChevSvg.setAttribute('fill', 'currentColor');
                            bChevSvg.style.cssText = 'flex-shrink:0;opacity:0.5;transition:transform 0.15s;margin-left:4px;' + (bCollapsed ? 'transform:rotate(180deg);' : '');
                            var bChevPath = document.createElementNS(_ns, 'path');
                            bChevPath.setAttribute('d', 'M480-541.85l-184,184L253.85-400L480-626.15L706.15-400L664-357.85l-184-184Z');
                            bChevSvg.appendChild(bChevPath);

                            var bLeftEl = el('div', '');
                            bLeftEl.style.cssText = 'display:flex;align-items:center;';
                            bLeftEl.appendChild(bLabelEl);
                            bLeftEl.appendChild(bChevSvg);

                            var bRightEl = el('div', '');
                            bRightEl.style.cssText = 'display:flex;align-items:center;gap:4px;';
                            bRightEl.appendChild(stopBtn('Stop Batch', 'batch', bid, true));

                            bHeader.appendChild(bLeftEl);
                            bHeader.appendChild(bRightEl);

                            // Wrap batch agent rows in a container so we can toggle visibility
                            var bRowsContainer = el('div', 'flex flex-col gap-0.5');
                            bRowsContainer.style.cssText = bCollapsed ? 'display:none;' : '';
                            bAgents.forEach(function(a) { bRowsContainer.appendChild(buildChatboxRow(a)); });

                            bHeader.addEventListener('click', function(e) {
                                e.stopPropagation();
                                if (!uiState.batchCollapsed) uiState.batchCollapsed = {};
                                uiState.batchCollapsed[bid] = !uiState.batchCollapsed[bid];
                                bChevSvg.style.transform = uiState.batchCollapsed[bid] ? 'rotate(180deg)' : '';
                                bRowsContainer.style.display = uiState.batchCollapsed[bid] ? 'none' : '';
                            });
                            agentList.appendChild(bHeader);
                            agentList.appendChild(bRowsContainer);
                        } else {
                            agentList.appendChild(buildChatboxRow(bAgents[0]));
                        }
                    });

                    dd.appendChild(agentList);

                    // ── Insert before the first child (inner card) for the connected look ──
                    var firstInner = inputBox.firstElementChild;
                    if (firstInner) {
                        inputBox.insertBefore(dd, firstInner);
                    } else {
                        inputBox.appendChild(dd);
                    }
                }

                // --- Notification badge on parent chat in left sidebar ---
                var oldBadges = document.querySelectorAll('.' + P + '-chat-notify');
                oldBadges.forEach(function(b) { b.remove(); });
                if (waitingAgents.length > 0 && activeConvoId) {
                    var pill = document.querySelector('span[data-testid="convo-pill-' + activeConvoId + '"]');
                    if (pill) {
                        var notifBadgeEl = el('span', P + '-chat-notify google-symbols');
                        notifBadgeEl.textContent = 'notifications';
                        notifBadgeEl.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:#fbbf24;margin-right:4px;animation:' + P + '-pulse 1.5s ease-in-out infinite;flex-shrink:0;';
                        pill.parentNode.insertBefore(notifBadgeEl, pill);
                    }
                }
`;
}
