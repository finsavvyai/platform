import numpy as np
from typing import List, Tuple, Dict, Any
from sklearn.preprocessing import MinMaxScaler, StandardScaler, RobustScaler
from sklearn.decomposition import PCA
import logging

from .models import TransactionFeatures, FeatureEncodingMethod, QuantumFeatureEncoder

logger = logging.getLogger(__name__)


class QuantumFeatureEncoderService:
    """Service for encoding classical features into quantum states"""

    def __init__(self, config: QuantumFeatureEncoder):
        self.config = config
        self.scaler = self._initialize_scaler()
        self.pca = None
        self._setup_pca_if_needed()

    def _initialize_scaler(self):
        """Initialize the appropriate scaler based on configuration"""
        if self.config.normalization_method == "minmax":
            return MinMaxScaler(feature_range=(0, np.pi))
        elif self.config.normalization_method == "standard":
            return StandardScaler()
        elif self.config.normalization_method == "robust":
            return RobustScaler()
        else:
            raise ValueError(f"Unknown normalization method: {self.config.normalization_method}")

    def _setup_pca_if_needed(self):
        """Setup PCA if feature dimension needs reduction"""
        if self.config.feature_dim > self.config.num_qubits:
            self.pca = PCA(n_components=self.config.num_qubits)
            logger.info(f"PCA setup to reduce features from {self.config.feature_dim} to {self.config.num_qubits}")

    def encode_features(self, features: TransactionFeatures) -> np.ndarray:
        """
        Encode transaction features into quantum state representation

        Args:
            features: Transaction features to encode

        Returns:
            Encoded quantum parameters as numpy array
        """
        try:
            # Convert features to numpy array
            feature_array = features.to_numpy_array()

            # Handle missing values
            feature_array = self._handle_missing_values(feature_array)

            # Normalize features
            normalized_features = self.scaler.fit_transform(feature_array.reshape(1, -1)).flatten()

            # Apply PCA if needed for dimensionality reduction
            if self.pca is not None:
                normalized_features = self.pca.fit_transform(normalized_features.reshape(1, -1)).flatten()

            # Apply encoding method
            if self.config.method == FeatureEncodingMethod.ANGLE:
                return self._angle_encoding(normalized_features)
            elif self.config.method == FeatureEncodingMethod.AMPLITUDE:
                return self._amplitude_encoding(normalized_features)
            elif self.config.method == FeatureEncodingMethod.BASIS:
                return self._basis_encoding(normalized_features)
            elif self.config.method == FeatureEncodingMethod.HYBRID:
                return self._hybrid_encoding(normalized_features)
            else:
                raise ValueError(f"Unknown encoding method: {self.config.method}")

        except Exception as e:
            logger.error(f"Error encoding features for transaction {features.transaction_id}: {e}")
            raise

    def _handle_missing_values(self, features: np.ndarray) -> np.ndarray:
        """Handle missing values in feature array"""
        # Replace NaN values with 0
        features = np.nan_to_num(features, nan=0.0)
        # Replace infinite values with large finite numbers
        features = np.where(np.isinf(features), np.sign(features) * 1e6, features)
        return features

    def _angle_encoding(self, features: np.ndarray) -> np.ndarray:
        """
        Angle encoding method: Map features to rotation angles

        Args:
            features: Normalized feature array

        Returns:
            Array of rotation angles for quantum circuit
        """
        # Ensure we have the right number of parameters
        num_params = min(len(features), self.config.num_qubits * len(self.config.rotation_gates))

        # Create parameter array
        params = []

        for i in range(self.config.num_qubits):
            for gate in self.config.rotation_gates:
                if len(params) < num_params:
                    feature_idx = i * len(self.config.rotation_gates) + self.config.rotation_gates.index(gate)
                    if feature_idx < len(features):
                        angle = features[feature_idx]
                    else:
                        angle = features[i % len(features)]  # Cycle through features if needed
                    params.append(angle)
                else:
                    break

        return np.array(params[:num_params])

    def _amplitude_encoding(self, features: np.ndarray) -> np.ndarray:
        """
        Amplitude encoding method: Map features to amplitudes

        Args:
            features: Normalized feature array

        Returns:
            Normalized amplitude array for quantum state preparation
        """
        # Pad or truncate features to match required qubits
        required_size = 2 ** self.config.num_qubits
        if len(features) < required_size:
            # Pad with zeros
            padded_features = np.pad(features, (0, required_size - len(features)), 'constant')
        else:
            # Truncate or compress using PCA
            padded_features = features[:required_size]

        # Normalize to unit vector
        norm = np.linalg.norm(padded_features)
        if norm > 0:
            normalized_amplitudes = padded_features / norm
        else:
            # Handle zero vector case
            normalized_amplitudes = np.ones(required_size) / np.sqrt(required_size)

        return normalized_amplitudes

    def _basis_encoding(self, features: np.ndarray) -> np.ndarray:
        """
        Basis encoding method: Map features to computational basis states

        Args:
            features: Normalized feature array

        Returns:
            Binary representation for computational basis encoding
        """
        # Convert features to binary representation
        binary_params = []

        for i, feature in enumerate(features[:self.config.num_qubits]):
            # Normalize to [0, 1] if not already
            normalized_feature = (feature - features.min()) / (features.max() - features.min() + 1e-8)
            # Convert to binary probability
            binary_prob = normalized_feature
            binary_params.append(binary_prob)

        return np.array(binary_params)

    def _hybrid_encoding(self, features: np.ndarray) -> np.ndarray:
        """
        Hybrid encoding: Combine multiple encoding methods

        Args:
            features: Normalized feature array

        Returns:
            Combined encoding parameters
        """
        # Split features between different encoding methods
        split_point = len(features) // 2

        # Angle encoding for first half
        angle_params = self._angle_encoding(features[:split_point])

        # Basis encoding for second half
        basis_params = self._basis_encoding(features[split_point:])

        # Combine parameters
        combined_params = np.concatenate([angle_params, basis_params])

        # Ensure we don't exceed the required number of parameters
        max_params = self.config.num_qubits * len(self.config.rotation_gates)
        return combined_params[:max_params]

    def decode_quantum_state(self, quantum_state: np.ndarray) -> Dict[str, float]:
        """
        Decode quantum measurement results back to classical interpretation

        Args:
            quantum_state: Measurement results from quantum circuit

        Returns:
            Dictionary with decoded probabilities and interpretations
        """
        try:
            # Calculate probabilities from measurement counts
            if len(quantum_state.shape) == 1:
                # Probability distribution
                probabilities = quantum_state
            else:
                # Density matrix or other quantum state representation
                probabilities = np.diag(quantum_state).real

            # Normalize probabilities
            probabilities = probabilities / np.sum(probabilities)

            # Calculate entropy
            entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))

            # Calculate purity (for mixed states)
            if len(quantum_state.shape) == 2:
                purity = np.trace(np.dot(quantum_state, quantum_state)).real
            else:
                purity = np.sum(probabilities ** 2)

            # Calculate max probability state
            max_prob_idx = np.argmax(probabilities)
            max_probability = probabilities[max_prob_idx]

            return {
                "probabilities": probabilities.tolist(),
                "entropy": float(entropy),
                "purity": float(purity),
                "max_probability": float(max_probability),
                "max_state_index": int(max_prob_idx),
                "confidence": float(max_probability)
            }

        except Exception as e:
            logger.error(f"Error decoding quantum state: {e}")
            return {
                "probabilities": [0.5, 0.5],  # Default balanced probabilities
                "entropy": 1.0,
                "purity": 0.5,
                "max_probability": 0.5,
                "max_state_index": 0,
                "confidence": 0.5
            }


