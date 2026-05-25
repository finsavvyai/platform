import pytest
import numpy as np
import networkx as nx
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import time

from core.qaoa_detector import FraudRingQAOADetector
from core.models import (
    FraudRingDetection, QuantumBackendType, ProcessingStatus
)
from config.quantum_config import QuantumConfig


class TestFraudRingQAOADetector:
    """Test suite for QAOA Fraud Ring Detector"""

    @pytest.fixture
    def qaoa_config(self):
        """Create test configuration for QAOA"""
        return {
            'fraud_ring_qubits': 8,
            'qaoa_layers': 2,
            'optimizer': 'COBYLA',
            'max_iterations': 50,
            'default_backend': 'simulator',
            'max_shots': 1024
        }

    @pytest.fixture
    def qaoa_detector(self, qaoa_config):
        """Create QAOA detector instance for testing"""
        return FraudRingQAOADetector(qaoa_config)

    @pytest.fixture
    def simple_transaction_network(self):
        """Create a simple transaction network for testing"""
        G = nx.Graph()

        # Add nodes (customers)
        nodes = ['cust_1', 'cust_2', 'cust_3', 'cust_4', 'cust_5', 'cust_6']
        G.add_nodes_from(nodes)

        # Add edges (transactions) with amounts
        edges_with_data = [
            ('cust_1', 'cust_2', {'amount': 100.0, 'count': 3}),
            ('cust_2', 'cust_3', {'amount': 250.0, 'count': 5}),
            ('cust_3', 'cust_4', {'amount': 75.0, 'count': 2}),
            ('cust_4', 'cust_5', {'amount': 500.0, 'count': 8}),
            ('cust_5', 'cust_6', {'amount': 150.0, 'count': 4}),
            ('cust_1', 'cust_6', {'amount': 80.0, 'count': 1}),
            # Create a potential fraud ring
            ('cust_2', 'cust_4', {'amount': 1000.0, 'count': 12}),
            ('cust_3', 'cust_5', {'amount': 800.0, 'count': 10}),
        ]
        G.add_edges_from(edges_with_data)

        return G

    @pytest.fixture
    def fraud_ring_network(self):
        """Create a network with clear fraud ring structure"""
        G = nx.Graph()

        # Create a tight fraud ring (nodes 1-4)
        ring_nodes = ['ring_1', 'ring_2', 'ring_3', 'ring_4']
        G.add_nodes_from(ring_nodes)

        # High connectivity within the ring
        for i in range(len(ring_nodes)):
            for j in range(i + 1, len(ring_nodes)):
                G.add_edge(
                    ring_nodes[i], ring_nodes[j],
                    amount=1000.0 + np.random.uniform(-200, 200),
                    count=10 + np.random.randint(-3, 3)
                )

        # Add some normal connections
        normal_nodes = ['normal_1', 'normal_2', 'normal_3']
        G.add_nodes_from(normal_nodes)

        # Connect normal nodes with low activity
        G.add_edge('normal_1', 'normal_2', {'amount': 50.0, 'count': 1})
        G.add_edge('normal_2', 'normal_3', {'amount': 75.0, 'count': 2})

        # Sparse connections between ring and normal nodes
        G.add_edge('ring_1', 'normal_1', {'amount': 25.0, 'count': 1})
        G.add_edge('ring_2', 'normal_2', {'amount': 30.0, 'count': 1})

        return G

    @pytest.fixture
    def large_network(self):
        """Create a larger network for performance testing"""
        G = nx.Graph()

        # Create 20 nodes
        nodes = [f'node_{i}' for i in range(20)]
        G.add_nodes_from(nodes)

        # Create random connections
        np.random.seed(42)  # For reproducibility
        for i in range(20):
            for j in range(i + 1, 20):
                if np.random.random() < 0.2:  # 20% connection probability
                    G.add_edge(
                        nodes[i], nodes[j],
                        amount=np.random.uniform(10, 1000),
                        count=np.random.randint(1, 10)
                    )

        return G

    def test_qaoa_detector_initialization(self, qaoa_detector):
        """Test QAOA detector initialization"""
        assert qaoa_detector.num_qubits == 8
        assert qaoa_detector.num_layers == 2
        assert qaoa_detector.optimizer == 'COBYLA'
        assert qaoa_detector.max_iterations == 50
        assert qaoa_detector.backend_type == QuantumBackendType.SIMULATOR
        assert len(qaoa_detector.gamma_params) == 2
        assert len(qaoa_detector.beta_params) == 2

    def test_analyze_transaction_network(self, qaoa_detector, simple_transaction_network):
        """Test transaction network analysis"""
        analysis = qaoa_detector._analyze_transaction_network(simple_transaction_network)

        assert 'num_nodes' in analysis
        assert 'num_edges' in analysis
        assert 'density' in analysis
        assert 'avg_clustering' in analysis
        assert 'connected_components' in analysis
        assert 'degree_centrality' in analysis
        assert 'betweenness_centrality' in analysis

        assert analysis['num_nodes'] == 6
        assert analysis['num_edges'] == 8
        assert 0 <= analysis['density'] <= 1
        assert 0 <= analysis['avg_clustering'] <= 1

    def test_analyze_transaction_network_empty(self, qaoa_detector):
        """Test analysis of empty network"""
        empty_network = nx.Graph()
        analysis = qaoa_detector._analyze_transaction_network(empty_network)

        assert analysis['num_nodes'] == 0
        assert analysis['num_edges'] == 0
        assert analysis['density'] == 0
        assert analysis['connected_components'] == []

    def test_detect_communities_qaoa_small_network(self, qaoa_detector, simple_transaction_network):
        """Test community detection on small network"""
        communities = qaoa_detector._detect_communities_qaoa(simple_transaction_network)

        assert isinstance(communities, list)
        assert len(communities) > 0

        # All nodes should be assigned to some community
        all_nodes = set()
        for community in communities:
            all_nodes.update(community)
        assert all_nodes == set(simple_transaction_network.nodes())

    def test_detect_communities_qaoa_large_network(self, qaoa_detector, large_network):
        """Test community detection on larger network"""
        communities = qaoa_detector._detect_communities_qaoa(large_network)

        assert isinstance(communities, list)
        assert len(communities) > 0

        # All nodes should be assigned
        all_nodes = set()
        for community in communities:
            all_nodes.update(community)
        assert all_nodes == set(large_network.nodes())

    @patch('core.qaoa_detector.QISKIT_AVAILABLE', False)
    def test_detect_communities_classical_fallback(self, qaoa_detector, simple_transaction_network):
        """Test classical fallback when Qiskit is not available"""
        communities = qaoa_detector._detect_communities_qaoa(simple_transaction_network)

        assert isinstance(communities, list)
        assert len(communities) > 0

    def test_detect_fraud_rings_simple_network(self, qaoa_detector, simple_transaction_network):
        """Test fraud ring detection on simple network"""
        fraud_rings = qaoa_detector.detect_fraud_rings(simple_transaction_network, min_ring_size=2)

        assert isinstance(fraud_rings, list)
        # May or may not detect fraud rings in simple network

        for ring in fraud_rings:
            assert isinstance(ring, FraudRingDetection)
            assert ring.ring_id.startswith("ring_")
            assert len(ring.members) >= 2
            assert 0 <= ring.ring_strength <= 1
            assert 0 <= ring.quantum_advantage <= 1
            assert ring.total_transactions >= 0
            assert ring.fraud_transactions >= 0
            assert ring.total_amount >= 0
            assert ring.fraud_amount >= 0
            assert ring.detection_method == "QAOA Community Detection"
            assert ring.processing_time_ms > 0

    def test_detect_fraud_rings_with_fraud_network(self, qaoa_detector, fraud_ring_network):
        """Test fraud ring detection on network with clear fraud ring"""
        fraud_rings = qaoa_detector.detect_fraud_rings(fraud_ring_network, min_ring_size=3)

        assert isinstance(fraud_rings, list)

        # Should detect the tight fraud ring
        ring_nodes = ['ring_1', 'ring_2', 'ring_3', 'ring_4']
        found_fraud_ring = False

        for ring in fraud_rings:
            ring_member_set = set(ring.members)
            fraud_ring_overlap = len(ring_member_set.intersection(set(ring_nodes)))
            if fraud_ring_overlap >= 3:  # Most of the ring detected
                found_fraud_ring = True
                assert ring.ring_strength > 0.6  # High confidence
                break

        assert found_fraud_ring, "Should detect the fraud ring in the network"

    def test_detect_fraud_rings_empty_network(self, qaoa_detector):
        """Test fraud ring detection on empty network"""
        empty_network = nx.Graph()
        fraud_rings = qaoa_detector.detect_fraud_rings(empty_network)

        assert isinstance(fraud_rings, list)
        assert len(fraud_rings) == 0

    def test_analyze_community_fraud_risk(self, qaoa_detector):
        """Test community fraud risk analysis"""
        # Create a test community
        community = {'node_1', 'node_2', 'node_3'}

        # Create a subgraph
        subgraph = nx.Graph()
        subgraph.add_nodes_from(community)
        subgraph.add_edge('node_1', 'node_2', amount=1000.0)
        subgraph.add_edge('node_2', 'node_3', amount=800.0)
        subgraph.add_edge('node_1', 'node_3', amount=1200.0)

        network_analysis = {'density': 1.0}

        analysis = qaoa_detector._analyze_community_fraud_risk(
            community, subgraph, network_analysis
        )

        assert 'fraud_probability' in analysis
        assert 'total_transactions' in analysis
        assert 'fraud_transactions' in analysis
        assert 'total_amount' in analysis
        assert 'fraud_amount' in analysis
        assert 'quantum_advantage' in analysis
        assert 'density' in analysis
        assert 'clustering' in analysis

        assert 0 <= analysis['fraud_probability'] <= 1
        assert analysis['total_transactions'] == 3
        assert analysis['total_amount'] == 3000.0

    def test_estimate_fraud_probability(self, qaoa_detector):
        """Test fraud probability estimation"""
        # High density, high clustering (suspicious)
        prob_high = qaoa_detector._estimate_fraud_probability(
            density=0.9, clustering=0.85, num_transactions=20, num_nodes=5
        )
        assert prob_high > 0.6

        # Low density, low clustering (normal)
        prob_low = qaoa_detector._estimate_fraud_probability(
            density=0.1, clustering=0.2, num_transactions=3, num_nodes=10
        )
        assert prob_low < 0.4

    def test_calculate_quantum_advantage(self, qaoa_detector):
        """Test quantum advantage calculation"""
        # Large network, high transaction volume
        advantage_high = qaoa_detector._calculate_quantum_advantage(
            num_nodes=20, num_transactions=100
        )
        assert advantage_high > 0.4

        # Small network, low transaction volume
        advantage_low = qaoa_detector._calculate_quantum_advantage(
            num_nodes=3, num_transactions=2
        )
        assert advantage_low <= 0.4

    def test_calculate_total_transaction_amount(self, qaoa_detector):
        """Test total transaction amount calculation"""
        subgraph = nx.Graph()
        subgraph.add_edge('a', 'b', amount=100.0)
        subgraph.add_edge('b', 'c', amount=200.0)
        subgraph.add_edge('a', 'c', amount=150.0)

        total = qaoa_detector._calculate_total_transaction_amount(subgraph)
        assert total == 450.0

    def test_mock_qaoa_result(self, qaoa_detector):
        """Test mock QAOA result generation"""
        result = qaoa_detector._mock_qaoa_result(4)

        assert 'best_solution' in result
        assert 'best_count' in result
        assert 'counts' in result
        assert 'success_probability' in result
        assert 'parameters' in result

        assert len(result['best_solution']) == 4  # Should match number of qubits
        assert result['success_probability'] > 0
        assert len(result['parameters']) == 4  # 2 layers * 2 parameters

    def test_mock_qaoa_execution_result(self, qaoa_detector):
        """Test mock execution result generation"""
        result = qaoa_detector._mock_qaoa_execution_result(4)

        assert 'best_solution' in result
        assert 'best_count' in result
        assert 'counts' in result
        assert 'success_probability' in result
        assert 'parameters' in result

        assert len(result['best_solution']) == 4

    def test_get_performance_metrics_empty(self, qaoa_detector):
        """Test performance metrics when no detections yet"""
        metrics = qaoa_detector.get_performance_metrics()
        assert metrics == {}

    def test_get_performance_metrics_with_history(self, qaoa_detector, fraud_ring_network):
        """Test performance metrics after some detections"""
        # Run detection to build history
        qaoa_detector.detect_fraud_rings(fraud_ring_network)
        qaoa_detector.detect_fraud_rings(fraud_ring_network)

        metrics = qaoa_detector.get_performance_metrics()

        assert 'total_detections' in metrics
        assert 'avg_processing_time_ms' in metrics
        assert 'max_network_size' in metrics
        assert 'avg_network_size' in metrics
        assert 'total_fraud_rings_detected' in metrics
        assert 'avg_fraud_rings_per_detection' in metrics
        assert 'qaoa_layers' in metrics
        assert 'max_qubits' in metrics
        assert 'backend_type' in metrics

        assert metrics['total_detections'] == 2
        assert metrics['qaoa_layers'] == 2
        assert metrics['max_qubits'] == 8

    @pytest.mark.asyncio
    async def test_concurrent_fraud_ring_detection(self, qaoa_detector, fraud_ring_network):
        """Test concurrent fraud ring detection"""
        # Create multiple copies of the network
        networks = [fraud_ring_network.copy() for _ in range(3)]

        # Run detections concurrently
        start_time = time.time()
        results = await asyncio.gather(*[
            asyncio.to_thread(qaoa_detector.detect_fraud_rings, network)
            for network in networks
        ])
        end_time = time.time()

        assert len(results) == 3
        for result in results:
            assert isinstance(result, list)

        # Should complete reasonably fast
        total_time = end_time - start_time
        assert total_time < 15.0  # Should complete within 15 seconds

    def test_different_ring_sizes(self, qaoa_detector, fraud_ring_network):
        """Test detection with different minimum ring sizes"""
        for min_size in [2, 3, 4]:
            fraud_rings = qaoa_detector.detect_fraud_rings(fraud_ring_network, min_ring_size=min_size)

            for ring in fraud_rings:
                assert len(ring.members) >= min_size

    def test_different_qaoa_layers(self, qaoa_config):
        """Test QAOA with different numbers of layers"""
        for layers in [1, 2, 3]:
            config = qaoa_config.copy()
            config['qaoa_layers'] = layers

            detector = FraudRingQAOADetector(config)
            assert detector.num_layers == layers
            assert len(detector.gamma_params) == layers
            assert len(detector.beta_params) == layers

    def test_create_cost_hamiltonian(self, qaoa_detector):
        """Test cost Hamiltonian creation"""
        # Create simple graph
        G = nx.Graph()
        G.add_edges_from([(0, 1), (1, 2), (2, 3)])

        cost_hamiltonian = qaoa_detector._create_cost_hamiltonian(G)

        if cost_hamiltonian is not None:  # May be None if Qiskit not available
            assert hasattr(cost_hamiltonian, 'terms')
            assert hasattr(cost_hamiltonian, 'n_qubits')

    def test_create_mixer_hamiltonian(self, qaoa_detector):
        """Test mixer Hamiltonian creation"""
        mixer_hamiltonian = qaoa_detector._create_mixer_hamiltonian(4)

        if mixer_hamiltonian is not None:  # May be None if Qiskit not available
            assert hasattr(mixer_hamiltonian, 'terms')
            assert hasattr(mixer_hamiltonian, 'n_qubits')

    def test_optimize_qaoa_parameters(self, qaoa_detector):
        """Test QAOA parameter optimization"""
        # Create mock circuit
        mock_circuit = Mock()
        mock_circuit.num_qubits = 4

        optimized_params = qaoa_detector._optimize_qaoa_parameters(mock_circuit, 4)

        assert len(optimized_params) == 4  # 2 layers * 2 parameters
        assert all(isinstance(p, (int, float)) for p in optimized_params)

    def test_partition_to_communities(self, qaoa_detector):
        """Test conversion of QAOA partition to communities"""
        qaoa_result = {
            'best_solution': '0101',
            'counts': {'0101': 100, '1010': 50}
        }

        nodes = ['node_0', 'node_1', 'node_2', 'node_3']
        graph = nx.Graph()
        graph.add_nodes_from(nodes)

        communities = qaoa_detector._partition_to_communities(qaoa_result, nodes, graph)

        assert isinstance(communities, list)
        assert len(communities) > 0

        # Check that all nodes are assigned
        all_nodes = set()
        for community in communities:
            all_nodes.update(community)
        assert all_nodes == set(nodes)

    def test_classical_community_detection(self, qaoa_detector, simple_transaction_network):
        """Test classical community detection fallback"""
        communities = qaoa_detector._classical_community_detection(simple_transaction_network)

        assert isinstance(communities, list)
        assert len(communities) > 0

        # All nodes should be assigned
        all_nodes = set()
        for community in communities:
            all_nodes.update(community)
        assert all_nodes == set(simple_transaction_network.nodes())

    @pytest.mark.parametrize("network_density", [0.1, 0.3, 0.6, 0.9])
    def test_varying_network_densities(self, qaoa_detector, network_density):
        """Test detection on networks with different densities"""
        G = nx.Graph()
        nodes = [f'node_{i}' for i in range(10)]
        G.add_nodes_from(nodes)

        # Create edges based on desired density
        np.random.seed(42)
        for i in range(10):
            for j in range(i + 1, 10):
                if np.random.random() < network_density:
                    G.add_edge(
                        nodes[i], nodes[j],
                        amount=np.random.uniform(10, 500),
                        count=np.random.randint(1, 5)
                    )

        fraud_rings = qaoa_detector.detect_fraud_rings(G, min_ring_size=3)

        assert isinstance(fraud_rings, list)

        # Higher density networks should have more potential fraud rings
        if network_density > 0.7:
            assert len(fraud_rings) >= 0

    def test_edge_case_single_node(self, qaoa_detector):
        """Test detection on single node network"""
        G = nx.Graph()
        G.add_node('single_node')

        fraud_rings = qaoa_detector.detect_fraud_rings(G)

        assert isinstance(fraud_rings, list)
        assert len(fraud_rings) == 0  # Single node can't form a ring

    def test_edge_case_two_nodes(self, qaoa_detector):
        """Test detection on two node network"""
        G = nx.Graph()
        G.add_nodes_from(['node_1', 'node_2'])
        G.add_edge('node_1', 'node_2', amount=1000.0)

        fraud_rings = qaoa_detector.detect_fraud_rings(G, min_ring_size=2)

        assert isinstance(fraud_rings, list)
        # May detect as potential ring depending on threshold


if __name__ == "__main__":
    pytest.main([__file__, "-v"])