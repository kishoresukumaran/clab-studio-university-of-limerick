#!/bin/bash

# Exit on error
set -e

echo "Containerlab Designer Installation Script"
echo "========================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

# Get the current absolute directory path
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Installing from directory: $CURRENT_DIR"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Please install Docker first."
  exit 1
fi

# Stop any existing containers
echo "Stopping any existing containerlab-designer containers..."
docker compose down 2>/dev/null || true

# Build the docker image
echo "Building Docker image..."
docker compose build

# Configure firewall if firewall-cmd is available
if command -v firewall-cmd &> /dev/null; then
  echo "Configuring firewall rules..."
  
  # Check if port 80/tcp is already added
  if ! firewall-cmd --list-ports | grep -q "80/tcp"; then
    echo "Adding port 80/tcp to firewall..."
    firewall-cmd --permanent --add-port=80/tcp
  else
    echo "Port 80/tcp already configured in firewall."
  fi
  
  # Reload firewall to apply changes
  echo "Reloading firewall configuration..."
  firewall-cmd --reload
fi

echo ""
echo "Choose startup method:"
echo "1) Use Docker Compose (manually start/stop with 'docker compose up/down')"
echo "2) Install as SystemD service (auto-start on boot)"
read -p "Enter option (1 or 2): " startup_option

if [ "$startup_option" = "1" ]; then
  echo "Starting containerlab-designer with Docker Compose..."
  docker compose up -d
  
  echo ""
  echo "Installation complete!"
  echo "You can manage the container with:"
  echo "  - Start: docker compose up -d"
  echo "  - Stop:  docker compose down"
  echo "  - Logs:  docker compose logs -f"
  
elif [ "$startup_option" = "2" ]; then
  echo "Installing systemd service..."
  
  # Create systemd service file with the correct path
  cat > /etc/systemd/system/containerlab-designer.service << EOF
[Unit]
Description=Containerlab Designer Docker Container
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable containerlab-designer.service
  systemctl start containerlab-designer.service
  
  echo ""
  echo "Installation complete!"
  echo "The service is now running and will start automatically on boot"
  echo "You can manage it with:"
  echo "  - Check status: systemctl status containerlab-designer.service"
  echo "  - Stop:         systemctl stop containerlab-designer.service"
  echo "  - Start:        systemctl start containerlab-designer.service"
  echo "  - View logs:    journalctl -u containerlab-designer.service -f"
  
else
  echo "Invalid option. Please run the script again and choose 1 or 2."
  exit 1
fi

echo ""
echo "The Containerlab Designer UI is now running on port 80"
echo "You can access it at: http://$(hostname -I | awk '{print $1}')" 