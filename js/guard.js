import { auth } from './firebase.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

let currentUser = null;

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
    return;
  }
  
  // !user but loggedInUser set: Wait for Firebase sync (common on redirect)
  console.log('Waiting for Firebase auth sync...');
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) loadingOverlay.style.display = 'flex'; // Show loading during wait
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
