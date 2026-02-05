/**
 * Diagram Templates
 * Predefined templates for various diagram types
 */

export const templates = [
  {
    id: 'flowchart-basic',
    name: 'Basic Flowchart',
    description: 'Simple flowchart with decision',
    type: 'mermaid',
    code: `flowchart TD
    A[Start] --> B{Condition?}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`
  },
  {
    id: 'flowchart-process',
    name: 'Business Process',
    description: 'Multi-step process flow',
    type: 'mermaid',
    code: `flowchart LR
    A[Request] --> B[Review]
    B --> C{Approved?}
    C -->|Yes| D[Processing]
    C -->|No| E[Rejected]
    D --> F[Completed]
    E --> G[Notify]`
  },
  {
    id: 'sequence-api',
    name: 'API Sequence',
    description: 'Sequence diagram for API calls',
    type: 'mermaid',
    code: `sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as Database
    
    C->>S: GET /api/data
    S->>DB: SELECT * FROM data
    DB-->>S: Results
    S-->>C: JSON Response`
  },
  {
    id: 'sequence-auth',
    name: 'Authentication',
    description: 'User authentication flow',
    type: 'mermaid',
    code: `sequenceDiagram
    actor U as User
    participant A as App
    participant Auth as Auth Service
    participant DB as Database
    
    U->>A: Login (email, password)
    A->>Auth: Validate credentials
    Auth->>DB: Check user
    DB-->>Auth: User data
    Auth-->>A: JWT Token
    A-->>U: Login success`
  },
  {
    id: 'class-mvc',
    name: 'MVC Class Diagram',
    description: 'Model-View-Controller architecture',
    type: 'mermaid',
    code: `classDiagram
    class Controller {
        +handleRequest()
        +sendResponse()
    }
    class Model {
        -data
        +getData()
        +setData()
    }
    class View {
        +render()
        +update()
    }
    
    Controller --> Model
    Controller --> View
    View --> Model`
  },
  {
    id: 'state-order',
    name: 'Order States',
    description: 'State diagram for order processing',
    type: 'mermaid',
    code: `stateDiagram-v2
    [*] --> Pending
    Pending --> Processing: Confirm
    Processing --> Shipped: Dispatch
    Shipped --> Delivered: Deliver
    Delivered --> [*]
    
    Processing --> Cancelled: Cancel
    Pending --> Cancelled: Cancel
    Cancelled --> [*]`
  },
  {
    id: 'er-ecommerce',
    name: 'E-commerce ER',
    description: 'Entity-Relationship for online store',
    type: 'mermaid',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
    CUSTOMER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        date created
        string status
    }
    PRODUCT {
        int id PK
        string name
        float price
    }`
  },
  {
    id: 'gantt-project',
    name: 'Project Schedule',
    description: 'Gantt diagram for project management',
    type: 'mermaid',
    code: `gantt
    title Project Schedule
    dateFormat YYYY-MM-DD
    
    section Planning
    Analysis           :a1, 2024-01-01, 7d
    Design             :a2, after a1, 5d
    
    section Development
    Backend            :b1, after a2, 14d
    Frontend           :b2, after a2, 14d
    
    section Testing
    Tests              :c1, after b1, 7d
    deploy             :c2, after c1, 3d`
  },
  {
    id: 'pie-budget',
    name: 'Pie Chart',
    description: 'Budget distribution',
    type: 'mermaid',
    code: `pie showData
    title Budget Distribution
    "Development" : 45
    "Design" : 20
    "Marketing" : 15
    "Operations" : 12
    "Others" : 8`
  },
  {
    id: 'mindmap-ideas',
    name: 'Mind Map',
    description: 'Idea organization',
    type: 'mermaid',
    code: `mindmap
  root((Project))
    Phase 1
      Research
      Analysis
    Phase 2
      Design
      Prototype
    Phase 3
      Development
      Testing
    Phase 4
      Launch
      Support`
  }
];

/**
 * Get template by ID
 */
export function getTemplateById(id) {
  return templates.find(t => t.id === id);
}

/**
 * Get templates by type
 */
export function getTemplatesByType(type) {
  return templates.filter(t => t.type === type);
}

/**
 * Render templates grid
 */
export function renderTemplatesGrid(containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = templates.map(template => `
    <div class="template-card" data-template-id="${template.id}">
      <h4>${template.name}</h4>
      <p>${template.description}</p>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const templateId = card.dataset.templateId;
      const template = getTemplateById(templateId);
      if (template && onSelect) {
        onSelect(template);
      }
    });
  });
}

export default {
  templates,
  getTemplateById,
  getTemplatesByType,
  renderTemplatesGrid
};
