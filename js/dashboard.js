// ===== DASHBOARD.JS =====
import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

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
const bunkDetails = document.getElementById('bunk-details');
const bunkActivityInput = document.getElementById('bunk-activity');
const bunkMissedInput = document.getElementById('bunk-missed');
const saveAttendanceBtn = document.getElementById('save-attendance');

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
let currentUser = null;

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
                attendance: {}, challenges: {}, settings: {}
            });
            attendanceData = {};
            challengesData = {};
        } else {
            const data = userDoc.data();
            attendanceData = data.attendance || {};
            challengesData = data.challenges || {};
        }
        updateStats();
        renderCalendar();
        loadInsights();
        renderChallenges();
        loadSettings();
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading data. Please refresh.', 'error');
    } finally {
        hideLoading();
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
        renderCalendar();
    });
    nextMonthBtn?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (currentMonthElement) {
        currentMonthElement.textContent = new Date(year, month).toLocaleDateString('en-US', {
            month: 'long', year: 'numeric'
        });
    }

    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
            }
            if (dateKey === todayKey) dayElement.classList.add('today');

            const dateCopy = new Date(currentDateIter);
            dayElement.addEventListener('click', () => openAttendanceModal(dateCopy));
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
        bunkDetails.hidden = true;
        if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;
        saveAttendanceImmediate('present');
    });

    markBunkBtn?.addEventListener('click', () => {
        // Bunk: show the detail fields + save button
        markBunkBtn.classList.add('selected');
        markPresentBtn.classList.remove('selected');
        bunkDetails.hidden = false;
        if (saveAttendanceBtn) saveAttendanceBtn.hidden = false;
    });

    saveAttendanceBtn?.addEventListener('click', saveAttendance);
}