class FraudFeatureProcessor:
    """Specialized processor for fraud detection features"""

    def __init__(self):
        self.feature_weights = {
            'amount': 0.2,
            'amount_deviation': 0.15,
            'transaction_frequency': 0.1,
            'time_since_last': 0.1,
            'high_risk_country': 0.15,
            'new_device': 0.1,
            'unusual_time': 0.1,
            'velocity_exceeded': 0.1
        }

    def enhance_features(self, features: TransactionFeatures) -> TransactionFeatures:
        """
        Enhance features with additional fraud-specific indicators

        Args:
            features: Original transaction features

        Returns:
            Enhanced transaction features
        """
        # Calculate enhanced risk scores
        enhanced = features.copy()

        # Amount risk score (logarithmic scale)
        enhanced.amount_deviation_score = self._calculate_amount_deviation(enhanced)

        # Time-based risk indicators
        enhanced.is_unusual_time = self._detect_unusual_time(enhanced.timestamp)

        # Velocity score
        enhanced.velocity_exceeded = enhanced.transaction_frequency_24h > 10

        return enhanced

    def _calculate_amount_deviation(self, features: TransactionFeatures) -> float:
        """Calculate amount deviation from customer's normal behavior"""
        if features.avg_transaction_amount_30d and features.avg_transaction_amount_30d > 0:
            deviation = abs(features.amount - features.avg_transaction_amount_30d) / features.avg_transaction_amount_30d
            return min(deviation, 5.0)  # Cap at 5x deviation
        return 1.0  # Default deviation when no history available

    def _detect_unusual_time(self, timestamp: datetime) -> bool:
        """Detect if transaction occurs at unusual hours"""
        hour = timestamp.hour
        # Flag transactions between 1 AM and 5 AM as unusual
        return hour < 5 or hour > 23