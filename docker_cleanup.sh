#!/bin/bash

# Docker Cleanup Script
# Removes dangling images (<none>) and optionally other unused resources

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Docker Cleanup ===${NC}"

# Count dangling images
DANGLING_COUNT=$(docker images -f "dangling=true" -q | wc -l)

if [ "$DANGLING_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No dangling images (<none>) found.${NC}"
else
    echo -e "${YELLOW}Found ${DANGLING_COUNT} dangling images (<none>)${NC}"
    
    # Show what will be deleted
    echo -e "\nImages to be removed:"
    docker images -f "dangling=true" --format "  {{.ID}} - {{.Size}} - {{.CreatedSince}}"
    
    # Calculate total size
    TOTAL_SIZE=$(docker images -f "dangling=true" --format "{{.Size}}" | paste -sd+ | bc 2>/dev/null || echo "N/A")
    
    echo -e "\n${YELLOW}Removing dangling images...${NC}"
    docker image prune -f
    
    echo -e "${GREEN}Done! Removed ${DANGLING_COUNT} images.${NC}"
fi

# Optional: show other cleanup options
echo -e "\n${YELLOW}Other cleanup commands:${NC}"
echo "  docker container prune -f   # Remove stopped containers"
echo "  docker volume prune -f      # Remove unused volumes"
echo "  docker network prune -f     # Remove unused networks"
echo "  docker system prune -f      # Remove all unused (containers, images, networks)"
echo "  docker system prune -a -f   # Remove ALL unused (including unused images)"
