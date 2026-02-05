/**
 * Mermaid Editor
 * Handles the Mermaid code editor with syntax highlighting preview
 */

import mermaid from 'mermaid';

let editorElement = null;
let previewElement = null;
let debounceTimer = null;
let currentCode = '';
let onChangeCallback = null;
let onErrorCallback = null;
let zoomLevel = 1;

/**
 * Initialize the Mermaid editor
 */
export function initMermaidEditor(editorId, previewId, options = {}) {
  editorElement = document.getElementById(editorId);
  previewElement = document.getElementById(previewId);
  
  if (!editorElement || !previewElement) {
    throw new Error('Editor or preview element not found');
  }
  
  // Initialize Mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: options.theme || 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: 'basis'
    },
    sequence: {
      useMaxWidth: false,
      diagramMarginX: 50,
      diagramMarginY: 10
    }
  });
  
  // Setup editor event listeners
  editorElement.addEventListener('input', handleInput);
  editorElement.addEventListener('keydown', handleKeydown);
  
  // Setup zoom controls
  setupZoomControls();
  
  return {
    setCode,
    getCode,
    render: renderPreview,
    onChange: (callback) => { onChangeCallback = callback; },
    onError: (callback) => { onErrorCallback = callback; },
    setTheme
  };
}

/**
 * Setup zoom controls
 */
function setupZoomControls() {
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const zoomReset = document.getElementById('zoom-reset');
  
  if (zoomIn) {
    zoomIn.addEventListener('click', () => {
      zoomLevel = Math.min(zoomLevel + 0.25, 10);
      applyZoom();
    });
  }
  
  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      zoomLevel = Math.max(zoomLevel - 0.25, 0.1);
      applyZoom();
    });
  }
  
  if (zoomReset) {
    zoomReset.addEventListener('click', () => {
      zoomLevel = 1;
      applyZoom();
    });
  }
}

/**
 * Apply zoom to preview
 */
function applyZoom() {
  if (!previewElement) return;
  
  const svg = previewElement.querySelector('svg');
  if (svg) {
    // 1. Reset any previous constraints
    svg.style.maxWidth = 'none';
    
    // 2. Instead of percentage-based width which is relative to the small container,
    // we use a large fixed pixel scale. 
    // Mermaid SVGs have a viewBox that defines their internal natural size.
    // If we set width to "500%", it grows relative to container.
    // But if we want REALLY close inspection, we can go higher.
    
    // Let's use the width and apply the zoomLevel.
    // We'll also make sure the svg expands the container so scrollbars appear.
    svg.style.width = `${zoomLevel * 100}%`;
    svg.style.minWidth = `${zoomLevel * 100}%`; // Force expansion
    svg.style.height = 'auto';
    svg.style.display = 'block';
    svg.style.margin = '0'; // Align to top-left to allow scrolling
    svg.style.flexShrink = '0'; // Prevent flex container from shrinking the zoomed image
    
    // Some SVGs might have a max-width injected by Mermaid we need to kill harder
    svg.style.removeProperty('max-width');
    svg.style.setProperty('max-width', 'none', 'important');
    
    // Remove any legacy transform
    svg.style.transform = '';
  }
}

/**
 * Handle input changes with debounce
 */
function handleInput(event) {
  currentCode = event.target.value;
  
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    renderPreview();
    if (onChangeCallback) {
      onChangeCallback(currentCode);
    }
  }, 300);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeydown(event) {
  // Tab key - insert spaces
  if (event.key === 'Tab') {
    event.preventDefault();
    const start = editorElement.selectionStart;
    const end = editorElement.selectionEnd;
    const value = editorElement.value;
    
    editorElement.value = value.substring(0, start) + '    ' + value.substring(end);
    editorElement.selectionStart = editorElement.selectionEnd = start + 4;
    
    handleInput({ target: editorElement });
  }
}

/**
 * Set code in editor
 */
export function setCode(code) {
  currentCode = code;
  if (editorElement) {
    editorElement.value = code;
  }
  renderPreview();
}

/**
 * Get current code from editor
 */
export function getCode() {
  return currentCode;
}

/**
 * Render the Mermaid preview
 */
export async function renderPreview() {
  if (!previewElement || !currentCode.trim()) {
    showPlaceholder();
    return null;
  }
  
  try {
    // Generate unique ID for this render
    const id = `mermaid-${Date.now()}`;
    
    // Validate and render
    const { svg } = await mermaid.render(id, currentCode);
    
    // Display SVG
    previewElement.innerHTML = svg;
    applyZoom();
    
    // Clear any previous errors
    clearError();
    
    return svg;
    
  } catch (error) {
    showError(error);
    return null;
  }
}

/**
 * Show placeholder when no content
 */
function showPlaceholder() {
  if (!previewElement) return;
  
  previewElement.innerHTML = `
    <div class="preview-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
      <p>La vista previa aparecerá aquí</p>
    </div>
  `;
}

/**
 * Show error in preview
 */
function showError(error) {
  if (!previewElement) return;
  
  const errorMessage = error.message || 'Error de sintaxis en el código Mermaid';
  
  // Extract line number if available
  let lineInfo = '';
  const lineMatch = errorMessage.match(/line\s+(\d+)/i);
  if (lineMatch) {
    lineInfo = ` (línea ${lineMatch[1]})`;
  }
  
  previewElement.innerHTML = `
    <div class="preview-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4M12 16h.01"/>
      </svg>
      <p>Error en el diagrama${lineInfo}</p>
      <small>${escapeHtml(errorMessage)}</small>
    </div>
  `;
  
  // Style the error
  const errorDiv = previewElement.querySelector('.preview-error');
  if (errorDiv) {
    errorDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-error);
      text-align: center;
      padding: 2rem;
    `;
    
    const svg = errorDiv.querySelector('svg');
    if (svg) {
      svg.style.cssText = 'width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;';
    }
    
    const small = errorDiv.querySelector('small');
    if (small) {
      small.style.cssText = `
        margin-top: 0.5rem;
        color: var(--color-text-muted);
        max-width: 400px;
        word-break: break-word;
      `;
    }
  }
  
  if (onErrorCallback) {
    onErrorCallback(error);
  }
}

/**
 * Clear error state
 */
function clearError() {
  // Could be used to clear error highlighting in editor
}

/**
 * Set Mermaid theme
 */
export function setTheme(theme) {
  mermaid.initialize({
    theme: theme
  });
  
  // Re-render with new theme
  if (currentCode) {
    renderPreview();
  }
}

/**
 * Get SVG content for export
 */
export function getSvgContent() {
  if (!previewElement) return null;
  
  const svg = previewElement.querySelector('svg');
  if (!svg) return null;
  
  // Clone and clean SVG for export
  const clone = svg.cloneNode(true);
  clone.removeAttribute('style');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  return clone.outerHTML;
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clean up resources
 */
export function destroy() {
  if (editorElement) {
    editorElement.removeEventListener('input', handleInput);
    editorElement.removeEventListener('keydown', handleKeydown);
  }
  clearTimeout(debounceTimer);
}

export default {
  initMermaidEditor,
  setCode,
  getCode,
  renderPreview,
  getSvgContent,
  setTheme,
  destroy
};
