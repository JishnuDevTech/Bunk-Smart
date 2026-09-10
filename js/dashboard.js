// ===== DASHBOARD.JS =====
import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { onAuthStateChanged, updateProfile, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

const CALENDAR_API_BASE = localStorage.getItem('bunkSmartCalendarApi') || '/.netlify/functions';
const calendarEndpoint = action => CALENDAR_API_BASE.includes('/.netlify/functions')
    ? `${CALENDAR_API_BASE}/google-${action}`
    : `${CALENDAR_API_BASE}/api/google/${action}`;

// DOM Elements
const userNameElement = document.getElementById('user-name');
const userEmailElement = document.getElementById('user-email');
const userInitialElement = document.getElementById('user-initial');
const signoutBtn = document.getElementById('signout-btn');
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');

// Calendar Elements
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const currentMonthElement = document.getElementById('current-month');
const calendarGrid = document.getElementById('calendar-grid');

// Modal Elements
const attendanceModal = document.getElementById('attendance-modal');
const modalClose = document.getElementById('modal-close');
const selectedDateElement = document.getElementById('selected-date');
const markPresentBtn = document.getElementById('mark-present');
const markBunkBtn = document.getElementById('mark-bunk');
const markHolidayBtn = document.getElementById('mark-holiday');
const bunkDetails = document.getElementById('bunk-details');
const holidayDetails = document.getElementById('holiday-details');
const holidayTitleInput = document.getElementById('holiday-title');
const bunkActivityInput = document.getElementById('bunk-activity');
const bunkMissedInput = document.getElementById('bunk-missed');
const saveAttendanceBtn = document.getElementById('save-attendance');
const clearAttendanceBtn = document.getElementById('clear-attendance');

// Stats Elements
const attendanceRateElement = document.getElementById('attendance-rate');
const presentDaysElement = document.getElementById('present-days');
const bunkDaysElement = document.getElementById('bunk-days');
const streakElement = document.getElementById('streak');

// Current state
let currentDate = new Date();
let selectedDate = null;
let attendanceData = {};
let challengesData = {};
let subjectsData = {};
let timetableData = [];
let holidayForecastData = [];
let currentUser = null;
let userSettings = { language: 'en', timezone: 'Asia/Kolkata', sessionTimeout: '60', autoBackup: true, backupFrequency: 'weekly' };
let sessionTimer;

// ─── TOAST NOTIFICATION SYSTEM ───────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const icon = icons[type] || icons.success;

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('toast-show'));
    });

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initDashboard() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            updateUserInfo(user);
            loadUserData();
        } else if (!localStorage.getItem('loggedInUser')) {
            window.location.href = 'login.html';
        }
    });
    setupNavigation();
    setupCalendar();
    setupModal();
    setupSettings();
    setupTodayCommand();
    setupSubjects();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function updateUserInfo(user) {
    const displayName = user.displayName || user.email.split('@')[0];
    const email = user.email;
    const initial = displayName.charAt(0).toUpperCase();
    if (userNameElement) userNameElement.textContent = displayName;
    if (userEmailElement) userEmailElement.textContent = email;
    if (userInitialElement) userInitialElement.textContent = initial;
}

async function loadUserData() {
    showLoading();
    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', auth.currentUser.uid), {
                attendance: {}, challenges: {}, subjects: {}, timetable: [], settings: {}
            });
            attendanceData = {};
            challengesData = {};
        } else {
            const data = userDoc.data();
            attendanceData = data.attendance || {};
            challengesData = data.challenges || {};
            subjectsData = data.subjects || {};
            timetableData = data.timetable || [];
        }
        updateStats();
        renderCalendar();
        loadInsights();
        renderChallenges();
        loadSettings();
        renderSmartInsights();
        renderTodayCommand();
        renderSubjects();
        renderTimetable();
        renderHolidayForecast();
        if (new URLSearchParams(window.location.search).get('calendar') === 'connected') syncGoogleCalendarEvents();
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading data. Please refresh.', 'error');
    } finally {
        hideLoading();
    }
}

function setupTodayCommand() {
    document.getElementById('today-present')?.addEventListener('click', () => markToday('present'));
    document.getElementById('today-bunk')?.addEventListener('click', () => markToday('bunked'));
    document.getElementById('today-holiday')?.addEventListener('click', () => {
        const title = window.prompt('Holiday title', 'College holiday');
        if (title) markToday('holiday', title);
    });
    document.getElementById('today-clear')?.addEventListener('click', () => clearToday());
}

function todayKey() { return formatDate(new Date()); }

function renderTodayCommand() {
    const date = new Date();
    const record = attendanceData[todayKey()];
    const dateElement = document.getElementById('today-date');
    const statusElement = document.getElementById('today-status');
    if (dateElement) dateElement.textContent = formatUserDate(date, { weekday: 'long', month: 'long', day: 'numeric' });
    if (statusElement) statusElement.textContent = record ? `${record.status === 'holiday' ? 'Holiday: ' + record.title : record.status[0].toUpperCase() + record.status.slice(1)} recorded.` : 'Your attendance status is unmarked.';
    document.querySelectorAll('.today-actions button').forEach(button => { button.disabled = false; });
}

async function markToday(status, title = '') {
    const key = todayKey();
    const record = { date: `${key}T00:00:00.000Z`, status };
    if (status === 'holiday') record.title = title || 'Holiday';
    await persistAttendanceRecord(key, record);
    renderTodayCommand();
}

async function clearToday() {
    selectedDate = new Date();
    await clearAttendance();
    renderTodayCommand();
}

function setupSubjects() {
    document.getElementById('add-subject')?.addEventListener('click', async () => {
        const name = window.prompt('Subject name');
        if (!name?.trim()) return;
        const target = Number(window.prompt('Required attendance percentage', '75')) || 75;
        const id = `subject_${Date.now()}`;
        subjectsData[id] = { name: name.trim(), target: Math.min(100, Math.max(1, target)), present: 0, total: 0 };
        await saveProductData('subjects', subjectsData);
        renderSubjects();
    });
    document.getElementById('add-class')?.addEventListener('click', async () => {
        const subject = window.prompt('Subject name for this class');
        if (!subject?.trim()) return;
        const day = window.prompt('Day (Monday-Sunday)', 'Monday');
        const time = window.prompt('Time (e.g. 09:00)', '09:00');
        timetableData.push({ id: `class_${Date.now()}`, subject: subject.trim(), day: day || 'Monday', time: time || '09:00' });
        await saveProductData('timetable', timetableData);
        renderTimetable();
    });
}

async function saveProductData(key, value) {
    if (!auth.currentUser) return;
    try { await updateDoc(doc(db, 'users', auth.currentUser.uid), { [key]: value }); }
    catch { await setDoc(doc(db, 'users', auth.currentUser.uid), { [key]: value }, { merge: true }); }
}

function subjectMetrics(subject) {
    const records = Object.values(subject.attendance || {});
    const present = records.filter(record => record.status === 'present').length;
    const total = records.filter(record => ['present', 'bunked'].includes(record.status)).length;
    return { present, total, rate: total ? Math.round(present / total * 100) : 0 };
}

function renderSubjects() {
    const container = document.getElementById('subjects-list');
    if (!container) return;
    const entries = Object.entries(subjectsData);
    if (!entries.length) { container.innerHTML = '<div class="empty-product-state"><strong>No subjects yet</strong><span>Add your first subject to unlock subject-level attendance planning.</span></div>'; return; }
    container.innerHTML = entries.map(([id, subject]) => {
        const metrics = subjectMetrics(subject);
        const target = subject.target || 75;
        const safeBunks = metrics.present ? Math.max(0, Math.floor(metrics.present / (target / 100) - metrics.total)) : 0;
        return `<article class="subject-card"><div class="subject-card-top"><div><h3>${subject.name}</h3><span>${metrics.present}/${metrics.total} classes tracked</span></div><strong>${metrics.rate}%</strong></div><div class="subject-progress"><span style="width:${Math.min(100, metrics.rate)}%"></span></div><div class="subject-card-foot"><span>Target ${target}%</span><span>${safeBunks} safe bunk${safeBunks === 1 ? '' : 's'}</span><button data-subject-status="present" data-subject-id="${id}">Present</button><button data-subject-status="bunked" data-subject-id="${id}">Bunk</button><button data-delete-subject="${id}" aria-label="Delete ${subject.name}">×</button></div></article>`;
    }).join('');
    container.querySelectorAll('[data-delete-subject]').forEach(button => button.addEventListener('click', async () => { delete subjectsData[button.dataset.deleteSubject]; await saveProductData('subjects', subjectsData); renderSubjects(); }));
    container.querySelectorAll('[data-subject-status]').forEach(button => button.addEventListener('click', async () => {
        const subject = subjectsData[button.dataset.subjectId];
        subject.attendance = subject.attendance || {};
        const key = todayKey();
        subject.attendance[key] = { date: `${key}T00:00:00.000Z`, status: button.dataset.subjectStatus };
        await saveProductData('subjects', subjectsData);
        renderSubjects();
    }));
}

