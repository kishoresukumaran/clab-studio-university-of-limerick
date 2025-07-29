import React from 'react';
import { Router, GitBranch, HardDrive, Package } from 'lucide-react';

const Sidebar = ({ onNodeClick }) => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeClick = (nodeType) => {
    if (onNodeClick) {
      onNodeClick(nodeType);
    }
  };

  return (
    <aside>
      <div className="description"><h3 className="settings-heading">Click or drag to add nodes</h3></div>
      <div className="node-buttons">
        <div
          className="node"
          onDragStart={(event) => onDragStart(event, 'router')}
          onClick={() => handleNodeClick('router')}
          draggable
          style={{ cursor: 'pointer' }}
          title="cEOS Router - Click to create or drag to position"
        >
          <Router size={24} className="node-icon" />
          <span className="node-label">Router</span>
        </div>
        
        <div
          className="node"
          onDragStart={(event) => onDragStart(event, 'bridge')}
          onClick={() => handleNodeClick('bridge')}
          draggable
          style={{ cursor: 'pointer' }}
          title="Network Bridge - Click to create or drag to position"
        >
          <GitBranch size={24} className="node-icon" />
          <span className="node-label">Bridge</span>
        </div>
        
        <div
          className="node"
          onDragStart={(event) => onDragStart(event, 'linux-host')}
          onClick={() => handleNodeClick('linux-host')}
          draggable
          style={{ cursor: 'pointer' }}
          title="Linux Host - Click to create or drag to position"
        >
          <HardDrive size={24} className="node-icon" />
          <span className="node-label">Linux Host</span>
        </div>
        
        <div
          className="node"
          onDragStart={(event) => onDragStart(event, 'container')}
          onClick={() => handleNodeClick('container')}
          draggable
          style={{ cursor: 'pointer' }}
          title="Container - Click to create or drag to position"
        >
          <Package size={24} className="node-icon" />
          <span className="node-label">Container</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;