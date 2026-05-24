/**
 * BLEND COOKIE CONSENT MANAGER
 * PECR-compliant cookie consent system for Blend Technologies marketing site.
 *
 * Manages consent for non-essential cookies (Calendly scheduling widget).
 * Stores user choice in localStorage and gates Calendly loading until consent is granted.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'blend_cookie_consent';
  const CONSENT_ACCEPTED = 'accepted';
  const CONSENT_REJECTED = 'rejected';
  const CALENDLY_WIDGET_CSS = 'https://assets.calendly.com/assets/external/widget.css';
  const CALENDLY_WIDGET_JS = 'https://assets.calendly.com/assets/external/widget.js';

  let calendlyLoaded = false;
  let calendlyLoading = false;
  let pendingCalendlyCallback = null;

  /**
   * Get stored consent choice
   */
  function getConsent() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const data = JSON.parse(stored);
      return data.choice;
    } catch (e) {
      return null;
    }
  }

  /**
   * Save consent choice
   */
  function saveConsent(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        choice: choice,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Could not save cookie consent preference:', e);
    }
  }

  /**
   * Show the cookie banner
   */
  function showBanner(message) {
    const banner = document.getElementById('blend-cookie-banner');
    if (!banner) return;

    // Update message if provided (for demo-booking prompts)
    if (message) {
      const textEl = banner.querySelector('.blend-cookie-banner-text');
      if (textEl) {
        const privacyLink = textEl.querySelector('a');
        textEl.innerHTML = message + ' ';
        if (privacyLink) {
          textEl.appendChild(privacyLink);
        }
      }
    }

    banner.classList.remove('hidden');

    // Focus first button for accessibility
    const firstBtn = banner.querySelector('.blend-cookie-banner-btn');
    if (firstBtn) {
      setTimeout(() => firstBtn.focus(), 100);
    }
  }

  /**
   * Hide the cookie banner
   */
  function hideBanner() {
    const banner = document.getElementById('blend-cookie-banner');
    if (banner) {
      banner.classList.add('hidden');
    }
  }

  /**
   * Load Calendly scripts dynamically
   */
  function loadCalendly(callback) {
    if (calendlyLoaded) {
      if (callback) callback();
      return;
    }

    if (calendlyLoading) {
      // Already loading, queue the callback
      if (callback) {
        const originalCallback = pendingCalendlyCallback;
        pendingCalendlyCallback = function() {
          if (originalCallback) originalCallback();
          callback();
        };
      }
      return;
    }

    calendlyLoading = true;
    if (callback) pendingCalendlyCallback = callback;

    // Load CSS (doesn't set cookies, safe to load)
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = CALENDLY_WIDGET_CSS;
    document.head.appendChild(cssLink);

    // Load JS (sets cookies, gated by consent)
    const script = document.createElement('script');
    script.src = CALENDLY_WIDGET_JS;
    script.type = 'text/javascript';
    script.async = true;

    script.onload = function() {
      calendlyLoaded = true;
      calendlyLoading = false;
      if (pendingCalendlyCallback) {
        pendingCalendlyCallback();
        pendingCalendlyCallback = null;
      }
    };

    script.onerror = function() {
      calendlyLoading = false;
      console.error('Failed to load Calendly widget');
      if (pendingCalendlyCallback) {
        pendingCalendlyCallback = null;
      }
    };

    document.head.appendChild(script);
  }

  /**
   * Handle accept consent
   */
  function handleAccept() {
    saveConsent(CONSENT_ACCEPTED);
    hideBanner();
    loadCalendly(function() {
      // If there was a pending demo booking, trigger it now
      if (window.blendPendingCalendlyUrl) {
        const url = window.blendPendingCalendlyUrl;
        window.blendPendingCalendlyUrl = null;
        if (window.Calendly && window.Calendly.initPopupWidget) {
          window.Calendly.initPopupWidget({ url: url });
        }
      }
    });
  }

  /**
   * Handle reject consent
   */
  function handleReject() {
    saveConsent(CONSENT_REJECTED);
    hideBanner();
  }

  /**
   * Initialize consent banner
   */
  function initBanner() {
    const consent = getConsent();

    if (consent === CONSENT_ACCEPTED) {
      // User previously accepted, load Calendly automatically
      loadCalendly();
    } else if (consent === CONSENT_REJECTED) {
      // User previously rejected, don't show banner or load Calendly
      hideBanner();
    } else {
      // No stored choice, show banner
      showBanner();
    }

    // Attach event listeners
    const acceptBtn = document.getElementById('blend-cookie-accept');
    const rejectBtn = document.getElementById('blend-cookie-reject');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', handleAccept);
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', handleReject);
    }
  }

  /**
   * Public API for opening demo booking (gated by consent)
   */
  window.blendBookDemo = function(calendlyUrl) {
    const consent = getConsent();

    if (consent === CONSENT_ACCEPTED) {
      // Consent already given, load and open
      loadCalendly(function() {
        if (window.Calendly && window.Calendly.initPopupWidget) {
          window.Calendly.initPopupWidget({ url: calendlyUrl });
        }
      });
    } else {
      // No consent or rejected, show banner with explanation
      window.blendPendingCalendlyUrl = calendlyUrl;
      showBanner(
        'To book a demo, we need to load Calendly\'s scheduling widget, which sets cookies. ' +
        'You can accept just for this session or reject to continue browsing without booking.'
      );
    }

    return false;
  };

  /**
   * Public API for opening cookie settings (re-show banner)
   */
  window.blendOpenCookieSettings = function() {
    showBanner();
    return false;
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBanner);
  } else {
    initBanner();
  }

})();