function renderTimetable() {
    const container = document.getElementById('timetable-grid');
    if (!container) return;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    container.innerHTML = days.map(day => `<div class="timetable-day"><strong>${day}</strong>${timetableData.filter(item => item.day.toLowerCase() === day.toLowerCase()).sort((a, b) => a.time.localeCompare(b.time)).map(item => `<span><b>${item.time}</b>${item.subject}</span>`).join('') || '<em>No classes</em>'}</div>`).join('');
}

function renderHolidayForecast() {
    const container = document.getElementById('holiday-forecast');
    if (!container) return;
    const today = new Date();
    const recorded = Object.entries(attendanceData).filter(([key, record]) => record.status === 'holiday' && new Date(`${key}T00:00:00`) > today).map(([date, record]) => ({ date, title: record.title || 'Holiday' }));
    const upcoming = [...recorded, ...holidayForecastData.filter(item => !attendanceData[item.date])].sort((a, b) => a.date.localeCompare(b)).slice(0, 4);
    if (!upcoming.length) { container.hidden = true; return; }
    container.hidden = false;
    container.innerHTML = `<span class="forecast-label">UPCOMING</span>${upcoming.map(item => `<span class="forecast-item"><b>${formatUserDate(new Date(`${item.date}T00:00:00`), { month: 'short', day: 'numeric' })}</b>${item.title}<small>Locked until date</small></span>`).join('')}`;
}

function connectGoogleCalendar() {
    window.location.href = calendarEndpoint('login');
}

async function syncGoogleCalendarEvents() {
    try {
        const response = await fetch(calendarEndpoint('events'), { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        holidayForecastData = [...holidayForecastData, ...(data.events || []).filter(event => !holidayForecastData.some(item => item.date === event.date))];
        renderHolidayForecast();
        const status = document.getElementById('google-calendar-status');
        if (status) status.textContent = `${data.events?.length || 0} Google Calendar events synced. Recommendations remain optional.`;
    } catch {
        // Calendar connection is optional and should never block attendance.
    }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            contentSections.forEach(content => content.classList.remove('active'));
            const targetSection = document.getElementById(`${section}-section`);
            if (targetSection) targetSection.classList.add('active');

            // Close mobile sidebar
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('show');

            // Re-render chart on insights visit
            if (section === 'insights') setTimeout(renderAttendanceChart, 100);
        });
    });

    if (signoutBtn) {
        signoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            import('./guard.js').then(m => m.logoutUser());
        });
    }
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function setupCalendar() {
    prevMonthBtn?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCurrentMonth();
    });
    nextMonthBtn?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCurrentMonth();
    });
    renderCalendar();
}

