"""
Cost tracking and analytics for LLM providers
"""

import time
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


@dataclass
class CostEntry:
    """Individual cost entry for tracking"""
    timestamp: datetime
    provider: str
    model: str
    tokens_used: int
    cost: float
    request_type: str
    user_id: Optional[str] = None
    api_key_id: Optional[str] = None


@dataclass
class ProviderCostSummary:
    """Cost summary for a provider"""
    provider: str
    total_cost: float = 0.0
    total_requests: int = 0
    total_tokens: int = 0
    avg_cost_per_request: float = 0.0
    avg_cost_per_token: float = 0.0
    cost_by_model: Dict[str, float] = field(default_factory=dict)
    requests_by_model: Dict[str, int] = field(default_factory=dict)


class CostTracker:
    """Tracks and analyzes LLM provider costs"""
    
    def __init__(self):
        self.cost_entries: List[CostEntry] = []
        self.daily_limits: Dict[str, float] = {
            "openai": 50.0,      # $50 daily limit
            "anthropic": 30.0,   # $30 daily limit
            "local": 0.0         # No cost for local models
        }
        self.monthly_limits: Dict[str, float] = {
            "openai": 1000.0,    # $1000 monthly limit
            "anthropic": 500.0,  # $500 monthly limit
            "local": 0.0
        }
    
    def record_cost(self, provider: str, model: str, tokens_used: int, 
                   cost: float, request_type: str, user_id: Optional[str] = None,
                   api_key_id: Optional[str] = None):
        """Record a cost entry"""
        entry = CostEntry(
            timestamp=datetime.now(),
            provider=provider,
            model=model,
            tokens_used=tokens_used,
            cost=cost,
            request_type=request_type,
            user_id=user_id,
            api_key_id=api_key_id
        )
        
        self.cost_entries.append(entry)
        logger.info(f"Recorded cost: {provider} - ${cost:.4f} for {tokens_used} tokens")
    
    def get_daily_cost(self, provider: str, date: Optional[datetime] = None) -> float:
        """Get daily cost for a provider"""
        if date is None:
            date = datetime.now()
        
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        daily_cost = sum(
            entry.cost for entry in self.cost_entries
            if entry.provider == provider and start_of_day <= entry.timestamp < end_of_day
        )
        
        return daily_cost
    
    def get_monthly_cost(self, provider: str, year: int, month: int) -> float:
        """Get monthly cost for a provider"""
        monthly_cost = sum(
            entry.cost for entry in self.cost_entries
            if (entry.provider == provider and 
                entry.timestamp.year == year and 
                entry.timestamp.month == month)
        )
        
        return monthly_cost
    
    def check_daily_limit(self, provider: str) -> Dict[str, Any]:
        """Check if daily limit is exceeded"""
        daily_cost = self.get_daily_cost(provider)
        daily_limit = self.daily_limits.get(provider, 0.0)
        
        return {
            "provider": provider,
            "daily_cost": daily_cost,
            "daily_limit": daily_limit,
            "limit_exceeded": daily_cost >= daily_limit,
            "remaining_budget": max(0, daily_limit - daily_cost),
            "usage_percentage": (daily_cost / daily_limit * 100) if daily_limit > 0 else 0
        }
    
    def check_monthly_limit(self, provider: str) -> Dict[str, Any]:
        """Check if monthly limit is exceeded"""
        now = datetime.now()
        monthly_cost = self.get_monthly_cost(provider, now.year, now.month)
        monthly_limit = self.monthly_limits.get(provider, 0.0)
        
        return {
            "provider": provider,
            "monthly_cost": monthly_cost,
            "monthly_limit": monthly_limit,
            "limit_exceeded": monthly_cost >= monthly_limit,
            "remaining_budget": max(0, monthly_limit - monthly_cost),
            "usage_percentage": (monthly_cost / monthly_limit * 100) if monthly_limit > 0 else 0
        }
    
    def get_provider_summary(self, provider: str, days: int = 30) -> ProviderCostSummary:
        """Get cost summary for a provider over specified days"""
        cutoff_date = datetime.now() - timedelta(days=days)
        
        relevant_entries = [
            entry for entry in self.cost_entries
            if entry.provider == provider and entry.timestamp >= cutoff_date
        ]
        
        if not relevant_entries:
            return ProviderCostSummary(provider=provider)
        
        total_cost = sum(entry.cost for entry in relevant_entries)
        total_requests = len(relevant_entries)
        total_tokens = sum(entry.tokens_used for entry in relevant_entries)
        
        # Group by model
        cost_by_model = {}
        requests_by_model = {}
        
        for entry in relevant_entries:
            model = entry.model
            cost_by_model[model] = cost_by_model.get(model, 0.0) + entry.cost
            requests_by_model[model] = requests_by_model.get(model, 0) + 1
        
        return ProviderCostSummary(
            provider=provider,
            total_cost=total_cost,
            total_requests=total_requests,
            total_tokens=total_tokens,
            avg_cost_per_request=total_cost / total_requests if total_requests > 0 else 0.0,
            avg_cost_per_token=total_cost / total_tokens if total_tokens > 0 else 0.0,
            cost_by_model=cost_by_model,
            requests_by_model=requests_by_model
        )
    
    def get_cost_trends(self, provider: str, days: int = 7) -> Dict[str, List[float]]:
        """Get daily cost trends for a provider"""
        trends = {"dates": [], "costs": []}
        
        for i in range(days):
            date = datetime.now() - timedelta(days=days - 1 - i)
            daily_cost = self.get_daily_cost(provider, date)
            trends["dates"].append(date.strftime("%Y-%m-%d"))
            trends["costs"].append(daily_cost)
        
        return trends
    
    def get_top_expensive_requests(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the most expensive requests"""
        sorted_entries = sorted(self.cost_entries, key=lambda x: x.cost, reverse=True)
        
        return [
            {
                "timestamp": entry.timestamp.isoformat(),
                "provider": entry.provider,
                "model": entry.model,
                "cost": entry.cost,
                "tokens_used": entry.tokens_used,
                "request_type": entry.request_type,
                "cost_per_token": entry.cost / entry.tokens_used if entry.tokens_used > 0 else 0
            }
            for entry in sorted_entries[:limit]
        ]
    
    def optimize_provider_selection(self) -> Dict[str, Any]:
        """Analyze provider performance and suggest optimizations"""
        recommendations = []
        
        # Analyze each provider
        for provider in ["openai", "anthropic", "local"]:
            summary = self.get_provider_summary(provider)
            daily_check = self.check_daily_limit(provider)
            monthly_check = self.check_monthly_limit(provider)
            
            if summary.total_requests == 0:
                continue
            
            # Check for cost efficiency
            if summary.avg_cost_per_token > 0.005:  # High cost per token
                recommendations.append({
                    "provider": provider,
                    "type": "cost_optimization",
                    "message": f"Consider using local models for simple tasks. Current cost: ${summary.avg_cost_per_token:.6f}/token"
                })
            
            # Check for limit warnings
            if daily_check["usage_percentage"] > 80:
                recommendations.append({
                    "provider": provider,
                    "type": "limit_warning",
                    "message": f"Daily limit {daily_check['usage_percentage']:.1f}% used. Consider rate limiting."
                })
            
            if monthly_check["usage_percentage"] > 90:
                recommendations.append({
                    "provider": provider,
                    "type": "limit_critical",
                    "message": f"Monthly limit {monthly_check['usage_percentage']:.1f}% used. Urgent action needed."
                })
        
        return {
            "recommendations": recommendations,
            "total_providers_analyzed": len([p for p in ["openai", "anthropic", "local"] 
                                           if self.get_provider_summary(p).total_requests > 0])
        }
    
    def export_cost_data(self, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Export cost data for a date range"""
        filtered_entries = [
            entry for entry in self.cost_entries
            if start_date <= entry.timestamp <= end_date
        ]
        
        return [
            {
                "timestamp": entry.timestamp.isoformat(),
                "provider": entry.provider,
                "model": entry.model,
                "tokens_used": entry.tokens_used,
                "cost": entry.cost,
                "request_type": entry.request_type,
                "user_id": entry.user_id,
                "api_key_id": entry.api_key_id
            }
            for entry in filtered_entries
        ]
    
    def set_limits(self, provider: str, daily_limit: float, monthly_limit: float):
        """Set cost limits for a provider"""
        self.daily_limits[provider] = daily_limit
        self.monthly_limits[provider] = monthly_limit
        logger.info(f"Updated limits for {provider}: daily=${daily_limit}, monthly=${monthly_limit}")
    
    def get_all_provider_stats(self) -> Dict[str, Any]:
        """Get comprehensive stats for all providers"""
        stats = {
            "providers": {},
            "total_cost": 0.0,
            "total_requests": len(self.cost_entries),
            "cost_optimization": self.optimize_provider_selection()
        }
        
        for provider in ["openai", "anthropic", "local"]:
            summary = self.get_provider_summary(provider)
            daily_check = self.check_daily_limit(provider)
            monthly_check = self.check_monthly_limit(provider)
            trends = self.get_cost_trends(provider)
            
            stats["providers"][provider] = {
                "summary": summary.__dict__,
                "daily_status": daily_check,
                "monthly_status": monthly_check,
                "trends": trends
            }
            
            stats["total_cost"] += summary.total_cost
        
        return stats