import React from 'react';
import myNodeIcon from './assets/my-node.svg';
import serverIcon from './assets/server.svg';

const Sidebar = () => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside>
      <div className="description"><h3 className="settings-heading">Drag and drop to add nodes</h3></div>
      <div className="node-buttons">
        <div
          className="node"
          onDragStart={(event) => onDragStart(event, 'router')}
          draggable
          style={{ cursor: 'grab' }}
          title="cEOS Router"
        >
          <img src={myNodeIcon} alt="Router" className="node-icon" />
        </div>
        <div
          className="node"
          onDragStart={(event) => onDragStart(event, 'server')}
          draggable
          style={{ cursor: 'grab' }}
          title="Linux Server/Hosts"
        >
          <img src={serverIcon} alt="Server/Hosts" className="node-icon" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;