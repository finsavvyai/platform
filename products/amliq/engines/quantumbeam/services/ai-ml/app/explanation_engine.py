"""
AI-enhanced fraud explanation system
Generates natural language explanations for fraud detection decisions
"""

import logging
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import json
import re

logger = logging.getLogger(__name__)


class ExplanationStyle(str, Enum):
    TECHNICAL = "technical"      # For developers and analysts
    BUSINESS = "business"        # For business stakeholders
    CUSTOMER = "customer"        # For customer-facing explanations
    REGULATORY = "regulatory"    # For compliance and regulatory reporting


class ConfidenceLevel(str, Enum):
    VERY_HIGH = "very_high"     # 90-100%
    HIGH = "high"               # 75-89%
    MEDIUM = "medium"           # 50-74%
    LOW = "low"                 # 25-49%
    VERY_LOW = "very_low"       # 0-24%


@dataclass
class FraudIndicator:
    """Individual fraud indicator with explanation"""
    name: str
    value: float
    threshold: float
    severity: str  # "low", "medium", "high", "critical"
    description: str
    impact_score: float  # 0-1 scale


@dataclass
class ExplanationContext:
    """Context for generating explanations"""
    transaction_data: Dict[str, Any]
    fraud_score: float
    risk_level: str
    confidence: float
    indicators: List[FraudIndicator]
    ai_analysis: Optional[Dict[str, Any]] = None
    text_analysis: Optional[Dict[str, Any]] = None
    anomaly_detection: Optional[Dict[str, Any]] = None
    historical_patterns: Optional[Dict[str, Any]] = None


