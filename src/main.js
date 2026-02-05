/**
 * Draw.io ↔ Mermaid Converter
 * Main Application Entry Point
 */

// Import styles
import './styles/main.css';

// Import converters
import { convertDrawioToMermaid } from './converters/drawioToMermaid.js';
import { convertMermaidToDrawio } from './converters/mermaidToDrawio.js';
import { decodeDrawioContent, parseDrawioXML, generateDrawioXML, getDrawioPages } from './converters/drawioParser.js';
import { validateMermaidSyntax } from './converters/mermaidParser.js';

// Import editors
import { initDrawioEmbed, loadDiagram, getCurrentXml, loadFromFile, createNew, hasContent, isEditorVisible, setCurrentXml } from './editors/drawioEmbed.js';
import { initMermaidEditor, setCode, getCode, getSvgContent, setTheme } from './editors/mermaidEditor.js';

// Import export functionality
import { exportDrawio } from './export/exportDrawio.js';
import { exportMermaid, getSvgFromPreview } from './export/exportMermaid.js';

// Import features
import { templates, renderTemplatesGrid } from './features/templates.js';
import { addToHistory, renderHistoryList, clearHistory } from './features/history.js';
import { initDragDrop, initGlobalDragDrop } from './features/dragDrop.js';

// Import utils
import { initErrorHandler, showError, showSuccess, showWarning, formatParseError } from './utils/errorHandler.js';

// Application state
let currentDrawioXml = null;
let mermaidEditorInstance = null;
let drawioEditorInstance = null;
let isDarkTheme = false;
let pendingXmlForConversion = null; // Store XML while selecting page

/**
 * Initialize the application
 */
function init() {
  console.log('🚀 Initializing Draw.io ↔ Mermaid Converter');
  
  // Initialize error handler
  initErrorHandler();
  
  // Initialize theme
  initTheme();
  
  // Initialize editors
  initEditors();
  
  // Initialize drag and drop
  initDragAndDrop();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize modals
  initModals();
  
  console.log('✅ Application initialized');
}

/**
 * Initialize theme from localStorage
 */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  isDarkTheme = savedTheme === 'dark' || 
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  applyTheme();
}

/**
 * Apply current theme
 */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
  
  // Update Mermaid theme
  if (mermaidEditorInstance) {
    setTheme(isDarkTheme ? 'dark' : 'default');
  }
}

/**
 * Toggle theme
 */
function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
  applyTheme();
}

/**
 * Initialize all editors
 */
function initEditors() {
  // Initialize Draw.io embed
  try {
    drawioEditorInstance = initDrawioEmbed('drawio-container', {
      onSave: (xml) => {
        currentDrawioXml = xml;
      }
    });
  } catch (e) {
    console.warn('Could not initialize Draw.io embed:', e);
  }
  
  // Initialize Mermaid editor
  try {
    mermaidEditorInstance = initMermaidEditor('mermaid-editor', 'mermaid-preview', {
      theme: isDarkTheme ? 'dark' : 'default'
    });
    
    mermaidEditorInstance.onChange((code) => {
      // Validate on change
      const errors = validateMermaidSyntax(code);
      if (errors.length > 0) {
        // Errors will be shown in preview
      }
    });
  } catch (e) {
    console.warn('Could not initialize Mermaid editor:', e);
  }
  
  // Initialize Page Selection Modal
  initPageSelectionModal();
}

/**
 * Initialize Page Selection Modal
 */
function initPageSelectionModal() {
  const modal = document.getElementById('page-selection-modal');
  const closeBtn = modal.querySelector('.modal-close');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  const closeModal = () => {
    modal.classList.add('hidden');
    pendingXmlForConversion = null;
  };
  
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
}

/**
 * Show Page Selection Modal
 */
function showPageSelectionModal(pages, onSelect) {
  const modal = document.getElementById('page-selection-modal');
  const pagesList = document.getElementById('pages-list');
  
  // Clear list
  pagesList.innerHTML = '';
  
  // Add pages
  pages.forEach(page => {
    const pageEl = document.createElement('div');
    pageEl.className = 'page-item';
    pageEl.innerHTML = `
      <div class="page-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div class="page-name">${page.name}</div>
      <div class="page-id">ID: ${page.id}</div>
    `;
    
    pageEl.addEventListener('click', () => {
      onSelect(page.index);
      modal.classList.add('hidden');
    });
    
    pagesList.appendChild(pageEl);
  });
  
  modal.classList.remove('hidden');
}

/**
 * Initialize drag and drop
 */
function initDragAndDrop() {
  // Draw.io dropzone
  initDragDrop('drawio-dropzone', {
    acceptedTypes: ['.drawio', '.xml'],
    onDrop: handleDrawioFile,
    onError: (error) => showError('Error', error.message)
  });
  
  // Global drag and drop
  initGlobalDragDrop({
    onDrop: handleGlobalFileDrop
  });
}

