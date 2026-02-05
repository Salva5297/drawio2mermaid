/**
 * History Management
 * Stores and retrieves conversion history in localStorage
 */

const STORAGE_KEY = 'drawio2mermaid_history';
const MAX_HISTORY_ITEMS = 50;

/**
 * Get all history items
 */
export function getHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error reading history:', e);
    return [];
  }
}

/**
 * Add item to history
 */
export function addToHistory(item) {
  const history = getHistory();
  
  const newItem = {
    id: generateId(),
    timestamp: Date.now(),
    type: item.type, // 'drawio-to-mermaid' or 'mermaid-to-drawio'
    name: item.name || `Conversión ${new Date().toLocaleString('es-ES')}`,
    sourceType: item.sourceType,
    source: item.source?.substring(0, 500000), // Limit stored content (increased)
    result: item.result?.substring(0, 500000)
  };
  
  // Add to beginning
  history.unshift(newItem);
  
  // Limit history size
  while (history.length > MAX_HISTORY_ITEMS) {
    history.pop();
  }
  
  saveHistory(history);
  return newItem;
}

/**
 * Remove item from history
 */
export function removeFromHistory(id) {
  const history = getHistory().filter(item => item.id !== id);
  saveHistory(history);
}

/**
 * Clear all history
 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing history:', e);
  }
}

/**
 * Save history to localStorage
 */
function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Error saving history:', e);
    // Try to free up space by removing old items
    if (e.name === 'QuotaExceededError') {
      const trimmed = history.slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  }
}

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Render history list
 */
export function renderHistoryList(containerId, onSelect, onDelete) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const history = getHistory();
  
  if (history.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <p>No hay conversiones en el historial</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = history.map(item => `
    <div class="history-item" data-history-id="${item.id}">
      <div class="history-item-info">
        <div class="history-item-title">${escapeHtml(item.name)}</div>
        <div class="history-item-date">${formatDate(item.timestamp)}</div>
      </div>
      <span class="history-item-type ${item.sourceType}">${getTypeLabel(item.type)}</span>
      <button class="history-item-delete btn btn-xs" data-delete-id="${item.id}" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Ignore delete button clicks
      if (e.target.closest('.history-item-delete')) return;
      
      const historyId = item.dataset.historyId;
      const historyItem = history.find(h => h.id === historyId);
      if (historyItem && onSelect) {
        onSelect(historyItem);
      }
    });
  });
  
  // Add delete handlers
  container.querySelectorAll('.history-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const deleteId = btn.dataset.deleteId;
      removeFromHistory(deleteId);
      renderHistoryList(containerId, onSelect, onDelete);
      if (onDelete) onDelete(deleteId);
    });
  });
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return minutes <= 1 ? 'Hace un momento' : `Hace ${minutes} minutos`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return days === 1 ? 'Ayer' : `Hace ${days} días`;
  }
  
  // Default: full date
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Get readable type label
 */
function getTypeLabel(type) {
  const labels = {
    'drawio-to-mermaid': 'D→M',
    'mermaid-to-drawio': 'M→D'
  };
  return labels[type] || type;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default {
  getHistory,
  addToHistory,
  removeFromHistory,
  clearHistory,
  renderHistoryList
};
