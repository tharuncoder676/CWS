// ============================================================
//  tabs.js — Clean, duplicate-free tab switching
//  Tabs are identified by data-target="<view-id>" attributes.
//  Views are divs with class .tab-view and matching IDs.
// ============================================================

/**
 * switchTab(tabId)
 * - Deactivates all .tab-view and .nav-tab-btn elements
 * - Activates the target view (id="<tabId>-view") and button (id="tab-<tabId>")
 * - Scrolls to top
 */
export function switchTab(tabId) {
    if (!tabId) return;

    // Hide all tab views
    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.remove('active');
    });

    // Deactivate all nav tab buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activate target view
    const targetView = document.getElementById(`${tabId}-view`);
    if (targetView) {
        targetView.classList.add('active');
    } else {
        console.warn(`[tabs] No view found with id="${tabId}-view"`);
    }

    // Activate corresponding button
    const targetBtn = document.getElementById(`tab-${tabId}`);
    if (targetBtn) targetBtn.classList.add('active');

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * initTabs()
 * Attaches click listeners to all .nav-tab-btn elements once.
 * Each button must have data-tab="<tabId>" attribute.
 */
export function initTabs() {
    const buttons = document.querySelectorAll('.nav-tab-btn[data-tab]');
    if (!buttons.length) {
        console.warn('[tabs] No .nav-tab-btn[data-tab] elements found');
    }

    buttons.forEach(btn => {
        // Remove any stale inline onclick to avoid duplicate calls
        btn.removeAttribute('onclick');

        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
}
