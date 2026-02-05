/**
 * Mermaid to Draw.io Converter
 * Converts parsed Mermaid structure to draw.io XML
 */

import { parseMermaidCode } from './mermaidParser.js';
import { generateDrawioXML } from './drawioParser.js';

/**
 * Convert Mermaid code to draw.io XML
 */
export function convertMermaidToDrawio(mermaidCode, options = {}) {
  try {
    // Parse the Mermaid code
    const { nodes, edges, subgraphs, diagramType } = parseMermaidCode(mermaidCode);
    
    if (nodes.length === 0) {
      throw new Error('No se encontraron nodos en el diagrama Mermaid');
    }
    
    // Calculate positions for nodes
    const positionedNodes = calculateNodePositions(nodes, edges, diagramType);
    
    // Map node IDs for edges
    const nodeIdMap = new Map();
    positionedNodes.forEach(node => {
      nodeIdMap.set(node.id, node.id);
    });
    
    // Filter edges with valid source/target
    const validEdges = edges.filter(edge => 
      nodeIdMap.has(edge.source) && nodeIdMap.has(edge.target)
    );
    
    // Generate draw.io XML
    return generateDrawioXML(positionedNodes, validEdges);
    
  } catch (error) {
    throw new Error(`Error al convertir Mermaid a Draw.io: ${error.message}`);
  }
}

/**
 * Calculate node positions based on diagram structure
 */
function calculateNodePositions(nodes, edges, diagramType) {
  // Build adjacency list for layout
  const adjacency = new Map();
  const inDegree = new Map();
  
  nodes.forEach(node => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });
  
  edges.forEach(edge => {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source).push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });
  
  // Use topological sort for layered layout
  const layers = [];
  const visited = new Set();
  const nodeToLayer = new Map();
  
  // Find root nodes (no incoming edges)
  let currentLayer = nodes
    .filter(n => inDegree.get(n.id) === 0)
    .map(n => n.id);
  
  // If no root nodes, start with first node
  if (currentLayer.length === 0 && nodes.length > 0) {
    currentLayer = [nodes[0].id];
  }
  
  // BFS to assign layers
  while (currentLayer.length > 0) {
    layers.push([...currentLayer]);
    currentLayer.forEach(id => {
      visited.add(id);
      nodeToLayer.set(id, layers.length - 1);
    });
    
    const nextLayer = new Set();
    currentLayer.forEach(id => {
      const neighbors = adjacency.get(id) || [];
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          nextLayer.add(neighbor);
        }
      });
    });
    
    currentLayer = Array.from(nextLayer);
  }
  
  // Add any remaining unvisited nodes
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(node.id);
      nodeToLayer.set(node.id, layers.length - 1);
    }
  });
  
  // Calculate positions
  const nodeWidth = 120;
  const nodeHeight = 60;
  const horizontalSpacing = 180;
  const verticalSpacing = 120;
  const startX = 50;
  const startY = 50;
  
  const positionMap = new Map();
  
  layers.forEach((layer, layerIndex) => {
    const layerWidth = layer.length * horizontalSpacing;
    const startOffset = -layerWidth / 2 + horizontalSpacing / 2;
    
    layer.forEach((nodeId, nodeIndex) => {
      const x = startX + 300 + startOffset + nodeIndex * horizontalSpacing;
      const y = startY + layerIndex * verticalSpacing;
      positionMap.set(nodeId, { x, y });
    });
  });
  
  // Return nodes with positions
  return nodes.map(node => ({
    ...node,
    x: positionMap.get(node.id)?.x || 100,
    y: positionMap.get(node.id)?.y || 100,
    width: nodeWidth,
    height: nodeHeight
  }));
}

/**
 * Get draw.io XML for embedding in iframe
 */
export function getMermaidAsDrawioData(mermaidCode) {
  const xml = convertMermaidToDrawio(mermaidCode);
  
  // Encode for draw.io URL
  const encoded = encodeURIComponent(xml);
  
  return {
    xml,
    encoded,
    dataUrl: `data:text/xml,${encoded}`
  };
}

export default {
  convertMermaidToDrawio,
  getMermaidAsDrawioData
};
