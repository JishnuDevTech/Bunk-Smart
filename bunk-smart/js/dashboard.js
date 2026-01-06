// ===== DASHBOARD.JS =====
import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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

// Challenge Elements
const challengeCards = document.querySelectorAll('.challenge-card');
let challengesData = {}; // Will load from Firebase

// Current state
let currentDate = new Date();
let selectedDate = null;
let attendanceData = {};

// Initialize dashboard
function initDashboard() {
    if (!auth.currentUser && !localStorage.getItem('loggedInUser')) {
        window.location.href = 'login.html';
        return;
    }
    updateUserInfo(auth.currentUser);
    loadUserData();
    setupNavigation();
    setupCalendar();
    setupModal();
    setupChallenges();
    setupSettings();
}

// Authentication - handled by guard.js

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
            // Create initial user document
            await setDoc(doc(db, 'users', auth.currentUser.uid), {
                attendance: {},
                challenges: {},
                settings: {}
            });
            attendanceData = {};
        } else {
            const data = userDoc.data();
            attendanceData = data.attendance || {};
            challengesData = data.challenges || {};
            // Load settings in loadSettings()
        }
        updateStats();
        renderCalendar();
        loadInsights();
        loadChallenges(); // Ensure challenges load
        loadSettings();
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading data. Please refresh.');
    } finally {
        hideLoading();
    }
}

