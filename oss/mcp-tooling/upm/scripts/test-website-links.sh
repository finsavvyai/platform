#!/bin/bash
# Test all website links

echo "🧪 Testing UPM Website Links"
echo "============================"
echo ""

BASE_URL="https://upm-website.pages.dev"

# Test each link
test_link() {
    local path=$1
    local url="${BASE_URL}${path}"
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    local title=$(curl -sL "$url" 2>/dev/null | grep -o '<title>[^<]*</title>' | sed 's/<title>//;s/<\/title>//' | head -1)
    
    if [ "$status" = "200" ]; then
        echo "✅ $path: $status - $title"
    else
        echo "❌ $path: $status"
    fi
}

echo "Testing links..."
echo ""
test_link "/"
test_link "/pricing"
test_link "/docs"
test_link "/about"
test_link "/blog"
echo ""
echo "✅ Link testing complete!"
