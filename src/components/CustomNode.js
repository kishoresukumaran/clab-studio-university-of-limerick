/* This is the custom node component for the topology designer. It is used to display a custom node in the topology designer. 
* Here I am using the custom svg to display the router and the hosts. 
* The svg is stored in the assets folder.
* The svg is used to display the router and the hosts.
* The svg is used to display the node in the topology designer.
*/
import React from 'react';
import { Handle, Position } from 'react-flow-renderer';
import NodeIcon from '../assets/my-node.svg';

const CustomNode = ({ data }) => {
  return (
    <div className="custom-svg-node">
      <Handle type="target" position={Position.Top} className="custom-handle custom-handle-top" />
      <img src={NodeIcon} alt="Node Icon" className="node-icon-svg" />
      <div className="node-label-svg">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="custom-handle custom-handle-bottom" />
    </div>
  );
};

export default CustomNode; 