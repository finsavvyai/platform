#!/bin/bash
# Quick device listing script

echo "🖥️  FINSAVVYAI DEVICE OVERVIEW"
echo "=============================="
echo

echo "📋 QUICK DEVICE COMMANDS:"
echo "----------------------------"
echo

echo "1. List cluster devices (table format):"
echo "   finsavvyai describe nodes"
echo

echo "2. Detailed device information:"
echo "   finsavvyai describe nodes --detailed"
echo

echo "3. Service status and endpoints:"
echo "   finsavvyai describe services"
echo

echo "4. JSON format for automation:"
echo "   finsavvyai --output json describe nodes"
echo

echo "5. YAML format:"
echo "   finsavvyai --output yaml describe nodes"
echo

echo "6. Cluster overview:"
echo "   finsavvyai describe clusters"
echo

echo "7. Check running processes:"
echo "   lsof -i :8000  # Master service"
echo "   lsof -i :8001  # Worker service"
echo

echo "8. Network scanner (find other devices):"
echo "   python3 network_scanner.py"
echo

echo "💡 CURRENT STATUS:"
echo "=================="
finsavvyai describe services
echo

echo "🔍 ADDING MORE DEVICES:"
echo "======================"
echo "To add devices to your cluster:"
echo "1. On other computers: ./install_worker.sh"
echo "2. Or: curl -sSL https://raw.githubusercontent.com/finsavvyai/finsavvyai-cluster/master/install_worker.sh | bash"
echo "3. Then check: finsavvyai describe nodes --detailed"
echo
