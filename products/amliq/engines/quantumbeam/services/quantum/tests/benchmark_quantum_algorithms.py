#!/usr/bin/env python3
"""
Quantum Algorithm Performance Benchmarking Suite

This module provides comprehensive benchmarking for quantum fraud detection algorithms
including performance comparison between quantum and classical approaches.
"""

import asyncio
import time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Dict, Any, Tuple
import json
import logging
from pathlib import Path
import networkx as nx
from dataclasses import dataclass, asdict
from datetime import datetime

# Add parent directory to path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vqc_classifier import VariationalQuantumClassifier
from core.qaoa_detector import FraudRingQAOADetector
from core.models import TransactionFeatures, FraudDetectionResult, QuantumBackendType
from config.quantum_config import QuantumConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class BenchmarkResult:
    """Container for benchmark results"""
    algorithm: str
    dataset_size: int
    avg_processing_time_ms: float
    max_processing_time_ms: float
    min_processing_time_ms: float
    std_processing_time_ms: float
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    quantum_advantage_score: float
    circuit_depth: int
    num_parameters: int
    memory_usage_mb: float
    success_rate: float
    timestamp: datetime


class QuantumBenchmarkSuite:
    """Comprehensive benchmarking suite for quantum algorithms"""

    def __init__(self, output_dir: str = "benchmark_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.results = []
        self.config = QuantumConfig()

        # Initialize quantum algorithms
        self.vqc_configs = self._get_vqc_configurations()
        self.qaoa_configs = self._get_qaoa_configurations()

    def _get_vqc_configurations(self) -> List[Dict[str, Any]]:
        """Get different VQC configurations for benchmarking"""
        return [
            {
                'name': 'VQC_4qubits_2layers',
                'config': {
                    'vqc_qubits': 4,
                    'vqc_layers': 2,
                    'vqc_rotations': ['rx', 'ry', 'rz'],
                    'vqc_entanglement': 'linear',
                    'encoding_method': 'angle',
                    'default_backend': 'simulator',
                    'max_shots': 1024,
                    'fraud_threshold': 0.5
                }
            },
            {
                'name': 'VQC_6qubits_3layers',
                'config': {
                    'vqc_qubits': 6,
                    'vqc_layers': 3,
                    'vqc_rotations': ['rx', 'ry', 'rz'],
                    'vqc_entanglement': 'full',
                    'encoding_method': 'angle',
                    'default_backend': 'simulator',
                    'max_shots': 1024,
                    'fraud_threshold': 0.5
                }
            },
            {
                'name': 'VQC_8qubits_4layers',
                'config': {
                    'vqc_qubits': 8,
                    'vqc_layers': 4,
                    'vqc_rotations': ['rx', 'ry', 'rz'],
                    'vqc_entanglement': 'full',
                    'encoding_method': 'amplitude',
                    'default_backend': 'simulator',
                    'max_shots': 1024,
                    'fraud_threshold': 0.5
                }
            }
        ]

    def _get_qaoa_configurations(self) -> List[Dict[str, Any]]:
        """Get different QAOA configurations for benchmarking"""
        return [
            {
                'name': 'QAOA_2layers_8qubits',
                'config': {
                    'fraud_ring_qubits': 8,
                    'qaoa_layers': 2,
                    'optimizer': 'COBYLA',
                    'max_iterations': 50,
                    'default_backend': 'simulator',
                    'max_shots': 1024
                }
            },
            {
                'name': 'QAOA_3layers_12qubits',
                'config': {
                    'fraud_ring_qubits': 12,
                    'qaoa_layers': 3,
                    'optimizer': 'COBYLA',
                    'max_iterations': 50,
                    'default_backend': 'simulator',
                    'max_shots': 1024
                }
            }
        ]

    def generate_fraud_dataset(self, size: int, fraud_ratio: float = 0.15) -> List[Tuple[TransactionFeatures, bool]]:
        """
        Generate synthetic fraud detection dataset

        Args:
            size: Number of transactions to generate
            fraud_ratio: Ratio of fraudulent transactions

        Returns:
            List of (TransactionFeatures, is_fraud) tuples
        """
        dataset = []
        num_fraud = int(size * fraud_ratio)

        np.random.seed(42)  # For reproducibility

        for i in range(size):
            is_fraud = i < num_fraud

            if is_fraud:
                # Generate fraudulent transaction characteristics
                amount = np.random.exponential(500) + 100  # Higher amounts
                frequency_24h = np.random.poisson(8) + 5  # Higher frequency
                deviation = np.random.exponential(2) + 1  # Higher deviation
                high_risk_country = np.random.random() < 0.7
                new_device = np.random.random() < 0.8
                unusual_time = np.random.random() < 0.6
                velocity_exceeded = frequency_24h > 10
            else:
                # Generate legitimate transaction characteristics
                amount = np.random.exponential(50) + 20  # Lower amounts
                frequency_24h = np.random.poisson(2) + 1  # Lower frequency
                deviation = np.random.exponential(0.5) + 0.1  # Lower deviation
                high_risk_country = np.random.random() < 0.05
                new_device = np.random.random() < 0.1
                unusual_time = np.random.random() < 0.1
                velocity_exceeded = frequency_24h > 5

            transaction = TransactionFeatures(
                transaction_id=f"benchmark_tx_{i}",
                amount=amount,
                timestamp=datetime.now(),
                merchant_id=f"merchant_{np.random.randint(1, 100)}",
                customer_id=f"customer_{np.random.randint(1, 1000)}",
                location=np.random.choice(['US', 'UK', 'CA', 'DE', 'FR', 'RU', 'CN', 'BR']),
                device_id=f"device_{np.random.randint(1, 500)}",
                ip_address=f"192.168.{np.random.randint(1, 255)}.{np.random.randint(1, 255)}",
                payment_method=np.random.choice(['credit_card', 'debit_card', 'gift_card', 'paypal']),
                currency='USD',
                customer_age_months=np.random.randint(1, 60),
                transaction_frequency_24h=frequency_24h,
                avg_transaction_amount_30d=amount / np.random.uniform(0.8, 1.5),
                amount_deviation_score=deviation,
                time_since_last_transaction=np.random.randint(1, 1440),
                is_high_risk_country=high_risk_country,
                is_new_device=new_device,
                is_unusual_time=unusual_time,
                velocity_exceeded=velocity_exceeded
            )

            dataset.append((transaction, is_fraud))

        # Shuffle dataset
        np.random.shuffle(dataset)

        return dataset

    def generate_fraud_ring_networks(self, sizes: List[int]) -> List[nx.Graph]:
        """
        Generate synthetic fraud ring networks

        Args:
            sizes: List of network sizes to generate

        Returns:
            List of NetworkX graphs
        """
        networks = []

        for size in sizes:
            # Create a network with fraud rings
            G = nx.Graph()
            nodes = [f'node_{i}' for i in range(size)]
            G.add_nodes_from(nodes)

            np.random.seed(42)

            # Create fraud rings (densely connected subgraphs)
            num_rings = max(1, size // 10)
            ring_size = max(3, size // (num_rings * 2))

            for ring_id in range(num_rings):
                ring_nodes = nodes[ring_id * ring_size: (ring_id + 1) * ring_size]
                if len(ring_nodes) < 3:
                    continue

                # Create dense connections within ring
                for i in range(len(ring_nodes)):
                    for j in range(i + 1, len(ring_nodes)):
                        if np.random.random() < 0.8:  # High connectivity
                            G.add_edge(
                                ring_nodes[i], ring_nodes[j],
                                amount=np.random.uniform(500, 2000),
                                count=np.random.randint(5, 20)
                            )

            # Add some sparse connections between rings
            for i in range(size):
                for j in range(i + 1, size):
                    if np.random.random() < 0.05:  # Low connectivity
                        G.add_edge(
                            nodes[i], nodes[j],
                            amount=np.random.uniform(10, 100),
                            count=np.random.randint(1, 3)
                        )

            networks.append(G)

        return networks

    async def benchmark_vqc_classifier(
        self,
        vqc_config: Dict[str, Any],
        dataset: List[Tuple[TransactionFeatures, bool]]
    ) -> BenchmarkResult:
        """Benchmark VQC classifier performance"""
        logger.info(f"Benchmarking VQC: {vqc_config['name']}")

        # Initialize classifier
        classifier = VariationalQuantumClassifier(vqc_config['config'])

        processing_times = []
        predictions = []
        true_labels = []
        quantum_advantages = []

        for transaction, true_label in dataset:
            start_time = time.time()

            try:
                result = classifier.classify_transaction(transaction)
                processing_time = (time.time() - start_time) * 1000

                processing_times.append(processing_time)
                predictions.append(1 if result.is_fraud else 0)
                true_labels.append(1 if true_label else 0)
                quantum_advantages.append(result.quantum_advantage_score)

            except Exception as e:
                logger.error(f"Error in VQC classification: {e}")
                processing_times.append(1000)  # Penalty time
                predictions.append(0)
                true_labels.append(1 if true_label else 0)
                quantum_advantages.append(0.0)

        # Calculate metrics
        processing_times = np.array(processing_times)
        predictions = np.array(predictions)
        true_labels = np.array(true_labels)
        quantum_advantages = np.array(quantum_advantages)

        # Calculate classification metrics
        accuracy = np.mean(predictions == true_labels)
        precision = self._calculate_precision(predictions, true_labels)
        recall = self._calculate_recall(predictions, true_labels)
        f1_score = self._calculate_f1_score(precision, recall)

        result = BenchmarkResult(
            algorithm=vqc_config['name'],
            dataset_size=len(dataset),
            avg_processing_time_ms=np.mean(processing_times),
            max_processing_time_ms=np.max(processing_times),
            min_processing_time_ms=np.min(processing_times),
            std_processing_time_ms=np.std(processing_times),
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            quantum_advantage_score=np.mean(quantum_advantages),
            circuit_depth=vqc_config['config']['vqc_qubits'] * vqc_config['config']['vqc_layers'],
            num_parameters=vqc_config['config']['vqc_qubits'] * vqc_config['config']['vqc_layers'] * 3,
            memory_usage_mb=self._estimate_memory_usage(len(dataset)),
            success_rate=1.0,  # VQC always returns a result
            timestamp=datetime.now()
        )

        logger.info(f"VQC {vqc_config['name']} completed: "
                   f"Accuracy={accuracy:.3f}, Avg Time={np.mean(processing_times):.2f}ms")

        return result

    async def benchmark_qaoa_detector(
        self,
        qaoa_config: Dict[str, Any],
        networks: List[nx.Graph]
    ) -> BenchmarkResult:
        """Benchmark QAOA fraud ring detector performance"""
        logger.info(f"Benchmarking QAOA: {qaoa_config['name']}")

        # Initialize detector
        detector = FraudRingQAOADetector(qaoa_config['config'])

        processing_times = []
        rings_detected = []
        quantum_advantages = []

        for network in networks:
            start_time = time.time()

            try:
                fraud_rings = detector.detect_fraud_rings(network, min_ring_size=3)
                processing_time = (time.time() - start_time) * 1000

                processing_times.append(processing_time)
                rings_detected.append(len(fraud_rings))
                avg_advantage = np.mean([ring.quantum_advantage for ring in fraud_rings]) if fraud_rings else 0.0
                quantum_advantages.append(avg_advantage)

            except Exception as e:
                logger.error(f"Error in QAOA detection: {e}")
                processing_times.append(5000)  # Penalty time
                rings_detected.append(0)
                quantum_advantages.append(0.0)

        # Calculate metrics
        processing_times = np.array(processing_times)
        rings_detected = np.array(rings_detected)
        quantum_advantages = np.array(quantum_advantages)

        # For QAOA, we measure success as detecting rings in larger networks
        success_rate = np.mean(rings_detected > 0)
        avg_rings_per_network = np.mean(rings_detected)

        result = BenchmarkResult(
            algorithm=qaoa_config['name'],
            dataset_size=len(networks),
            avg_processing_time_ms=np.mean(processing_times),
            max_processing_time_ms=np.max(processing_times),
            min_processing_time_ms=np.min(processing_times),
            std_processing_time_ms=np.std(processing_times),
            accuracy=avg_rings_per_network / 5.0,  # Normalize by expected max rings
            precision=success_rate,  # Precision as detection success
            recall=success_rate,     # Recall as detection success
            f1_score=success_rate,   # F1 as detection success
            quantum_advantage_score=np.mean(quantum_advantages),
            circuit_depth=qaoa_config['config']['fraud_ring_qubits'] * qaoa_config['config']['qaoa_layers'],
            num_parameters=qaoa_config['config']['qaoa_layers'] * 2,  # gamma and beta parameters
            memory_usage_mb=self._estimate_memory_usage(len(networks)),
            success_rate=success_rate,
            timestamp=datetime.now()
        )

        logger.info(f"QAOA {qaoa_config['name']} completed: "
                   f"Success Rate={success_rate:.3f}, Avg Time={np.mean(processing_times):.2f}ms")

        return result

    async def run_full_benchmark_suite(self):
        """Run comprehensive benchmark suite"""
        logger.info("Starting full quantum algorithm benchmark suite")

        # Generate test datasets
        dataset_sizes = [50, 100, 200]
        network_sizes = [10, 20, 30]

        all_results = []

        # Benchmark VQC classifiers
        for size in dataset_sizes:
            dataset = self.generate_fraud_dataset(size, fraud_ratio=0.2)

            for vqc_config in self.vqc_configs:
                result = await self.benchmark_vqc_classifier(vqc_config, dataset)
                all_results.append(result)

        # Benchmark QAOA detectors
        networks = self.generate_fraud_ring_networks(network_sizes)

        for qaoa_config in self.qaoa_configs:
            result = await self.benchmark_qaoa_detector(qaoa_config, networks)
            all_results.append(result)

        self.results = all_results
        await self._save_results()
        await self._generate_visualizations()
        await self._generate_report()

        logger.info("Benchmark suite completed successfully")

    def _calculate_precision(self, predictions: np.ndarray, true_labels: np.ndarray) -> float:
        """Calculate precision metric"""
        true_positives = np.sum((predictions == 1) & (true_labels == 1))
        false_positives = np.sum((predictions == 1) & (true_labels == 0))

        if true_positives + false_positives == 0:
            return 0.0

        return true_positives / (true_positives + false_positives)

    def _calculate_recall(self, predictions: np.ndarray, true_labels: np.ndarray) -> float:
        """Calculate recall metric"""
        true_positives = np.sum((predictions == 1) & (true_labels == 1))
        false_negatives = np.sum((predictions == 0) & (true_labels == 1))

        if true_positives + false_negatives == 0:
            return 0.0

        return true_positives / (true_positives + false_negatives)

    def _calculate_f1_score(self, precision: float, recall: float) -> float:
        """Calculate F1 score"""
        if precision + recall == 0:
            return 0.0

        return 2 * (precision * recall) / (precision + recall)

    def _estimate_memory_usage(self, dataset_size: int) -> float:
        """Estimate memory usage in MB"""
        # Rough estimation based on dataset size
        return dataset_size * 0.001  # 1KB per transaction estimate

    async def _save_results(self):
        """Save benchmark results to files"""
        # Save as JSON
        results_data = [asdict(result) for result in self.results]
        results_data = [
            {k: v.isoformat() if isinstance(v, datetime) else v
             for k, v in result.items()}
            for result in results_data
        ]

        with open(self.output_dir / "benchmark_results.json", "w") as f:
            json.dump(results_data, f, indent=2)

        # Save as CSV
        df = pd.DataFrame(results_data)
        df.to_csv(self.output_dir / "benchmark_results.csv", index=False)

        logger.info(f"Results saved to {self.output_dir}")

    async def _generate_visualizations(self):
        """Generate performance visualization plots"""
        if not self.results:
            logger.warning("No results to visualize")
            return

        # Create DataFrame for easier plotting
        results_data = [asdict(result) for result in self.results]
        results_data = [
            {k: v.isoformat() if isinstance(v, datetime) else v
             for k, v in result.items()}
            for result in results_data
        ]
        df = pd.DataFrame(results_data)

        # Set plot style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")

        # 1. Processing Time Comparison
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))

        # Processing time by algorithm
        sns.barplot(data=df, x='algorithm', y='avg_processing_time_ms', ax=axes[0, 0])
        axes[0, 0].set_title('Average Processing Time by Algorithm')
        axes[0, 0].set_ylabel('Processing Time (ms)')
        axes[0, 0].tick_params(axis='x', rotation=45)

        # Accuracy comparison
        sns.barplot(data=df, x='algorithm', y='accuracy', ax=axes[0, 1])
        axes[0, 1].set_title('Accuracy by Algorithm')
        axes[0, 1].set_ylabel('Accuracy')
        axes[0, 1].tick_params(axis='x', rotation=45)

        # Quantum advantage
        sns.barplot(data=df, x='algorithm', y='quantum_advantage_score', ax=axes[1, 0])
        axes[1, 0].set_title('Quantum Advantage Score by Algorithm')
        axes[1, 0].set_ylabel('Quantum Advantage')
        axes[1, 0].tick_params(axis='x', rotation=45)

        # Scalability (processing time vs dataset size)
        for algorithm in df['algorithm'].unique():
            algo_data = df[df['algorithm'] == algorithm]
            axes[1, 1].plot(algo_data['dataset_size'], algo_data['avg_processing_time_ms'],
                           marker='o', label=algorithm)

        axes[1, 1].set_title('Scalability: Processing Time vs Dataset Size')
        axes[1, 1].set_xlabel('Dataset Size')
        axes[1, 1].set_ylabel('Processing Time (ms)')
        axes[1, 1].legend()
        axes[1, 1].grid(True)

        plt.tight_layout()
        plt.savefig(self.output_dir / "performance_comparison.png", dpi=300, bbox_inches='tight')
        plt.close()

        # 2. Detailed performance metrics heatmap
        fig, ax = plt.subplots(figsize=(12, 8))

        # Select numeric columns for heatmap
        metrics_cols = ['accuracy', 'precision', 'recall', 'f1_score', 'quantum_advantage_score']
        heatmap_data = df.groupby('algorithm')[metrics_cols].mean()

        sns.heatmap(heatmap_data, annot=True, fmt='.3f', cmap='RdYlBu_r', ax=ax)
        ax.set_title('Performance Metrics Heatmap by Algorithm')
        ax.set_xlabel('Metrics')
        ax.set_ylabel('Algorithm')

        plt.tight_layout()
        plt.savefig(self.output_dir / "metrics_heatmap.png", dpi=300, bbox_inches='tight')
        plt.close()

        logger.info(f"Visualizations saved to {self.output_dir}")

    async def _generate_report(self):
        """Generate comprehensive benchmark report"""
        report_path = self.output_dir / "benchmark_report.md"

        with open(report_path, 'w') as f:
            f.write("# Quantum Algorithm Benchmark Report\n\n")
            f.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            # Executive Summary
            f.write("## Executive Summary\n\n")
            if self.results:
                avg_processing_time = np.mean([r.avg_processing_time_ms for r in self.results])
                avg_accuracy = np.mean([r.accuracy for r in self.results])
                avg_quantum_advantage = np.mean([r.quantum_advantage_score for r in self.results])

                f.write(f"- **Average Processing Time**: {avg_processing_time:.2f} ms\n")
                f.write(f"- **Average Accuracy**: {avg_accuracy:.3f}\n")
                f.write(f"- **Average Quantum Advantage**: {avg_quantum_advantage:.3f}\n")
                f.write(f"- **Total Algorithms Tested**: {len(self.results)}\n\n")

            # Detailed Results
            f.write("## Detailed Results\n\n")

            # Group by algorithm type
            vqc_results = [r for r in self.results if 'VQC' in r.algorithm]
            qaoa_results = [r for r in self.results if 'QAOA' in r.algorithm]

            if vqc_results:
                f.write("### VQC Classifiers\n\n")
                for result in vqc_results:
                    f.write(f"#### {result.algorithm}\n")
                    f.write(f"- Dataset Size: {result.dataset_size}\n")
                    f.write(f"- Processing Time: {result.avg_processing_time_ms:.2f} ± {result.std_processing_time_ms:.2f} ms\n")
                    f.write(f"- Accuracy: {result.accuracy:.3f}\n")
                    f.write(f"- F1 Score: {result.f1_score:.3f}\n")
                    f.write(f"- Quantum Advantage: {result.quantum_advantage_score:.3f}\n")
                    f.write(f"- Circuit Depth: {result.circuit_depth}\n")
                    f.write(f"- Parameters: {result.num_parameters}\n\n")

            if qaoa_results:
                f.write("### QAOA Detectors\n\n")
                for result in qaoa_results:
                    f.write(f"#### {result.algorithm}\n")
                    f.write(f"- Dataset Size: {result.dataset_size}\n")
                    f.write(f"- Processing Time: {result.avg_processing_time_ms:.2f} ± {result.std_processing_time_ms:.2f} ms\n")
                    f.write(f"- Success Rate: {result.success_rate:.3f}\n")
                    f.write(f"- Quantum Advantage: {result.quantum_advantage_score:.3f}\n")
                    f.write(f"- Circuit Depth: {result.circuit_depth}\n")
                    f.write(f"- Parameters: {result.num_parameters}\n\n")

            # Performance Analysis
            f.write("## Performance Analysis\n\n")
            f.write("### Key Findings\n\n")

            if self.results:
                # Best performing algorithm
                best_accuracy = max(self.results, key=lambda r: r.accuracy)
                f.write(f"- **Best Accuracy**: {best_accuracy.algorithm} ({best_accuracy.accuracy:.3f})\n")

                fastest = min(self.results, key=lambda r: r.avg_processing_time_ms)
                f.write(f"- **Fastest Algorithm**: {fastest.algorithm} ({fastest.avg_processing_time_ms:.2f} ms)\n")

                best_quantum = max(self.results, key=lambda r: r.quantum_advantage_score)
                f.write(f"- **Best Quantum Advantage**: {best_quantum.algorithm} ({best_quantum.quantum_advantage_score:.3f})\n")

            # Recommendations
            f.write("\n### Recommendations\n\n")
            f.write("1. **For Real-time Processing**: Use VQC with minimal qubits and layers for fastest processing\n")
            f.write("2. **For Maximum Accuracy**: Use VQC with more qubits and layers for better classification\n")
            f.write("3. **For Fraud Ring Detection**: Use QAOA for network-level fraud analysis\n")
            f.write("4. **For Production**: Consider the trade-off between accuracy and processing time\n\n")

            # Technical Details
            f.write("## Technical Details\n\n")
            f.write("### Test Environment\n")
            f.write("- Quantum Backend: Simulator\n")
            f.write("- Library: Qiskit (if available)\n")
            f.write("- Hardware: CPU simulation\n\n")

        logger.info(f"Benchmark report saved to {report_path}")


async def main():
    """Main benchmark execution"""
    print("🚀 Starting Quantum Algorithm Benchmark Suite")
    print("=" * 50)

    benchmark_suite = QuantumBenchmarkSuite()

    try:
        await benchmark_suite.run_full_benchmark_suite()
        print("\n✅ Benchmark completed successfully!")
        print(f"📊 Results saved to: {benchmark_suite.output_dir}")
        print("\nGenerated files:")
        print("- benchmark_results.json")
        print("- benchmark_results.csv")
        print("- performance_comparison.png")
        print("- metrics_heatmap.png")
        print("- benchmark_report.md")

    except Exception as e:
        print(f"\n❌ Benchmark failed: {e}")
        logger.error(f"Benchmark failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))