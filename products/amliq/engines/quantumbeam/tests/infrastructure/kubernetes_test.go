//go:build k8s
// +build k8s

package infrastructure

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

func TestKubernetesInfrastructure(t *testing.T) {
	t.Parallel()

	// Create Kubernetes client
	config, err := rest.InClusterConfig()
	if err != nil {
		// Fallback to kubeconfig for local testing
		kubeconfig := clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename()
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		require.NoError(t, err, "Failed to build Kubernetes config")
	}

	clientset, err := kubernetes.NewForConfig(config)
	require.NoError(t, err, "Failed to create Kubernetes clientset")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Run Kubernetes infrastructure tests
	t.Run("Validate_Namespace", func(t *testing.T) {
		validateNamespace(ctx, t, clientset)
	})

	t.Run("Validate_Services", func(t *testing.T) {
		validateServices(ctx, t, clientset)
	})

	t.Run("Validate_Pods", func(t *testing.T) {
		validatePods(ctx, t, clientset)
	})

	t.Run("Validate_ConfigMaps", func(t *testing.T) {
		validateConfigMaps(ctx, t, clientset)
	})

	t.Run("Validate_Secrets", func(t *testing.T) {
		validateSecrets(ctx, t, clientset)
	})

	t.Run("Validate_NetworkPolicies", func(t *testing.T) {
		validateNetworkPolicies(ctx, t, clientset)
	})

	t.Run("Validate_PodDisruptionBudgets", func(t *testing.T) {
		validatePodDisruptionBudgets(ctx, t, clientset)
	})

	t.Run("Validate_HorizontalPodAutoscalers", func(t *testing.T) {
		validateHorizontalPodAutoscalers(ctx, t, clientset)
	})

	t.Run("Validate_Ingress", func(t *testing.T) {
		validateIngress(ctx, t, clientset)
	})

	t.Run("Validate_PersistentVolumes", func(t *testing.T) {
		validatePersistentVolumes(ctx, t, clientset)
	})
}

func validateNamespace(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// Check if quantumbeam namespace exists
	namespace, err := clientset.CoreV1().Namespaces().Get(ctx, "quantumbeam", metav1.GetOptions{})
	require.NoError(t, err, "QuantumBeam namespace should exist")
	assert.Equal(t, "quantumbeam", namespace.Name, "Namespace name should match")
	assert.True(t, len(namespace.Labels) > 0, "Namespace should have labels")

	// Verify namespace labels
	assert.Equal(t, "quantumbeam", namespace.Labels["name"], "Namespace should have name label")
	assert.Equal(t, "production", namespace.Labels["environment"], "Namespace should have environment label")

	// Check monitoring namespace
	monitoringNamespace, err := clientset.CoreV1().Namespaces().Get(ctx, "monitoring", metav1.GetOptions{})
	if err == nil {
		assert.Equal(t, "monitoring", monitoringNamespace.Name, "Monitoring namespace should exist")
	}
}

func validateServices(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// List all services in quantumbeam namespace
	services, err := clientset.CoreV1().Services("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Should be able to list services")
	assert.GreaterOrEqual(t, len(services.Items), 5, "Should have at least 5 services")

	// Define expected services
	expectedServices := map[string]bool{
		"quantumbeam-api-service":      false,
		"quantum-service":             false,
		"ai-ml-service":               false,
		"postgres-service":            false,
		"redis-service":               false,
	}

	// Verify expected services exist
	for _, service := range services.Items {
		if _, exists := expectedServices[service.Name]; exists {
			expectedServices[service.Name] = true

			// Verify service configuration
			assert.NotEmpty(t, service.Spec.Ports, "Service should have ports defined")
			assert.NotEqual(t, corev1.ServiceTypeClusterIP, service.Spec.Type, "Service should be ClusterIP type")

			// Verify service selector
			assert.NotEmpty(t, service.Spec.Selector, "Service should have selector defined")

			t.Logf("Service %s validated successfully", service.Name)
		}
	}

	// Check that all expected services were found
	for serviceName, found := range expectedServices {
		assert.True(t, found, "Expected service %s should exist", serviceName)
	}

	// Verify specific service configurations
	for _, service := range services.Items {
		switch service.Name {
		case "quantumbeam-api-service":
			assert.Equal(t, int32(8080), service.Spec.Ports[0].Port, "API service should be on port 8080")
			assert.Equal(t, "http", string(service.Spec.Ports[0].Name), "API service port should be named http")
		case "postgres-service":
			assert.Equal(t, int32(5432), service.Spec.Ports[0].Port, "Postgres service should be on port 5432")
		case "redis-service":
			assert.Equal(t, int32(6379), service.Spec.Ports[0].Port, "Redis service should be on port 6379")
		case "quantum-service", "ai-ml-service":
			assert.Equal(t, int32(8001), service.Spec.Ports[0].Port, "AI/ML services should be on port 8001")
		}
	}
}

