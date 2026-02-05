/**
 * Draw.io Parser
 * Parses draw.io XML files and extracts nodes and edges
 */

import pako from 'pako';

/**
 * Decode and decompress draw.io XML content
 * Draw.io files can be compressed or plain XML
 */
export function decodeDrawioContent(content) {
  // Check if content is already plain XML
  if (content.trim().startsWith('<')) {
    return content;
  }
  
  try {
    // Try to decode base64 and decompress
    const decoded = atob(content);
    const charData = decoded.split('').map(c => c.charCodeAt(0));
    const binData = new Uint8Array(charData);
    const decompressed = pako.inflateRaw(binData, { to: 'string' });
    return decodeURIComponent(decompressed);
  } catch (e) {
    // If decompression fails, try just base64 decode
    try {
      return atob(content);
    } catch (e2) {
      throw new Error('No se pudo decodificar el contenido del archivo Draw.io');
    }
  }
}

/**
 * Parse draw.io XML and extract structure
 */
/**
 * Get list of pages from Draw.io XML
 */
export function getDrawioPages(xmlContent) {
  const parser = new DOMParser();
  
  // Clean the XML content
  let cleanedContent = xmlContent.trim();
  if (cleanedContent.charCodeAt(0) === 0xFEFF) {
    cleanedContent = cleanedContent.substring(1);
  }
  
  if (!cleanedContent.includes('<mxfile')) {
    // If it's just a graph model, it's a single page
    return [{ id: '0', name: 'Page 1' }];
  }
  
  const doc = parser.parseFromString(cleanedContent, 'text/xml');
  const diagrams = doc.querySelectorAll('diagram');
  
  if (diagrams.length === 0) {
    return [{ id: '0', name: 'Page 1' }];
  }
  
  const pages = [];
  diagrams.forEach((diagram, index) => {
    pages.push({
      id: diagram.getAttribute('id') || index.toString(),
      name: diagram.getAttribute('name') || `Page ${index + 1}`,
      index: index
    });
  });
  
  return pages;
}

/**
 * Parse draw.io XML and extract structure
 * @param {string} xmlContent - The XML content
 * @param {object} options - Options { pageIndex: 0 }
 */
