import React from 'react';

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  // Create a straight line path
  const edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  
  // Calculate positions for start and end labels
  // Calculate the angle of the line
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);
  
  // Calculate positions with a slight offset perpendicular to the line
  const offset = 10; // Reduced offset distance from the line
  const perpX = Math.sin(angle) * offset;
  const perpY = -Math.cos(angle) * offset;
  
  const startLabelX = sourceX + (targetX - sourceX) * 0.15 + perpX;
  const startLabelY = sourceY + (targetY - sourceY) * 0.15 + perpY;
  const endLabelX = sourceX + (targetX - sourceX) * 0.85 + perpX;
  const endLabelY = sourceY + (targetY - sourceY) * 0.85 + perpY;

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={1.5}
      />
      <foreignObject
        width={10}
        height={10}
        x={startLabelX - 20}
        y={startLabelY - 12}
        className="edge-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div
          className="edge-label start-label nodrag nopan"
        >
          {data?.sourceInterface || ''}
        </div>
      </foreignObject>
      
      <foreignObject
        width={10}
        height={10}
        x={endLabelX - 20}
        y={endLabelY - 12}
        className="edge-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div
          className="edge-label end-label nodrag nopan"
        >
          {data?.targetInterface || ''}
        </div>
      </foreignObject>
    </>
  );
}

export default CustomEdge; 