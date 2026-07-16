(function () {
  const style = document.createElement('style');
  style.textContent = `
    .selection-toolbar {
      position: absolute;
      z-index: 9999;
      display: none;
      gap: 0.35rem;
      padding: 0.4rem;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    }

    .selection-toolbar button {
      border: none;
      background: #ffffff;
      color: #111827;
      border-radius: 999px;
      padding: 0.35rem 0.7rem;
      font-size: 0.8rem;
      font-family: Georgia, 'Times New Roman', serif;
      cursor: pointer;
    }

    .selection-toolbar button:hover {
      background: #e5e7eb;
    }

    .selection-status {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 9999;
      background: rgba(17,24,39,0.95);
      color: #f9fafb;
      padding: 0.55rem 0.8rem;
      border-radius: 999px;
      font-size: 0.85rem;
      opacity: 0;
      pointer-events: none;
      transform: translateY(6px);
      transition: opacity 180ms ease, transform 180ms ease;
    }

    .selection-status.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  const toolbar = document.createElement('div');
  toolbar.className = 'selection-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Azioni per la selezione');
  toolbar.innerHTML = [
    '<button type="button" data-action="copy">Copia</button>',
    '<button type="button" data-action="chat">Chat</button>'
  ].join('');

  const status = document.createElement('div');
  status.className = 'selection-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  document.body.appendChild(toolbar);
  document.body.appendChild(status);

  function getSelectionText() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  }

  function hideToolbar() {
    toolbar.style.display = 'none';
  }

  function showToolbar() {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (!text) {
      hideToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      hideToolbar();
      return;
    }

    const toolbarHeight = toolbar.offsetHeight || 44;
    const toolbarWidth = 160;
    const left = Math.min(
      window.innerWidth - toolbarWidth - 16,
      Math.max(16, rect.left + window.scrollX + rect.width / 2 - toolbarWidth / 2)
    );
    const top = Math.max(16, rect.top + window.scrollY - toolbarHeight - 10);

    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    toolbar.style.display = 'inline-flex';
  }

  function showStatus(message) {
    status.textContent = message;
    status.classList.add('visible');
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
      status.classList.remove('visible');
    }, 1800);
  }

  function fallbackCopy(text) {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.left = '-9999px';
    helper.style.top = '-9999px';
    document.body.appendChild(helper);
    helper.select();
    try {
      document.execCommand('copy');
    } catch (error) {
      console.warn('Unable to copy selection', error);
    }
    document.body.removeChild(helper);
  }

  function copySelection(action) {
    const text = getSelectionText();
    if (!text) {
      showStatus('Nessuna selezione');
      return;
    }

    const payload = action === 'chat'
      ? `Selezione dal libro:\n${text}`
      : text;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(
        () => showStatus(action === 'chat' ? 'Selezione pronta per la chat' : 'Selezione copiata')),
        () => {
          fallbackCopy(payload);
          showStatus(action === 'chat' ? 'Selezione pronta per la chat' : 'Selezione copiata');
        }
      );
    } else {
      fallbackCopy(payload);
      showStatus(action === 'chat' ? 'Selezione pronta per la chat' : 'Selezione copiata');
    }
  }

  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    copySelection(action);
  });

  document.addEventListener('selectionchange', () => {
    const text = getSelectionText();
    if (!text) {
      hideToolbar();
      return;
    }
    showToolbar();
  });

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const text = getSelectionText();
      if (!text) {
        hideToolbar();
      } else {
        showToolbar();
      }
    }, 0);
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      hideToolbar();
    }
  });

  window.addEventListener('scroll', () => {
    const text = getSelectionText();
    if (text) {
      showToolbar();
    }
  }, true);
})();