class FraudExplanationEngine:
    """Generates comprehensive fraud explanations using AI"""
    
    def __init__(self, llm_provider_manager):
        self.llm_manager = llm_provider_manager
        self.explanation_templates = self._load_explanation_templates()
        self.fraud_patterns = self._load_fraud_patterns()
    
    def _load_explanation_templates(self) -> Dict[str, Dict[str, str]]:
        """Load explanation templates for different styles"""
        return {
            ExplanationStyle.TECHNICAL: {
                "high_risk": """
                Technical Analysis: Transaction flagged as HIGH RISK (Score: {fraud_score:.2f})
                
                Key Risk Factors:
                {risk_factors}
                
                Algorithm Confidence: {confidence:.1%}
                Processing Method: {processing_method}
                
                Recommended Actions:
                - Block transaction pending manual review
                - Verify customer identity through additional authentication
                - Check for related suspicious activities
                """,
                "medium_risk": """
                Technical Analysis: Transaction flagged as MEDIUM RISK (Score: {fraud_score:.2f})
                
                Risk Indicators:
                {risk_factors}
                
                Algorithm Confidence: {confidence:.1%}
                
                Recommended Actions:
                - Apply additional verification steps
                - Monitor for related patterns
                - Consider transaction limits
                """,
                "low_risk": """
                Technical Analysis: Transaction approved as LOW RISK (Score: {fraud_score:.2f})
                
                Validation Checks:
                {risk_factors}
                
                Algorithm Confidence: {confidence:.1%}
                
                Status: Approved for processing
                """
            },
            ExplanationStyle.BUSINESS: {
                "high_risk": """
                FRAUD ALERT: High-risk transaction detected
                
                This transaction shows multiple indicators of potential fraud:
                {business_factors}
                
                Financial Impact: Potential loss of ${amount}
                Confidence Level: {confidence_level}
                
                Immediate Actions Required:
                - Transaction blocked automatically
                - Customer service team notified
                - Risk management review initiated
                """,
                "medium_risk": """
                CAUTION: Elevated fraud risk detected
                
                This transaction requires additional scrutiny:
                {business_factors}
                
                Transaction Amount: ${amount}
                Risk Assessment: {confidence_level}
                
                Recommended Actions:
                - Enhanced verification required
                - Monitor customer account closely
                - Review transaction patterns
                """,
                "low_risk": """
                APPROVED: Transaction cleared security checks
                
                Transaction validated successfully:
                {business_factors}
                
                Transaction Amount: ${amount}
                Security Status: Verified
                
                Status: Approved for processing
                """
            },
            ExplanationStyle.CUSTOMER: {
                "high_risk": """
                We've temporarily held your transaction for security reasons.
                
                Our fraud protection system detected unusual activity that requires verification:
                {customer_factors}
                
                What happens next:
                - We'll contact you shortly to verify this transaction
                - Your account remains secure and protected
                - Once verified, the transaction will be processed
                
                This is a precautionary measure to protect your account.
                """,
                "medium_risk": """
                Additional verification required for your transaction.
                
                For your security, we need to confirm:
                {customer_factors}
                
                Please verify:
                - Your identity through our secure verification process
                - The transaction details are correct
                
                This helps us keep your account safe from fraud.
                """,
                "low_risk": """
                Your transaction has been approved and processed successfully.
                
                Security checks completed:
                {customer_factors}
                
                Your transaction is secure and has been processed normally.
                """
            }
        }
    
    def _load_fraud_patterns(self) -> Dict[str, Dict[str, Any]]:
        """Load known fraud patterns and their explanations"""
        return {
            "velocity_fraud": {
                "description": "Multiple transactions in short time period",
                "indicators": ["high_velocity_1h", "high_velocity_24h"],
                "explanation": "Unusual transaction frequency detected"
            },
            "amount_anomaly": {
                "description": "Transaction amount significantly different from normal",
                "indicators": ["amount_zscore_high", "amount_outlier"],
                "explanation": "Transaction amount is unusual for this account"
            },
            "location_anomaly": {
                "description": "Transaction from unusual or high-risk location",
                "indicators": ["location_risk_high", "geo_velocity"],
                "explanation": "Transaction location is inconsistent with normal patterns"
            },
            "device_anomaly": {
                "description": "Transaction from new or suspicious device",
                "indicators": ["new_device", "device_risk_high"],
                "explanation": "Transaction from unrecognized device"
            },
            "merchant_risk": {
                "description": "Transaction with high-risk merchant",
                "indicators": ["merchant_risk_high", "merchant_category_risk"],
                "explanation": "Merchant has elevated fraud risk profile"
            },
            "behavioral_anomaly": {
                "description": "Transaction pattern inconsistent with user behavior",
                "indicators": ["behavior_score_low", "pattern_deviation"],
                "explanation": "Transaction doesn't match typical user behavior"
            }
        }
    
    async def generate_explanation(self, context: ExplanationContext, 
                                 style: ExplanationStyle = ExplanationStyle.TECHNICAL,
                                 include_recommendations: bool = True) -> Dict[str, Any]:
        """Generate comprehensive fraud explanation"""
        start_time = time.time()
        
        try:
            # Analyze fraud indicators
            analyzed_indicators = self._analyze_indicators(context.indicators)
            
            # Determine confidence level
            confidence_level = self._determine_confidence_level(context.confidence)
            
            # Generate base explanation using templates
            base_explanation = self._generate_base_explanation(
                context, style, confidence_level, analyzed_indicators
            )
            
            # Enhance with AI-generated insights
            ai_insights = await self._generate_ai_insights(context, style)
            
            # Generate pattern analysis
            pattern_analysis = self._analyze_fraud_patterns(context)
            
            # Create recommendations
            recommendations = []
            if include_recommendations:
                recommendations = self._generate_recommendations(context, style)
            
            # Compile final explanation
            explanation = {
                "summary": base_explanation,
                "ai_insights": ai_insights,
                "pattern_analysis": pattern_analysis,
                "confidence_breakdown": self._generate_confidence_breakdown(context),
                "risk_factors": analyzed_indicators,
                "recommendations": recommendations,
                "style": style,
                "confidence_level": confidence_level,
                "processing_time": time.time() - start_time
            }
            
            return explanation
            
        except Exception as e:
            logger.error(f"Error generating explanation: {e}")
            return self._generate_fallback_explanation(context, style)
    
    def _analyze_indicators(self, indicators: List[FraudIndicator]) -> List[Dict[str, Any]]:
        """Analyze and categorize fraud indicators"""
        analyzed = []
        
        for indicator in indicators:
            analysis = {
                "name": indicator.name,
                "value": indicator.value,
                "threshold": indicator.threshold,
                "severity": indicator.severity,
                "description": indicator.description,
                "impact_score": indicator.impact_score,
                "triggered": indicator.value > indicator.threshold,
                "deviation": indicator.value - indicator.threshold if indicator.value > indicator.threshold else 0
            }
            analyzed.append(analysis)
        
        # Sort by impact score (highest first)
        analyzed.sort(key=lambda x: x["impact_score"], reverse=True)
        
        return analyzed
    
    def _determine_confidence_level(self, confidence: float) -> ConfidenceLevel:
        """Determine confidence level from numeric confidence"""
        if confidence >= 0.9:
            return ConfidenceLevel.VERY_HIGH
        elif confidence >= 0.75:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.5:
            return ConfidenceLevel.MEDIUM
        elif confidence >= 0.25:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.VERY_LOW
    
    def _generate_base_explanation(self, context: ExplanationContext, 
                                 style: ExplanationStyle, 
                                 confidence_level: ConfidenceLevel,
                                 indicators: List[Dict[str, Any]]) -> str:
        """Generate base explanation using templates"""
        risk_level = context.risk_level.lower()
        template = self.explanation_templates[style].get(risk_level, 
                   self.explanation_templates[style]["medium_risk"])
        
        # Format risk factors based on style
        if style == ExplanationStyle.TECHNICAL:
            risk_factors = self._format_technical_factors(indicators)
        elif style == ExplanationStyle.BUSINESS:
            risk_factors = self._format_business_factors(indicators, context)
        elif style == ExplanationStyle.CUSTOMER:
            risk_factors = self._format_customer_factors(indicators)
        else:
            risk_factors = self._format_technical_factors(indicators)
        
        # Get transaction amount
        amount = context.transaction_data.get("amount", "0.00")
        
        return template.format(
            fraud_score=context.fraud_score,
            confidence=context.confidence,
            confidence_level=confidence_level.value.replace("_", " ").title(),
            risk_factors=risk_factors,
            business_factors=risk_factors,
            customer_factors=risk_factors,
            amount=amount,
            processing_method=context.transaction_data.get("processing_method", "ai_enhanced")
        )
    
    def _format_technical_factors(self, indicators: List[Dict[str, Any]]) -> str:
        """Format risk factors for technical audience"""
        factors = []
        for indicator in indicators[:5]:  # Top 5 indicators
            if indicator["triggered"]:
                factors.append(
                    f"• {indicator['name']}: {indicator['value']:.3f} "
                    f"(threshold: {indicator['threshold']:.3f}, "
                    f"severity: {indicator['severity']}, "
                    f"impact: {indicator['impact_score']:.2f})"
                )
        
        return "\n".join(factors) if factors else "• All indicators within normal ranges"
    
    def _format_business_factors(self, indicators: List[Dict[str, Any]], 
                               context: ExplanationContext) -> str:
        """Format risk factors for business audience"""
        factors = []
        high_impact_indicators = [i for i in indicators if i["impact_score"] > 0.7]
        
        for indicator in high_impact_indicators[:3]:  # Top 3 high-impact
            if indicator["triggered"]:
                business_description = self._get_business_description(indicator["name"])
                factors.append(f"• {business_description}")
        
        if not factors:
            factors.append("• Transaction patterns within acceptable risk parameters")
        
        return "\n".join(factors)
    
    def _format_customer_factors(self, indicators: List[Dict[str, Any]]) -> str:
        """Format risk factors for customer-friendly explanation"""
        factors = []
        customer_relevant = [i for i in indicators if i["severity"] in ["high", "critical"]]
        
        for indicator in customer_relevant[:2]:  # Top 2 customer-relevant
            if indicator["triggered"]:
                customer_description = self._get_customer_description(indicator["name"])
                factors.append(f"• {customer_description}")
        
        if not factors:
            factors.append("• Standard security verification completed")
        
        return "\n".join(factors)
    
    def _get_business_description(self, indicator_name: str) -> str:
        """Get business-friendly description for indicator"""
        business_descriptions = {
            "velocity_1h": "High transaction frequency in the last hour",
            "velocity_24h": "Unusual transaction volume in 24 hours",
            "amount_zscore": "Transaction amount significantly above normal",
            "location_risk": "Transaction from high-risk geographic location",
            "device_risk": "Transaction from unrecognized or risky device",
            "merchant_risk": "Transaction with merchant flagged for elevated risk",
            "behavior_score": "Transaction pattern inconsistent with user behavior"
        }
        return business_descriptions.get(indicator_name, f"Risk indicator: {indicator_name}")
    
    def _get_customer_description(self, indicator_name: str) -> str:
        """Get customer-friendly description for indicator"""
        customer_descriptions = {
            "velocity_1h": "Multiple transactions detected in a short time",
            "velocity_24h": "Higher than usual transaction activity today",
            "amount_zscore": "Transaction amount is much larger than usual",
            "location_risk": "Transaction from a new or unusual location",
            "device_risk": "Transaction from a device we don't recognize",
            "merchant_risk": "Transaction with a merchant requiring extra verification",
            "behavior_score": "Transaction doesn't match your usual spending pattern"
        }
        return customer_descriptions.get(indicator_name, "Unusual transaction characteristic detected")
    
    async def _generate_ai_insights(self, context: ExplanationContext, 
                                  style: ExplanationStyle) -> str:
        """Generate AI-powered insights about the fraud decision"""
        try:
            prompt = self._build_ai_insights_prompt(context, style)
            
            result = await self.llm_manager.generate_with_failover(
                prompt=prompt,
                max_tokens=200,
                temperature=0.3  # Lower temperature for consistent insights
            )
            
            return result.get("text", "AI insights unavailable")
            
        except Exception as e:
            logger.error(f"Error generating AI insights: {e}")
            return "Advanced AI analysis completed - see detailed breakdown above"
    
    def _build_ai_insights_prompt(self, context: ExplanationContext, 
                                style: ExplanationStyle) -> str:
        """Build prompt for AI insights generation"""
        style_instructions = {
            ExplanationStyle.TECHNICAL: "Provide technical insights for fraud analysts",
            ExplanationStyle.BUSINESS: "Provide business-focused insights for stakeholders",
            ExplanationStyle.CUSTOMER: "Provide customer-friendly insights",
            ExplanationStyle.REGULATORY: "Provide compliance-focused insights"
        }
        
        prompt = f"""
        Analyze this fraud detection result and provide {style_instructions[style]}:
        
        Transaction: ${context.transaction_data.get('amount', 'N/A')} 
        Risk Level: {context.risk_level}
        Fraud Score: {context.fraud_score:.2f}
        Confidence: {context.confidence:.1%}
        
        Key Risk Factors:
        {', '.join([i.name for i in context.indicators[:3]])}
        
        Provide 2-3 key insights about why this decision was made and what it means.
        Keep response under 150 words and focus on actionable information.
        """
        
        return prompt
    
    def _analyze_fraud_patterns(self, context: ExplanationContext) -> Dict[str, Any]:
        """Analyze detected fraud patterns"""
        detected_patterns = []
        
        for pattern_name, pattern_info in self.fraud_patterns.items():
            # Check if any indicators match this pattern
            matching_indicators = []
            for indicator in context.indicators:
                if any(pattern_indicator in indicator.name.lower() 
                      for pattern_indicator in pattern_info["indicators"]):
                    matching_indicators.append(indicator.name)
            
            if matching_indicators:
                detected_patterns.append({
                    "pattern": pattern_name,
                    "description": pattern_info["description"],
                    "explanation": pattern_info["explanation"],
                    "matching_indicators": matching_indicators,
                    "severity": self._calculate_pattern_severity(matching_indicators, context.indicators)
                })
        
        return {
            "detected_patterns": detected_patterns,
            "pattern_count": len(detected_patterns),
            "primary_pattern": detected_patterns[0] if detected_patterns else None
        }
    
    def _calculate_pattern_severity(self, matching_indicators: List[str], 
                                  all_indicators: List[FraudIndicator]) -> str:
        """Calculate severity of detected pattern"""
        matching_scores = []
        for indicator in all_indicators:
            if indicator.name in matching_indicators:
                matching_scores.append(indicator.impact_score)
        
        if not matching_scores:
            return "low"
        
        avg_score = sum(matching_scores) / len(matching_scores)
        
        if avg_score >= 0.8:
            return "critical"
        elif avg_score >= 0.6:
            return "high"
        elif avg_score >= 0.4:
            return "medium"
        else:
            return "low"
    
    def _generate_confidence_breakdown(self, context: ExplanationContext) -> Dict[str, Any]:
        """Generate detailed confidence breakdown"""
        breakdown = {
            "overall_confidence": context.confidence,
            "confidence_sources": []
        }
        
        if context.ai_analysis:
            breakdown["confidence_sources"].append({
                "source": "AI Analysis",
                "confidence": context.ai_analysis.get("confidence", 0.5),
                "weight": 0.4
            })
        
        if context.text_analysis:
            breakdown["confidence_sources"].append({
                "source": "Text Analysis",
                "confidence": context.text_analysis.get("confidence", 0.5),
                "weight": 0.2
            })
        
        if context.anomaly_detection:
            anomaly_confidence = 0.8 if context.anomaly_detection.get("anomaly_detected") else 0.3
            breakdown["confidence_sources"].append({
                "source": "Anomaly Detection",
                "confidence": anomaly_confidence,
                "weight": 0.3
            })
        
        # Add indicator-based confidence
        if context.indicators:
            high_impact_indicators = [i for i in context.indicators if i.impact_score > 0.7]
            indicator_confidence = min(1.0, len(high_impact_indicators) * 0.2 + 0.5)
            breakdown["confidence_sources"].append({
                "source": "Risk Indicators",
                "confidence": indicator_confidence,
                "weight": 0.1
            })
        
        return breakdown
    
    def _generate_recommendations(self, context: ExplanationContext, 
                                style: ExplanationStyle) -> List[Dict[str, Any]]:
        """Generate actionable recommendations"""
        recommendations = []
        
        if context.risk_level.upper() == "HIGH":
            if style == ExplanationStyle.TECHNICAL:
                recommendations.extend([
                    {"action": "block_transaction", "priority": "immediate", 
                     "description": "Block transaction pending manual review"},
                    {"action": "verify_identity", "priority": "high",
                     "description": "Require additional identity verification"},
                    {"action": "monitor_account", "priority": "medium",
                     "description": "Monitor account for related suspicious activity"}
                ])
            elif style == ExplanationStyle.BUSINESS:
                recommendations.extend([
                    {"action": "risk_review", "priority": "immediate",
                     "description": "Escalate to risk management team"},
                    {"action": "customer_contact", "priority": "high",
                     "description": "Contact customer to verify transaction"},
                    {"action": "pattern_analysis", "priority": "medium",
                     "description": "Analyze for similar fraud patterns"}
                ])
        
        elif context.risk_level.upper() == "MEDIUM":
            recommendations.extend([
                {"action": "enhanced_verification", "priority": "high",
                 "description": "Apply additional verification steps"},
                {"action": "transaction_monitoring", "priority": "medium",
                 "description": "Monitor subsequent transactions closely"}
            ])
        
        return recommendations
    
    def _generate_fallback_explanation(self, context: ExplanationContext, 
                                     style: ExplanationStyle) -> Dict[str, Any]:
        """Generate fallback explanation when AI generation fails"""
        return {
            "summary": f"Transaction analyzed with {context.risk_level.lower()} risk level. "
                      f"Fraud score: {context.fraud_score:.2f}, Confidence: {context.confidence:.1%}",
            "ai_insights": "Detailed AI analysis temporarily unavailable",
            "pattern_analysis": {"detected_patterns": [], "pattern_count": 0},
            "confidence_breakdown": {"overall_confidence": context.confidence, "confidence_sources": []},
            "risk_factors": [{"name": i.name, "severity": i.severity} for i in context.indicators],
            "recommendations": [],
            "style": style,
            "confidence_level": self._determine_confidence_level(context.confidence),
            "processing_time": 0.0,
            "fallback": True
        }