// Navigation
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show corresponding section
            contentSections.forEach(content => {
                content.classList.remove('active');
            });
            const targetSection = document.getElementById(`${section}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    // Sign out
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
}

// Calendar
function setupCalendar() {
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update month header
    currentMonthElement.textContent = new Date(year, month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    // Clear calendar
    calendarGrid.innerHTML = '';

    // Add day names
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const dayNameElement = document.createElement('div');
        dayNameElement.className = 'day-name';
        dayNameElement.textContent = day;
        calendarGrid.appendChild(dayNameElement);
    });

    // Get first day of month and last day
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Generate calendar days
    const currentDateIter = new Date(startDate);
    let dayCount = 0;
    while (currentDateIter <= lastDay || dayCount < 42) { // Ensure we fill the grid
        const dayElement = document.createElement('div');
        dayElement.className = 'day-cell';
        dayElement.textContent = currentDateIter.getDate();

        const dateKey = formatDate(currentDateIter);
        const isCurrentMonth = currentDateIter.getMonth() === month;

        if (!isCurrentMonth) {
            dayElement.classList.add('inactive');
        } else {
            const attendance = attendanceData[dateKey];
            if (attendance) {
                if (attendance.status === 'present') {
                    dayElement.classList.add('present');
                } else if (attendance.status === 'bunked') {
                    dayElement.classList.add('bunked');
                }
            }

            dayElement.addEventListener('click', () => openAttendanceModal(currentDateIter));
        }

        calendarGrid.appendChild(dayElement);
        currentDateIter.setDate(currentDateIter.getDate() + 1);
        dayCount++;
    }
}

// Modal
function setupModal() {
    modalClose.addEventListener('click', closeAttendanceModal);
    attendanceModal.addEventListener('click', (e) => {
        if (e.target === attendanceModal) {
            closeAttendanceModal();
        }
    });

    markPresentBtn.addEventListener('click', () => {
        bunkDetails.style.display = 'none';
        markPresentBtn.classList.add('selected');
        markBunkBtn.classList.remove('selected');
    });

    markBunkBtn.addEventListener('click', () => {
        bunkDetails.style.display = 'block';
        markBunkBtn.classList.add('selected');
        markPresentBtn.classList.remove('selected');
    });

    saveAttendanceBtn.addEventListener('click', saveAttendance);
}

function openAttendanceModal(date) {
    selectedDate = date;
    selectedDateElement.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const dateKey = formatDate(date);
    const existingAttendance = attendanceData[dateKey];

    if (existingAttendance) {
        if (existingAttendance.status === 'present') {
            markPresentBtn.classList.add('selected');
            markBunkBtn.classList.remove('selected');
            bunkDetails.style.display = 'none';
        } else {
            markBunkBtn.classList.add('selected');
            markPresentBtn.classList.remove('selected');
            bunkDetails.style.display = 'block';
            bunkActivityInput.value = existingAttendance.activity || '';
            bunkMissedInput.value = existingAttendance.missed || '';
        }
    } else {
        markPresentBtn.classList.remove('selected');
        markBunkBtn.classList.remove('selected');
        bunkDetails.style.display = 'none';
        bunkActivityInput.value = '';
        bunkMissedInput.value = '';
    }

    attendanceModal.hidden = false;
}

function closeAttendanceModal() {
    attendanceModal.hidden = true;
    selectedDate = null;
}

async function saveAttendance() {
    if (!selectedDate || !auth.currentUser) return;

    showLoading();
    const dateKey = formatDate(selectedDate);
    const isPresent = markPresentBtn.classList.contains('selected');
    const isBunked = markBunkBtn.classList.contains('selected');

    let attendanceRecord = {
        date: selectedDate.toISOString(),
        status: isPresent ? 'present' : isBunked ? 'bunked' : null
    };

    if (isBunked) {
        attendanceRecord.activity = bunkActivityInput.value;
        attendanceRecord.missed = bunkMissedInput.value;
    }

    try {
        attendanceData[dateKey] = attendanceRecord;

        await setDoc(doc(db, 'users', auth.currentUser.uid), {
            attendance: attendanceData
        }, { merge: true });

        updateStats();
        renderCalendar();
        loadInsights();
        closeAttendanceModal();
        showToast('Attendance saved successfully!');
        // Update challenges if present
        Object.keys(challengesData).forEach(challengeId => {
            if (challengesData[challengeId].active && isPresent) {
                handleCheckIn(challengeId);
            }
        });
    } catch (error) {
        console.error('Error saving attendance:', error);
        showToast('Error saving attendance. Please try again.');
    } finally {
        hideLoading();
    }
}

// Stats
function updateStats() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let presentCount = 0;
    let bunkCount = 0;
    let streakCount = 0;
    let currentStreak = 0;

    const sortedDates = Object.keys(attendanceData).sort();

    sortedDates.forEach(dateKey => {
        const attendance = attendanceData[dateKey];
        const date = new Date(attendance.date);

        // Count for current month
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            if (attendance.status === 'present') presentCount++;
            if (attendance.status === 'bunked') bunkCount++;
        }

        // Calculate streak
        if (attendance.status === 'present') {
            currentStreak++;
            streakCount = Math.max(streakCount, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    const totalDays = presentCount + bunkCount;
    const attendanceRate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

    attendanceRateElement.textContent = `${attendanceRate}%`;
    presentDaysElement.textContent = presentCount;
    bunkDaysElement.textContent = bunkCount;
    streakElement.textContent = streakCount;

    // Update monthly insights stats
    const monthlyPresentElement = document.getElementById('monthly-present');
    const monthlyBunkElement = document.getElementById('monthly-bunk');
    const monthlyRateElement = document.getElementById('monthly-rate');
    if (monthlyPresentElement) monthlyPresentElement.textContent = presentCount;
    if (monthlyBunkElement) monthlyBunkElement.textContent = bunkCount;
    if (monthlyRateElement) monthlyRateElement.textContent = `${attendanceRate}%`;
}

// Insights
let attendanceChart;

function loadInsights() {
    renderBunkCards();
    renderAttendanceChart();
    setupExportButtons();
    updatePrediction();
}

function renderBunkCards() {
    const bunkCardsContainer = document.getElementById('bunk-cards');
    if (!bunkCardsContainer) return;

    bunkCardsContainer.innerHTML = '';
    Object.keys(attendanceData).forEach(dateKey => {
        const attendance = attendanceData[dateKey];
        if (attendance.status === 'bunked') {
            const card = document.createElement('div');
            card.className = 'bunk-card';
            card.innerHTML = `
                <p class="date">${dateKey}</p>
                <p class="did">✔ ${attendance.activity || 'Did something productive'}</p>
                <p class="missed">✘ ${attendance.missed || 'Missed lecture/class'}</p>
            `;
            bunkCardsContainer.appendChild(card);
        }
    });

    if (Object.keys(attendanceData).filter(key => attendanceData[key].status === 'bunked').length === 0) {
        const noDataCard = document.createElement('div');
        noDataCard.className = 'bunk-card empty';
        noDataCard.innerHTML = '<p>No bunks yet! Keep up the good work. 🚀</p>';
        bunkCardsContainer.appendChild(noDataCard);
    }
}

function renderAttendanceChart() {
    const ctx = document.getElementById('attendance-chart');
    if (!ctx) return;

    // Prepare monthly data
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
    const presentData = labels.map(month => (monthlyData[month].present / monthlyData[month].total * 100) || 0);
    const bunkData = labels.map(month => (monthlyData[month].bunk / monthlyData[month].total * 100) || 0);

    if (attendanceChart) attendanceChart.destroy();

    attendanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Present %',
                    data: presentData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Bunk %',
                    data: bunkData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: value => value + '%' }
                }
            },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Attendance Trends' }
            }
        }
    });
}

function updatePrediction() {
    const totalPresent = Object.values(attendanceData).filter(att => att.status === 'present').length;
    const totalDays = Object.keys(attendanceData).length;
    const currentRate = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;
    const remainingDays = 365 - totalDays; // Assume year
    const projectedRate = Math.round(currentRate + (100 - currentRate) * (remainingDays / 365)); // Simple linear projection

    const predictionEl = document.getElementById('prediction') || createPredictionElement();
    predictionEl.textContent = `Projected Year-End Rate: ${projectedRate}%`;
}

function createPredictionElement() {
    const predictionDiv = document.createElement('div');
    predictionDiv.id = 'prediction';
    predictionDiv.className = 'prediction';
    predictionDiv.innerHTML = '<h4>Prediction</h4><p id="proj-rate"></p>';
    const insightsSummary = document.querySelector('.insights-summary');
    if (insightsSummary) insightsSummary.parentNode.insertBefore(predictionDiv, insightsSummary.nextSibling);
    return document.getElementById('proj-rate');
}

function setupExportButtons() {
    const csvBtn = document.getElementById('export-csv');
    const pdfBtn = document.getElementById('export-pdf');

    if (csvBtn) {
        csvBtn.addEventListener('click', exportToCSV);
    }

    if (pdfBtn) {
        pdfBtn.addEventListener('click', exportToPDF);
    }
}

function exportToCSV() {
    if (Object.keys(attendanceData).length === 0) {
        showToast('No data to export.');
        return;
    }

    let csv = 'Date,Status,Activity,Missed\n';
    Object.keys(attendanceData).sort().forEach(dateKey => {
        const att = attendanceData[dateKey];
        csv += `${dateKey},"${att.status}","${att.activity || ''}","${att.missed || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bunk-smart-attendance.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported successfully!');
}

