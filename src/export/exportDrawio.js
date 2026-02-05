/**
 * Export functionality for Draw.io diagrams
 */

import { saveAs } from 'file-saver';
import { toPng, toSvg } from 'html-to-image';

/**
 * Export draw.io diagram to various formats
 */
export async function exportDrawio(xml, format, filename = 'diagram') {
  switch (format) {
    case 'drawio':
      return exportAsDrawio(xml, filename);
    case 'xml':
      return exportAsXml(xml, filename);
    case 'svg':
      return exportAsSvgFromXml(xml, filename);
    case 'png':
      return exportAsPngFromXml(xml, filename);
    case 'pdf':
      return exportAsPdfFromXml(xml, filename);
    default:
      throw new Error(`Formato no soportado: ${format}`);
  }
}

/**
 * Export as .drawio file
 */
function exportAsDrawio(xml, filename) {
  const blob = new Blob([xml], { type: 'application/xml' });
  saveAs(blob, `${filename}.drawio`);
}

/**
 * Export as .xml file
 */
function exportAsXml(xml, filename) {
  const blob = new Blob([xml], { type: 'application/xml' });
  saveAs(blob, `${filename}.xml`);
}

/**
 * Export as SVG from XML
 * Note: This creates a basic SVG representation
 */
async function exportAsSvgFromXml(xml, filename) {
  // Parse XML to extract diagram info
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const cells = doc.querySelectorAll('mxCell[vertex="1"], mxCell[edge="1"]');
  
  // Create SVG
  const svg = createSvgFromCells(cells);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  saveAs(blob, `${filename}.svg`);
}

/**
 * Export as PNG from XML
 */
async function exportAsPngFromXml(xml, filename) {
  // Create temporary container with SVG
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const cells = doc.querySelectorAll('mxCell[vertex="1"], mxCell[edge="1"]');
  
  const svg = createSvgFromCells(cells);
  
  // Create temporary element
  const container = document.createElement('div');
  container.innerHTML = svg;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);
  
  try {
    const dataUrl = await toPng(container, {
      backgroundColor: '#ffffff',
      pixelRatio: 2
    });
    
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    saveAs(blob, `${filename}.png`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export as PDF from XML
 */
async function exportAsPdfFromXml(xml, filename) {
  // Create SVG first
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const cells = doc.querySelectorAll('mxCell[vertex="1"], mxCell[edge="1"]');
  
  const svgContent = createSvgFromCells(cells);
  
  // Use jsPDF if available, otherwise fallback to print
  try {
    // Create a simple HTML page with the SVG and trigger print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body { margin: 0; padding: 20px; }
            svg { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          ${svgContent}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  } catch (e) {
    throw new Error('Para exportar a PDF, use la función de imprimir del navegador');
  }
}

/**
 * Create SVG from mxCells
 */
function createSvgFromCells(cells) {
  let minX = Infinity, minY = Infinity;
  let maxX = 0, maxY = 0;
  
  const elements = [];
  
  cells.forEach(cell => {
    const geometry = cell.querySelector('mxGeometry');
    if (!geometry) return;
    
    const x = parseFloat(geometry.getAttribute('x')) || 0;
    const y = parseFloat(geometry.getAttribute('y')) || 0;
    const width = parseFloat(geometry.getAttribute('width')) || 100;
    const height = parseFloat(geometry.getAttribute('height')) || 60;
    const value = cell.getAttribute('value') || '';
    const style = cell.getAttribute('style') || '';
    const isEdge = cell.getAttribute('edge') === '1';
    
    if (!isEdge) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
      
      // Create shape
      const shape = createShapeElement(x, y, width, height, value, style);
      elements.push(shape);
    }
  });
  
  // Add padding
  const padding = 20;
  const svgWidth = maxX - minX + padding * 2;
  const svgHeight = maxY - minY + padding * 2;
  
  // Adjust positions
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;
  
  const adjustedElements = elements.map(el => 
    el.replace(/transform="translate\(([^,]+),([^)]+)\)"/, (match, tx, ty) => 
      `transform="translate(${parseFloat(tx) + offsetX},${parseFloat(ty) + offsetY})"`
    )
  );
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <style>
    .node { fill: #ffffff; stroke: #333333; stroke-width: 1; }
    .node-text { font-family: Arial, sans-serif; font-size: 12px; fill: #333333; text-anchor: middle; dominant-baseline: middle; }
  </style>
  <g transform="translate(${offsetX},${offsetY})">
    ${adjustedElements.join('\n    ')}
  </g>
</svg>`;
}

/**
 * Create SVG shape element
 */
function createShapeElement(x, y, width, height, label, style) {
  let shape = '';
  const centerX = width / 2;
  const centerY = height / 2;
  
  if (style.includes('rhombus')) {
    // Diamond shape
    const points = `${centerX},0 ${width},${centerY} ${centerX},${height} 0,${centerY}`;
    shape = `<polygon class="node" points="${points}"/>`;
  } else if (style.includes('ellipse')) {
    // Circle/ellipse
    shape = `<ellipse class="node" cx="${centerX}" cy="${centerY}" rx="${width/2}" ry="${height/2}"/>`;
  } else if (style.includes('rounded=1')) {
    // Rounded rectangle
    shape = `<rect class="node" x="0" y="0" width="${width}" height="${height}" rx="10" ry="10"/>`;
  } else {
    // Regular rectangle
    shape = `<rect class="node" x="0" y="0" width="${width}" height="${height}"/>`;
  }
  
  // Clean label
  const cleanLabel = label.replace(/<[^>]+>/g, '').trim();
  const text = cleanLabel ? 
    `<text class="node-text" x="${centerX}" y="${centerY}">${escapeXml(cleanLabel)}</text>` : '';
  
  return `<g transform="translate(${x},${y})">${shape}${text}</g>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default {
  exportDrawio
};
