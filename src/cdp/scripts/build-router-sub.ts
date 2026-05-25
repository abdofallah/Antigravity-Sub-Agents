/**
 * TanStack Router Subscription Script
 *
 * Generates the JavaScript IIFE that subscribes to TanStack Router
 * navigation events inside the Antigravity Manager page. When the user
 * navigates to a different conversation (/c/$cascadeId), the page calls
 * our CDP binding which fires _onRouterChange instantly.
 *
 * @module cdp/scripts/build-router-sub
 */

/**
 * Build the router subscription script IIFE.
 * Returns a self-executing JS string that subscribes to router navigation.
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
