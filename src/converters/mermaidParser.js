/**
 * Mermaid Parser
 * Parses Mermaid diagram syntax and extracts nodes and edges
 */

/**
 * Parse Mermaid code and extract structure
 */
export function parseMermaidCode(code) {
  const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  
  if (lines.length === 0) {
    throw new Error('El código Mermaid está vacío');
  }
  
  // Detect diagram type
  const firstLine = lines[0].toLowerCase();
  let diagramType = 'flowchart';
  
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) {
    diagramType = 'flowchart';
  } else if (firstLine.startsWith('sequencediagram')) {
    diagramType = 'sequence';
  } else if (firstLine.startsWith('classdiagram')) {
    diagramType = 'class';
  } else if (firstLine.startsWith('statediagram')) {
    diagramType = 'state';
  } else if (firstLine.startsWith('erdiagram')) {
    diagramType = 'er';
  } else if (firstLine.startsWith('gantt')) {
    diagramType = 'gantt';
  } else if (firstLine.startsWith('pie')) {
    diagramType = 'pie';
  }
  
  let result;
  switch (diagramType) {
    case 'flowchart':
      result = parseFlowchart(lines);
      break;
    case 'sequence':
      result = parseSequenceDiagram(lines);
      break;
    case 'class':
      result = parseClassDiagram(lines);
      break;
    default:
      result = parseFlowchart(lines);
  }
  
  return { ...result, diagramType };
}

/**
 * Parse flowchart/graph diagram
 */
function parseFlowchart(lines) {
  const nodes = new Map();
  const edges = [];
  const subgraphs = [];
  
  let currentSubgraph = null;
  
  // Node shape patterns
  const nodePatterns = [
    { regex: /\[([^\]]+)\]/, shape: 'rectangle' },      // [text]
    { regex: /\(([^)]+)\)/, shape: 'rounded' },         // (text)
    { regex: /\(\[([^\]]+)\]\)/, shape: 'stadium' },    // ([text])
    { regex: /\[\[([^\]]+)\]\]/, shape: 'subroutine' }, // [[text]]
    { regex: /\[\(([^)]+)\)\]/, shape: 'cylinder' },    // [(text)]
    { regex: /\{\{([^}]+)\}\}/, shape: 'hexagon' },     // {{text}}
    { regex: /\{([^}]+)\}/, shape: 'diamond' },         // {text}
    { regex: /\(\(([^)]+)\)\)/, shape: 'circle' },      // ((text))
    { regex: /\>([^\]]+)\]/, shape: 'asymmetric' },     // >text]
    { regex: /\[\/([^\/]+)\/\]/, shape: 'parallelogram' } // [/text/]
  ];
  
  // Edge patterns
  const edgePatterns = [
    { regex: /-->\|([^|]+)\|/, type: 'arrow', hasLabel: true },
    { regex: /-->/, type: 'arrow', hasLabel: false },
    { regex: /---\|([^|]+)\|/, type: 'line', hasLabel: true },
    { regex: /---/, type: 'line', hasLabel: false },
    { regex: /-\.->\|([^|]+)\|/, type: 'dotted', hasLabel: true },
    { regex: /-\.->/, type: 'dotted', hasLabel: false },
    { regex: /==>\|([^|]+)\|/, type: 'thick', hasLabel: true },
    { regex: /==>/, type: 'thick', hasLabel: false }
  ];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip direction declarations
    if (/^(TB|TD|BT|RL|LR)$/.test(line)) continue;
    
    // Handle subgraphs
    if (line.startsWith('subgraph')) {
      const match = line.match(/subgraph\s+(\S+)(?:\s*\[([^\]]+)\])?/);
      if (match) {
        currentSubgraph = {
          id: match[1],
          label: match[2] || match[1],
          nodes: []
        };
        subgraphs.push(currentSubgraph);
      }
      continue;
    }
    
    if (line === 'end') {
      currentSubgraph = null;
      continue;
    }
    
    // Parse edges and nodes from the line
    parseFlowchartLine(line, nodes, edges, nodePatterns, edgePatterns, currentSubgraph);
  }
  
  return {
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs
  };
}

/**
 * Parse a single flowchart line
 */
