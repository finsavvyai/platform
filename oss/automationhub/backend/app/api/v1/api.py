"""
API v1 router configuration
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    organizations,
    workflows,
    tasks,
    agents,
    documents,
    health,
    mcp,
    knowledge,
    chat,
    browser,
    advanced_browser,
    code_generation,
    infrastructure_deployment,
    infrastructure_monitoring,
    workflow_orchestration,
    voice_control,
    workflow_marketplace,
    nlp,
    llm,
    task_queue,
    performance,
    vector_search,
    rag,
    tenants,
    branding,
    tenant_admin,
    ansible,
    cloudflare,
    multi_cloud,
    advanced_analytics
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(chat.router, prefix="/chat", tags=["conversational-ai"])
api_router.include_router(browser.router, prefix="/browser", tags=["browser-automation"])
api_router.include_router(advanced_browser.router, prefix="/browser/advanced", tags=["advanced-browser-features"])
api_router.include_router(code_generation.router, prefix="/code-generation", tags=["code-generation"])
api_router.include_router(infrastructure_deployment.router, prefix="/deployment", tags=["infrastructure-deployment"])
api_router.include_router(performance.router, prefix="/performance", tags=["performance-optimization"])
api_router.include_router(infrastructure_monitoring.router, prefix="/monitoring", tags=["infrastructure-monitoring"])
api_router.include_router(workflow_orchestration.router, prefix="/orchestration", tags=["workflow-orchestration"])
api_router.include_router(voice_control.router, prefix="/voice", tags=["voice-control"])
api_router.include_router(workflow_marketplace.router, prefix="/marketplace", tags=["workflow-marketplace"])
api_router.include_router(nlp.router, prefix="/nlp", tags=["natural-language-processing"])
api_router.include_router(llm.router, prefix="/llm", tags=["large-language-models"])
api_router.include_router(task_queue.router, prefix="/task-queue", tags=["multi-agent-execution"])
api_router.include_router(vector_search.router, prefix="/vector", tags=["vector-search"])
api_router.include_router(rag.router, prefix="/rag", tags=["retrieval-augmented-generation"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["multi-tenant-management"])
api_router.include_router(branding.router, prefix="/branding", tags=["custom-branding"])
api_router.include_router(tenant_admin.router, prefix="/admin", tags=["tenant-administration"])
api_router.include_router(ansible.router, prefix="/ansible", tags=["infrastructure-automation"])
api_router.include_router(cloudflare.router, prefix="/cloudflare", tags=["cloudflare-management"])
api_router.include_router(multi_cloud.router, prefix="/multi-cloud", tags=["multi-cloud-orchestration"])
api_router.include_router(advanced_analytics.router, prefix="/analytics", tags=["advanced-analytics-intelligence"])