function openAttendanceModal(date) {
    selectedDate = date;
    if (selectedDateElement) {
        selectedDateElement.textContent = date.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    const dateKey = formatDate(date);
    const existing = attendanceData[dateKey];

    markPresentBtn.classList.remove('selected');
    markBunkBtn.classList.remove('selected');
    bunkDetails.hidden = true;
    if (bunkActivityInput) bunkActivityInput.value = '';
    if (bunkMissedInput) bunkMissedInput.value = '';
    // Save button hidden by default — only shown when Bunk is selected
    if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;

    if (existing) {
        if (existing.status === 'present') {
            markPresentBtn.classList.add('selected');
            // Already present — just show state, no save button
            if (saveAttendanceBtn) saveAttendanceBtn.hidden = true;
        } else if (existing.status === 'bunked') {
            markBunkBtn.classList.add('selected');
            bunkDetails.hidden = false;
            if (bunkActivityInput) bunkActivityInput.value = existing.activity || '';
            if (bunkMissedInput) bunkMissedInput.value = existing.missed || '';
            if (saveAttendanceBtn) saveAttendanceBtn.hidden = false;
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

    const dateKey = formatDate(selectedDate);
    const record = {
        date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString(),
        status: status
    };

    // Close modal instantly for snappy UX
    closeAttendanceModal();

    // Optimistic update
    attendanceData[dateKey] = record;
    updateStats();
    renderCalendar();
    loadInsights();
    showToast(`✅ Present marked for ${dateKey}`, 'success');

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

async function saveAttendance() {
    if (!selectedDate || !auth.currentUser) return;

    const isBunked = markBunkBtn.classList.contains('selected');
    const isPresent = markPresentBtn.classList.contains('selected');

    if (!isPresent && !isBunked) {
        showToast('Please select Present or Bunked first.', 'warning');
        return;
    }

    const dateKey = formatDate(selectedDate);
    const status = isPresent ? 'present' : 'bunked';

    let record = {
        date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString(),
        status: status
    };

    if (status === 'bunked') {
        record.activity = bunkActivityInput?.value || '';
        record.missed = bunkMissedInput?.value || '';
    }

    // Optimistic update
    attendanceData[dateKey] = record;
    closeAttendanceModal();
    updateStats();
    renderCalendar();
    loadInsights();

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
        showToast('Error saving attendance. Please try again.', 'error');
    }
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function updateStats() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let presentCount = 0, bunkCount = 0, currentStreak = 0, maxStreak = 0;

    const sortedDates = Object.keys(attendanceData).sort();
    sortedDates.forEach(dateKey => {
        const att = attendanceData[dateKey];
        const date = new Date(att.date || dateKey);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            if (att.status === 'present') presentCount++;
            if (att.status === 'bunked') bunkCount++;
        }
        if (att.status === 'present') {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    const totalDays = presentCount + bunkCount;
    const attendanceRate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

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
        .filter(k => attendanceData[k].status === 'bunked')
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
        const date = new Date(dateKey);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { present: 0, bunk: 0, total: 0 };
        monthlyData[monthKey].total++;
        if (attendanceData[dateKey].status === 'present') monthlyData[monthKey].present++;
        else if (attendanceData[dateKey].status === 'bunked') monthlyData[monthKey].bunk++;
    });

    const labels = Object.keys(monthlyData).sort();
    const presentData = labels.map(m => monthlyData[m].total > 0 ? Math.round((monthlyData[m].present / monthlyData[m].total) * 100) : 0);
    const bunkData = labels.map(m => monthlyData[m].total > 0 ? Math.round((monthlyData[m].bunk / monthlyData[m].total) * 100) : 0);

    // Add sample data if empty for demo
    const finalLabels = labels.length > 0 ? labels : ['2026-01', '2026-02', '2026-03'];
    const finalPresent = presentData.length > 0 ? presentData : [0, 0, 0];
    const finalBunk = bunkData.length > 0 ? bunkData : [0, 0, 0];

    if (attendanceChart) attendanceChart.destroy();

    attendanceChart = new Chart(ctx, {
        type: 'line',
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
                    tension: 0.4,
                    fill: true
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
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { intersect: false, mode: 'index' },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
                    ticks: {
                        callback: v => v + '%',
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: '#6b7280',
                        stepSize: 25
                    },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: '#6b7280'
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
    docPdf.setFontSize(16);
    docPdf.text('Bunk Smart Attendance Report', 20, 20);
    docPdf.setFontSize(11);
    let y = 40;
    Object.keys(attendanceData).sort().forEach(dateKey => {
        const att = attendanceData[dateKey];
        docPdf.text(`${dateKey}: ${att.status}${att.activity ? ' | Did: ' + att.activity : ''}${att.missed ? ' | Missed: ' + att.missed : ''}`, 20, y);
        y += 10;
        if (y > 280) { docPdf.addPage(); y = 20; }
    });
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
        return new Date(isoString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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
        { id: 'language', key: 'language', type: 'select' },
        { id: 'timezone', key: 'timezone', type: 'select' },
        { id: 'default-attendance', key: 'defaultAttendance', type: 'select' },
        { id: 'attendance-reminder', key: 'attendanceReminder', type: 'checkbox' },
        { id: 'streak-goal', key: 'streakGoal', type: 'input' },
        { id: 'data-sharing', key: 'dataSharing', type: 'checkbox' },
        { id: 'two-factor', key: 'twoFactor', type: 'checkbox', onChange: () => showToast('Two-factor auth setting saved.', 'info') },
        { id: 'session-timeout', key: 'sessionTimeout', type: 'select' },
        { id: 'auto-backup', key: 'autoBackup', type: 'checkbox' },
        { id: 'backup-frequency', key: 'backupFrequency', type: 'select' },
    ];

    settingBindings.forEach(({ id, key, type, onChange }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const event = type === 'checkbox' ? 'change' : 'change';
        el.addEventListener(event, async (e) => {
            const val = type === 'checkbox' ? e.target.checked : e.target.value;
            await saveSetting(key, val);
            if (onChange) onChange(val);
            if (id !== 'theme' && id !== 'start-week' && id !== 'two-factor') {
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
        ];

        fields.forEach(({ id, key, def, type }) => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = settings[key] !== undefined ? settings[key] : def;
            if (type === 'checkbox') el.checked = val;
            else el.value = String(val);
        });

        const workingDays = settings.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        document.querySelectorAll('input[name="working-days"]').forEach(cb => {
            cb.checked = workingDays.includes(cb.value);
        });

        applyTheme(settings.theme || 'light');
    } catch (error) {
        console.error('Error loading settings:', error);
    }
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
            await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);
            attendanceData = data.attendance || {};
            updateStats(); renderCalendar(); loadInsights(); loadSettings();
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
            attendance: {}, settings: {}, challenges: {}
        });
        attendanceData = {};
        challengesData = {};
        updateStats(); renderCalendar(); loadInsights(); renderChallenges();
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