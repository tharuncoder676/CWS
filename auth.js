// ============================================================
//  auth.js — Firebase Auth + Firestore session manager
//  Collection path: users/{uid}
//  Fields stored:   username, studentId, year, department, email
// ============================================================
import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderDashboard, populateProfileModal, isProfileComplete } from './dashboard.js';

// ── Helpers ───────────────────────────────────────────────────

function isValidSimatsEmail(email) {
    // Accepts: 123456789.simats@saveetha.com (9 digits)
    return /^\d{9}\.simats@saveetha\.com$/i.test(email.trim());
}

/** Call fn safely whether DOM is ready or not */
function whenReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}

/** Call a window.* function safely, retrying until it's defined */
function callWhenAvailable(fnName, delay = 0) {
    const attempt = () => {
        if (typeof window[fnName] === 'function') {
            window[fnName]();
        } else {
            // retry once more after 300ms — handles race between module load and DOMContentLoaded
            setTimeout(() => {
                if (typeof window[fnName] === 'function') window[fnName]();
                else console.warn(`[auth] ${fnName} still not available`);
            }, 300);
        }
    };
    delay > 0 ? setTimeout(attempt, delay) : attempt();
}

// ── UI helpers ────────────────────────────────────────────────

function showLogin() {
    const overlay = document.getElementById('login-overlay');
    const shell = document.getElementById('app-shell');
    if (overlay) { overlay.style.display = 'flex'; overlay.classList.remove('fade-out'); }
    if (shell) { shell.classList.add('app-hidden'); shell.classList.remove('app-visible'); }
}

function showApp() {
    const overlay = document.getElementById('login-overlay');
    const shell = document.getElementById('app-shell');
    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => { overlay.style.display = 'none'; }, 450);
    }
    if (shell) {
        shell.classList.remove('app-hidden');
        requestAnimationFrame(() => shell.classList.add('app-visible'));
    }
}

// ── Auth State Observer ───────────────────────────────────────
// Fires once immediately on load (restores session) and again on every auth change.
onAuthStateChanged(auth, async (user) => {

    if (!user) {
        whenReady(showLogin);
        return;
    }

    // User is authenticated — reveal app shell
    whenReady(showApp);

    try {
        const snap = await getDoc(doc(db, 'users', user.uid));

        if (snap.exists()) {
            const data = snap.data();
            whenReady(() => {
                renderDashboard(data, user);

                if (!isProfileComplete(data)) {
                    // Profile incomplete → mandatory setup modal
                    populateProfileModal(data, true);
                    callWhenAvailable('openProfileEdit', 500);
                } else {
                    // Full profile → go straight to dashboard
                    populateProfileModal(data, false);
                    callWhenAvailable('switchTab', 100);
                    // switchTab needs 'dashboard' arg — handle separately
                    setTimeout(() => {
                        if (typeof window.switchTab === 'function') window.switchTab('dashboard');
                    }, 150);
                }
            });
        } else {
            // Brand new user — no Firestore doc yet
            const regNo = user.email.split('.')[0];
            const fallback = { username: '', studentId: regNo, year: '', department: '', email: user.email };

            whenReady(() => {
                renderDashboard(fallback, user);
                populateProfileModal(fallback, true);
                // Force mandatory profile setup
                setTimeout(() => {
                    if (typeof window.openProfileEdit === 'function') window.openProfileEdit();
                }, 500);
            });
        }
    } catch (err) {
        console.error('[auth] Firestore error:', err.code, err.message);
    }
});

// ── Login ─────────────────────────────────────────────────────
export async function loginUser(email, password) {
    if (!email || !password) {
        return { success: false, error: 'Please enter your email and password.' };
    }
    if (!isValidSimatsEmail(email)) {
        return { success: false, error: 'Use your SIMATS email: 123456789.simats@saveetha.com' };
    }
    try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        return { success: true };
    } catch (err) {
        const msg = {
            'auth/user-not-found': 'No account found. Please register first.',
            'auth/wrong-password': 'Incorrect password. Try again.',
            'auth/invalid-credential': 'Invalid email or password.',
            'auth/too-many-requests': 'Too many failed attempts. Try again later.',
            'auth/invalid-email': 'Email format is invalid.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/network-request-failed': 'Network error. Check your internet connection.'
        };
        console.error('[auth] Login error:', err.code);
        return { success: false, error: msg[err.code] || `Login failed: ${err.message}` };
    }
}

// ── Register ──────────────────────────────────────────────────
export async function registerUser(email, password, profileData) {
    if (!email || !password) {
        return { success: false, error: 'Please fill in all required fields.' };
    }
    if (!isValidSimatsEmail(email)) {
        return { success: false, error: 'Use your SIMATS email: 123456789.simats@saveetha.com' };
    }
    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
    }
    try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = cred.user.uid;
        const regNo = email.trim().split('.')[0];

        // Save profile to Firestore immediately
        await setDoc(doc(db, 'users', uid), {
            username: (profileData.username || '').trim(),
            studentId: regNo,
            year: profileData.year || '',
            department: profileData.department || '',
            email: email.trim(),
            createdAt: new Date().toISOString()
        });

        return { success: true };
    } catch (err) {
        const msg = {
            'auth/email-already-in-use': 'An account with this email already exists. Please login.',
            'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/invalid-email': 'Email format is invalid.',
            'auth/operation-not-allowed': 'Email/Password sign-up is not enabled. Contact support.',
            'auth/network-request-failed': 'Network error. Check your internet connection.'
        };
        console.error('[auth] Register error:', err.code);
        return { success: false, error: msg[err.code] || `Registration failed: ${err.message}` };
    }
}

// ── Save / Update Profile ─────────────────────────────────────
export async function saveUserProfile(profileData) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'You are not logged in.' };

    if (!profileData.username || !profileData.username.trim()) {
        return { success: false, error: 'Please enter your full name.' };
    }
    if (!profileData.department) {
        return { success: false, error: 'Please select your department.' };
    }
    if (!profileData.year) {
        return { success: false, error: 'Please select your year of study.' };
    }

    try {
        const regNo = user.email.split('.')[0];
        await setDoc(doc(db, 'users', user.uid), {
            username: profileData.username.trim(),
            studentId: regNo,
            year: profileData.year,
            department: profileData.department,
            email: user.email,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Re-fetch and re-render to guarantee UI reflects saved data
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
            renderDashboard(snap.data(), user);
            populateProfileModal(snap.data(), false);
        }

        return { success: true };
    } catch (err) {
        console.error('[auth] saveUserProfile error:', err);
        return { success: false, error: `Could not save profile: ${err.message}` };
    }
}

// ── Logout ────────────────────────────────────────────────────
export async function logoutUser() {
    try {
        await signOut(auth);
        sessionStorage.clear();
        window.location.reload();
    } catch (err) {
        console.error('[auth] Logout error:', err);
    }
}
