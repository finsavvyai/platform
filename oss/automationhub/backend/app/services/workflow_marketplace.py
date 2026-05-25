"""
Advanced Workflow Marketplace Service
Netflix-style workflow recommendations and community-driven templates
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import uuid
import hashlib

from sqlalchemy import text
import openai

logger = logging.getLogger(__name__)


class WorkflowCategory(Enum):
    """Workflow categories"""
    DEVOPS = "devops"
    DATA_SCIENCE = "data_science"
    WEB_DEVELOPMENT = "web_development"
    INFRASTRUCTURE = "infrastructure"
    AUTOMATION = "automation"
    TESTING = "testing"
    MONITORING = "monitoring"
    SECURITY = "security"
    DEPLOYMENT = "deployment"
    BACKUP = "backup"


class WorkflowComplexity(Enum):
    """Workflow complexity levels"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class MarketplaceStatus(Enum):
    """Marketplace listing status"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    FEATURED = "featured"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class PricingModel(Enum):
    """Pricing models for workflows"""
    FREE = "free"
    ONE_TIME = "one_time"
    SUBSCRIPTION = "subscription"
    PAY_PER_USE = "pay_per_use"
    REVENUE_SHARE = "revenue_share"


@dataclass
class WorkflowTemplate:
    """Workflow template structure"""
    id: str
    name: str
    description: str
    category: WorkflowCategory
    complexity: WorkflowComplexity
    author_id: str
    author_name: str
    version: str
    tags: List[str]
    definition: Dict[str, Any]
    pricing_model: PricingModel
    price: Optional[float]
    created_at: datetime
    updated_at: datetime
    downloads: int
    rating: float
    review_count: int
    status: MarketplaceStatus
    featured: bool = False
    verified_author: bool = False


@dataclass
class WorkflowReview:
    """Workflow review structure"""
    id: str
    workflow_id: str
    user_id: str
    user_name: str
    rating: int  # 1-5 stars
    comment: str
    created_at: datetime
    helpful_votes: int
    verified_purchase: bool


@dataclass
class MarketplaceAnalytics:
    """Marketplace analytics data"""
    total_workflows: int
    total_downloads: int
    total_revenue: float
    top_categories: List[Tuple[str, int]]
    trending_workflows: List[str]
    user_engagement: Dict[str, float]


class WorkflowMarketplaceService:
    """
    Advanced workflow marketplace with AI-powered recommendations,
    community features, and monetization
    """

    def __init__(self):
        # Initialize OpenAI client with graceful fallback for testing
        try:
            self.openai_client = openai.AsyncOpenAI()
        except Exception as e:
            logger.warning(f"OpenAI client initialization failed: {e}. Using fallback mode.")
            self.openai_client = None

        self.recommendation_cache: Dict[str, List[str]] = {}
        self.trending_cache: Dict[str, Any] = {}
        self.analytics_cache: Optional[MarketplaceAnalytics] = None

    async def publish_workflow(
        self,
        workflow_definition: Dict[str, Any],
        metadata: Dict[str, Any],
        author_id: str
    ) -> WorkflowTemplate:
        """Publish a workflow to the marketplace"""
        try:
            logger.info(f"Publishing workflow to marketplace for author {author_id}")

            # Generate unique workflow ID
            workflow_id = str(uuid.uuid4())

            # Extract and validate metadata
            name = metadata.get('name', 'Untitled Workflow')
            description = metadata.get('description', '')
            category = WorkflowCategory(metadata.get('category', 'automation'))
            complexity = WorkflowComplexity(metadata.get('complexity', 'intermediate'))
            tags = metadata.get('tags', [])
            pricing_model = PricingModel(metadata.get('pricing_model', 'free'))
            price = metadata.get('price', 0.0)

            # Generate AI-enhanced description if needed
            if len(description) < 50:
                description = await self._generate_workflow_description(workflow_definition, name)

            # Auto-generate tags using AI
            if len(tags) < 3:
                ai_tags = await self._generate_workflow_tags(workflow_definition, description)
                tags.extend(ai_tags)

            # Create workflow template
            template = WorkflowTemplate(
                id=workflow_id,
                name=name,
                description=description,
                category=category,
                complexity=complexity,
                author_id=author_id,
                author_name=metadata.get('author_name', 'Anonymous'),
                version="1.0.0",
                tags=list(set(tags))[:10],  # Limit to 10 unique tags
                definition=workflow_definition,
                pricing_model=pricing_model,
                price=price,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                downloads=0,
                rating=0.0,
                review_count=0,
                status=MarketplaceStatus.PENDING_REVIEW,
                featured=False,
                verified_author=False  # Would be set based on author verification
            )

            # Store in database (mock implementation)
            await self._store_workflow_template(template)

            # Trigger content moderation and approval process
            await self._queue_workflow_review(workflow_id)

            logger.info(f"Workflow {workflow_id} published successfully")
            return template

        except Exception as e:
            logger.error(f"Failed to publish workflow: {e}")
            raise

    async def search_workflows(
        self,
        query: str,
        category: Optional[WorkflowCategory] = None,
        complexity: Optional[WorkflowComplexity] = None,
        pricing: Optional[PricingModel] = None,
        tags: Optional[List[str]] = None,
        sort_by: str = "relevance",
        limit: int = 20,
        offset: int = 0
    ) -> List[WorkflowTemplate]:
        """Search workflows with advanced filtering and AI-powered relevance"""
        try:
            logger.info(f"Searching workflows: query='{query}', category={category}")

            # Build search parameters
            search_params = {
                'query': query,
                'category': category.value if category else None,
                'complexity': complexity.value if complexity else None,
                'pricing': pricing.value if pricing else None,
                'tags': tags,
                'limit': limit,
                'offset': offset
            }

            # For demo purposes, return mock workflow templates
            mock_workflows = await self._get_mock_workflow_templates()

            # Filter workflows based on search criteria
            filtered_workflows = []
            for workflow in mock_workflows:
                if self._matches_search_criteria(workflow, search_params):
                    filtered_workflows.append(workflow)

            # Sort results
            sorted_workflows = await self._sort_workflows(filtered_workflows, sort_by, query)

            # Apply pagination
            paginated_results = sorted_workflows[offset:offset + limit]

            return paginated_results

        except Exception as e:
            logger.error(f"Workflow search failed: {e}")
            raise

    async def get_workflow_recommendations(
        self,
        user_id: str,
        context: Optional[Dict[str, Any]] = None,
        count: int = 10
    ) -> List[WorkflowTemplate]:
        """Get AI-powered workflow recommendations for a user"""
        try:
            logger.info(f"Getting workflow recommendations for user {user_id}")

            # Check cache first
            cache_key = f"recommendations_{user_id}_{hash(str(context))}"
            if cache_key in self.recommendation_cache:
                cached_ids = self.recommendation_cache[cache_key]
                return await self._get_workflows_by_ids(cached_ids[:count])

            # Get user's workflow history and preferences
            user_history = await self._get_user_workflow_history(user_id)
            user_preferences = await self._analyze_user_preferences(user_id, user_history)

            # Generate AI-powered recommendations
            recommendations = await self._generate_ai_recommendations(
                user_preferences, context, count
            )

            # Cache recommendations for 1 hour
            self.recommendation_cache[cache_key] = [w.id for w in recommendations]

            return recommendations

        except Exception as e:
            logger.error(f"Failed to generate recommendations: {e}")
            # Return trending workflows as fallback
            return await self.get_trending_workflows(count)

    async def get_trending_workflows(self, count: int = 10) -> List[WorkflowTemplate]:
        """Get currently trending workflows"""
        try:
            # Check cache
            if 'trending' in self.trending_cache:
                cache_data = self.trending_cache['trending']
                if datetime.now() - cache_data['timestamp'] < timedelta(hours=1):
                    return cache_data['workflows'][:count]

            # Calculate trending based on recent downloads, ratings, and engagement
            all_workflows = await self._get_mock_workflow_templates()

            # Simple trending algorithm: recent downloads + rating boost
            trending_scores = []
            for workflow in all_workflows:
                # Mock trending calculation
                recent_downloads = workflow.downloads * 0.1  # Mock recent activity
                rating_boost = workflow.rating * 10
                trending_score = recent_downloads + rating_boost + workflow.review_count

                trending_scores.append((workflow, trending_score))

            # Sort by trending score
            trending_scores.sort(key=lambda x: x[1], reverse=True)
            trending_workflows = [w for w, _ in trending_scores[:count]]

            # Cache results
            self.trending_cache['trending'] = {
                'workflows': trending_workflows,
                'timestamp': datetime.now()
            }

            return trending_workflows

        except Exception as e:
            logger.error(f"Failed to get trending workflows: {e}")
            return []

    async def rate_workflow(
        self,
        workflow_id: str,
        user_id: str,
        rating: int,
        comment: str = ""
    ) -> WorkflowReview:
        """Rate and review a workflow"""
        try:
            if not 1 <= rating <= 5:
                raise ValueError("Rating must be between 1 and 5")

            review = WorkflowReview(
                id=str(uuid.uuid4()),
                workflow_id=workflow_id,
                user_id=user_id,
                user_name="User",  # Would be fetched from user service
                rating=rating,
                comment=comment,
                created_at=datetime.now(),
                helpful_votes=0,
                verified_purchase=False  # Would be checked against purchase history
            )

            # Store review (mock implementation)
            await self._store_workflow_review(review)

            # Update workflow rating
            await self._update_workflow_rating(workflow_id)

            return review

        except Exception as e:
            logger.error(f"Failed to rate workflow: {e}")
            raise

    async def get_workflow_analytics(self, author_id: Optional[str] = None) -> MarketplaceAnalytics:
        """Get marketplace analytics"""
        try:
            # Return cached analytics if available and recent
            if (self.analytics_cache and
                datetime.now() - getattr(self.analytics_cache, 'last_updated', datetime.min) < timedelta(hours=1)):
                return self.analytics_cache

            # Calculate analytics
            all_workflows = await self._get_mock_workflow_templates()

            if author_id:
                # Filter to specific author
                all_workflows = [w for w in all_workflows if w.author_id == author_id]

            total_workflows = len(all_workflows)
            total_downloads = sum(w.downloads for w in all_workflows)
            total_revenue = sum(w.price * w.downloads for w in all_workflows if w.price)

            # Top categories
            category_counts = {}
            for workflow in all_workflows:
                category = workflow.category.value
                category_counts[category] = category_counts.get(category, 0) + 1

            top_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:5]

            # Trending workflows
            trending = await self.get_trending_workflows(10)
            trending_ids = [w.id for w in trending]

            # User engagement metrics
            user_engagement = {
                'average_rating': sum(w.rating for w in all_workflows) / len(all_workflows) if all_workflows else 0,
                'total_reviews': sum(w.review_count for w in all_workflows),
                'conversion_rate': 0.15,  # Mock conversion rate
                'repeat_usage_rate': 0.45  # Mock repeat usage
            }

            analytics = MarketplaceAnalytics(
                total_workflows=total_workflows,
                total_downloads=total_downloads,
                total_revenue=total_revenue,
                top_categories=top_categories,
                trending_workflows=trending_ids,
                user_engagement=user_engagement
            )

            # Cache analytics
            self.analytics_cache = analytics
            setattr(analytics, 'last_updated', datetime.now())

            return analytics

        except Exception as e:
            logger.error(f"Failed to get analytics: {e}")
            raise

    async def _generate_workflow_description(self, workflow_def: Dict[str, Any], name: str) -> str:
        """Generate AI-enhanced workflow description"""
        try:
            prompt = f"""
            Generate a compelling description for this workflow named "{name}":

            Workflow Definition:
            {json.dumps(workflow_def, indent=2)[:1000]}...

            Create a 2-3 sentence description that:
            1. Explains what the workflow does
            2. Highlights key benefits
            3. Mentions target use cases
            4. Is engaging and professional

            Keep it concise but informative.
            """

            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a technical marketing expert. Create compelling but accurate workflow descriptions."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=200
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"Failed to generate description: {e}")
            return f"Automated workflow for {name.lower()}"

    async def _generate_workflow_tags(self, workflow_def: Dict[str, Any], description: str) -> List[str]:
        """Generate relevant tags for a workflow using AI"""
        try:
            prompt = f"""
            Generate 5-7 relevant tags for this workflow:

            Description: {description}

            Workflow contains these components:
            {json.dumps(workflow_def, indent=2)[:500]}...

            Return tags as a JSON array. Tags should be:
            - Single words or short phrases (2-3 words max)
            - Relevant to the workflow's purpose and technology
            - Useful for search and categorization
            - Industry standard terms

            Example: ["automation", "aws", "deployment", "ci-cd", "docker"]
            """

            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a technical taxonomy expert. Generate accurate, searchable tags."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=100
            )

            try:
                tags = json.loads(response.choices[0].message.content)
                return tags[:7]  # Limit to 7 tags
            except json.JSONDecodeError:
                # Fallback: extract tags from response text
                content = response.choices[0].message.content
                return [tag.strip().lower() for tag in content.split(',')[:5]]

        except Exception as e:
            logger.error(f"Failed to generate tags: {e}")
            return ["automation", "workflow", "productivity"]

    async def _generate_ai_recommendations(
        self,
        user_preferences: Dict[str, Any],
        context: Optional[Dict[str, Any]],
        count: int
    ) -> List[WorkflowTemplate]:
        """Generate AI-powered workflow recommendations"""
        try:
            # Get all available workflows
            all_workflows = await self._get_mock_workflow_templates()

            # Score workflows based on user preferences
            scored_workflows = []
            for workflow in all_workflows:
                score = self._calculate_recommendation_score(workflow, user_preferences, context)
                scored_workflows.append((workflow, score))

            # Sort by score and return top recommendations
            scored_workflows.sort(key=lambda x: x[1], reverse=True)
            return [w for w, _ in scored_workflows[:count]]

        except Exception as e:
            logger.error(f"Failed to generate AI recommendations: {e}")
            return []

    def _calculate_recommendation_score(
        self,
        workflow: WorkflowTemplate,
        preferences: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> float:
        """Calculate recommendation score for a workflow"""
        score = 0.0

        # Category preference
        if workflow.category.value in preferences.get('preferred_categories', []):
            score += 30

        # Complexity match
        user_complexity = preferences.get('complexity_level', 'intermediate')
        if workflow.complexity.value == user_complexity:
            score += 20
        elif abs(self._complexity_to_level(workflow.complexity) -
                self._complexity_to_level(WorkflowComplexity(user_complexity))) == 1:
            score += 10

        # Rating boost
        score += workflow.rating * 5

        # Popularity boost
        score += min(workflow.downloads / 1000, 10)

        # Tag matching
        user_tags = preferences.get('preferred_tags', [])
        matching_tags = set(workflow.tags) & set(user_tags)
        score += len(matching_tags) * 5

        # Context boost
        if context:
            project_type = context.get('project_type', '')
            if project_type.lower() in [tag.lower() for tag in workflow.tags]:
                score += 15

        # Recency boost
        days_old = (datetime.now() - workflow.created_at).days
        if days_old < 30:
            score += 5

        return score

    def _complexity_to_level(self, complexity: WorkflowComplexity) -> int:
        """Convert complexity enum to numeric level"""
        mapping = {
            WorkflowComplexity.BEGINNER: 1,
            WorkflowComplexity.INTERMEDIATE: 2,
            WorkflowComplexity.ADVANCED: 3,
            WorkflowComplexity.EXPERT: 4
        }
        return mapping.get(complexity, 2)

    def _matches_search_criteria(self, workflow: WorkflowTemplate, params: Dict[str, Any]) -> bool:
        """Check if workflow matches search criteria"""
        query = params.get('query', '').lower()

        # Text search in name, description, and tags
        if query:
            searchable_text = f"{workflow.name} {workflow.description} {' '.join(workflow.tags)}".lower()
            if query not in searchable_text:
                return False

        # Category filter
        if params.get('category') and workflow.category.value != params['category']:
            return False

        # Complexity filter
        if params.get('complexity') and workflow.complexity.value != params['complexity']:
            return False

        # Pricing filter
        if params.get('pricing') and workflow.pricing_model.value != params['pricing']:
            return False

        # Tags filter
        if params.get('tags'):
            workflow_tags_lower = [tag.lower() for tag in workflow.tags]
            for required_tag in params['tags']:
                if required_tag.lower() not in workflow_tags_lower:
                    return False

        return True

    async def _sort_workflows(
        self,
        workflows: List[WorkflowTemplate],
        sort_by: str,
        query: str = ""
    ) -> List[WorkflowTemplate]:
        """Sort workflows by specified criteria"""
        if sort_by == "relevance":
            # Simple relevance scoring based on query match and popularity
            def relevance_score(w):
                text_match = (query.lower() in w.name.lower()) * 10
                rating_score = w.rating * 2
                download_score = min(w.downloads / 100, 5)
                return text_match + rating_score + download_score

            return sorted(workflows, key=relevance_score, reverse=True)

        elif sort_by == "rating":
            return sorted(workflows, key=lambda w: (w.rating, w.review_count), reverse=True)

        elif sort_by == "downloads":
            return sorted(workflows, key=lambda w: w.downloads, reverse=True)

        elif sort_by == "newest":
            return sorted(workflows, key=lambda w: w.created_at, reverse=True)

        elif sort_by == "price_low":
            return sorted(workflows, key=lambda w: w.price or 0)

        elif sort_by == "price_high":
            return sorted(workflows, key=lambda w: w.price or 0, reverse=True)

        else:
            return workflows

    async def _get_mock_workflow_templates(self) -> List[WorkflowTemplate]:
        """Get mock workflow templates for demonstration"""
        mock_workflows = [
            WorkflowTemplate(
                id="wf_001",
                name="AWS Infrastructure Setup",
                description="Complete AWS infrastructure setup with VPC, subnets, and security groups",
                category=WorkflowCategory.INFRASTRUCTURE,
                complexity=WorkflowComplexity.INTERMEDIATE,
                author_id="author_001",
                author_name="DevOps Expert",
                version="2.1.0",
                tags=["aws", "vpc", "terraform", "infrastructure", "cloud"],
                definition={"nodes": [], "connections": []},
                pricing_model=PricingModel.ONE_TIME,
                price=29.99,
                created_at=datetime.now() - timedelta(days=15),
                updated_at=datetime.now() - timedelta(days=5),
                downloads=2500,
                rating=4.7,
                review_count=45,
                status=MarketplaceStatus.FEATURED,
                featured=True,
                verified_author=True
            ),
            WorkflowTemplate(
                id="wf_002",
                name="CI/CD Pipeline with Docker",
                description="Automated CI/CD pipeline using GitHub Actions, Docker, and Kubernetes deployment",
                category=WorkflowCategory.DEVOPS,
                complexity=WorkflowComplexity.ADVANCED,
                author_id="author_002",
                author_name="Pipeline Pro",
                version="1.5.0",
                tags=["cicd", "docker", "kubernetes", "github-actions", "deployment"],
                definition={"nodes": [], "connections": []},
                pricing_model=PricingModel.FREE,
                price=0.0,
                created_at=datetime.now() - timedelta(days=30),
                updated_at=datetime.now() - timedelta(days=10),
                downloads=5200,
                rating=4.9,
                review_count=89,
                status=MarketplaceStatus.APPROVED,
                featured=False,
                verified_author=True
            ),
            WorkflowTemplate(
                id="wf_003",
                name="Data Processing Pipeline",
                description="ETL pipeline for processing large datasets with Pandas and Apache Airflow",
                category=WorkflowCategory.DATA_SCIENCE,
                complexity=WorkflowComplexity.INTERMEDIATE,
                author_id="author_003",
                author_name="Data Wizard",
                version="1.0.0",
                tags=["etl", "pandas", "airflow", "data-processing", "python"],
                definition={"nodes": [], "connections": []},
                pricing_model=PricingModel.SUBSCRIPTION,
                price=19.99,
                created_at=datetime.now() - timedelta(days=7),
                updated_at=datetime.now() - timedelta(days=2),
                downloads=1200,
                rating=4.5,
                review_count=23,
                status=MarketplaceStatus.APPROVED,
                featured=False,
                verified_author=False
            ),
            WorkflowTemplate(
                id="wf_004",
                name="Security Scanning Automation",
                description="Automated security scanning with OWASP ZAP, SonarQube, and vulnerability reporting",
                category=WorkflowCategory.SECURITY,
                complexity=WorkflowComplexity.ADVANCED,
                author_id="author_004",
                author_name="SecOps Master",
                version="3.0.0",
                tags=["security", "owasp", "sonarqube", "vulnerability", "scanning"],
                definition={"nodes": [], "connections": []},
                pricing_model=PricingModel.PAY_PER_USE,
                price=5.99,
                created_at=datetime.now() - timedelta(days=45),
                updated_at=datetime.now() - timedelta(days=20),
                downloads=890,
                rating=4.8,
                review_count=31,
                status=MarketplaceStatus.APPROVED,
                featured=True,
                verified_author=True
            ),
            WorkflowTemplate(
                id="wf_005",
                name="React App Deployment",
                description="Complete React application deployment to AWS S3 with CloudFront CDN",
                category=WorkflowCategory.WEB_DEVELOPMENT,
                complexity=WorkflowComplexity.BEGINNER,
                author_id="author_005",
                author_name="Frontend Guru",
                version="1.2.0",
                tags=["react", "aws", "s3", "cloudfront", "deployment"],
                definition={"nodes": [], "connections": []},
                pricing_model=PricingModel.FREE,
                price=0.0,
                created_at=datetime.now() - timedelta(days=20),
                updated_at=datetime.now() - timedelta(days=8),
                downloads=3800,
                rating=4.6,
                review_count=67,
                status=MarketplaceStatus.APPROVED,
                featured=False,
                verified_author=True
            )
        ]
        return mock_workflows

    async def _get_user_workflow_history(self, user_id: str) -> List[Dict[str, Any]]:
        """Get user's workflow usage history"""
        # Mock implementation
        return [
            {"workflow_id": "wf_001", "category": "infrastructure", "complexity": "intermediate"},
            {"workflow_id": "wf_002", "category": "devops", "complexity": "advanced"},
        ]

    async def _analyze_user_preferences(self, user_id: str, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze user preferences from workflow history"""
        # Extract preferences from history
        categories = [item.get('category') for item in history if item.get('category')]
        complexities = [item.get('complexity') for item in history if item.get('complexity')]

        # Calculate most common preferences
        preferred_categories = list(set(categories)) if categories else ['automation']
        preferred_complexity = max(set(complexities), key=complexities.count) if complexities else 'intermediate'

        return {
            'preferred_categories': preferred_categories,
            'complexity_level': preferred_complexity,
            'preferred_tags': ['automation', 'deployment', 'docker']  # Mock tags
        }

    async def _store_workflow_template(self, template: WorkflowTemplate):
        """Store workflow template in database (mock)"""
        logger.info(f"Storing workflow template {template.id}")

    async def _store_workflow_review(self, review: WorkflowReview):
        """Store workflow review in database (mock)"""
        logger.info(f"Storing workflow review {review.id}")

    async def _update_workflow_rating(self, workflow_id: str):
        """Update workflow's average rating (mock)"""
        logger.info(f"Updating rating for workflow {workflow_id}")

    async def _queue_workflow_review(self, workflow_id: str):
        """Queue workflow for content moderation (mock)"""
        logger.info(f"Queuing workflow {workflow_id} for review")

    async def _get_workflows_by_ids(self, workflow_ids: List[str]) -> List[WorkflowTemplate]:
        """Get workflows by their IDs"""
        all_workflows = await self._get_mock_workflow_templates()
        return [w for w in all_workflows if w.id in workflow_ids]


# Service instance
workflow_marketplace_service = WorkflowMarketplaceService()