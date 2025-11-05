#!/bin/bash
# Broadloom Application Startup Script
# This script starts PostgreSQL, Backend Server, and opens the Web App

echo "========================================"
echo "   Broadloom Image Converter"
echo "   Starting Application..."
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Start PostgreSQL
echo -e "${BLUE}[Step 1/3] Starting PostgreSQL Database...${NC}"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    brew services start postgresql@15 > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL started (macOS)"
    else
        echo -e "  ${GREEN}✓${NC} PostgreSQL already running"
    fi
else
    # Linux
    sudo systemctl start postgresql > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL started (Linux)"
    else
        echo -e "  ${GREEN}✓${NC} PostgreSQL already running"
    fi
fi
echo ""

# Step 2: Start Backend Server
echo -e "${BLUE}[Step 2/3] Starting Backend API Server...${NC}"
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies first..."
    npm install
fi

# Start backend in background
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!

echo "  Backend PID: $BACKEND_PID"
echo "  Waiting for backend to initialize..."
sleep 5

# Check if backend started successfully
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Backend running at http://localhost:3000"
    echo "  Logs: backend.log"
else
    echo "  ✗ Backend failed to start. Check backend.log for errors."
    exit 1
fi

cd ..
echo ""

# Step 3: Open Frontend
echo -e "${BLUE}[Step 3/3] Opening Web Application...${NC}"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open index.html
    echo -e "  ${GREEN}✓${NC} Web app opened in default browser"
else
    # Linux
    if command -v xdg-open > /dev/null; then
        xdg-open index.html
        echo -e "  ${GREEN}✓${NC} Web app opened in default browser"
    else
        echo "  Open index.html manually in your browser"
    fi
fi

echo ""
echo "========================================"
echo "   APPLICATION STARTED SUCCESSFULLY!"
echo "========================================"
echo ""
echo "  Backend API: http://localhost:3000"
echo "  Health Check: http://localhost:3000/health"
echo "  Frontend: index.html (opened in browser)"
echo ""
echo "  Backend PID: $BACKEND_PID"
echo "  Backend Logs: backend.log"
echo ""
echo "========================================"
echo "   HOW TO STOP:"
echo "========================================"
echo "  1. Close the browser"
echo "  2. Run: kill $BACKEND_PID"
echo "     Or: ./stop.sh"
echo ""
echo "========================================"
echo ""

# Save PID for stop script
echo $BACKEND_PID > .backend.pid

echo "Press Ctrl+C to stop monitoring (backend keeps running)"
echo "Or run: ./stop.sh to stop everything"
echo ""

# Keep script running and tail logs
tail -f backend.log


