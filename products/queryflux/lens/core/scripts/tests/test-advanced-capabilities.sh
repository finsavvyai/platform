#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=========================================================${NC}"
echo -e "${GREEN}QueryLens Advanced Capabilities Test${NC}"
echo -e "${YELLOW}=========================================================${NC}"

API_URL="http://localhost:8085/api/query/execute"
# Default H2 datasource ID 
DATASOURCE_ID=1

# Function to run a query and display results
run_query() {
    local query="$1"
    local description="$2"
    
    echo -e "${YELLOW}Testing: ${description}${NC}"
    echo "Query: ${query}"
    
    # Use curl to send the query to the API in the correct format
    # NaturalQuery expects "text" field and "datasourceId" field
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"${query}\", \"datasourceId\": ${DATASOURCE_ID}}" \
        ${API_URL})
    
    # Extract the generated SQL from the response
    generatedSql=$(echo "$response" | jq -r '.generatedSql')
    intent=$(echo "$response" | jq -r '.debug.originalIntent // .originalQuery')
    
    # Print the results
    echo -e "${GREEN}Detected Intent:${NC} $intent"
    echo -e "${GREEN}Generated SQL:${NC} $generatedSql"
    echo -e "${YELLOW}=========================================================${NC}"
}

echo -e "\n${YELLOW}TESTING RANKING QUERIES${NC}"
# Test 1: Ranking Query - Top values
run_query "Show me the top 5 products by value" "Ranking Query - Top Values"

# Test 2: Ranking Query - Bottom values
run_query "What are the bottom 3 products in terms of value?" "Ranking Query - Bottom Values"

# Test 3: Ranking Query - By category
run_query "Rank the categories by total value" "Ranking Query - By Category"

echo -e "\n${YELLOW}TESTING PREDICTION QUERIES${NC}"
# Test 4: Prediction Query - Simple forecast
run_query "Predict sales for next month" "Prediction Query - Simple"

# Test 5: Prediction Query - With timeframe
run_query "Forecast the trend for the next 3 months" "Prediction Query - With Timeframe"

echo -e "\n${YELLOW}TESTING CORRELATION QUERIES${NC}"
# Test 6: Correlation Query - Between fields
run_query "Show me the correlation between category and value" "Correlation Query - Basic"

# Test 7: Correlation Query - Detailed analysis
run_query "Analyze the relationship between product categories and their values" "Correlation Query - Detailed"

echo -e "\n${GREEN}All tests completed!${NC}"
