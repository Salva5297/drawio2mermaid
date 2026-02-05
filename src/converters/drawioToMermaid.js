/**
 * Draw.io to Mermaid Converter
 * Converts parsed draw.io structure to Mermaid syntax
 */

import { parseDrawioXML, decodeDrawioContent } from './drawioParser.js';

/**
 * Convert draw.io XML content to Mermaid code
 */
export function convertDrawioToMermaid(xmlContent, options = {}) {
  const { direction = 'TD', diagramType = 'flowchart' } = options;
  
  try {
    // Parse the draw.io XML
    const { nodes, edges, nodeMap } = parseDrawioXML(xmlContent, options);
    
    if (nodes.length === 0) {
      throw new Error('No se encontraron nodos en el diagrama Draw.io');
    }
    
    // Determine best diagram type based on content
    const detectedType = detectDiagramType(nodes, edges);
    const type = diagramType === 'auto' ? detectedType : diagramType;
    
    switch (type) {
      case 'sequence':
        return generateSequenceDiagram(nodes, edges);
      case 'class':
        return generateClassDiagram(nodes, edges);
      default:
        return generateFlowchart(nodes, edges, direction);
    }
  } catch (error) {
    throw new Error(`Error al convertir Draw.io a Mermaid: ${error.message}`);
  }
}

/**
 * Detect diagram type from content
 */
function detectDiagramType(nodes, edges) {
  // Check for class diagram patterns (structured class nodes)
  const isClassDiagram = nodes.some(n => n.type === 'class' || (n.label && (n.label.includes('class') || n.label.includes('interface'))));
  
  // Check for sequence diagram patterns
  const hasSequencePatterns = edges.some(e => 
    e.label && (e.label.includes('request') || e.label.includes('response') || e.label.includes('call'))
  );
  
  if (hasSequencePatterns) return 'sequence';
  if (isClassDiagram) return 'class';
  return 'flowchart';
}

/**
 * Generate Mermaid flowchart syntax
 */
function generateFlowchart(nodes, edges, direction) {
  const lines = [];
  
  // Header
  lines.push(`flowchart ${direction}`);
  lines.push('');
  
  // Generate node definitions
  const nodeIds = new Set();
  nodes.forEach(node => {
    nodeIds.add(node.id);
    const nodeDef = formatFlowchartNode(node);
    lines.push(`    ${nodeDef}`);
  });
  
  // Add blank line before edges
  if (edges.length > 0) {
    lines.push('');
  }
  
  // Generate edge definitions
  edges.forEach(edge => {
    if (!edge.source || !edge.target) return;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    
    const edgeDef = formatFlowchartEdge(edge);
    lines.push(`    ${edgeDef}`);
  });
  
  return lines.join('\n');
}

/**
 * Format a node for flowchart
 */
function formatFlowchartNode(node) {
  const id = sanitizeId(node.id);
  const rawLabel = node.label || id;
  const label = escapeMermaidLabel(rawLabel);
  
  // Shape-specific formatting
  switch (node.shape) {
    case 'diamond':
      return `${id}{${label}}`;
    case 'circle':
      return `${id}((${label}))`;
    case 'rounded':
      return `${id}(${label})`;
    case 'stadium':
      return `${id}([${label}])`;
    case 'subroutine':
      return `${id}[[${label}]]`;
    case 'cylinder':
      return `${id}[(${label})]`;
    case 'hexagon':
      return `${id}{{${label}}}`;
    case 'parallelogram':
      return `${id}[/${label}/]`;
    case 'asymmetric':
      return `${id}>${label}]`;
    default:
      return `${id}[${label}]`;
  }
}

/**
 * Format an edge for flowchart
 */
function formatFlowchartEdge(edge) {
  const source = sanitizeId(edge.source);
  const target = sanitizeId(edge.target);
  const rawLabel = edge.label;
  
  // Edge type from style
  let arrow = '-->';
  if (edge.style) {
    if (edge.style.includes('dashed')) {
      arrow = '-.->';
    } else if (edge.style.includes('strokeWidth=2') || edge.style.includes('strokeWidth=3')) {
      arrow = '==>';
    }
  }
  
  if (rawLabel) {
    const label = escapeMermaidLabel(rawLabel);
    return `${source} ${arrow}|${label}| ${target}`;
  }
  return `${source} ${arrow} ${target}`;
}

/**
 * Generate Mermaid sequence diagram
 */
