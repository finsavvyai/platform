"""
LLM Provider management with failover and load balancing
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Union
from enum import Enum
import openai
import anthropic
import random
from .config import settings
from .cost_tracker import CostTracker

logger = logging.getLogger(__name__)


class ProviderType(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"


class ProviderStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"


class LLMProvider:
    """Base class for LLM providers"""
    
    def __init__(self, provider_type: ProviderType, config: Dict[str, Any]):
        self.provider_type = provider_type
        self.config = config
        self.status = ProviderStatus.HEALTHY
        self.last_request_time = 0
        self.request_count = 0
        self.error_count = 0
        self.total_cost = 0.0
        self.avg_response_time = 0.0
    
    async def generate_text(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Generate text using the provider"""
        raise NotImplementedError
    
    async def analyze_fraud_patterns(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze transaction data for fraud patterns"""
        raise NotImplementedError
    
    def update_stats(self, response_time: float, cost: float = 0.0, error: bool = False):
        """Update provider statistics"""
        self.request_count += 1
        self.last_request_time = time.time()
        self.total_cost += cost
        
        if error:
            self.error_count += 1
        
        # Update average response time
        if self.avg_response_time == 0:
            self.avg_response_time = response_time
        else:
            self.avg_response_time = (self.avg_response_time + response_time) / 2
    
    def get_health_score(self) -> float:
        """Calculate health score based on error rate and response time"""
        if self.request_count == 0:
            return 1.0
        
        error_rate = self.error_count / self.request_count
        response_penalty = min(self.avg_response_time / 10.0, 0.5)  # Penalize slow responses
        
        return max(0.0, 1.0 - error_rate - response_penalty)


class OpenAIProvider(LLMProvider):
    """OpenAI provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(ProviderType.OPENAI, config)
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = config.get("model", "gpt-3.5-turbo")
    
    async def generate_text(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Generate text using OpenAI"""
        start_time = time.time()
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kwargs.get("max_tokens", 500),
                temperature=kwargs.get("temperature", 0.7)
            )
            
            response_time = time.time() - start_time
            cost = self._calculate_cost(response.usage.total_tokens)
            
            self.update_stats(response_time, cost)
            
            result = {
                "text": response.choices[0].message.content,
                "provider": self.provider_type,
                "model": self.model,
                "tokens_used": response.usage.total_tokens,
                "cost": cost,
                "response_time": response_time
            }
            
            return result
            
        except Exception as e:
            response_time = time.time() - start_time
            self.update_stats(response_time, error=True)
            logger.error(f"OpenAI error: {e}")
            raise
    
    async def analyze_fraud_patterns(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze transaction for fraud patterns using OpenAI"""
        prompt = f"""
        Analyze the following transaction data for potential fraud indicators:
        
        Transaction Details:
        - Amount: ${transaction_data.get('amount', 'N/A')}
        - Merchant: {transaction_data.get('merchant_id', 'N/A')}
        - Location: {transaction_data.get('location', 'N/A')}
        - Time: {transaction_data.get('timestamp', 'N/A')}
        - Payment Method: {transaction_data.get('payment_method', 'N/A')}
        
        Provide a fraud risk assessment with:
        1. Risk level (LOW/MEDIUM/HIGH)
        2. Key risk factors identified
        3. Confidence score (0-1)
        4. Recommended actions
        
        Format as JSON.
        """
        
        result = await self.generate_text(prompt, temperature=0.3)
        
        try:
            import json
            analysis = json.loads(result["text"])
            analysis.update({
                "provider": self.provider_type,
                "processing_time": result["response_time"]
            })
            return analysis
        except json.JSONDecodeError:
            return {
                "risk_level": "MEDIUM",
                "confidence": 0.5,
                "explanation": result["text"],
                "provider": self.provider_type,
                "processing_time": result["response_time"]
            }
    
    def _calculate_cost(self, tokens: int) -> float:
        """Calculate cost based on token usage"""
        # GPT-3.5-turbo pricing (approximate)
        cost_per_1k_tokens = 0.002
        return (tokens / 1000) * cost_per_1k_tokens


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(ProviderType.ANTHROPIC, config)
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = config.get("model", "claude-3-sonnet-20240229")
    
    async def generate_text(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Generate text using Anthropic Claude"""
        start_time = time.time()
        
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=kwargs.get("max_tokens", 500),
                messages=[{"role": "user", "content": prompt}]
            )
            
            response_time = time.time() - start_time
            cost = self._calculate_cost(response.usage.input_tokens + response.usage.output_tokens)
            
            self.update_stats(response_time, cost)
            
            result = {
                "text": response.content[0].text,
                "provider": self.provider_type,
                "model": self.model,
                "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
                "cost": cost,
                "response_time": response_time
            }
            
            return result
            
        except Exception as e:
            response_time = time.time() - start_time
            self.update_stats(response_time, error=True)
            logger.error(f"Anthropic error: {e}")
            raise
    
    async def analyze_fraud_patterns(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze transaction for fraud patterns using Claude"""
        prompt = f"""
        As a fraud detection expert, analyze this transaction for potential fraud:
        
        {transaction_data}
        
        Provide a structured analysis including:
        - Risk assessment (LOW/MEDIUM/HIGH)
        - Specific fraud indicators found
        - Confidence level (0.0-1.0)
        - Explanation of reasoning
        
        Be precise and focus on actionable insights.
        """
        
        result = await self.generate_text(prompt, temperature=0.2)
        
        return {
            "analysis": result["text"],
            "provider": self.provider_type,
            "processing_time": result["response_time"],
            "cost": result["cost"]
        }
    
    def _calculate_cost(self, tokens: int) -> float:
        """Calculate cost based on token usage"""
        # Claude pricing (approximate)
        cost_per_1k_tokens = 0.003
        return (tokens / 1000) * cost_per_1k_tokens


class LocalProvider(LLMProvider):
    """Local model provider (using Hugging Face)"""
    
    def __init__(self, config: Dict[str, Any], model_manager):
        super().__init__(ProviderType.LOCAL, config)
        self.model_manager = model_manager
        self.model_name = config.get("model", "microsoft/DialoGPT-medium")
    
    async def generate_text(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Generate text using local model"""
        start_time = time.time()
        
        try:
            # Use Hugging Face model for text generation
            if self.model_name not in self.model_manager.loaded_models:
                await self.model_manager.load_model(self.model_name, task="text-generation")
            
            # Simple text generation (would need more sophisticated implementation)
            result = await self.model_manager.analyze_transaction_text(prompt, self.model_name)
            
            response_time = time.time() - start_time
            self.update_stats(response_time)
            
            return {
                "text": f"Local analysis: {result.get('sentiment', 'neutral')}",
                "provider": self.provider_type,
                "model": self.model_name,
                "response_time": response_time,
                "cost": 0.0  # No cost for local models
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            self.update_stats(response_time, error=True)
            logger.error(f"Local provider error: {e}")
            raise
    
    async def analyze_fraud_patterns(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze transaction using local models"""
        # Use embeddings and anomaly detection
        text_data = str(transaction_data)
        embeddings = await self.model_manager.generate_embeddings([text_data])
        anomaly_result = await self.model_manager.detect_anomalies(embeddings[0])
        
        return {
            "anomaly_detected": anomaly_result["anomaly_detected"],
            "risk_level": "HIGH" if anomaly_result["anomaly_detected"] else "LOW",
            "confidence": 0.7,
            "provider": self.provider_type,
            "processing_time": 0.1  # Fast local processing
        }


class LLMProviderManager:
    """Manages multiple LLM providers with failover and load balancing"""
    
    def __init__(self):
        self.providers: Dict[str, LLMProvider] = {}
        self.provider_weights: Dict[str, float] = {}
        self.model_manager = None
        self.cost_tracker = CostTracker()
    
    def set_model_manager(self, model_manager):
        """Set the model manager for local providers"""
        self.model_manager = model_manager
    
    async def initialize_providers(self):
        """Initialize all available providers"""
        providers_config = {
            "openai": {"model": "gpt-3.5-turbo", "weight": 0.4},
            "anthropic": {"model": "claude-3-sonnet-20240229", "weight": 0.4},
            "local": {"model": "microsoft/DialoGPT-medium", "weight": 0.2}
        }
        
        for provider_name, config in providers_config.items():
            try:
                if provider_name == "openai" and settings.OPENAI_API_KEY:
                    provider = OpenAIProvider(config)
                elif provider_name == "anthropic" and settings.ANTHROPIC_API_KEY:
                    provider = AnthropicProvider(config)
                elif provider_name == "local" and self.model_manager:
                    provider = LocalProvider(config, self.model_manager)
                else:
                    continue
                
                self.providers[provider_name] = provider
                self.provider_weights[provider_name] = config["weight"]
                logger.info(f"Initialized provider: {provider_name}")
                
            except Exception as e:
                logger.error(f"Failed to initialize provider {provider_name}: {e}")
    
    def select_provider(self, prefer_local: bool = False) -> Optional[LLMProvider]:
        """Select best available provider based on health and weights"""
        if not self.providers:
            return None
        
        if prefer_local and "local" in self.providers:
            return self.providers["local"]
        
        # Calculate weighted scores
        available_providers = []
        for name, provider in self.providers.items():
            if provider.status != ProviderStatus.UNAVAILABLE:
                health_score = provider.get_health_score()
                weight = self.provider_weights.get(name, 0.1)
                score = health_score * weight
                available_providers.append((score, provider))
        
        if not available_providers:
            return None
        
        # Select provider with highest score (with some randomization)
        available_providers.sort(key=lambda x: x[0], reverse=True)
        
        # Use weighted random selection from top providers
        top_providers = available_providers[:2]  # Consider top 2
        weights = [score for score, _ in top_providers]
        selected = random.choices(top_providers, weights=weights)[0]
        
        return selected[1]
    
    async def generate_with_failover(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Generate text with automatic failover"""
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            provider = self.select_provider()
            if not provider:
                raise Exception("No available providers")
            
            # Check cost limits before making request
            daily_check = self.cost_tracker.check_daily_limit(provider.provider_type)
            if daily_check["limit_exceeded"]:
                logger.warning(f"Daily limit exceeded for {provider.provider_type}, trying next provider")
                provider.status = ProviderStatus.DEGRADED
                continue
            
            try:
                result = await provider.generate_text(prompt, **kwargs)
                
                # Record cost
                if result.get("cost", 0) > 0:
                    self.cost_tracker.record_cost(
                        provider=provider.provider_type,
                        model=result.get("model", "unknown"),
                        tokens_used=result.get("tokens_used", 0),
                        cost=result["cost"],
                        request_type="text_generation",
                        user_id=kwargs.get("user_id"),
                        api_key_id=kwargs.get("api_key_id")
                    )
                
                return result
                
            except Exception as e:
                last_error = e
                provider.status = ProviderStatus.DEGRADED
                logger.warning(f"Provider {provider.provider_type} failed, trying next: {e}")
                
                # Mark as unavailable after multiple failures
                if provider.error_count > 5:
                    provider.status = ProviderStatus.UNAVAILABLE
        
        raise Exception(f"All providers failed. Last error: {last_error}")
    
    async def analyze_fraud_with_consensus(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze fraud using multiple providers for consensus"""
        results = []
        
        # Try to get results from multiple providers
        for provider_name, provider in self.providers.items():
            if provider.status != ProviderStatus.UNAVAILABLE:
                try:
                    result = await provider.analyze_fraud_patterns(transaction_data)
                    result["provider_name"] = provider_name
                    results.append(result)
                except Exception as e:
                    logger.warning(f"Provider {provider_name} failed fraud analysis: {e}")
        
        if not results:
            raise Exception("No providers available for fraud analysis")
        
        # Combine results for consensus
        return self._combine_fraud_results(results)
    
    def _combine_fraud_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Combine multiple fraud analysis results"""
        if len(results) == 1:
            return results[0]
        
        # Simple consensus logic
        risk_levels = [r.get("risk_level", "MEDIUM") for r in results]
        confidences = [r.get("confidence", 0.5) for r in results]
        
        # Determine consensus risk level
        high_count = risk_levels.count("HIGH")
        medium_count = risk_levels.count("MEDIUM")
        low_count = risk_levels.count("LOW")
        
        if high_count >= len(results) / 2:
            consensus_risk = "HIGH"
        elif low_count >= len(results) / 2:
            consensus_risk = "LOW"
        else:
            consensus_risk = "MEDIUM"
        
        return {
            "risk_level": consensus_risk,
            "confidence": sum(confidences) / len(confidences),
            "provider_count": len(results),
            "individual_results": results,
            "consensus": True
        }
    
    async def cleanup(self):
        """Clean up all providers"""
        logger.info("Cleaning up LLM providers...")
        self.providers.clear()
        self.provider_weights.clear()
    
    def get_provider_stats(self) -> Dict[str, Any]:
        """Get statistics for all providers"""
        stats = {
            "total_providers": len(self.providers),
            "providers": {},
            "cost_analytics": self.cost_tracker.get_all_provider_stats()
        }
        
        for name, provider in self.providers.items():
            daily_check = self.cost_tracker.check_daily_limit(name)
            monthly_check = self.cost_tracker.check_monthly_limit(name)
            
            stats["providers"][name] = {
                "status": provider.status,
                "request_count": provider.request_count,
                "error_count": provider.error_count,
                "error_rate": provider.error_count / max(provider.request_count, 1),
                "avg_response_time": provider.avg_response_time,
                "total_cost": provider.total_cost,
                "health_score": provider.get_health_score(),
                "daily_cost_status": daily_check,
                "monthly_cost_status": monthly_check
            }
        
        return stats
    
    def get_cost_analytics(self) -> Dict[str, Any]:
        """Get detailed cost analytics"""
        return self.cost_tracker.get_all_provider_stats()
    
    def set_cost_limits(self, provider: str, daily_limit: float, monthly_limit: float):
        """Set cost limits for a provider"""
        self.cost_tracker.set_limits(provider, daily_limit, monthly_limit)
    
    def get_cost_optimization_recommendations(self) -> Dict[str, Any]:
        """Get cost optimization recommendations"""
        return self.cost_tracker.optimize_provider_selection()