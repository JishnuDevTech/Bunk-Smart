// attendance.js

const calendarGrid = document.querySelector(".calendar-grid");
const modal = document.querySelector(".modal");
const modalCloseBtn = modal?.querySelector(".modal-close");
const modalPresentBtn = modal?.querySelector("button:nth-of-type(1)");
const modalBunkBtn = modal?.querySelector("button:nth-of-type(2)");
const modalSaveBtn = modal?.querySelector("button:last-of-type");
const bunkDetails = modal?.querySelector(".bunk-details");
const bunkDidInput = bunkDetails?.querySelector("input:nth-of-type(1)");
const bunkMissedInput = bunkDetails?.querySelector("input:nth-of-type(2)");

let selectedDate = null;
let currentMonth = new Date(2026, 0, 1); // January 2026
let attendanceData = Storage.getAttendance();

// Month navigation
const prevMonthBtn = document.querySelector(".month-header button:first-of-type");
const nextMonthBtn = document.querySelector(".month-header button:last-of-type");
const monthDisplay = document.querySelector(".month-header h3");

prevMonthBtn?.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  updateMonthDisplay();
  generateCalendar();
});

nextMonthBtn?.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  updateMonthDisplay();
  generateCalendar();
});

function updateMonthDisplay() {
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  monthDisplay.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
}

// Generate calendar (dynamic)
function generateCalendar() {
  calendarGrid.innerHTML = `
    <div class="day-name">Sun</div>
    <div class="day-name">Mon</div>
    <div class="day-name">Tue</div>
    <div class="day-name">Wed</div>
    <div class="day-name">Thu</div>
    <div class="day-name">Fri</div>
    <div class="day-name">Sat</div>
  `;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  for (let i = 0; i < 42; i++) {
    const cell = document.createElement("div");
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);

    if (cellDate.getMonth() === month) {
      cell.classList.add("day-cell");
      cell.textContent = cellDate.getDate();
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;
      if (attendanceData[key]?.status === "present") cell.classList.add("present");
      if (attendanceData[key]?.status === "bunk") cell.classList.add("bunk");

      cell.addEventListener("click", () => {
        selectedDate = key;
        modal.removeAttribute("hidden");
        if (attendanceData[selectedDate]?.status === "bunk") {
          bunkDetails.style.display = "flex";
          bunkDidInput.value = attendanceData[selectedDate]?.did || "";
          bunkMissedInput.value = attendanceData[selectedDate]?.missed || "";
        } else {
          bunkDetails.style.display = "none";
          bunkDidInput.value = "";
          bunkMissedInput.value = "";
        }
      });
    } else {
      cell.classList.add("day-cell", "inactive");
      cell.textContent = cellDate.getDate();
    }

    calendarGrid.appendChild(cell);
  }
}

modalPresentBtn?.addEventListener("click", () => {
  attendanceData[selectedDate] = { status: "present" };
  Storage.saveAttendance(selectedDate, attendanceData[selectedDate]);
  generateCalendar();
  modal.setAttribute("hidden", true);
});

modalBunkBtn?.addEventListener("click", () => {
  bunkDetails.style.display = "flex";
});

modalSaveBtn?.addEventListener("click", () => {
  const did = bunkDidInput.value;
  const missed = bunkMissedInput.value;
  attendanceData[selectedDate] = { status: "bunk", did, missed };
  Storage.saveAttendance(selectedDate, attendanceData[selectedDate]);
  generateCalendar();
  modal.setAttribute("hidden", true);
});

// Close modal functionality
modalCloseBtn?.addEventListener("click", () => {
  modal.setAttribute("hidden", true);
});

modal?.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.setAttribute("hidden", true);
  }
});

updateMonthDisplay();
generateCalendar();