function exportToPDF() {
    if (Object.keys(attendanceData).length === 0) {
        showToast('No data to export.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Bunk Smart Attendance Report', 20, 20);

    let y = 40;
    Object.keys(attendanceData).sort().forEach(dateKey => {
        const att = attendanceData[dateKey];
        doc.text(`${dateKey}: ${att.status} - Activity: ${att.activity || 'N/A'} - Missed: ${att.missed || 'N/A'}`, 20, y);
        y += 10;
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
    });

    doc.save('bunk-smart-attendance.pdf');
    showToast('PDF exported successfully!');
}

// Challenges
async function loadChallenges() {
    if (!auth.currentUser) return;
    showLoading();
    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
            challengesData = userDoc.data().challenges || {};
        }
    } catch (error) {
        console.error('Error loading challenges:', error);
        showToast('Error loading challenges.');
    } finally {
        hideLoading();
        renderChallenges();
    }
}

function renderChallenges() {
    challengeCards.forEach(card => {
        const challengeId = card.dataset.challenge;
        const challenge = challengesData[challengeId] || { progress: 0, active: false, completedDays: 0, totalDays: getTotalDays(challengeId), streak: 0 };
        challengesData[challengeId] = challenge; // Ensure entry exists

        const progressBar = card.querySelector('.progress-bar');
        const progressText = card.querySelector('.progress-text');
        const startBtn = card.querySelector('.start-challenge');
        const checkInBtn = card.querySelector('.check-in-btn');
        const badge = card.querySelector('.badge');

        // Update progress
        const progressPercent = (challenge.completedDays / challenge.totalDays) * 100;
        progressBar.style.setProperty('--progress', progressPercent + '%');

        if (challengeId === '10_tasks_rage') {
            progressText.textContent = `Task ${challenge.completedDays}/${challenge.totalDays}`;
        } else if (challengeId === '7_day_streak' || challengeId === 'no_bunk_week') {
            progressText.textContent = `Streak: ${challenge.streak}/${challenge.totalDays}`;
        } else if (challengeId === 'perfect_month') {
            const monthlyRate = calculateMonthlyRate();
            progressText.textContent = `Attendance: ${monthlyRate}%`;
            progressBar.style.setProperty('--progress', monthlyRate + '%');
        } else if (challengeId === 'custom_challenge') {
            progressText.textContent = challenge.goal ? `Progress: ${challenge.completedDays}/${challenge.goal}` : 'Setup Required';
        } else {
            const daysElapsed = challenge.active ? Math.floor((new Date() - new Date(challenge.startDate)) / (1000 * 60 * 60 * 24)) + 1 : 0;
            progressText.textContent = `Day ${Math.min(challenge.completedDays, daysElapsed)}/${challenge.totalDays}`;
        }

        // UI states
        if (challenge.active) {
            startBtn.hidden = true;
            if (checkInBtn) checkInBtn.hidden = false;
        } else {
            startBtn.hidden = false;
            if (checkInBtn) checkInBtn.hidden = true;
        }

        if (challenge.completedDays >= challenge.totalDays) {
            badge.hidden = false;
            if (checkInBtn) checkInBtn.hidden = true;
            startBtn.textContent = 'Restart';
        }

        // Event listeners (use IDs for specificity)
        const startId = `start-${challengeId}`;
        const checkInId = `checkin-${challengeId}`;
        const startEl = document.getElementById(startId);
        const checkInEl = document.getElementById(checkInId);

        if (startEl) {
            startEl.onclick = async () => handleStartChallenge(challengeId);
        }
        if (checkInEl) {
            checkInEl.onclick = async () => handleCheckIn(challengeId);
        }
    });
}

