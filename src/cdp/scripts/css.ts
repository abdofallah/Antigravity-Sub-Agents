/**
 * CDP Injection CSS
 *
 * Builds the CSS string for the injected sub-agent UI elements.
 * Used by the CDP injector for style injection into the Manager page.
 *
 * @module cdp/scripts/css
 */

/**
 * Build CSS for the sub-agent UI elements.
 * @param prefix - CSS class prefix (e.g. 'sa')
 */
export function buildCSS(prefix: string): string {
    return `
    .${prefix}-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
    .${prefix}-dot-running { background:#4fc3f7;box-shadow:0 0 4px #4fc3f7;animation:${prefix}-pulse 1.5s ease-in-out infinite; }
    .${prefix}-dot-completed { background:#66bb6a; }
    .${prefix}-dot-failed { background:#ef5350; }
    .${prefix}-dot-waiting { background:#ffa726;animation:${prefix}-pulse 2s ease-in-out infinite; }
    .${prefix}-dot-pending { background:#78909c; }
    .${prefix}-spinner {
        display:inline-block;width:12px;height:12px;flex-shrink:0;
        border:1.5px solid rgba(128,128,128,0.3);border-top-color:#4fc3f7;
        border-radius:50%;animation:${prefix}-spin 0.8s linear infinite;
    }
    @keyframes ${prefix}-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes ${prefix}-spin { to{transform:rotate(360deg)} }`;
}
