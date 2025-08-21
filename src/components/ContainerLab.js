/**
 * ContainerLab.js - Containerlab Studio
 * 
 * Copyright (c) 2024-2025 Arista Networks, Inc.
 * 
 * Author: Kishore Sukumaran
 * 
 * This component provides the Topology Designer page for designing the containerlab topologies.
 * It displays the side bar with various options to design the topology, allows users to create, modify the topology, and deploy it to a containerlab server.
 * It also shows options to Import and Save the topologies. There is also the File Manager to manage the files in the containerlab servers.
 * 
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  Controls
} from "react-flow-renderer";
import Sidebar from "../Sidebar";
import { saveAs } from "file-saver";
import "../styles.css";
import ELK from 'elkjs/lib/elk.bundled.js';
import { Server, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import LogModal from './LogModal';
import FileManagerModal from './FileManagerModal';
import AnnotationToolbar from './AnnotationToolbar';
import { useTopology } from '../contexts/TopologyContext';

import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism-tomorrow.css';

import { v4 as uuidv4 } from 'uuid'; 
import * as yaml from 'js-yaml'; 

import 'reactflow/dist/style.css';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

const elk = new ELK();

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.spacing.nodeNode': 80,
  'elk.direction': 'RIGHT',
  'elk.spacing.portPort': 30,
};

/**
 * Prepares node and edge data for the ELK layout algorithm.

 * 
 * This function:
 * 1. Transforms React Flow nodes and edges into the format required by the ELK layout algorithm
 * 2. Sets fixed dimensions for each node (150x100)
 * 3. Preserves port information from the original nodes for connection points
 * 4. Maps edge connections using source and target node IDs
 * 
 * The resulting graph object will be processed by the ELK layout engine to calculate
 * optimal positions for all nodes and edges in the network topology visualization.
 */
const getLayoutedElements = async (nodes, edges) => {
  const graph = {
    id: 'root',
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: 150,
      height: 100,
      ports: node.data.ports || []
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  };

  const layoutedGraph = await elk.layout(graph);
  return layoutedGraph;
};

let id = 0;
const getId = () => `node_${id++}`;

const DEFAULT_YAML = {};

/**
 * Converts a containerlab YAML definition to a visual topology for React Flow.
 * 
 * This function:
 * 1. Parses the YAML string into a structured object
 * 2. Extracts node definitions from the YAML topology section
 * 3. Creates new React Flow node objects with appropriate properties
 * 4. Arranges nodes in a simple grid layout
 * 5. Filters edges to only include those connecting nodes in the new topology
 * 
 * The resulting topology can be directly rendered in React Flow, maintaining
 * the structure defined in the containerlab YAML while providing a visual
 * representation of the network.
 */
const convertYamlToTopology = (yamlString, existingEdges, existingNodes) => {
  try {
    const parsedYaml = yaml.load(yamlString);
    if (!parsedYaml?.topology?.nodes) return null;
    const existingPositions = {};
    existingNodes.forEach(node => {
      existingPositions[node.id] = node.position;
    });

    const newNodes = [];
    let nodePosition = { x: 100, y: 100 };

    Object.entries(parsedYaml.topology.nodes).forEach(([nodeName, nodeData]) => {
      newNodes.push({
        id: nodeName,
        type: 'svgNode',
        position: existingPositions[nodeName] || { ...nodePosition },
        data: { 
          label: nodeName,
          kind: nodeData.kind
        }
      });
      nodePosition.x += 200;
    });

    // Filter and ensure all edges have the custom type
    const filteredEdges = existingEdges
      .filter(edge => 
        newNodes.some(node => node.id === edge.source) && 
        newNodes.some(node => node.id === edge.target)
      )
      .map(edge => ({
        ...edge,
        type: 'custom'
      }));
      
    return {
      nodes: newNodes,
      edges: filteredEdges
    };
  } catch (error) {
    console.error('Invalid YAML:', error);
    return null;
  }
};

// This is the list of random names to use for the name of the topology in the topology designer page
const randomNames = {
  cartoonCharacters: [
    'Mickey', 'Donald', 'Goofy', 'Pluto', 'Minnie', 'Daisy', 'Scrooge', 'Huey', 'Dewey', 'Louie',
    'Bugs', 'Daffy', 'Porky', 'Tweety', 'Sylvester', 'Elmer', 'RoadRunner', 'WileE', 'Marvin', 'Speedy',
    'Tom', 'Jerry', 'Spike', 'Tyke', 'Droopy', 'Butch', 'Nibbles', 'Toodles', 'Lightning', 'Tuffy',
    'Scooby', 'Shaggy', 'Velma', 'Daphne', 'Fred', 'Scrappy', 'Yogi', 'BooBoo', 'Cindy', 'RangerSmith',
    'Snagglepuss', 'Huckleberry', 'QuickDraw', 'BabaLooey', 'AugieDoggie', 'DoggieDaddy', 'Pixie', 'Dixie', 'Jinks', 'TopCat',
    'Benny', 'ChooChoo', 'Brain', 'FancyFancy', 'Spook', 'Flintstone', 'Barney', 'Wilma', 'Betty', 'Pebbles',
    'BammBamm', 'Dino', 'MrSlate', 'GeorgeJetson', 'JaneJetson', 'JudyJetson', 'ElroyJetson', 'Astro', 'Rosie', 'Cogswell',
    'RichieRich', 'Casper', 'Wendy', 'HotStuff', 'LittleDot', 'LittleLot', 'Harvey', 'BabyHuey', 'Felix', 'Garfield'
  ],
  irishPlaces: [
    'Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Kilkenny', 'Sligo', 'Donegal', 'Kerry', 'Clare',
    'Mayo', 'Wicklow', 'Kildare', 'Meath', 'Louth', 'Wexford', 'Carlow', 'Laois', 'Offaly', 'Westmeath',
    'Roscommon', 'Tipperary', 'Monaghan', 'Cavan', 'Leitrim', 'Longford', 'Fermanagh', 'Armagh', 'Down', 'Antrim',
    'Derry', 'Tyrone', 'Lisburn', 'Newry', 'Ennis', 'Tralee', 'Letterkenny', 'Navan', 'Naas', 'Athlone',
    'Mullingar', 'Portlaoise', 'Tullamore', 'Bray', 'Greystones', 'Swords', 'Drogheda', 'Dundalk', 'Arklow', 'Balbriggan',
    'Celbridge', 'Clonmel', 'KilkennyCity', 'Carrickfergus', 'Newtownabbey', 'Bangor', 'Lurgan', 'Banbridge', 'Omagh', 'Coleraine',
    'Cobh', 'Midleton', 'Mallow', 'Killarney', 'Shannon', 'Tuam', 'Ballina', 'Castlebar', 'Trim', 'Birr'
  ]
};

/**
 * Generates a list of sequential IP addresses from a given subnet.
 */
const generateIpsFromSubnet = (subnet, count) => {
  // Parse the subnet string (e.g., "172.20.20.0/24")
  if (!subnet || !subnet.trim()) return [];
  
  try {
    // Extract the base IP and mask
    const parts = subnet.split('/');
    if (parts.length !== 2) return [];
    
    const baseIpStr = parts[0];
    const mask = parseInt(parts[1], 10);
    
    if (isNaN(mask) || mask < 0 || mask > 32) return [];
    

    const ipParts = baseIpStr.split('.');
    if (ipParts.length !== 4) return [];
    
    const baseIp = ipParts.map(part => parseInt(part, 10));
    if (baseIp.some(part => isNaN(part) || part < 0 || part > 255)) return [];

    const generatedIps = [];

    for (let i = 0; i < count; i++) {
      const hostNum = i + 2; // Start from .2 to avoid the first and last IP addresses in the subnet
      if (hostNum >= 255) break; // Avoid broadcast address
      
      const newIp = [...baseIp];
      newIp[3] = hostNum;
      generatedIps.push(newIp.join('.'));
    }
    
    return generatedIps;
  } catch (error) {
    console.error("Error parsing subnet:", error);
    return [];
  }
};

/**
 * Main component for the Containerlab Studio.
 * 
 * This App component:
 * 1. Manages the state of the topology designer, and handles the desigining of the topology
 * 2. Handles the creation, modification, and deletion of nodes and edges
 * 3. Manages the YAML output generation of the topology
 * 4. Manages the deployment of the topology to a containerlab server
 * 5. Manages the import and save of topologies to the containerlab servers
 */
