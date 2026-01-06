// auth.js
import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Function to get user-friendly error messages
function getFriendlyErrorMessage(error) {
  const errorCode = error.code;

  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password. Please check and try again.';

    case 'auth/user-not-found':
      return 'No account found with this email. Click "Create an account" below to sign up.';

    case 'auth/email-already-in-use':
      return 'This email is already registered. Switch to "Login" to sign in with this email.';

    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';

    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. Please try again.';

    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open.';

    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email. Try signing in with a different method.';

    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';

    case 'auth/missing-email':
      return 'If an account with this email exists, a password reset link has been sent.';

    default:
      return 'Something went wrong. Please try again.';
  }
}

// DOM elements
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const toggleText = document.getElementById("toggle-text");
const googleBtn = document.getElementById("google-btn");
const githubBtn = document.getElementById("github-btn");
const forgotPasswordLink = document.getElementById("forgot-password-link");

// Password visibility toggles (only if elements exist)
const loginPasswordToggle = document.getElementById("login-toggle");
const signupPasswordToggle = document.getElementById("signup-toggle");
const loginPasswordInput = document.getElementById("login-password");
const signupPasswordInput = document.getElementById("signup-password");

// Password toggle functionality
function togglePasswordVisibility(passwordInput, toggleButton) {
  if (!passwordInput || !toggleButton) return;

  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";

  // Update button icon and title
  const eyeIcon = toggleButton.querySelector(".eye-icon");
  if (eyeIcon) {
    if (isPassword) {
      // Show password - use eye-slash icon
      eyeIcon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92 1.11-1.11L3.51 2.3 2.4 3.41l2.92 2.92C4.13 8.74 4 9.35 4 10c0 2.76 2.24 5 5 5 .65 0 1.26-.13 1.83-.36l.55.55c-.75.22-1.56.36-2.38.36-4.41 0-8-3.59-8-8s3.59-8 8-8c.82 0 1.63.14 2.38.36l-.55.55C9.26 4.13 8.65 4 8 4c-2.76 0-5 2.24-5 5 0 .65.13 1.26.36 1.83L12 7z"/>';
      toggleButton.title = "Hide password";
    } else {
      // Hide password - use eye icon
      eyeIcon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
      toggleButton.title = "Show password";
    }
  }
}

// Add event listeners for password toggles (only if elements exist)
if (loginPasswordToggle && loginPasswordInput) {
  loginPasswordToggle.addEventListener("click", () => {
    togglePasswordVisibility(loginPasswordInput, loginPasswordToggle);
  });
}

if (signupPasswordToggle && signupPasswordInput) {
  signupPasswordToggle.addEventListener("click", () => {
    togglePasswordVisibility(signupPasswordInput, signupPasswordToggle);
  });
}

// Check URL params for mode (only if elements exist)
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
if (mode === 'signup' && signupForm && loginForm && toggleText) {
  signupForm.removeAttribute("hidden");
  loginForm.setAttribute("hidden", true);
  toggleText.textContent = "Already have an account?";
} else if (loginForm && signupForm && toggleText) {
  loginForm.removeAttribute("hidden");
  signupForm.setAttribute("hidden", true);
  toggleText.textContent = "Create an account";
}

// Toggle login/signup (only if elements exist)
if (toggleText && loginForm && signupForm) {
  toggleText.addEventListener("click", () => {
    const isLoginHidden = loginForm.hasAttribute("hidden");
    if (isLoginHidden) {
      loginForm.removeAttribute("hidden");
      signupForm.setAttribute("hidden", true);
      toggleText.textContent = "Create an account";
    } else {
      signupForm.removeAttribute("hidden");
      loginForm.setAttribute("hidden", true);
      toggleText.textContent = "Login";
    }
  });
}

// Email/Password Login (only if form exists)
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = loginPasswordInput.value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Logged in:", userCredential.user);
      alert(`Welcome back, ${userCredential.user.displayName || userCredential.user.email}!`);
      // Close modal
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.classList.remove('show');
        document.body.classList.remove('auth-modal-active');
      }
      // Set user as logged in for guard.js
      localStorage.setItem("loggedInUser", userCredential.user.email);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Login error:", error);
      alert(`Login failed: ${getFriendlyErrorMessage(error)}`);
    }
  });
}

// Email/Password Signup (only if form exists)
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signup-name").value;
    const email = document.getElementById("signup-email").value;
    const password = signupPasswordInput.value;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Account created:", userCredential.user);
      alert("Account created successfully!");
      // Update display name if provided
      if (name) {
        try {
          await userCredential.user.updateProfile({ displayName: name });
        } catch (error) {
          console.error("Update profile error:", error);
        }
      }
      // Close modal
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.classList.remove('show');
        document.body.classList.remove('auth-modal-active');
      }
      // Set user as logged in for guard.js
      localStorage.setItem("loggedInUser", userCredential.user.email);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Signup error:", error);
      alert(`Signup failed: ${getFriendlyErrorMessage(error)}`);
    }
  });
}

// Google Login (only if button exists)
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("Google login:", result.user);
      alert(`Welcome, ${result.user.displayName}!`);
      // Close modal
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.classList.remove('show');
        document.body.classList.remove('auth-modal-active');
      }
      // Set user as logged in for guard.js
      localStorage.setItem("loggedInUser", result.user.email);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Google login error:", error);
      alert(`Google login failed: ${getFriendlyErrorMessage(error)}`);
    }
  });
}

// GitHub Login (only if button exists)
if (githubBtn) {
  githubBtn.addEventListener("click", async () => {
    const provider = new GithubAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("GitHub login:", result.user);
      alert(`Welcome, ${result.user.displayName || result.user.email}!`);
      // Close modal
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.classList.remove('show');
        document.body.classList.remove('auth-modal-active');
      }
      // Set user as logged in for guard.js
      localStorage.setItem("loggedInUser", result.user.email);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("GitHub login error:", error);
      alert(`GitHub login failed: ${getFriendlyErrorMessage(error)}`);
    }
  });
}

// Forgot Password (only if link exists)
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("login-email");
    let email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
      email = prompt("Enter your email address to reset your password:");
    }

    if (!email) {
      alert("Please enter your email address.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox (and spam folder) for instructions.");
    } catch (error) {
      console.error("Password reset error:", error);
      alert(`Password reset failed: ${getFriendlyErrorMessage(error)}`);
    }
  });
}