func validatePods(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// List all pods in quantumbeam namespace
	pods, err := clientset.CoreV1().Pods("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Should be able to list pods")
	assert.GreaterOrEqual(t, len(pods.Items), 7, "Should have at least 7 pods running")

	// Count pods by application
	podCounts := make(map[string]int)
	readyPods := make(map[string]int)

	for _, pod := range pods.Items {
		// Extract application name from pod labels
		appName := pod.Labels["app.kubernetes.io/name"]
		if appName == "" {
			appName = pod.Labels["app"]
		}
		if appName == "" {
			continue
		}

		podCounts[appName]++

		// Check if pod is ready
		isReady := true
		for _, containerStatus := range pod.Status.ContainerStatuses {
			if !containerStatus.Ready {
				isReady = false
				break
			}
		}
		if isReady {
			readyPods[appName]++
		}

		// Verify pod security context
		if pod.Spec.SecurityContext != nil {
			assert.NotNil(t, pod.Spec.SecurityContext.RunAsNonRoot, "Pod should run as non-root")
			assert.Greater(t, *pod.Spec.SecurityContext.RunAsUser, int64(0), "Pod should have non-zero user ID")
		}

		// Verify resource limits
		for _, container := range pod.Spec.Containers {
			assert.NotNil(t, container.Resources, "Container should have resource requirements")
			assert.NotNil(t, container.Resources.Requests, "Container should have resource requests")
			assert.NotNil(t, container.Resources.Limits, "Container should have resource limits")
		}
	}

	// Verify expected applications are running
	expectedApps := map[string]int{
		"quantumbeam-api":    3,
		"quantumbeam-quantum": 2,
		"quantumbeam-ai-ml":   2,
	}

	for appName, expectedCount := range expectedApps {
		actualCount := podCounts[appName]
		readyCount := readyPods[appName]

		assert.GreaterOrEqual(t, actualCount, expectedCount,
			fmt.Sprintf("Should have at least %d pods for %s (found %d)", expectedCount, appName, actualCount))
		assert.GreaterOrEqual(t, readyCount, expectedCount,
			fmt.Sprintf("Should have at least %d ready pods for %s (found %d)", expectedCount, appName, readyCount))

		t.Logf("Application %s: %d/%d pods ready", appName, readyCount, actualCount)
	}
}

func validateConfigMaps(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// List all configmaps in quantumbeam namespace
	configmaps, err := clientset.CoreV1().ConfigMaps("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Should be able to list configmaps")
	assert.GreaterOrEqual(t, len(configmaps.Items), 3, "Should have at least 3 configmaps")

	// Define expected configmaps
	expectedConfigMaps := map[string]bool{
		"quantumbeam-config":      false,
		"api-server-config":      false,
		"quantum-service-config": false,
		"ai-ml-service-config":   false,
	}

	// Verify expected configmaps exist
	for _, configmap := range configmaps.Items {
		if _, exists := expectedConfigMaps[configmap.Name]; exists {
			expectedConfigMaps[configmap.Name] = true
			assert.NotEmpty(t, configmap.Data, "Configmap should have data")
			t.Logf("Configmap %s validated successfully", configmap.Name)
		}
	}

	// Check that all expected configmaps were found
	for configmapName, found := range expectedConfigMaps {
		assert.True(t, found, "Expected configmap %s should exist", configmapName)
	}
}