function getTotalDays(challengeId) {
    const totals = {
        '30_days_hard': 30,
        '60_days_hard': 60,
        '90_days_hard': 90,
        '7_day_streak': 7,
        'no_bunk_week': 7,
        'perfect_month': 1, // Special: based on month days
        '10_tasks_rage': 10,
        'custom_challenge': 30 // Default
    };
    return totals[challengeId] || 30;
}

async function handleStartChallenge(challengeId) {
    if (!auth.currentUser) return;
    const challenge = challengesData[challengeId] || { progress: 0, active: false, completedDays: 0, totalDays: getTotalDays(challengeId), streak: 0 };
    challenge.active = true;
    challenge.startDate = new Date().toISOString();
    if (challengeId === 'custom_challenge') {
        const goal = prompt('Enter your goal (e.g., number of days/tasks):');
        if (goal) challenge.goal = parseInt(goal) || 30;
    }
    challengesData[challengeId] = challenge;
    await saveChallenges();
    renderChallenges();
    showToast('Challenge started! Mark daily to progress.');
}

async function handleCheckIn(challengeId) {
    if (!auth.currentUser) return;
    const todayKey = formatDate(new Date());
    const todayAttendance = attendanceData[todayKey];

    if (!todayAttendance || todayAttendance.status !== 'present') {
        alert('You must mark today as present in attendance to check in!');
        return;
    }

    const challenge = challengesData[challengeId];
    if (!challenge.active) return;

    challenge.completedDays = Math.min(challenge.completedDays + 1, challenge.totalDays);
    challenge.streak++;

    // Special logic
    if (challengeId === '10_tasks_rage') {
        // Task-based, no attendance req
    } else if (challengeId === 'perfect_month') {
        // Auto-update based on monthly rate
        challenge.completedDays = 1; // Complete if rate 100%
        if (calculateMonthlyRate() < 100) challenge.completedDays = 0;
    } else if (challengeId === 'no_bunk_week') {
        // Check no bunks in week
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const hasBunk = Object.values(attendanceData).some(att => att.status === 'bunked' && new Date(att.date) >= weekStart);
        if (hasBunk) challenge.streak = 0;
    }

    if (challenge.completedDays >= challenge.totalDays) {
        showToast(`Challenge completed! 🎉 Unlocked badge.`);
    } else {
        showToast('Daily check-in successful! Keep going.');
    }

    await saveChallenges();
    renderChallenges();
    updateStats(); // Refresh if needed
}