/**
 * Handle Draw.io file drop
 */
/**
 * Handle Draw.io file drop
 */
function handleDrawioFile(file) {
  try {
    currentDrawioXml = file.content;
    loadDiagram(file.content);
    showSuccess('File Loaded', `${file.name} loaded successfully`);
  } catch (error) {
    showError('Load Error', error.message);
  }
}

/**
 * Handle global file drop
 */
function handleGlobalFileDrop(file) {
  const extension = file.type.toLowerCase();
  
  if (extension === '.drawio' || extension === '.xml') {
    handleDrawioFile(file);
  } else if (extension === '.mmd' || extension === '.md' || extension === '.txt') {
    handleMermaidFile(file);
  } else {
    showWarning('Unknown Type', 'Attempting to detect file format...');
    // Try to detect format
    if (file.content.includes('<mxfile') || file.content.includes('<mxGraphModel')) {
      handleDrawioFile(file);
    } else {
      handleMermaidFile(file);
    }
  }
}

/**
 * Handle Mermaid file
 */
function handleMermaidFile(file) {
  let code = file.content;
  
  // Extract mermaid code from markdown if needed
  if (file.type === '.md') {
    const match = code.match(/```mermaid\s*([\s\S]*?)```/);
    if (match) {
      code = match[1].trim();
    }
  }
  
  setCode(code);
  showSuccess('File Loaded', `${file.name} loaded successfully`);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  
  // Convert to Mermaid
  document.getElementById('convert-to-mermaid')?.addEventListener('click', convertToMermaid);
  
  // Convert to Draw.io
  document.getElementById('convert-to-drawio')?.addEventListener('click', convertToDrawio);
  
  // Load Draw.io file
  document.getElementById('drawio-load-btn')?.addEventListener('click', () => {
    document.getElementById('drawio-file-input')?.click();
  });
  
  document.getElementById('drawio-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        handleDrawioFile({
          name: file.name,
          type: '.' + file.name.split('.').pop(),
          content: evt.target.result
        });
      };
      reader.readAsText(file);
    }
  });
  
  // Load Mermaid file
  document.getElementById('load-mermaid')?.addEventListener('click', () => {
    document.getElementById('mermaid-file-input')?.click();
  });
  
  document.getElementById('mermaid-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        handleMermaidFile({
          name: file.name,
          type: '.' + file.name.split('.').pop(),
          content: evt.target.result
        });
      };
      reader.readAsText(file);
    }
  });
  
  // Export Draw.io - Removed as requested
  /*
  document.querySelectorAll('#drawio-export-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      handleExportDrawio(format);
    });
  });
  */
  
  // Export Mermaid
  document.querySelectorAll('#mermaid-export-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      handleExportMermaid(format);
    });
  });
  
  // Templates button
  document.getElementById('templates-btn')?.addEventListener('click', showTemplatesModal);
  
  // History button
  document.getElementById('history-btn')?.addEventListener('click', showHistoryModal);
  
  // Clear history
  document.getElementById('clear-history')?.addEventListener('click', () => {
    clearHistory();
    renderHistoryList('history-list', handleHistorySelect);
    showSuccess('History Cleared', 'All history has been deleted');
  });
}

/**
 * Convert Draw.io to Mermaid
 */
function convertToMermaid() {
  try {
    // Use local currentDrawioXml first (synced when we convert or load files)
    // Fall back to getCurrentXml() from the embed module
    let xml = currentDrawioXml || getCurrentXml();
    
    // Check if we have valid XML content
    if (!xml || !xml.trim()) {
      showWarning('No Diagram', 'Please load a .drawio file or create a diagram in the editor first.\n\nYou can:\n• Drag & drop a .drawio file\n• Click "Load" to select a file');
      return;
    }
    
    // Check key 'diagram' to verify it is a valid XML
    if (!xml.includes('<diagram') && !xml.includes('<mxGraphModel')) { 
       // Basic wrapper if it's just a graph model part
       if (xml.includes('<root>')) {
         xml = `<mxfile><diagram name="Page-1"><mxGraphModel><root>${xml}</root></mxGraphModel></diagram></mxfile>`; 
       } else {
         showWarning('Invalid Format', 'Content does not look like valid Draw.io XML. Please load a valid .drawio or .xml file.');
         return;
       }
    }

    // Check for multiple pages
    try {
      const pages = getDrawioPages(xml);
      
      if (pages.length > 1) {
        pendingXmlForConversion = xml;
        showPageSelectionModal(pages, (pageIndex) => {
          performConversion(pendingXmlForConversion, pageIndex);
          pendingXmlForConversion = null;
        });
        return;
      }
    } catch (e) {
      console.warn('Error checking pages:', e);
      // Proceed with default conversion if page check fails
    }

    // Single page or default
    performConversion(xml, 0);
    
  } catch (error) {
    showError('Conversion Error', error.message);
    console.error(error);
  }
}

