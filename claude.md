# Containerlab Studio - Frontend UI

## Project Overview

**Repository**: https://github.com/kishoresukumaran/clab-studio-university-of-limerick
**Purpose**: Web-based UI for designing, visualizing, and managing containerlab network topologies
**Technology Stack**: React 18 + ReactFlow + Nginx + XTerm.js
**Port**: 80 (HTTP)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Containerlab Designer Frontend                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Nginx (Port 80)                                        │
│  ├── / → React App (static files)                      │
│  ├── /login → Proxy to Backend:8080                    │
│  └── /api/* → Proxy to Backend:8080                    │
│                                                          │
│  React Application                                       │
│  ├── Topology Designer (ReactFlow)                     │
│  ├── Dashboard (Server/Topology Management)            │
│  ├── Web Terminal (XTerm.js + WebSocket)               │
│  ├── File Manager                                       │
│  ├── Authentication (JWT)                               │
│  └── YAML Editor (Prism.js syntax highlighting)        │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │
         ├─> Auth Service (Port 3000)
         ├─> Backend API (Port 3001)
         └─> Containerlab API (Port 8080)
```

---

## Directory Structure

```
/opt/clab-frontend/
├── public/                         # Static assets
│   ├── index.html                 # HTML entry point
│   ├── favicon.ico
│   ├── manifest.json
│   └── logo*.svg/png
│
├── src/                            # React application
│   ├── index.js                   # React entry point
│   ├── App.js                     # Main app component
│   ├── Sidebar.js                 # Sidebar navigation
│   ├── *.css                      # Stylesheets
│   │
│   ├── components/                # React components (~9,000 lines total)
│   │   ├── ContainerLab.js        (4,027 lines) - Topology designer
│   │   ├── ClabServers.js         (1,129 lines) - Dashboard
│   │   ├── FileManagerModal.js    (2,084 lines) - File browser
│   │   ├── WebTerminal.js         (265 lines) - Terminal emulator
│   │   ├── Login.js               (101 lines) - Authentication
│   │   ├── SshModal.js            # SSH connection modal
│   │   ├── LogModal.js            # Operation logs
│   │   ├── CustomNode.js          # ReactFlow node component
│   │   ├── CustomEdge.js          # ReactFlow edge component
│   │   ├── AnnotationToolbar.js   # Drawing tools
│   │   ├── ACT.js                 # Beta feature (unused)
│   │   └── YamlPreview.js         # YAML editor
│   │
│   ├── contexts/
│   │   └── TopologyContext.js     # Global state management
│   │
│   ├── utils/
│   │   └── auth.js                # Authentication helpers
│   │
│   └── config/
│       └── users.json             # Static user config (legacy)
│
├── server/                         # Backend services (legacy)
│   ├── clab_api_handler.js
│   └── containerlab_server_backend.js
│
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Container orchestration
├── nginx.conf                      # Nginx reverse proxy config
├── install.sh                      # Installation script
├── package.json                    # Dependencies
└── README.md                       # Documentation
```

---

## Installation

### Prerequisites
- Docker with Docker Compose plugin
- Backend services running:
  - Authentication Service (Port 3000)
  - Containerlab Backend (Port 3001, 8080)
- Firewall configured for port 80
- Root/sudo access

### Quick Installation

```bash
cd /opt/clab-frontend

# Run installation script
sudo ./install.sh

# Choose startup method:
# 1. Docker Compose (manual start/stop)
# 2. SystemD service (auto-start on boot)
```

### Manual Installation

```bash
# Build Docker image
docker compose build

# Configure firewall (if needed)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload

# Start container
docker compose up -d
```

### Build Process

**Multi-stage Dockerfile**:
```dockerfile
# Stage 1: Build (node:20-alpine)
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build  # Creates optimized production build

# Stage 2: Production (nginx:stable-alpine)
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Configuration Files

### 1. nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;

    # Serve React app
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Proxy login to backend
    location /login {
        proxy_pass http://10.150.48.133:8080/login;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://10.150.48.133:8080/api/;
        # ... same headers as above
    }
}
```

**⚠️ HARDCODED IP**: `10.150.48.133` needs to match your backend server IP

### 2. package.json

```json
{
  "name": "reactflow-containerlab",
  "version": "0.1.0",
  "proxy": "http://10.150.48.133:8080",
  "dependencies": {
    "react": "^18.3.1",
    "react-router-dom": "^7.3.0",
    "reactflow": "^11.11.4",
    "xterm": "^5.3.0",
    "axios": "^1.9.0",
    "js-yaml": "^4.1.0",
    ...
  }
}
```

**⚠️ HARDCODED IP**: Proxy setting for development mode

### 3. docker-compose.yml

```yaml
version: '3.8'

services:
  containerlab-designer:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: containerlab-designer
    ports:
      - "80:80"
    restart: unless-stopped
    networks:
      - containerlab-network

networks:
  containerlab-network:
    name: containerlab-network
    driver: bridge
```

---

## Key Components

### 1. App.js - Main Application

- **Routes**:
  - `/login` - Authentication page
  - `/terminal/:serverIp/:nodeName/:nodeIp/:nodeKind` - Web terminal
  - `/*` - Main app (protected, requires authentication)

- **Modes**:
  - `containerlab` - Topology Designer
  - `servers` - Dashboard

- **State Management**:
  - Authentication state
  - User info (username, role, displayName)
  - TopologyProvider context

### 2. ContainerLab.js - Topology Designer (4,027 lines)

**Primary Features**:
- Drag-and-drop topology design using ReactFlow
- Visual node and edge manipulation
- Real-time YAML generation
- Import/Export topology files
- Deploy topologies to containerlab servers
- File manager integration
- Annotation tools (text, shapes, drawings)
- Auto-layout with ELK graph algorithm

**Key Functions**:
```javascript
// Auto-layout nodes
const getLayoutedElements = async (nodes, edges)

// Convert YAML to visual topology
const yamlToTopology = (yamlContent)

// Deploy topology to server
const deployTopology = (serverIp, username)
```

**API Calls**:
- `POST http://<serverIp>:3001/api/containerlab/deploy`
- `POST http://<serverIp>:3001/api/files/*`
- WebSocket: `ws://<serverIp>:3001/ws/ssh`

### 3. ClabServers.js - Dashboard (1,129 lines)

**Features**:
- List all containerlab servers
- Display deployed topologies per server
- Server metrics (CPU, memory, disk)
- Topology operations:
  - Reconfigure
  - Destroy
  - Save
  - SSH to nodes

**Hardcoded Configuration**:
```javascript
const servers = [
  { name: 'ul-clab-1', ip: '10.150.48.133' }
];

// ⚠️ Hardcoded password for authentication
const password = 'ul678clab';
```

**API Calls**:
- `POST /login` - Get JWT token
- `GET /api/v1/topologies` - List topologies (official API)
- `GET /api/system/metrics` - Server metrics
- `POST /api/containerlab/*` - Topology operations

**Metrics Polling**: 30-second intervals

### 4. FileManagerModal.js - File Browser (2,084 lines)

**Features**:
- Browse files on remote servers
- Create/Read/Edit/Delete files and directories
- Upload/Download files
- Copy/Paste/Rename operations
- Git repository cloning
- YAML file editing with syntax highlighting

**API Endpoints**:
- `GET /api/files/list`
- `GET /api/files/read`
- `POST /api/files/save`
- `POST /api/files/upload`
- `DELETE /api/files/delete`
- `POST /api/files/createDirectory`
- `POST /api/files/createFile`
- `POST /api/files/copyPaste`
- `POST /api/files/rename`
- `POST /api/git/clone`

### 5. WebTerminal.js - SSH Terminal (265 lines)

**Features**:
- XTerm.js terminal emulator
- WebSocket-based SSH connection
- Full terminal emulation (xterm-256color)
- Terminal resizing support
- Connection to containerlab nodes

**Route**: `/terminal/:serverIp/:nodeName/:nodeIp/:nodeKind`

**WebSocket Connection**:
```javascript
const ws = new WebSocket(`ws://${serverIp}:3001/ws/ssh`);

ws.send(JSON.stringify({
  type: 'connect',
  serverIp,
  nodeName,
  nodeKind
}));
```

### 6. Login.js - Authentication (101 lines)

**Features**:
- Username/password form
- Username validation (no @domain.com)
- Integration with auth service
- Session persistence (localStorage)

**API Call**:
```javascript
POST http://10.150.48.133:3000/api/auth/verify-user
Body: { username, password }
Response: { success, user: { username, displayName, role } }
```

### 7. TopologyContext.js - State Management

**Global State**:
```javascript
{
  nodes: [],                    // Topology nodes
  edges: [],                    // Connections
  yamlOutput: '',               // Generated YAML
  editableYaml: '',             // User-edited YAML
  topologyName: '',
  showMgmt: false,
  mgmtNetwork: '',
  ipv4Subnet: '',
  showIpv6: false,
  ipv6Subnet: '',
  kinds: [...],                 // Device type configurations
  nodeInterfaces: {},           // Interface mappings
  annotations: [],              // Drawing annotations
  activeTool: 'select',
  ...
}
```

---

## Technologies & Dependencies

### Core Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.3.1 | UI framework |
| React Router DOM | 7.3.0 | Client-side routing |
| ReactFlow | 11.11.4 | Visual graph editor |
| XTerm.js | 5.3.0 | Terminal emulator |
| Axios | 1.9.0 | HTTP client |
| js-yaml | 4.1.0 | YAML parsing |
| elkjs | 0.9.3 | Graph layout algorithm |
| Prism.js | 1.30.0 | Syntax highlighting |
| file-saver | 2.0.5 | File downloads |
| ws | 8.18.1 | WebSocket client |

### Build Tools
- **React Scripts** 5.0.1 - CRA toolchain
- **Webpack** - Module bundler
- **Babel** - JavaScript transpiler

---

## API Integration

### Backend API Endpoints

**Express API (Port 3001)**:
```
GET  /api/containerlab/inspect
POST /api/containerlab/deploy
POST /api/containerlab/destroy
POST /api/containerlab/reconfigure
POST /api/containerlab/save
GET  /api/files/list
GET  /api/files/read
POST /api/files/save
POST /api/files/upload
DELETE /api/files/delete
POST /api/files/createDirectory
POST /api/files/createFile
POST /api/files/copyPaste
POST /api/files/rename
GET  /api/system/metrics
GET  /api/ports/free
POST /api/git/clone
WS   /ws/ssh
```

**Official Containerlab API (Port 8080)**:
```
POST /login
GET  /api/v1/version
GET  /api/v1/topologies
POST /api/v1/topologies
PUT  /api/v1/topologies/:name
DELETE /api/v1/topologies/:name
```

**Auth Service API (Port 3000)**:
```
POST /api/auth/verify-user
GET  /api/users
POST /api/users
PUT  /api/users/:id
DELETE /api/users/:id
```

---

## Hardcoded Configurations (MUST UPDATE)

### IPs to Update for Your Server

1. **nginx.conf** (Lines 13, 23):
```nginx
proxy_pass http://10.150.48.133:8080/...;
```

2. **package.json** (Line 5):
```json
"proxy": "http://10.150.48.133:8080"
```

3. **src/utils/auth.js** (Line 4):
```javascript
const API_BASE_URL = 'http://10.150.48.133:3000';
```

4. **src/components/ClabServers.js** (Line 44):
```javascript
const servers = [
  { name: 'ul-clab-1', ip: '10.150.48.133' }
];
```

5. **src/components/ClabServers.js** (Line 68):
```javascript
password: 'ul678clab'  // SSH password
```

### Update Script

Create `update-ip.sh`:
```bash
#!/bin/bash
OLD_IP="10.150.48.133"
NEW_IP="$1"

if [ -z "$NEW_IP" ]; then
  echo "Usage: ./update-ip.sh <new-ip-address>"
  exit 1
fi

echo "Updating IP from $OLD_IP to $NEW_IP..."

sed -i "s/$OLD_IP/$NEW_IP/g" nginx.conf
sed -i "s/$OLD_IP/$NEW_IP/g" package.json
sed -i "s/$OLD_IP/$NEW_IP/g" src/utils/auth.js
sed -i "s/$OLD_IP/$NEW_IP/g" src/components/ClabServers.js

echo "IP addresses updated. Rebuild required:"
echo "  docker compose down"
echo "  docker compose build"
echo "  docker compose up -d"
```

---

## User Workflow

### 1. Authentication
```
User → Login Page → Auth Service API (:3000)
                  → Verify credentials
                  → Store user in localStorage
                  → Navigate to main app
```

### 2. Designing Topology
```
Topology Designer Tab
  ├─> Drag nodes from sidebar
  ├─> Connect nodes by dragging
  ├─> Configure node properties
  ├─> Auto-generate YAML
  ├─> Edit YAML in code editor
  └─> Deploy to server
```

### 3. Deploying Topology
```
User clicks "Deploy"
  ├─> Select server from dropdown
  ├─> POST topology YAML to /api/containerlab/deploy
  ├─> Backend executes: clab deploy --topo topology.yaml
  ├─> Stream deployment logs
  └─> Display results in LogModal
```

### 4. Managing Topologies (Dashboard)
```
Dashboard Tab
  ├─> Fetch topologies from all servers
  ├─> Display server metrics (CPU, memory)
  ├─> For each topology:
  │   ├─> Show nodes and details
  │   ├─> Operations: Reconfigure, Destroy, Save
  │   └─> SSH to nodes via WebTerminal
  └─> Poll metrics every 30 seconds
```

### 5. SSH to Nodes
```
User clicks SSH button
  ├─> Open SshModal (select nodes)
  ├─> Navigate to /terminal/:params
  ├─> WebTerminal component loads
  ├─> Establish WebSocket connection
  ├─> Backend creates SSH/Docker exec session
  └─> XTerm.js renders terminal
```

---

## Service Management

### Docker Compose

```bash
# Start service
docker compose up -d

# Stop service
docker compose down

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose down
docker compose build --no-cache
docker compose up -d

# Check status
docker ps | grep containerlab-designer
```

### SystemD Service

```bash
# Status
systemctl status containerlab-designer.service

# Start/Stop/Restart
systemctl start containerlab-designer.service
systemctl stop containerlab-designer.service
systemctl restart containerlab-designer.service

# Logs
journalctl -u containerlab-designer.service -f

# Enable/Disable auto-start
systemctl enable containerlab-designer.service
systemctl disable containerlab-designer.service
```

---

## Development

### Local Development

```bash
cd /opt/clab-frontend

# Install dependencies
npm install

# Start dev server (hot reload)
npm start
# Opens http://localhost:3000
# API proxied to http://10.150.48.133:8080

# Run tests
npm test

# Build for production
npm run build
```

### Making Changes

1. Edit files in `src/`
2. Changes auto-reload in dev mode
3. Test in browser
4. Commit to git
5. Rebuild Docker image for production

---

## Troubleshooting

### UI Not Accessible

```bash
# Check container status
docker ps | grep containerlab-designer

# View container logs
docker logs containerlab-designer

# Check Nginx inside container
docker exec containerlab-designer curl localhost

# Verify port 80 is open
sudo netstat -tulpn | grep :80
```

### API Connection Errors

```bash
# Test backend connectivity
curl http://10.150.48.133:8080/api/v1/version
curl http://10.150.48.133:3001/health

# Check Nginx proxy config
docker exec containerlab-designer cat /etc/nginx/conf.d/default.conf

# Verify backend services running
docker ps | grep -E "containerlab-api|auth-api"
```

### Authentication Failures

```bash
# Check auth service
curl http://10.150.48.133:3000/api/health

# View auth service logs
docker logs auth-api

# Verify MongoDB
docker logs auth-mongo
```

### WebSocket Terminal Not Working

```bash
# Check backend WebSocket server
docker logs containerlab-api | grep -i websocket

# Test WebSocket connection (browser console):
# new WebSocket('ws://10.150.48.133:3001/ws/ssh')
```

### Build Failures

```bash
# Clear Docker build cache
docker builder prune -a

# Rebuild from scratch
docker compose build --no-cache

# Check disk space
df -h
```

---

## Security Considerations

**⚠️ CURRENT SECURITY ISSUES**:

1. **Hardcoded Passwords**: SSH password in ClabServers.js
2. **HTTP Only**: No HTTPS/SSL
3. **Open CORS**: Backend allows all origins
4. **No Input Validation**: File paths not sanitized
5. **Client-Side Auth**: JWT stored in localStorage
6. **Exposed Credentials**: Passwords in source code

**For Production**:
- Implement HTTPS with SSL certificates
- Use environment variables for sensitive data
- Add input validation and sanitization
- Implement rate limiting
- Add CSRF protection
- Use secure HTTP-only cookies for tokens
- Enable Content Security Policy

---

## Performance Optimization

**Current Optimizations**:
- Multi-stage Docker build (smaller image)
- React production build (minified, optimized)
- Nginx gzip compression
- Static asset caching

**Recommendations**:
- Enable Nginx caching for static files
- Implement service worker for offline support
- Lazy load components with React.lazy()
- Optimize ReactFlow performance for large topologies

---

## Summary

The Containerlab Studio Frontend is a comprehensive React-based UI providing:

**Key Features**:
- Visual topology designer with drag-and-drop
- Multi-server dashboard with metrics
- Web-based SSH terminal
- File management system
- YAML import/export
- User authentication
- Real-time deployment logs

**Architecture**:
- React 18 + ReactFlow for visualization
- Nginx reverse proxy for API routing
- XTerm.js for terminal emulation
- Docker containerization for easy deployment

**Integration Points**:
- Auth Service (Port 3000) - User authentication
- Backend API (Port 3001) - Containerlab operations
- Official API (Port 8080) - Native containerlab features

**Critical Configuration**:
- Update hardcoded IP addresses to match your server
- Change default passwords before production use
- Configure firewall to allow port 80

This UI provides a complete interface for containerlab topology management with an intuitive, modern design.