async function saveChallenges() {
    if (!auth.currentUser) return;
    try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            challenges: challengesData
        });
    } catch (error) {
        console.error('Error saving challenges:', error);
    }
}

function calculateMonthlyRate() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let present = 0, total = 0;
    Object.values(attendanceData).forEach(att => {
        const date = new Date(att.date);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            total++;
            if (att.status === 'present') present++;
        }
    });
    return total > 0 ? Math.round((present / total) * 100) : 0;
}

function setupChallenges() {
    loadChallenges(); // Initial load
    // Re-render on attendance change or interval if needed
}

// Settings
function setupSettings() {
    // Profile settings
    const displayNameInput = document.getElementById('display-name');
    const emailNotificationsCheckbox = document.getElementById('email-notifications');
    const pushNotificationsCheckbox = document.getElementById('push-notifications');
    const reminderTimeInput = document.getElementById('reminder-time');

    // App preferences
    const themeSelect = document.getElementById('theme');
    const startWeekSelect = document.getElementById('start-week');
    const languageSelect = document.getElementById('language');
    const timezoneSelect = document.getElementById('timezone');

    // Attendance settings
    const defaultAttendanceSelect = document.getElementById('default-attendance');
    const attendanceReminderCheckbox = document.getElementById('attendance-reminder');
    const streakGoalInput = document.getElementById('streak-goal');
    const workingDaysCheckboxes = document.querySelectorAll('input[name="working-days"]');

    // Privacy & Security
    const dataSharingCheckbox = document.getElementById('data-sharing');
    const twoFactorCheckbox = document.getElementById('two-factor');
    const sessionTimeoutSelect = document.getElementById('session-timeout');

    // Data management
    const autoBackupCheckbox = document.getElementById('auto-backup');
    const backupFrequencySelect = document.getElementById('backup-frequency');
    const exportDataBtn = document.getElementById('export-data');
    const importDataBtn = document.getElementById('import-data');
    const clearDataBtn = document.getElementById('clear-data');

    // Support & Help
    const helpCenterBtn = document.getElementById('help-center');
    const contactSupportBtn = document.getElementById('contact-support');
    const reportIssueBtn = document.getElementById('report-issue');

    // Load current settings
    loadSettings();

    // Profile settings event listeners
    if (displayNameInput) {
        displayNameInput.addEventListener('change', (e) => {
            saveSetting('displayName', e.target.value);
            updateUserInfo(auth.currentUser);
        });
    }

    if (emailNotificationsCheckbox) {
        emailNotificationsCheckbox.addEventListener('change', (e) => {
            saveSetting('emailNotifications', e.target.checked);
        });
    }

    if (pushNotificationsCheckbox) {
        pushNotificationsCheckbox.addEventListener('change', (e) => {
            saveSetting('pushNotifications', e.target.checked);
        });
    }

    if (reminderTimeInput) {
        reminderTimeInput.addEventListener('change', (e) => {
            saveSetting('reminderTime', e.target.value);
        });
    }

    // App preferences event listeners
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            saveSetting('theme', e.target.value);
            applyTheme(e.target.value);
        });
    }

    if (startWeekSelect) {
        startWeekSelect.addEventListener('change', (e) => {
            saveSetting('startWeek', e.target.value);
            renderCalendar();
        });
    }

    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            saveSetting('language', e.target.value);
            // In a real app, this would change the UI language
            alert('Language change will take effect after refresh');
        });
    }

    if (timezoneSelect) {
        timezoneSelect.addEventListener('change', (e) => {
            saveSetting('timezone', e.target.value);
        });
    }

    // Attendance settings event listeners
    if (defaultAttendanceSelect) {
        defaultAttendanceSelect.addEventListener('change', (e) => {
            saveSetting('defaultAttendance', e.target.value);
        });
    }

    if (attendanceReminderCheckbox) {
        attendanceReminderCheckbox.addEventListener('change', (e) => {
            saveSetting('attendanceReminder', e.target.checked);
        });
    }

    if (streakGoalInput) {
        streakGoalInput.addEventListener('change', (e) => {
            saveSetting('streakGoal', parseInt(e.target.value));
        });
    }

    workingDaysCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const workingDays = Array.from(workingDaysCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            saveSetting('workingDays', workingDays);
        });
    });

    // Privacy & Security event listeners
    if (dataSharingCheckbox) {
        dataSharingCheckbox.addEventListener('change', (e) => {
            saveSetting('dataSharing', e.target.checked);
        });
    }

    if (twoFactorCheckbox) {
        twoFactorCheckbox.addEventListener('change', (e) => {
            saveSetting('twoFactor', e.target.checked);
            // In a real app, this would enable/disable 2FA
            alert('Two-factor authentication settings saved');
        });
    }

    if (sessionTimeoutSelect) {
        sessionTimeoutSelect.addEventListener('change', (e) => {
            saveSetting('sessionTimeout', parseInt(e.target.value));
        });
    }

    // Data management event listeners
    if (autoBackupCheckbox) {
        autoBackupCheckbox.addEventListener('change', (e) => {
            saveSetting('autoBackup', e.target.checked);
        });
    }

    if (backupFrequencySelect) {
        backupFrequencySelect.addEventListener('change', (e) => {
            saveSetting('backupFrequency', e.target.value);
        });
    }

    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportUserData);
    }

    if (importDataBtn) {
        importDataBtn.addEventListener('click', importUserData);
    }

    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', clearAllData);
    }

    // Support & Help event listeners
    if (helpCenterBtn) {
        helpCenterBtn.addEventListener('click', () => {
            window.open('https://help.bunksmart.com', '_blank');
        });
    }

    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', () => {
            window.open('mailto:support@bunksmart.com', '_blank');
        });
    }

    if (reportIssueBtn) {
        reportIssueBtn.addEventListener('click', () => {
            window.open('https://github.com/bunksmart/issues', '_blank');
        });
    }
}

