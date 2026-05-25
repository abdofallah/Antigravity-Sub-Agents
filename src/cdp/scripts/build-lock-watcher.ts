/**
 * Lock Watcher Script Fragment
 *
 * Generates the JavaScript fragment that installs a persistent DOM watcher
 * to enforce sub-agent chat restrictions:
 * - Hide revert/undo buttons on sub-agent chats
 * - Replace archive banner with action UI (approve/deny) when pending
 * - Show "view only" label on sub-agent archive banners
 * - Clean up legacy overlays
 *
 * This is a FRAGMENT — assumes shared variables from the main injection
 * script are in scope (P, subAgentIds, pendingActions).
 *
 * @module cdp/scripts/build-lock-watcher
 */

/**
 * Build the lock watcher installation script fragment.
 * Must be embedded inside the main injection IIFE.
 */
export function buildLockWatcher(): string {
    return `
                // --- Sub-agent chat cosmetic tweaks (persistent watcher) ---
                // Install a persistent watcher that continuously enforces restrictions.
                // This solves the race where React hasn't rendered the DOM yet.
                if (!window.__saLockWatcher) {
                    window.__saLockWatcher = { subAgentIds: [], pendingActions: {} };
                }
                // Update the watcher's data on every injection cycle
                window.__saLockWatcher.subAgentIds = subAgentIds;
                window.__saLockWatcher.pendingActions = pendingActions;

                if (!window.__saLockWatcherInstalled) {
                    window.__saLockWatcherInstalled = true;

                    function enforceLocks() {
                        var w = window.__saLockWatcher;
                        if (!w) return;

                        // Detect active conversation
                        var convoId = null;
                        try {
                            var router = window.__TSR_ROUTER__;
                            if (router && router.state && router.state.matches) {
                                for (var i = 0; i < router.state.matches.length; i++) {
                                    if (router.state.matches[i].params && router.state.matches[i].params.cascadeId) {
                                        convoId = router.state.matches[i].params.cascadeId;
                                        break;
                                    }
                                }
                            }
                        } catch(e) {}
                        if (!convoId) return;

                        var isSub = w.subAgentIds.indexOf(convoId) !== -1;

                        if (isSub) {
                            // Hide revert/undo buttons on sub-agent chats
                            var revertBtns = document.querySelectorAll('[data-testid="revert-button"]');
                            revertBtns.forEach(function(btn) { btn.style.display = 'none'; });

                            var action = w.pendingActions && w.pendingActions[convoId];

                            // Find the archive banner container
                            var bannerContainer = document.querySelector('.relative.flex.items-center.justify-center.gap-2.p-1');
                            var inputArea = document.getElementById('antigravity.agentSidePanelInputBox');

                            if (bannerContainer && action && !document.getElementById(P + '-action-bar')) {
                                // ── Archived + pending action: replace the banner with action UI ──
                                // Hide original children but keep container
                                var origChildren = bannerContainer.children;
                                for (var ci = 0; ci < origChildren.length; ci++) {
                                    origChildren[ci].style.display = 'none';
                                }

                                var actionBar = document.createElement('div');
                                actionBar.id = P + '-action-bar';
                                actionBar.style.cssText = 'display:flex;flex-direction:column;gap:6px;width:100%;padding:8px 12px;';

                                // Top: icon + description
                                var topLine = document.createElement('div');
                                topLine.style.cssText = 'display:flex;align-items:center;gap:8px;';

                                var lockIcon = document.createElement('span');
                                lockIcon.textContent = String.fromCodePoint(0x1F512);
                                lockIcon.style.cssText = 'font-size:14px;flex-shrink:0;';
                                topLine.appendChild(lockIcon);

                                var descText = document.createElement('span');
                                descText.style.cssText = 'font-size:13px;opacity:0.85;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                                var prefix = action.actionType === 'command' ? 'Allow running ' : 'Allow ';
                                descText.textContent = prefix + action.target + '?';
                                topLine.appendChild(descText);

                                actionBar.appendChild(topLine);

                                // Bottom: action buttons
                                var btnLine = document.createElement('div');
                                btnLine.style.cssText = 'display:flex;align-items:center;gap:8px;padding-left:22px;';

                                function makeActionBtn(text, type, bgColor, textColor) {
                                    var b = document.createElement('button');
                                    b.textContent = text;
                                    b.style.cssText = 'cursor:pointer;border:none;border-radius:4px;padding:3px 14px;font-size:12px;font-weight:500;color:' + textColor + ';background:' + bgColor + ';transition:filter 0.15s;';
                                    b.addEventListener('mouseenter', function() { b.style.filter = 'brightness(1.2)'; });
                                    b.addEventListener('mouseleave', function() { b.style.filter = ''; });
                                    b.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        if (type === 'respond') {
                                            var msg = prompt('Tell the agent what to do instead:');
                                            if (msg !== null) {
                                                try { window.__saActionHandler(JSON.stringify({ type: 'respond', id: convoId, message: msg })); } catch(ex) {}
                                            }
                                        } else {
                                            try { window.__saActionHandler(JSON.stringify({ type: type, id: convoId })); } catch(ex) {}
                                        }
                                    });
                                    return b;
                                }

                                btnLine.appendChild(makeActionBtn('Run', 'approve', '#2563eb', '#fff'));
                                btnLine.appendChild(makeActionBtn('No', 'respond', 'rgba(120,120,120,0.3)', '#ccc'));
                                btnLine.appendChild(makeActionBtn('Reject', 'reject', 'rgba(239,68,68,0.8)', '#fff'));

                                actionBar.appendChild(btnLine);
                                bannerContainer.appendChild(actionBar);

                            } else if (!bannerContainer && inputArea && action && !document.getElementById(P + '-action-bar')) {
                                // ── Unarchived + pending action: inject action bar into input area ──
                                var origInputChildren = inputArea.children;
                                for (var ici = 0; ici < origInputChildren.length; ici++) {
                                    origInputChildren[ici].style.display = 'none';
                                }

                                var actionBar2 = document.createElement('div');
                                actionBar2.id = P + '-action-bar';
                                actionBar2.style.cssText = 'display:flex;flex-direction:column;gap:6px;width:100%;padding:8px 12px;';

                                var topLine2 = document.createElement('div');
                                topLine2.style.cssText = 'display:flex;align-items:center;gap:8px;';

                                var lockIcon2 = document.createElement('span');
                                lockIcon2.textContent = String.fromCodePoint(0x1F512);
                                lockIcon2.style.cssText = 'font-size:14px;flex-shrink:0;';
                                topLine2.appendChild(lockIcon2);

                                var descText2 = document.createElement('span');
                                descText2.style.cssText = 'font-size:13px;opacity:0.85;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                                var prefix2 = action.actionType === 'command' ? 'Allow running ' : 'Allow ';
                                descText2.textContent = prefix2 + action.target + '?';
                                topLine2.appendChild(descText2);

                                actionBar2.appendChild(topLine2);

                                var btnLine2 = document.createElement('div');
                                btnLine2.style.cssText = 'display:flex;align-items:center;gap:8px;padding-left:22px;';

                                function makeActionBtn2(text, type, bgColor, textColor) {
                                    var b = document.createElement('button');
                                    b.textContent = text;
                                    b.style.cssText = 'cursor:pointer;border:none;border-radius:4px;padding:3px 14px;font-size:12px;font-weight:500;color:' + textColor + ';background:' + bgColor + ';transition:filter 0.15s;';
                                    b.addEventListener('mouseenter', function() { b.style.filter = 'brightness(1.2)'; });
                                    b.addEventListener('mouseleave', function() { b.style.filter = ''; });
                                    b.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        if (type === 'respond') {
                                            var msg = prompt('Tell the agent what to do instead:');
                                            if (msg !== null) {
                                                try { window.__saActionHandler(JSON.stringify({ type: 'respond', id: convoId, message: msg })); } catch(ex) {}
                                            }
                                        } else {
                                            try { window.__saActionHandler(JSON.stringify({ type: type, id: convoId })); } catch(ex) {}
                                        }
                                    });
                                    return b;
                                }

                                btnLine2.appendChild(makeActionBtn2('Run', 'approve', '#2563eb', '#fff'));
                                btnLine2.appendChild(makeActionBtn2('No', 'respond', 'rgba(120,120,120,0.3)', '#ccc'));
                                btnLine2.appendChild(makeActionBtn2('Reject', 'reject', 'rgba(239,68,68,0.8)', '#fff'));

                                actionBar2.appendChild(btnLine2);
                                inputArea.appendChild(actionBar2);

                            } else if (bannerContainer && !action) {
                                // ── Archived + no pending action: show lock label, hide Restore ──
                                var existingBar = document.getElementById(P + '-action-bar');
                                if (existingBar) {
                                    existingBar.remove();
                                    var restoredChildren = bannerContainer.children;
                                    for (var ri = 0; ri < restoredChildren.length; ri++) {
                                        restoredChildren[ri].style.display = '';
                                    }
                                }

                                // Replace "archived" text with view-only label
                                var allSpans = bannerContainer.querySelectorAll('span.text-sm.opacity-70');
                                allSpans.forEach(function(sp) {
                                    if (sp.textContent && sp.textContent.indexOf('archived') !== -1) {
                                        sp.textContent = String.fromCodePoint(0x1F512) + ' Sub-agent chat ' + String.fromCharCode(0x2014) + ' view only';
                                    }
                                });

                                // Hide the Restore button
                                var restoreBtns = bannerContainer.querySelectorAll('button');
                                restoreBtns.forEach(function(btn) {
                                    if (btn.textContent && btn.textContent.trim() === 'Restore') {
                                        btn.style.display = 'none';
                                    }
                                });

                            } else if (!bannerContainer && inputArea && !action) {
                                // ── Unarchived + no pending action: replace input with lock banner ──
                                var existingBar2 = document.getElementById(P + '-action-bar');
                                if (existingBar2) existingBar2.remove();

                                if (!document.getElementById(P + '-lock-view-only')) {
                                    // Hide all input box children
                                    var inputChildren = inputArea.children;
                                    for (var ic = 0; ic < inputChildren.length; ic++) {
                                        inputChildren[ic].style.display = 'none';
                                    }

                                    var lockBanner = document.createElement('div');
                                    lockBanner.id = P + '-lock-view-only';
                                    lockBanner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;min-height:50px;';

                                    var lockSpan = document.createElement('span');
                                    lockSpan.style.cssText = 'font-size:13px;opacity:0.7;';
                                    lockSpan.textContent = String.fromCodePoint(0x1F512) + ' Sub-agent chat ' + String.fromCharCode(0x2014) + ' view only';
                                    lockBanner.appendChild(lockSpan);

                                    inputArea.appendChild(lockBanner);
                                }
                            }
                        } else {
                            // ── Not a sub-agent: clean up any lock UI we may have injected ──
                            var lockViewOnly = document.getElementById(P + '-lock-view-only');
                            if (lockViewOnly) {
                                var parentBox = lockViewOnly.parentElement;
                                lockViewOnly.remove();
                                if (parentBox) {
                                    var hiddenKids = parentBox.children;
                                    for (var hk = 0; hk < hiddenKids.length; hk++) {
                                        hiddenKids[hk].style.display = '';
                                    }
                                }
                            }
                            var existingActionBar = document.getElementById(P + '-action-bar');
                            if (existingActionBar) {
                                var parentBox2 = existingActionBar.parentElement;
                                existingActionBar.remove();
                                if (parentBox2) {
                                    var hiddenKids2 = parentBox2.children;
                                    for (var hk2 = 0; hk2 < hiddenKids2.length; hk2++) {
                                        hiddenKids2[hk2].style.display = '';
                                    }
                                }
                            }
                        }
                    }

                    // Run immediately + on interval
                    enforceLocks();
                    setInterval(enforceLocks, 500);
                }
`;
}
