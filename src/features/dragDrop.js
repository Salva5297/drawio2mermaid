/**
 * Drag and Drop Handler
 * Handles file drag and drop for importing diagrams
 */

let dropzones = [];

/**
 * Initialize drag and drop for a dropzone
 */
export function initDragDrop(elementId, options = {}) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const config = {
    acceptedTypes: options.acceptedTypes || ['.drawio', '.xml', '.mmd', '.md', '.txt'],
    onDrop: options.onDrop || (() => {}),
    onError: options.onError || console.error
  };
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    element.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // Highlight drop area when item is dragged over
  ['dragenter', 'dragover'].forEach(eventName => {
    element.addEventListener(eventName, () => highlight(element), false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    element.addEventListener(eventName, () => unhighlight(element), false);
  });
  
  // Handle dropped files
  element.addEventListener('drop', (e) => handleDrop(e, config), false);
  
  // Handle click to select files
  element.addEventListener('click', () => {
    const input = createFileInput(config);
    input.click();
  });
  
  dropzones.push({ element, config });
  
  return {
    destroy: () => destroyDragDrop(element)
  };
}

/**
 * Prevent default drag behaviors
 */
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Highlight dropzone
 */
function highlight(element) {
  element.classList.add('drag-over');
}

/**
 * Remove highlight from dropzone
 */
function unhighlight(element) {
  element.classList.remove('drag-over');
}

/**
 * Handle file drop
 */
function handleDrop(e, config) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length === 0) {
    config.onError(new Error('No se detectaron archivos'));
    return;
  }
  
  const file = files[0]; // Take first file only
  processFile(file, config);
}

/**
 * Process dropped/selected file
 */
function processFile(file, config) {
  // Check file extension
  const extension = '.' + file.name.split('.').pop().toLowerCase();
  const isAccepted = config.acceptedTypes.some(type => 
    extension === type.toLowerCase() || 
    type === '*' ||
    file.type.includes(type.replace('.', ''))
  );
  
  if (!isAccepted) {
    config.onError(new Error(
      `Tipo de archivo no soportado: ${extension}. ` +
      `Tipos aceptados: ${config.acceptedTypes.join(', ')}`
    ));
    return;
  }
  
  // Read file
  const reader = new FileReader();
  
  reader.onload = (e) => {
    config.onDrop({
      name: file.name,
      type: extension,
      content: e.target.result
    });
  };
  
  reader.onerror = () => {
    config.onError(new Error('Error al leer el archivo'));
  };
  
  reader.readAsText(file);
}

/**
 * Create hidden file input
 */
function createFileInput(config) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = config.acceptedTypes.join(',');
  input.style.display = 'none';
  
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file, config);
    }
    input.remove();
  });
  
  document.body.appendChild(input);
  return input;
}

/**
 * Clean up drag drop handlers
 */
function destroyDragDrop(element) {
  const index = dropzones.findIndex(dz => dz.element === element);
  if (index !== -1) {
    dropzones.splice(index, 1);
  }
}

/**
 * Initialize global drag and drop (for entire window)
 */
export function initGlobalDragDrop(options = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'global-drop-overlay';
  overlay.className = 'global-drop-overlay hidden';
  overlay.innerHTML = `
    <div class="drop-overlay-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p>Suelta el archivo aquí</p>
    </div>
  `;
  
  // Add overlay styles
  const style = document.createElement('style');
  style.textContent = `
    .global-drop-overlay {
      position: fixed;
      inset: 0;
      background: rgba(99, 102, 241, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      pointer-events: none;
    }
    .global-drop-overlay.hidden {
      display: none;
    }
    .drop-overlay-content {
      text-align: center;
      color: white;
    }
    .drop-overlay-content svg {
      width: 64px;
      height: 64px;
      margin-bottom: 1rem;
      animation: bounce 1s infinite;
    }
    .drop-overlay-content p {
      font-size: 1.5rem;
      font-weight: 600;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  
  let dragCounter = 0;
  
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      overlay.classList.remove('hidden');
    }
  });
  
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      overlay.classList.add('hidden');
    }
  });
  
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add('hidden');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && options.onDrop) {
      const file = files[0];
      const reader = new FileReader();
      
      reader.onload = (evt) => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        options.onDrop({
          name: file.name,
          type: extension,
          content: evt.target.result
        });
      };
      
      reader.readAsText(file);
    }
  });
}

export default {
  initDragDrop,
  initGlobalDragDrop
};
