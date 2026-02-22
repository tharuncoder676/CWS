// ============================================================
//  main.js — Application orchestrator
//  Imports all modules, wires DOM listeners, exposes globals.
// ============================================================
import { loginUser, registerUser, logoutUser, saveUserProfile } from './auth.js';
import { switchTab, initTabs } from './tabs.js';
import './script.js';

// ── Expose switchTab globally immediately (auth.js needs it) ──
window._switchTab = switchTab;
window.switchTab = switchTab;

// ─────────────────────────────────────────────────────────────
//  All UI wiring lives inside DOMContentLoaded so every element
//  is guaranteed to exist before we reference it.
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // ── 1. Initialise tab system ───────────────────────────────
    initTabs();
    // Switch to dashboard tab by default
    switchTab('dashboard');

    // ── 2. "Get Started" button ────────────────────────────────
    document.getElementById('btn-get-started')
        ?.addEventListener('click', () => switchTab('workstation'));

    // ═══════════════════════════════════════════════════════════
    //  AUTH FORM: Login / Register
    // ═══════════════════════════════════════════════════════════
    let isRegisterMode = false;

    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authDesc = document.getElementById('auth-desc');
    const authBtnText = document.getElementById('auth-btn-text');
    const toggleAuthEl = document.getElementById('toggle-auth');
    const extraFields = document.getElementById('register-extra-fields');

    function setAuthMode(register) {
        isRegisterMode = register;
        if (authTitle) authTitle.textContent = register ? 'Create Account' : 'Student Login';
        if (authDesc) authDesc.textContent = register ? 'Join the CWS platform' : 'Access your 30-page report generator';
        if (authBtnText) authBtnText.textContent = register ? 'Register Now' : 'Sign In';
        if (toggleAuthEl) toggleAuthEl.textContent = register ? 'Already have an account? Login' : "Don't have an account? Register";

        if (extraFields) {
            extraFields.style.display = register ? 'block' : 'none';
            // Only mark as required in register mode
            extraFields.querySelectorAll('input').forEach(el => el.required = register);
            extraFields.querySelectorAll('select').forEach(el => el.required = register);
        }
    }

    // Expose for the inline proxy already in HTML
    window._toggleAuthMode = () => setAuthMode(!isRegisterMode);
    toggleAuthEl?.addEventListener('click', () => setAuthMode(!isRegisterMode));

    // ── Form submission ────────────────────────────────────────
    authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = authForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Please wait…';
        }

        const email = document.getElementById('auth-email')?.value.trim() ?? '';
        const password = document.getElementById('auth-pass')?.value ?? '';

        let result;
        if (isRegisterMode) {
            const profileData = {
                username: document.getElementById('auth-name')?.value.trim() ?? '',
                department: document.getElementById('auth-dept')?.value ?? '',
                year: document.getElementById('auth-year')?.value ?? ''
            };
            result = await registerUser(email, password, profileData);
        } else {
            result = await loginUser(email, password);
        }

        if (!result.success) {
            showToastSafe('❌ ' + result.error);
        }
        // On success, onAuthStateChanged in auth.js takes over
        // (dismisses overlay, renders dashboard, etc.)

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = isRegisterMode ? 'Register Now' : 'Sign In';
        }
    });

    // ═══════════════════════════════════════════════════════════
    //  PROFILE MODAL — open / close helpers
    // ═══════════════════════════════════════════════════════════
    function openProfileEdit() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        // Reset to edit mode (not mandatory)
        modal.setAttribute('data-mandatory', 'false');
        const els = {
            title: document.getElementById('prof-modal-title'),
            desc: document.getElementById('prof-modal-desc'),
            notice: document.getElementById('prof-first-notice'),
            cancel: document.getElementById('prof-cancel-btn'),
            save: document.getElementById('prof-save-btn'),
        };
        if (els.title) els.title.textContent = 'Edit Profile';
        if (els.desc) els.desc.textContent = 'Update your name, department or year';
        if (els.notice) els.notice.style.display = 'none';
        if (els.cancel) els.cancel.style.display = 'block';
        if (els.save) els.save.textContent = 'Save Changes';
        modal.classList.add('show');
    }

    function closeProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        if (modal.getAttribute('data-mandatory') === 'true') return; // Blocked
        modal.classList.remove('show');
    }

    // Register as globals (auth.js also calls these)
    window._openProfileEdit = openProfileEdit;
    window.openProfileEdit = openProfileEdit;
    window._closeProfileModal = closeProfileModal;
    window.closeProfileModal = closeProfileModal;

    // ── Profile form save ────────────────────────────────────
    document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('prof-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

        const result = await saveUserProfile({
            username: document.getElementById('prof-name')?.value.trim() ?? '',
            department: document.getElementById('prof-dept')?.value ?? '',
            year: document.getElementById('prof-year')?.value ?? ''
        });

        if (result.success) {
            showToastSafe('✅ Profile saved!');
            closeProfileModal();
            switchTab('dashboard');
        } else {
            showToastSafe('❌ ' + result.error);
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = document.getElementById('profile-modal')?.getAttribute('data-mandatory') === 'true'
                ? 'Save & Continue →' : 'Save Changes';
        }
    });

    // ═══════════════════════════════════════════════════════════
    //  LOGOUT
    // ═══════════════════════════════════════════════════════════
    window._logout = logoutUser;
    window.logout = logoutUser;

    document.getElementById('btn-logout')
        ?.addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });

    // ═══════════════════════════════════════════════════════════
    //  PROFILE MENU dropdown
    // ═══════════════════════════════════════════════════════════
    window._toggleProfileMenu = () =>
        document.getElementById('profile-menu')?.classList.toggle('show');
    window.toggleProfileMenu = window._toggleProfileMenu;

    document.querySelector('.profile-widget')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window._toggleProfileMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', () =>
        document.getElementById('profile-menu')?.classList.remove('show'));

    document.getElementById('btn-edit-profile')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('profile-menu')?.classList.remove('show');
        openProfileEdit();
    });

    // ═══════════════════════════════════════════════════════════
    //  THEME TOGGLE
    // ═══════════════════════════════════════════════════════════
    if (typeof window.initTheme === 'function') window.initTheme();

    // ═══════════════════════════════════════════════════════════
    //  OPTIONAL STUDENT BLOCKS (grammar banner)
    // ═══════════════════════════════════════════════════════════
    ['student-2-block', 'student-3-block', 'student-4-block'].forEach(id => {
        document.getElementById(id)?.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                const block = inp.closest('.student-block');
                if (!block) return;
                const hasContent = [...block.querySelectorAll('input')].some(i => i.value.trim());
                block.classList.toggle('has-content', hasContent);
                if (typeof window.updateGrammarBanner === 'function') window.updateGrammarBanner();
            });
        });
    });
});

// ── Safe toast (delegates to script.js showToast if available) ─
function showToastSafe(msg) {
    if (typeof window.showToast === 'function') {
        window.showToast(msg);
    } else {
        // Fallback: small alert if showToast hasn't loaded yet
        console.warn('[main] toast:', msg);
        // Also show as a temporary overlay message
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
            background:#1e293b;color:#fff;padding:.75rem 1.5rem;border-radius:999px;
            font-size:.9rem;z-index:9999;border:1px solid #334155;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }
}
