/**
 * TanStack Router Subscription Script
 *
 * Generates the JavaScript IIFE that subscribes to TanStack Router
 * navigation events inside the Antigravity Manager page. When the user
 * navigates to a different conversation (/c/$cascadeId), the page calls
 * our CDP binding which fires _onRouterChange instantly.
 *
 * Also installs a navigation BLOCKER via router.history.block — while a
 * heavy DOM injection is in flight (window.__saIsInjecting === true),
 * any user-initiated route change is paused until the injection releases
 * the lock via window.__saReleaseNavigation(). This prevents stale
 * retry/event closures for the previous route from leaking into and
 * corrupting the new route's UI state.
 *
 * @module cdp/scripts/build-router-sub
 */

/**
 * Build the router subscription script IIFE.
 * Returns a self-executing JS string that subscribes to router navigation
 * and installs a navigation blocker tied to window.__saIsInjecting.
 */
export function buildRouterSubscription(): string {
    return `(() => {
        try {
            if (window.__saRouterSub) return 'already-subscribed';

            var router = window.__TSR_ROUTER__;
            if (!router || !router.subscribe) return 'no-router';

            function getConvoId() {
                try {
                    var matches = router.state?.matches || [];
                    for (var i = 0; i < matches.length; i++) {
                        if (matches[i].params && matches[i].params.cascadeId) {
                            return matches[i].params.cascadeId;
                        }
                    }
                } catch(e) {}
                return null;
            }

            var lastConvo = getConvoId();

            // ── Navigation blocker ──
            // While an injection is in flight, pause route changes until released.
            // TanStack History API has evolved:
            //   • v1.55+  : history.block({ blockerFn: fn })  — object shape
            //   • legacy  : history.block(fn)                 — bare function
            // The blockerFn returns either a boolean (allow/abort synchronously)
            // or a Promise to pause. We return a Promise whose resolver is exposed
            // on window — the injection script calls it in its finally{} block.
            try {
                if (router.history && typeof router.history.block === 'function') {
                    var blockerFn = function(opts) {
                        if (!window.__saIsInjecting) return; // allow immediately
                        // Pause navigation by returning an unresolved Promise.
                        return new Promise(function(resolve) {
                            // Safety net: never block longer than 2 seconds even if
                            // the injection script crashes before clearing the flag.
                            var timedOut = false;
                            var safetyTimer = setTimeout(function() {
                                timedOut = true;
                                window.__saIsInjecting = false;
                                window.__saReleaseNavigation = null;
                                try { console.warn('[SA:router] nav-blocker safety timeout (2s) — releasing'); } catch(e) {}
                                resolve();
                            }, 2000);
                            window.__saReleaseNavigation = function() {
                                if (timedOut) return;
                                clearTimeout(safetyTimer);
                                window.__saReleaseNavigation = null;
                                resolve();
                            };
                        });
                    };
                    // TanStack History v1.55+ requires { blockerFn } shape.
                    // We do NOT fall back to bare-function — newer versions iterate
                    // blockers and call .blockerFn() on each entry, so a bare function
                    // would corrupt ALL navigation (not just ours). Better to silently
                    // disable our blocker; the Node-side _routeGeneration guard still
                    // discards stale results, just without route-pausing.
                    try {
                        var unblock = router.history.block({ blockerFn: blockerFn });
                        if (typeof unblock === 'function') window.__saUnblock = unblock;
                    } catch (regErr) {
                        try { console.warn('[SA:router] history.block registration failed — blocker disabled: ' + regErr.message); } catch(_) {}
                    }
                }
            } catch(e) {
                try { console.warn('[SA:router] history.block unavailable: ' + e.message); } catch(_) {}
            }

            window.__saRouterSub = router.subscribe('onResolved', function() {
                var newConvo = getConvoId();
                if (newConvo !== lastConvo) {
                    lastConvo = newConvo;
                    try {
                        window.__saRouterChange(JSON.stringify({ convoId: newConvo }));
                    } catch(e) {}
                }
            });

            return 'subscribed:' + (lastConvo || 'none');
        } catch(e) {
            return 'error:' + e.message;
        }
    })()`;
}
