#!/bin/bash

# UPM.Plus Production Health Check Script
# Domain: quantombean.io

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="quantombean.io"
NAMESPACE="upm-plus"
ENDPOINTS=(
    "https://quantombean.io"
    "https://www.quantombean.io"
    "https://api.quantombean.io/health"
    "https://app.quantombean.io"
    "https://dashboard.quantombean.io"
)

echo -e "${BLUE}🏥 UPM.Plus Production Health Check${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo ""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ]${NC} $1"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    print_error "curl is not installed or not in PATH"
    exit 1
fi

echo -e "${BLUE}=== Kubernetes Cluster Health ===${NC}"

# Check cluster connection
if kubectl cluster-info &> /dev/null; then
    print_status "Kubernetes cluster is accessible"
else
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

# Check namespace
if kubectl get namespace ${NAMESPACE} &> /dev/null; then
    print_status "Namespace '${NAMESPACE}' exists"
else
    print_error "Namespace '${NAMESPACE}' does not exist"
    exit 1
fi

# Check nodes
NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)
print_info "Cluster has ${NODE_COUNT} nodes"

# Check system pods
echo -e "\n${BLUE}=== System Components Health ===${NC}"

# Check ingress-nginx
if kubectl get deployment ingress-nginx-controller -n ingress-nginx &> /dev/null; then
    INGRESS_READY=$(kubectl get deployment ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    if [ "$INGRESS_READY" -gt 0 ]; then
        print_status "Ingress-Nginx controller is ready"

        # Get LoadBalancer IP
        LB_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "N/A")
        if [ "$LB_IP" != "N/A" ]; then
            print_info "LoadBalancer IP: ${LB_IP}"
        else
            print_warning "LoadBalancer IP not yet assigned"
        fi
    else
        print_error "Ingress-Nginx controller is not ready"
    fi
else
    print_error "Ingress-Nginx controller not found"
fi

