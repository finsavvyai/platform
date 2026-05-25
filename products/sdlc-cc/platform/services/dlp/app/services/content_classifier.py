"""
ML-Based Content Classification System for SDLC.ai DLP Service.

This module provides machine learning-based content classification and risk assessment
capabilities, including text classification, content categorization, and risk scoring.
"""

import json
import logging
import os
import pickle
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any

import joblib
import torch
import torch.nn as nn
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
)

from app.core.config import get_ml_settings
from app.models.schemas import RiskLevel

try:
    from app.structured import (
        classify_sensitivity as _structured_classify_sensitivity,
    )
    from app.structured import (
        is_structured_enabled as _structured_enabled,
    )
except Exception:  # pragma: no cover - optional dependency
    _structured_classify_sensitivity = None  # type: ignore[assignment]
    def _structured_enabled() -> bool:  # type: ignore[misc]
        return False

logger = logging.getLogger(__name__)


_STRUCTURED_SENSITIVITY_MAP: dict[str, str] = {
    "public": "PUBLIC",
    "internal": "INTERNAL",
    "confidential": "CONFIDENTIAL",
    "restricted": "RESTRICTED",
    "secret": "SECRET",
}


class ContentType(StrEnum):
    """Content types for classification."""

    PII = "PII"
    FINANCIAL = "FINANCIAL"
    HEALTH = "HEALTH"
    LEGAL = "LEGAL"
    CONFIDENTIAL = "CONFIDENTIAL"
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    RESTRICTED = "RESTRICTED"
    SECRET = "SECRET"
    TOP_SECRET = "TOP_SECRET"
    TECHNICAL = "TECHNICAL"
    PERSONAL = "PERSONAL"
    BUSINESS = "BUSINESS"


class ModelType(StrEnum):
    """Model types for content classification."""

    BERT_CLASSIFIER = "bert_classifier"
    DISTILBERT_CLASSIFIER = "distilbert_classifier"
    ROBERTA_CLASSIFIER = "roberta_classifier"
    LOGISTIC_REGRESSION = "logistic_regression"
    RANDOM_FOREST = "random_forest"
    SVM = "svm"
    ENSEMBLE = "ensemble"


@dataclass
class ClassificationResult:
    """Result of content classification."""

    predicted_class: ContentType
    confidence: float
    probabilities: dict[ContentType, float]
    model_name: str
    model_version: str
    processing_time_ms: int

    # Additional metadata
    features_used: list[str]
    feature_importance: dict[str, float] | None = None
    explanation: str | None = None


@dataclass
class RiskAssessmentResult:
    """Result of risk assessment."""

    risk_level: RiskLevel
    risk_score: float  # 0.0 to 1.0
    risk_factors: dict[str, float]
    confidence: float

    # Breakdown by category
    category_risks: dict[ContentType, float]

    # Recommendations
    recommendations: list[str]
    mitigation_actions: list[str]

    # Metadata
    model_name: str
    processing_time_ms: int


@dataclass
class ModelMetadata:
    """Metadata for ML models."""

    name: str
    version: str
    model_type: ModelType
    created_at: str
    updated_at: str
    created_by: str

    # Performance metrics
    accuracy: float
    precision: float
    recall: float
    f1_score: float

    # Model configuration
    config: dict[str, Any]

    # Training data info
    training_samples: int
    feature_count: int
    classes: list[str]


class BaseModel(ABC):
    """Base class for ML models."""

    def __init__(self, name: str, model_type: ModelType):
        self.name = name
        self.model_type = model_type
        self.model = None
        self.tokenizer = None
        self.label_encoder = None
        self.is_loaded = False
        self.metadata = None

    @abstractmethod
    def train(self, texts: list[str], labels: list[str], **kwargs) -> dict[str, float]:
        """Train the model."""
        pass

    @abstractmethod
    def predict(self, texts: list[str]) -> list[ClassificationResult]:
        """Make predictions on texts."""
        pass

    @abstractmethod
    def save_model(self, path: str):
        """Save the model to disk."""
        pass

    @abstractmethod
    def load_model(self, path: str):
        """Load the model from disk."""
        pass

    def is_trained(self) -> bool:
        """Check if model is trained."""
        return self.model is not None


