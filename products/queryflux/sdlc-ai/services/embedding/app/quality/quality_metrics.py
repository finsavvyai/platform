"""
Quality metrics for embedding validation.

This module provides comprehensive quality metrics and scoring functions
for evaluating embedding quality and consistency.
"""

import math
import statistics
from typing import List, Optional, Tuple

import numpy as np
from scipy.spatial.distance import cosine
from scipy.stats import entropy, zscore


class QualityMetrics:
    """Comprehensive quality metrics for embedding validation."""

    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.

        Args:
            vec1: First embedding vector
            vec2: Second embedding vector

        Returns:
            Cosine similarity score (-1 to 1)
        """
        try:
            # Convert to numpy arrays
            v1 = np.array(vec1, dtype=np.float32)
            v2 = np.array(vec2, dtype=np.float32)

            # Calculate cosine similarity
            dot_product = np.dot(v1, v2)
            norm_v1 = np.linalg.norm(v1)
            norm_v2 = np.linalg.norm(v2)

            if norm_v1 == 0 or norm_v2 == 0:
                return 0.0

            return dot_product / (norm_v1 * norm_v2)

        except Exception:
            return 0.0

    @staticmethod
    def euclidean_distance(vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate Euclidean distance between two vectors.

        Args:
            vec1: First embedding vector
            vec2: Second embedding vector

        Returns:
            Euclidean distance
        """
        try:
            v1 = np.array(vec1, dtype=np.float32)
            v2 = np.array(vec2, dtype=np.float32)
            return np.linalg.norm(v1 - v2)
        except Exception:
            return float("inf")

    @staticmethod
    def manhattan_distance(vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate Manhattan distance between two vectors.

        Args:
            vec1: First embedding vector
            vec2: Second embedding vector

        Returns:
            Manhattan distance
        """
        try:
            v1 = np.array(vec1, dtype=np.float32)
            v2 = np.array(vec2, dtype=np.float32)
            return np.sum(np.abs(v1 - v2))
        except Exception:
            return float("inf")

    @staticmethod
    def embedding_variance(embeddings: List[List[float]]) -> float:
        """
        Calculate variance across embedding dimensions.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Average variance across dimensions
        """
        if not embeddings:
            return 0.0

        try:
            # Convert to numpy array
            embedding_matrix = np.array(embeddings, dtype=np.float32)

            # Calculate variance for each dimension
            dimension_variances = np.var(embedding_matrix, axis=0)

            # Return average variance
            return float(np.mean(dimension_variances))

        except Exception:
            return 0.0

    @staticmethod
    def embedding_std_dev(embeddings: List[List[float]]) -> float:
        """
        Calculate standard deviation across embedding dimensions.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Average standard deviation across dimensions
        """
        if not embeddings:
            return 0.0

        try:
            # Convert to numpy array
            embedding_matrix = np.array(embeddings, dtype=np.float32)

            # Calculate std dev for each dimension
            dimension_stds = np.std(embedding_matrix, axis=0)

            # Return average std dev
            return float(np.mean(dimension_stds))

        except Exception:
            return 0.0

    @staticmethod
    def embedding_norm(embedding: List[float]) -> float:
        """
        Calculate L2 norm of an embedding vector.

        Args:
            embedding: Embedding vector

        Returns:
            L2 norm
        """
        try:
            vec = np.array(embedding, dtype=np.float32)
            return float(np.linalg.norm(vec))
        except Exception:
            return 0.0

    @staticmethod
    def embedding_magnitude(embedding: List[float]) -> float:
        """
        Calculate magnitude (sum of absolute values) of an embedding.

        Args:
            embedding: Embedding vector

        Returns:
            Magnitude
        """
        try:
            return float(sum(abs(x) for x in embedding))
        except Exception:
            return 0.0

    @staticmethod
    def pairwise_similarity_matrix(embeddings: List[List[float]]) -> List[List[float]]:
        """
        Calculate pairwise similarity matrix for embeddings.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Similarity matrix
        """
        n = len(embeddings)
        if n == 0:
            return []

        matrix = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(i, n):
                similarity = QualityMetrics.cosine_similarity(
                    embeddings[i], embeddings[j]
                )
                matrix[i][j] = similarity
                matrix[j][i] = similarity

        return matrix

    @staticmethod
    def average_pairwise_similarity(embeddings: List[List[float]]) -> float:
        """
        Calculate average pairwise similarity among embeddings.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Average pairwise similarity
        """
        if len(embeddings) < 2:
            return 1.0

        similarity_matrix = QualityMetrics.pairwise_similarity_matrix(embeddings)

        # Calculate average of upper triangle (excluding diagonal)
        total_similarity = 0.0
        count = 0

        for i in range(len(embeddings)):
            for j in range(i + 1, len(embeddings)):
                total_similarity += similarity_matrix[i][j]
                count += 1

        return total_similarity / count if count > 0 else 0.0

    @staticmethod
    def clustering_coefficient(
        embeddings: List[List[float]], threshold: float = 0.8
    ) -> float:
        """
        Calculate clustering coefficient based on similarity threshold.

        Args:
            embeddings: List of embedding vectors
            threshold: Similarity threshold for clustering

        Returns:
            Clustering coefficient (0-1)
        """
        if len(embeddings) < 3:
            return 0.0

        similarity_matrix = QualityMetrics.pairwise_similarity_matrix(embeddings)
        n = len(embeddings)

        # Build adjacency matrix based on threshold
        adj_matrix = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(i + 1, n):
                if similarity_matrix[i][j] >= threshold:
                    adj_matrix[i][j] = 1
                    adj_matrix[j][i] = 1

        # Calculate clustering coefficient
        total_coefficient = 0.0
        valid_nodes = 0

        for i in range(n):
            neighbors = [j for j in range(n) if i != j and adj_matrix[i][j] == 1]
            k = len(neighbors)

            if k >= 2:
                # Count edges between neighbors
                neighbor_edges = 0
                for j in range(k):
                    for l in range(j + 1, k):
                        if adj_matrix[neighbors[j]][neighbors[l]] == 1:
                            neighbor_edges += 1

                # Calculate local clustering coefficient
                total_coefficient += (2 * neighbor_edges) / (k * (k - 1))
                valid_nodes += 1

        return total_coefficient / valid_nodes if valid_nodes > 0 else 0.0

    @staticmethod
    def spectral_analysis(embeddings: List[List[float]]) -> Dict[str, float]:
        """
        Perform spectral analysis on embeddings.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Spectral metrics
        """
        if not embeddings:
            return {
                "mean_eigenvalue": 0.0,
                "max_eigenvalue": 0.0,
                "condition_number": 0.0,
            }

        try:
            # Convert to numpy array
            embedding_matrix = np.array(embeddings, dtype=np.float32)

            # Calculate covariance matrix
            cov_matrix = np.cov(embedding_matrix.T)

            # Calculate eigenvalues
            eigenvalues = np.linalg.eigvals(cov_matrix)
            eigenvalues = np.real(eigenvalues)  # Take real part

            # Calculate spectral metrics
            mean_eigenvalue = float(np.mean(eigenvalues))
            max_eigenvalue = float(np.max(eigenvalues))
            min_eigenvalue = float(
                np.min(eigenvalues[eigenvalues > 0])
            )  # Positive eigenvalues only

            condition_number = (
                max_eigenvalue / min_eigenvalue if min_eigenvalue > 0 else float("inf")
            )

            return {
                "mean_eigenvalue": mean_eigenvalue,
                "max_eigenvalue": max_eigenvalue,
                "min_eigenvalue": min_eigenvalue,
                "condition_number": condition_number,
                "spectral_radius": max_eigenvalue,
                "trace": float(np.trace(cov_matrix)),
            }

        except Exception as e:
            return {
                "mean_eigenvalue": 0.0,
                "max_eigenvalue": 0.0,
                "min_eigenvalue": 0.0,
                "condition_number": 0.0,
                "error": str(e),
            }

    @staticmethod
    def entropy_analysis(
        embeddings: List[List[float]], bins: int = 50
    ) -> Dict[str, float]:
        """
        Perform entropy analysis on embeddings.

        Args:
            embeddings: List of embedding vectors
            bins: Number of bins for histogram

        Returns:
            Entropy metrics
        """
        if not embeddings:
            return {
                "mean_entropy": 0.0,
                "total_entropy": 0.0,
                "normalized_entropy": 0.0,
            }

        try:
            # Convert to numpy array
            embedding_matrix = np.array(embeddings, dtype=np.float32)

            # Calculate entropy for each dimension
            dimension_entropies = []

            for dim in range(embedding_matrix.shape[1]):
                values = embedding_matrix[:, dim]

                # Create histogram
                hist, _ = np.histogram(values, bins=bins, density=True)

                # Calculate entropy (avoid log(0))
                hist_nonzero = hist[hist > 0]
                dim_entropy = -np.sum(hist_nonzero * np.log2(hist_nonzero))
                dimension_entropies.append(dim_entropy)

            # Calculate overall metrics
            mean_entropy = float(np.mean(dimension_entropies))
            total_entropy = float(np.sum(dimension_entropies))
            max_entropy = float(np.log2(bins))  # Maximum possible entropy

            normalized_entropy = mean_entropy / max_entropy if max_entropy > 0 else 0.0

            return {
                "mean_entropy": mean_entropy,
                "total_entropy": total_entropy,
                "normalized_entropy": normalized_entropy,
                "max_entropy": max_entropy,
                "dimension_entropies": dimension_entropies,
            }

        except Exception as e:
            return {
                "mean_entropy": 0.0,
                "total_entropy": 0.0,
                "normalized_entropy": 0.0,
                "error": str(e),
            }

    @staticmethod
    def quality_score_comprehensive(
        embeddings: List[List[float]],
        reference_embeddings: Optional[List[List[float]]] = None,
    ) -> Dict[str, float]:
        """
        Calculate comprehensive quality score for embeddings.

        Args:
            embeddings: List of embedding vectors to evaluate
            reference_embeddings: Reference embeddings for comparison

        Returns:
            Comprehensive quality metrics
        """
        if not embeddings:
            return {"overall_score": 0.0}

        metrics = {}

        # Basic statistical metrics
        metrics["variance"] = QualityMetrics.embedding_variance(embeddings)
        metrics["std_dev"] = QualityMetrics.embedding_std_dev(embeddings)
        metrics["average_norm"] = np.mean(
            [QualityMetrics.embedding_norm(emb) for emb in embeddings]
        )

        # Similarity metrics
        metrics["average_pairwise_similarity"] = (
            QualityMetrics.average_pairwise_similarity(embeddings)
        )
        metrics["clustering_coefficient"] = QualityMetrics.clustering_coefficient(
            embeddings
        )

        # Spectral analysis
        spectral_metrics = QualityMetrics.spectral_analysis(embeddings)
        metrics.update(spectral_metrics)

        # Entropy analysis
        entropy_metrics = QualityMetrics.entropy_analysis(embeddings)
        metrics.update(entropy_metrics)

        # Reference comparison if provided
        if reference_embeddings:
            # Calculate average similarity to reference embeddings
            ref_similarities = []
            for emb in embeddings:
                max_ref_similarity = max(
                    QualityMetrics.cosine_similarity(emb, ref_emb)
                    for ref_emb in reference_embeddings
                )
                ref_similarities.append(max_ref_similarity)

            metrics["reference_similarity"] = np.mean(ref_similarities)

        # Calculate overall quality score (0-1)
        overall_score = 0.0

        # Variance contribution (good variance indicates spread)
        variance_score = min(metrics["variance"] * 10, 1.0)  # Normalize to 0-1
        overall_score += variance_score * 0.2

        # Similarity contribution (moderate similarity indicates good clustering)
        similarity_score = metrics["average_pairwise_similarity"]
        overall_score += similarity_score * 0.3

        # Clustering contribution
        clustering_score = metrics["clustering_coefficient"]
        overall_score += clustering_score * 0.2

        # Entropy contribution (normalized entropy)
        entropy_score = metrics.get("normalized_entropy", 0.0)
        overall_score += entropy_score * 0.2

        # Reference similarity contribution
        if "reference_similarity" in metrics:
            ref_score = metrics["reference_similarity"]
            overall_score += ref_score * 0.1

        metrics["overall_score"] = min(overall_score, 1.0)

        return metrics

    @staticmethod
    def detect_outliers(
        embeddings: List[List[float]],
        method: str = "zscore",
        threshold: float = 2.0,
    ) -> List[int]:
        """
        Detect outlier embeddings.

        Args:
            embeddings: List of embedding vectors
            method: Outlier detection method ("zscore", "iqr", "isolation")
            threshold: Threshold for outlier detection

        Returns:
            List of outlier indices
        """
        if len(embeddings) < 3:
            return []

        outlier_indices = []

        try:
            if method == "zscore":
                # Use z-score based detection
                embedding_matrix = np.array(embeddings, dtype=np.float32)

                # Calculate average pairwise similarities
                similarities = []
                for i, emb in enumerate(embeddings):
                    other_similarities = [
                        QualityMetrics.cosine_similarity(emb, other_emb)
                        for j, other_emb in enumerate(embeddings)
                        if i != j
                    ]
                    avg_similarity = np.mean(other_similarities)
                    similarities.append(avg_similarity)

                # Calculate z-scores
                similarity_array = np.array(similarities)
                z_scores = np.abs(zscore(similarity_array))

                outlier_indices = [
                    i for i, z_score in enumerate(z_scores) if z_score > threshold
                ]

            elif method == "iqr":
                # Use interquartile range
                embedding_matrix = np.array(embeddings, dtype=np.float32)

                # Calculate distances from centroid
                centroid = np.mean(embedding_matrix, axis=0)
                distances = [
                    QualityMetrics.euclidean_distance(emb.tolist(), centroid.tolist())
                    for emb in embeddings
                ]

                # Calculate IQR
                q1 = np.percentile(distances, 25)
                q3 = np.percentile(distances, 75)
                iqr = q3 - q1

                outlier_threshold = q3 + threshold * iqr

                outlier_indices = [
                    i
                    for i, distance in enumerate(distances)
                    if distance > outlier_threshold
                ]

            elif method == "isolation":
                # Simple isolation forest-like approach
                # For embeddings, we can use distance-based isolation
                embedding_matrix = np.array(embeddings, dtype=np.float32)

                # Calculate k-nearest neighbor distances
                k = min(5, len(embeddings) - 1)
                knn_distances = []

                for i, emb in enumerate(embeddings):
                    distances = [
                        QualityMetrics.euclidean_distance(
                            emb.tolist(), other_emb.tolist()
                        )
                        for j, other_emb in enumerate(embeddings)
                        if i != j
                    ]
                    distances.sort()
                    avg_knn_distance = np.mean(distances[:k])
                    knn_distances.append(avg_knn_distance)

                # Use threshold on k-NN distances
                distance_threshold = np.percentile(knn_distances, 90) * threshold

                outlier_indices = [
                    i
                    for i, distance in enumerate(knn_distances)
                    if distance > distance_threshold
                ]

        except Exception as e:
            print(f"Error in outlier detection: {e}")

        return outlier_indices

    @staticmethod
    def benchmark_quality(
        test_embeddings: List[List[float]],
        reference_embeddings: List[List[float]],
    ) -> Dict[str, float]:
        """
               Benchmark quality of test embeddings against reference.

        Args:
                   test_embeddings: Test embeddings to evaluate
                   reference_embeddings: Reference embeddings

               Returns:
                   Benchmark metrics
        """
        if not test_embeddings or not reference_embeddings:
            return {"overall_benchmark_score": 0.0}

        # Calculate quality scores for both sets
        test_quality = QualityMetrics.quality_score_comprehensive(test_embeddings)
        ref_quality = QualityMetrics.quality_score_comprehensive(reference_embeddings)

        # Calculate relative metrics
        metrics = {}

        # Overall quality comparison
        test_score = test_quality.get("overall_score", 0.0)
        ref_score = ref_quality.get("overall_score", 0.0)

        if ref_score > 0:
            metrics["quality_ratio"] = test_score / ref_score
        else:
            metrics["quality_ratio"] = 0.0

        # Similarity preservation
        test_similarity = test_quality.get("average_pairwise_similarity", 0.0)
        ref_similarity = ref_quality.get("average_pairwise_similarity", 0.0)

        if ref_similarity > 0:
            metrics["similarity_preservation"] = test_similarity / ref_similarity
        else:
            metrics["similarity_preservation"] = 0.0

        # Variance preservation
        test_variance = test_quality.get("variance", 0.0)
        ref_variance = ref_quality.get("variance", 0.0)

        if ref_variance > 0:
            metrics["variance_preservation"] = test_variance / ref_variance
        else:
            metrics["variance_preservation"] = 0.0

        # Clustering preservation
        test_clustering = test_quality.get("clustering_coefficient", 0.0)
        ref_clustering = ref_quality.get("clustering_coefficient", 0.0)

        if ref_clustering > 0:
            metrics["clustering_preservation"] = test_clustering / ref_clustering
        else:
            metrics["clustering_preservation"] = 0.0

        # Overall benchmark score
        overall_benchmark = (
            metrics["quality_ratio"] * 0.4
            + metrics["similarity_preservation"] * 0.3
            + metrics["variance_preservation"] * 0.2
            + metrics["clustering_preservation"] * 0.1
        )

        metrics["overall_benchmark_score"] = min(overall_benchmark, 1.0)

        return metrics