function parseFlowchartLine(line, nodes, edges, nodePatterns, edgePatterns, currentSubgraph) {
  // Find edge pattern in line
  let edgeMatch = null;
  let edgeType = 'arrow';
  let edgeLabel = '';
  let edgeIndex = -1;
  let matchLength = 0;
  
  for (const pattern of edgePatterns) {
    const match = line.match(pattern.regex);
    if (match && (edgeIndex === -1 || match.index < edgeIndex)) {
      edgeMatch = match;
      edgeType = pattern.type;
      edgeLabel = pattern.hasLabel ? match[1] : '';
      edgeIndex = match.index;
      matchLength = match[0].length;
    }
  }
  
  if (edgeMatch) {
    // Split line into source and target parts
    const sourcePart = line.substring(0, edgeIndex).trim();
    const targetPart = line.substring(edgeIndex + matchLength).trim();
    
    // Parse source node
    const sourceNode = parseNodeFromPart(sourcePart, nodePatterns);
    if (sourceNode) {
      if (!nodes.has(sourceNode.id)) {
        nodes.set(sourceNode.id, sourceNode);
        if (currentSubgraph) {
          currentSubgraph.nodes.push(sourceNode.id);
        }
      }
    }
    
    // Parse target node(s) - handle chained connections
    const targetNodes = parseChainedTargets(targetPart, nodes, edges, nodePatterns, edgePatterns, currentSubgraph);
    
    if (sourceNode && targetNodes.length > 0) {
      edges.push({
        id: `edge_${edges.length}`,
        source: sourceNode.id,
        target: targetNodes[0].id,
        label: edgeLabel,
        type: edgeType
      });
    }
  } else {
    // Just a node definition
    const node = parseNodeFromPart(line, nodePatterns);
    if (node && !nodes.has(node.id)) {
      nodes.set(node.id, node);
      if (currentSubgraph) {
        currentSubgraph.nodes.push(node.id);
      }
    }
  }
}

/**
 * Parse chained target nodes (A --> B --> C)
 */
function parseChainedTargets(part, nodes, edges, nodePatterns, edgePatterns, currentSubgraph) {
  const result = [];
  
  // Check if there are more edges in this part
  let hasMoreEdges = false;
  for (const pattern of edgePatterns) {
    if (pattern.regex.test(part)) {
      hasMoreEdges = true;
      break;
    }
  }
  
  if (hasMoreEdges) {
    // Recursively parse
    parseFlowchartLine(part, nodes, edges, nodePatterns, edgePatterns, currentSubgraph);
    // Get the first node from the part
    const firstEdgeMatch = part.match(/^([^-=]+)/);
    if (firstEdgeMatch) {
      const node = parseNodeFromPart(firstEdgeMatch[1].trim(), nodePatterns);
      if (node) {
        result.push(node);
      }
    }
  } else {
    // Just a node
    const node = parseNodeFromPart(part, nodePatterns);
    if (node) {
      if (!nodes.has(node.id)) {
        nodes.set(node.id, node);
        if (currentSubgraph) {
          currentSubgraph.nodes.push(node.id);
        }
      }
      result.push(node);
    }
  }
  
  return result;
}

/**
 * Parse node from a string part
 */
function parseNodeFromPart(part, nodePatterns) {
  if (!part.trim()) return null;
  
  // Try to extract node ID and content
  let id = '';
  let label = '';
  let shape = 'rectangle';
  
  // Check for node patterns
  for (const pattern of nodePatterns) {
    const match = part.match(pattern.regex);
    if (match) {
      // ID is before the shape brackets
      const idMatch = part.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
      id = idMatch ? idMatch[1] : `node_${Date.now()}`;
      label = match[1].trim();
      shape = pattern.shape;
      break;
    }
  }
  
  // If no pattern matched, it's just an ID
  if (!id) {
    const idMatch = part.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (idMatch) {
      id = idMatch[1];
      label = id;
    }
  }
  
  if (!id) return null;
  
  return { id, label, shape };
}

/**
 * Parse sequence diagram
 */
