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
                            if (!bannerContainer) {
                                // Also check for the input box area when chat is unarchived
                                var inputArea = document.getElementById('antigravity.agentSidePanelInputBox');
                                if (inputArea && action) bannerContainer = inputArea;
                            }

                            if (bannerContainer && action && !document.getElementById(P + '-action-bar')) {
                                // ── Pending action: replace the entire banner with action UI ──
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

                            } else if (bannerContainer && !action) {
                                // ── No pending action: clean up action bar if it exists ──
                                var existingBar = document.getElementById(P + '-action-bar');
                                if (existingBar) {
                                    existingBar.remove();
                                    // Restore original children
                                    var restoredChildren = bannerContainer.children;
                                    for (var ri = 0; ri < restoredChildren.length; ri++) {
                                        restoredChildren[ri].style.display = '';
                                    }
                                }

                                // Replace "archived" text with view-only label
                                var allSpans = document.querySelectorAll('span.text-sm.opacity-70');
                                allSpans.forEach(function(sp) {
                                    if (sp.textContent && sp.textContent.indexOf('archived') !== -1) {
                                        sp.textContent = String.fromCodePoint(0x1F512) + ' Sub-agent chat ' + String.fromCharCode(0x2014) + ' view only';
                                    }
                                });
                            }
                        }

                        // Clean up any legacy overlays from previous versions
                        var legacyOverlay = document.getElementById(P + '-input-overlay');
                        if (legacyOverlay) legacyOverlay.remove();
                        var legacyBanner = document.getElementById(P + '-lock-banner');
                        if (legacyBanner) legacyBanner.remove();
                    }

                    // Run immediately + on interval
                    enforceLocks();
                    setInterval(enforceLocks, 500);
                }
`;
}
