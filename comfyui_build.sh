#!/bin/bash

# ComfyUI Docker Build Script
# Builds the Docker image (run once)

IMAGE_NAME="comfyui-python313"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== Building ComfyUI Docker Image ===${NC}"

# Create build directory
BUILD_DIR=$(mktemp -d -t comfyui-build-XXXXXX)
trap "rm -rf $BUILD_DIR" EXIT

# Create startup script
cat > ${BUILD_DIR}/start-comfyui.sh << 'SCRIPT'
#!/bin/bash

# Fix permissions on mounted volume (runs as root initially)
chown -R comfyui:comfyui /home/comfyui/comfy 2>/dev/null || true

# Switch to comfyui user and continue
exec su comfyui -c '
cd /home/comfyui
source /home/comfyui/venv/bin/activate

echo "=========================================="
echo "Container is ready!"
echo "=========================================="
echo ""
echo "To install ComfyUI manually:"
echo "  comfy tracking disable"
echo "  comfy --workspace=/home/comfyui/comfy install"
echo "  pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu124"
echo "  comfy --workspace=/home/comfyui/comfy launch -- --listen 0.0.0.0 --port 8188"
echo ""
echo "=========================================="

tail -f /dev/null
'
SCRIPT

# Create Dockerfile
cat > ${BUILD_DIR}/Dockerfile << 'EOF'
FROM python:3.13-bookworm

RUN apt-get update && apt-get install -y \
    git wget libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash comfyui
WORKDIR /home/comfyui
USER comfyui

RUN python -m venv /home/comfyui/venv
RUN /home/comfyui/venv/bin/pip install --upgrade pip && \
    /home/comfyui/venv/bin/pip install comfy-cli

ENV PATH="/home/comfyui/venv/bin:$PATH"
ENV VIRTUAL_ENV="/home/comfyui/venv"

EXPOSE 8188

USER root
COPY start-comfyui.sh /usr/local/bin/start-comfyui.sh
RUN chmod +x /usr/local/bin/start-comfyui.sh

# Run as root so startup script can fix permissions, then it switches to comfyui
CMD ["/usr/local/bin/start-comfyui.sh"]
EOF

docker build -t ${IMAGE_NAME} ${BUILD_DIR}/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Image built successfully: ${IMAGE_NAME}${NC}"
else
    echo -e "${RED}Build failed${NC}"
    exit 1
fi
