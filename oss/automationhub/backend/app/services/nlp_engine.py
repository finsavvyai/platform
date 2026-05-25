"""
Natural Language Processing Excellence Engine
Advanced NLP with multi-language support and technical jargon understanding
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import uuid

# Optional NLP dependencies
try:
    import openai
    from langdetect import detect
    import spacy
    from transformers import pipeline
    NLP_DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    NLP_DEPENDENCIES_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"NLP dependencies not available: {e}. Service will run in fallback mode.")

logger = logging.getLogger(__name__)


class Language(Enum):
    """Supported languages"""
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    ITALIAN = "it"
    PORTUGUESE = "pt"
    RUSSIAN = "ru"
    CHINESE = "zh"
    JAPANESE = "ja"
    KOREAN = "ko"
    ARABIC = "ar"
    HINDI = "hi"


class Domain(Enum):
    """Technical domains for jargon understanding"""
    DEVOPS = "devops"
    CLOUD_COMPUTING = "cloud_computing"
    DATA_SCIENCE = "data_science"
    CYBERSECURITY = "cybersecurity"
    MACHINE_LEARNING = "machine_learning"
    WEB_DEVELOPMENT = "web_development"
    MOBILE_DEVELOPMENT = "mobile_development"
    BLOCKCHAIN = "blockchain"
    IOT = "iot"
    GENERAL = "general"


class IntentType(Enum):
    """User intent types"""
    CREATE = "create"
    EXECUTE = "execute"
    MODIFY = "modify"
    DELETE = "delete"
    QUERY = "query"
    HELP = "help"
    EXPLAIN = "explain"
    COMPARE = "compare"
    TROUBLESHOOT = "troubleshoot"
    OPTIMIZE = "optimize"


class SentimentType(Enum):
    """Sentiment analysis results"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    FRUSTRATED = "frustrated"
    EXCITED = "excited"
    CONFUSED = "confused"


@dataclass
class NLPAnalysis:
    """Comprehensive NLP analysis result"""
    original_text: str
    detected_language: Language
    confidence_score: float
    normalized_text: str
    intent: IntentType
    intent_confidence: float
    sentiment: SentimentType
    sentiment_score: float
    entities: List[Dict[str, Any]]
    technical_terms: List[Dict[str, str]]
    domain: Domain
    key_phrases: List[str]
    complexity_level: int  # 1-10 scale
    urgency_level: int  # 1-10 scale
    action_items: List[str]
    suggested_responses: List[str]


@dataclass
class TranslationResult:
    """Translation result with context preservation"""
    original_text: str
    source_language: Language
    target_language: Language
    translated_text: str
    technical_terms_preserved: List[str]
    confidence_score: float
    cultural_adaptations: List[str]


@dataclass
class IntentPrediction:
    """Intent prediction with context"""
    predicted_intent: IntentType
    confidence: float
    context_clues: List[str]
    next_likely_intents: List[Tuple[IntentType, float]]
    suggested_actions: List[str]