function generateSequenceDiagram(nodes, edges) {
  const lines = [];
  
  lines.push('sequenceDiagram');
  lines.push('');
  
  // Declare participants
  nodes.forEach(node => {
    const id = sanitizeId(node.id);
    const label = escapeMermaidLabel(node.label || id);
    if (node.shape === 'circle') {
      lines.push(`    actor ${id} as ${label}`);
    } else {
      lines.push(`    participant ${id} as ${label}`);
    }
  });
  
  lines.push('');
  
  // Add messages
  edges.forEach(edge => {
    if (!edge.source || !edge.target) return;
    const source = sanitizeId(edge.source);
    const target = sanitizeId(edge.target);
    const label = escapeMermaidLabel(edge.label || 'message');
    
    let arrow = '->>';
    if (edge.style && edge.style.includes('dashed')) {
      arrow = '-->>';
    }
    
    lines.push(`    ${source}${arrow}${target}: ${label}`);
  });
  
  return lines.join('\n');
}

/**
 * Generate Mermaid class diagram
 */
function generateClassDiagram(nodes, edges) {
  const lines = [];
  
  lines.push('classDiagram');
  lines.push('');
  
  // 1. Declare classes
  nodes.forEach(node => {
    // Sanitize ID for Mermaid syntax
    const id = sanitizeId(node.id);
    const rawName = node.name || node.label || id;
    
    // Clean name for display (remove markdown bolding if present)
    let displayName = rawName.replace(/\*\*/g, '');
    
    // If ID is auto-generated (n_...), try to use a meaningful alias if Name is different
    // Syntax: class ID["Name"]
    // Only use quotes if strictly necessary or if name differs from ID
    const nameNeedsQuotes = /[^a-zA-Z0-9_]/.test(displayName) || displayName !== id;
    const classDef = nameNeedsQuotes ? `class ${id}["${displayName}"]` : `class ${id}`;

    if (node.members && node.members.length > 0) {
        lines.push(`    ${classDef} {`);
        node.members.forEach(member => {
            // User requested to remove "+" from first attributes.
            // We'll just output the member as is, or maybe clean it but not force visibility.
            let cleanMember = member.trim();
            lines.push(`        ${cleanMember}`);
        });
        lines.push(`    }`);
    } else {
        lines.push(`    ${classDef}`);
    }
  });
  
  lines.push('');
  
  // 2. Add relationships
  edges.forEach(edge => {
    if (!edge.source || !edge.target) return;
    const source = sanitizeId(edge.source);
    const target = sanitizeId(edge.target);
    
    // Default relationship
    let relation = '-->';
    
    // Attempt to map Draw.io styles to Mermaid relationships
    if (edge.style) {
      if (edge.style.includes('endArrow=diamondThin') || edge.style.includes('endArrow=diamond')) {
        relation = 'o--'; // Aggregation
      } else if (edge.style.includes('endArrow=block') && edge.style.includes('dashed')) {
        relation = '..|>'; // Realization
      } else if (edge.style.includes('endArrow=block')) {
        relation = '--|>'; // Inheritance
      } else if (edge.style.includes('dashed')) {
          relation = '..>'; // Dependency
      }
    }
    
    const label = edge.label ? ` : ${escapeMermaidLabel(edge.label)}` : '';
    lines.push(`    ${source} ${relation} ${target}${label}`);
  });
  
  return lines.join('\n');
}

/**
 * Sanitize ID for Mermaid (no spaces, special chars)
 */
function sanitizeId(id) {
  if (!id) return 'node';
  
  // Replace spaces and special characters
  let sanitized = id
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
  
  // Ensure starts with letter or underscore
  if (/^[0-9]/.test(sanitized)) {
    sanitized = 'n_' + sanitized;
  }
  
  return sanitized || 'node';
}

/**
 * Escape label for Mermaid
 * Wraps in quotes if contains special characters
 */
function escapeMermaidLabel(label) {
  if (!label) return '';
  
  // If label contains characters that break Mermaid parsing, wrap in quotes
  // Parentheses, brackets, curly braces, quotes, pipes, semicolons
  if (/[\(\)\[\]\{\}"'\|;]/.test(label)) {
    // Escape existing double quotes with #quot;
    const escaped = label.replace(/"/g, '#quot;');
    return `"${escaped}"`;
  }
  
  return label;
}

export default {
  convertDrawioToMermaid
};
