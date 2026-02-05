/**
 * Draw.io Embed Integration
 * Handles embedding draw.io editor via iframe
 */

const DRAWIO_EMBED_URL = 'https://embed.diagrams.net/';

let drawioIframe = null;
let currentXml = null;
let messageHandler = null;
let onSaveCallback = null;
let isEditorReady = false;
let exportResolve = null;

/**
 * Initialize draw.io embed
 */
export function initDrawioEmbed(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }
  
  // Get or create iframe
  drawioIframe = container.querySelector('.drawio-iframe');
  if (!drawioIframe) {
    drawioIframe = document.createElement('iframe');
    drawioIframe.className = 'drawio-iframe hidden';
    container.appendChild(drawioIframe);
  }
  
  // Setup message handler
  if (messageHandler) {
    window.removeEventListener('message', messageHandler);
  }
  
  messageHandler = handleDrawioMessage;
  window.addEventListener('message', messageHandler);
  
  return {
    load: loadDiagram,
    getXml: getCurrentXml,
    isReady: () => isEditorReady,
    show: showEditor,
    hide: hideEditor,
    onSave: (callback) => { onSaveCallback = callback; }
  };
}

/**
 * Show the draw.io editor
 */
export function showEditor() {
  const dropzone = document.getElementById('drawio-dropzone');
  if (dropzone) dropzone.classList.add('hidden');
  if (drawioIframe) drawioIframe.classList.remove('hidden');
}

/**
 * Hide the draw.io editor
 */
export function hideEditor() {
  const dropzone = document.getElementById('drawio-dropzone');
  if (dropzone) dropzone.classList.remove('hidden');
  if (drawioIframe) drawioIframe.classList.add('hidden');
}

/**
 * Check if editor has content loaded
 */
export function hasContent() {
  return currentXml !== null && currentXml.trim() !== '';
}

/**
 * Check if the Draw.io editor iframe is visible
 */
export function isEditorVisible() {
  return drawioIframe && !drawioIframe.classList.contains('hidden');
}

/**
 * Load a diagram into draw.io
 */
export function loadDiagram(xml) {
  currentXml = xml;
  
  // If editor is already ready and visible, just send the load message
  if (isEditorReady && drawioIframe) {
    const loadMsg = {
      action: 'load',
      xml: currentXml,
      autosave: 1
    };
    drawioIframe.contentWindow.postMessage(JSON.stringify(loadMsg), '*');
    showEditor();
    return;
  }
  
  // Build embed URL with parameters
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    modified: 'unsavedChanges',
    saveAndExit: '0',
    noSaveBtn: '1',
    noExitBtn: '1',
    libs: '0' // Disable external libs for speed
  });
  
  const src = `${DRAWIO_EMBED_URL}?${params.toString()}`;
  
  if (drawioIframe) {
    drawioIframe.src = src;
    showEditor();
  }
}

/**
 * Load diagram from file content
 */
export function loadFromFile(fileContent) {
  loadDiagram(fileContent);
}

/**
 * Create new empty diagram
 */
export function createNew() {
  const emptyDiagram = `<mxfile>
  <diagram name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  
  loadDiagram(emptyDiagram);
}

/**
 * Get current XML from editor
 */
export function getCurrentXml() {
  return currentXml;
}

/**
 * Set current XML (for external updates)
 */
export function setCurrentXml(xml) {
  currentXml = xml;
}

/**
 * Request the current XML from the editor (async)
 */
export function requestCurrentXml() {
  return new Promise((resolve, reject) => {
    if (!drawioIframe || !isEditorReady) {
      resolve(currentXml);
      return;
    }
    
    // Set up resolver for when we get the export
    exportResolve = resolve;
    
    // Request XML export from Draw.io
    const msg = {
      action: 'export',
      format: 'xml',
      spin: 'Obteniendo diagrama...'
    };
    
    try {
      drawioIframe.contentWindow.postMessage(JSON.stringify(msg), '*');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (exportResolve) {
          exportResolve(currentXml);
          exportResolve = null;
        }
      }, 5000);
    } catch (e) {
      resolve(currentXml);
    }
  });
}

/**
 * Handle messages from draw.io iframe
 */
function handleDrawioMessage(event) {
  // Only process messages from draw.io
  if (!event.data || typeof event.data !== 'string') return;
  
  let message;
  try {
    message = JSON.parse(event.data);
  } catch (e) {
    return;
  }
  
  // Process draw.io events
  switch (message.event) {
    case 'init':
      // Editor is ready, load the diagram
      isEditorReady = true;
      if (currentXml && drawioIframe) {
        const loadMsg = {
          action: 'load',
          xml: currentXml,
          autosave: 1
        };
        drawioIframe.contentWindow.postMessage(JSON.stringify(loadMsg), '*');
      }
      break;
      
    case 'autosave':
    case 'save':
      // Diagram was saved/autosaved
      if (message.xml) {
        currentXml = message.xml;
        if (onSaveCallback) {
          onSaveCallback(message.xml);
        }
      }
      break;
      
    case 'export':
      // Export completed
      if (message.data) {
        // For XML format, data contains the XML
        if (message.format === 'xml' && exportResolve) {
          currentXml = message.data;
          exportResolve(message.data);
          exportResolve = null;
        } else {
          handleExport(message);
        }
      }
      break;
      
    case 'exit':
      // User clicked exit
      if (message.xml) {
        currentXml = message.xml;
      }
      break;
  }
}

/**
 * Request export from draw.io
 */
export function requestExport(format = 'svg') {
  if (!drawioIframe || !isEditorReady) return;
  
  const exportMsg = {
    action: 'export',
    format: format,
    spin: 'Exporting...'
  };
  
  if (format === 'png') {
    exportMsg.scale = 2;
    exportMsg.background = '#ffffff';
  }
  
  drawioIframe.contentWindow.postMessage(JSON.stringify(exportMsg), '*');
}

/**
 * Handle export data from draw.io
 */
function handleExport(message) {
  // Dispatch custom event with export data
  const event = new CustomEvent('drawio-export', {
    detail: {
      format: message.format,
      data: message.data
    }
  });
  window.dispatchEvent(event);
}

/**
 * Clean up resources
 */
export function destroy() {
  if (messageHandler) {
    window.removeEventListener('message', messageHandler);
    messageHandler = null;
  }
  isEditorReady = false;
  currentXml = null;
}

export default {
  initDrawioEmbed,
  loadDiagram,
  loadFromFile,
  createNew,
  getCurrentXml,
  setCurrentXml,
  requestCurrentXml,
  requestExport,
  showEditor,
  hideEditor,
  hasContent,
  isEditorVisible,
  destroy
};