class NLPEngine:
    """
    Advanced Natural Language Processing Engine with
    multi-language support and technical domain expertise
    """

    def __init__(self):
        # Initialize OpenAI client with graceful fallback for testing
        try:
            self.openai_client = openai.AsyncOpenAI()
        except Exception as e:
            logger.warning(f"OpenAI client initialization failed: {e}. Using fallback mode.")
            self.openai_client = None

        self.nlp_models = {}
        self.domain_vocabularies = {}
        self.intent_patterns = {}
        self.translation_cache: Dict[str, TranslationResult] = {}

        # Initialize NLP models
        self._initialize_models()
        self._load_domain_vocabularies()
        self._load_intent_patterns()

    def _initialize_models(self):
        """Initialize language models and processors"""
        try:
            # Load spaCy models for different languages
            self.nlp_models[Language.ENGLISH] = spacy.load("en_core_web_sm")

            # Initialize sentiment analysis pipeline
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="cardiffnlp/twitter-roberta-base-sentiment-latest"
            )

            # Initialize named entity recognition
            self.ner_pipeline = pipeline(
                "ner",
                model="dbmdz/bert-large-cased-finetuned-conll03-english",
                aggregation_strategy="simple"
            )

            logger.info("NLP models initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize NLP models: {e}")
            # Continue with basic functionality

    def _load_domain_vocabularies(self):
        """Load technical vocabularies for different domains"""
        self.domain_vocabularies = {
            Domain.DEVOPS: {
                "terms": [
                    "CI/CD", "pipeline", "deployment", "container", "kubernetes",
                    "docker", "helm", "terraform", "ansible", "jenkins",
                    "monitoring", "prometheus", "grafana", "elasticsearch"
                ],
                "synonyms": {
                    "deployment": ["deploy", "release", "rollout"],
                    "container": ["pod", "image", "containerization"],
                    "monitoring": ["observability", "metrics", "logging"]
                }
            },
            Domain.CLOUD_COMPUTING: {
                "terms": [
                    "AWS", "Azure", "GCP", "EC2", "S3", "Lambda", "serverless",
                    "microservices", "load balancer", "auto scaling", "VPC",
                    "IAM", "CDN", "API Gateway", "RDS", "NoSQL"
                ],
                "synonyms": {
                    "serverless": ["lambda", "function", "FaaS"],
                    "load balancer": ["LB", "ALB", "NLB", "ELB"],
                    "auto scaling": ["autoscaling", "horizontal scaling"]
                }
            },
            Domain.DATA_SCIENCE: {
                "terms": [
                    "machine learning", "deep learning", "neural network",
                    "regression", "classification", "clustering", "pandas",
                    "numpy", "scikit-learn", "tensorflow", "pytorch",
                    "jupyter", "visualization", "feature engineering"
                ],
                "synonyms": {
                    "machine learning": ["ML", "artificial intelligence", "AI"],
                    "neural network": ["NN", "deep network"],
                    "visualization": ["plotting", "charting", "graphing"]
                }
            },
            Domain.CYBERSECURITY: {
                "terms": [
                    "vulnerability", "penetration testing", "firewall",
                    "encryption", "authentication", "authorization", "SSL",
                    "TLS", "OWASP", "security scan", "threat detection",
                    "incident response", "compliance", "audit"
                ],
                "synonyms": {
                    "vulnerability": ["vuln", "security flaw", "weakness"],
                    "penetration testing": ["pentest", "security testing"],
                    "authentication": ["auth", "login", "access control"]
                }
            }
        }

    def _load_intent_patterns(self):
        """Load patterns for intent recognition"""
        self.intent_patterns = {
            IntentType.CREATE: [
                r"(create|make|build|generate|set up|establish)",
                r"(new|fresh|from scratch)",
                r"(I want to|I need to|let's|please)"
            ],
            IntentType.EXECUTE: [
                r"(run|execute|start|launch|deploy|trigger)",
                r"(go ahead|proceed|continue)",
                r"(now|immediately|right away)"
            ],
            IntentType.MODIFY: [
                r"(change|modify|update|edit|alter|adjust)",
                r"(improve|enhance|optimize|fix)",
                r"(add|remove|delete|replace)"
            ],
            IntentType.QUERY: [
                r"(what|how|when|where|why|which)",
                r"(show me|tell me|explain|describe)",
                r"(status|information|details|list)"
            ],
            IntentType.HELP: [
                r"(help|assist|guide|support)",
                r"(don't know|confused|stuck|lost)",
                r"(tutorial|documentation|examples)"
            ],
            IntentType.TROUBLESHOOT: [
                r"(error|problem|issue|bug|failure)",
                r"(not working|broken|failed|crashed)",
                r"(troubleshoot|debug|diagnose|fix)"
            ]
        }

    async def analyze_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> NLPAnalysis:
        """Perform comprehensive NLP analysis on text"""
        try:
            logger.info(f"Analyzing text: {text[:100]}...")

            # Detect language
            detected_lang, lang_confidence = await self._detect_language(text)

            # Normalize text
            normalized_text = self._normalize_text(text)

            # Analyze intent
            intent, intent_confidence = await self._analyze_intent(normalized_text, context)

            # Analyze sentiment
            sentiment, sentiment_score = await self._analyze_sentiment(normalized_text)

            # Extract entities
            entities = await self._extract_entities(normalized_text)

            # Identify technical terms
            technical_terms, domain = await self._identify_technical_terms(normalized_text)

            # Extract key phrases
            key_phrases = await self._extract_key_phrases(normalized_text)

            # Calculate complexity and urgency
            complexity = self._calculate_complexity(normalized_text, technical_terms)
            urgency = self._calculate_urgency(normalized_text, sentiment)

            # Generate action items
            action_items = await self._generate_action_items(intent, entities, technical_terms)

            # Generate suggested responses
            suggested_responses = await self._generate_suggested_responses(
                intent, sentiment, domain, context
            )

            return NLPAnalysis(
                original_text=text,
                detected_language=detected_lang,
                confidence_score=lang_confidence,
                normalized_text=normalized_text,
                intent=intent,
                intent_confidence=intent_confidence,
                sentiment=sentiment,
                sentiment_score=sentiment_score,
                entities=entities,
                technical_terms=technical_terms,
                domain=domain,
                key_phrases=key_phrases,
                complexity_level=complexity,
                urgency_level=urgency,
                action_items=action_items,
                suggested_responses=suggested_responses
            )

        except Exception as e:
            logger.error(f"Text analysis failed: {e}")
            raise

    async def translate_with_context(
        self,
        text: str,
        target_language: Language,
        preserve_technical_terms: bool = True
    ) -> TranslationResult:
        """Translate text while preserving technical terms and context"""
        try:
            # Check cache
            cache_key = f"{text}_{target_language.value}_{preserve_technical_terms}"
            if cache_key in self.translation_cache:
                return self.translation_cache[cache_key]

            # Detect source language
            source_lang, _ = await self._detect_language(text)

            if source_lang == target_language:
                # No translation needed
                return TranslationResult(
                    original_text=text,
                    source_language=source_lang,
                    target_language=target_language,
                    translated_text=text,
                    technical_terms_preserved=[],
                    confidence_score=1.0,
                    cultural_adaptations=[]
                )

            # Identify technical terms to preserve
            preserved_terms = []
            if preserve_technical_terms:
                technical_terms, _ = await self._identify_technical_terms(text)
                preserved_terms = [term["term"] for term in technical_terms]

            # Perform translation with context
            translated_text = await self._translate_with_ai(
                text, source_lang, target_language, preserved_terms
            )

            # Calculate confidence
            confidence = await self._calculate_translation_confidence(
                text, translated_text, source_lang, target_language
            )

            # Identify cultural adaptations made
            cultural_adaptations = await self._identify_cultural_adaptations(
                text, translated_text, source_lang, target_language
            )

            result = TranslationResult(
                original_text=text,
                source_language=source_lang,
                target_language=target_language,
                translated_text=translated_text,
                technical_terms_preserved=preserved_terms,
                confidence_score=confidence,
                cultural_adaptations=cultural_adaptations
            )

            # Cache result
            self.translation_cache[cache_key] = result

            return result

        except Exception as e:
            logger.error(f"Translation failed: {e}")
            raise

    async def predict_intent_sequence(
        self,
        conversation_history: List[str],
        current_context: Optional[Dict[str, Any]] = None
    ) -> IntentPrediction:
        """Predict user's next intent based on conversation history"""
        try:
            # Analyze conversation flow
            recent_intents = []
            for message in conversation_history[-5:]:  # Last 5 messages
                intent, confidence = await self._analyze_intent(message, current_context)
                recent_intents.append((intent, confidence))

            # Predict next intent using sequence analysis
            predicted_intent, confidence = await self._predict_next_intent(
                recent_intents, current_context
            )

            # Identify context clues
            context_clues = await self._extract_context_clues(
                conversation_history[-3:], current_context
            )

            # Generate likely next intents
            next_likely = await self._generate_intent_probabilities(
                recent_intents, current_context
            )

            # Generate suggested actions
            suggested_actions = await self._generate_intent_actions(
                predicted_intent, context_clues, current_context
            )

            return IntentPrediction(
                predicted_intent=predicted_intent,
                confidence=confidence,
                context_clues=context_clues,
                next_likely_intents=next_likely,
                suggested_actions=suggested_actions
            )

        except Exception as e:
            logger.error(f"Intent prediction failed: {e}")
            raise

    async def _detect_language(self, text: str) -> Tuple[Language, float]:
        """Detect language of the text"""
        try:
            detected = detect(text)
            # Map langdetect codes to our Language enum
            lang_mapping = {
                'en': Language.ENGLISH,
                'es': Language.SPANISH,
                'fr': Language.FRENCH,
                'de': Language.GERMAN,
                'it': Language.ITALIAN,
                'pt': Language.PORTUGUESE,
                'ru': Language.RUSSIAN,
                'zh': Language.CHINESE,
                'ja': Language.JAPANESE,
                'ko': Language.KOREAN,
                'ar': Language.ARABIC,
                'hi': Language.HINDI
            }

            language = lang_mapping.get(detected, Language.ENGLISH)
            confidence = 0.9  # Mock confidence for now

            return language, confidence

        except Exception:
            # Fallback to English
            return Language.ENGLISH, 0.5

    def _normalize_text(self, text: str) -> str:
        """Normalize text for better processing"""
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', text.strip())

        # Fix common contractions
        contractions = {
            "don't": "do not",
            "won't": "will not",
            "can't": "cannot",
            "I'm": "I am",
            "you're": "you are",
            "it's": "it is",
            "we're": "we are",
            "they're": "they are"
        }

        for contraction, expansion in contractions.items():
            normalized = normalized.replace(contraction, expansion)

        return normalized

    async def _analyze_intent(self, text: str, context: Optional[Dict[str, Any]]) -> Tuple[IntentType, float]:
        """Analyze user intent from text"""
        text_lower = text.lower()

        # Pattern-based intent detection
        best_match = IntentType.QUERY
        best_score = 0.0

        for intent, patterns in self.intent_patterns.items():
            score = 0.0
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    score += 1.0

            # Normalize score
            score = score / len(patterns)

            if score > best_score:
                best_score = score
                best_match = intent

        # If no pattern match, use AI for complex intent analysis
        if best_score < 0.3:
            return await self._analyze_intent_with_ai(text, context)

        return best_match, best_score

    async def _analyze_intent_with_ai(self, text: str, context: Optional[Dict[str, Any]]) -> Tuple[IntentType, float]:
        """Use AI for complex intent analysis"""
        try:
            prompt = f"""
            Analyze the intent of this user message: "{text}"

            Context: {json.dumps(context) if context else "None"}

            Available intents:
            - create: User wants to create something new
            - execute: User wants to run/execute something
            - modify: User wants to change/update something
            - delete: User wants to remove something
            - query: User is asking for information
            - help: User needs assistance or guidance
            - explain: User wants an explanation
            - compare: User wants to compare options
            - troubleshoot: User has a problem to solve
            - optimize: User wants to improve performance

            Return JSON: {{"intent": "intent_name", "confidence": 0.85}}
            """

            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at understanding user intent. Analyze the text and return the most likely intent."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=100
            )

            result = json.loads(response.choices[0].message.content)
            intent = IntentType(result.get('intent', 'query'))
            confidence = result.get('confidence', 0.5)

            return intent, confidence

        except Exception as e:
            logger.error(f"AI intent analysis failed: {e}")
            return IntentType.QUERY, 0.5

    async def _analyze_sentiment(self, text: str) -> Tuple[SentimentType, float]:
        """Analyze sentiment of the text"""
        try:
            if hasattr(self, 'sentiment_analyzer'):
                result = self.sentiment_analyzer(text)[0]

                # Map model output to our sentiment types
                sentiment_mapping = {
                    'POSITIVE': SentimentType.POSITIVE,
                    'NEGATIVE': SentimentType.NEGATIVE,
                    'NEUTRAL': SentimentType.NEUTRAL
                }

                sentiment = sentiment_mapping.get(result['label'], SentimentType.NEUTRAL)
                score = result['score']

                # Check for specific emotional states
                if sentiment == SentimentType.NEGATIVE and score > 0.8:
                    if any(word in text.lower() for word in ['frustrated', 'angry', 'annoyed']):
                        sentiment = SentimentType.FRUSTRATED

                elif sentiment == SentimentType.POSITIVE and score > 0.8:
                    if any(word in text.lower() for word in ['excited', 'amazing', 'awesome']):
                        sentiment = SentimentType.EXCITED

                # Check for confusion indicators
                if any(word in text.lower() for word in ['confused', 'don\'t understand', 'unclear']):
                    sentiment = SentimentType.CONFUSED

                return sentiment, score

        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")

        return SentimentType.NEUTRAL, 0.5

    async def _extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract named entities from text"""
        try:
            if hasattr(self, 'ner_pipeline'):
                entities = self.ner_pipeline(text)

                return [
                    {
                        'text': entity['word'],
                        'label': entity['entity_group'],
                        'confidence': entity['score'],
                        'start': entity.get('start', 0),
                        'end': entity.get('end', 0)
                    }
                    for entity in entities
                ]

        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")

        return []

    async def _identify_technical_terms(self, text: str) -> Tuple[List[Dict[str, str]], Domain]:
        """Identify technical terms and determine domain"""
        text_lower = text.lower()
        found_terms = []
        domain_scores = {}

        for domain, vocab in self.domain_vocabularies.items():
            score = 0
            for term in vocab['terms']:
                if term.lower() in text_lower:
                    found_terms.append({
                        'term': term,
                        'domain': domain.value,
                        'definition': f"Technical term related to {domain.value}"
                    })
                    score += 1

            # Check synonyms
            for term, synonyms in vocab.get('synonyms', {}).items():
                for synonym in synonyms:
                    if synonym.lower() in text_lower:
                        found_terms.append({
                            'term': synonym,
                            'domain': domain.value,
                            'definition': f"Synonym for {term} in {domain.value}"
                        })
                        score += 0.5

            domain_scores[domain] = score

        # Determine primary domain
        primary_domain = max(domain_scores, key=domain_scores.get) if domain_scores else Domain.GENERAL

        return found_terms, primary_domain

    async def _extract_key_phrases(self, text: str) -> List[str]:
        """Extract key phrases from text"""
        try:
            # Use AI to extract key phrases
            prompt = f"""
            Extract 3-5 key phrases from this text: "{text}"

            Return as JSON array: ["phrase1", "phrase2", "phrase3"]
            """

            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract the most important phrases that capture the key concepts."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=200
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"Key phrase extraction failed: {e}")
            # Fallback: extract noun phrases
            words = text.split()
            return [' '.join(words[i:i+2]) for i in range(0, len(words)-1, 2)][:5]

    def _calculate_complexity(self, text: str, technical_terms: List[Dict[str, str]]) -> int:
        """Calculate text complexity level (1-10)"""
        complexity = 1

        # Length factor
        word_count = len(text.split())
        if word_count > 50:
            complexity += 2
        elif word_count > 20:
            complexity += 1

        # Technical terms factor
        complexity += min(len(technical_terms), 4)

        # Sentence structure complexity
        sentence_count = len([s for s in text.split('.') if s.strip()])
        avg_sentence_length = word_count / max(sentence_count, 1)
        if avg_sentence_length > 20:
            complexity += 2
        elif avg_sentence_length > 15:
            complexity += 1

        return min(complexity, 10)

    def _calculate_urgency(self, text: str, sentiment: SentimentType) -> int:
        """Calculate urgency level (1-10)"""
        urgency = 1

        # Sentiment-based urgency
        if sentiment == SentimentType.FRUSTRATED:
            urgency += 4
        elif sentiment == SentimentType.NEGATIVE:
            urgency += 2
        elif sentiment == SentimentType.CONFUSED:
            urgency += 3

        # Urgency keywords
        urgent_keywords = [
            'urgent', 'asap', 'immediately', 'critical', 'emergency',
            'broken', 'down', 'failed', 'not working', 'crashed'
        ]

        text_lower = text.lower()
        for keyword in urgent_keywords:
            if keyword in text_lower:
                urgency += 2
                break

        return min(urgency, 10)

    async def _generate_action_items(
        self,
        intent: IntentType,
        entities: List[Dict[str, Any]],
        technical_terms: List[Dict[str, str]]
    ) -> List[str]:
        """Generate actionable items based on analysis"""
        actions = []

        if intent == IntentType.CREATE:
            actions.append("Identify requirements for creation")
            actions.append("Select appropriate tools and technologies")

        elif intent == IntentType.EXECUTE:
            actions.append("Verify prerequisites are met")
            actions.append("Prepare execution environment")

        elif intent == IntentType.TROUBLESHOOT:
            actions.append("Gather error logs and symptoms")
            actions.append("Check system status and dependencies")

        elif intent == IntentType.HELP:
            actions.append("Provide relevant documentation")
            actions.append("Offer step-by-step guidance")

        # Add entity-specific actions
        for entity in entities:
            if entity['label'] == 'ORG':
                actions.append(f"Verify access to {entity['text']}")

        return actions[:5]  # Limit to 5 actions

    async def _generate_suggested_responses(
        self,
        intent: IntentType,
        sentiment: SentimentType,
        domain: Domain,
        context: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Generate suggested responses based on analysis"""
        responses = []

        # Intent-based responses
        if intent == IntentType.HELP:
            responses.append("I'd be happy to help you with that!")
            responses.append("Let me guide you through this step by step.")

        elif intent == IntentType.CREATE:
            responses.append("I can help you create that. Let's start with the requirements.")
            responses.append("What specific features do you want to include?")

        elif intent == IntentType.TROUBLESHOOT:
            responses.append("Let's troubleshoot this together. Can you share any error messages?")
            responses.append("I'll help you identify and fix the issue.")

        # Sentiment-based responses
        if sentiment == SentimentType.FRUSTRATED:
            responses.append("I understand this is frustrating. Let me help resolve this quickly.")

        elif sentiment == SentimentType.CONFUSED:
            responses.append("No worries, I can explain this in simpler terms.")

        # Domain-specific responses
        if domain == Domain.DEVOPS:
            responses.append("I can help with your DevOps workflow.")

        elif domain == Domain.CLOUD_COMPUTING:
            responses.append("Let's work on your cloud infrastructure together.")

        return responses[:3]  # Limit to 3 suggestions

    async def _translate_with_ai(
        self,
        text: str,
        source_lang: Language,
        target_lang: Language,
        preserve_terms: List[str]
    ) -> str:
        """Translate text using AI while preserving technical terms"""
        try:
            preserved_markers = {}
            modified_text = text

            # Replace technical terms with markers
            for i, term in enumerate(preserve_terms):
                marker = f"__PRESERVE_{i}__"
                modified_text = modified_text.replace(term, marker)
                preserved_markers[marker] = term

            prompt = f"""
            Translate this text from {source_lang.value} to {target_lang.value}:

            "{modified_text}"

            Preserve all __PRESERVE_X__ markers exactly as they are.
            Maintain technical accuracy and context.
            """

            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert translator with deep knowledge of technical terminology."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=1000
            )

            translated = response.choices[0].message.content

            # Restore preserved terms
            for marker, original_term in preserved_markers.items():
                translated = translated.replace(marker, original_term)

            return translated

        except Exception as e:
            logger.error(f"AI translation failed: {e}")
            return text  # Return original text as fallback

    async def _calculate_translation_confidence(
        self,
        original: str,
        translated: str,
        source_lang: Language,
        target_lang: Language
    ) -> float:
        """Calculate confidence score for translation"""
        # Simple heuristic-based confidence calculation
        confidence = 0.8

        # Length similarity (translated text should be reasonably similar in length)
        length_ratio = len(translated) / len(original)
        if 0.5 <= length_ratio <= 2.0:
            confidence += 0.1

        # Check if translation looks reasonable (not just a copy)
        if original != translated:
            confidence += 0.1

        return min(confidence, 1.0)

    async def _identify_cultural_adaptations(
        self,
        original: str,
        translated: str,
        source_lang: Language,
        target_lang: Language
    ) -> List[str]:
        """Identify cultural adaptations made during translation"""
        adaptations = []

        # This would be more sophisticated in a real implementation
        if source_lang == Language.ENGLISH and target_lang == Language.JAPANESE:
            adaptations.append("Added appropriate honorifics")

        elif source_lang == Language.ENGLISH and target_lang == Language.SPANISH:
            adaptations.append("Adjusted formality level")

        return adaptations

    async def _predict_next_intent(
        self,
        recent_intents: List[Tuple[IntentType, float]],
        context: Optional[Dict[str, Any]]
    ) -> Tuple[IntentType, float]:
        """Predict next intent based on conversation flow"""
        if not recent_intents:
            return IntentType.QUERY, 0.5

        last_intent = recent_intents[-1][0]

        # Common intent transitions
        transitions = {
            IntentType.QUERY: IntentType.CREATE,
            IntentType.CREATE: IntentType.EXECUTE,
            IntentType.EXECUTE: IntentType.QUERY,
            IntentType.HELP: IntentType.CREATE,
            IntentType.TROUBLESHOOT: IntentType.MODIFY
        }

        predicted = transitions.get(last_intent, IntentType.QUERY)
        confidence = 0.7

        return predicted, confidence

    async def _extract_context_clues(
        self,
        recent_messages: List[str],
        context: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Extract context clues from recent conversation"""
        clues = []

        for message in recent_messages:
            # Extract entities that might be context clues
            entities = await self._extract_entities(message)
            for entity in entities:
                clues.append(f"{entity['label']}: {entity['text']}")

        if context:
            for key, value in context.items():
                clues.append(f"Context {key}: {value}")

        return clues[:5]

    async def _generate_intent_probabilities(
        self,
        recent_intents: List[Tuple[IntentType, float]],
        context: Optional[Dict[str, Any]]
    ) -> List[Tuple[IntentType, float]]:
        """Generate probability distribution for next intents"""
        # Simple probability model
        probabilities = [
            (IntentType.QUERY, 0.3),
            (IntentType.CREATE, 0.2),
            (IntentType.EXECUTE, 0.15),
            (IntentType.MODIFY, 0.1),
            (IntentType.HELP, 0.1),
            (IntentType.TROUBLESHOOT, 0.1),
            (IntentType.EXPLAIN, 0.05)
        ]

        return probabilities

    async def _generate_intent_actions(
        self,
        predicted_intent: IntentType,
        context_clues: List[str],
        context: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Generate suggested actions for predicted intent"""
        actions = []

        if predicted_intent == IntentType.CREATE:
            actions.append("Prepare creation workflow")
            actions.append("Gather requirements")

        elif predicted_intent == IntentType.EXECUTE:
            actions.append("Check prerequisites")
            actions.append("Prepare execution environment")

        elif predicted_intent == IntentType.HELP:
            actions.append("Prepare helpful resources")
            actions.append("Identify knowledge gaps")

        return actions


# Service instance
nlp_engine = NLPEngine()