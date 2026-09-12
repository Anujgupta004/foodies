/* =============================================
   FOODIES.COM — Dark Mode Manager
   Include this file on EVERY page
   ============================================= */

(function () {
  const KEY = 'foodies_theme';

  // ── Apply theme immediately (before render to avoid flash) ──
  function applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Update all toggle button icons on page
    document.querySelectorAll('[data-dark-toggle]').forEach(btn => {
      btn.innerHTML = dark
        ? '<i class="bi bi-sun-fill"></i>'
        : '<i class="bi bi-moon-fill"></i>';
      btn.title = dark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
  }

  // ── Check saved preference or system preference ──
  function getSavedTheme() {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved === 'dark';
    // Fallback to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ── Toggle ──
  window.toggleDarkMode = function () {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(KEY, isDark ? 'dark' : 'light');
    applyTheme(isDark);
  };

  // ── Init on load ──
  applyTheme(getSavedTheme());

  // ── Listen for system theme change ──
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    // Only auto-switch if user hasn't manually set a preference
    if (!localStorage.getItem(KEY)) {
      applyTheme(e.matches);
    }
  });

  // ── Attach click to all toggle buttons after DOM ready ──
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-dark-toggle]').forEach(btn => {
      btn.addEventListener('click', window.toggleDarkMode);
    });
    // Re-apply to update icons after DOM is ready
    applyTheme(getSavedTheme());
  });
})();