async function loadSettings() {
    if (!auth.currentUser) return;

    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userDoc.data() || {};
        const settings = userData.settings || {};

        // Profile settings
        const displayNameInput = document.getElementById('display-name');
        if (displayNameInput) {
            displayNameInput.value = settings.displayName || auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        }

        const emailNotificationsCheckbox = document.getElementById('email-notifications');
        if (emailNotificationsCheckbox) {
            emailNotificationsCheckbox.checked = settings.emailNotifications !== false;
        }

        const pushNotificationsCheckbox = document.getElementById('push-notifications');
        if (pushNotificationsCheckbox) {
            pushNotificationsCheckbox.checked = settings.pushNotifications !== false;
        }

        const reminderTimeInput = document.getElementById('reminder-time');
        if (reminderTimeInput) {
            reminderTimeInput.value = settings.reminderTime || '09:00';
        }

        // App preferences
        const themeSelect = document.getElementById('theme');
        if (themeSelect) {
            themeSelect.value = settings.theme || 'light';
        }

        const startWeekSelect = document.getElementById('start-week');
        if (startWeekSelect) {
            startWeekSelect.value = settings.startWeek || 'sunday';
        }

        const languageSelect = document.getElementById('language');
        if (languageSelect) {
            languageSelect.value = settings.language || 'en';
        }

        const timezoneSelect = document.getElementById('timezone');
        if (timezoneSelect) {
            timezoneSelect.value = settings.timezone || 'Asia/Kolkata';
        }

        // Attendance settings
        const defaultAttendanceSelect = document.getElementById('default-attendance');
        if (defaultAttendanceSelect) {
            defaultAttendanceSelect.value = settings.defaultAttendance || 'ask';
        }

        const attendanceReminderCheckbox = document.getElementById('attendance-reminder');
        if (attendanceReminderCheckbox) {
            attendanceReminderCheckbox.checked = settings.attendanceReminder !== false;
        }

        const streakGoalInput = document.getElementById('streak-goal');
        if (streakGoalInput) {
            streakGoalInput.value = settings.streakGoal || 95;
        }

        const workingDaysCheckboxes = document.querySelectorAll('input[name="working-days"]');
        const workingDays = settings.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        workingDaysCheckboxes.forEach(checkbox => {
            checkbox.checked = workingDays.includes(checkbox.value);
        });

        // Privacy & Security
        const dataSharingCheckbox = document.getElementById('data-sharing');
        if (dataSharingCheckbox) {
            dataSharingCheckbox.checked = settings.dataSharing || false;
        }

        const twoFactorCheckbox = document.getElementById('two-factor');
        if (twoFactorCheckbox) {
            twoFactorCheckbox.checked = settings.twoFactor || false;
        }

        const sessionTimeoutSelect = document.getElementById('session-timeout');
        if (sessionTimeoutSelect) {
            sessionTimeoutSelect.value = (settings.sessionTimeout || 60).toString();
        }

        // Data management
        const autoBackupCheckbox = document.getElementById('auto-backup');
        if (autoBackupCheckbox) {
            autoBackupCheckbox.checked = settings.autoBackup !== false;
        }

        const backupFrequencySelect = document.getElementById('backup-frequency');
        if (backupFrequencySelect) {
            backupFrequencySelect.value = settings.backupFrequency || 'weekly';
        }

        // Apply current theme
        applyTheme(settings.theme || 'light');
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSetting(key, value) {
    if (!currentUser) return;

    try {
        const settingsRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(settingsRef, {
            [`settings.${key}`]: value
        });
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
        body.classList.add('theme-auto');
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.classList.add('theme-dark');
        }
    } else {
        body.classList.add('theme-light');
    }
}

