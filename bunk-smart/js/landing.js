import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

// Update UI for authenticated users
function updateUIForAuthenticatedUser(user) {
  // Change sign in button to "Sign Out"
  const signinBtn = document.getElementById('signin-btn');
  if (signinBtn) {
    signinBtn.textContent = 'Sign Out';
  }

  // Change get started button to "Go to Dashboard"
  const getStartedBtn = document.getElementById('get-started-btn');
  if (getStartedBtn) {
    getStartedBtn.textContent = 'Go to Dashboard';
  }

  // Change CTA button to "Go to Dashboard"
  const ctaGetStartedBtn = document.getElementById('cta-get-started');
  if (ctaGetStartedBtn) {
    ctaGetStartedBtn.textContent = 'Go to Dashboard';
  }

  // Update hero text to welcome back
  const heroTitle = document.querySelector('.hero-text h1');
  if (heroTitle) {
    const displayName = user.displayName || user.email.split('@')[0];
    heroTitle.innerHTML = `Welcome back, ${displayName}!<br><span class="gradient-text">Continue Your Journey</span>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Show loading overlay immediately
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) loadingOverlay.style.display = 'flex';

  // Auth check for landing page - don't redirect, just update UI
  onAuthStateChanged(auth, (user) => {
    const loggedInUser = localStorage.getItem('loggedInUser');

    if (user && loggedInUser) {
      // User is authenticated - update UI to show dashboard access
      updateUIForAuthenticatedUser(user);
    } else if (loggedInUser && !user) {
      // Desync: keep localStorage, assume authenticated
      updateUIForAuthenticatedUser({ email: loggedInUser, displayName: localStorage.getItem('userDisplayName') || loggedInUser.split('@')[0] });
    }
    // No user or not authenticated - show normal landing page

    // Hide loading overlay
    if (loadingOverlay) loadingOverlay.style.display = 'none';

    // Button event listeners
    const signinBtn = document.getElementById('signin-btn');
    const getStartedBtn = document.getElementById('get-started-btn');
    const ctaGetStartedBtn = document.getElementById('cta-get-started');
    const authModal = document.getElementById('auth-modal');
    const authModalClose = document.getElementById('auth-modal-close');

    // Show modal function
    const showAuthModal = (mode = 'login') => {
      if (auth.currentUser) {
        window.location.href = 'dashboard.html';
        return;
      }
      if (!authModal) return;
      authModal.classList.add('show');
      document.body.classList.add('auth-modal-active');
      // Set initial form based on mode
      const loginForm = document.getElementById('login-form');
      const signupForm = document.getElementById('signup-form');
      const toggleText = document.getElementById('toggle-text');

      if (mode === 'signup') {
        if (loginForm) loginForm.hidden = true;
        if (signupForm) signupForm.hidden = false;
        if (toggleText) toggleText.textContent = 'Already have an account?';
      } else {
        if (loginForm) loginForm.hidden = false;
        if (signupForm) signupForm.hidden = true;
        if (toggleText) toggleText.textContent = 'Create an account';
      }
    };

    // Set default onclick
    if (signinBtn) signinBtn.onclick = async () => {
      if (signinBtn.textContent.includes('Sign Out')) {
        await signOut(auth);
        localStorage.removeItem('loggedInUser');
        window.location.reload();
      } else {
        window.location.href = 'login.html';
      }
    };
    if (getStartedBtn) getStartedBtn.onclick = () => {
      if (getStartedBtn.textContent.includes('Dashboard')) {
        window.location.href = 'dashboard.html';
      } else {
        window.location.href = 'login.html?mode=signup';
      }
    };
    if (ctaGetStartedBtn) ctaGetStartedBtn.onclick = () => {
      if (ctaGetStartedBtn.textContent.includes('Dashboard')) {
        window.location.href = 'dashboard.html';
      } else {
        window.location.href = 'login.html?mode=signup';
      }
    };

    // Hide modal function
    const hideAuthModal = () => {
      if (!authModal) return;
      authModal.classList.remove('show');
      document.body.classList.remove('auth-modal-active');
    };

    // Close modal
    authModalClose?.addEventListener('click', hideAuthModal);

    // Close modal when clicking outside
    authModal?.addEventListener('click', (e) => {
      if (e.target === authModal) {
        hideAuthModal();
      }
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    // Add scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(card);
    });

    // Add floating animation to calendar preview
    const floatingCard = document.querySelector('.floating-card');
    if (floatingCard) {
      let animationId;
      let startTime = null;

      function animateFloat(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;

        const floatOffset = Math.sin(elapsed * 0.001) * 10;
        floatingCard.style.transform = `translateY(${floatOffset}px)`;

        animationId = requestAnimationFrame(animateFloat);
      }

      animationId = requestAnimationFrame(animateFloat);
    }
  });
});