const App = ({ user, parentSetMode }) => {
  const { topologyState, updateTopologyState } = useTopology();
  const reactFlowWrapper = useRef(null);
  
  // Replace local state with context state
  const [nodes, setNodes, onNodesChange] = useNodesState(topologyState.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(topologyState.edges);
  const [yamlOutput, setYamlOutput] = useState(topologyState.yamlOutput);
  const [topologyName, setTopologyName] = useState(topologyState.topologyName);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNode, setNewNode] = useState(null);
  const [nodeName, setNodeName] = useState("");
  const [nodeBinds, setNodeBinds] = useState([{ source: '', target: '' }]);
  const [nodeMgmtIp, setNodeMgmtIp] = useState("");
  const [mgmtNetwork, setMgmtNetwork] = useState(topologyState.mgmtNetwork);
  const [ipv4Subnet, setIpv4Subnet] = useState(topologyState.ipv4Subnet);
  const [ipv6Subnet, setIpv6Subnet] = useState(topologyState.ipv6Subnet);
  const [isYamlValid, setIsYamlValid] = useState(topologyState.isYamlValid);
  const [yamlParseError, setYamlParseError] = useState(topologyState.yamlParseError);
  const [kinds, setKinds] = useState(topologyState.kinds);
  const [defaultKind, setDefaultKind] = useState(topologyState.defaultKind);
  const [showMgmt, setShowMgmt] = useState(topologyState.showMgmt);
  const [showKind, setShowKind] = useState(topologyState.showKind);
  const [kindName, setKindName] = useState("");
  const [showIpv6, setShowIpv6] = useState(topologyState.showIpv6);
  const [contextMenu, setContextMenu] = useState(null);
  const [showKindConfig, setShowKindConfig] = useState(false);
  const [showDefault, setShowDefault] = useState(topologyState.showDefault);
  const [showKindModal, setShowKindModal] = useState(false);
  const [currentKindIndex, setCurrentKindIndex] = useState(0);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [newEdgeData, setNewEdgeData] = useState(null);
  const [sourceInterface, setSourceInterface] = useState("");
  const [targetInterface, setTargetInterface] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [nodeKind, setNodeKind] = useState("ceos");
  const [nodeImage, setNodeImage] = useState("ceos:4.34.0F");
  const [nodeModalWarning, setNodeModalWarning] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isModifyingEdge, setIsModifyingEdge] = useState(false);
  const [edgeModalWarning, setEdgeModalWarning] = useState(false);
  const [mode, setMode] = useState('containerlab');
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [editableYaml, setEditableYaml] = useState(topologyState.editableYaml);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [deployLoading, setDeployLoading] = useState({});

  const [labExistsOnServer, setLabExistsOnServer] = useState({});
  const [showLogModal, setShowLogModal] = useState(false);
  const [operationLogs, setOperationLogs] = useState('');
  const [operationTitle, setOperationTitle] = useState('');
  const [showSshPortForwarding, setShowSshPortForwarding] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mgmtWarning, setMgmtWarning] = useState(false);
  const [selectedSshServer, setSelectedSshServer] = useState('');
  const [freePorts, setFreePorts] = useState([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  const [modalMode, setModalMode] = useState('import');
  const [nodeInterfaces, setNodeInterfaces] = useState(topologyState.nodeInterfaces || {});
  const [nodeCreationMode, setNodeCreationMode] = useState('single'); 
  const [nodeCount, setNodeCount] = useState(1);
  const [nodeNamePrefix, setNodeNamePrefix] = useState('');
  const [showModifyNodeModal, setShowModifyNodeModal] = useState(false);
  const [serverResources, setServerResources] = useState({});
  const [autoAssignMacSn, setAutoAssignMacSn] = useState({});
  const [isLoadingServerResources, setIsLoadingServerResources] = useState(false);
  const [nodeStartupConfig, setNodeStartupConfig] = useState('');
  const [showFileManagerForStartupConfig, setShowFileManagerForStartupConfig] = useState(false);
  const [showFileManagerForKindStartupConfig, setShowFileManagerForKindStartupConfig] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showFileManagerForBind, setShowFileManagerForBind] = useState(false);
  const [activeBindIndex, setActiveBindIndex] = useState(null);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showOptionalSettings, setShowOptionalSettings] = useState(false);
  const [selectedTopologyNodes, setSelectedTopologyNodes] = useState([]);
  const [serverMetrics, setServerMetrics] = useState({});
  const [nodeCustomFields, setNodeCustomFields] = useState([{ key: '', value: '' }]);
  const [modalType, setModalType] = useState("create");
  const [nodeIpv6MgmtIp, setNodeIpv6MgmtIp] = useState("");

  // Add state for YAML editor toggle
  const [isYamlEditorCollapsed, setIsYamlEditorCollapsed] = useState(() => {
    // Load from localStorage if available, default to true (collapsed)
    const saved = localStorage.getItem('yamlEditorCollapsed');
    return saved ? JSON.parse(saved) : true;
  });

  // Get annotation states from context
  const {
    annotations,
    activeTool,
    selectedAnnotation,
    annotationColor,
    textStyle,
    shapeStyle
  } = topologyState;

  // Helper functions to update annotation states in context
  const setAnnotations = (newAnnotations) => {
    const annotations = typeof newAnnotations === 'function' 
      ? newAnnotations(topologyState.annotations) 
      : newAnnotations;
    updateTopologyState({ annotations });
  };

  const setActiveTool = (newTool) => {
    updateTopologyState({ activeTool: newTool });
  };

  const setSelectedAnnotation = (newSelected) => {
    updateTopologyState({ selectedAnnotation: newSelected });
  };

  const setAnnotationColor = (newColor) => {
    updateTopologyState({ annotationColor: newColor });
  };

  const setTextStyle = (newStyle) => {
    const textStyle = typeof newStyle === 'function' 
      ? newStyle(topologyState.textStyle) 
      : newStyle;
    updateTopologyState({ textStyle });
  };

  const setShapeStyle = (newStyle) => {
    const shapeStyle = typeof newStyle === 'function' 
      ? newStyle(topologyState.shapeStyle) 
      : newStyle;
    updateTopologyState({ shapeStyle });
  };
  
  // Annotation interaction states (these can remain local as they're temporary UI states)
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);

  const nodeTypes = React.useMemo(() => ({ svgNode: CustomNode }), []);
  const edgeTypes = React.useMemo(() => ({ custom: CustomEdge }), []);

  /* This is the list of images that can be used for the nodes in the topology. This is displayed in the Image drop down in the Router details box. Right now it is hardcoded, any changes to the images will need to be made here. */
  const imageOptions = [
    { value: "ceos:4.34.1F", label: "4.34.1F", kind: "ceos" },
    { value: "sonic-vm:202411", label: "sonic:202411", kind: "sonic-vm" },
    { value: "alpine", label: "Alpine", kind: "linux" }
  ];

  /* This is the list of kinds that can be used for the nodes in the topology. This is displayed in the Kind drop down in the Router details box. Right now it is hardcoded, any changes to the kinds will need to be made here. */
  const kindOptions = [
    { value: "ceos", label: "cEOS" },
    { value: "sonic-vm", label: "sonic" },
    { value: "linux", label: "Linux" },
  ];

  const getFilteredImageOptions = () => {
    if (!nodeKind) return [];
    return imageOptions.filter(option => option.kind === nodeKind);
  };

  /* This is the list of servers that can be used for the deployment of the topology. Again this is hardcoded, any changes to the servers will need to be made here. This is displayed in the Server table after you click on deploy */
  const serverOptions = [
    { value: "10.150.48.133", label: "10.150.48.133" }
  ];

  // const handleModeChange = (newMode) => {
  //   setMode(newMode);
  //   setNodes([]);
  //   setEdges([]);
  //   setYamlOutput('');
  // };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        setNodeName("");
        setNodeBinds([""]);
        setNodeMgmtIp("");
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    if (showMgmt) {
      updateYaml(nodes, edges);
    }
  }, [mgmtNetwork, ipv4Subnet, ipv6Subnet]);

  useEffect(() => {
    if (showDefault && defaultKind) {
      updateYaml(nodes, edges);
    }
  }, [defaultKind]);

  useEffect(() => {
    if (showKind) {
      updateYaml(nodes, edges);
    }
  }, [showKind, kinds]);

  useEffect(() => {
    // Only update YAML if there's something to show
    if (nodes.length > 0 || topologyName || showMgmt || showKind || showDefault) {
      updateYaml(nodes, edges);
    }
  }, [showMgmt, showKind, showDefault]);

  const getNextInterfaceNumber = (nodeId) => {
    const usedInterfaces = nodeInterfaces[nodeId] || [];
    let nextNumber = 1;
    while (usedInterfaces.includes(`eth${nextNumber}`)) {
      nextNumber++;
    }
    return nextNumber;
  };

  /* This is the function to update the node interfaces. It is used to update the node interfaces when a new edge is created. */
  const updateNodeInterfaces = (sourceId, targetId, sourceInterface, targetInterface) => {
    setNodeInterfaces(prev => ({
      ...prev,
      [sourceId]: [...(prev[sourceId] || []), sourceInterface],
      [targetId]: [...(prev[targetId] || []), targetInterface]
    }));
  };

  const onConnect = useCallback(
    (params) => {
      // Check if management settings are valid when required
      if (showMgmt && !validateMgmtSettings()) {
        return;
      }

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      if (!sourceNode || !targetNode) return;

      const sourceInterfaceNumber = getNextInterfaceNumber(params.source);
      const targetInterfaceNumber = getNextInterfaceNumber(params.target);

      setNewEdgeData({
        ...params,
        sourceNodeName: sourceNode.data.label,
        targetNodeName: targetNode.data.label,
        sourceInterface: `eth${sourceInterfaceNumber}`,
        targetInterface: `eth${targetInterfaceNumber}`,
      });
      setSourceInterface(`eth${sourceInterfaceNumber}`);
      setTargetInterface(`eth${targetInterfaceNumber}`);
      setIsEdgeModalOpen(true);
    },
    [nodes, nodeInterfaces, showMgmt, mgmtNetwork, ipv4Subnet]
  );

  /* This is the function to validate the topology name. It is used to check if the topology name is empty. */
  const validateTopologyName = () => {
    if (!topologyName.trim()) {
      setShowWarning(true);
      return false;
    }
    return true;
  };

  /* This is the function to validate the management settings. It is used to check if the management network and subnet are set. */
  const validateMgmtSettings = () => {
    if (showMgmt && (!mgmtNetwork.trim() || !ipv4Subnet.trim())) {
      setMgmtWarning(true);
      return false;
    }
    setMgmtWarning(false);
    return true;
  };

  /* This is the function to handle the drop event. It is used to create a new node when a node is dropped on the canvas. */
  const onDrop = useCallback(
    (event) => {
      // Check if management settings are valid when required
      if (showMgmt && !validateMgmtSettings()) {
        event.preventDefault();
        return;
      }

      if (!topologyName.trim()) {
        const newName = generateRandomName();
        setTopologyName(newName);
        // Update the YAML with the new name
        const updatedYaml = yamlOutput.replace(/name:.*/, `name: ${newName}`);
        setYamlOutput(updatedYaml);
      }
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");

      if (!type) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode = {
        id: getId(),
        position,
        data: { label: `${type} node` }
      };

      setNewNode(newNode);
      setIsModalOpen(true);
      setModalType("create"); // Set to create mode
      
      // Set default values based on node type
      if (type === 'router') {
        setNodeNamePrefix('ceos');
        setNodeKind('ceos');
        setNodeImage('ceos:4.34.1F');
      } else if (type === 'server') {
        setNodeNamePrefix('host');
        setNodeKind('linux');
        setNodeImage('alpine');
      }
      
      setNodeCount(1);
      setNodeBinds([""]);
      setNodeMgmtIp("");
      setNodeModalWarning(false);
      setNodeCustomFields([{ key: '', value: '' }]);
    },
    [nodes, edges, topologyName, yamlOutput, showMgmt, mgmtNetwork, ipv4Subnet]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  /* This is the function to handle the removal of elements from the topology. It is used to remove a node or an edge from the topology. */
  const onElementsRemove = useCallback(
    (elementsToRemove) => {
      const nodeChanges = elementsToRemove.filter((el) => el.id.startsWith('node_')).map((node) => ({ id: node.id, type: 'remove' }));
      const edgeChanges = elementsToRemove.filter((el) => el.id.startsWith('edge_')).map((edge) => ({ id: edge.id, type: 'remove' }));
      const updatedNodes = applyNodeChanges(nodeChanges, nodes);
      const updatedEdges = applyEdgeChanges(edgeChanges, edges);
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      updateYaml(updatedNodes, updatedEdges);
    },
    [nodes, edges]
  );

  /* This is the function to handle clicking on node buttons in the sidebar. It creates a node at the center of the canvas. */
  const onNodeClick = useCallback(
    (nodeType) => {
      // Check if management settings are valid when required
      if (showMgmt && !validateMgmtSettings()) {
        return;
      }

      if (!topologyName.trim()) {
        const newName = generateRandomName();
        setTopologyName(newName);
        // Update the YAML with the new name
        const updatedYaml = yamlOutput.replace(/name:.*/, `name: ${newName}`);
        setYamlOutput(updatedYaml);
      }

      // Create node at center of canvas (approximate center position)
      const position = {
        x: 400, // Default center-ish position
        y: 200,
      };

      const newNode = {
        id: getId(),
        position,
        data: { label: `${nodeType} node`, nodeType: nodeType }
      };

      setNewNode(newNode);
      setIsModalOpen(true);
      setModalType("create"); // Set to create mode
      
      // Set default values based on node type
      if (nodeType === 'router') {
        setNodeNamePrefix('ceos');
        setNodeKind('ceos');
        setNodeImage('ceos:4.34.1F');
      } else if (nodeType === 'bridge') {
        setNodeNamePrefix('bridge');
        setNodeKind('linux');
        setNodeImage('alpine');
      } else if (nodeType === 'linux-host') {
        setNodeNamePrefix('linux');
        setNodeKind('linux');
        setNodeImage('alpine');
      } else if (nodeType === 'container') {
        setNodeNamePrefix('container');
        setNodeKind('linux');
        setNodeImage('alpine');
      }
      
      setNodeCount(1);
      setNodeBinds([""]);
      setNodeMgmtIp("");
      setNodeModalWarning(false);
      setNodeCustomFields([{ key: '', value: '' }]);
    },
    [yamlOutput, showMgmt, validateMgmtSettings, topologyName]
  );

  /* This is the function to update the YAML output of the topology. It is used to update the YAML output of the topology when a node or an edge is added or removed. */
  const updateYaml = (updatedNodes, updatedEdges) => {
    // If there are no nodes and no explicit topology settings, return empty YAML
    if (
      updatedNodes.length === 0 && 
      !showMgmt && 
      !showKind && 
      !showDefault && 
      topologyName === ""
    ) {
      setYamlOutput("");
      setEditableYaml("");
      return;
    }

    // Try to parse existing YAML to preserve any existing configuration
    let existingConfig = {};
    try {
      existingConfig = yaml.load(yamlOutput) || {};
    } catch (error) {
      console.warn('Could not parse existing YAML:', error);
    }

    
    const yamlObject = {
      name: topologyName.includes(user?.username) ? topologyName : `${user?.username || ''}-${topologyName}`,
      topology: {
        nodes: {},
      },
    };

   
    updatedNodes.forEach((node) => {
      const nodeKey = node.id || node.data.label;
      const existingNode = existingConfig?.topology?.nodes?.[nodeKey] || {};
      yamlObject.topology.nodes[nodeKey] = {
        ...existingNode, 
        kind: node.data.kind || existingNode.kind,
        image: node.data.image || existingNode.image,
      };

      if (node.data.binds?.length > 0) {
        const validBinds = node.data.binds
          .filter(bind => bind.source && bind.target)
          .map(bind => `${bind.source}:${bind.target}`);
        if (validBinds.length > 0) {
          yamlObject.topology.nodes[nodeKey].binds = validBinds;
        }
      } else if (existingNode.binds) {
        yamlObject.topology.nodes[nodeKey].binds = existingNode.binds;
      }

      if (node.data.mgmtIp) {
        yamlObject.topology.nodes[nodeKey]['mgmt-ipv4'] = node.data.mgmtIp;
      }
      
      if (node.data.ipv6MgmtIp) {
        yamlObject.topology.nodes[nodeKey]['mgmt-ipv6'] = node.data.ipv6MgmtIp;
      }

      if (node.data.startupConfig && node.data.startupConfig.trim() !== '') {
        yamlObject.topology.nodes[nodeKey]['startup-config'] = node.data.startupConfig;
      }

      // Add custom fields under an 'env' key
      if (node.data.customFields && node.data.customFields.some(field => field.key && field.value)) {
        yamlObject.topology.nodes[nodeKey].env = {};
        node.data.customFields.forEach(({ key, value }) => {
          if (key && value) {
            yamlObject.topology.nodes[nodeKey].env[key] = value;
          }
        });
      }
    });

    
    if (updatedEdges.length > 0) {
      yamlObject.topology.links = updatedEdges.map((edge) => {
        return {
          endpoints: [
            `${edge.source}:${edge.data?.sourceInterface || 'eth1'}`,
            `${edge.target}:${edge.data?.targetInterface || 'eth1'}`
          ]
        };
      });
    }

    
    if (showMgmt) {
      yamlObject.mgmt = {
        network: mgmtNetwork,
        ipv4_subnet: ipv4Subnet
      };

      if (showIpv6 && ipv6Subnet) {
        yamlObject.mgmt.ipv6_subnet = ipv6Subnet;
      }
    }

    
    if (showDefault && defaultKind) {
      yamlObject.topology.defaults = {
        kind: defaultKind
      };
    }

    
    if (showKind && kinds.length > 0) {
      const validKinds = kinds.filter(kind => kind.name.trim() !== '');
      
      if (validKinds.length > 0) {
        yamlObject.topology.kinds = {};

        validKinds.forEach((kind) => {
          yamlObject.topology.kinds[kind.name] = {};

          if (kind.config.showStartupConfig && kind.config.startupConfig.trim() !== '') {
            yamlObject.topology.kinds[kind.name]['startup-config'] = kind.config.startupConfig;
          }

          if (kind.config.showImage && kind.config.image.trim() !== '') {
            yamlObject.topology.kinds[kind.name].image = kind.config.image;
          }

          if (kind.config.showExec && kind.config.exec.length > 0 && kind.config.exec[0].trim() !== '') {
            yamlObject.topology.kinds[kind.name].exec = kind.config.exec.filter(exec => exec.trim() !== '');
          }

          if (kind.config.showBinds && kind.config.binds.length > 0 && kind.config.binds[0].trim() !== '') {
            yamlObject.topology.kinds[kind.name].binds = kind.config.binds.filter(bind => bind.trim() !== '');
          }
        });
      }
    }

    const yamlString = yaml.dump(yamlObject, { 
      lineWidth: -1,  // Don't wrap long lines
      quotingType: '"',  // Use double quotes for strings
      forceQuotes: true  // Force quotes around all strings
    });
    setYamlOutput(yamlString);
    setEditableYaml(yamlString);
    
    // Update context with new YAML
    updateTopologyState({
      yamlOutput: yamlString,
      editableYaml: yamlString
    });
  };
  
  /* This is the function to handle the change in the topology name. It is used to update the YAML output of the topology when the topology name is changed. */
  const handleTopologyNameChange = (event) => {
    const newTopologyName = event.target.value;
    setTopologyName(newTopologyName);
    
    const yamlData = {
      name: `${user?.username || ''}-${newTopologyName}`,
      topology: {
        nodes: nodes.reduce((acc, node) => {
          const nodeConfig = {};
          if (node.data.kind?.trim()) nodeConfig.kind = node.data.kind;
          if (node.data.image?.trim()) nodeConfig.image = node.data.image;
          if (node.data.binds?.some(bind => bind.trim())) {
            nodeConfig.binds = node.data.binds.filter(bind => bind.trim());
          }
          if (node.data.mgmtIp?.trim()) nodeConfig['mgmt-ipv4'] = node.data.mgmtIp;
          if (node.data.startupConfig?.trim()) nodeConfig['startup-config'] = node.data.startupConfig;
          
          acc[node.data.label] = nodeConfig;
          return acc;
        }, {}),
        links: edges.map((edge) => ({
          endpoints: [
            `${nodes.find(n => n.id === edge.source).data.label}:${edge.data.sourceInterface}`,
            `${nodes.find(n => n.id === edge.target).data.label}:${edge.data.targetInterface}`
          ]
        }))
      }
    };

    if (showMgmt) {
      yamlData.mgmt = {
        network: mgmtNetwork,
        "ipv4-subnet": ipv4Subnet,
        ...(showIpv6 && ipv6Subnet && { "ipv6-subnet": ipv6Subnet })
      };
    }

    if (showKind && kinds.length > 0) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.kinds = kinds.reduce((acc, kind) => {
        if (kind.name) {
          acc[kind.name] = {
            ...(kind.config.showStartupConfig && { 'startup-config': kind.config.startupConfig }),
            ...(kind.config.showImage && { image: kind.config.image }),
            ...(kind.config.showExec && { exec: kind.config.exec.filter(e => e) }),
            ...(kind.config.showBinds && { binds: kind.config.binds.filter(b => b) })
          };
        }
        return acc;
      }, {});
    }

    if (showDefault && defaultKind.trim()) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.defaults = { kind: defaultKind };
    }

    const generatedYaml = yaml.dump(yamlData, {
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: true
    });
    setYamlOutput(generatedYaml);
    setEditableYaml(generatedYaml);
    
    // Update context with new YAML
    updateTopologyState({
      yamlOutput: generatedYaml,
      editableYaml: generatedYaml
    });
  };

  /* This is the function to handle the change in the management settings in Global optional settings. It is used to update the YAML output of the topology when the management settings are changed. */
  const handleMgmtCheckbox = (e) => {
    if (!topologyName.trim()) {
      const newName = generateRandomName();
      setTopologyName(newName);
      // Update the YAML with the new name
      const updatedYaml = yamlOutput.replace(/name:.*/, `name: ${newName}`);
      setYamlOutput(updatedYaml);
    }
    
    const isChecked = e.target.checked;
    setShowMgmt(isChecked);
    
    if (!isChecked) {
      // When unchecking, clear management IPs and settings
      setMgmtNetwork('');
      setIpv4Subnet('');
      setIpv6Subnet('');
      setShowIpv6(false);
      
      // Clear management IPs from all nodes
      setNodes(currentNodes => 
        currentNodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            mgmtIp: ''
          }
        }))
      );
    } else if (isChecked && ipv4Subnet.trim()) {
      // If enabling and we already have a subnet, auto-assign IPs
      autoAssignMgmtIPs(ipv4Subnet);
    }
    
    updateYaml(nodes, edges);
  };

  /* This is the function to handle the change in the IPv4 subnet. It is used to update the YAML output of the topology when the IPv4 settings is changed. */
  const handleIpv4SubnetChange = (event) => {
    const newValue = event.target.value;
    setIpv4Subnet(newValue);
    
    // Clear warning if this is now valid
    if (showMgmt && newValue.trim() && mgmtNetwork.trim()) {
      setMgmtWarning(false);
      
      // If subnet is valid and we have nodes, auto-assign IPs
      autoAssignMgmtIPs(newValue);
    }
  };
  
  // Function to automatically assign management IPs to nodes
  const autoAssignMgmtIPs = (subnet) => {
    if (!nodes.length) return;
    
    // Generate IPs for all nodes
    const ips = generateIpsFromSubnet(subnet, nodes.length);
    if (!ips.length) return;
    
    // Update each node with a management IP
    const updatedNodes = nodes.map((node, index) => {
      if (index < ips.length) {
        return {
          ...node,
          data: {
            ...node.data,
            mgmtIp: ips[index]
          }
        };
      }
      return node;
    });
    
    // Update nodes state and update YAML after state is updated
    setNodes(updatedNodes);
    
    // Use setTimeout to ensure state update has completed
    setTimeout(() => {
      updateYaml(updatedNodes, edges);
    }, 10);
  };

  /* This is the function to handle the change in the IPv6 subnet. It is used to update the YAML output of the topology when the IPv6 settings is changed. */
  const handleIpv6SubnetChange = (event) => {
    const newValue = event.target.value;
    setIpv6Subnet(newValue);
  };

  /* This is the function to handle the change in the kind. It is used to update the YAML output of the topology when the kind is changed. */
  const handleConfigureKind = () => {
    setShowKindModal(true);
  };

  /* This is the function to handle the change in the default kind. It is used to update the YAML output of the topology when the default kind is changed. */
  const handleDefaultKindChange = (event) => {
    const newValue = event.target.value;
    setDefaultKind(newValue);
  };

  /* This is the function to handle the change in the kind name. It is used to update the YAML output of the topology when the kind name is changed. */
  const handleKindNameChange = (index, value) => {
    const newKinds = [...kinds];
    newKinds[index].name = value;
    setKinds(newKinds);
    updateYaml(nodes, edges);
  };

  /* This is the function to handle the change in the kind configuration. It is used to update the YAML output of the topology when the kind configuration is changed. */
  const handleKindConfigChange = (kindIndex, field, value) => {
    const newKinds = [...kinds];
    newKinds[kindIndex].config[field] = value;
    setKinds(newKinds);
    updateYaml(nodes, edges);
  };

  /* This is the function to handle the addition of a new kind again this is in global settings. It is used to add a new kind to the topology. */
  const handleAddKind = () => {
    const newKind = {
      name: kindName,
      config: {
        showStartupConfig: false,
        startupConfig: '',
        showImage: false,
        image: '',
        showExec: false,
        exec: [''],
        showBinds: false,
        binds: ['']
      }
    };
    setKinds([...kinds, newKind]);
    setKindName('');
    updateYaml(nodes, edges);
  };

  /* This is the function to handle the addition of a new exec in the configure kind modal. It is used to add a new exec to the kind. */
  const handleAddExec = () => {
    setKinds(prevKinds => {
      const newKinds = [...prevKinds];
      newKinds[currentKindIndex].config.exec.push("");
      return newKinds;
    });
  };

  /* This is the function to handle the addition of a new bind in the configure kind modal. It is used to add a new bind to the kind. */
  const handleAddBind = () => {
    setNodeBinds([...nodeBinds, ""]);
  };

  /* This is the function to handle the change in the node name. It is used to update the YAML output of the topology when the node name is changed. */
  const handleNodeNameChange = (event) => {
    setNodeName(event.target.value);
  };

  /* This is the function to handle the change in the node binds. It is used to update the YAML output of the topology when the node binds are changed. */
  const handleNodeBindsChange = (index, field, value) => {
    const newBinds = [...nodeBinds];
    newBinds[index] = {
      ...newBinds[index],
      [field]: value
    };
    setNodeBinds(newBinds);
  };

  /* This is the function to handle the addition of a new bind node. It is used to add a new bind node to the topology. */
  const handleAddBindNode = () => {
    setNodeBinds([...nodeBinds, { source: '', target: '' }]);
  };

  /* This is the function to handle the change in the node management IP. It is used to update the YAML output of the topology when the node management IP is changed. */
  const handleNodeMgmtIpChange = (event) => {
    setNodeMgmtIp(event.target.value);
  };

  /* This is the function to handle the change in the node kind. It is used to update the YAML output of the topology when the node kind is changed. */
  const handleNodeKindChange = (event) => {
    const selectedKind = event.target.value;
    setNodeKind(selectedKind);
    
    // Auto-select default image based on kind
    if (selectedKind === 'ceos') {
      setNodeImage('ceos:4.34.1F');
    } else if (selectedKind === 'sonic-vm') {
      setNodeImage('sonic-vm:202411');
    } else if (selectedKind === 'linux') {
      setNodeImage('alpine');
    } else {
      setNodeImage('');
    }
  };

  /* This is the function to handle the change in the node image. It is used to update the YAML output of the topology when the node image is changed. */
  const handleNodeImageChange = (event) => {
    setNodeImage(event.target.value);
  };

  /* This is the function to handle the change in the node startup config. It is used to update the YAML output of the topology when the node startup config is changed. */
  const handleNodeStartupConfigChange = (event) => {
    setNodeStartupConfig(event.target.value);
  };

  /* This is the function to handle the browse of the startup config. It is used to browse the startup config file for the node. */
  const handleBrowseStartupConfig = () => {
    setShowFileManagerForStartupConfig(true);
  };

  /* This is the function to handle the selection of the startup config file. It is used to select the startup config file for the node. */
  const handleFileManagerStartupConfigSelect = (content, selectedPath) => {
    // We just need the file path, not the content
    if (selectedPath && selectedPath.path) {
      console.log('Selected startup config path:', selectedPath.path);
      setNodeStartupConfig(selectedPath.path);
    }
    setShowFileManagerForStartupConfig(false);
  };

  /* This is the function to initialize the node interfaces. It is used to initialize the node interfaces when a new node is created. */
  const initializeNodeInterfaces = (nodeId) => {
    setNodeInterfaces(prev => ({
      ...prev,
      [nodeId]: []
    }));
  };

  /* This is the function to handle the submission of the modal. It is used to submit the modal when a node is modified. */
  const handleModalSubmit = () => {
    if (modalType === "modify") {
      if (!nodeName.trim() || !nodeKind.trim()) {
        setNodeModalWarning(true);
        return;
      }
      const oldNodeId = newNode.id;
      const wasNameChanged = nodeName !== newNode.data.label;
      const updatedNodeId = wasNameChanged ? nodeName : oldNodeId;
      const updatedNode = {
        ...newNode,
        id: updatedNodeId,
        type: 'svgNode',
        data: {
          ...newNode.data,
          label: nodeName,
          kind: nodeKind,
          image: nodeImage,
          binds: nodeBinds,
          mgmtIp: nodeMgmtIp,
          ipv6MgmtIp: nodeIpv6MgmtIp,
          startupConfig: nodeStartupConfig,
          customFields: nodeCustomFields,
          ...(Object.fromEntries(nodeCustomFields.filter(f => f.key && f.value).map(f => [f.key, f.value])))
        },
      };
      const updatedNodes = nodes.map((node) => node.id === oldNodeId ? updatedNode : node);
      let updatedEdges = edges;
      if (wasNameChanged) {
        updatedEdges = edges.map((edge) => {
          if (edge.source === oldNodeId) {
            return { ...edge, source: updatedNodeId };
          }
          if (edge.target === oldNodeId) {
            return { ...edge, target: updatedNodeId };
          }
          return edge;
        });
      }
      updateYaml(updatedNodes, updatedEdges);
      setNodes(updatedNodes);
      if (wasNameChanged) {
        setEdges(updatedEdges);
        if (nodeInterfaces[oldNodeId]) {
          setNodeInterfaces(prev => {
            const updatedInterfaces = { ...prev };
            updatedInterfaces[updatedNodeId] = updatedInterfaces[oldNodeId];
            delete updatedInterfaces[oldNodeId];
            return updatedInterfaces;
          });
        }
      }
      setShowModifyNodeModal(false);
      setIsModifying(false);
      setNodeModalWarning(false);
      setIsModalOpen(false);
      return;
    }
    if (!nodeNamePrefix.trim() || !nodeKind.trim()) {
      setNodeModalWarning(true);
      return;
    }

    // Find the highest node number for this prefix to ensure no duplicates
    let highestNodeNum = 0;
    const nodeRegex = new RegExp(`^${nodeNamePrefix}(\\d+)$`);
    
    nodes.forEach(node => {
      const match = node.data.label.match(nodeRegex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > highestNodeNum) {
          highestNodeNum = num;
        }
      }
    });

    let newNodesAdded = [];

    if (nodeCount === 1) {
      // Single node creation
      const finalNodeName = nodeName.trim() || `${nodeNamePrefix}${highestNodeNum + 1}`;
      
      const newNodeWithData = {
        ...newNode,
        id: finalNodeName, // Use the node name as ID for better YAML mapping
        type: 'svgNode',
        data: {
          ...newNode.data,
          label: finalNodeName,
          kind: nodeKind,
          image: nodeImage,
          binds: nodeBinds,
          mgmtIp: nodeMgmtIp,
          ipv6MgmtIp: nodeIpv6MgmtIp,
          startupConfig: nodeStartupConfig,
          customFields: nodeCustomFields,
          ...(Object.fromEntries(nodeCustomFields.filter(f => f.key && f.value).map(f => [f.key, f.value])))
        },
      };

      if (isModifying) {
        setNodes((nds) => 
          nds.map((node) => 
            node.id === newNode.id ? newNodeWithData : node
          )
        );
        setIsModifying(false);
      } else {
        setNodes((nds) => [...nds, newNodeWithData]);
        initializeNodeInterfaces(newNodeWithData.id);
        newNodesAdded = [newNodeWithData];
      }
    } else {
      // Multiple nodes creation
      const startingNum = highestNodeNum + 1;
      const newNodesWithData = [];
      const basePosition = newNode.position;
      
      // Create multiple nodes with sequential names and positions in a grid layout
      for (let i = 0; i < nodeCount; i++) {
        const nodeNum = startingNum + i;
        const row = Math.floor(i / 4); // 4 nodes per row
        const col = i % 4;
        
        const finalNodeName = `${nodeNamePrefix}${nodeNum}`;
        const nodeMgmtIpWithSuffix = nodeMgmtIp && nodeMgmtIp.trim() 
          ? `${nodeMgmtIp.endsWith('.') ? nodeMgmtIp : `${nodeMgmtIp}.`}${nodeNum}` 
          : '';
        
        // Generate IPv6 address with suffix if provided
        let ipv6WithSuffix = '';
        if (nodeIpv6MgmtIp && nodeIpv6MgmtIp.trim()) {
          // Check if IPv6 address ends with :: or has a specific format to append the node number
          if (nodeIpv6MgmtIp.endsWith('::')) {
            ipv6WithSuffix = `${nodeIpv6MgmtIp}${nodeNum}`;
          } else if (nodeIpv6MgmtIp.includes('::')) {
            ipv6WithSuffix = nodeIpv6MgmtIp.replace('::', `::${nodeNum}:`);
          } else {
            // Just append the node number if no specific format
            ipv6WithSuffix = `${nodeIpv6MgmtIp}${nodeNum}`;
          }
        }
        
        const newNodeWithData = {
          ...newNode,
          id: finalNodeName, // Use the node name as ID for better YAML mapping
          position: {
            x: basePosition.x + col * 180, // Spread nodes horizontally
            y: basePosition.y + row * 150  // Spread nodes vertically
          },
          type: 'svgNode',
          data: {
            ...newNode.data,
            label: finalNodeName,
            kind: nodeKind,
            image: nodeImage,
            binds: nodeBinds,
            mgmtIp: nodeMgmtIpWithSuffix,
            ipv6MgmtIp: ipv6WithSuffix,
            startupConfig: nodeStartupConfig,
            customFields: nodeCustomFields,
            ...(Object.fromEntries(nodeCustomFields.filter(f => f.key && f.value).map(f => [f.key, f.value])))
          },
        };
        
        newNodesWithData.push(newNodeWithData);
        initializeNodeInterfaces(newNodeWithData.id);
      }

      setNodes((nds) => [...nds, ...newNodesWithData]);
      newNodesAdded = newNodesWithData;
    }

    // Critical fix: Create a single array with both existing and new nodes
    const allNodes = [...nodes, ...newNodesAdded];
    updateYaml(allNodes, edges);

    // Reset all states
    setIsModalOpen(false);
    setNodeName("");
    setNodeNamePrefix("");
    setNodeKind("ceos");
    setNodeImage("ceos:4.34.0F");
    setNodeBinds([""]);
    setNodeMgmtIp("");
    setNodeIpv6MgmtIp("");
    setNodeModalWarning(false);
    setNodeCount(1);
    setNodeStartupConfig("");
    setShowOptionalSettings(false); // Collapse optional settings by default next time
  };

  /* This is the function to handle the cancellation of the modal. It is used to cancel the modal when a node is modified. */
  const handleModalCancel = () => {
    setIsModalOpen(false);
    setNodeName("");
    setNodeNamePrefix("");
    setNodeBinds([""]);
    setNodeMgmtIp("");
    setNodeIpv6MgmtIp("");
    setNodeCount(1);
    setNodeStartupConfig("");
    setShowOptionalSettings(false); // Collapse optional settings by default next time
  };

  /* This is the function to handle the download of the YAML file. It is used to download the YAML file of the topology. */
  const handleDownloadYaml = () => {
    const blob = new Blob([yamlOutput], { type: "text/yaml;charset=utf-8" });
    const fileName = topologyName.includes(user?.username) 
      ? `${topologyName}.yml` 
      : `${user?.username || ''}-${topologyName}.yml`;
    saveAs(blob, fileName);
  };

  /* This is the function to handle the deployment of the topology. It is used to deploy the topology to the containerlab server you selected. */
  const handleDeploy = async () => {
    try {
      if (!topologyName.trim()) {
        const newName = generateRandomName();
        setTopologyName(newName);
        // Update the YAML with the new name
        const updatedYaml = yamlOutput.replace(/name:.*/, `name: ${newName}`);
        setYamlOutput(updatedYaml);
      }
      
      setIsDeployModalOpen(true);
      // Fetch server resource information when opening the deploy modal
      fetchServerResources();
    } catch (error) {
      console.error('Error deploying topology:', error);
      alert(`Error deploying topology: ${error.message}`);
      setShowLogModal(false);
    }
  };

  // New function to fetch server resource information
  /* This is the function to fetch the server resource information. It is used to fetch the server resource information like CPU and memory when the deploy modal is opened. */
  const fetchServerResources = async () => {
    try {
      setIsLoadingServerResources(true);
      
      // Fetch resource data for each server
      const resources = {};
      const labExists = {};
      
      // Get the formatted topology name
      const formattedTopologyName = topologyName.trim() ? 
        (topologyName.includes(user?.username) ? topologyName : `${user?.username || ''}-${topologyName}`) : 
        '';
      
      for (const server of serverOptions) {
        // This is the API call to fetch the server resource information
        const response = await fetch(`http://${server.value}:3001/api/system/metrics`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            resources[server.value] = {
              cpu: data.metrics.cpu,
              memory: data.metrics.memory,
              availableMemory: data.metrics.availableMemory
            };
          } else {
            resources[server.value] = {
              cpu: 0,
              memory: 0,
              availableMemory: null
            };
          }
        } else {
          resources[server.value] = {
            cpu: 0,
            memory: 0,
            availableMemory: null
          };
        }
        
        // For deployment from topology designer, we'll assume lab doesn't exist initially
        // The Express API will handle the actual deployment regardless
        labExists[server.value] = false;
      }
      
      setServerResources(resources);
      setLabExistsOnServer(labExists);
    } catch (error) {
      console.error('Error fetching server resources:', error);
    } finally {
      setIsLoadingServerResources(false);
    }
  };

  /* This is the function to set up the auto-refresh of the server resources when the deploy modal is open. */
  useEffect(() => {
    if (isDeployModalOpen) {
      // Fetch resources immediately when the modal opens
      fetchServerResources();
      
      // Set up interval to refresh every 5 seconds while modal is open
      const intervalId = setInterval(() => {
        fetchServerResources();
      }, 20000);
      
      // Clean up the interval when the modal closes
      return () => clearInterval(intervalId);
    }
  }, [isDeployModalOpen]);

  /* This is the function to handle reconfiguration of the topology on the containerlab server */
  const handleServerReconfigure = async (serverIp) => {
    try {
      // Verify that we have a topology name
      if (!topologyName.trim()) {
        setErrorMessage('Please provide a topology name before reconfiguring.');
        setShowErrorModal(true);
        return;
      }
      

      setOperationTitle('Reconfiguring Topology');
      setShowLogModal(true);
      setOperationLogs('Starting reconfiguration...\n');
      
      // Get the topology name with proper formatting
      const formattedTopologyName = topologyName.includes(user?.username) 
        ? topologyName 
        : `${user?.username || ''}-${topologyName}`;
      
      setOperationLogs(prev => prev + `\nReconfiguring lab: ${formattedTopologyName}\n`);
      setOperationLogs(prev => prev + `\nNote: Reconfiguration will only work if this topology has been previously deployed to this server.\n`);
      
      // Parse the YAML to a JSON object for the API
      const topologyContentJson = yaml.load(yamlOutput);
      
      setOperationLogs(prev => prev + '\nPreparing to reconfigure topology...\n');
      
      // Start a progress indicator to show reconfiguration is ongoing
      setOperationLogs(prev => prev + '\nReconfiguration in progress. This might take a few minutes...\n');
      
      // Set up a progress indicator that updates every 5 seconds
      const progressInterval = setInterval(() => {
        setOperationLogs(prev => prev + '• Still working on reconfiguration, please wait...\n');
      }, 5000);
      
      try {
        // Step 3: Send the topology to the Express API server for reconfiguration
        const deployResponse = await fetch(`http://${serverIp}:3001/api/containerlab/reconfigure`, {
          method: 'POST',
          body: (() => {
            const formData = new FormData();
            const yamlBlob = new Blob([yamlOutput], { type: 'text/yaml' });
            const fileName = `${topologyContentJson.name || 'topology'}.yaml`;
            formData.append('file', yamlBlob, fileName);
            formData.append('serverIp', serverIp);
            formData.append('username', user?.username || 'user');
            return formData;
          })()
        });
        
        // Clear the progress indicator once we get a response
        clearInterval(progressInterval);
        
        if (!deployResponse.ok) {
          const errorText = await deployResponse.text();
          throw new Error(`Reconfiguration failed: ${deployResponse.status} - ${errorText}`);
        }
        
        // Process the streaming response from Express server
        const reader = deployResponse.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          setOperationLogs(prev => prev + chunk);
        }
        
        setDeploymentSuccess(true);
        return;
      } catch (error) {
        // Make sure to clear the interval if there's an error
        clearInterval(progressInterval);
        throw error;
      }
    } catch (error) {
      console.error('Error reconfiguring topology:', error);
      setOperationLogs(prev => prev + `\nError: ${error.message}`);
    }
  };

  /* This is the function to handle the deployment of the topology to the containerlab server you selected. */
  const handleServerDeploy = async (serverIp) => {
    try {
      setDeployLoading(prev => ({ ...prev, [serverIp]: true }));
      setOperationTitle('Deploying Topology');
      setShowLogModal(true);
      setOperationLogs('Starting deployment...\n');

      // Parse the YAML once at the beginning
      let parsedYaml = yaml.load(yamlOutput);
      let yamlNeedsUpdate = false;

      // If auto-assign is enabled, create the sn directory and files. This is very important when you want to onboard devices to CVP.
      if (autoAssignMacSn[serverIp]) {
        setOperationLogs(prev => prev + '\nCreating sn directory and files for MAC & S/N...\n');
        
        const topologyName = parsedYaml.name;
        const nodes = Object.keys(parsedYaml.topology.nodes);
        
        // Create the sn directory
        const snDirPath = `/home/clab_nfs_share/containerlab_topologies/${user.username}/${topologyName}/sn`;
        try {
          const createDirResponse = await fetch(`http://${serverIp}:3001/api/files/createDirectory`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              serverIp,
              path: `/home/clab_nfs_share/containerlab_topologies/${user.username}/${topologyName}`,
              directoryName: 'sn',
              username: user.username
            })
          });
          
          if (!createDirResponse.ok) {
            throw new Error('Failed to create sn directory');
          }
          
          setOperationLogs(prev => prev + 'Created sn directory\n');
          
          // Create individual files for each node
          for (const nodeName of nodes) {
            // Generate serial number - remove dots from username and all special characters from both username and node name as this is not supported in Serial Number
            const username = user.username.split('.')[0];
            const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '');
            const cleanNodeName = nodeName.replace(/[^a-zA-Z0-9]/g, '');
            const serialNumber = `${cleanUsername.toUpperCase()}${cleanNodeName.toUpperCase()}`;
            
            // Generate MAC address using topology name characters and random numbers
            const topoChars = topologyName.replace(/[^a-f0-9]/gi, '').substring(0, 4);
            const randomHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
            const middleOctet = (topoChars || (randomHex() + randomHex())).padEnd(4, '0');
            const macAddress = `001c.${middleOctet}.${randomHex()}${randomHex()}`;
            
            const fileContent = `SERIALNUMBER=${serialNumber}\nSYSTEMMACADDR=${macAddress}`;

            // This is the API call to create the file on the containerlab server
            const createFileResponse = await fetch(`http://${serverIp}:3001/api/files/createFile`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                serverIp,
                path: snDirPath,
                fileName: `${nodeName}.txt`,
                content: fileContent,
                username: user.username
              })
            });
            
            if (!createFileResponse.ok) {
              throw new Error(`Failed to create file for node ${nodeName}`);
            }
            
            setOperationLogs(prev => prev + `Created file for ${nodeName}\n`);
            
            // Update the node's binds in the YAML. 
            if (!parsedYaml.topology.nodes[nodeName].binds) {
              parsedYaml.topology.nodes[nodeName].binds = [];
            }
            // This is the bind mount for the node. This is used to parse the startup config file from the containerlab server to the node.
            parsedYaml.topology.nodes[nodeName].binds = [
              `/home/clab_nfs_share/containerlab_topologies/${user.username}/${topologyName}/sn/${nodeName}.txt:/mnt/flash/ceos-config:ro`,
              ...parsedYaml.topology.nodes[nodeName].binds.filter(bind => !bind.includes('/mnt/flash/ceos-config:ro'))
            ];
            yamlNeedsUpdate = true;
          }
          
          if (yamlNeedsUpdate) {
            // Update the YAML output with the new binds
            const updatedYaml = yaml.dump(parsedYaml, {
              lineWidth: -1,
              quotingType: '"',
              forceQuotes: true
            });
            setYamlOutput(updatedYaml);
            setEditableYaml(updatedYaml);
            
            setOperationLogs(prev => prev + 'Updated YAML with bind mounts\n');
          }
        } catch (error) {
          throw new Error(`Failed to set up MAC & S/N: ${error.message}`);
        }
      }

      // Use the final YAML with all updates
      const finalYaml = yamlNeedsUpdate ? yaml.dump(parsedYaml, {
        lineWidth: -1,
        quotingType: '"',
        forceQuotes: true
      }) : yamlOutput;

      // Parse the YAML to a JSON object for the API
      const topologyContentJson = yaml.load(finalYaml);
      
      setOperationLogs(prev => prev + '\nPreparing to deploy topology...\n');
      
      // Start a progress indicator to show deployment is ongoing
      setOperationLogs(prev => prev + '\nDeployment in progress. This might take a few minutes...\n');
      
      // Set up a progress indicator that updates every 5 seconds
      const progressInterval = setInterval(() => {
        setOperationLogs(prev => prev + '• Still working on deployment, please wait...\n');
      }, 5000);
      
      try {
        // Step 3: Send the topology to the Express API server
        const deployResponse = await fetch(`http://${serverIp}:3001/api/containerlab/deploy`, {
          method: 'POST',
          body: (() => {
            const formData = new FormData();
            const yamlBlob = new Blob([finalYaml], { type: 'text/yaml' });
            const fileName = `${topologyContentJson.name || 'topology'}.yaml`;
            formData.append('file', yamlBlob, fileName);
            formData.append('serverIp', serverIp);
            formData.append('username', user?.username || 'user');
            return formData;
          })()
        });
        
        // Clear the progress indicator once we get a response
        clearInterval(progressInterval);
        
        if (!deployResponse.ok) {
          const errorText = await deployResponse.text();
          throw new Error(`Deployment failed: ${deployResponse.status} - ${errorText}`);
        }
        
        // Process the streaming response from Express server
        const reader = deployResponse.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          setOperationLogs(prev => prev + chunk);
        }
        
        setDeploymentSuccess(true);
        return;
      } catch (error) {
        // Make sure to clear the interval if there's an error
        clearInterval(progressInterval);
        throw error;
              }
    } catch (error) {
      console.error('Error deploying topology:', error);
      setOperationLogs(prev => prev + `\nError: ${error.message}`);
    } finally {
      setDeployLoading(prev => ({ ...prev, [serverIp]: false }));
    }
  };

  const onNodeContextMenu = (event, node) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: node,
      type: 'node',
    });
  };

  const onEdgeContextMenu = (event, edge) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: edge,
      type: 'edge',
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  /* This is the function to handle the removal of a node from the topology. When you right click on a node and select remove, this function is called. */
  const handleRemoveNode = () => {
    const nodeToRemove = contextMenu.element;
    const updatedNodes = nodes.filter((n) => n.id !== nodeToRemove.id);
    const updatedEdges = edges.filter((e) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    updateYaml(updatedNodes, updatedEdges);
    handleContextMenuClose();
  };

  /* This is the function to handle the removal of an edge from the topology. When you right click on an edge and select remove, this function is called. */
  const handleRemoveEdge = () => {
    const edgeToRemove = contextMenu.element;
    setNodeInterfaces(prev => ({
      ...prev,
      [edgeToRemove.source]: prev[edgeToRemove.source].filter(i => i !== edgeToRemove.data.sourceInterface),
      [edgeToRemove.target]: prev[edgeToRemove.target].filter(i => i !== edgeToRemove.data.targetInterface)
    }));
    const updatedEdges = edges.filter((e) => e.id !== edgeToRemove.id);
    setEdges(updatedEdges);
    updateYaml(nodes, updatedEdges);
    handleContextMenuClose();
  };

  /* This is the function to handle the reset of the topology. When you click on the reset button, this function is called. */
  const handleReset = () => {
    setTopologyName("");
    setShowMgmt(false);
    setMgmtNetwork("");
    setIpv4Subnet("");
    setShowIpv6(false);
    setIpv6Subnet("");
    setShowKind(false);
    setKinds([{
      name: '',
      config: {
        showStartupConfig: false,
        startupConfig: '',
        showImage: false,
        image: '',
        showExec: false,
        exec: [''],
        showBinds: false,
        binds: ['']
      }
    }]);
    setShowDefault(false);
    setDefaultKind("");
    
    setNodes([]);
    setEdges([]);
    
    setYamlOutput("");
    setEditableYaml("");
    setIsYamlValid(true);
    setYamlParseError("");
    
    // Reset the context state as well
    updateTopologyState({
      nodes: [],
      edges: [],
      yamlOutput: '',
      editableYaml: '',
      topologyName: '',
      showMgmt: false,
      mgmtNetwork: '',
      ipv4Subnet: '',
      showIpv6: false,
      ipv6Subnet: '',
      showKind: false,
      kinds: [{
        name: '',
        config: {
          showStartupConfig: false,
          startupConfig: '',
          showImage: false,
          image: '',
          showExec: false,
          exec: [''],
          showBinds: false,
          binds: ['']
        }
      }],
      showDefault: false,
      defaultKind: '',
      nodeInterfaces: {},
      isYamlValid: true,
      yamlParseError: '',
      // Reset annotation states
      annotations: [],
      activeTool: 'select',
      selectedAnnotation: null,
      annotationColor: '#FF6B6B',
      textStyle: {
        fontSize: 16,
        bold: false,
        italic: false,
        underline: false
      },
      shapeStyle: {
        strokeWidth: 2,
        fillOpacity: 0.3
      }
    });
  };

  /* This is the function to validate the interface name. It is used to validate the interface name when a new edge is created. It has to be of the format eth1, eth2, eth3, etc. */
  const validateInterface = (interfaceName) => {
    const interfaceRegex = /^eth[1-9][0-9]?$|^eth[1-4][0-9]$|^eth5[0-4]$/;
    return interfaceRegex.test(interfaceName);
  };

  /* This is the function to handle the submission of the edge modal. When you click on the submit button in the edge modal, this function is called. */
  const handleEdgeModalSubmit = () => {
    if (!sourceInterface.trim() || !targetInterface.trim()) {
      setEdgeModalWarning(true);
      return;
    }

    if (!validateInterface(sourceInterface) || !validateInterface(targetInterface)) {
      setErrorMessage('Interface names must be in the format "eth" followed by a number (1-54)');
      setShowErrorModal(true);
      return;
    }
  
    const edgeId = isModifyingEdge 
      ? newEdgeData.id 
      : `edge_${newEdgeData.source}_${newEdgeData.target}_${sourceInterface}_${targetInterface}`;
  
    const newEdge = {
      ...newEdgeData,
      id: edgeId,
      type: 'custom',
      data: {
        sourceInterface,
        targetInterface
      }
    };
  
    if (isModifyingEdge) {
      // Remove old interfaces before adding new ones
      const oldEdge = edges.find(e => e.id === newEdge.id);
      if (oldEdge) {
        setNodeInterfaces(prev => ({
          ...prev,
          [oldEdge.source]: prev[oldEdge.source].filter(i => i !== oldEdge.data.sourceInterface),
          [oldEdge.target]: prev[oldEdge.target].filter(i => i !== oldEdge.data.targetInterface)
        }));
      }
    }

    // Add new interfaces
    setNodeInterfaces(prev => ({
      ...prev,
      [newEdge.source]: [...(prev[newEdge.source] || []), sourceInterface],
      [newEdge.target]: [...(prev[newEdge.target] || []), targetInterface]
    }));
  
    if (isModifyingEdge) {
      setEdges((eds) => {
        const updatedEdges = eds.map((edge) => 
          edge.id === newEdge.id ? newEdge : edge
        );
        updateYaml(nodes, updatedEdges);
        return updatedEdges;
      });
      setIsModifyingEdge(false);
    } else {
      setEdges((eds) => {
        const duplicateEdge = eds.find(edge => 
          edge.source === newEdge.source && 
          edge.target === newEdge.target &&
          edge.data.sourceInterface === sourceInterface &&
          edge.data.targetInterface === targetInterface
        );
        
        if (duplicateEdge) {
          console.log("Duplicate edge not added:", newEdge);
          return eds;
        }
        const updatedEdges = [...eds, newEdge];
        updateYaml(nodes, updatedEdges);
        return updatedEdges;
      });
    }
  
    setIsEdgeModalOpen(false);
    setSourceInterface("");
    setTargetInterface("");
    setNewEdgeData(null);
    setEdgeModalWarning(false);
  };

  const handleCheckboxChange = (setter, checked) => {
    if (!validateTopologyName()) {
      return;
    }
    setter(checked);
    updateYaml(nodes, edges);
  };

  const handleKindCheckbox = (e) => {
    // If management is checked, validate settings first
    if (showMgmt && !validateMgmtSettings()) {
      return;
    }

    if (!topologyName.trim()) {
      const newName = generateRandomName();
      setTopologyName(newName);
      // Update the YAML with the new name
      const updatedYaml = yamlOutput.replace(/name:.*/, `name: ${newName}`);
      setYamlOutput(updatedYaml);
    }
    setShowKind(e.target.checked);
    if (!e.target.checked) {
      setKinds([{
        name: '',
        config: {
          showStartupConfig: false,
          startupConfig: '',
          showImage: false,
          image: '',
          showExec: false,
          exec: [''],
          showBinds: false,
          binds: ['']
        }
      }]);
    }
    updateYaml(nodes, edges);
  };

  const handleDefaultCheckbox = (e) => {
    // If management is checked, validate settings first
    if (showMgmt && !validateMgmtSettings()) {
      return;
    }

    if (!topologyName.trim()) {
      const newName = generateRandomName();
      setTopologyName(newName);
      // Update the YAML with the new name
      const updatedYaml = yamlOutput.replace(/name:.*/, `name: ${newName}`);
      setYamlOutput(updatedYaml);
    }
    setShowDefault(e.target.checked);
    if (!e.target.checked) {
      setDefaultKind('');
    }
    updateYaml(nodes, edges);
  };

  const handleIpv6Checkbox = (e) => {
    setShowIpv6(e.target.checked);
    updateYaml(nodes, edges);
  };

  const handleModifyNode = () => {
    const nodeToModify = contextMenu.element;
    const nodeLabel = nodeToModify.data.label;
    const isRouter = nodeLabel.toLowerCase().includes('router');
    
    // Preserve the existing node's name and properties
    setNodeNamePrefix(nodeLabel.split('_')[0]); // Get the base name without any numbering
    setNodeKind(nodeToModify.data.kind || (isRouter ? 'ceos' : 'linux'));
    setNodeImage(nodeToModify.data.image || (isRouter ? 'ceos:4.34.0F' : 'alpine'));
    setNodeCount(1);
    setNodeBinds(nodeToModify.data.binds || [""]);
    setNodeMgmtIp(nodeToModify.data.mgmtIp || "");
    setNodeIpv6MgmtIp(nodeToModify.data.ipv6MgmtIp || "");
    setNewNode(nodeToModify);
    setIsModifying(true);
    setIsModalOpen(true);
    setModalType("modify"); // Set to modify mode
    setContextMenu(null);
  };

  /* This is the function to handle the modification of an edge. When you right click on an edge and select modify, this function is called. */
  const handleModifyEdge = () => {
    const edgeToModify = contextMenu.element;
    setSourceInterface(edgeToModify.data.sourceInterface || "");
    setTargetInterface(edgeToModify.data.targetInterface || "");
    setNewEdgeData({
      ...edgeToModify,
      sourceNodeName: nodes.find(n => n.id === edgeToModify.source).data.label,
      targetNodeName: nodes.find(n => n.id === edgeToModify.target).data.label
    });
    setIsEdgeModalOpen(true);
    setIsModifyingEdge(true);
    setContextMenu(null);
  };

  /* This is the function to handle the addition of a new kind bind. When you click on the add button in the kind modal, this function is called. */
  const handleAddKindBind = () => {
    const newKinds = [...kinds];
    newKinds[currentKindIndex].config.binds.push('');
    setKinds(newKinds);
  };

  const handleKindModalDone = () => {
    setShowKindModal(false);
    updateYaml(nodes, edges);
  };

  /* This is the function to initialize the node interfaces from the YAML. It is used to initialize the node interfaces when a new node is created. */
  const initializeNodeInterfacesFromYaml = (yamlContent, currentNodes) => {
    try {
      const parsedYaml = yaml.load(yamlContent);
      if (!parsedYaml?.topology?.links) return;

      const newInterfaces = {};
      parsedYaml.topology.links.forEach(link => {
        const [sourceNode, sourceInterface] = link.endpoints[0].split(':');
        const [targetNode, targetInterface] = link.endpoints[1].split(':');

        // Find the node IDs from the node names using the provided currentNodes
        const sourceNodeId = currentNodes.find(n => n.data.label === sourceNode)?.id;
        const targetNodeId = currentNodes.find(n => n.data.label === targetNode)?.id;

        if (sourceNodeId) {
          newInterfaces[sourceNodeId] = [...(newInterfaces[sourceNodeId] || []), sourceInterface];
        }
        if (targetNodeId) {
          newInterfaces[targetNodeId] = [...(newInterfaces[targetNodeId] || []), targetInterface];
        }
      });

      setNodeInterfaces(newInterfaces);
    } catch (error) {
      console.error('Error initializing interfaces from YAML:', error);
    }
  };

  /* This is the function to handle the change in the YAML. When you edit the YAML, this function is called. */
  const handleYamlChange = (newYaml) => {
    setEditableYaml(newYaml);
    // Also update yamlOutput to ensure saves use the edited content
    setYamlOutput(newYaml);
  
    try {
      const parsedYaml = yaml.load(newYaml);
      
      // Extract the topology name from the edited YAML
      if (parsedYaml?.name) {
        // Update the topology name state with the name from the YAML
        setTopologyName(parsedYaml.name);
      }
  
      if (parsedYaml?.topology?.nodes) {
        const newNodes = Object.entries(parsedYaml.topology.nodes).map(([nodeName, nodeData], index) => {
          // Extract custom fields from the env object
          let customFields = [];
          
          if (nodeData.env && typeof nodeData.env === 'object') {
            // Extract from env object
            customFields = Object.entries(nodeData.env).map(([key, value]) => ({ 
              key, 
              value: String(value) 
            }));
          } else {
            // For backward compatibility, extract from root level
            customFields = Object.entries(nodeData)
              .filter(([k]) => !['kind', 'image', 'binds', 'mgmt-ipv4', 'startup-config', 'env'].includes(k))
              .map(([key, value]) => ({ key, value: String(value) }));
          }
          
          // Ensure we have at least one empty field for the UI
          if (customFields.length === 0) {
            customFields = [{ key: '', value: '' }];
          }
          
          return {
            id: nodeName,
            type: 'svgNode',
            position: { x: 100 + (index % 3) * 200, y: 100 + Math.floor(index / 3) * 150 }, // Grid layout
            data: {
              label: nodeName,
              kind: nodeData.kind || '',
              image: nodeData.image || '',
              binds: nodeData.binds || [],
              mgmtIp: nodeData['mgmt-ipv4'] || '',
              ipv6MgmtIp: nodeData['mgmt-ipv6'] || '',
              startupConfig: nodeData['startup-config'] || '',
              customFields,
            }
          };
        });
  
        const newEdges = (parsedYaml.topology.links || []).map((link, index) => {
          const [source, sourceInterface] = link.endpoints[0].split(':');
          const [target, targetInterface] = link.endpoints[1].split(':');
  
          return {
            id: `edge_${index}`,
            source,
            target,
            type: 'custom',
            data: {
              sourceInterface,
              targetInterface
            }
          };
        });
  
        setNodes(newNodes);
        setEdges(newEdges);
        
        // Initialize interfaces from the YAML, passing the newNodes directly
        initializeNodeInterfacesFromYaml(newYaml, newNodes);
        setIsYamlValid(true);
        setYamlParseError('');
        
        // If only one node is being edited, set nodeCustomFields for the modal
        if (newNodes.length === 1) {
          setNodeCustomFields(newNodes[0].data.customFields.length > 0 ? newNodes[0].data.customFields : [{ key: '', value: '' }]);
        }
        
        // Check for management settings in the YAML
        if (parsedYaml.mgmt) {
          setShowMgmt(true);
          setMgmtNetwork(parsedYaml.mgmt.network || parsedYaml.mgmt['network'] || '');
          setIpv4Subnet(parsedYaml.mgmt.ipv4_subnet || parsedYaml.mgmt['ipv4-subnet'] || '');
          
          if (parsedYaml.mgmt.ipv6_subnet || parsedYaml.mgmt['ipv6-subnet']) {
            setShowIpv6(true);
            setIpv6Subnet(parsedYaml.mgmt.ipv6_subnet || parsedYaml.mgmt['ipv6-subnet'] || '');
          }
        }
        
        // Check for kinds section in the YAML
        if (parsedYaml.topology.kinds) {
          setShowKind(true);
          
          const newKinds = Object.entries(parsedYaml.topology.kinds).map(([kindName, kindConfig]) => ({
            name: kindName,
            config: {
              showStartupConfig: !!kindConfig['startup-config'],
              startupConfig: kindConfig['startup-config'] || '',
              showImage: !!kindConfig.image,
              image: kindConfig.image || '',
              showExec: !!(kindConfig.exec && kindConfig.exec.length),
              exec: kindConfig.exec || [''],
              showBinds: !!(kindConfig.binds && kindConfig.binds.length),
              binds: kindConfig.binds || ['']
            }
          }));
          
          if (newKinds.length > 0) {
            setKinds(newKinds);
          }
        }
        
        // Check for defaults in the YAML
        if (parsedYaml.topology.defaults) {
          setShowDefault(true);
          setDefaultKind(parsedYaml.topology.defaults.kind || '');
        }
        
        // Update context with new data including all settings
        updateTopologyState({
          nodes: newNodes,
          edges: newEdges,
          yamlOutput: newYaml,
          editableYaml: newYaml,
          topologyName: parsedYaml.name || '',
          showMgmt: !!parsedYaml.mgmt,
          mgmtNetwork: parsedYaml.mgmt?.network || parsedYaml.mgmt?.['network'] || '',
          ipv4Subnet: parsedYaml.mgmt?.ipv4_subnet || parsedYaml.mgmt?.['ipv4-subnet'] || '',
          showIpv6: !!(parsedYaml.mgmt?.ipv6_subnet || parsedYaml.mgmt?.['ipv6-subnet']),
          ipv6Subnet: parsedYaml.mgmt?.ipv6_subnet || parsedYaml.mgmt?.['ipv6-subnet'] || '',
          showKind: !!parsedYaml.topology?.kinds,
          kinds: parsedYaml.topology?.kinds ? Object.entries(parsedYaml.topology.kinds).map(([kindName, kindConfig]) => ({
            name: kindName,
            config: {
              showStartupConfig: !!kindConfig['startup-config'],
              startupConfig: kindConfig['startup-config'] || '',
              showImage: !!kindConfig.image,
              image: kindConfig.image || '',
              showExec: !!(kindConfig.exec && kindConfig.exec.length),
              exec: kindConfig.exec || [''],
              showBinds: !!(kindConfig.binds && kindConfig.binds.length),
              binds: kindConfig.binds || ['']
            }
          })) : [{
            name: '',
            config: {
              showStartupConfig: false,
              startupConfig: '',
              showImage: false,
              image: '',
              showExec: false,
              exec: [''],
              showBinds: false,
              binds: ['']
            }
          }],
          showDefault: !!parsedYaml.topology?.defaults,
          defaultKind: parsedYaml.topology?.defaults?.kind || '',
          isYamlValid: true,
          yamlParseError: '',
          nodeInterfaces: { ...nodeInterfaces }
        });
      } else {
        throw new Error('Invalid YAML structure');
      }
    } catch (error) {
      console.error('Failed to parse YAML:', error);
      setIsYamlValid(false);
      setYamlParseError(`Error parsing YAML: ${error.message}`);
      
      // Update context with error state
      updateTopologyState({
        yamlOutput: newYaml,
        editableYaml: newYaml,
        isYamlValid: false,
        yamlParseError: `Error parsing YAML: ${error.message}`
      });
    }
  };

  /* This is the function to handle the imported content. When you import a YAML file, this function is called. */
  const handleImportedContent = (content) => {
    console.log(content);
    setEditableYaml(content);
    setYamlOutput(content);
    
    try {
      // Parse the imported YAML content
      const parsedYaml = yaml.load(content);
      
      // Extract the topology name from the imported file
      let importedName = parsedYaml?.name || '';
      
      // If the topology name doesn't already include the username, prepend it
      if (importedName && !importedName.includes(user?.username)) {
        const updatedName = `${user?.username || ''}-${importedName}`;
        
        // Update the name in the parsed YAML
        parsedYaml.name = updatedName;
        
        // Update the topology name in the state
        setTopologyName(updatedName);
        
        // Generate new YAML with the updated name
        const updatedContent = yaml.dump(parsedYaml, {
          lineWidth: -1,
          quotingType: '"',
          forceQuotes: true
        });
        setEditableYaml(updatedContent);
        setYamlOutput(updatedContent);
        
        // Update context with the imported content
        updateTopologyState({
          yamlOutput: updatedContent,
          editableYaml: updatedContent,
          topologyName: updatedName
        });
        
        // Continue with the updated content
        // This will call handleYamlChange which now takes care of initializing interfaces
        handleYamlChange(updatedContent);
      } else {
        // If name already has username or there's no name, just use the original content
        setTopologyName(importedName);
        
        // Update context with the imported content
        updateTopologyState({
          yamlOutput: content,
          editableYaml: content,
          topologyName: importedName
        });
        
        handleYamlChange(content);
      }
    } catch (error) {
      console.error('Error processing imported YAML:', error);
      // Fall back to original behavior if there's an error
      handleYamlChange(content);
    }
    
    // initializeNodeInterfacesFromYaml is now called inside handleYamlChange
  };

  /* This is the function to handle the SSH port forwarding checkbox. When you click on the SSH port forwarding checkbox, this function is called. */
  const handleSshPortForwardingCheckbox = (e) => {
    // If management is checked, validate settings first
    if (showMgmt && !validateMgmtSettings()) {
      return;
    }

    if (!topologyName.trim()) {
      const newName = generateRandomName();
      setTopologyName(newName);
      // Update the YAML with the new name
      const updatedYaml = yamlOutput.replace(/name:.*/, `name: ${newName}`);
      setYamlOutput(updatedYaml);
    }

    const hasNodes = nodes.length > 0;

    if (!hasNodes && e.target.checked) {
      setErrorMessage('There are no nodes in the topology. Please create nodes first.');
      setShowErrorModal(true);
      return;
    }

    setShowSshPortForwarding(e.target.checked);
    updateYaml(nodes, edges);
  };

  const handleSshServerChange = (e) => {
    setSelectedSshServer(e.target.value);
  };

  /* This is the function to handle the submission of the SSH port forwarding. When you click on the submit button after selecting the server in the SSH port forwarding modal, this function is called. */
  const handleSshPortForwardingSubmit = async () => {
    try {
      setIsLoadingPorts(true);
      const response = await fetch(`http://${selectedSshServer}:3001/api/ports/free?serverIp=${selectedSshServer}`);
      const data = await response.json();
      
      if (data.success && data.freePorts.length > 0) {
        setFreePorts(data.freePorts);
        
        const updatedYaml = yaml.load(yamlOutput);
        let portIndex = 0;
        
        Object.keys(updatedYaml.topology.nodes).forEach(nodeName => {
          if (portIndex < data.freePorts.length) {
            const node = updatedYaml.topology.nodes[nodeName];
            node.ports = [`${data.freePorts[portIndex]}:22/tcp`];
            portIndex++;
          }
        });
        
        const newYamlOutput = yaml.dump(updatedYaml, {
          lineWidth: -1,
          quotingType: '"',
          forceQuotes: true
        });
        setYamlOutput(newYamlOutput);
        setEditableYaml(newYamlOutput);
        
        setOperationTitle('SSH Port Forwarding');
        setOperationLogs('Successfully added SSH port forwarding to all nodes');
        setShowLogModal(true);
      } else {
        throw new Error('No free ports available');
      }
    } catch (error) {
      setErrorMessage(`Failed to get free ports: ${error.message}`);
      setShowErrorModal(true);
    } finally {
      setIsLoadingPorts(false);
    }
  };
  
  /* This is the function to handle the save of the topology. When you click on the save button, this function is called. This will open the save modal. */
  const handleSave = () => {
    setModalMode('save');
    setShowImportModal(true);
  };

  /* This is the function to handle the import of the topology. When you click on the import button, this function is called. This will open the import modal. */
  const handleImport = () => {
    setModalMode('import');
    setShowImportModal(true);
  };

  /* This is the function to handle the file manager action. When you click on the file manager button, this function is called. It opens the file manager modal. */
  const handleFileManagerAction = async (content, selectedPath) => {
    if (modalMode === 'import') {
      handleImportedContent(content);
    } else if (modalMode === 'save') {
      try {
        //alert("Saving topology...");
        const fileName = topologyName.includes(user?.username) 
          ? `${topologyName}.yaml` 
          : `${user?.username || ''}-${topologyName}.yaml`;
          
        console.log("Saving YAML content:", yamlOutput);
        
        const yamlBlob = new Blob([yamlOutput], { type: 'text/yaml;charset=utf-8' });
        const yamlFile = new File([yamlBlob], fileName, { type: 'text/yaml' });

        const formData = new FormData();
        formData.append('file', yamlFile);
        formData.append('serverIp', selectedPath.serverIp);
        formData.append('username', user.username);
        formData.append('path', selectedPath.path);

        const response = await fetch(`http://${selectedPath.serverIp}:3001/api/files/save`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save file');
        }

        setOperationTitle('Save Topology');
        setOperationLogs('Topology file saved successfully');
        setShowLogModal(true);
      } catch (error) {
        setErrorMessage(`Failed to save file: ${error.message}`);
        setShowErrorModal(true);
      }
    }
    setShowImportModal(false);
    setModalMode('import');
  };

  const handleNavigateToServers = () => {
    parentSetMode('servers');
    setShowLogModal(false);
  };

  const onNodeDragStop = useCallback((event, node) => {
    // Only update node position, don't show modal
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          return {
            ...n,
            position: node.position,
          };
        }
        return n;
      })
    );
  }, []);

  const handleNodeModeSelect = (mode) => {
    setNodeCreationMode(mode);
  };

  /* This is the function to handle the change in the node name prefix. When you change the node name prefix, this function is called. */
  const handleNodeNamePrefixChange = (event) => {
    const prefix = event.target.value;
    setNodeNamePrefix(prefix);
    
    // Find the highest node number for this prefix
    let highestNodeNum = 0;
    const nodeRegex = new RegExp(`^${prefix}(\\d+)$`);
    
    nodes.forEach(node => {
      const match = node.data.label.match(nodeRegex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > highestNodeNum) {
          highestNodeNum = num;
        }
      }
    });
    
    // Update node name based on prefix and existing nodes
    setNodeName(`${prefix}${nodeCount > 1 ? (highestNodeNum + 1) : (highestNodeNum ? highestNodeNum + 1 : '')}`);
  };

  const handleNodeCountChange = (event) => {
    const count = parseInt(event.target.value, 10) || 1;
    const newCount = Math.max(1, Math.min(count, 100)); // Limit to 1-100 nodes
    setNodeCount(newCount);
    
    // Update node name if prefix exists
    if (nodeNamePrefix) {
      setNodeName(`${nodeNamePrefix}${newCount > 1 ? 1 : ''}`);
    }
  };

  /* This is the function to get the next node number. It is used to get the next node number when a new node is created automatically. */
  const getNextNodeNumber = () => {
    let highestNodeNum = 0;
    const nodeRegex = new RegExp(`^${nodeNamePrefix}(\\d+)$`);
    
    nodes.forEach(node => {
      const match = node.data.label.match(nodeRegex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > highestNodeNum) {
          highestNodeNum = num;
        }
      }
    });
    
    return highestNodeNum + 1;
  };

  /* This is the function to handle the change in the management network. When you change the management network, this function is called. */
  const handleMgmtNetworkChange = (event) => {
    const newValue = event.target.value;
    setMgmtNetwork(newValue);
    
    // Clear warning if this is now valid
    if (showMgmt && newValue.trim() && ipv4Subnet.trim()) {
      setMgmtWarning(false);
    }
  };

  /* This is the function to handle the submission of the modify node modal. When you click on the submit button in the modify node modal, this function is called. */
  const handleModifyNodeSubmit = () => {
    if (!nodeKind.trim()) {
      setNodeModalWarning(true);
      return;
    }

    const oldNodeId = newNode.id;
    const wasNameChanged = nodeName !== newNode.data.label;
    
    // If name changed, create a new node ID
    const updatedNodeId = wasNameChanged ? nodeName : oldNodeId;
    
    const updatedNode = {
      ...newNode,
      id: updatedNodeId, // Use the new name as ID
      type: 'svgNode',
      data: {
        ...newNode.data,
        label: nodeName,
        kind: nodeKind,
        image: nodeImage,
        binds: nodeBinds,
        mgmtIp: nodeMgmtIp,
        ipv6MgmtIp: nodeIpv6MgmtIp,
        startupConfig: nodeStartupConfig,
        customFields: nodeCustomFields,// Add custom fields
        ...(Object.fromEntries(nodeCustomFields.filter(f => f.key && f.value).map(f => [f.key, f.value])))
      },
    };

    // Create updated nodes array immediately
    const updatedNodes = nodes.map((node) => 
      node.id === oldNodeId ? updatedNode : node
    );

    // If name changed, update edges immediately
    let updatedEdges = edges;
    if (wasNameChanged) {
      updatedEdges = edges.map((edge) => {
        if (edge.source === oldNodeId) {
          return { ...edge, source: updatedNodeId };
        }
        if (edge.target === oldNodeId) {
          return { ...edge, target: updatedNodeId };
        }
        return edge;
      });
    }

    // Update YAML immediately with the new values
    updateYaml(updatedNodes, updatedEdges);

    // Then update the state
    setNodes(updatedNodes);
    if (wasNameChanged) {
      setEdges(updatedEdges);
      
      // Update node interfaces if name changed
      if (nodeInterfaces[oldNodeId]) {
        setNodeInterfaces(prev => {
          const updatedInterfaces = { ...prev };
          updatedInterfaces[updatedNodeId] = updatedInterfaces[oldNodeId];
          delete updatedInterfaces[oldNodeId];
          return updatedInterfaces;
        });
      }
    }

    // Reset state and close modal
    setShowModifyNodeModal(false);
    setIsModifying(false);
    setNodeModalWarning(false);
  };

  /* This is the function to handle the cancellation of the modify node modal. When you click on the cancel button in the modify node modal, this function is called. */
  const handleModifyNodeCancel = () => {
    setShowModifyNodeModal(false);
    setIsModifying(false);
    setNodeModalWarning(false);
  };

  /* This is the function to generate a random name. It is used to generate a random name for the topology if we did not provide a name. */
  const generateRandomName = () => {
    const character = randomNames.cartoonCharacters[Math.floor(Math.random() * randomNames.cartoonCharacters.length)];
    const place = randomNames.irishPlaces[Math.floor(Math.random() * randomNames.irishPlaces.length)];
    return `${user?.username || ''}-${character}-${place}`.toLowerCase();
  };

  const handleBrowseKindStartupConfig = () => {
    setShowFileManagerForKindStartupConfig(true);
  };

  const handleFileManagerKindStartupConfigSelect = (content, selectedPath) => {
    // We just need the file path, not the content
    if (selectedPath && selectedPath.path) {
      console.log('Selected Kind startup config path:', selectedPath.path);
      const newKinds = [...kinds];
      newKinds[currentKindIndex].config.startupConfig = selectedPath.path;
      setKinds(newKinds);
    }
    setShowFileManagerForKindStartupConfig(false);
  };

  const handleFileManagerBindSelect = (content, selectedFile) => {
    if (selectedFile && activeBindIndex !== null) {
      const newBinds = [...nodeBinds];
      newBinds[activeBindIndex] = {
        ...newBinds[activeBindIndex],
        source: selectedFile.path
      };
      setNodeBinds(newBinds);
    }
    setShowFileManagerForBind(false);
  };

  const handleRemoveBindNode = (index) => {
    const newBinds = [...nodeBinds];
    newBinds.splice(index, 1);
    setNodeBinds(newBinds);
  };

  // Add this function to handle checkbox changes
  const handleAutoAssignChange = (serverIp, isChecked) => {
    setAutoAssignMacSn(prev => ({
      ...prev,
      [serverIp]: isChecked
    }));
  };

  // 2. Add handlers for custom fields
  const handleCustomFieldChange = (index, field, value) => {
    const newFields = [...nodeCustomFields];
    newFields[index][field] = value;
    setNodeCustomFields(newFields);
  };
  const handleAddCustomField = () => {
    setNodeCustomFields([...nodeCustomFields, { key: '', value: '' }]);
  };
  const handleRemoveCustomField = (index) => {
    const newFields = [...nodeCustomFields];
    newFields.splice(index, 1);
    setNodeCustomFields(newFields);
  };

  /* This is the function to check if a connection is valid. It is used to validate connections between nodes. */
  const isValidConnection = () => true;

  /* Annotation Functions */
  const generateAnnotationId = () => `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAnnotationSelect = useCallback((annotation, event) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedAnnotation(annotation);
    setActiveTool('select');
  }, []);

  const handleAnnotationMouseMove = useCallback((event) => {
    if (!isDraggingAnnotation || !selectedAnnotation) return;
    
    event.preventDefault();
    
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const newX = mouseX - dragOffset.x;
    const newY = mouseY - dragOffset.y;
    
    setAnnotations(prev => prev.map(ann => {
      if (ann.id === selectedAnnotation.id) {
        if (ann.type === 'text' || ann.type === 'circle') {
          return { ...ann, x: newX, y: newY };
        } else if (ann.type === 'rectangle') {
          const width = Math.abs(ann.endX - ann.startX);
          const height = Math.abs(ann.endY - ann.startY);
          return { 
            ...ann, 
            startX: newX, 
            startY: newY,
            endX: newX + width,
            endY: newY + height
          };
        } else if (ann.type === 'line' || ann.type === 'arrow') {
          const deltaX = ann.endX - ann.startX;
          const deltaY = ann.endY - ann.startY;
          return { 
            ...ann, 
            startX: newX, 
            startY: newY,
            endX: newX + deltaX,
            endY: newY + deltaY
          };
        }
      }
      return ann;
    }));
  }, [isDraggingAnnotation, selectedAnnotation, dragOffset]);

  const handleAnnotationMouseUp = useCallback(() => {
    setIsDraggingAnnotation(false);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const handleAnnotationMouseDown = useCallback((annotation, event) => {
    event.stopPropagation();
    event.preventDefault();
    
    if (activeTool !== 'select') return;
    
    const rect = event.currentTarget.closest('.reactflow-wrapper').getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate drag offset
    let offsetX = 0, offsetY = 0;
    if (annotation.type === 'text' || annotation.type === 'circle') {
      offsetX = mouseX - annotation.x;
      offsetY = mouseY - annotation.y;
    } else if (annotation.type === 'rectangle') {
      const x = Math.min(annotation.startX, annotation.endX);
      const y = Math.min(annotation.startY, annotation.endY);
      offsetX = mouseX - x;
      offsetY = mouseY - y;
    } else if (annotation.type === 'line' || annotation.type === 'arrow') {
      offsetX = mouseX - annotation.startX;
      offsetY = mouseY - annotation.startY;
    }
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDraggingAnnotation(true);
    setSelectedAnnotation(annotation);
  }, [activeTool]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedAnnotation) {
      setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotation.id));
      setSelectedAnnotation(null);
    }
  }, [selectedAnnotation]);

  const handleCanvasClick = useCallback((event) => {
    // Prevent if clicking on ReactFlow elements
    if (event.target.closest('.react-flow__node') || event.target.closest('.react-flow__edge')) {
      return;
    }
    
    if (activeTool === 'select') return;

    event.stopPropagation();
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const newAnnotation = {
          id: generateAnnotationId(),
          type: 'text',
          x,
          y,
          text,
          color: annotationColor,
          style: textStyle
        };
        setAnnotations(prev => [...prev, newAnnotation]);
      }
    } else if (activeTool === 'circle') {
      const newAnnotation = {
        id: generateAnnotationId(),
        type: 'circle',
        x,
        y,
        radius: 30,
        color: annotationColor,
        style: shapeStyle
      };
      setAnnotations(prev => [...prev, newAnnotation]);
    } else if (activeTool === 'rectangle') {
      const newAnnotation = {
        id: generateAnnotationId(),
        type: 'rectangle',
        startX: x - 40,
        startY: y - 25,
        endX: x + 40,
        endY: y + 25,
        color: annotationColor,
        style: shapeStyle
      };
      setAnnotations(prev => [...prev, newAnnotation]);
    }
  }, [activeTool, annotationColor, textStyle, shapeStyle]);

  const handleCanvasMouseDown = useCallback((event) => {
    // Prevent if clicking on ReactFlow elements
    if (event.target.closest('.react-flow__node') || event.target.closest('.react-flow__edge')) {
      return;
    }

    // Check if clicking on an annotation for selection/moving
    if (event.target.closest('.annotation-element')) {
      return; // Let annotation handle its own events
    }

    // No drawing tools need mouse down now since rectangle is click-to-create
    return;
  }, [activeTool]);

  const handleCanvasMouseMove = useCallback((event) => {
    // Handle annotation resizing
    if (isResizing && selectedAnnotation && resizeHandle === 'radius') {
      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      const newRadius = Math.sqrt(
        Math.pow(mouseX - selectedAnnotation.x, 2) + 
        Math.pow(mouseY - selectedAnnotation.y, 2)
      );
      
      setAnnotations(prev => prev.map(ann => 
        ann.id === selectedAnnotation.id 
          ? { ...ann, radius: Math.max(10, newRadius) } // Minimum radius of 10
          : ann
      ));
    } else if (isResizing && selectedAnnotation && resizeHandle === 'rectangle') {
      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Update rectangle size by changing the endX and endY coordinates
      setAnnotations(prev => prev.map(ann => {
        if (ann.id === selectedAnnotation.id) {
          // Ensure minimum size of 20x20
          const newEndX = Math.max(ann.startX + 20, mouseX);
          const newEndY = Math.max(ann.startY + 20, mouseY);
          return { 
            ...ann, 
            endX: newEndX,
            endY: newEndY
          };
        }
        return ann;
      }));
    }

    // Handle moving annotations
    handleAnnotationMouseMove(event);
  }, [isResizing, selectedAnnotation, resizeHandle, handleAnnotationMouseMove]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
    handleAnnotationMouseUp();
  }, [handleAnnotationMouseUp]);

  // YAML Editor Toggle Functions
  const handleToggleYamlEditor = () => {
    setIsYamlEditorCollapsed(!isYamlEditorCollapsed);
  };

  // Save YAML editor collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('yamlEditorCollapsed', JSON.stringify(isYamlEditorCollapsed));
  }, [isYamlEditorCollapsed]);

  // Sync state changes with context
  useEffect(() => {
    updateTopologyState({
      nodes,
      edges,
      yamlOutput,
      editableYaml,
      topologyName,
      showMgmt,
      mgmtNetwork,
      ipv4Subnet,
      showIpv6,
      ipv6Subnet,
      showKind,
      kinds,
      showDefault,
      defaultKind,
      nodeInterfaces,
      isYamlValid,
      yamlParseError
    });
  }, [
    nodes, 
    edges, 
    yamlOutput, 
    editableYaml, 
    topologyName, 
    showMgmt, 
    mgmtNetwork, 
    ipv4Subnet, 
    showIpv6, 
    ipv6Subnet, 
    showKind, 
    kinds, 
    showDefault, 
    defaultKind, 
    nodeInterfaces, 
    isYamlValid, 
    yamlParseError
  ]);

  // Keyboard event handlers for annotations
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedAnnotation && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
          event.preventDefault();
          handleDeleteSelected();
        }
      } else if (event.key === 'Escape') {
        setSelectedAnnotation(null);
        setActiveTool('select');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotation, handleDeleteSelected]);

  return (
    // This is the main container for the topology designer. It is the container that contains HTML elements for the topology designer.
    <ReactFlowProvider>
      <div className="app">
        <div className="dndflow">
          {mode === 'containerlab' ? (
            <>
              <div className="node-panel">
                <div className="input-group">
                  <label>Name of the topology:</label>
                  <input
                    type="text"
                    value={topologyName}
                    onChange={handleTopologyNameChange}
                  />
                </div>
                <Sidebar onNodeClick={onNodeClick} />

                <h3 
                  className="settings-heading" 
                  onClick={() => setShowGlobalSettings(!showGlobalSettings)}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    userSelect: 'none'
                  }}
                >
                  {showGlobalSettings ? '▼' : '▶'} Optional Settings
                  <span className="info-icon">ⓘ</span>
                </h3>

                {showGlobalSettings && (
                  <>
                    <div className="checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={showMgmt}
                          onChange={handleMgmtCheckbox}
                        />
                        Add Management
                      </label>
                    </div>

                    {showMgmt && (
                      <div className="management-section">
                        {mgmtWarning && (
                          <div className="warning-message">
                            Both Network Name and IPv4 Subnet are required
                          </div>
                        )}
                        <div className="input-group">
                          <label>Network Name:</label>
                          <input
                            type="text"
                            value={mgmtNetwork}
                            onChange={handleMgmtNetworkChange}
                            className={mgmtWarning && !mgmtNetwork.trim() ? 'input-error' : ''}
                            placeholder="Required field"
                          />
                        </div>
                        <div className="input-group">
                          <label>IPv4 Subnet:</label>
                          <input
                            type="text"
                            value={ipv4Subnet}
                            onChange={handleIpv4SubnetChange}
                            className={mgmtWarning && !ipv4Subnet.trim() ? 'input-error' : ''}
                            placeholder="Required field (e.g., 192.168.122.0/24)"
                          />
                        </div>
                        {ipv4Subnet && mgmtNetwork && nodes.length > 0 && (
                          <div className="input-group">
                            <button
                              className="reassign-button"
                              onClick={() => autoAssignMgmtIPs(ipv4Subnet)}
                            >
                              Re-assign Management IPs
                            </button>
                            <span className="helper-text">
                              Will assign IPs like {ipv4Subnet.split('/')[0].split('.').slice(0, 3).join('.')}.2 through {ipv4Subnet.split('/')[0].split('.').slice(0, 3).join('.')}.{Math.min(nodes.length + 1, 254)}
                            </span>
                          </div>
                        )}
                        <div className="checkbox-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={showIpv6}
                              onChange={(e) => setShowIpv6(e.target.checked)}
                            />
                            Add IPv6 Subnet
                          </label>
                        </div>
                        {showIpv6 && (
                          <div className="input-group">
                            <label>IPv6 Subnet:</label>
                            <input
                              type="text"
                              value={ipv6Subnet}
                              onChange={handleIpv6SubnetChange}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={showKind}
                          onChange={handleKindCheckbox}
                        />
                        Add Kinds
                      </label>
                    </div>
                    {showKind && (
                      <div className="kinds-section">
                        {kinds.map((kind, index) => (
                          <div key={index} className="kind-input-group">
                            <label htmlFor={`kind-name-${index}`}>Kind Name</label>
                            <select
                              id={`kind-name-${index}`}
                              value={kind.name}
                              onChange={(e) => handleKindNameChange(index, e.target.value)}
                            >
                              <option value="">Select a kind</option>
                              {kindOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button onClick={() => {
                              setShowKindModal(true);
                              setCurrentKindIndex(index);
                            }}>Configure</button>
                          </div>
                        ))}
                        <button onClick={handleAddKind}>Add More Kinds</button>
                      </div>
                    )}
                    <div className="checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={showDefault}
                          onChange={handleDefaultCheckbox}
                        />
                        Add Default
                      </label>
                    </div>
                    {showDefault && (
                      <div className="default-input-group">
                        <label htmlFor="default-kind">Default Kind:</label>
                        <select
                          id="default-kind"
                          value={defaultKind}
                          onChange={handleDefaultKindChange}
                          className="image-select"
                        >
                          <option value="">Select a kind</option>
                          {kindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={showSshPortForwarding}
                          onChange={handleSshPortForwardingCheckbox}
                        />
                        Add SSH Port Forwarding
                      </label>
                    </div>
                    {showSshPortForwarding && (
                      <div className="ssh-forwarding-section">
                        <div className="input-group">
                          <label>Select Server:</label>
                          <select
                            value={selectedSshServer}
                            onChange={handleSshServerChange}
                            className="image-select"
                          >
                            <option value="">Select a server</option>
                            {serverOptions.map((server) => (
                              <option key={server.value} value={server.value}>
                                {server.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button 
                          className="submit-button"
                          onClick={handleSshPortForwardingSubmit}
                          disabled={!selectedSshServer || isLoadingPorts}
                        >
                          {isLoadingPorts ? 'Loading Ports...' : 'Submit'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                <button className="reset-button" onClick={handleReset}>
                  🧹 Clear
                </button>
                
                <button className="file-manager-button" onClick={() => setShowFileManager(true)} style={{ marginTop: '15px' }}>
                  📁 File Manager
                </button>

                {/* YAML Action Buttons Group */}
                <div className="yaml-actions-group">
                  <button onClick={handleDownloadYaml} disabled={!yamlOutput.trim()} className="sidebar-action-button">
                    📤 Download YAML
                  </button>
                  <button className="sidebar-action-button deploy-button" onClick={handleDeploy} disabled={!yamlOutput.trim()}>
                    🚀 Deploy
                  </button>
                  <button onClick={handleImport} className="sidebar-action-button">
                    📥 Import
                  </button>
                  <button onClick={handleSave} disabled={!yamlOutput.trim()} className="sidebar-action-button">
                    💾 Save
                  </button>
                </div>
              </div>
              <div
                className="reactflow-wrapper"
                ref={reactFlowWrapper}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={handleCanvasClick}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                data-annotation-tool={activeTool}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onElementsRemove={onElementsRemove}
                  isValidConnection={isValidConnection}
                  fitView
                  onNodeContextMenu={onNodeContextMenu}
                  onEdgeContextMenu={onEdgeContextMenu}
                  connectionMode={ConnectionMode.LOOSE}
                  onNodeDragStop={onNodeDragStop}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={{ type: 'custom' }}
                />
                
                {/* Render annotations */}
                <svg className="annotation-layer" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1000 }}>
                  {annotations.map((annotation) => {
                    if (annotation.type === 'text') {
                      return (
                        <text
                          key={annotation.id}
                          x={annotation.x}
                          y={annotation.y}
                          fill={annotation.color}
                          fontSize={annotation.style.fontSize}
                          fontWeight={annotation.style.bold ? 'bold' : 'normal'}
                          fontStyle={annotation.style.italic ? 'italic' : 'normal'}
                          textDecoration={annotation.style.underline ? 'underline' : 'none'}
                          style={{ pointerEvents: 'all', cursor: activeTool === 'select' ? 'move' : 'pointer' }}
                          onClick={(e) => handleAnnotationSelect(annotation, e)}
                          onMouseDown={(e) => handleAnnotationMouseDown(annotation, e)}
                          className={`annotation-element ${selectedAnnotation?.id === annotation.id ? 'selected-annotation' : ''}`}
                        >
                          {annotation.text}
                        </text>
                      );
                    } else if (annotation.type === 'rectangle') {
                      const width = Math.abs(annotation.endX - annotation.startX);
                      const height = Math.abs(annotation.endY - annotation.startY);
                      const x = Math.min(annotation.startX, annotation.endX);
                      const y = Math.min(annotation.startY, annotation.endY);
                      return (
                        <g key={annotation.id}>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={annotation.color}
                            fillOpacity={annotation.style.fillOpacity}
                            stroke={annotation.color}
                            strokeWidth={annotation.style.strokeWidth}
                            style={{ pointerEvents: 'all', cursor: activeTool === 'select' ? 'move' : 'pointer' }}
                            onClick={(e) => handleAnnotationSelect(annotation, e)}
                            onMouseDown={(e) => handleAnnotationMouseDown(annotation, e)}
                            className={`annotation-element ${selectedAnnotation?.id === annotation.id ? 'selected-annotation' : ''}`}
                          />
                          {/* Resize handle for selected rectangle */}
                          {selectedAnnotation?.id === annotation.id && activeTool === 'select' && (
                            <circle
                              cx={x + width}
                              cy={y + height}
                              r={4}
                              fill="#072452"
                              stroke="white"
                              strokeWidth={2}
                              style={{ cursor: 'nw-resize', pointerEvents: 'all' }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsResizing(true);
                                setResizeHandle('rectangle');
                              }}
                            />
                          )}
                        </g>
                      );
                    } else if (annotation.type === 'circle') {
                      return (
                        <g key={annotation.id}>
                          <circle
                            cx={annotation.x}
                            cy={annotation.y}
                            r={annotation.radius}
                            fill={annotation.color}
                            fillOpacity={annotation.style.fillOpacity}
                            stroke={annotation.color}
                            strokeWidth={annotation.style.strokeWidth}
                            style={{ pointerEvents: 'all', cursor: activeTool === 'select' ? 'move' : 'pointer' }}
                            onClick={(e) => handleAnnotationSelect(annotation, e)}
                            onMouseDown={(e) => handleAnnotationMouseDown(annotation, e)}
                            className={`annotation-element ${selectedAnnotation?.id === annotation.id ? 'selected-annotation' : ''}`}
                          />
                          {/* Resize handle for selected circle */}
                          {selectedAnnotation?.id === annotation.id && activeTool === 'select' && (
                            <circle
                              cx={annotation.x + annotation.radius}
                              cy={annotation.y}
                              r={4}
                              fill="#072452"
                              stroke="white"
                              strokeWidth={2}
                              style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsResizing(true);
                                setResizeHandle('radius');
                              }}
                            />
                          )}
                        </g>
                      );
                    }
                    
                    return null;
                  })}
                </svg>

                {/* Annotation Toolbar */}
                <AnnotationToolbar
                  activeTool={activeTool}
                  setActiveTool={setActiveTool}
                  onDeleteSelected={handleDeleteSelected}
                  annotationColor={annotationColor}
                  setAnnotationColor={setAnnotationColor}
                  textStyle={textStyle}
                  setTextStyle={setTextStyle}
                  shapeStyle={shapeStyle}
                  setShapeStyle={setShapeStyle}
                />

                {/* Add React Flow controls */}
                <Controls />
              </div>
              
              {/* YAML Editor with Toggle Button */}
              <div className={`yaml-output-container ${isYamlEditorCollapsed ? 'collapsed' : 'expanded'}`}>
                <button 
                  className="yaml-toggle-button"
                  onClick={handleToggleYamlEditor}
                  title={isYamlEditorCollapsed ? 'Show YAML Editor' : 'Hide YAML Editor'}
                >
                  {isYamlEditorCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
                
                                  <div className="yaml-output">
                    <h3>YAML Editor</h3>
                    {/* Replaced textarea with Editor for syntax highlighting and line numbers */}
                    {/* You may need to add specific CSS classes/styles to .editor-container */}
                    {/* for features like line numbers background, etc. */}
                    {/* For basic line numbers, react-simple-code-editor often needs a container with specific padding/styling. */}
                    <div className="editor-container-with-lines" style={{ overflow: 'auto', height: '500px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}>
                      <div className="line-numbers" aria-hidden="true">
                        {editableYaml.split('\n').map((_, index) => (
                          <div key={index} className="line-number">
                            {index + 1}
                          </div>
                        ))}
                      </div>
                      <div className="editor-content">
                        <Editor
                          value={editableYaml}
                          onValueChange={newYaml => handleYamlChange(newYaml)}
                          highlight={code => highlight(code, languages.yaml, 'yaml')}
                          padding={10}
                          style={{
                            fontFamily: '"Fira code", "Fira Mono", Consolas, "DejaVu Sans Mono", Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                            fontSize: 12,
                            minHeight: '100%',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="yaml-output">
                <h3>YAML Output</h3>
                <pre>{yamlOutput}</pre>
              </div>
            </>
          )}
        </div>
        {isModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <h2>{['router', 'leaf', 'spine'].some(term => newNode?.data?.label?.toLowerCase().includes(term)) ? 'Router Details' : 'Server/Hosts Details'}</h2>
              <div 
                className="form-content" 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleModalSubmit();
                  }
                }}
              >
                {nodeModalWarning && (
                  <div className="warning-message">
                    Name prefix and Kind are required fields
                  </div>
                )}
                {modalType === "create" && (
                  <div className="input-group">
                    <label>Number of nodes:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={nodeCount}
                      onChange={handleNodeCountChange}
                      className="node-count-input"
                    />
                  </div>
                )}
                {modalType === "create" && (
                  <div className="input-group">
                    <label>Name {nodeCount > 1 ? 'prefix' : ''} for {nodeCount > 1 ? 'nodes' : 'node'}: *</label>
                    <input
                      type="text"
                      value={nodeNamePrefix}
                      placeholder={nodeCount > 1 ? "e.g., 'leaf' will create leaf1, leaf2, etc." : "e.g., spine1"}
                      onChange={handleNodeNamePrefixChange}
                      className={nodeModalWarning && !nodeNamePrefix.trim() ? 'input-error' : ''}
                    />
                    {nodeCount > 1 && nodeNamePrefix && (
                      <span className="helper-text">
                        Will create: {nodeNamePrefix}{getNextNodeNumber()} through {nodeNamePrefix}{getNextNodeNumber() + nodeCount - 1}
                      </span>
                    )}
                  </div>
                )}
                {modalType === "modify" && (
                  <div className="input-group">
                    <label>Name for node: *</label>
                    <input
                      type="text"
                      value={nodeName}
                      onChange={handleNodeNameChange}
                      className={nodeModalWarning && !nodeName.trim() ? 'input-error' : ''}
                    />
                  </div>
                )}
                <div className="input-group">
                  <label>Kind: *</label>
                  <select
                    value={nodeKind}
                    onChange={handleNodeKindChange}
                    className={`image-select ${nodeModalWarning && !nodeKind.trim() ? 'input-error' : ''}`}
                  >
                    <option value="">Select a kind</option>
                    {kindOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Image:</label>
                  <select
                    value={nodeImage}
                    onChange={handleNodeImageChange}
                    className="image-select"
                  >
                    <option value="">Select an image</option>
                    {getFilteredImageOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {showMgmt && (
                  <div className="input-group">
                    <label>Management IP:</label>
                    <input
                      type="text"
                      value={nodeMgmtIp}
                      placeholder="e.g., 192.168.123.45"
                      onChange={handleNodeMgmtIpChange}
                    />
                  </div>
                )}
                {/* Optional settings collapsible section */}
                <div>
                  <h3 
                    className="settings-heading"
                    onClick={() => setShowOptionalSettings(!showOptionalSettings)}
                    style={{ cursor: 'pointer' }}
                  >
                    Optional settings {showOptionalSettings ? '▲' : '▼'}
                  </h3>
                  {showOptionalSettings && (
                    <div>
                      <div className="input-group">
                        <label>Management IP (IPv4):</label>
                        <input
                          type="text"
                          value={nodeMgmtIp}
                          placeholder="e.g., 172.100.100.11"
                          onChange={handleNodeMgmtIpChange}
                        />
                      </div>
                      <div className="input-group">
                        <label>Management IP (IPv6):</label>
                        <input
                          type="text"
                          value={nodeIpv6MgmtIp || ""}
                          placeholder="e.g., 3fff:172:100:100::11"
                          onChange={(e) => setNodeIpv6MgmtIp(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label>Binds:</label>
                        {nodeBinds.map((bind, index) => (
                          <div key={index} className="bind-input-group">
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '5px' }}>
                              <input
                                type="text"
                                value={bind.source}
                                placeholder="Source path"
                                onChange={(event) => handleNodeBindsChange(index, 'source', event.target.value)}
                                style={{ flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveBindIndex(index);
                                  setShowFileManagerForBind(true);
                                }}
                                className="browse-button"
                              >
                                Browse
                              </button>
                            </div>
                            <input
                              type="text"
                              value={bind.target}
                              placeholder="Target path (e.g., /mnt/flash/token:ro)"
                              onChange={(event) => handleNodeBindsChange(index, 'target', event.target.value)}
                              style={{ width: '100%' }}
                            />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                              {index === nodeBinds.length - 1 && (
                                <button
                                  type="button"
                                  onClick={handleAddBindNode}
                                  className="add-bind-button"
                                >
                                  +
                                </button>
                              )}
                              {nodeBinds.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBindNode(index)}
                                  className="remove-bind-button"
                                >
                                  -
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="input-group">
                        <label>Startup config:</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="text"
                            value={nodeStartupConfig}
                            placeholder="Path to startup config"
                            onChange={handleNodeStartupConfigChange}
                            style={{ flex: 1 }}
                          />
                          <button 
                            type="button" 
                            onClick={handleBrowseStartupConfig}
                            className="browse-button"
                          >
                            Browse
                          </button>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>Environment Variables:</label>
                        {nodeCustomFields.map((field, index) => (
                          <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '5px' }}>
                            <input
                              type="text"
                              value={field.key}
                              placeholder="key"
                              onChange={e => handleCustomFieldChange(index, 'key', e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <input
                              type="text"
                              value={field.value}
                              placeholder="value"
                              onChange={e => handleCustomFieldChange(index, 'value', e.target.value)}
                              style={{ flex: 1 }}
                            />
                            {index === nodeCustomFields.length - 1 && (
                              <button type="button" onClick={handleAddCustomField} className="add-bind-button">+</button>
                            )}
                            {nodeCustomFields.length > 1 && (
                              <button type="button" onClick={() => handleRemoveCustomField(index)} className="remove-bind-button">-</button>
                            )}
                          </div>
                        ))}
                        <div className="helper-text" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                          Environment variables will appear under the 'env:' section in the YAML
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="actions">
                <button onClick={handleModalSubmit}>Submit</button>
                <button onClick={handleModalCancel}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        
        {showKindModal && (
          <div className="modal">
            <div className="modal-content kind-config-modal">
              <h2>Configure Kind: {kinds[currentKindIndex].name}</h2>
              
              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showStartupConfig}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showStartupConfig', e.target.checked)}
                  />
                  Startup Config
                </label>
                {kinds[currentKindIndex].config.showStartupConfig && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={kinds[currentKindIndex].config.startupConfig}
                      onChange={(e) => handleKindConfigChange(currentKindIndex, 'startupConfig', e.target.value)}
                      placeholder="Path to startup config"
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      onClick={handleBrowseKindStartupConfig}
                      className="browse-button"
                    >
                      Browse
                    </button>
                  </div>
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showImage}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showImage', e.target.checked)}
                  />
                  Image
                </label>
                {kinds[currentKindIndex].config.showImage && (
                  <select
                    value={kinds[currentKindIndex].config.image}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'image', e.target.value)}
                    className="image-select"
                  >
                    <option value="">Select an image</option>
                    {imageOptions
                      .filter(option => option.kind === kinds[currentKindIndex].name)
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showExec}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showExec', e.target.checked)}
                  />
                  Exec Commands
                </label>
                {kinds[currentKindIndex].config.showExec && (
                  <div className="exec-commands">
                    {kinds[currentKindIndex].config.exec.map((cmd, index) => (
                      <input
                        key={index}
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newExec = [...kinds[currentKindIndex].config.exec];
                          newExec[index] = e.target.value;
                          handleKindConfigChange(currentKindIndex, 'exec', newExec);
                        }}
                        placeholder="Enter exec command"
                      />
                    ))}
                    <button onClick={handleAddExec}>Add Exec Command</button>
                  </div>
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showBinds}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showBinds', e.target.checked)}
                  />
                  Binds
                </label>
                {kinds[currentKindIndex].config.showBinds && (
                  <div className="binds">
                    {kinds[currentKindIndex].config.binds.map((bind, index) => (
                      <input
                        key={index}
                        type="text"
                        value={bind}
                        onChange={(e) => {
                          const newBinds = [...kinds[currentKindIndex].config.binds];
                          newBinds[index] = e.target.value;
                          handleKindConfigChange(currentKindIndex, 'binds', newBinds);
                        }}
                        placeholder="Enter bind path"
                      />
                    ))}
                    <button onClick={handleAddKindBind}>Add Bind</button>
                  </div>
                )}
              </div>

              <div className="actions">
                <button onClick={() => setShowKindModal(false)}>Cancel</button>
                <button onClick={handleKindModalDone}>Done</button>
              </div>
            </div>
          </div>
        )}
        {contextMenu && (
          <div
            className="context-menu"
            style={{
              position: 'absolute',
              top: contextMenu.mouseY,
              left: contextMenu.mouseX,
              backgroundColor: 'white',
              boxShadow: '0px 0px 5px rgba(0,0,0,0.3)',
              zIndex: 1000,
            }}
          >
            {contextMenu.type === 'node' && (
              <>
                <button onClick={handleModifyNode}>Modify</button>
                <button onClick={handleRemoveNode}>Remove Node</button>
                <button onClick={handleContextMenuClose}>Cancel</button>
              </>
            )}
            {contextMenu.type === 'edge' && (
              <>
                <button onClick={handleModifyEdge}>Modify</button>
                <button onClick={handleRemoveEdge}>Remove Edge</button>
                <button onClick={handleContextMenuClose}>Cancel</button>
              </>
            )}
          </div>
        )}
        {isEdgeModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <h2>Configure Link Interfaces</h2>
              {edgeModalWarning && (
                <div className="warning-message">
                  Please enter both source and target interface details
                </div>
              )}
              <div className="input-group">
                <label>{newEdgeData.sourceNodeName} Interface:</label>
                <input
                  type="text"
                  value={sourceInterface}
                  onChange={(e) => setSourceInterface(e.target.value)}
                  className={edgeModalWarning && !sourceInterface.trim() ? 'input-error' : ''}
                />
              </div>
              <div className="input-group">
                <label>{newEdgeData.targetNodeName} Interface:</label>
                <input
                  type="text"
                  value={targetInterface}
                  onChange={(e) => setTargetInterface(e.target.value)}
                  className={edgeModalWarning && !targetInterface.trim() ? 'input-error' : ''}
                />
              </div>
              <div className="actions">
                <button onClick={handleEdgeModalSubmit}>Submit</button>
                <button onClick={() => {
                  setIsEdgeModalOpen(false);
                  setSourceInterface("");
                  setTargetInterface("");
                  setNewEdgeData(null);
                  setEdgeModalWarning(false);
                }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {showWarning && (
          <div className="modal warning-modal">
            <div className="modal-content">
              <h3>Warning</h3>
              <p>Please enter the topology name first</p>
              <button onClick={() => setShowWarning(false)}>OK</button>
            </div>
          </div>
        )}
        {isDeployModalOpen && (
          <div className="modal">
            <div className="modal-content server-deploy-modal-content">
              <h2>Select Server to Deploy</h2>
              <div className="server-list">
                <div className="server-deployment-table">
                  <table className="server-table">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-200 px-4 py-2 text-left">Server Name</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">IP Address</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">CPU Usage</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Memory Usage</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Available Memory</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Auto Assign<br/>MAC & S/N</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'ul-clab-1', ip: '10.150.48.133', status: 'active' }
                      ].map((server) => (
                        <tr key={server.name} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="server-info">
                              <Server className="server-icon" />
                              <span className="server-name">{server.name}</span>
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">{server.ip}</td>
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2.5" style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '10px', overflow: 'hidden' }}>
                                <div 
                                  className={`h-2.5 rounded-full ${
                                    serverResources[server.ip]?.cpu > 80 ? 'bg-red-600' :
                                    serverResources[server.ip]?.cpu > 60 ? 'bg-yellow-600' :
                                    'bg-blue-600'
                                  }`}
                                  style={{ 
                                    width: `${serverResources[server.ip]?.cpu || 0}%`,
                                    height: '100%',
                                    backgroundColor: serverResources[server.ip]?.cpu > 80 ? '#dc2626' : 
                                                   serverResources[server.ip]?.cpu > 60 ? '#d97706' : 
                                                   '#2563eb'
                                  }}
                                ></div>
                              </div>
                              <span className="ml-2 text-sm">{serverResources[server.ip]?.cpu || 0}%</span>
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2.5" style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '10px', overflow: 'hidden' }}>
                                <div 
                                  className={`h-2.5 rounded-full ${
                                    serverResources[server.ip]?.memory > 80 ? 'bg-red-600' :
                                    serverResources[server.ip]?.memory > 60 ? 'bg-yellow-600' :
                                    'bg-green-600'
                                  }`}
                                  style={{ 
                                    width: `${serverResources[server.ip]?.memory || 0}%`,
                                    height: '100%',
                                    backgroundColor: serverResources[server.ip]?.memory > 80 ? '#dc2626' : 
                                                   serverResources[server.ip]?.memory > 60 ? '#d97706' : 
                                                   '#16a34a'
                                  }}
                                ></div>
                              </div>
                              <span className="ml-2 text-sm">{serverResources[server.ip]?.memory || 0}%</span>
                            </div>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <span className="text-sm font-medium">
                              {serverResources[server.ip]?.availableMemory?.formatted || "N/A"}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              server.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {server.status}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              checked={autoAssignMacSn[server.ip] || false}
                              onChange={(e) => handleAutoAssignChange(server.ip, e.target.checked)}
                            />
                          </td>
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="server-action-buttons">
                              <button 
                                onClick={() => handleServerDeploy(server.ip)}
                                className={`server-action-btn text-sm px-3 py-1 rounded ${
                                  deployLoading[server.ip] ? 'bg-gray-400 text-gray-700' : 
                                  labExistsOnServer[server.ip] ? 'bg-gray-300 text-gray-500 opacity-60 cursor-not-allowed border border-gray-400' :
                                  serverResources[server.ip]?.memory > 90 ? 
                                    'bg-gray-300 text-gray-500 opacity-60 cursor-not-allowed border border-gray-400 deploy-warning' : 
                                  serverResources[server.ip]?.memory > 80 ?
                                    'deploy-warning' :
                                    'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-400'
                                }`}
                                disabled={deployLoading[server.ip] || labExistsOnServer[server.ip] || serverResources[server.ip]?.memory > 90}
                                title={
                                  labExistsOnServer[server.ip] ?
                                    "Topology already exists on this server. Use Reconfigure instead." :
                                  serverResources[server.ip]?.memory > 90 ? 
                                    "Deployment disabled: Server memory usage exceeds 90%" : 
                                  serverResources[server.ip]?.memory > 80 ?
                                    "Warning: High memory usage (above 80%)" :
                                    "Deploy topology to this server"
                                }
                                style={{
                                  transition: "all 0.2s ease",
                                  ...(serverResources[server.ip]?.memory > 90 && {
                                    filter: "grayscale(100%)",
                                    boxShadow: "none"
                                  })
                                }}
                              >
                                {deployLoading[server.ip] ? (
                                  <div className="flex items-center">
                                    <Loader2 className="animate-spin mr-2" size={18} />
                                    Deploying...
                                  </div>
                                ) : (
                                  serverResources[server.ip]?.memory > 80 ? (
                                    <div className="flex items-center">
                                      <span className="mr-1">⚠️</span>
                                      <span>Deploy</span>
                                    </div>
                                  ) : "Deploy"
                                )}
                              </button>
                              

                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="actions mt-4">
                <button onClick={() => setIsDeployModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        <LogModal
          isOpen={showLogModal}
          onClose={() => {
            setShowLogModal(false);
            setDeploymentSuccess(false);
          }}
          logs={operationLogs}
          title={operationTitle}
          showSuccess={deploymentSuccess}
          onNavigateToServers={handleNavigateToServers}
        />
        {showErrorModal && (
          <div className="modal warning-modal">
            <div className="modal-content">
              <h3>Error</h3>
              <p>{errorMessage}</p>
              <button onClick={() => setShowErrorModal(false)}>OK</button>
            </div>
          </div>
        )}
        <FileManagerModal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setModalMode('import');
          }}
          onImport={handleFileManagerAction}
          username={user.username}
          mode={modalMode}
        />
        
        {/* FileManager Modal for Startup Config */}
        <FileManagerModal
          isOpen={showFileManagerForStartupConfig}
          onClose={() => setShowFileManagerForStartupConfig(false)}
          onImport={handleFileManagerStartupConfigSelect}
          username={user.username}
          mode="select"
        />
        {/* FileManager Modal for Kind Startup Config */}
        <FileManagerModal
          isOpen={showFileManagerForKindStartupConfig}
          onClose={() => setShowFileManagerForKindStartupConfig(false)}
          onImport={handleFileManagerKindStartupConfigSelect}
          username={user.username}
          mode="select"
        />

        {/* Main File Manager Modal */}
        <FileManagerModal
          isOpen={showFileManager}
          onClose={() => setShowFileManager(false)}
          onImport={() => {}}
          username={user.username}
          mode="manage"
          title="File Manager"
        />
        {/* FileManager Modal for Bind Points */}
        <FileManagerModal
          isOpen={showFileManagerForBind}
          onClose={() => setShowFileManagerForBind(false)}
          onImport={handleFileManagerBindSelect}
          username={user.username}
          mode="select"
        />
      </div>
    </ReactFlowProvider>
  );
};

export default App;