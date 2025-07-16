import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ContainerLab from './components/ContainerLab';
import ACT from './components/ACT';
import ClabServers from './components/ClabServers';
import Login from './components/Login';
import WebTerminal from './components/WebTerminal';
import logo from './logo4.svg';
import { TopologyProvider } from './contexts/TopologyContext';
import { isAdmin } from './utils/auth';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const handleLogin = (userInfo) => {
    setIsAuthenticated(true);
    setUser(userInfo);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <TopologyProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route 
            path="/terminal/:serverIp/:nodeName/:nodeIp/:nodeKind" 
            element={<WebTerminal />} 
          />
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <MainApp user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Router>
    </TopologyProvider>
  );
};

const MainApp = ({ user, onLogout }) => {
  const [mode, setMode] = useState('containerlab');

  return (
    <div className="app">
      <div className="header">
        <div className="header-buttons">
          <button
            className={`header-button ${mode === 'containerlab' ? 'active' : ''}`}
            onClick={() => setMode('containerlab')}
          >
            Topology Designer
          </button>
          <button
            className={`header-button ${mode === 'servers' ? 'active' : ''}`}
            onClick={() => setMode('servers')}
          >
            Dashboard
          </button>
          <button
            className={`header-button ${mode === 'act' ? 'active' : ''}`}
            onClick={() => setMode('act')}
          >
            ACT (BETA)
          </button>
        </div>
        <div className="header-logo-center">
          <img src={logo} alt="Containerlab Studio Logo" className="header-logo" />
        </div>
        <div className="user-info">
          <div className='user-name'>
            Welcome, {user?.displayName || user?.username}!
          </div>
          <div className="user-actions">
            {isAdmin() && (
              <button 
                className="settings-button" 
                title="Admin Settings"
                onClick={() => alert('Admin Settings - Feature coming soon')}
              >
                ⚙️
              </button>
            )}
            <button onClick={onLogout}>Logout</button>
            <a 
              href="https://docs.google.com/document/d/1CKyCFyzjFMJbTFTtHYIofAoAlof8oMdmPElNkc1HKjk/edit?usp=sharing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="help-button"
              title="Help Documentation"
            >
              <span className="help-icon">?</span>
            </a>
          </div>
        </div>
      </div>

      {mode === 'containerlab' ? (
        <ContainerLab user={user} onLogout={onLogout} parentSetMode={setMode} />
      ) : mode === 'act' ? (
        <ACT user={user} onLogout={onLogout} />
      ) : (
        <ClabServers user={user} onLogout={onLogout} />
      )}
    </div>
  );
};

export default App;