export function parseDrawioXML(xmlContent, options = {}) {
  const parser = new DOMParser();
  const pageIndex = options.pageIndex || 0;
  
  // Clean the XML content - remove leading/trailing whitespace and any BOM
  let cleanedContent = xmlContent.trim();
  
  // Remove BOM if present
  if (cleanedContent.charCodeAt(0) === 0xFEFF) {
    cleanedContent = cleanedContent.substring(1);
  }
  
  console.log('[DEBUG] parseDrawioXML - cleaned content starts with:', cleanedContent.substring(0, 50));
  
  // Handle mxfile wrapper
  let xmlToParse = cleanedContent;
  if (cleanedContent.includes('<mxfile')) {
    const doc = parser.parseFromString(cleanedContent, 'text/xml');
    
    // Check for parse errors at this level
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('[DEBUG] Parse error at mxfile level:', parseError.textContent);
      throw new Error(`Error de parsing XML: ${parseError.textContent}`);
    }
    
    // Get all diagrams
    const diagrams = doc.querySelectorAll('diagram');
    
    // Select specific diagram by index
    const diagram = diagrams[pageIndex] || diagrams[0];
    
    if (diagram) {
      const diagramContent = diagram.textContent;
      if (diagramContent && !diagramContent.trim().startsWith('<')) {
        xmlToParse = decodeDrawioContent(diagramContent);
      } else if (diagramContent) {
        xmlToParse = diagramContent.trim();
      }
      
      // If diagram contains mxGraphModel directly as child, get that
      const graphModel = diagram.querySelector('mxGraphModel');
      if (graphModel) {
        xmlToParse = new XMLSerializer().serializeToString(graphModel);
      }
    }
  }
  
  // Ensure the XML to parse is also trimmed
  xmlToParse = xmlToParse.trim();
  console.log('[DEBUG] parseDrawioXML - xmlToParse starts with:', xmlToParse.substring(0, 50));
  
  const doc = parser.parseFromString(xmlToParse, 'text/xml');
  
  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Error de parsing XML: ${parseError.textContent}`);
  }
  
  // Query both mxCell and UserObject/object
  const cellElements = doc.querySelectorAll('mxCell, UserObject, object');
  const cells = [];
  
  // Normalize cells wrapper
  cellElements.forEach(el => {
      // UserObject/object usually wraps an mxCell for geometry/style
      // We need to extract the "real" properties
      
      const tagName = el.tagName;
      let id = el.getAttribute('id');
      let value = el.getAttribute('value') || el.getAttribute('label') || '';
      let style = el.getAttribute('style');
      let vertex = el.getAttribute('vertex');
      let edge = el.getAttribute('edge');
      let parent = el.getAttribute('parent');
      let source = el.getAttribute('source');
      let target = el.getAttribute('target');
      let geometryElement = el.querySelector('mxGeometry');

      // If it's a UserObject/object, the mxCell might be a child
      if (tagName === 'UserObject' || tagName === 'object') {
          const childCell = el.querySelector('mxCell');
          if (childCell) {
              if (!style) style = childCell.getAttribute('style');
              if (!vertex) vertex = childCell.getAttribute('vertex');
              if (!edge) edge = childCell.getAttribute('edge');
              if (!parent) parent = childCell.getAttribute('parent');
              if (!source) source = childCell.getAttribute('source');
              if (!target) target = childCell.getAttribute('target');
              if (!geometryElement) geometryElement = childCell.querySelector('mxGeometry');
          }
      }
      
      // Store normalized object
      cells.push({
          raw: el,
          id,
          value,
          style: style || '',
          vertex,
          edge,
          parent,
          source,
          target,
          geometryElement
      });
  });

  const allCellsMap = new Map();
  const groupChildren = new Map();
  const processedCellIds = new Set();
  const nodes = [];
  const edges = [];
  const nodeMap = new Map(); 
  const edgeMap = new Map(); 
  
  // First pass: Index all cells and identify hierarchy
  cells.forEach(cell => {
    if (!cell.id) return;
    allCellsMap.set(cell.id, cell);
    
    if (cell.parent && cell.parent !== '0' && cell.parent !== '1') {
      if (!groupChildren.has(cell.parent)) {
        groupChildren.set(cell.parent, []);
      }
      groupChildren.get(cell.parent).push(cell);
    }
  });

  // Helper to parse geometry
  const getGeometry = (cell) => {
    const geometry = cell.geometryElement;
    return {
      x: parseFloat(geometry?.getAttribute('x')) || 0,
      y: parseFloat(geometry?.getAttribute('y')) || 0,
      width: parseFloat(geometry?.getAttribute('width')) || 100,
      height: parseFloat(geometry?.getAttribute('height')) || 60
    };
  };

  // Helper to process a single node
  const processNode = (cell, overrideLabel = null) => {
    const id = cell.id;
    const value = cell.value;
    const style = cell.style;
    const geometry = getGeometry(cell);
    
    const nodeData = {
      id,
      label: overrideLabel !== null ? overrideLabel : cleanLabel(value),
      shape: parseShapeFromStyle(style),
      style,
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height
    };
    nodes.push(nodeData);
    nodeMap.set(id, nodeData);
    return nodeData;
  };
  
  // Second Pass: Process Groups directly to merge them if needed
  // This handles order independence (even if child comes before parent)
  for (const [groupId, children] of groupChildren.entries()) {
      const groupCell = allCellsMap.get(groupId);
      if (!groupCell) continue;
      
      const geometry = getGeometry(groupCell);
      const style = groupCell.style || '';
      const val = groupCell.value || '';
      
      // Heuristic: Merge if it looks like a "Container" with content.
      // We explicitly want to support "Class" type groups where main cell might be empty container.
      
      // Only merge if it's a vertex (visible group), ignored if just container
      if (groupCell.vertex !== '1') continue;

      // Skip swimlanes if we want to treat them as subgraphs (future improvement)
      // For now, if it's a group, we merge.
      if (!style.includes('swimlane')) {
         children.sort((a, b) => getGeometry(a).y - getGeometry(b).y);
         
         let mergedLabelParts = [];
         
         // 1. Get Group Label
         let groupLabel = cleanLabel(val);
         let hasTitle = !!groupLabel;
         
         if (groupLabel) {
             mergedLabelParts.push(`**${groupLabel}**`);
         }
         
         // 2. Process Children
         let childrenLabels = [];
         children.forEach(child => {
             // Only if child is a vertex (text node, field), not an edge inside group
             if (child.vertex === '1') {
                 const childLabel = cleanLabel(child.value);
                 if (childLabel) {
                    childrenLabels.push(childLabel);
                 }
                 // Mark child as processed so we don't add it as separate node
                 processedCellIds.add(child.id);
             }
         });
         
         // 3. Construct Merged Label and Data
         // If group had no title, take first child as title
         if (!hasTitle && childrenLabels.length > 0) {
             const titleCandidate = childrenLabels[0];
             mergedLabelParts.push(`**${titleCandidate}**`);
             groupLabel = titleCandidate; // Update detected title
             childrenLabels.shift(); // Remove first used as title
         }
         
         // Append rest of children
         if (childrenLabels.length > 0) {
            // Add separator only if we have a title
            if (mergedLabelParts.length > 0) {
                 mergedLabelParts.push('----------------');
            }
            mergedLabelParts.push(...childrenLabels);
         }
         
         // If we found ANY content, create the node
         if (mergedLabelParts.length > 0) {
             const finalLabel = mergedLabelParts.join('<br/>');
             
             // Detect if this is a Class-like structure (Title + Members)
             // If we have a title and children (members), treat as class
             const isClassResult = (!!groupLabel && childrenLabels.length > 0) || (childrenLabels.length > 0 && style.includes('swimlane'));
             
             const nodeData = {
                id: groupId,
                label: finalLabel,
                shape: isClassResult ? 'class' : 'rectangle', 
                type: isClassResult ? 'class' : 'node',
                name: groupLabel || 'Class', // Name for class diagram
                members: childrenLabels,     // Members for class diagram
                style,
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height
             };
             
             nodes.push(nodeData);
             nodeMap.set(groupId, nodeData);
             processedCellIds.add(groupId);
         }
      }
  }

  // Third Pass: Process remaining nodes and edges
  cells.forEach(cell => {
    const id = cell.id;
    const value = cell.value;
    const style = cell.style;
    const vertex = cell.vertex;
    const edge = cell.edge;
    const source = cell.source;
    const target = cell.target;
    const parent = cell.parent;
    
    // Skip if already processed (merged group or child of merged group)
    if (processedCellIds.has(id)) return;

    // Check if this is a label for an edge
    const isLabel = vertex === '1' && cell.raw.getAttribute('connectable') === '0' && parent && allCellsMap.has(parent) && allCellsMap.get(parent).edge === '1';
    
    if (isLabel) {
      const edgeParent = edgeMap.get(parent);
      if (edgeParent) {
          const currentLabel = edgeParent.label;
          const newLabel = cleanLabel(value);
          if (newLabel) {
            edgeParent.label = currentLabel ? `${currentLabel} ${newLabel}` : newLabel;
          }
      }
      return; 
    }
    
    // Ignore children of groups that were NOT merged (so they appear as individual nodes inside container)?
    // BUT we didn't output the container if we didn't merge it?
    // If a group was NOT merged (e.g. swimlane or empty), we might want to process it as a Node/Subgraph?
    // Currently `parseDrawioXML` outputs flat list.
    // If we have a Group that wasn't merged, let's treat it as a Node.
    // And its children as separate Nodes.
    // This is fine. (Mermaid will show them overlapping without subgraph, but at least they exist).
    
    // Normal Node
    if (vertex === '1' && parent !== '0') {
      processNode(cell);
    } 
    // Edge
    else if (edge === '1') {
      const edgeLabel = cleanLabel(value);
      const edgeData = {
        id,
        source,
        target,
        label: edgeLabel,
        style
      };
      edges.push(edgeData);
      edgeMap.set(id, edgeData);
    }
  });

  // Fourth Pass: Assign separate labels to edges (re-check for late edges)
  cells.forEach(cell => {
     const parent = cell.parent;
     const vertex = cell.vertex;
     const isLabel = vertex === '1' && cell.raw.getAttribute('connectable') === '0' && parent && edgeMap.has(parent);
     
     if (isLabel) {
         const value = cell.value;
         const edgeData = edgeMap.get(parent);
         const newLabel = cleanLabel(value);
         // Only apply if not already applied (duplicates check?)
         // Simple check: if we cleanLabel(value) is contained in edgeData.label? 
         // Better: trust the loop order. We did edges in pass 3. This pass 4 is for labels defined AFTER edges in XML.
         if (newLabel && edgeData) {
              edgeData.label = edgeData.label ? `${edgeData.label} ${newLabel}` : newLabel;
         }
     }
  });
  
  return { nodes, edges, nodeMap };
}

/**
 * Parse shape type from draw.io style string
 */
function parseShapeFromStyle(style) {
  if (!style) return 'rectangle';
  
  const styleMap = {
    'rhombus': 'diamond',
    'ellipse': 'circle',
    'rounded=1': 'rounded',
    'shape=parallelogram': 'parallelogram',
    'shape=cylinder': 'cylinder',
    'shape=hexagon': 'hexagon',
    'shape=triangle': 'triangle',
    'shape=document': 'document',
    'shape=cloud': 'cloud',
    'swimlane': 'subgraph',
    'shape=process': 'subroutine'
  };
  
  for (const [key, value] of Object.entries(styleMap)) {
    if (style.includes(key)) {
      return value;
    }
  }
  
  return 'rectangle';
}

/**
 * Clean HTML from labels - Improved to preserve structure
 */
function cleanLabel(html) {
  if (!html) return '';
  
  // Replace standard block breaks with newlines to preserve structure
  let processed = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/&nbsp;/g, ' ');

  // Remove HTML tags
  const temp = document.createElement('div');
  temp.innerHTML = processed;
  let text = temp.textContent || temp.innerText || '';
  
  // Decode HTML entities if any left
  const decoder = document.createElement('textarea');
  decoder.innerHTML = text;
  text = decoder.value;
  
  // Trim and normalize whitespace (allow single newlines, collapse multiple)
  text = text.trim();
  // We want to keep real newlines, but collapse horizontal spaces
  // Split by newline, trim each line, join back
  text = text.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
  
  // Escape special Mermaid characters
  text = text.replace(/"/g, "'");
  text = text.replace(/\[/g, '(');
  text = text.replace(/\]/g, ')');
  
  return text;
}

/**
 * Generate XML for creating a draw.io diagram
 */
export function generateDrawioXML(nodes, edges) {
  const cellsXml = [];
  
  // Root cells
  cellsXml.push('<mxCell id="0"/>');
  cellsXml.push('<mxCell id="1" parent="0"/>');
  
  // Add nodes
  nodes.forEach((node, index) => {
    const id = node.id || `node_${index}`;
    const x = node.x || (index % 3) * 200 + 50;
    const y = node.y || Math.floor(index / 3) * 150 + 50;
    const width = node.width || 120;
    const height = node.height || 60;
    const label = escapeXml(node.label || '');
    const style = getStyleForShape(node.shape);
    
    cellsXml.push(`<mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="1">
      <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
    </mxCell>`);
  });
  
  // Add edges
  edges.forEach((edge, index) => {
    const id = edge.id || `edge_${index}`;
    const label = escapeXml(edge.label || '');
    const style = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;';
    
    cellsXml.push(`<mxCell id="${id}" value="${label}" style="${style}" edge="1" parent="1" source="${edge.source}" target="${edge.target}">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>`);
  });
  
  const graphXml = `<mxGraphModel>
  <root>
    ${cellsXml.join('\n    ')}
  </root>
</mxGraphModel>`;

  return `<mxfile>
  <diagram name="Page-1">
    ${graphXml}
  </diagram>
</mxfile>`;
}

/**
 * Get draw.io style string for a shape type
 */
function getStyleForShape(shape) {
  const baseStyle = 'rounded=0;whiteSpace=wrap;html=1;';
  
  const shapeStyles = {
    'rectangle': baseStyle,
    'rounded': 'rounded=1;whiteSpace=wrap;html=1;',
    'diamond': 'rhombus;whiteSpace=wrap;html=1;',
    'circle': 'ellipse;whiteSpace=wrap;html=1;',
    'cylinder': 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;',
    'hexagon': 'shape=hexagon;whiteSpace=wrap;html=1;',
    'parallelogram': 'shape=parallelogram;whiteSpace=wrap;html=1;',
    'stadium': 'rounded=1;whiteSpace=wrap;html=1;arcSize=50;',
    'subroutine': 'shape=process;whiteSpace=wrap;html=1;',
    'asymmetric': 'shape=trapezoid;whiteSpace=wrap;html=1;'
  };
  
  return shapeStyles[shape] || baseStyle;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default {
  decodeDrawioContent,
  parseDrawioXML,
  generateDrawioXML
};
