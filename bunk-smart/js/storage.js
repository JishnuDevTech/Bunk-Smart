// storage.js
// Abstracted interface: attendance + challenges
// Note: This uses localStorage as fallback, but primary storage should be Firebase

const Storage = (() => {

  function saveAttendance(date, data) {
    const user = localStorage.getItem("loggedInUser");
    if (!user) {
      console.warn('No user logged in, cannot save attendance');
      return;
    }
    const key = `${user}_attendance`;
    const all = JSON.parse(localStorage.getItem(key) || "{}");
    all[date] = data;
    localStorage.setItem(key, JSON.stringify(all));
  }

  function getAttendance() {
    const user = localStorage.getItem("loggedInUser");
    if (!user) {
      console.warn('No user logged in, returning empty attendance data');
      return {};
    }
    const key = `${user}_attendance`;
    return JSON.parse(localStorage.getItem(key) || "{}");
  }

  function saveChallenge(challengeId, data) {
    const user = localStorage.getItem("loggedInUser");
    if (!user) {
      console.warn('No user logged in, cannot save challenge');
      return;
    }
    const key = `${user}_challenges`;
    const all = JSON.parse(localStorage.getItem(key) || "{}");
    all[challengeId] = data;
    localStorage.setItem(key, JSON.stringify(all));
  }

  function getChallenges() {
    const user = localStorage.getItem("loggedInUser");
    if (!user) {
      console.warn('No user logged in, returning empty challenges data');
      return {};
    }
    const key = `${user}_challenges`;
    return JSON.parse(localStorage.getItem(key) || "{}");
  }

  return { saveAttendance, getAttendance, saveChallenge, getChallenges };
})();
