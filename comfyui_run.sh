#!/bin/bash

# ComfyUI Docker Run Script
# Starts the container with auto-install

CONTAINER_NAME="comfyui"
IMAGE_NAME="comfyui-python313"
HOST_DIR="/home/alzhavoronkov"
CONTAINER_DIR="/home/alzhavoronkov"
COMFYUI_PORT=8188

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Starting ComfyUI Container ===${NC}"

# Check if image exists
if ! docker images --format '{{.Repository}}' | grep -q "^${IMAGE_NAME}$"; then
    echo -e "${RED}Error: Image ${IMAGE_NAME} not found. Run comfyui_build.sh first.${NC}"
    exit 1
fi

# Stop and remove existing container
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}Removing existing container...${NC}"
    docker rm -f ${CONTAINER_NAME}
fi

# Run container in background with auto-install script
docker run -d \
    --name ${CONTAINER_NAME} \
    --gpus all \
    -p ${COMFYUI_PORT}:8188 \
    -v ${HOST_DIR}:${CONTAINER_DIR} \
    -v comfyui_data:/home/comfyui/comfy \
    --restart unless-stopped \
    ${IMAGE_NAME} \
    bash -c '
source /home/comfyui/venv/bin/activate

# Check if already installed
if [ -d "/home/comfyui/comfy/ComfyUI" ]; then
    echo "ComfyUI already installed, starting..."
else
    echo "Installing ComfyUI via git clone..."
    mkdir -p /home/comfyui/comfy
    cd /home/comfyui/comfy
    git clone https://github.com/comfyanonymous/ComfyUI.git
    
    echo "Installing PyTorch with CUDA 12.4..."
    pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu124
    
    echo "Installing ComfyUI requirements..."
    pip install -r /home/comfyui/comfy/ComfyUI/requirements.txt
    
    echo "Installing ComfyUI-Manager..."
    cd /home/comfyui/comfy/ComfyUI/custom_nodes
    git clone https://github.com/ltdrdata/ComfyUI-Manager.git
fi

echo "Starting ComfyUI..."
cd /home/comfyui/comfy/ComfyUI
exec python main.py --listen 0.0.0.0 --port 8188
'

sleep 3

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}=== Container started! ===${NC}"
    echo ""
    echo -e "${YELLOW}View logs:${NC} docker logs -f ${CONTAINER_NAME}"
    echo -e "${YELLOW}ComfyUI URL:${NC} http://localhost:${COMFYUI_PORT}"
    echo ""
    echo -e "${YELLOW}First startup will take a few minutes (PyTorch ~2GB download)${NC}"
else
    echo -e "${RED}Failed to start container${NC}"
    docker logs ${CONTAINER_NAME}
    exit 1
fi
