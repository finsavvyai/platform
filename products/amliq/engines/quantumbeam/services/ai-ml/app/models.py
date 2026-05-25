"""
Hugging Face model management and inference
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any
import torch
from transformers import (
    AutoModel, AutoTokenizer, AutoModelForSequenceClassification,
    pipeline, Pipeline
)
import numpy as np
from .config import settings

logger = logging.getLogger(__name__)


class ModelManager:
    """Manages Hugging Face model loading, caching, and inference"""
    
    def __init__(self):
        self.loaded_models: Dict[str, Dict[str, Any]] = {}
        self.model_cache: Dict[str, Any] = {}
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
    
    async def load_default_models(self):
        """Load default models for fraud detection"""
        for model_name in settings.DEFAULT_MODELS:
            try:
                await self.load_model(model_name)
            except Exception as e:
                logger.error(f"Failed to load model {model_name}: {e}")
    
    async def load_model(self, model_name: str, task: Optional[str] = None) -> bool:
        """Load a Hugging Face model"""
        try:
            if model_name in self.loaded_models:
                logger.info(f"Model {model_name} already loaded")
                return True
            
            logger.info(f"Loading model: {model_name}")
            start_time = time.time()
            
            # Determine task if not specified
            if not task:
                task = self._infer_task(model_name)
            
            # Load model and tokenizer
            if task == "embeddings":
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer(model_name, cache_folder=settings.HF_CACHE_DIR)
                tokenizer = None
            else:
                model_pipeline = pipeline(
                    task,
                    model=model_name,
                    tokenizer=model_name,
                    device=0 if self.device == "cuda" else -1,
                    model_kwargs={"cache_dir": settings.HF_CACHE_DIR}
                )
                model = model_pipeline.model
                tokenizer = model_pipeline.tokenizer
            
            load_time = time.time() - start_time
            
            self.loaded_models[model_name] = {
                "model": model,
                "tokenizer": tokenizer,
                "task": task,
                "load_time": load_time,
                "last_used": time.time()
            }
            
            logger.info(f"Model {model_name} loaded in {load_time:.2f}s")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return False
    
    def _infer_task(self, model_name: str) -> str:
        """Infer the task type from model name"""
        model_name_lower = model_name.lower()
        
        if "sentiment" in model_name_lower or "sst" in model_name_lower:
            return "sentiment-analysis"
        elif "sentence-transformers" in model_name_lower:
            return "embeddings"
        elif "gpt" in model_name_lower or "generation" in model_name_lower:
            return "text-generation"
        elif "classification" in model_name_lower:
            return "text-classification"
        else:
            return "text-classification"  # Default
    
    async def analyze_transaction_text(self, text: str, model_name: Optional[str] = None) -> Dict[str, Any]:
        """Analyze transaction text for fraud indicators"""
        if not model_name:
            model_name = "distilbert-base-uncased-finetuned-sst-2-english"
        
        if model_name not in self.loaded_models:
            await self.load_model(model_name)
        
        model_info = self.loaded_models[model_name]
        model_info["last_used"] = time.time()
        
        try:
            # Create pipeline for inference
            classifier = pipeline(
                "sentiment-analysis",
                model=model_info["model"],
                tokenizer=model_info["tokenizer"],
                device=0 if self.device == "cuda" else -1
            )
            
            result = classifier(text)
            
            return {
                "text": text,
                "sentiment": result[0]["label"],
                "confidence": result[0]["score"],
                "model_used": model_name,
                "processing_time": time.time() - model_info["last_used"]
            }
            
        except Exception as e:
            logger.error(f"Error analyzing text with {model_name}: {e}")
            raise
    
    async def generate_embeddings(self, texts: List[str], model_name: Optional[str] = None) -> np.ndarray:
        """Generate embeddings for text data"""
        if not model_name:
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
        
        if model_name not in self.loaded_models:
            await self.load_model(model_name, task="embeddings")
        
        model_info = self.loaded_models[model_name]
        model_info["last_used"] = time.time()
        
        try:
            model = model_info["model"]
            embeddings = model.encode(texts, convert_to_numpy=True)
            return embeddings
            
        except Exception as e:
            logger.error(f"Error generating embeddings with {model_name}: {e}")
            raise
    
    async def detect_anomalies(self, features: np.ndarray, threshold: float = 0.5) -> Dict[str, Any]:
        """Detect anomalies in transaction features using ML"""
        try:
            from sklearn.ensemble import IsolationForest
            from sklearn.preprocessing import StandardScaler
            
            # Normalize features
            scaler = StandardScaler()
            normalized_features = scaler.fit_transform(features.reshape(-1, 1) if features.ndim == 1 else features)
            
            # Detect anomalies
            iso_forest = IsolationForest(contamination=0.1, random_state=42)
            anomaly_scores = iso_forest.fit_predict(normalized_features)
            anomaly_probabilities = iso_forest.score_samples(normalized_features)
            
            return {
                "anomaly_detected": bool(np.any(anomaly_scores == -1)),
                "anomaly_scores": anomaly_scores.tolist(),
                "anomaly_probabilities": anomaly_probabilities.tolist(),
                "threshold": threshold,
                "feature_count": len(features)
            }
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            raise
    
    async def cleanup(self):
        """Clean up loaded models"""
        logger.info("Cleaning up models...")
        for model_name in list(self.loaded_models.keys()):
            try:
                del self.loaded_models[model_name]
                logger.info(f"Cleaned up model: {model_name}")
            except Exception as e:
                logger.error(f"Error cleaning up model {model_name}: {e}")
        
        # Clear CUDA cache if using GPU
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    def get_model_stats(self) -> Dict[str, Any]:
        """Get statistics about loaded models"""
        stats = {
            "total_models": len(self.loaded_models),
            "device": self.device,
            "models": {}
        }
        
        for model_name, model_info in self.loaded_models.items():
            stats["models"][model_name] = {
                "task": model_info["task"],
                "load_time": model_info["load_time"],
                "last_used": model_info["last_used"],
                "time_since_last_use": time.time() - model_info["last_used"]
            }
        
        return stats