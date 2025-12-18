#!/bin/bash

echo "🚀 Starting Tip Distribution Application"
echo "========================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

echo "✅ Python and Node.js are installed"
echo ""

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

echo ""

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo ""
echo "✅ All dependencies installed!"
echo ""
echo "Starting servers..."
echo ""

# Start backend in background
echo "🔧 Starting backend server on port 8000..."
python3 backend.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server on port 3000..."
echo ""
echo "========================================="
echo "🎉 Application is ready!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT
