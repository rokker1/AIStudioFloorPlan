#!/bin/bash

# ComfyUI Docker Setup Script
# Creates a Python 3.13 container with GPU support and ComfyUI

CONTAINER_NAME="comfyui"
IMAGE_NAME="comfyui-python313"
HOST_DIR="/home/alzhavoronkov"
CONTAINER_DIR="/home/alzhavoronkov"
COMFYUI_PORT=8188

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ComfyUI Docker Setup ===${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check if NVIDIA Container Toolkit is installed
if ! command -v nvidia-smi &> /dev/null; then
    echo -e "${YELLOW}Warning: nvidia-smi not found. GPU support may not work.${NC}"
fi

# Stop and remove existing container if exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}Stopping and removing existing container: ${CONTAINER_NAME}${NC}"
    docker stop ${CONTAINER_NAME} 2>/dev/null
    docker rm ${CONTAINER_NAME} 2>/dev/null
fi

# Create build directory (isolated from /tmp to avoid permission issues)
BUILD_DIR=$(mktemp -d -t comfyui-build-XXXXXX)
trap "rm -rf $BUILD_DIR" EXIT

# Create startup script - just keeps container running
echo -e "${GREEN}Creating startup script...${NC}"
cat > ${BUILD_DIR}/start-comfyui.sh << 'SCRIPT'
#!/bin/bash

cd /home/comfyui
source /home/comfyui/venv/bin/activate

echo "=========================================="
echo "Container is ready!"
echo "=========================================="
echo ""
echo "To install ComfyUI manually, run:"
echo "  docker exec -it comfyui bash"
echo ""
echo "Then inside container:"
echo "  source /home/comfyui/venv/bin/activate"
echo "  comfy tracking disable"
echo "  comfy --workspace=/home/comfyui/comfy install"
echo "  pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu124"
echo "  comfy --workspace=/home/comfyui/comfy launch -- --listen 0.0.0.0 --port 8188"
echo ""
echo "=========================================="

# Keep container running
tail -f /dev/null
SCRIPT

# Create Dockerfile
echo -e "${GREEN}Creating Dockerfile...${NC}"
cat > ${BUILD_DIR}/Dockerfile << 'EOF'
FROM python:3.13-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create comfyui user
RUN useradd -m -s /bin/bash comfyui

# Set working directory
WORKDIR /home/comfyui

# Switch to comfyui user
USER comfyui

# Create virtual environment
RUN python -m venv /home/comfyui/venv

# Activate venv and install comfy-cli
RUN /home/comfyui/venv/bin/pip install --upgrade pip && \
    /home/comfyui/venv/bin/pip install comfy-cli

# Set PATH to include venv
ENV PATH="/home/comfyui/venv/bin:$PATH"
ENV VIRTUAL_ENV="/home/comfyui/venv"

# Expose ComfyUI port
EXPOSE 8188

# Copy and setup startup script
USER root
COPY start-comfyui.sh /usr/local/bin/start-comfyui.sh
RUN chmod +x /usr/local/bin/start-comfyui.sh

USER comfyui

CMD ["/usr/local/bin/start-comfyui.sh"]
EOF

# Build Docker image
echo -e "${GREEN}Building Docker image: ${IMAGE_NAME}...${NC}"
docker build -t ${IMAGE_NAME} ${BUILD_DIR}/

# Check if build succeeded
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Docker build failed${NC}"
    exit 1
fi

# Create host directory if it doesn't exist
if [ ! -d "${HOST_DIR}" ]; then
    echo -e "${YELLOW}Creating host directory: ${HOST_DIR}${NC}"
    sudo mkdir -p ${HOST_DIR}
    sudo chown $(whoami):$(whoami) ${HOST_DIR}
fi

# Run container with GPU support
echo -e "${GREEN}Starting container: ${CONTAINER_NAME}...${NC}"
docker run -d \
    --name ${CONTAINER_NAME} \
    --gpus all \
    -p ${COMFYUI_PORT}:8188 \
    -v ${HOST_DIR}:${CONTAINER_DIR} \
    -v comfyui_data:/home/comfyui/comfy \
    --restart unless-stopped \
    ${IMAGE_NAME}

# Wait for container to start
echo -e "${YELLOW}Waiting for container to start...${NC}"
sleep 5

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}=== Container started successfully! ===${NC}"
    echo -e "${GREEN}ComfyUI will be available at: http://localhost:${COMFYUI_PORT}${NC}"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "  View logs:        docker logs -f ${CONTAINER_NAME}"
    echo "  Enter container:  docker exec -it ${CONTAINER_NAME} bash"
    echo "  Stop container:   docker stop ${CONTAINER_NAME}"
    echo "  Start container:  docker start ${CONTAINER_NAME}"
    echo "  Remove container: docker rm -f ${CONTAINER_NAME}"
    echo ""
    echo -e "${YELLOW}Volume mounts:${NC}"
    echo "  ${HOST_DIR} -> ${CONTAINER_DIR}"
    echo "  comfyui_data -> /home/comfyui/comfy (ComfyUI installation + models)"
    echo ""
    echo -e "${YELLOW}Note: First startup may take several minutes to install ComfyUI and PyTorch${NC}"
    echo -e "${YELLOW}Check progress with: docker logs -f ${CONTAINER_NAME}${NC}"
else
    echo -e "${RED}Error: Container failed to start${NC}"
    echo "Check logs with: docker logs ${CONTAINER_NAME}"
    exit 1
fi
