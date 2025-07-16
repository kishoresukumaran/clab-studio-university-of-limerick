# Containerlab Designer

Containerlab Designer is a web-based UI for creating, visualizing, and managing containerlab network topologies. This application provides an intuitive interface for working with containerlab, allowing users to design, deploy, and manage network topologies through a modern React-based interface.

## Features

- Visual topology designer with drag-and-drop interface
- Topology management dashboard
- Real-time server metrics monitoring
- SSH access to containerized network devices
- Integration with containerlab API
- Multi-server support

## Prerequisites

- Linux server with Docker installed
- Containerlab installed and running
- Firewall configured to allow HTTP traffic (port 80)
- Root or sudo access for installation
- **Required backend services:**
  1. [Containerlab API Backend](https://github.com/kishoresukumaran/containerlab-backend) - Provides the Express API server and official containerlab API server
  2. [Authentication Service](https://github.com/kishoresukumaran/clab-auth-service) - Handles user authentication with MongoDB

### Backend Services Installation

Before installing the Containerlab Designer UI, you must install the required backend services:

1. **Authentication Service** (/opt/auth-service):
   - This service provides user authentication with MongoDB
   - Clone and install following the instructions in the [clab-auth-service repository](https://github.com/kishoresukumaran/clab-auth-service)
   - The service manages user accounts and authentication for the UI

2. **Containerlab API Backend** (/opt/containerlab-api):
   - This service provides both a custom Express API and the official containerlab API server
   - Clone and install following the instructions in the [containerlab-backend repository](https://github.com/kishoresukumaran/containerlab-backend)
   - The backend handles all containerlab operations, file management, and system metrics

Once both backend services are installed and running, proceed with installing the Containerlab Designer UI.

## Installation

### Option 1: Using the Installation Script (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/kishoresukumaran/ul-clab-studio.git
   cd ul-clab-studio-new
   ```

2. Run the installation script with root privileges:
   ```bash
   sudo ./install.sh
   ```

3. Follow the prompts in the installation script:
   - Choose option 1 for manual Docker Compose management
   - Choose option 2 for SystemD service (recommended for production)

### Option 2: Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kishoresukumaran/ul-clab-studio.git
   cd ul-clab-studio-new
   ```

2. Build and start the Docker container:
   ```bash
   docker compose build
   docker compose up -d
   ```

3. Configure your firewall to allow traffic on port 80:
   ```bash
   sudo firewall-cmd --permanent --add-port=80/tcp
   sudo firewall-cmd --reload
   ```

## Usage

### Accessing the UI

After installation, access the Containerlab Designer UI by navigating to:
```
http://<server-ip>
```

Replace `<server-ip>` with the IP address of your server.

### Managing Topologies

1. **Fetch Topologies**: Click the "Fetch Topologies" button to retrieve all deployed topologies from the server.
2. **View Topology Details**: Click on a topology name to expand and see all nodes and their details.
3. **Manage Topologies**: Use the action buttons to:
   - Reconfigure: Update an existing topology
   - Destroy: Remove a topology
   - SSH: Connect to nodes via SSH
   - Save: Save the current state of a topology

### Creating New Topologies

1. Navigate to the Designer tab
2. Drag and drop network devices onto the canvas
3. Connect devices by dragging between connection points
4. Configure device properties and connections
5. Deploy the topology to a containerlab server

## Managing the Service

### Docker Compose Management

If you chose the Docker Compose option during installation:

```bash
# Start the service
docker compose up -d

# Stop the service
docker compose down

# View logs
docker compose logs -f
```

### SystemD Service Management

If you chose the SystemD service option during installation:

```bash
# Check service status
systemctl status containerlab-designer.service

# Start the service
systemctl start containerlab-designer.service

# Stop the service
systemctl stop containerlab-designer.service

# View logs
journalctl -u containerlab-designer.service -f
```

## Troubleshooting

### Common Issues

1. **UI not accessible**:
   - Verify the container is running: `docker ps | grep containerlab-designer`
   - Check if port 80 is open: `sudo firewall-cmd --list-ports`
   - Ensure Nginx is running inside the container: `docker logs containerlab-designer`

2. **API connection errors**:
   - Verify the containerlab API server is running: `docker ps | grep clab-api-server`
   - Check Nginx configuration for proper proxying: `docker exec containerlab-designer cat /etc/nginx/conf.d/default.conf`
   - Ensure port 8080 is accessible: `curl -X GET http://<server-ip>:8080/api/v1/version`

3. **Authentication failures**:
   - Check the credentials being used (default is admin/arastra)
   - Verify the auth service is running: `docker ps | grep auth-api`
   - Check MongoDB connection: `docker ps | grep auth-mongo`

### Backend Service Issues

1. **Authentication Service Issues**:
   - Check if the auth service containers are running: `docker ps | grep auth-`
   - View auth service logs: `docker logs auth-api`
   - Verify MongoDB is running: `docker logs auth-mongo`

2. **Containerlab API Backend Issues**:
   - Check if the API containers are running: `docker ps | grep containerlab-api`
   - View API logs: `docker logs containerlab-api`
   - Check official containerlab API server: `docker logs clab-api-server`

### Viewing Logs

```bash
# View container logs
docker logs containerlab-designer

# View real-time logs
docker logs -f containerlab-designer

# View system service logs
journalctl -u containerlab-designer.service -f
```

### Rebuilding After Changes

If you make changes to the application code:

```bash
# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

## Complete System Architecture

The Containerlab Designer system consists of three main components:

1. **Containerlab Designer UI** (this repository) - Frontend React application
2. **Authentication Service** - User authentication with MongoDB
3. **Containerlab API Backend** - Express API and official containerlab API server

All three components must be installed and running for the complete system to function properly.

## License

Copyright (c) 2024-2025 Kishore Sukumaran
