import React from "react";
import ReactFlow, { addEdge, useNodesState, useEdgesState } from "react-flow-renderer";

const DesignArea = ({ nodes, edges, setNodes, setEdges, updateYaml }) => {
  const [reactFlowNodes, setReactFlowNodes] = useNodesState(nodes);
  const [reactFlowEdges, setReactFlowEdges] = useEdgesState(edges);

  /* This is the function to handle the connection of a node. When you click on a node and drag it to another node, this function is called when a connection is made. */
  const onConnect = (params) => {
    const updatedEdges = addEdge(params, reactFlowEdges);
    setReactFlowEdges(updatedEdges);
    updateYaml(reactFlowNodes, updatedEdges);
  };

  const onNodesChange = (changes) => {
    const updatedNodes = changes.reduce((acc, change) => {
      if (change.type === "add") {
        acc.push({
          id: change.item.id,
          data: { kind: change.item.data.kind || "default", label: "New Node" },
          position: change.item.position,
        });
      }
      return acc;
    }, reactFlowNodes);

    setReactFlowNodes(updatedNodes);
    updateYaml(updatedNodes, reactFlowEdges);
  };

  return (
    <div className="design-area">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        fitView
      />
    </div>
  );
};

export default DesignArea;
