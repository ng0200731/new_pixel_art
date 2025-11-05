#!/bin/bash
# Broadloom Application Stop Script

echo "========================================"
echo "   Stopping Broadloom Application"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Stop Backend
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    echo "Stopping backend server (PID: $BACKEND_PID)..."
    
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo -e "  ${GREEN}✓${NC} Backend stopped"
    else
        echo -e "  ${RED}✗${NC} Backend not running"
    fi
    
    rm .backend.pid
else
    echo "No backend PID file found"
    echo "Trying to find and kill Node.js backend..."
    pkill -f "node.*server.js" && echo -e "  ${GREEN}✓${NC} Backend stopped" || echo -e "  ${RED}✗${NC} No backend found"
fi

echo ""
echo "Note: PostgreSQL is still running"
echo "To stop PostgreSQL:"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  brew services stop postgresql@15"
else
    echo "  sudo systemctl stop postgresql"
fi

echo ""
echo "========================================"
echo "   Stopped!"
echo "========================================"