function parseSequenceDiagram(lines) {
  const nodes = [];
  const edges = [];
  const participants = new Set();
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Participant declaration
    const participantMatch = line.match(/participant\s+(\S+)(?:\s+as\s+(.+))?/i);
    if (participantMatch) {
      const id = participantMatch[1];
      const label = participantMatch[2] || id;
      if (!participants.has(id)) {
        participants.add(id);
        nodes.push({ id, label, shape: 'rectangle' });
      }
      continue;
    }
    
    // Actor declaration
    const actorMatch = line.match(/actor\s+(\S+)(?:\s+as\s+(.+))?/i);
    if (actorMatch) {
      const id = actorMatch[1];
      const label = actorMatch[2] || id;
      if (!participants.has(id)) {
        participants.add(id);
        nodes.push({ id, label, shape: 'circle' });
      }
      continue;
    }
    
    // Message arrows
    const messageMatch = line.match(/(\S+)\s*(->>|-->>|->|-->|-)>\s*(\S+)\s*:\s*(.+)/);
    if (messageMatch) {
      const source = messageMatch[1];
      const target = messageMatch[3];
      const label = messageMatch[4];
      
      // Add participants if not declared
      if (!participants.has(source)) {
        participants.add(source);
        nodes.push({ id: source, label: source, shape: 'rectangle' });
      }
      if (!participants.has(target)) {
        participants.add(target);
        nodes.push({ id: target, label: target, shape: 'rectangle' });
      }
      
      edges.push({
        id: `edge_${edges.length}`,
        source,
        target,
        label,
        type: 'arrow'
      });
    }
  }
  
  return { nodes, edges, subgraphs: [] };
}

/**
 * Parse class diagram
 */
function parseClassDiagram(lines) {
  const nodes = [];
  const edges = [];
  const classes = new Set();
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Class declaration
    const classMatch = line.match(/class\s+(\S+)\s*\{?/);
    if (classMatch) {
      const id = classMatch[1];
      if (!classes.has(id)) {
        classes.add(id);
        nodes.push({ id, label: id, shape: 'rectangle' });
      }
      continue;
    }
    
    // Relationship
    const relationMatch = line.match(/(\S+)\s*(<\|--|--\|>|<--|\*--|o--|-->|--\*|--o|--)\s*(\S+)(?:\s*:\s*(.+))?/);
    if (relationMatch) {
      const source = relationMatch[1];
      const target = relationMatch[3];
      const label = relationMatch[4] || '';
      
      if (!classes.has(source)) {
        classes.add(source);
        nodes.push({ id: source, label: source, shape: 'rectangle' });
      }
      if (!classes.has(target)) {
        classes.add(target);
        nodes.push({ id: target, label: target, shape: 'rectangle' });
      }
      
      edges.push({
        id: `edge_${edges.length}`,
        source,
        target,
        label,
        type: 'arrow'
      });
    }
  }
  
  return { nodes, edges, subgraphs: [] };
}

/**
 * Validate Mermaid syntax
 */
export function validateMermaidSyntax(code) {
  const errors = [];
  const lines = code.split('\n');
  
  if (lines.length === 0 || !lines[0].trim()) {
    errors.push({ line: 1, message: 'El código Mermaid está vacío' });
    return errors;
  }
  
  const firstLine = lines[0].trim().toLowerCase();
  const validDiagramTypes = [
    'flowchart', 'graph', 'sequencediagram', 'classdiagram',
    'statediagram', 'erdiagram', 'gantt', 'pie', 'mindmap'
  ];
  
  const hasValidType = validDiagramTypes.some(type => 
    firstLine.startsWith(type)
  );
  
  if (!hasValidType) {
    errors.push({ 
      line: 1, 
      message: `Tipo de diagrama no reconocido. Debe comenzar con: ${validDiagramTypes.join(', ')}` 
    });
  }
  
  // Check for unbalanced brackets
  let brackets = { '[': 0, '{': 0, '(': 0 };
  const closingBrackets = { ']': '[', '}': '{', ')': '(' };
  
  lines.forEach((line, index) => {
    for (const char of line) {
      if (brackets.hasOwnProperty(char)) {
        brackets[char]++;
      } else if (closingBrackets.hasOwnProperty(char)) {
        brackets[closingBrackets[char]]--;
        if (brackets[closingBrackets[char]] < 0) {
          errors.push({ 
            line: index + 1, 
            message: `Corchete de cierre '${char}' sin correspondiente apertura` 
          });
          brackets[closingBrackets[char]] = 0;
        }
      }
    }
  });
  
  // Check for unclosed brackets at end
  for (const [bracket, count] of Object.entries(brackets)) {
    if (count > 0) {
      errors.push({ 
        line: lines.length, 
        message: `${count} corchete(s) '${bracket}' sin cerrar` 
      });
    }
  }
  
  return errors;
}

export default {
  parseMermaidCode,
  validateMermaidSyntax
};
