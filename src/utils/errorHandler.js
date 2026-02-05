/**
 * Error Handler
 * Centralized error handling with toast notifications
 */

const TOAST_DURATION = 5000;
let toastContainer = null;

/**
 * Initialize error handler
 */
export function initErrorHandler() {
  toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

/**
 * Show error toast
 */
export function showError(title, message, options = {}) {
  showToast({
    type: 'error',
    title,
    message,
    duration: options.duration || TOAST_DURATION
  });
}

/**
 * Show success toast
 */
export function showSuccess(title, message, options = {}) {
  showToast({
    type: 'success',
    title,
    message,
    duration: options.duration || TOAST_DURATION
  });
}

/**
 * Show warning toast
 */
export function showWarning(title, message, options = {}) {
  showToast({
    type: 'warning',
    title,
    message,
    duration: options.duration || TOAST_DURATION
  });
}

/**
 * Show info toast
 */
export function showInfo(title, message, options = {}) {
  showToast({
    type: 'info',
    title,
    message,
    duration: options.duration || TOAST_DURATION
  });
}

/**
 * Create and show a toast notification
 */
function showToast({ type, title, message, duration }) {
  if (!toastContainer) {
    initErrorHandler();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = getIconForType(type);
  
  toast.innerHTML = `
    ${icon}
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Cerrar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;
  
  // Add close handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  
  return toast;
}

/**
 * Remove a toast
 */
function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  
  toast.style.animation = 'slideOut 0.25s ease-out forwards';
  
  // Add slideOut animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideOut {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);
  
  setTimeout(() => {
    toast.remove();
    style.remove();
  }, 250);
}

/**
 * Get icon SVG for toast type
 */
function getIconForType(type) {
  const icons = {
    error: `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M15 9l-6 6M9 9l6 6"/>
      </svg>
    `,
    success: `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    `,
    warning: `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <path d="M12 9v4M12 17h.01"/>
      </svg>
    `,
    info: `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </svg>
    `
  };
  
  return icons[type] || icons.info;
}

/**
 * Format error for display
 */
export function formatError(error) {
  if (typeof error === 'string') {
    return { title: 'Error', message: error };
  }
  
  if (error instanceof Error) {
    return {
      title: error.name || 'Error',
      message: error.message || 'Ha ocurrido un error inesperado'
    };
  }
  
  return {
    title: 'Error',
    message: 'Ha ocurrido un error inesperado'
  };
}

/**
 * Format parsing error with line info
 */
export function formatParseError(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return { title: 'Error de Sintaxis', message: 'Error al parsear el código' };
  }
  
  const errorMessages = errors.map(e => 
    e.line ? `Línea ${e.line}: ${e.message}` : e.message
  ).join('\n');
  
  return {
    title: `${errors.length} Error${errors.length > 1 ? 'es' : ''} de Sintaxis`,
    message: errorMessages
  };
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
  if (toastContainer) {
    toastContainer.innerHTML = '';
  }
}

export default {
  initErrorHandler,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  formatError,
  formatParseError,
  clearAllToasts
};