# Check cert-manager
if kubectl get deployment cert-manager -n cert-manager &> /dev/null; then
    CERT_READY=$(kubectl get deployment cert-manager -n cert-manager -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    if [ "$CERT_READY" -gt 0 ]; then
        print_status "Cert-manager is ready"
    else
        print_error "Cert-manager is not ready"
    fi
else
    print_error "Cert-manager not found"
fi

echo -e "\n${BLUE}=== Application Components Health ===${NC}"

# Check application pods
echo "Checking pods in namespace '${NAMESPACE}':"
kubectl get pods -n ${NAMESPACE} --no-headers | while read line; do
    POD_NAME=$(echo $line | awk '{print $1}')
    POD_STATUS=$(echo $line | awk '{print $3}')
    POD_READY=$(echo $line | awk '{print $2}')

    if [[ "$POD_STATUS" == "Running" && "$POD_READY" == "1/1" ]]; then
        print_status "Pod ${POD_NAME} is running and ready"
    elif [[ "$POD_STATUS" == "Running" ]]; then
        print_warning "Pod ${POD_NAME} is running but not ready (${POD_READY})"
    else
        print_error "Pod ${POD_NAME} status: ${POD_STATUS}"
    fi
done

# Check services
echo -e "\n${BLUE}=== Services Health ===${NC}"
kubectl get services -n ${NAMESPACE} --no-headers | while read line; do
    SVC_NAME=$(echo $line | awk '{print $1}')
    SVC_TYPE=$(echo $line | awk '{print $2}')
    SVC_CLUSTER_IP=$(echo $line | awk '{print $3}')
    SVC_EXTERNAL_IP=$(echo $line | awk '{print $4}')
    SVC_PORTS=$(echo $line | awk '{print $5}')

    print_info "Service ${SVC_NAME} (${SVC_TYPE}) - ${SVC_PORTS}"
    if [ "$SVC_EXTERNAL_IP" != "<none>" ] && [ "$SVC_EXTERNAL_IP" != "" ]; then
        print_info "  External IP: ${SVC_EXTERNAL_IP}"
    fi
done

# Check SSL certificates
echo -e "\n${BLUE}=== SSL Certificates ===${NC}"
if kubectl get certificate upm-plus-production-wildcard -n ${NAMESPACE} &> /dev/null; then
    CERT_STATUS=$(kubectl get certificate upm-plus-production-wildcard -n ${NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
    if [ "$CERT_STATUS" == "True" ]; then
        print_status "SSL certificate is ready and valid"

        # Get certificate expiration
        CERT_EXPIRY=$(kubectl get certificate upm-plus-production-wildcard -n ${NAMESPACE} -o jsonpath='{.status.notAfter}' 2>/dev/null || echo "Unknown")
        if [ "$CERT_EXPIRY" != "Unknown" ]; then
            print_info "Certificate expires: ${CERT_EXPIRY}"
        fi
    else
        print_error "SSL certificate is not ready"

        # Show certificate details
        echo "Certificate details:"
        kubectl describe certificate upm-plus-production-wildcard -n ${NAMESPACE} | grep -E "(Status|Reason|Message)"
    fi
else
    print_error "SSL certificate not found"
fi

# Check ingress
echo -e "\n${BLUE}=== Ingress Configuration ===${NC}"
if kubectl get ingress upm-plus-production-ingress -n ${NAMESPACE} &> /dev/null; then
    INGRESS_HOSTS=$(kubectl get ingress upm-plus-production-ingress -n ${NAMESPACE} -o jsonpath='{.spec.rules[*].host}')
    print_status "Ingress is configured for hosts: ${INGRESS_HOSTS}"

    # Check ingress address
    INGRESS_ADDRESS=$(kubectl get ingress upm-plus-production-ingress -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "N/A")
    if [ "$INGRESS_ADDRESS" != "N/A" ]; then
        print_info "Ingress address: ${INGRESS_ADDRESS}"
    fi
else
    print_error "Ingress not found"
fi

# Test endpoints
echo -e "\n${BLUE}=== Endpoint Accessibility Tests ===${NC}"

FAILED_ENDPOINTS=0
for endpoint in "${ENDPOINTS[@]}"; do
    echo -n "Testing ${endpoint}... "

    # Use curl with timeout and follow redirects
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -L "${endpoint}" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        print_status "${endpoint} - HTTP ${HTTP_STATUS}"
    elif [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
        print_status "${endpoint} - HTTP ${HTTP_STATUS} (redirect)"
    elif [ "$HTTP_STATUS" = "403" ]; then
        print_warning "${endpoint} - HTTP ${HTTP_STATUS} (forbidden - may be expected)"
    elif [ "$HTTP_STATUS" = "404" ]; then
        print_warning "${endpoint} - HTTP ${HTTP_STATUS} (not found - may be expected)"
    elif [ "$HTTP_STATUS" = "000" ]; then
        print_error "${endpoint} - Connection failed"
        ((FAILED_ENDPOINTS++))
    else
        print_error "${endpoint} - HTTP ${HTTP_STATUS}"
        ((FAILED_ENDPOINTS++))
    fi
done

# Check resource usage
echo -e "\n${BLUE}=== Resource Usage ===${NC}"

# Check node resources
echo "Node resource usage:"
kubectl top nodes 2>/dev/null || print_warning "Metrics server not available"

# Check pod resources
echo "Pod resource usage:"
kubectl top pods -n ${NAMESPACE} 2>/dev/null || print_warning "Metrics server not available"

# Check storage
echo -e "\nStorage usage:"
kubectl get pvc -n ${NAMESPACE} --no-headers | while read line; do
    PVC_NAME=$(echo $line | awk '{print $1}')
    PVC_STATUS=$(echo $line | awk '{print $2}')
    PVC_CAPACITY=$(echo $line | awk '{print $4}')

    if [ "$PVC_STATUS" = "Bound" ]; then
        print_status "PVC ${PVC_NAME}: ${PVC_CAPACITY} (${PVC_STATUS})"
    else
        print_warning "PVC ${PVC_NAME}: ${PVC_CAPACITY} (${PVC_STATUS})"
    fi
done

# Summary
echo -e "\n${BLUE}=== Health Check Summary ===${NC}"

TOTAL_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers | wc -l)
READY_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers | awk '{if ($3=="Running") print}' | wc -l)

print_info "Total pods: ${TOTAL_PODS}"
print_info "Ready pods: ${READY_PODS}"
print_info "Failed endpoints: ${FAILED_ENDPOINTS}"

if [ ${READY_PODS} -eq ${TOTAL_PODS} ] && [ ${FAILED_ENDPOINTS} -eq 0 ]; then
    echo -e "\n${GREEN}🎉 Overall Health: HEALTHY${NC}"
    echo -e "${GREEN}UPM.Plus is running successfully at https://${DOMAIN}${NC}"
    exit 0
elif [ ${READY_PODS} -gt 0 ] && [ ${FAILED_ENDPOINTS} -lt 3 ]; then
    echo -e "\n${YELLOW}⚠️ Overall Health: DEGRADED${NC}"
    echo -e "${YELLOW}Some components may not be fully functional${NC}"
    exit 1
else
    echo -e "\n${RED}❌ Overall Health: UNHEALTHY${NC}"
    echo -e "${RED}Multiple issues detected - see details above${NC}"
    exit 2
fi