/**
 * Perform the actual conversion for a specific page
 */
function performConversion(xml, pageIndex) {
  try {
    const mermaidCode = convertDrawioToMermaid(xml, { 
      diagramType: 'auto',
      pageIndex: pageIndex 
    });
    
    setCode(mermaidCode);
    
    // Update history
    addToHistory({
      type: 'drawio-to-mermaid',
      name: `Draw.io → Mermaid${pageIndex > 0 ? ` (Page ${pageIndex + 1})` : ''}`,
      sourceType: 'drawio',
      source: xml,
      result: mermaidCode,
      pageIndex: pageIndex
    });
    
    showSuccess('Success', 'Diagram converted to Mermaid');
  } catch (error) {
    showError('Conversion Error', error.message);
    console.error(error);
  }
}

/**
 * Convert Mermaid to Draw.io
 */
function convertToDrawio() {
  try {
    const code = getCode();
    
    if (!code.trim()) {
      showWarning('No Code', 'Please write Mermaid code first');
      return;
    }
    
    // Validate first
    const errors = validateMermaidSyntax(code);
    if (errors.length > 0) {
      const { title, message } = formatParseError(errors);
      showError(title, message);
      return;
    }
    
    const xml = convertMermaidToDrawio(code);
    currentDrawioXml = xml;
    loadDiagram(xml);
    
    // Add to history
    addToHistory({
      type: 'mermaid-to-drawio',
      name: 'Conversión Mermaid → Draw.io',
      sourceType: 'mermaid',
      source: code,
      result: xml
    });
    
    showSuccess('Conversion Success', 'Diagram converted to Draw.io');
    
  } catch (error) {
    showError('Conversion Error', error.message);
  }
}

/**
 * Handle Draw.io export
 */
async function handleExportDrawio(format) {
  try {
    const xml = getCurrentXml();
    
    if (!xml) {
      showWarning('No Diagram', 'No diagram to export');
      return;
    }
    
    await exportDrawio(xml, format, 'diagram');
    showSuccess('Export Success', `Diagram exported as .${format}`);
    
  } catch (error) {
    showError('Export Error', error.message);
  }
}

/**
 * Handle Mermaid export
 */
async function handleExportMermaid(format) {
  try {
    const code = getCode();
    const svg = getSvgFromPreview('mermaid-preview');
    
    if (!code.trim()) {
      showWarning('No Code', 'No Mermaid code to export');
      return;
    }
    
    if ((format === 'svg' || format === 'png' || format === 'pdf') && !svg) {
      showWarning('No Preview', 'Please generate a valid preview first');
      return;
    }
    
    await exportMermaid(code, svg, format, 'diagram');
    showSuccess('Export Success', `Diagram exported as .${format}`);
    
  } catch (error) {
    showError('Export Error', error.message);
  }
}

/**
 * Initialize modals
 */
function initModals() {
  // Close modal on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      backdrop.closest('.modal').classList.add('hidden');
    });
  });
  
  // Close modal on close button click
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
      });
    }
  });
}

/**
 * Show templates modal
 */
function showTemplatesModal() {
  const modal = document.getElementById('templates-modal');
  if (!modal) return;
  
  renderTemplatesGrid('templates-grid', (template) => {
    setCode(template.code);
    modal.classList.add('hidden');
    showSuccess('Template Loaded', `${template.name} applied`);
  });
  
  modal.classList.remove('hidden');
}

/**
 * Show history modal
 */
function showHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (!modal) return;
  
  renderHistoryList('history-list', handleHistorySelect);
  modal.classList.remove('hidden');
}

/**
 * Handle history item selection
 */
function handleHistorySelect(item) {
  const modal = document.getElementById('history-modal');
  
  if (item.type === 'drawio-to-mermaid') {
    // Restore both source and result
    if (item.source) {
      currentDrawioXml = item.source;
      loadDiagram(item.source);
    }
    if (item.result) {
      setCode(item.result);
    }
  } else if (item.type === 'mermaid-to-drawio') {
    if (item.source) {
      setCode(item.source);
    }
    if (item.result) {
      currentDrawioXml = item.result;
      loadDiagram(item.result);
    }
  }
  
  modal?.classList.add('hidden');
  showSuccess('History Restored', 'Previous conversion restored');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.__app = {
  convertToMermaid,
  convertToDrawio,
  getCode,
  setCode,
  getCurrentXml
};
