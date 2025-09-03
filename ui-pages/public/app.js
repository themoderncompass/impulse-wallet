@ -698,3 +698,34 @@ setInterval(() => {
    initWeeklyFocusUI(); // will show unlocked state for the new week
  }
}, 60 * 1000); // check once per minute

// === Legal modals: Privacy + Terms (reuse your existing modal pattern) ===
(function wireLegalModals() {
  function wire(openId, modalId, closeId) {
    const openBtn  = document.getElementById(openId);
    const modal    = document.getElementById(modalId);
    const closeBtn = document.getElementById(closeId);
    if (!openBtn || !modal || !closeBtn) return;

    let lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      modal.querySelector('.modal-content')?.focus();
      document.addEventListener('keydown', onKey);
    }
    function close() {
      modal.hidden = true;
      document.removeEventListener('keydown', onKey);
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  wire('open-privacy', 'privacy-modal', 'privacy-close');
  wire('open-terms',   'terms-modal',   'terms-close');
})();