async function exportUserData() {
    if (!auth.currentUser) return;

    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userDoc.data() || {};

        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `bunk-smart-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('Data exported successfully!');
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data. Please try again.');
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

            // Validate data structure
            if (!data.attendance && !data.settings) {
                alert('Invalid data format. Please select a valid Bunk Smart export file.');
                return;
            }

            const confirmImport = confirm('This will overwrite your current data. Are you sure you want to continue?');
            if (!confirmImport) return;

            // Import data
            const updateData = {};
            if (data.attendance) updateData.attendance = data.attendance;
            if (data.settings) updateData.settings = data.settings;

            await updateDoc(doc(db, 'users', currentUser.uid), updateData);

            // Reload data
            attendanceData = data.attendance || {};
            updateStats();
            renderCalendar();
            loadInsights();
            loadSettings();

            alert('Data imported successfully!');
        } catch (error) {
            console.error('Error importing data:', error);
            alert('Error importing data. Please check the file format.');
        }
    };

    input.click();
}

async function clearAllData() {
    if (!currentUser) return;

    const confirmClear = confirm('Are you sure you want to clear all your data? This action cannot be undone.');
    if (!confirmClear) return;

    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            attendance: {},
            settings: {},
            challenges: {}
        });

        // Reset local state
        attendanceData = {};
        updateStats();
        renderCalendar();
        loadInsights();

        alert('All data cleared successfully!');
    } catch (error) {
        console.error('Error clearing data:', error);
        alert('Error clearing data. Please try again.');
    }
}

// Utility functions
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Simple toast function (will be enhanced with js/toasts.js later)
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Loading functions
function showLoading() {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    // Force hide after 10 seconds if stuck
    setTimeout(() => {
        hideLoading();
        console.warn('Loading timeout - hiding spinner');
    }, 10000);
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