class BERTClassifier(BaseModel):
    """BERT-based text classifier."""

    def __init__(self, name: str, model_name: str = "bert-base-uncased"):
        super().__init__(name, ModelType.BERT_CLASSIFIER)
        self.pretrained_model_name = model_name
        self.max_length = 512
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def train(
        self,
        texts: list[str],
        labels: list[str],
        validation_split: float = 0.2,
        epochs: int = 3,
        batch_size: int = 16,
        learning_rate: float = 2e-5,
        **kwargs,
    ) -> dict[str, float]:
        """Train BERT classifier."""
        try:
            # Load tokenizer and model
            self.tokenizer = AutoTokenizer.from_pretrained(self.pretrained_model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.pretrained_model_name, num_labels=len(set(labels))
            )
            self.model.to(self.device)

            # Encode labels
            self.label_encoder = LabelEncoder()
            encoded_labels = self.label_encoder.fit_transform(labels)

            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                texts,
                encoded_labels,
                test_size=validation_split,
                random_state=42,
                stratify=encoded_labels,
            )

            # Prepare datasets
            train_encodings = self.tokenizer(
                X_train,
                truncation=True,
                padding=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            val_encodings = self.tokenizer(
                X_val,
                truncation=True,
                padding=True,
                max_length=self.max_length,
                return_tensors="pt",
            )

            # Create datasets
            train_dataset = torch.utils.data.TensorDataset(
                train_encodings["input_ids"],
                train_encodings["attention_mask"],
                torch.tensor(y_train),
            )
            val_dataset = torch.utils.data.TensorDataset(
                val_encodings["input_ids"],
                val_encodings["attention_mask"],
                torch.tensor(y_val),
            )

            # Training setup
            train_loader = torch.utils.data.DataLoader(
                train_dataset, batch_size=batch_size, shuffle=True
            )
            val_loader = torch.utils.data.DataLoader(
                val_dataset, batch_size=batch_size, shuffle=False
            )

            optimizer = torch.optim.AdamW(self.model.parameters(), lr=learning_rate)
            nn.CrossEntropyLoss()

            # Training loop
            train_losses = []
            val_accuracies = []

            for epoch in range(epochs):
                # Training
                self.model.train()
                total_train_loss = 0

                for batch in train_loader:
                    input_ids, attention_mask, labels_batch = batch
                    input_ids = input_ids.to(self.device)
                    attention_mask = attention_mask.to(self.device)
                    labels_batch = labels_batch.to(self.device)

                    optimizer.zero_grad()

                    outputs = self.model(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        labels=labels_batch,
                    )

                    loss = outputs.loss
                    total_train_loss += loss.item()

                    loss.backward()
                    optimizer.step()

                avg_train_loss = total_train_loss / len(train_loader)
                train_losses.append(avg_train_loss)

                # Validation
                self.model.eval()
                correct_predictions = 0
                total_predictions = 0

                with torch.no_grad():
                    for batch in val_loader:
                        input_ids, attention_mask, labels_batch = batch
                        input_ids = input_ids.to(self.device)
                        attention_mask = attention_mask.to(self.device)
                        labels_batch = labels_batch.to(self.device)

                        outputs = self.model(
                            input_ids=input_ids, attention_mask=attention_mask
                        )

                        predictions = torch.argmax(outputs.logits, dim=1)
                        correct_predictions += (
                            (predictions == labels_batch).sum().item()
                        )
                        total_predictions += len(labels_batch)

                val_accuracy = correct_predictions / total_predictions
                val_accuracies.append(val_accuracy)

                logger.info(
                    f"Epoch {epoch + 1}/{epochs}, Train Loss: {avg_train_loss:.4f}, Val Acc: {val_accuracy:.4f}"
                )

            # Store metadata
            self.metadata = ModelMetadata(
                name=self.name,
                version="1.0.0",
                model_type=self.model_type,
                created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                updated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                created_by="system",
                accuracy=val_accuracies[-1],
                precision=0.0,  # Calculate if needed
                recall=0.0,  # Calculate if needed
                f1_score=0.0,  # Calculate if needed
                config={
                    "pretrained_model": self.pretrained_model_name,
                    "max_length": self.max_length,
                    "epochs": epochs,
                    "batch_size": batch_size,
                    "learning_rate": learning_rate,
                },
                training_samples=len(texts),
                feature_count=self.max_length,
                classes=list(self.label_encoder.classes_),
            )

            self.is_loaded = True

            return {
                "accuracy": val_accuracies[-1],
                "final_train_loss": train_losses[-1],
                "epochs_trained": epochs,
            }

        except Exception as e:
            logger.error(f"BERT training failed: {e}")
            raise

    def predict(self, texts: list[str]) -> list[ClassificationResult]:
        """Make predictions using BERT model."""
        if not self.is_loaded or self.model is None:
            raise ValueError("Model is not trained or loaded")

        results = []

        for text in texts:
            start_time = time.time()

            # Tokenize text
            inputs = self.tokenizer(
                text,
                truncation=True,
                padding=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Make prediction
            with torch.no_grad():
                outputs = self.model(**inputs)
                probabilities = torch.softmax(outputs.logits, dim=1)
                predicted_class_idx = torch.argmax(probabilities, dim=1).item()
                confidence = probabilities[0][predicted_class_idx].item()

            # Convert to content type
            predicted_class = ContentType(
                self.label_encoder.inverse_transform([predicted_class_idx])[0]
            )

            # Create probability dictionary
            prob_dict = {}
            for i, class_name in enumerate(self.label_encoder.classes_):
                prob_dict[ContentType(class_name)] = probabilities[0][i].item()

            processing_time = int((time.time() - start_time) * 1000)

            result = ClassificationResult(
                predicted_class=predicted_class,
                confidence=confidence,
                probabilities=prob_dict,
                model_name=self.name,
                model_version=self.metadata.version if self.metadata else "1.0.0",
                processing_time_ms=processing_time,
                features_used=["bert_embeddings"],
            )

            results.append(result)

        return results

    def save_model(self, path: str):
        """Save BERT model to disk."""
        if not self.is_loaded:
            raise ValueError("Cannot save untrained model")

        os.makedirs(path, exist_ok=True)

        # Save model and tokenizer
        self.model.save_pretrained(path)
        self.tokenizer.save_pretrained(path)

        # Save label encoder
        with open(os.path.join(path, "label_encoder.pkl"), "wb") as f:
            pickle.dump(self.label_encoder, f)

        # Save metadata
        if self.metadata:
            with open(os.path.join(path, "metadata.json"), "w") as f:
                json.dump(self.metadata.__dict__, f, indent=2)

        logger.info(f"BERT model saved to {path}")

    def load_model(self, path: str):
        """Load BERT model from disk."""
        try:
            # Load tokenizer and model
            self.tokenizer = AutoTokenizer.from_pretrained(path)
            self.model = AutoModelForSequenceClassification.from_pretrained(path)
            self.model.to(self.device)

            # Load label encoder
            with open(os.path.join(path, "label_encoder.pkl"), "rb") as f:
                self.label_encoder = pickle.load(f)

            # Load metadata
            metadata_path = os.path.join(path, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path) as f:
                    metadata_dict = json.load(f)
                self.metadata = ModelMetadata(**metadata_dict)

            self.is_loaded = True
            logger.info(f"BERT model loaded from {path}")

        except Exception as e:
            logger.error(f"Failed to load BERT model: {e}")
            raise


class TraditionalClassifier(BaseModel):
    """Traditional ML classifier (Logistic Regression, Random Forest, etc.)."""

    def __init__(self, name: str, model_type: ModelType):
        super().__init__(name, model_type)
        self.vectorizer = TfidfVectorizer(
            max_features=10000,
            ngram_range=(1, 2),
            stop_words="english",
            min_df=2,
            max_df=0.95,
        )

        # Initialize model based on type
        if model_type == ModelType.LOGISTIC_REGRESSION:
            self.model = LogisticRegression(random_state=42, max_iter=1000)
        elif model_type == ModelType.RANDOM_FOREST:
            self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

    def train(
        self,
        texts: list[str],
        labels: list[str],
        validation_split: float = 0.2,
        **kwargs,
    ) -> dict[str, float]:
        """Train traditional classifier."""
        try:
            # Encode labels
            self.label_encoder = LabelEncoder()
            encoded_labels = self.label_encoder.fit_transform(labels)

            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                texts,
                encoded_labels,
                test_size=validation_split,
                random_state=42,
                stratify=encoded_labels,
            )

            # Vectorize texts
            X_train_vec = self.vectorizer.fit_transform(X_train)
            X_val_vec = self.vectorizer.transform(X_val)

            # Train model
            self.model.fit(X_train_vec, y_train)

            # Evaluate
            train_score = self.model.score(X_train_vec, y_train)
            val_score = self.model.score(X_val_vec, y_val)

            # Get feature importance if available
            if hasattr(self.model, "feature_importances_"):
                feature_names = self.vectorizer.get_feature_names_out()
                dict(
                    zip(feature_names, self.model.feature_importances_, strict=False)
                )

            # Store metadata
            self.metadata = ModelMetadata(
                name=self.name,
                version="1.0.0",
                model_type=self.model_type,
                created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                updated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                created_by="system",
                accuracy=val_score,
                precision=0.0,  # Calculate if needed
                recall=0.0,  # Calculate if needed
                f1_score=0.0,  # Calculate if needed
                config={
                    "vectorizer_max_features": self.vectorizer.max_features,
                    "vectorizer_ngram_range": self.vectorizer.ngram_range,
                },
                training_samples=len(texts),
                feature_count=len(self.vectorizer.vocabulary_),
                classes=list(self.label_encoder.classes_),
            )

            self.is_loaded = True

            return {
                "train_accuracy": train_score,
                "val_accuracy": val_score,
                "feature_count": len(self.vectorizer.vocabulary_),
            }

        except Exception as e:
            logger.error(f"Traditional classifier training failed: {e}")
            raise

    def predict(self, texts: list[str]) -> list[ClassificationResult]:
        """Make predictions using traditional classifier."""
        if not self.is_loaded or self.model is None:
            raise ValueError("Model is not trained or loaded")

        results = []

        # Vectorize texts
        X_vec = self.vectorizer.transform(texts)

        # Make predictions
        predictions = self.model.predict(X_vec)
        probabilities = self.model.predict_proba(X_vec)

        for i, _text in enumerate(texts):
            start_time = time.time()

            # Convert to content type
            predicted_class = ContentType(
                self.label_encoder.inverse_transform([predictions[i]])[0]
            )
            confidence = probabilities[i][predictions[i]].item()

            # Create probability dictionary
            prob_dict = {}
            for j, class_name in enumerate(self.label_encoder.classes_):
                prob_dict[ContentType(class_name)] = probabilities[i][j].item()

            # Get feature importance if available
            feature_importance = None
            if hasattr(self.model, "feature_importances_"):
                feature_names = self.vectorizer.get_feature_names_out()
                feature_importance = dict(
                    zip(feature_names, self.model.feature_importances_, strict=False)
                )

            processing_time = int((time.time() - start_time) * 1000)

            result = ClassificationResult(
                predicted_class=predicted_class,
                confidence=confidence,
                probabilities=prob_dict,
                model_name=self.name,
                model_version=self.metadata.version if self.metadata else "1.0.0",
                processing_time_ms=processing_time,
                features_used=list(self.vectorizer.vocabulary_.keys()),
                feature_importance=feature_importance,
            )

            results.append(result)

        return results

    def save_model(self, path: str):
        """Save traditional model to disk."""
        if not self.is_loaded:
            raise ValueError("Cannot save untrained model")

        os.makedirs(path, exist_ok=True)

        # Save model and vectorizer
        joblib.dump(self.model, os.path.join(path, "model.pkl"))
        joblib.dump(self.vectorizer, os.path.join(path, "vectorizer.pkl"))

        # Save label encoder
        with open(os.path.join(path, "label_encoder.pkl"), "wb") as f:
            pickle.dump(self.label_encoder, f)

        # Save metadata
        if self.metadata:
            with open(os.path.join(path, "metadata.json"), "w") as f:
                json.dump(self.metadata.__dict__, f, indent=2)

        logger.info(f"Traditional model saved to {path}")

    def load_model(self, path: str):
        """Load traditional model from disk."""
        try:
            # Load model and vectorizer
            self.model = joblib.load(os.path.join(path, "model.pkl"))
            self.vectorizer = joblib.load(os.path.join(path, "vectorizer.pkl"))

            # Load label encoder
            with open(os.path.join(path, "label_encoder.pkl"), "rb") as f:
                self.label_encoder = pickle.load(f)

            # Load metadata
            metadata_path = os.path.join(path, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path) as f:
                    metadata_dict = json.load(f)
                self.metadata = ModelMetadata(**metadata_dict)

            self.is_loaded = True
            logger.info(f"Traditional model loaded from {path}")

        except Exception as e:
            logger.error(f"Failed to load traditional model: {e}")
            raise


class RiskAssessmentModel:
    """Risk assessment model for DLP violations."""

    def __init__(self):
        self.settings = get_ml_settings()
        self.risk_weights = {
            ContentType.PII: 0.9,
            ContentType.FINANCIAL: 0.85,
            ContentType.HEALTH: 0.95,
            ContentType.LEGAL: 0.8,
            ContentType.CONFIDENTIAL: 0.7,
            ContentType.RESTRICTED: 0.6,
            ContentType.SECRET: 0.85,
            ContentType.TOP_SECRET: 1.0,
            ContentType.INTERNAL: 0.4,
            ContentType.PUBLIC: 0.1,
            ContentType.TECHNICAL: 0.3,
            ContentType.PERSONAL: 0.6,
            ContentType.BUSINESS: 0.3,
        }

        self.severity_multipliers = {
            RiskLevel.LOW: 0.3,
            RiskLevel.MEDIUM: 0.6,
            RiskLevel.HIGH: 0.85,
            RiskLevel.CRITICAL: 1.0,
        }

    def assess_risk(
        self,
        classification_results: list[ClassificationResult],
        violation_count: int = 0,
        content_length: int = 0,
        additional_factors: dict[str, float] | None = None,
    ) -> RiskAssessmentResult:
        """Assess risk based on classification results and other factors."""
        start_time = time.time()

        # Calculate base risk score from classifications
        category_risks = {}
        total_risk = 0.0

        for result in classification_results:
            content_type = result.predicted_class
            confidence = result.confidence
            weight = self.risk_weights.get(content_type, 0.5)

            # Risk contribution from this classification
            risk_contribution = weight * confidence
            category_risks[content_type] = risk_contribution
            total_risk += risk_contribution

        # Normalize total risk
        if classification_results:
            total_risk /= len(classification_results)

        # Apply violation count factor
        if violation_count > 0:
            violation_factor = min(1.0, violation_count / 10.0)  # Cap at 10 violations
            total_risk = total_risk * (1 + violation_factor)

        # Apply content length factor (longer content might be more sensitive)
        if content_length > 0:
            length_factor = min(
                1.2, 1 + (content_length / 10000.0)
            )  # Cap at 20% increase
            total_risk *= length_factor

        # Apply additional risk factors
        if additional_factors:
            for _factor_name, factor_value in additional_factors.items():
                if factor_value > 0:
                    total_risk *= 1 + factor_value

        # Cap risk score at 1.0
        risk_score = min(1.0, total_risk)

        # Determine risk level
        risk_level = self._determine_risk_level(risk_score)

        # Generate risk factors breakdown
        risk_factors = {
            "classification_risk": total_risk,
            "violation_count_factor": violation_count / 10.0
            if violation_count > 0
            else 0.0,
            "content_length_factor": (content_length / 10000.0)
            if content_length > 0
            else 0.0,
        }

        if additional_factors:
            risk_factors.update(additional_factors)

        # Generate recommendations
        recommendations = self._generate_recommendations(risk_level, category_risks)
        mitigation_actions = self._generate_mitigation_actions(
            risk_level, category_risks
        )

        processing_time = int((time.time() - start_time) * 1000)

        return RiskAssessmentResult(
            risk_level=risk_level,
            risk_score=risk_score,
            risk_factors=risk_factors,
            confidence=0.85,  # Base confidence for risk assessment
            category_risks=category_risks,
            recommendations=recommendations,
            mitigation_actions=mitigation_actions,
            model_name="risk_assessment_v1",
            processing_time_ms=processing_time,
        )

    def _determine_risk_level(self, risk_score: float) -> RiskLevel:
        """Determine risk level based on risk score."""
        thresholds = self.settings.risk_thresholds

        if risk_score >= thresholds.get("CRITICAL", 0.9):
            return RiskLevel.CRITICAL
        elif risk_score >= thresholds.get("HIGH", 0.7):
            return RiskLevel.HIGH
        elif risk_score >= thresholds.get("MEDIUM", 0.4):
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _generate_recommendations(
        self, risk_level: RiskLevel, category_risks: dict[ContentType, float]
    ) -> list[str]:
        """Generate risk mitigation recommendations."""
        recommendations = []

        # Base recommendations by risk level
        if risk_level == RiskLevel.CRITICAL:
            recommendations.extend(
                [
                    "Immediate review required by security team",
                    "Consider content quarantine",
                    "Escalate to compliance officer",
                ]
            )
        elif risk_level == RiskLevel.HIGH:
            recommendations.extend(
                [
                    "Review by security team within 24 hours",
                    "Consider enhanced access controls",
                    "Document justification for content access",
                ]
            )
        elif risk_level == RiskLevel.MEDIUM:
            recommendations.extend(
                [
                    "Standard review process",
                    "Implement additional monitoring",
                    "Consider data minimization",
                ]
            )
        else:
            recommendations.extend(
                [
                    "Standard processing acceptable",
                    "Continue routine monitoring",
                ]
            )

        # Category-specific recommendations
        high_risk_categories = [
            cat for cat, risk in category_risks.items() if risk > 0.7
        ]

        if ContentType.PII in high_risk_categories:
            recommendations.append("Implement PII redaction or anonymization")

        if ContentType.FINANCIAL in high_risk_categories:
            recommendations.append("Ensure PCI DSS compliance")

        if ContentType.HEALTH in high_risk_categories:
            recommendations.append("Verify HIPAA compliance measures")

        return recommendations

    def _generate_mitigation_actions(
        self, risk_level: RiskLevel, category_risks: dict[ContentType, float]
    ) -> list[str]:
        """Generate specific mitigation actions."""
        actions = []

        # Actions by risk level
        if risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
            actions.extend(
                [
                    "Enable real-time monitoring",
                    "Implement strict access controls",
                    "Create audit trail",
                    "Notify security team",
                ]
            )

        # Category-specific actions
        for category, risk in category_risks.items():
            if risk > 0.6:
                if category == ContentType.PII:
                    actions.append("Apply PII masking")
                elif category == ContentType.FINANCIAL:
                    actions.append("Encrypt financial data")
                elif category == ContentType.HEALTH:
                    actions.append("Apply health data protection")
                elif category == ContentType.LEGAL:
                    actions.append("Implement legal privilege protection")

        return actions


class ContentClassificationService:
    """Main content classification service."""

    def __init__(self):
        self.settings = get_ml_settings()
        self.models: dict[str, BaseModel] = {}
        self.risk_assessor = RiskAssessmentModel()
        self.default_model = None
        self.model_lock = threading.Lock()
        self._load_models()

    def _load_models(self):
        """Load trained models."""
        models_path = Path(self.settings.ml_models_path)

        if not models_path.exists():
            logger.warning(
                f"Models path {models_path} does not exist, using mock models"
            )
            self._create_mock_models()
            return

        # Try to load models from disk
        try:
            for model_dir in models_path.iterdir():
                if model_dir.is_dir():
                    metadata_path = model_dir / "metadata.json"
                    if metadata_path.exists():
                        with open(metadata_path) as f:
                            metadata = json.load(f)

                        model_type = ModelType(
                            metadata.get("model_type", "logistic_regression")
                        )
                        model_name = metadata.get("name", model_dir.name)

                        # Create appropriate model instance
                        if model_type in [
                            ModelType.BERT_CLASSIFIER,
                            ModelType.DISTILBERT_CLASSIFIER,
                        ]:
                            model = BERTClassifier(model_name)
                        else:
                            model = TraditionalClassifier(model_name, model_type)

                        # Load model
                        model.load_model(str(model_dir))
                        self.models[model_name] = model

                        # Set as default if no default exists
                        if self.default_model is None:
                            self.default_model = model_name

                        logger.info(f"Loaded model: {model_name}")

            if not self.models:
                logger.warning("No models found, creating mock models")
                self._create_mock_models()
            else:
                logger.info(f"Loaded {len(self.models)} models")

        except Exception as e:
            logger.error(f"Failed to load models: {e}")
            self._create_mock_models()

    def _create_mock_models(self):
        """Create mock models for testing."""

        # Create a simple mock classifier
        class MockClassifier(BaseModel):
            def __init__(self):
                super().__init__("mock_classifier", ModelType.LOGISTIC_REGRESSION)
                self.is_loaded = True

            def train(
                self, texts: list[str], labels: list[str], **kwargs
            ) -> dict[str, float]:
                return {"accuracy": 0.8}

            def predict(self, texts: list[str]) -> list[ClassificationResult]:
                results = []
                for text in texts:
                    # Simple mock classification based on keywords
                    text_lower = text.lower()

                    if any(
                        word in text_lower
                        for word in ["ssn", "social security", "personal"]
                    ):
                        predicted_class = ContentType.PII
                        confidence = 0.9
                    elif any(
                        word in text_lower
                        for word in ["credit card", "bank", "account"]
                    ):
                        predicted_class = ContentType.FINANCIAL
                        confidence = 0.85
                    elif any(
                        word in text_lower for word in ["medical", "health", "patient"]
                    ):
                        predicted_class = ContentType.HEALTH
                        confidence = 0.88
                    elif any(
                        word in text_lower
                        for word in ["legal", "contract", "agreement"]
                    ):
                        predicted_class = ContentType.LEGAL
                        confidence = 0.82
                    else:
                        predicted_class = ContentType.PUBLIC
                        confidence = 0.7

                    result = ClassificationResult(
                        predicted_class=predicted_class,
                        confidence=confidence,
                        probabilities={predicted_class: confidence},
                        model_name=self.name,
                        model_version="mock-1.0",
                        processing_time_ms=10,
                        features_used=["mock_features"],
                    )
                    results.append(result)

                return results

            def save_model(self, path: str):
                pass

            def load_model(self, path: str):
                pass

        mock_model = MockClassifier()
        self.models["mock_classifier"] = mock_model
        self.default_model = "mock_classifier"

        logger.info("Created mock classifier for testing")

    def classify_content(
        self,
        text: str,
        model_name: str | None = None,
        return_probabilities: bool = True,
    ) -> ClassificationResult:
        """Classify a single piece of content."""
        model_name = model_name or self.default_model

        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")

        model = self.models[model_name]
        results = model.predict([text])

        if not results:
            raise RuntimeError("Classification failed")

        result = results[0]
        if not return_probabilities:
            result.probabilities = {result.predicted_class: result.confidence}

        # Opt-in: override with Instructor-backed structured classification.
        # Only overrides label/confidence; preserves existing metadata so
        # downstream risk assessment keeps working.
        if _structured_enabled() and _structured_classify_sensitivity is not None:
            try:
                structured = _structured_classify_sensitivity(text)
                if structured is not None:
                    mapped = _STRUCTURED_SENSITIVITY_MAP.get(
                        structured.sensitivity.value
                    )
                    if mapped is not None:
                        try:
                            result.predicted_class = ContentType(mapped)
                            result.confidence = float(structured.confidence)
                            result.explanation = (
                                structured.summary or result.explanation
                            )
                        except ValueError:
                            # Unknown ContentType bucket; keep heuristic result.
                            pass
            except Exception as _exc:  # pragma: no cover - defensive
                logger.debug(
                    "structured sensitivity classification disabled: %s", _exc
                )

        return result

    def classify_batch(
        self,
        texts: list[str],
        model_name: str | None = None,
        max_batch_size: int = 32,
    ) -> list[ClassificationResult]:
        """Classify multiple texts in batches."""
        model_name = model_name or self.default_model

        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")

        model = self.models[model_name]

        # Process in batches to avoid memory issues
        all_results = []

        for i in range(0, len(texts), max_batch_size):
            batch_texts = texts[i : i + max_batch_size]
            batch_results = model.predict(batch_texts)
            all_results.extend(batch_results)

        return all_results

    def assess_content_risk(
        self,
        text: str,
        model_name: str | None = None,
        violation_count: int = 0,
        additional_factors: dict[str, float] | None = None,
    ) -> RiskAssessmentResult:
        """Assess risk for a single piece of content."""
        # Classify content
        classification = self.classify_content(text, model_name)

        # Assess risk
        risk_result = self.risk_assessor.assess_risk(
            classification_results=[classification],
            violation_count=violation_count,
            content_length=len(text),
            additional_factors=additional_factors,
        )

        return risk_result

    def get_available_models(self) -> list[dict[str, Any]]:
        """Get list of available models."""
        models_info = []

        for model_name, model in self.models.items():
            model_info = {
                "name": model_name,
                "type": model.model_type.value,
                "is_loaded": model.is_loaded,
                "is_default": model_name == self.default_model,
            }

            if model.metadata:
                model_info.update(
                    {
                        "version": model.metadata.version,
                        "accuracy": model.metadata.accuracy,
                        "classes": model.metadata.classes,
                        "created_at": model.metadata.created_at,
                    }
                )

            models_info.append(model_info)

        return models_info

    def set_default_model(self, model_name: str):
        """Set the default model for classification."""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")

        with self.model_lock:
            self.default_model = model_name
            logger.info(f"Set default model to: {model_name}")


# Singleton instance
_classification_service = None


def get_classification_service() -> ContentClassificationService:
    """Get singleton instance of content classification service."""
    global _classification_service
    if _classification_service is None:
        _classification_service = ContentClassificationService()
    return _classification_service
