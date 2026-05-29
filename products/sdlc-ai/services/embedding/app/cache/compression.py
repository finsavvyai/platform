"""
Compression utilities for embedding cache.

This module provides compression and decompression utilities for embeddings
to reduce memory usage and improve cache efficiency.
"""

import pickle
import zlib
from typing import Any, List, Tuple, Union

import numpy as np


class CompressionManager:
    """Manages compression and decompression of embeddings."""

    def __init__(self, compression_level: int = 6):
        """
        Initialize compression manager.

        Args:
            compression_level: Compression level (1-9)
        """
        self.compression_level = compression_level

    def compress_embedding(self, embedding: List[float]) -> bytes:
        """
        Compress an embedding vector.

        Args:
            embedding: Embedding vector to compress

        Returns:
            Compressed bytes
        """
        try:
            # Convert to numpy array for more efficient compression
            np_array = np.array(embedding, dtype=np.float32)

            # Serialize with pickle
            serialized = pickle.dumps(np_array)

            # Compress with zlib
            compressed = zlib.compress(serialized, self.compression_level)

            return compressed

        except Exception as e:
            raise RuntimeError(f"Failed to compress embedding: {e}")

    def decompress_embedding(self, compressed_data: bytes) -> List[float]:
        """
        Decompress an embedding vector.

        Args:
            compressed_data: Compressed embedding data

        Returns:
            Decompressed embedding vector
        """
        try:
            # Decompress with zlib
            decompressed = zlib.decompress(compressed_data)

            # Deserialize with pickle
            np_array = pickle.loads(decompressed)

            # Convert back to list
            embedding = np_array.tolist()

            return embedding

        except Exception as e:
            raise RuntimeError(f"Failed to decompress embedding: {e}")

    def compress_batch_embeddings(self, embeddings: List[List[float]]) -> bytes:
        """
        Compress a batch of embedding vectors.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Compressed bytes
        """
        try:
            # Convert to numpy array for more efficient compression
            np_array = np.array(embeddings, dtype=np.float32)

            # Serialize with pickle
            serialized = pickle.dumps(np_array)

            # Compress with zlib
            compressed = zlib.compress(serialized, self.compression_level)

            return compressed

        except Exception as e:
            raise RuntimeError(f"Failed to compress batch embeddings: {e}")

    def decompress_batch_embeddings(self, compressed_data: bytes) -> List[List[float]]:
        """
        Decompress a batch of embedding vectors.

        Args:
            compressed_data: Compressed batch embedding data

        Returns:
            List of decompressed embedding vectors
        """
        try:
            # Decompress with zlib
            decompressed = zlib.decompress(compressed_data)

            # Deserialize with pickle
            np_array = pickle.loads(decompressed)

            # Convert back to list of lists
            embeddings = np_array.tolist()

            return embeddings

        except Exception as e:
            raise RuntimeError(f"Failed to decompress batch embeddings: {e}")

    def estimate_compression_ratio(
        self, embedding: List[float]
    ) -> Tuple[float, int, int]:
        """
        Estimate compression ratio for an embedding.

        Args:
            embedding: Embedding vector

        Returns:
            Tuple of (compression_ratio, original_size, compressed_size)
        """
        try:
            # Calculate original size
            original_data = pickle.dumps(np.array(embedding, dtype=np.float32))
            original_size = len(original_data)

            # Calculate compressed size
            compressed_data = self.compress_embedding(embedding)
            compressed_size = len(compressed_data)

            # Calculate compression ratio
            compression_ratio = (
                original_size / compressed_size if compressed_size > 0 else 0.0
            )

            return compression_ratio, original_size, compressed_size

        except Exception:
            return 0.0, 0, 0

    def is_compression_beneficial(self, embedding: List[float]) -> bool:
        """
        Check if compression is beneficial for an embedding.

        Args:
            embedding: Embedding vector

        Returns:
            True if compression is beneficial
        """
        try:
            compression_ratio, _, _ = self.estimate_compression_ratio(embedding)

            # Compression is beneficial if it reduces size by at least 20%
            return compression_ratio > 1.2

        except Exception:
            return False

    def compress_metadata(self, metadata: dict) -> bytes:
        """
        Compress metadata dictionary.

        Args:
            metadata: Metadata dictionary

        Returns:
            Compressed bytes
        """
        try:
            # Serialize with pickle
            serialized = pickle.dumps(metadata)

            # Compress with zlib
            compressed = zlib.compress(serialized, self.compression_level)

            return compressed

        except Exception as e:
            raise RuntimeError(f"Failed to compress metadata: {e}")

    def decompress_metadata(self, compressed_data: bytes) -> dict:
        """
        Decompress metadata dictionary.

        Args:
            compressed_data: Compressed metadata

        Returns:
            Decompressed metadata dictionary
        """
        try:
            # Decompress with zlib
            decompressed = zlib.decompress(compressed_data)

            # Deserialize with pickle
            metadata = pickle.loads(decompressed)

            return metadata

        except Exception as e:
            raise RuntimeError(f"Failed to decompress metadata: {e}")

    def calculate_stats(self, embeddings: List[List[float]]) -> dict:
        """
        Calculate compression statistics for a list of embeddings.

        Args:
            embeddings: List of embedding vectors

        Returns:
            Compression statistics
        """
        if not embeddings:
            return {
                "total_embeddings": 0,
                "original_size_bytes": 0,
                "compressed_size_bytes": 0,
                "compression_ratio": 0.0,
                "space_saved_bytes": 0,
                "compression_efficiency": 0.0,
            }

        try:
            # Calculate total original size
            original_size = sum(
                len(pickle.dumps(np.array(emb, dtype=np.float32))) for emb in embeddings
            )

            # Calculate total compressed size
            compressed_sizes = []
            for emb in embeddings:
                compressed = self.compress_embedding(emb)
                compressed_sizes.append(len(compressed))

            compressed_size = sum(compressed_sizes)

            # Calculate metrics
            compression_ratio = (
                original_size / compressed_size if compressed_size > 0 else 0.0
            )
            space_saved = original_size - compressed_size
            compression_efficiency = (
                (space_saved / original_size) * 100 if original_size > 0 else 0.0
            )

            return {
                "total_embeddings": len(embeddings),
                "original_size_bytes": original_size,
                "compressed_size_bytes": compressed_size,
                "compression_ratio": compression_ratio,
                "space_saved_bytes": space_saved,
                "compression_efficiency": compression_efficiency,
                "average_compression_ratio": compression_ratio,
                "min_compressed_size": min(compressed_sizes) if compressed_sizes else 0,
                "max_compressed_size": max(compressed_sizes) if compressed_sizes else 0,
                "avg_compressed_size": sum(compressed_sizes) / len(compressed_sizes)
                if compressed_sizes
                else 0,
            }

        except Exception as e:
            return {
                "error": str(e),
                "total_embeddings": len(embeddings),
            }