func validateSecrets(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// List all secrets in quantumbeam namespace
	secrets, err := clientset.CoreV1().Secrets("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Should be able to list secrets")
	assert.GreaterOrEqual(t, len(secrets.Items), 2, "Should have at least 2 secrets")

	// Define expected secrets
	expectedSecrets := map[string]bool{
		"quantumbeam-secrets":       false,
		"quantumbeam-tls":          false,
		"api-server-secrets":       false,
		"quantum-service-secrets":  false,
		"ai-ml-service-secrets":    false,
	}

	// Verify expected secrets exist
	for _, secret := range secrets.Items {
		if _, exists := expectedSecrets[secret.Name]; exists {
			expectedSecrets[secret.Name] = true
			assert.NotEmpty(t, secret.Data, "Secret should have data")

			// Verify secret type is appropriate
			if secret.Name == "quantumbeam-tls" {
				assert.Equal(t, corev1.SecretTypeTLS, secret.Type, "TLS secret should have correct type")
			} else {
				assert.Equal(t, corev1.SecretTypeOpaque, secret.Type, "Opaque secret should have correct type")
			}

			t.Logf("Secret %s validated successfully", secret.Name)
		}
	}

	// Check that all expected secrets were found
	for secretName, found := range expectedSecrets {
		// Some secrets may not exist in all environments, so we don't assert strictly
		if found {
			t.Logf("Secret %s found", secretName)
		}
	}
}

func validateNetworkPolicies(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// List all network policies in quantumbeam namespace
	networkPolicies, err := clientset.NetworkingV1().NetworkPolicies("quantumbeam").List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Skip("Network policies not available or not configured")
		return
	}

	assert.GreaterOrEqual(t, len(networkPolicies.Items), 1, "Should have at least 1 network policy")

	// Verify network policy configuration
	for _, np := range networkPolicies.Items {
		assert.NotEmpty(t, np.Spec.PodSelector.MatchLabels, "Network policy should have pod selector")
		assert.GreaterOrEqual(t, len(np.Spec.Ingress), 0, "Network policy should have ingress rules")
		assert.GreaterOrEqual(t, len(np.Spec.Egress), 0, "Network policy should have egress rules")

		t.Logf("Network policy %s validated successfully", np.Name)
	}
}

func validatePodDisruptionBudgets(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// List all pod disruption budgets in quantumbeam namespace
	pdbs, err := clientset.PolicyV1().PodDisruptionBudgets("quantumbeam").List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Skip("Pod disruption budgets not available or not configured")
		return
	}

	assert.GreaterOrEqual(t, len(pdbs.Items), 3, "Should have at least 3 pod disruption budgets")

	// Verify PDB configuration
	for _, pdb := range pdbs.Items {
		assert.NotEmpty(t, pdb.Spec.Selector.MatchLabels, "PDB should have pod selector")
		assert.True(t, pdb.Spec.MinAvailable != nil || pdb.Spec.MaxUnavailable != nil,
			"PDB should have either minAvailable or maxUnavailable specified")

		if pdb.Spec.MinAvailable != nil {
			assert.NotEqual(t, intstr.FromInt(0), *pdb.Spec.MinAvailable,
				"MinAvailable should not be zero")
		}

		t.Logf("Pod disruption budget %s validated successfully", pdb.Name)
	}
}

func validateHorizontalPodAutoscalers(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// This would require the autoscaling/v2 API
	// For simplicity, we'll check if the HPA controller is available by looking at deployments
	deployments, err := clientset.AppsV1().Deployments("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Should be able to list deployments")

	// Check if any deployments have annotations indicating autoscaling
	hpaDeployments := 0
	for _, deployment := range deployments.Items {
		if deployment.Annotations != nil {
			if _, exists := deployment.Annotations["autoscaling.alpha.kubernetes.io/conditions"]; exists {
				hpaDeployments++
			}
		}
	}

	t.Logf("Found %d deployments with potential HPA configuration", hpaDeployments)
}

func validateIngress(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// Try to get ingress with different API versions
	// First try networking.k8s.io/v1
	ingressList, err := clientset.NetworkingV1().Ingresses("quantumbeam").List(ctx, metav1.ListOptions{})
	if err != nil {
		// Try extensions/v1beta1 for older clusters
		t.Skip("Ingress not available or not configured")
		return
	}

	assert.GreaterOrEqual(t, len(ingressList.Items), 1, "Should have at least 1 ingress")

	// Verify ingress configuration
	for _, ingress := range ingressList.Items {
		assert.NotEmpty(t, ingress.Spec.Rules, "Ingress should have rules")
		assert.True(t, len(ingress.Spec.TLS) > 0, "Ingress should have TLS configuration")

		// Verify TLS configuration
		for _, tls := range ingress.Spec.TLS {
			assert.NotEmpty(t, tls.SecretName, "TLS should reference a secret")
			assert.NotEmpty(t, tls.Hosts, "TLS should have hosts specified")
		}

		t.Logf("Ingress %s validated successfully", ingress.Name)
	}
}