function renderCurrentMonth() {
    updateStats();
    renderCalendar();
    renderBunkCards();
    renderAttendanceChart();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (currentMonthElement) {
        currentMonthElement.textContent = formatUserDate(new Date(year, month, 1), {
            month: 'long', year: 'numeric'
        });
    }

    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';

    const weekStart = document.getElementById('start-week')?.value === 'monday' ? 1 : 0;
    const dayNames = Array.from({ length: 7 }, (_, index) => {
        const day = new Date(2026, 0, 4 + ((index + weekStart) % 7));
        return formatUserDate(day, { weekday: 'short' });
    });
    dayNames.forEach(day => {
        const el = document.createElement('div');
        el.className = 'day-name';
        el.textContent = day;
        calendarGrid.appendChild(el);
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const todayKey = formatDate(new Date());
    const currentDateIter = new Date(startDate);
    let dayCount = 0;

    while (currentDateIter <= lastDay || dayCount < 42) {
        const dayElement = document.createElement('div');
        dayElement.className = 'day-cell';
        dayElement.textContent = currentDateIter.getDate();

        const dateKey = formatDate(currentDateIter);
        const isCurrentMonth = currentDateIter.getMonth() === month;

        if (!isCurrentMonth) {
            dayElement.classList.add('inactive');
        } else {
            const att = attendanceData[dateKey];
            if (att) {
                if (att.status === 'present') dayElement.classList.add('present');
                else if (att.status === 'bunked') dayElement.classList.add('bunked');
                else if (att.status === 'holiday') {
                    dayElement.classList.add('holiday');
                    dayElement.title = att.title || 'Holiday';
                }
            }
            if (dateKey === todayKey) dayElement.classList.add('today');

            const dateCopy = new Date(currentDateIter);
            if (dateCopy <= new Date()) {
                dayElement.addEventListener('click', () => openAttendanceModal(dateCopy));
            } else {
                dayElement.classList.add('locked');
                dayElement.title = 'Future dates are locked';
            }
        }

        calendarGrid.appendChild(dayElement);
        currentDateIter.setDate(currentDateIter.getDate() + 1);
        dayCount++;
    }
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function setupModal() {
    modalClose?.addEventListener('click', closeAttendanceModal);
    attendanceModal?.addEventListener('click', (e) => {
        if (e.target === attendanceModal) closeAttendanceModal();
    });

    markPresentBtn?.addEventListener('click', () => {
        // Present: save immediately and close — no extra button needed
        markPresentBtn.classList.add('selected');
        markBunkBtn.classList.remove('selected');
        markHolidayBtn?.classList.remove('selected');
        bunkDetails.hidden = true;
        if (holidayDetails) holidayDetails.hidden = true;
        if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;
        saveAttendanceImmediate('present');
    });

    markBunkBtn?.addEventListener('click', () => {
        // Bunk: save immediately, just like Present
        markBunkBtn.classList.add('selected');
        markPresentBtn.classList.remove('selected');
        markHolidayBtn?.classList.remove('selected');
        if (holidayDetails) holidayDetails.hidden = true;
        bunkDetails.hidden = true;
        if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;
        saveAttendanceImmediate('bunked');
    });

    markHolidayBtn?.addEventListener('click', () => {
        markHolidayBtn.classList.add('selected');
        markPresentBtn.classList.remove('selected');
        markBunkBtn.classList.remove('selected');
        bunkDetails.hidden = true;
        if (holidayDetails) holidayDetails.hidden = false;
        if (saveAttendanceBtn) saveAttendanceBtn.hidden = false;
    });

    saveAttendanceBtn?.addEventListener('click', saveAttendance);
    clearAttendanceBtn?.addEventListener('click', clearAttendance);
}

function openAttendanceModal(date) {
    if (date > new Date()) return;
    selectedDate = date;
    if (selectedDateElement) {
        selectedDateElement.textContent = formatUserDate(date, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    const dateKey = formatDate(date);
    const existing = attendanceData[dateKey];

    markPresentBtn.classList.remove('selected');
    markBunkBtn.classList.remove('selected');
    markHolidayBtn?.classList.remove('selected');
    bunkDetails.hidden = true;
    if (holidayDetails) holidayDetails.hidden = true;
    if (bunkActivityInput) bunkActivityInput.value = '';
    if (bunkMissedInput) bunkMissedInput.value = '';
    if (holidayTitleInput) holidayTitleInput.value = '';
    // Save button is only needed for a holiday title.
    if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;
    if (clearAttendanceBtn) clearAttendanceBtn.hidden = !existing;

    if (existing) {
        if (existing.status === 'present') {
            markPresentBtn.classList.add('selected');
            // Already present — just show state, no save button
            if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;
        } else if (existing.status === 'bunked') {
            markBunkBtn.classList.add('selected');
            bunkDetails.hidden = true;
            if (bunkActivityInput) bunkActivityInput.value = existing.activity || '';
            if (bunkMissedInput) bunkMissedInput.value = existing.missed || '';
            if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;
        } else if (existing.status === 'holiday') {
            markHolidayBtn?.classList.add('selected');
            if (holidayDetails) holidayDetails.hidden = false;
            if (holidayTitleInput) holidayTitleInput.value = existing.title || '';
            if (saveAttendanceBtn) saveAttendanceBtn.hidden = false;
        }
    }

    if (!existing) {
        const defaultAttendance = document.getElementById('default-attendance')?.value;
        if (defaultAttendance === 'present' || defaultAttendance === 'bunked') {
            attendanceModal.hidden = false;
            if (defaultAttendance === 'present') markPresentBtn?.click();
            else markBunkBtn?.click();
            return;
        }
    }

    attendanceModal.hidden = false;
}

function closeAttendanceModal() {
    attendanceModal.hidden = true;
    selectedDate = null;
}

// Called immediately when Present is clicked — no save button needed
async function saveAttendanceImmediate(status) {
    if (!selectedDate || !auth.currentUser) return;
    if (selectedDate > new Date()) {
        showToast('Future dates are locked.', 'warning');
        return;
    }

    const dateKey = formatDate(selectedDate);
    const record = {
        date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString(),
        status: status
    };

    // Close modal instantly for snappy UX
    closeAttendanceModal();

    // Optimistic update
    attendanceData[dateKey] = record;
    renderCurrentMonth();
    const statusLabel = status === 'present' ? '✅ Present' : '❌ Bunked';
    showToast(`${statusLabel} marked for ${dateKey}`, status === 'present' ? 'success' : 'info');

    try {
        const ref = doc(db, 'users', auth.currentUser.uid);
        try {
            await updateDoc(ref, { [`attendance.${dateKey}`]: record });
        } catch (e) {
            await setDoc(ref, { attendance: { [dateKey]: record } }, { merge: true });
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        showToast('Error saving. Please try again.', 'error');
    }
}

async function clearAttendance() {
    if (!selectedDate || !auth.currentUser) return;
    const dateKey = formatDate(selectedDate);
    const existing = attendanceData[dateKey];
    if (!existing) {
        closeAttendanceModal();
        return;
    }
    closeAttendanceModal();
    delete attendanceData[dateKey];
    renderCurrentMonth();
    showToast(`↩️ ${dateKey} returned to unmarked`, 'info');
    try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            [`attendance.${dateKey}`]: deleteField()
        });
    } catch (error) {
        console.error('Error clearing attendance:', error);
        showToast('Could not clear this attendance record.', 'error');
    }
}

async function saveAttendance() {
    if (!selectedDate || !auth.currentUser) return;
    if (selectedDate > new Date()) {
        showToast('Future dates are locked.', 'warning');
        return;
    }

    const isBunked = markBunkBtn.classList.contains('selected');
    const isPresent = markPresentBtn.classList.contains('selected');
    const isHoliday = markHolidayBtn?.classList.contains('selected');

    if (!isPresent && !isBunked && !isHoliday) {
        showToast('Choose Present, Bunked, or Holiday first.', 'warning');
        return;
    }

    const dateKey = formatDate(selectedDate);
    const status = isPresent ? 'present' : isBunked ? 'bunked' : 'holiday';

    let record = {
        date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString(),
        status: status
    };

    if (status === 'bunked') {
        record.activity = bunkActivityInput?.value || '';
        record.missed = bunkMissedInput?.value || '';
    }
    if (status === 'holiday') record.title = holidayTitleInput?.value.trim() || 'Holiday';

    // Optimistic update
    attendanceData[dateKey] = record;
    closeAttendanceModal();
    renderCurrentMonth();

    const statusLabel = status === 'present' ? '✅ Present' : status === 'bunked' ? '❌ Bunked' : '🏖️ Holiday';
    showToast(`${statusLabel} marked for ${dateKey}`, status === 'present' ? 'success' : 'info');

    try {
        const ref = doc(db, 'users', auth.currentUser.uid);
        try {
            await updateDoc(ref, { [`attendance.${dateKey}`]: record });
        } catch (e) {
            await setDoc(ref, { attendance: { [dateKey]: record } }, { merge: true });
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        showToast('Error saving attendance. Please try again.', 'error');
    }
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function updateStats() {
    const metrics = getMonthMetrics(currentDate.getFullYear(), currentDate.getMonth());
    const { presentCount, bunkCount, attendanceRate, currentStreak } = metrics;

    if (attendanceRateElement) attendanceRateElement.textContent = `${attendanceRate}%`;
    if (presentDaysElement) presentDaysElement.textContent = presentCount;
    if (bunkDaysElement) bunkDaysElement.textContent = bunkCount;
    if (streakElement) streakElement.textContent = currentStreak;

    const monthlyPresentEl = document.getElementById('monthly-present');
    const monthlyBunkEl = document.getElementById('monthly-bunk');
    const monthlyRateEl = document.getElementById('monthly-rate');
    if (monthlyPresentEl) monthlyPresentEl.textContent = presentCount;
    if (monthlyBunkEl) monthlyBunkEl.textContent = bunkCount;
    if (monthlyRateEl) monthlyRateEl.textContent = `${attendanceRate}%`;
}

function getMonthMetrics(year, month) {
    const entries = Object.entries(attendanceData)
        .filter(([dateKey, att]) => {
            const date = new Date(`${dateKey}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
        })
        .sort(([a], [b]) => a.localeCompare(b));
    const presentCount = entries.filter(([, att]) => att.status === 'present').length;
    const bunkCount = entries.filter(([, att]) => att.status === 'bunked').length;
    const attendanceRate = presentCount + bunkCount > 0
        ? Math.round((presentCount / (presentCount + bunkCount)) * 100) : 0;
    let currentStreak = 0;
    for (let i = entries.length - 1; i >= 0 && entries[i][1].status === 'present'; i--) currentStreak++;
    return { presentCount, bunkCount, attendanceRate, currentStreak };
}

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────
let attendanceChart;

function loadInsights() {
    renderBunkCards();
    renderAttendanceChart();
    setupExportButtons();
}

function renderBunkCards() {
    const container = document.getElementById('bunk-cards');
    if (!container) return;
    container.innerHTML = '';

    const bunkEntries = Object.keys(attendanceData)
        .filter(k => attendanceData[k].status === 'bunked' && new Date(`${k}T00:00:00`).getFullYear() === currentDate.getFullYear() && new Date(`${k}T00:00:00`).getMonth() === currentDate.getMonth())
        .sort((a, b) => b.localeCompare(a));

    if (bunkEntries.length === 0) {
        container.innerHTML = `
            <div class="bunk-empty">
                <div class="bunk-empty-icon">🎉</div>
                <h4>No bunks yet!</h4>
                <p>Keep up the great work. Your attendance record is clean!</p>
            </div>`;
        return;
    }

    bunkEntries.forEach(dateKey => {
        const att = attendanceData[dateKey];
        const card = document.createElement('div');
        card.className = 'bunk-card';
        card.innerHTML = `
            <p class="date">📅 ${dateKey}</p>
            <p class="did">${att.activity || 'Did something productive'}</p>
            <p class="missed">${att.missed || 'Missed lecture/class'}</p>
        `;
        container.appendChild(card);
    });
}

function renderAttendanceChart() {
    const ctx = document.getElementById('attendance-chart');
    if (!ctx) return;

    const monthlyData = {};
    Object.keys(attendanceData).forEach(dateKey => {
        const date = new Date(`${dateKey}T00:00:00`);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { present: 0, bunk: 0, total: 0 };
        if (attendanceData[dateKey].status === 'present') {
            monthlyData[monthKey].present++;
            monthlyData[monthKey].total++;
        } else if (attendanceData[dateKey].status === 'bunked') {
            monthlyData[monthKey].bunk++;
            monthlyData[monthKey].total++;
        }
    });

    const labels = Object.keys(monthlyData).sort();
    const presentData = labels.map(m => monthlyData[m].total > 0 ? Math.round((monthlyData[m].present / monthlyData[m].total) * 100) : 0);
    const bunkData = labels.map(m => monthlyData[m].total > 0 ? Math.round((monthlyData[m].bunk / monthlyData[m].total) * 100) : 0);

    const finalLabels = labels.length > 0 ? labels : [`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`];
    const finalPresent = presentData.length > 0 ? presentData : [0];
    const finalBunk = bunkData.length > 0 ? bunkData : [0];

    if (attendanceChart) attendanceChart.destroy();

    const mutedColor = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#6b7280';

    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: finalLabels,
            datasets: [
                {
                    label: 'Present %',
                    data: finalPresent,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderWidth: 3,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    borderRadius: 5,
                    barPercentage: 0.72,
                    categoryPercentage: 0.62
                },
                {
                    label: 'Bunk %',
                    data: finalBunk,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderWidth: 3,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    borderRadius: 5,
                    barPercentage: 0.72,
                    categoryPercentage: 0.62
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
                    ticks: {
                        callback: v => v + '%',
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: mutedColor,
                        stepSize: 25
                    },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: mutedColor
                    },
                    border: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleColor: '#f9fafb',
                    bodyColor: '#d1d5db',
                    padding: 12,
                    cornerRadius: 8,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`
                    }
                }
            }
        }
    });
}

function setupExportButtons() {
    const csvBtn = document.getElementById('export-csv');
    const pdfBtn = document.getElementById('export-pdf');
    if (csvBtn) csvBtn.onclick = exportToCSV;
    if (pdfBtn) pdfBtn.onclick = exportToPDF;
}

function exportToCSV() {
    if (Object.keys(attendanceData).length === 0) {
        showToast('No data to export.', 'warning'); return;
    }
    let csv = 'Date,Status,Activity,Missed\n';
    Object.keys(attendanceData).sort().forEach(dateKey => {
        const att = attendanceData[dateKey];
        csv += `${dateKey},"${att.status}","${att.activity || ''}","${att.missed || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bunk-smart-attendance.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('📥 CSV exported successfully!', 'success');
}

function exportToPDF() {
    if (Object.keys(attendanceData).length === 0) {
        showToast('No data to export.', 'warning'); return;
    }
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const pageHeight = docPdf.internal.pageSize.getHeight();
    const metrics = getMonthMetrics(currentDate.getFullYear(), currentDate.getMonth());
    docPdf.setFillColor(15, 60, 174);
    docPdf.rect(0, 0, pageWidth, 34, 'F');
    docPdf.setFillColor(52, 211, 153);
    docPdf.roundedRect(18, 9, 16, 16, 3, 3, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(20);
    docPdf.setFont(undefined, 'bold');
    docPdf.text('Bunk Smart', 42, 20);
    docPdf.setFontSize(9);
    docPdf.setFont(undefined, 'normal');
    docPdf.text('Attendance report', 42, 27);
    docPdf.setTextColor(17, 24, 39);
    docPdf.setFontSize(15);
    docPdf.setFont(undefined, 'bold');
    docPdf.text(formatUserDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), { month: 'long', year: 'numeric' }), 18, 49);
    docPdf.setFontSize(10);
    docPdf.setFont(undefined, 'normal');
    docPdf.setTextColor(107, 114, 128);
    docPdf.text(`Generated ${formatUserDate(new Date(), { dateStyle: 'medium' })}`, 18, 57);
    const summary = [['Attendance rate', `${metrics.attendanceRate}%`], ['Present days', `${metrics.presentCount}`], ['Bunk days', `${metrics.bunkCount}`], ['Day streak', `${metrics.currentStreak}`]];
    summary.forEach(([label, value], index) => {
        const x = 18 + (index % 2) * 88;
        const y = 70 + Math.floor(index / 2) * 25;
        docPdf.setFillColor(241, 245, 249);
        docPdf.roundedRect(x, y, 78, 18, 2, 2, 'F');
        docPdf.setTextColor(37, 99, 235);
        docPdf.setFontSize(13);
        docPdf.setFont(undefined, 'bold');
        docPdf.text(value, x + 5, y + 8);
        docPdf.setTextColor(107, 114, 128);
        docPdf.setFontSize(8);
        docPdf.setFont(undefined, 'normal');
        docPdf.text(label, x + 5, y + 14);
    });
    let y = 128;
    docPdf.setTextColor(17, 24, 39);
    docPdf.setFontSize(11);
    docPdf.setFont(undefined, 'bold');
    docPdf.text('Daily record', 18, y);
    y += 8;
    Object.keys(attendanceData).sort().forEach(dateKey => {
        const att = attendanceData[dateKey];
        if (y > pageHeight - 22) { docPdf.addPage(); y = 22; }
        docPdf.setFillColor(att.status === 'present' ? 220 : att.status === 'bunked' ? 254 : 254, att.status === 'present' ? 252 : att.status === 'bunked' ? 226 : 243, att.status === 'present' ? 231 : att.status === 'bunked' ? 226 : 199);
        docPdf.roundedRect(18, y - 5, pageWidth - 36, 13, 2, 2, 'F');
        docPdf.setTextColor(17, 24, 39);
        docPdf.setFontSize(9);
        docPdf.setFont(undefined, 'normal');
        const label = att.status === 'holiday' ? `Holiday: ${att.title || 'Holiday'}` : att.status[0].toUpperCase() + att.status.slice(1);
        docPdf.text(`${dateKey}    ${label}`, 23, y + 3);
        y += 17;
    });
    docPdf.setTextColor(148, 163, 184);
    docPdf.setFontSize(8);
    docPdf.text('Bunk Smart | Owned and developed by Jishnu Rahegaonkar', 18, pageHeight - 10);
    docPdf.save('bunk-smart-attendance.pdf');
    showToast('📄 PDF exported successfully!', 'success');
}

// ─── CHALLENGES ───────────────────────────────────────────────────────────────
function getTotalDays(challengeId) {
    const totals = {
        '30_days_hard': 30, '60_days_hard': 60, '90_days_hard': 90,
        '7_day_streak': 7, 'no_bunk_week': 7, 'perfect_month': 30,
        '10_tasks_rage': 10, 'custom_challenge': 30
    };
    return totals[challengeId] || 30;
}

function formatDisplayDate(isoString) {
    if (!isoString) return '—';
    try {
        return formatUserDate(new Date(isoString), { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return '—'; }
}

function renderChallenges() {
    const challengeCards = document.querySelectorAll('.challenge-card');
    const todayKey = formatDate(new Date());

    challengeCards.forEach(card => {
        const challengeId = card.dataset.challenge;
        if (!challengeId) return;

        if (!challengesData[challengeId]) {
            challengesData[challengeId] = {
                progress: 0, active: false, completedDays: 0,
                totalDays: getTotalDays(challengeId), streak: 0,
                markedDates: []
            };
        }

        const challenge = challengesData[challengeId];
        if (!challenge.markedDates) challenge.markedDates = [];
        const totalDays = challenge.totalDays || getTotalDays(challengeId);
        const progressPercent = Math.min((challenge.completedDays / totalDays) * 100, 100);

        // Update progress bar
        const bar = document.getElementById(`bar-${challengeId}`);
        if (bar) bar.style.setProperty('--progress', progressPercent + '%');

        // Update progress text
        const progText = document.getElementById(`progress-${challengeId}`);
        if (progText) {
            if (challengeId === '10_tasks_rage') {
                progText.textContent = `Task ${challenge.completedDays}/${totalDays}`;
            } else if (challengeId === 'perfect_month') {
                const rate = calculateMonthlyRate();
                progText.textContent = `Attendance: ${rate}%`;
                if (bar) bar.style.setProperty('--progress', rate + '%');
            } else if (challengeId === 'custom_challenge') {
                progText.textContent = challenge.active ? `Day ${challenge.completedDays}/${totalDays}` : 'Setup Required';
            } else {
                progText.textContent = `Day ${challenge.completedDays}/${totalDays}`;
            }
        }

        // Start / check-in visibility
        const startBtn = document.getElementById(`start-${challengeId}`);
        const checkInBtn = document.getElementById(`checkin-${challengeId}`);
        const badgeEl = document.getElementById(`badge-${challengeId}`);

        const isCompleted = !challenge.active && challenge.completedDays > 0 && challenge.completedDays >= totalDays;
        const hasMarkedToday = challenge.markedDates && challenge.markedDates.includes(todayKey);

        if (isCompleted) {
            if (startBtn) { startBtn.hidden = false; startBtn.textContent = '🔄 Restart'; }
            if (checkInBtn) { checkInBtn.hidden = true; }
            if (badgeEl) badgeEl.hidden = false;
        } else if (challenge.active) {
            if (startBtn) startBtn.hidden = true;
            if (checkInBtn) {
                checkInBtn.hidden = false;
                if (hasMarkedToday) {
                    checkInBtn.textContent = '✔ Marked Today';
                    checkInBtn.disabled = true;
                    checkInBtn.classList.add('marked-today');
                } else {
                    checkInBtn.textContent = challengeId === '10_tasks_rage' ? '✅ Complete Task' : '✅ Mark Today';
                    checkInBtn.disabled = false;
                    checkInBtn.classList.remove('marked-today');
                }
            }
        } else {
            if (startBtn) {
                startBtn.hidden = false;
                startBtn.textContent = challengeId === 'custom_challenge' ? '✏️ Customize & Start' : '🚀 Start Challenge';
            }
            if (checkInBtn) checkInBtn.hidden = true;
        }

        // Update detail panel info
        const startDateEl = document.getElementById(`start-date-${challengeId}`);
        if (startDateEl) startDateEl.textContent = formatDisplayDate(challenge.startDate);

        const completedEl = document.getElementById(`completed-${challengeId}`);
        if (completedEl) completedEl.textContent = `${challenge.completedDays} / ${totalDays}`;

        const todayStatusEl = document.getElementById(`today-status-${challengeId}`);
        if (todayStatusEl) {
            todayStatusEl.textContent = hasMarkedToday ? '✔ Done' : (challenge.active ? '⏳ Not yet' : '—');
        }

        // Marked days mini grid
        const markedGrid = document.getElementById(`marked-grid-${challengeId}`);
        if (markedGrid && challenge.markedDates && challenge.markedDates.length > 0) {
            markedGrid.innerHTML = '<p class="marked-grid-label">📅 Marked Dates:</p>';
            challenge.markedDates.slice(-20).forEach(d => {
                const chip = document.createElement('span');
                chip.className = 'date-chip';
                chip.textContent = d;
                markedGrid.appendChild(chip);
            });
        }

        // Custom challenge active info
        if (challengeId === 'custom_challenge') {
            const setupForm = document.getElementById('custom-setup-form');
            const activeInfo = document.getElementById('custom-active-info');
            if (challenge.active && challenge.name) {
                if (setupForm) setupForm.style.display = 'none';
                if (activeInfo) activeInfo.style.display = 'block';
                const catDisplay = document.getElementById('custom-cat-display');
                const goalDisplay = document.getElementById('custom-goal-display');
                if (catDisplay) catDisplay.textContent = challenge.category || '—';
                if (goalDisplay) goalDisplay.textContent = challenge.dailyGoal || '—';
                // Update custom card title
                const titleEl = document.getElementById('custom-challenge-title');
                const descEl = document.getElementById('custom-challenge-desc');
                if (titleEl && challenge.name) titleEl.textContent = challenge.name;
                if (descEl && challenge.description) descEl.textContent = challenge.description;
            } else if (!challenge.active) {
                if (setupForm) setupForm.style.display = 'block';
                if (activeInfo) activeInfo.style.display = 'none';
            }
        }

        // Attach event handlers
        const startEl = document.getElementById(`start-${challengeId}`);
        if (startEl) {
            startEl.onclick = () => handleStartChallenge(challengeId);
        }

        const checkInEl = document.getElementById(`checkin-${challengeId}`);
        if (checkInEl) {
            checkInEl.onclick = () => handleCheckIn(challengeId);
        }
    });

    // Custom challenge modal buttons
    const createCustomBtn = document.getElementById('create-custom-challenge');
    if (createCustomBtn) createCustomBtn.onclick = handleCreateCustomChallenge;

    const closeCustomBtn = document.getElementById('close-custom-modal');
    if (closeCustomBtn) closeCustomBtn.onclick = closeCustomChallengeModal;

    const modalOverlay = document.getElementById('custom-challenge-modal');
    if (modalOverlay) {
        modalOverlay.onclick = function(e) {
            if (e.target === modalOverlay) closeCustomChallengeModal();
        };
    }

    // Reset custom challenge
    const resetCustomBtn = document.getElementById('reset-custom-challenge');
    if (resetCustomBtn) resetCustomBtn.onclick = handleResetCustomChallenge;
}

async function handleStartChallenge(challengeId) {
    if (!auth.currentUser) return;

    // Custom challenge: open floating modal
    if (challengeId === 'custom_challenge') {
        openCustomChallengeModal();
        return;
    }

    const existing = challengesData[challengeId] || {};
    const isRestart = !existing.active && existing.completedDays >= (existing.totalDays || getTotalDays(challengeId));

    challengesData[challengeId] = {
        active: true,
        startDate: new Date().toISOString(),
        completedDays: 0,
        totalDays: getTotalDays(challengeId),
        streak: 0,
        markedDates: []
    };

    await saveChallenges();
    renderChallenges();
    showToast(`🚀 ${isRestart ? 'Restarted' : 'Started'} challenge! Mark today to begin.`, 'success');
}

async function handleCheckIn(challengeId) {
    if (!auth.currentUser) return;

    const challenge = challengesData[challengeId];
    if (!challenge || !challenge.active) return;

    const todayKey = formatDate(new Date());
    if (!challenge.markedDates) challenge.markedDates = [];

    // Prevent double-marking today
    if (challenge.markedDates.includes(todayKey)) {
        showToast('Already marked today! Come back tomorrow. 💪', 'info');
        return;
    }

    // For attendance-based challenges, check attendance
    const attendanceBased = ['30_days_hard', '60_days_hard', '90_days_hard', '7_day_streak', 'no_bunk_week'];
    if (attendanceBased.includes(challengeId)) {
        const todayAtt = attendanceData[todayKey];
        if (!todayAtt || todayAtt.status !== 'present') {
            showToast('⚠️ Mark today as Present in Attendance first!', 'warning');
            return;
        }
    }

    // For no_bunk_week, check no bunks in past 7 days
    if (challengeId === 'no_bunk_week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const hasBunk = Object.keys(attendanceData).some(k => {
            return attendanceData[k].status === 'bunked' && new Date(k) >= sevenDaysAgo;
        });
        if (hasBunk) {
            challenge.streak = 0;
            challenge.completedDays = 0;
            showToast('❌ Bunk detected in last 7 days. Streak reset!', 'error');
            await saveChallenges();
            renderChallenges();
            return;
        }
    }

    challenge.completedDays = Math.min(challenge.completedDays + 1, challenge.totalDays);
    challenge.streak = (challenge.streak || 0) + 1;
    challenge.markedDates.push(todayKey);

    if (challenge.completedDays >= challenge.totalDays) {
        challenge.active = false;
        showToast(`🏆 Challenge COMPLETED! You are unstoppable! 🎉`, 'success', 5000);
    } else {
        const remaining = challenge.totalDays - challenge.completedDays;
        showToast(`✅ Day ${challenge.completedDays}/${challenge.totalDays} done! ${remaining} days to go. Keep going! 🔥`, 'success');
    }

    await saveChallenges();
    renderChallenges();
}

function openCustomChallengeModal() {
    // If already active, open the details panel to show info
    const ch = challengesData['custom_challenge'];
    if (ch && ch.active && ch.name) {
        const panel = document.getElementById('details-custom_challenge');
        const icon  = document.getElementById('expand-custom_challenge');
        if (panel) panel.hidden = false;
        if (icon) icon.textContent = '▲';
        return;
    }
    // Otherwise open floating modal
    const modal = document.getElementById('custom-challenge-modal');
    if (modal) modal.hidden = false;
    // Reset form
    ['custom-name','custom-description','custom-daily-goal'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const dEl = document.getElementById('custom-days'); if (dEl) dEl.value = '21';
    const cEl = document.getElementById('custom-category'); if (cEl) cEl.value = 'attendance';
}

function closeCustomChallengeModal() {
    const modal = document.getElementById('custom-challenge-modal');
    if (modal) modal.hidden = true;
}

async function handleCreateCustomChallenge() {
    const name      = document.getElementById('custom-name')?.value?.trim();
    const category  = document.getElementById('custom-category')?.value;
    const days      = parseInt(document.getElementById('custom-days')?.value);
    const description = document.getElementById('custom-description')?.value?.trim();
    const dailyGoal = document.getElementById('custom-daily-goal')?.value?.trim();

    if (!name) { showToast('Please enter a challenge name.', 'warning'); return; }
    if (!days || days < 1) { showToast('Please enter valid number of days.', 'warning'); return; }

    challengesData['custom_challenge'] = {
        active: true, name, category,
        description: description || `${days}-day ${name} challenge`,
        dailyGoal, startDate: new Date().toISOString(),
        completedDays: 0, totalDays: days, streak: 0, markedDates: []
    };

    closeCustomChallengeModal();
    await saveChallenges();
    renderChallenges();
    showToast(`🎨 "${name}" challenge created! Let's go!`, 'success');
}

async function handleResetCustomChallenge() {
    if (!confirm('Reset this custom challenge? Your progress will be lost.')) return;
    challengesData['custom_challenge'] = {
        active: false, completedDays: 0, totalDays: 30, streak: 0, markedDates: []
    };
    const titleEl = document.getElementById('custom-challenge-title');
    const descEl = document.getElementById('custom-challenge-desc');
    if (titleEl) titleEl.textContent = 'Custom Challenge';
    if (descEl) descEl.textContent = 'Create your own personal goal.';
    const progressText = document.getElementById('progress-custom_challenge');
    if (progressText) progressText.textContent = 'Setup Required';

    // Clear inputs
    ['custom-name', 'custom-description', 'custom-daily-goal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const daysInput = document.getElementById('custom-days');
    if (daysInput) daysInput.value = '21';

    await saveChallenges();
    renderChallenges();
    showToast('Custom challenge reset. Configure a new one!', 'info');
}

async function saveChallenges() {
    if (!auth.currentUser) return;
    try {
        const ref = doc(db, 'users', auth.currentUser.uid);
        try {
            await updateDoc(ref, { challenges: challengesData });
        } catch (e) {
            await setDoc(ref, { challenges: challengesData }, { merge: true });
        }
    } catch (error) {
        console.error('Error saving challenges:', error);
        showToast('Error saving challenge progress.', 'error');
    }
}

function calculateMonthlyRate() {
    const m = new Date().getMonth(), y = new Date().getFullYear();
    let present = 0, total = 0;
    Object.values(attendanceData).forEach(att => {
        const d = new Date(att.date || '');
        if (d.getMonth() === m && d.getFullYear() === y) {
            total++;
            if (att.status === 'present') present++;
        }
    });
    return total > 0 ? Math.round((present / total) * 100) : 0;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function setupSettings() {
    // Display name save button
    const saveDisplayNameBtn = document.getElementById('save-display-name');
    if (saveDisplayNameBtn) {
        saveDisplayNameBtn.addEventListener('click', async () => {
            const displayNameInput = document.getElementById('display-name');
            const newName = displayNameInput?.value?.trim();
            if (!newName) { showToast('Please enter a display name.', 'warning'); return; }
            try {
                if (auth.currentUser) {
                    await updateProfile(auth.currentUser, { displayName: newName });
                    await saveSetting('displayName', newName);
                    updateUserInfo(auth.currentUser);
                    showToast('✅ Display name updated!', 'success');
                }
            } catch (e) {
                console.error('Error updating name:', e);
                showToast('Error updating display name.', 'error');
            }
        });
    }

    // All toggle/select/input settings
    const settingBindings = [
        { id: 'email-notifications', key: 'emailNotifications', type: 'checkbox' },
        { id: 'push-notifications', key: 'pushNotifications', type: 'checkbox' },
        { id: 'reminder-time', key: 'reminderTime', type: 'input' },
        { id: 'theme', key: 'theme', type: 'select', onChange: applyTheme },
        { id: 'start-week', key: 'startWeek', type: 'select', onChange: renderCalendar },
        { id: 'language', key: 'language', type: 'select', onChange: applyLanguage },
        { id: 'timezone', key: 'timezone', type: 'select', onChange: () => { userSettings.timezone = document.getElementById('timezone')?.value; renderCalendar(); renderSmartInsights(); } },
        { id: 'default-attendance', key: 'defaultAttendance', type: 'select' },
        { id: 'attendance-reminder', key: 'attendanceReminder', type: 'checkbox' },
        { id: 'streak-goal', key: 'streakGoal', type: 'input' },
        { id: 'data-sharing', key: 'dataSharing', type: 'checkbox' },
        { id: 'two-factor', key: 'twoFactor', type: 'checkbox', onChange: handleTwoFactorToggle },
        { id: 'session-timeout', key: 'sessionTimeout', type: 'select', onChange: scheduleSessionTimeout },
        { id: 'auto-backup', key: 'autoBackup', type: 'checkbox', onChange: scheduleAutoBackup },
        { id: 'backup-frequency', key: 'backupFrequency', type: 'select', onChange: scheduleAutoBackup },
        { id: 'holiday-country', key: 'holidayCountry', type: 'select' },
        { id: 'holiday-state', key: 'holidayState', type: 'input' },
        { id: 'holiday-city', key: 'holidayCity', type: 'input' },
        { id: 'holiday-district', key: 'holidayDistrict', type: 'input' },
        { id: 'institution-name', key: 'institutionName', type: 'input' },
        { id: 'holiday-suggestions', key: 'holidaySuggestions', type: 'checkbox' },
        { id: 'smart-reminders', key: 'smartReminders', type: 'checkbox', onChange: scheduleSmartReminder },
        { id: 'smart-target', key: 'smartTarget', type: 'input', onChange: renderSmartInsights },
    ];

    settingBindings.forEach(({ id, key, type, onChange }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const event = type === 'checkbox' ? 'change' : 'change';
        el.addEventListener(event, async (e) => {
            const val = type === 'checkbox' ? e.target.checked : e.target.value;
            userSettings[key] = val;
            if (id === 'two-factor') {
                await handleTwoFactorToggle(val);
                return;
            }
            await saveSetting(key, val);
            if (onChange) onChange(val);
            if (id === 'email-notifications' || id === 'push-notifications') {
                showToast('Preference saved. Delivery needs a notification service.', 'info', 3000);
            } else if (id !== 'theme' && id !== 'start-week' && id !== 'two-factor') {
                showToast('⚙️ Setting saved.', 'success', 2000);
            }
        });
    });

    // Working days
    document.querySelectorAll('input[name="working-days"]').forEach(cb => {
        cb.addEventListener('change', async () => {
            const workingDays = Array.from(document.querySelectorAll('input[name="working-days"]'))
                .filter(c => c.checked).map(c => c.value);
            await saveSetting('workingDays', workingDays);
            renderSmartInsights();
            showToast('⚙️ Working days updated.', 'success', 2000);
        });
    });

    // Data management
    const exportDataBtn = document.getElementById('export-data');
    const importDataBtn = document.getElementById('import-data');
    const clearDataBtn = document.getElementById('clear-data');
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportUserData);
    if (importDataBtn) importDataBtn.addEventListener('click', importUserData);
    if (clearDataBtn) clearDataBtn.addEventListener('click', clearAllData);

    // Support
    const helpCenterBtn = document.getElementById('help-center');
    const contactSupportBtn = document.getElementById('contact-support');
    const reportIssueBtn = document.getElementById('report-issue');
    if (helpCenterBtn) helpCenterBtn.addEventListener('click', () => { window.open('mailto:jishnurahegaonkar@gmail.com', '_blank'); });
    if (contactSupportBtn) contactSupportBtn.addEventListener('click', () => { window.open('mailto:jishnurahegaonkar@gmail.com', '_blank'); });
    if (reportIssueBtn) reportIssueBtn.addEventListener('click', () => { window.open('mailto:jishnurahegaonkar@gmail.com?subject=Bug Report', '_blank'); });

    document.getElementById('fetch-holidays')?.addEventListener('click', fetchHolidaySuggestions);
    document.getElementById('enable-reminders')?.addEventListener('click', requestReminderPermission);
    document.getElementById('detect-location')?.addEventListener('click', detectLocation);
    document.getElementById('college-calendar-file')?.addEventListener('change', handleCollegeCalendarUpload);
    document.getElementById('connect-google-calendar')?.addEventListener('click', connectGoogleCalendar);
    updateNotificationStatus();
}

async function loadSettings() {
    if (!auth.currentUser) return;
    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const settings = (userDoc.data() || {}).settings || {};

        const displayNameInput = document.getElementById('display-name');
        if (displayNameInput) {
            displayNameInput.value = settings.displayName || auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        }

        const fields = [
            { id: 'email-notifications', key: 'emailNotifications', def: true, type: 'checkbox' },
            { id: 'push-notifications', key: 'pushNotifications', def: true, type: 'checkbox' },
            { id: 'reminder-time', key: 'reminderTime', def: '09:00', type: 'input' },
            { id: 'theme', key: 'theme', def: 'light', type: 'select' },
            { id: 'start-week', key: 'startWeek', def: 'sunday', type: 'select' },
            { id: 'language', key: 'language', def: 'en', type: 'select' },
            { id: 'timezone', key: 'timezone', def: 'Asia/Kolkata', type: 'select' },
            { id: 'default-attendance', key: 'defaultAttendance', def: 'ask', type: 'select' },
            { id: 'attendance-reminder', key: 'attendanceReminder', def: true, type: 'checkbox' },
            { id: 'streak-goal', key: 'streakGoal', def: 95, type: 'input' },
            { id: 'data-sharing', key: 'dataSharing', def: false, type: 'checkbox' },
            { id: 'two-factor', key: 'twoFactor', def: false, type: 'checkbox' },
            { id: 'session-timeout', key: 'sessionTimeout', def: '60', type: 'select' },
            { id: 'auto-backup', key: 'autoBackup', def: true, type: 'checkbox' },
            { id: 'backup-frequency', key: 'backupFrequency', def: 'weekly', type: 'select' },
            { id: 'holiday-country', key: 'holidayCountry', def: 'IN', type: 'select' },
            { id: 'holiday-state', key: 'holidayState', def: '', type: 'input' },
            { id: 'holiday-city', key: 'holidayCity', def: '', type: 'input' },
            { id: 'holiday-district', key: 'holidayDistrict', def: '', type: 'input' },
            { id: 'institution-name', key: 'institutionName', def: '', type: 'input' },
            { id: 'holiday-suggestions', key: 'holidaySuggestions', def: true, type: 'checkbox' },
            { id: 'smart-reminders', key: 'smartReminders', def: false, type: 'checkbox' },
            { id: 'smart-target', key: 'smartTarget', def: 75, type: 'input' },
        ];

        fields.forEach(({ id, key, def, type }) => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = settings[key] !== undefined ? settings[key] : def;
            if (type === 'checkbox') el.checked = val;
            else el.value = String(val);
            userSettings[key] = val;
        });
        holidayForecastData = settings.holidayForecast || [];

        const workingDays = settings.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        document.querySelectorAll('input[name="working-days"]').forEach(cb => {
            cb.checked = workingDays.includes(cb.value);
        });

        applyTheme(settings.theme || 'light');
        applyLanguage(settings.language || 'en');
        scheduleSessionTimeout(settings.sessionTimeout || '60');
        scheduleAutoBackup(settings.autoBackup !== false);
        renderSmartInsights();
        renderHolidayForecast();
        scheduleSmartReminder(settings.smartReminders);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function getWorkingDayNames() {
    return Array.from(document.querySelectorAll('input[name="working-days"]'))
        .filter(input => input.checked).map(input => input.value);
}

function isWorkingDay(date) {
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return getWorkingDayNames().includes(names[date.getDay()]);
}

function renderSmartInsights() {
    const container = document.getElementById('smart-insights');
    if (!container) return;
    const target = Math.min(100, Math.max(1, Number(document.getElementById('smart-target')?.value || 75))) / 100;
    const now = new Date();
    const metrics = getMonthMetrics(now.getFullYear(), now.getMonth());
    const tracked = metrics.presentCount + metrics.bunkCount;
    let remainingWorkingDays = 0;
    for (let cursor = new Date(now); cursor.getMonth() === now.getMonth(); cursor.setDate(cursor.getDate() + 1)) {
        const key = formatDate(cursor);
        if (cursor > now && isWorkingDay(cursor) && !attendanceData[key]) remainingWorkingDays++;
    }
    const projectedRate = tracked + remainingWorkingDays > 0
        ? Math.round(((metrics.presentCount + remainingWorkingDays) / (tracked + remainingWorkingDays)) * 100) : 0;
    const safeBunks = tracked > 0 ? Math.max(0, Math.floor(metrics.presentCount / target - tracked)) : 0;

    const weekdayTotals = {};
    Object.entries(attendanceData).forEach(([key, record]) => {
        if (!['present', 'bunked'].includes(record.status)) return;
        const weekday = new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
        if (!weekdayTotals[weekday]) weekdayTotals[weekday] = { present: 0, total: 0 };
        weekdayTotals[weekday].total++;
        if (record.status === 'present') weekdayTotals[weekday].present++;
    });
    const weakestDay = Object.entries(weekdayTotals).sort(([, a], [, b]) => (a.present / a.total) - (b.present / b.total))[0];
    const pattern = weakestDay ? `${weakestDay[0]} is your weakest day at ${Math.round(weakestDay[1].present / weakestDay[1].total * 100)}%.` : 'Mark a few days to unlock attendance patterns.';

    container.innerHTML = `
      <div class="smart-insight"><strong>Safe-bunk estimate</strong><span>${safeBunks} day${safeBunks === 1 ? '' : 's'} at or above ${Math.round(target * 100)}%</span></div>
      <div class="smart-insight"><strong>Month forecast</strong><span>${projectedRate}% if you attend the remaining ${remainingWorkingDays} working day${remainingWorkingDays === 1 ? '' : 's'}</span></div>
      <div class="smart-insight"><strong>Pattern insight</strong><span>${pattern}</span></div>`;
}

async function persistAttendanceRecord(dateKey, record) {
    attendanceData[dateKey] = record;
    renderCurrentMonth();
    renderTodayCommand();
    renderHolidayForecast();
    if (!auth.currentUser) return;
    const ref = doc(db, 'users', auth.currentUser.uid);
    try {
        await updateDoc(ref, { [`attendance.${dateKey}`]: record });
    } catch (error) {
        await setDoc(ref, { attendance: { [dateKey]: record } }, { merge: true });
    }
}

async function fetchHolidaySuggestions() {
    const container = document.getElementById('holiday-recommendations');
    const country = document.getElementById('holiday-country')?.value || 'IN';
    if (!container) return;
    container.hidden = false;
    container.innerHTML = '<p class="smart-loading">Finding public holidays...</p>';
    try {
        const year = new Date().getFullYear();
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
        const holidays = response.ok ? await response.json() : getHolidayFallback(country, year);
        const suggestions = holidays.filter(holiday => !attendanceData[holiday.date]);
        holidayForecastData = suggestions.map(holiday => ({ date: holiday.date, title: holiday.localName || holiday.name }));
        await saveSetting('holidayForecast', holidayForecastData);
        renderHolidayForecast();
        if (!suggestions.length) {
            container.innerHTML = '<p class="smart-empty">No new public holidays found for this year.</p>';
            return;
        }
        container.innerHTML = `<div class="smart-results-title">Recommendations for ${year}</div>` + suggestions.map(holiday => `
          <div class="recommendation-row"><span><strong>${holiday.date}</strong> ${holiday.localName || holiday.name}</span><button class="btn-add-holiday" data-date="${holiday.date}" data-title="${(holiday.localName || holiday.name).replace(/"/g, '&quot;')}">Add</button></div>`).join('');
        container.querySelectorAll('.btn-add-holiday').forEach(button => button.addEventListener('click', async () => {
            const dateKey = button.dataset.date;
            await persistAttendanceRecord(dateKey, { date: `${dateKey}T00:00:00.000Z`, status: 'holiday', title: button.dataset.title || 'Public holiday' });
            button.textContent = 'Added';
            button.disabled = true;
        }));
    } catch (error) {
        const fallback = getHolidayFallback(country, new Date().getFullYear());
        holidayForecastData = fallback.map(holiday => ({ date: holiday.date, title: holiday.localName || holiday.name }));
        await saveSetting('holidayForecast', holidayForecastData);
        renderHolidayForecast();
        container.hidden = false;
        container.innerHTML = `<p class="smart-empty">Live holiday service is unavailable. Showing common ${country} holidays as optional suggestions.</p>${fallback.map(holiday => `<div class="recommendation-row"><span><strong>${holiday.date}</strong> ${holiday.localName || holiday.name}</span><button class="btn-add-holiday" data-date="${holiday.date}" data-title="${holiday.localName || holiday.name}">Add</button></div>`).join('')}`;
        container.querySelectorAll('.btn-add-holiday').forEach(button => button.addEventListener('click', async () => {
            const dateKey = button.dataset.date;
            await persistAttendanceRecord(dateKey, { date: `${dateKey}T00:00:00.000Z`, status: 'holiday', title: button.dataset.title });
            button.textContent = 'Added';
            button.disabled = true;
        }));
    }
}

function getHolidayFallback(country, year) {
    if (country !== 'IN') return [];
    return [
        { date: `${year}-01-26`, localName: 'Republic Day' },
        { date: `${year}-05-01`, localName: 'Maharashtra Day' },
        { date: `${year}-08-15`, localName: 'Independence Day' },
        { date: `${year}-10-02`, localName: 'Gandhi Jayanti' },
        { date: `${year}-12-25`, localName: 'Christmas Day' }
    ];
}

function detectLocation() {
    if (!navigator.geolocation) {
        showToast('Location detection is unavailable. Enter your location manually.', 'warning');
        return;
    }
    navigator.geolocation.getCurrentPosition(async position => {
        try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            if (!response.ok) throw new Error('Location lookup failed');
            const location = await response.json();
            const fields = {
                'holiday-state': location.principalSubdivision,
                'holiday-city': location.city || location.locality,
                'holiday-district': location.localityInfo?.administrative?.[2]?.name || location.locality
            };
            const settingKeys = {
                'holiday-state': 'holidayState',
                'holiday-city': 'holidayCity',
                'holiday-district': 'holidayDistrict'
            };
            for (const [id, value] of Object.entries(fields)) {
                const field = document.getElementById(id);
                if (field && value) {
                    field.value = value;
                    await saveSetting(settingKeys[id], value);
                }
            }
            const country = document.getElementById('holiday-country');
            if (country && location.countryCode) {
                country.value = location.countryCode;
                await saveSetting('holidayCountry', location.countryCode);
            }
            showToast('📍 Location filled. Review it before fetching holidays.', 'success');
        } catch (error) {
            showToast('Could not identify that location. Enter it manually.', 'warning');
        }
    }, () => showToast('Location permission was not granted. You can enter it manually.', 'warning'), { timeout: 10000 });
}

function parseCollegeCalendar(text, fileName) {
    if (fileName.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : parsed.holidays || [];
    }
    const lines = text.split(/\r?\n/).filter(Boolean);
    const start = /date/i.test(lines[0]) ? 1 : 0;
    return lines.slice(start).map(line => {
        const [dateKey, ...titleParts] = line.split(',');
        return { date: dateKey.trim(), title: titleParts.join(',').trim() || 'College holiday' };
    });
}

async function handleCollegeCalendarUpload(event) {
    const file = event.target.files?.[0];
    const preview = document.getElementById('college-calendar-preview');
    if (!file || !preview) return;
    try {
        const entries = parseCollegeCalendar(await file.text(), file.name)
            .map(entry => ({ date: String(entry.date || '').slice(0, 10), title: entry.title || entry.name || 'College holiday' }))
            .filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
        preview.hidden = false;
        preview.innerHTML = `<div class="smart-results-title">${entries.length} holiday${entries.length === 1 ? '' : 's'} ready to import</div><button id="import-college-holidays" class="btn-save-inline">Import Calendar</button>`;
        document.getElementById('import-college-holidays')?.addEventListener('click', async () => {
            for (const entry of entries) await persistAttendanceRecord(entry.date, { date: `${entry.date}T00:00:00.000Z`, status: 'holiday', title: entry.title });
            await saveSetting('collegeHolidays', entries);
            preview.innerHTML = '<p class="smart-empty">College calendar imported.</p>';
        });
    } catch (error) {
        preview.hidden = false;
        preview.innerHTML = '<p class="smart-empty">Could not read this file. Use CSV columns date,title or a JSON array.</p>';
    }
}

async function requestReminderPermission() {
    if (!('Notification' in window)) {
        showToast('This browser does not support notifications.', 'warning');
        return;
    }
    const permission = await Notification.requestPermission();
    updateNotificationStatus();
    if (permission === 'granted') {
        await saveSetting('smartReminders', true);
        const toggle = document.getElementById('smart-reminders');
        if (toggle) toggle.checked = true;
        scheduleSmartReminder(true);
        showToast('🔔 Smart reminders enabled.', 'success');
    }
}

function updateNotificationStatus() {
    const status = document.getElementById('notification-status');
    if (status && 'Notification' in window) status.textContent = `Browser permission: ${Notification.permission}`;
}

let reminderTimer;
function scheduleSmartReminder(enabled) {
    clearTimeout(reminderTimer);
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reminderTime = document.getElementById('reminder-time')?.value || '20:00';
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    reminderTimer = setTimeout(() => {
        const todayKey = formatDate(new Date());
        if (!attendanceData[todayKey] && isWorkingDay(new Date())) new Notification('Bunk Smart', { body: 'Today\'s attendance is still unmarked.' });
        scheduleSmartReminder(true);
    }, next.getTime() - Date.now());
}

async function saveSetting(key, value) {
    if (!auth.currentUser) return;
    try {
        const ref = doc(db, 'users', auth.currentUser.uid);
        try {
            await updateDoc(ref, { [`settings.${key}`]: value });
        } catch (e) {
            await setDoc(ref, { settings: { [key]: value } }, { merge: true });
        }
    } catch (error) {
        console.error('Error saving setting:', error);
    }
}

async function handleTwoFactorToggle(enabled) {
    const toggle = document.getElementById('two-factor');
    if (!enabled) {
        if (auth.currentUser?.multiFactor?.enrolledFactors?.length) {
            showToast('Remove the enrolled factor from your Firebase account security flow.', 'info', 3500);
            if (toggle) toggle.checked = true;
            return;
        }
        await saveSetting('twoFactor', false);
        showToast('Two-factor preference disabled.', 'info', 2000);
        return;
    }
    if (!auth.currentUser) return;
    const phoneNumber = window.prompt('Enter your phone number with country code, for example +919876543210');
    if (!phoneNumber) { if (toggle) toggle.checked = false; return; }
    const container = document.getElementById('mfa-recaptcha');
    if (container) container.hidden = false;
    let verifier;
    try {
        verifier = new RecaptchaVerifier(auth, 'mfa-recaptcha', { size: 'normal' });
        const session = await multiFactor(auth.currentUser).getSession();
        const provider = new PhoneAuthProvider(auth);
        const verificationId = await provider.verifyPhoneNumber({ phoneNumber, session }, verifier);
        const code = window.prompt('Enter the SMS verification code');
        if (!code) throw new Error('Verification cancelled');
        const credential = PhoneAuthProvider.credential(verificationId, code);
        await multiFactor(auth.currentUser).enroll(PhoneMultiFactorGenerator.assertion(credential), 'Bunk Smart phone');
        await saveSetting('twoFactor', true);
        showToast('🔐 Two-factor authentication enabled.', 'success', 4000);
    } catch (error) {
        if (toggle) toggle.checked = false;
        await saveSetting('twoFactor', false);
        const message = error.code === 'auth/requires-recent-login'
            ? 'Please sign out and sign in again before enabling two-factor authentication.'
            : error.message || 'Two-factor enrollment failed.';
        showToast(message, 'warning', 5000);
    } finally {
        verifier?.clear();
        if (container) container.hidden = true;
    }
}

function applyTheme(theme) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark', 'theme-auto');

    if (theme === 'dark') {
        body.classList.add('theme-dark');
    } else if (theme === 'auto') {
        if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
            body.classList.add('theme-dark');
        } else {
            body.classList.add('theme-light');
        }
    } else {
        body.classList.add('theme-light');
    }

    // Persist preference immediately to localStorage for fast re-apply on reload
    localStorage.setItem('bunkSmartTheme', theme);
}

function formatUserDate(date, options) {
    return new Intl.DateTimeFormat(userSettings.language || 'en', {
        timeZone: userSettings.timezone || 'Asia/Kolkata',
        ...options
    }).format(date);
}

function applyLanguage(language = 'en') {
    userSettings.language = language;
    document.documentElement.lang = language;
    const translations = {
        en: { attendance: 'Attendance', insights: 'Insights', challenges: 'Challenges', settings: 'Settings', dashboard: 'Attendance Dashboard', insightTitle: 'Attendance Insights', present: 'Present Days', bunk: 'Bunk Days', streak: 'Day Streak' },
        hi: { attendance: 'उपस्थिति', insights: 'विश्लेषण', challenges: 'चुनौतियां', settings: 'सेटिंग्स', dashboard: 'उपस्थिति डैशबोर्ड', insightTitle: 'उपस्थिति विश्लेषण', present: 'उपस्थित दिन', bunk: 'बंक दिन', streak: 'लगातार दिन' },
        es: { attendance: 'Asistencia', insights: 'Análisis', challenges: 'Retos', settings: 'Ajustes', dashboard: 'Panel de asistencia', insightTitle: 'Análisis de asistencia', present: 'Días presentes', bunk: 'Días ausentes', streak: 'Racha' },
        fr: { attendance: 'Présence', insights: 'Analyses', challenges: 'Défis', settings: 'Paramètres', dashboard: 'Tableau de présence', insightTitle: 'Analyses de présence', present: 'Jours présents', bunk: 'Jours absents', streak: 'Série' },
        de: { attendance: 'Anwesenheit', insights: 'Analysen', challenges: 'Herausforderungen', settings: 'Einstellungen', dashboard: 'Anwesenheitsübersicht', insightTitle: 'Anwesenheitsanalysen', present: 'Anwesende Tage', bunk: 'Fehltage', streak: 'Serie' }
    };
    const text = translations[language] || translations.en;
    const setText = (selector, value) => document.querySelectorAll(selector).forEach(element => { element.textContent = value; });
    setText('.nav-item[data-section="attendance"] .nav-text', text.attendance);
    setText('.nav-item[data-section="insights"] .nav-text', text.insights);
    setText('.nav-item[data-section="challenges"] .nav-text', text.challenges);
    setText('.nav-item[data-section="settings"] .nav-text', text.settings);
    setText('#attendance-section h1', text.dashboard);
    setText('#insights-section h1', text.insightTitle);
    setText('#present-days + .stat-label', text.present);
    setText('#bunk-days + .stat-label', text.bunk);
    setText('#streak + .stat-label', text.streak);
    if (calendarGrid) renderCalendar();
}

function scheduleSessionTimeout(minutes) {
    clearTimeout(sessionTimer);
    const timeoutMinutes = Number(minutes);
    if (!timeoutMinutes) return;
    const resetTimer = () => {
        clearTimeout(sessionTimer);
        sessionTimer = setTimeout(() => import('./guard.js').then(module => module.logoutUser()), timeoutMinutes * 60 * 1000);
    };
    if (!scheduleSessionTimeout.bound) {
        ['click', 'keydown', 'mousemove', 'touchstart'].forEach(event => document.addEventListener(event, resetTimer, { passive: true }));
        scheduleSessionTimeout.bound = true;
    }
    resetTimer();
}

function scheduleAutoBackup(enabled = true) {
    if (!enabled || !auth.currentUser) return;
    const frequency = document.getElementById('backup-frequency')?.value || userSettings.backupFrequency || 'weekly';
    const interval = frequency === 'daily' ? 86400000 : frequency === 'monthly' ? 2592000000 : 604800000;
    localStorage.setItem(`bunkSmartBackup_${auth.currentUser.uid}`, JSON.stringify({
        savedAt: new Date().toISOString(), attendance: attendanceData, challenges: challengesData, settings: userSettings
    }));
    clearTimeout(scheduleAutoBackup.timer);
    scheduleAutoBackup.timer = setTimeout(() => scheduleAutoBackup(true), interval);
}

// Apply saved theme immediately on load (before Firebase)
const savedTheme = localStorage.getItem('bunkSmartTheme');
if (savedTheme) applyTheme(savedTheme);

async function exportUserData() {
    if (!auth.currentUser) return;
    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const data = JSON.stringify(userDoc.data() || {}, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bunk-smart-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('📥 Data exported successfully!', 'success');
    } catch (e) {
        showToast('Error exporting data.', 'error');
    }
}

async function importUserData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.attendance && !data.settings) {
                showToast('Invalid file format.', 'error'); return;
            }
            if (!confirm('This will overwrite your current data. Continue?')) return;
            const updateData = {};
            if (data.attendance) updateData.attendance = data.attendance;
            if (data.settings) updateData.settings = data.settings;
            if (data.subjects) updateData.subjects = data.subjects;
            if (data.timetable) updateData.timetable = data.timetable;
            await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);
            attendanceData = data.attendance || {};
            subjectsData = data.subjects || {};
            timetableData = data.timetable || [];
            updateStats(); renderCalendar(); loadInsights(); loadSettings();
            renderSubjects(); renderTimetable(); renderHolidayForecast();
            showToast('📤 Data imported successfully!', 'success');
        } catch (e) {
            showToast('Error importing data. Check file format.', 'error');
        }
    };
    input.click();
}

async function clearAllData() {
    if (!auth.currentUser) return;
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            attendance: {}, settings: {}, challenges: {}, subjects: {}, timetable: []
        });
        attendanceData = {};
        challengesData = {};
        subjectsData = {};
        timetableData = [];
        updateStats(); renderCalendar(); loadInsights(); renderChallenges();
        renderSubjects(); renderTimetable(); renderTodayCommand(); renderHolidayForecast();
        showToast('🗑️ All data cleared.', 'info');
    } catch (e) {
        showToast('Error clearing data.', 'error');
    }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function showLoading() {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    setTimeout(() => hideLoading(), 10000);
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', initDashboard);