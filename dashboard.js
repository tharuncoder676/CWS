// ============================================================
//  dashboard.js — Dynamic dashboard rendering
//  Populates every UI element from Firestore users/{uid} data.
//  NO hardcoded values. All text comes from the user's profile.
// ============================================================

/**
 * Derives academic year label from registration number.
 * SIMATS reg numbers start with 2-digit join year, e.g. "221102..." → joined 2022
 */
function deriveAcademicYear(regNo) {
    if (!regNo || regNo.length < 2) return '';
    const joinYear = parseInt(regNo.substring(0, 2), 10);
    if (isNaN(joinYear)) return '';
    const currentYearShort = new Date().getFullYear() % 100;
    const diff = currentYearShort - joinYear + 1;
    const map = ['I', 'II', 'III', 'IV'];
    return (diff >= 1 && diff <= 4) ? map[diff - 1] : '';
}

/** Safely set element text, skip if element not found */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '--';
}

/**
 * isProfileComplete — returns false if any required field is missing/default
 */
export function isProfileComplete(userData) {
    return !!(
        userData &&
        userData.username &&
        userData.username !== userData.studentId &&   // not just fallback
        userData.department &&
        userData.year
    );
}

/**
 * renderDashboard — single function that populates the entire UI after login.
 * @param {Object} userData       — Firestore document data (users/{uid})
 * @param {Object} firebaseUser   — Firebase Auth user object
 */
export function renderDashboard(userData, firebaseUser) {
    if (!userData) return;

    const email = (userData.email || firebaseUser?.email || '').toLowerCase();
    const regNo = userData.studentId || email.split('.')[0] || '--';
    const name = userData.username || '';                         // Full name from profile
    const year = userData.year || deriveAcademicYear(regNo); // e.g. "IV"
    const dept = userData.department || '';                         // e.g. "CSE"

    // ── Dashboard hero card ─────────────────────────────────
    // "Welcome to CWS, <Name>"
    setText('dash-student-name', name || 'SIMATS Student');

    // "<regNo> | <IV Year> | <CSE>"
    setText('dash-reg-no', regNo);
    setText('dash-year', year ? `${year} Year` : '--');
    setText('dash-dept', dept || '--');

    // ── Top Nav — "Welcome, <regNo>" ───────────────────────
    setText('display-studentId', regNo);

    // ── Profile Widget ─────────────────────────────────────
    // Name line: "Arjun Kumar" (or reg number if no name yet)
    setText('widget-name', name || regNo);

    // Meta line: "IV Year • CSE"
    const metaEl = document.getElementById('widget-meta');
    if (metaEl) {
        if (year && dept) {
            metaEl.textContent = `${year} Year • ${dept}`;
            metaEl.style.display = '';
        } else if (year) {
            metaEl.textContent = `${year} Year`;
            metaEl.style.display = '';
        } else if (dept) {
            metaEl.textContent = dept;
            metaEl.style.display = '';
        } else {
            metaEl.style.display = 'none';
        }
    }

    // ── Avatar initial ─────────────────────────────────────
    const displayStr = name || regNo;
    const initial = displayStr.charAt(0).toUpperCase();
    const avatar = document.querySelector('.avatar-circle');
    if (avatar) avatar.textContent = initial;

    // Cache in sessionStorage for resilience
    try {
        sessionStorage.setItem('cws_user', JSON.stringify({ name, regNo, year, dept }));
    } catch (_) { /* ignore QuotaExceeded */ }
}

/**
 * populateProfileModal — pre-fills the Edit Profile form with current data.
 * @param {Object} userData
 * @param {boolean} isMandatory  — if true, configure modal as first-time setup
 */
export function populateProfileModal(userData, isMandatory = false) {
    if (!userData) return;

    const nameInp = document.getElementById('prof-name');
    const deptSel = document.getElementById('prof-dept');
    const yearSel = document.getElementById('prof-year');

    // Only pre-fill if the value is meaningful (not the reg-number fallback)
    const fillName = (userData.username && userData.username !== userData.studentId)
        ? userData.username : '';

    if (nameInp) nameInp.value = fillName;
    if (deptSel) deptSel.value = userData.department || '';
    if (yearSel) yearSel.value = userData.year || '';

    // Adjust modal UI for first-time vs edit mode
    const title = document.getElementById('prof-modal-title');
    const desc = document.getElementById('prof-modal-desc');
    const notice = document.getElementById('prof-first-notice');
    const cancelBtn = document.getElementById('prof-cancel-btn');
    const saveBtn = document.getElementById('prof-save-btn');
    const modal = document.getElementById('profile-modal');

    if (isMandatory) {
        if (title) title.textContent = 'Set Up Your Profile';
        if (desc) desc.textContent = 'Required once — shown on your dashboard & reports';
        if (notice) notice.style.display = 'flex';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (saveBtn) saveBtn.textContent = 'Save & Continue →';
        if (modal) modal.setAttribute('data-mandatory', 'true');
    } else {
        if (title) title.textContent = 'Edit Profile';
        if (desc) desc.textContent = 'Update your name, department or year';
        if (notice) notice.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'block';
        if (saveBtn) saveBtn.textContent = 'Save Changes';
        if (modal) modal.setAttribute('data-mandatory', 'false');
    }
}
