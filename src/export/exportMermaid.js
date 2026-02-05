/**
 * Export functionality for Mermaid diagrams
 */

import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

/**
 * Export Mermaid diagram to various formats
 */
export async function exportMermaid(code, svgContent, format, filename = 'diagram') {
  switch (format) {
    case 'mmd':
      return exportAsMmd(code, filename);
    case 'md':
      return exportAsMarkdown(code, filename);
    case 'svg':
      return exportAsSvg(svgContent, filename);
    case 'png':
      return exportAsPng(svgContent, filename);
    case 'pdf':
      return exportAsPdf(svgContent, filename);
    default:
      throw new Error(`Formato no soportado: ${format}`);
  }
}

/**
 * Export as .mmd (Mermaid) file
 */
function exportAsMmd(code, filename) {
  const blob = new Blob([code], { type: 'text/plain' });
  saveAs(blob, `${filename}.mmd`);
}

/**
 * Export as Markdown file with Mermaid code block
 */
function exportAsMarkdown(code, filename) {
  const markdown = `# Diagram

\`\`\`mermaid
${code}
\`\`\`
`;
  const blob = new Blob([markdown], { type: 'text/markdown' });
  saveAs(blob, `${filename}.md`);
}

/**
 * Export as SVG file
 */
function exportAsSvg(svgContent, filename) {
  if (!svgContent) {
    throw new Error('No hay diagrama para exportar');
  }
  
  // Ensure SVG has proper XML declaration
  let svg = svgContent;
  if (!svg.includes('<?xml')) {
    svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg;
  }
  
  // Add xmlns if missing
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  saveAs(blob, `${filename}.svg`);
}

/**
 * Export as PNG file
 */
async function exportAsPng(svgContent, filename) {
  if (!svgContent) {
    throw new Error('No hay diagrama para exportar');
  }
  
  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = svgContent;
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    background: white;
    padding: 20px;
  `;
  
  // Ensure SVG has dimensions
  const svg = container.querySelector('svg');
  if (svg) {
    if (!svg.getAttribute('width')) {
      svg.setAttribute('width', svg.getBBox?.()?.width || 800);
    }
    if (!svg.getAttribute('height')) {
      svg.setAttribute('height', svg.getBBox?.()?.height || 600);
    }
  }
  
  document.body.appendChild(container);
  
  try {
    const dataUrl = await toPng(container, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      quality: 1
    });
    
    // Convert data URL to blob and save
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    saveAs(blob, `${filename}.png`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export as PDF file
 */
async function exportAsPdf(svgContent, filename) {
  if (!svgContent) {
    throw new Error('No hay diagrama para exportar');
  }
  
  // Create a print-friendly window
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    throw new Error('Por favor permite ventanas emergentes para exportar a PDF');
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          @page {
            size: auto;
            margin: 10mm;
          }
          body {
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          svg {
            max-width: 100%;
            height: auto;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${svgContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
    </html>
  `);
  
  printWindow.document.close();
}

/**
 * Get SVG from preview element
 */
export function getSvgFromPreview(previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return null;
  
  const svg = preview.querySelector('svg');
  if (!svg) return null;
  
  // Clone and prepare for export
  const clone = svg.cloneNode(true);
  
  // Remove any inline styles that might cause issues
  clone.removeAttribute('style');
  
  // Ensure xmlns is set
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  return clone.outerHTML;
}

export default {
  exportMermaid,
  getSvgFromPreview
};