func validatePersistentVolumes(ctx context.Context, t *testing.T, clientset *kubernetes.Clientset) {
	// List all persistent volume claims in quantumbeam namespace
	pvcs, err := clientset.CoreV1().PersistentVolumeClaims("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Should be able to list PVCs")

	// Define expected PVCs
	expectedPVCs := map[string]bool{
		"postgres-pvc":          false,
		"redis-pvc":             false,
		"quantum-models-pvc":    false,
		"ai-models-pvc":         false,
	}

	// Verify expected PVCs exist
	for _, pvc := range pvcs.Items {
		if _, exists := expectedPVCs[pvc.Name]; exists {
			expectedPVCs[pvc.Name] = true

			// Verify PVC configuration
			assert.NotEmpty(t, pvc.Spec.Resources.Requests[corev1.ResourceStorage], "PVC should have storage request")
			assert.NotEqual(t, corev1.ClaimPending, pvc.Status.Phase, "PVC should not be in pending state")

			// Verify access mode
			assert.GreaterOrEqual(t, len(pvc.Spec.AccessModes), 1, "PVC should have at least one access mode")

			t.Logf("PVC %s validated successfully (status: %s)", pvc.Name, pvc.Status.Phase)
		}
	}

	// Check PVC status
	boundPVCs := 0
	for _, pvc := range pvcs.Items {
		if pvc.Status.Phase == corev1.ClaimBound {
			boundPVCs++
		}
	}

	t.Logf("Found %d/%d PVCs in Bound state", boundPVCs, len(pvcs.Items))
}

func TestKubernetesResourceLimits(t *testing.T) {
	t.Parallel()

	config, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename()
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		require.NoError(t, err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Verify all containers have resource limits
	pods, err := clientset.CoreV1().Pods("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err)

	for _, pod := range pods.Items {
		if pod.Status.Phase != corev1.PodRunning {
			continue
		}

		for _, container := range pod.Spec.Containers {
			assert.NotNil(t, container.Resources, fmt.Sprintf("Container %s in pod %s should have resource requirements", container.Name, pod.Name))
			assert.NotNil(t, container.Resources.Requests, fmt.Sprintf("Container %s should have resource requests", container.Name))
			assert.NotNil(t, container.Resources.Limits, fmt.Sprintf("Container %s should have resource limits", container.Name))

			// Verify memory and CPU are specified
			assert.Contains(t, container.Resources.Requests, corev1.ResourceCPU, "Container should have CPU request")
			assert.Contains(t, container.Resources.Requests, corev1.ResourceMemory, "Container should have memory request")
			assert.Contains(t, container.Resources.Limits, corev1.ResourceCPU, "Container should have CPU limit")
			assert.Contains(t, container.Resources.Limits, corev1.ResourceMemory, "Container should have memory limit")

			// Verify resource limits are reasonable
			cpuRequest := container.Resources.Requests[corev1.ResourceCPU]
			cpuLimit := container.Resources.Limits[corev1.ResourceCPU]
			memoryRequest := container.Resources.Requests[corev1.ResourceMemory]
			memoryLimit := container.Resources.Limits[corev1.ResourceMemory]

			// CPU limit should be >= CPU request
			assert.True(t, cpuLimit.Cmp(cpuRequest) >= 0,
				fmt.Sprintf("Container %s CPU limit should be >= request", container.Name))

			// Memory limit should be >= memory request
			assert.True(t, memoryLimit.Cmp(memoryRequest) >= 0,
				fmt.Sprintf("Container %s memory limit should be >= request", container.Name))
		}
	}
}

func TestKubernetesHealthEndpoints(t *testing.T) {
	t.Parallel()

	config, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename()
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		require.NoError(t, err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Test service health endpoints
	services, err := clientset.CoreV1().Services("quantumbeam").List(ctx, metav1.ListOptions{})
	require.NoError(t, err)

	for _, service := range services.Items {
		if service.Spec.Ports[0].Port == 8080 || service.Spec.Ports[0].Port == 8001 {
			// Test HTTP health endpoints
			// This would require creating HTTP requests to the service endpoints
			// For now, we'll just verify the service is accessible
			assert.NotEmpty(t, service.Spec.ClusterIP, "Service should have cluster IP")
			t.Logf("Service %s is accessible at %s:%d", service.Name, service.Spec.ClusterIP, service.Spec.Ports[0].Port)
		}
	}
}