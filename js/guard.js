import { auth } from './firebase.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

let currentUser = null;
let _authSyncTimeout = null;

onAuthStateChanged(auth, (user) => {
  const loggedInUser = localStorage.getItem('loggedInUser');

  if (!user && !loggedInUser) {
    // No user in Firebase or localStorage - redirect to landing, unless on login page
    if (!window.location.pathname.includes('login.html')) {
      const loadingOverlay = document.querySelector('.loading-overlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      window.location.href = 'index.html';
      return;
    }
  }

  if (user) {
    currentUser = user;
    // Hide loading
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    // Clear any pending auth-sync timeout if set
    if (_authSyncTimeout) {
      clearTimeout(_authSyncTimeout);
      _authSyncTimeout = null;
    }
    return;
  }

  // !user but loggedInUser set: Wait for Firebase sync (common on redirect)
  console.log('Waiting for Firebase auth sync...');
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) loadingOverlay.style.display = 'flex'; // Show loading during wait

  // If auth doesn't sync within a few seconds, clear local flag and redirect to login to avoid stuck UI
  if (loggedInUser && !_authSyncTimeout) {
    _authSyncTimeout = setTimeout(() => {
      console.warn('Auth sync timeout - redirecting to login and clearing stored flag');
      localStorage.removeItem('loggedInUser');
      const lo = document.querySelector('.loading-overlay');
      if (lo) lo.style.display = 'none';
      if (!window.location.pathname.includes('login.html')) window.location.href = 'login.html';
    }, 7000);
  }
});

export { currentUser };

// Logout function using Firebase
export function logoutUser() {
  signOut(auth).then(() => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
  }).catch((error) => {
    console.error('Error signing out:', error);
    alert('Error signing out. Please try again.');
  });
}

// Attach logout to dashboard button if present
if (document.getElementById('signout-btn')) {
  document.getElementById('signout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    logoutUser();
  });
}
