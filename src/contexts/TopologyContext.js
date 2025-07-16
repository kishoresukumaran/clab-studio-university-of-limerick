import React, { createContext, useState, useContext } from 'react';

// Create the context
const TopologyContext = createContext();

// Create a custom hook to use the topology context
export const useTopology = () => useContext(TopologyContext);

// Create the provider component
export const TopologyProvider = ({ children }) => {
  const [topologyState, setTopologyState] = useState({
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
    yamlParseError: ''
  });

  // Function to update the topology state
  const updateTopologyState = (newState) => {
    setTopologyState(prevState => ({
      ...prevState,
      ...newState
    }));
  };

  // Value to be provided by the context
  const value = {
    topologyState,
    updateTopologyState
  };

  return (
    <TopologyContext.Provider value={value}>
      {children}
    </TopologyContext.Provider>
  );
}; 