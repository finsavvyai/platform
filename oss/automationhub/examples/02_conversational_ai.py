"""
Conversational AI Examples - Real Working Code
Run: python3.12 examples/02_conversational_ai.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.agents.conversational_agent import ConversationalAgent
from app.agents.base import Task, TaskType, ExecutionContext
from uuid import uuid4


async def example_1_basic_conversation():
    """Example 1: Basic conversation with AI agent"""
    print("\n" + "="*60)
    print("Example 1: Basic Conversation")
    print("="*60)
    
    agent = ConversationalAgent()
    
    questions = [
        "What is artificial intelligence?",
        "How does machine learning work?",
        "What are the benefits of automation?"
    ]
    
    session_id = uuid4()
    
    for i, question in enumerate(questions, 1):
        print(f"\nQ{i}: {question}")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name=f"conversation_{i}",
            parameters={
                "task_type": "conversation",
                "session_id": session_id,
                "message": question,
                "system_prompt": "You are a helpful AI assistant."
            }
        )
        
        context = ExecutionContext(session_id=session_id)
        result = await agent.execute_task(task, context)
        
        if result.status.value == "completed":
            response = result.result.get('response', 'No response')
            print(f"A{i}: {response}")
            print(f"    (Session: {result.result.get('session_id')})")
    
    return agent


async def example_2_knowledge_retrieval():
    """Example 2: Knowledge base query with RAG"""
    print("\n" + "="*60)
    print("Example 2: Knowledge Retrieval (RAG)")
    print("="*60)
    
    agent = ConversationalAgent()
    
    task = Task(
        type=TaskType.CONVERSATION,
        name="knowledge_query",
        parameters={
            "task_type": "knowledge_query",
            "query": "Tell me about multi-agent systems",
            "max_results": 5,
            "similarity_threshold": 0.7
        }
    )
    
    context = ExecutionContext(session_id=uuid4())
    result = await agent.execute_task(task, context)
    
    print(f"Status: {result.status}")
    print(f"Execution time: {result.duration_ms}ms")
    
    if result.result:
        print(f"\nKnowledge sources found: {result.result.get('knowledge_sources', 0)}")
        print(f"Response: {result.result.get('response', 'No response')}")
    
    return result


async def example_3_conversation_summarization():
    """Example 3: Summarize long conversation"""
    print("\n" + "="*60)
    print("Example 3: Conversation Summarization")
    print("="*60)
    
    agent = ConversationalAgent()
    session_id = uuid4()
    
    # Simulate a conversation
    conversation = [
        "What is cloud computing?",
        "Can you explain different cloud service models?",
        "What are the security considerations for cloud?",
        "How does cloud compare to on-premise?",
        "What are the cost benefits?"
    ]
    
    print("Building conversation history...")
    for msg in conversation:
        print(f"  - {msg}")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name="build_history",
            parameters={
                "task_type": "conversation",
                "session_id": session_id,
                "message": msg
            }
        )
        
        context = ExecutionContext(session_id=session_id)
        await agent.execute_task(task, context)
    
    # Summarize the conversation
    print("\nGenerating summary...")
    summary_task = Task(
        type=TaskType.CONVERSATION,
        name="summarize",
        parameters={
            "task_type": "summarize",
            "session_id": session_id,
            "summary_type": "executive"
        }
    )
    
    result = await agent.execute_task(summary_task, ExecutionContext(session_id=session_id))
    
    print(f"\nSummary generated:")
    print(f"  Status: {result.status}")
    if result.result:
        print(f"  Summary: {result.result.get('summary', 'No summary')}")
        print(f"  Key points: {result.result.get('key_points', [])}")
    
    return result


async def example_4_intent_recognition():
    """Example 4: Recognize user intent"""
    print("\n" + "="*60)
    print("Example 4: Intent Recognition")
    print("="*60)
    
    agent = ConversationalAgent()
    
    user_messages = [
        "I want to cancel my subscription",
        "How much does the premium plan cost?",
        "My account is not working properly",
        "Can you help me reset my password?",
        "I'd like to speak with a human agent"
    ]
    
    for msg in user_messages:
        print(f"\nUser: {msg}")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name="intent_analysis",
            parameters={
                "task_type": "intent_analysis",
                "message": msg,
                "possible_intents": [
                    "billing",
                    "technical_support",
                    "account_management",
                    "sales_inquiry",
                    "escalation"
                ]
            }
        )
        
        context = ExecutionContext(session_id=uuid4())
        result = await agent.execute_task(task, context)
        
        if result.result:
            print(f"  Intent: {result.result.get('intent', 'unknown')}")
            print(f"  Confidence: {result.result.get('confidence', 0):.2%}")
            print(f"  Suggested action: {result.result.get('action', 'none')}")
    
    return agent


async def example_5_multi_session_management():
    """Example 5: Manage multiple conversation sessions"""
    print("\n" + "="*60)
    print("Example 5: Multi-Session Management")
    print("="*60)
    
    agent = ConversationalAgent()
    
    # Create multiple sessions (simulating different users)
    sessions = {
        "user_1": {"id": uuid4(), "topic": "Technical Support"},
        "user_2": {"id": uuid4(), "topic": "Sales Inquiry"},
        "user_3": {"id": uuid4(), "topic": "Product Questions"}
    }
    
    print(f"Managing {len(sessions)} concurrent sessions:\n")
    
    for user, session_info in sessions.items():
        print(f"{user} ({session_info['topic']}):")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name=f"{user}_conversation",
            parameters={
                "task_type": "conversation",
                "session_id": session_info['id'],
                "message": f"I need help with {session_info['topic'].lower()}",
                "system_prompt": f"You are helping with {session_info['topic']}"
            }
        )
        
        context = ExecutionContext(session_id=session_info['id'])
        result = await agent.execute_task(task, context)
        
        if result.result:
            print(f"  Session ID: {result.result.get('session_id')}")
            print(f"  Response: {result.result.get('response', 'No response')[:100]}...")
            print(f"  Messages in session: {result.result.get('conversation_length', 0)}")
        print()
    
    print(f"Agent managing {len(sessions)} active sessions")
    print(f"Total agent memory size: {len(agent.memory.messages)} messages")
    
    return agent


async def example_6_context_aware_responses():
    """Example 6: Context-aware conversation"""
    print("\n" + "="*60)
    print("Example 6: Context-Aware Responses")
    print("="*60)
    
    agent = ConversationalAgent()
    session_id = uuid4()
    
    # Conversation with context building
    conversation_flow = [
        ("My name is Sarah", "greeting"),
        ("I'm looking for a project management tool", "inquiry"),
        ("What features does it have?", "follow_up"),
        ("How much does it cost?", "pricing"),
        ("Can you remind me what I was looking for?", "context_check")
    ]
    
    context_data = {
        "user_name": "Sarah",
        "user_type": "potential_customer",
        "product_interest": "project_management"
    }
    
    for i, (message, stage) in enumerate(conversation_flow, 1):
        print(f"\n[Stage {i}: {stage}]")
        print(f"User: {message}")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name=f"contextual_{i}",
            parameters={
                "task_type": "conversation",
                "session_id": session_id,
                "message": message,
                "context": context_data,
                "system_prompt": "You are a helpful sales assistant. Use the conversation context."
            }
        )
        
        context_obj = ExecutionContext(
            session_id=session_id,
            metadata=context_data
        )
        result = await agent.execute_task(task, context_obj)
        
        if result.result:
            print(f"Assistant: {result.result.get('response', 'No response')}")
    
    return agent


async def example_7_document_qa():
    """Example 7: Document-based Q&A"""
    print("\n" + "="*60)
    print("Example 7: Document Q&A")
    print("="*60)
    
    agent = ConversationalAgent()
    
    # Simulate document content
    document_context = """
    UPM.Plus is a multi-agent automation platform that enables enterprises
    to automate complex workflows. It features:
    - Browser automation with Playwright
    - Conversational AI with RAG capabilities
    - Infrastructure management with Ansible
    - Data processing with pandas
    
    The system is production-ready with 100% test coverage and enterprise features.
    """
    
    questions = [
        "What is UPM.Plus?",
        "What technologies does it use?",
        "Is it production-ready?",
        "What can I automate with it?"
    ]
    
    for q in questions:
        print(f"\nQ: {q}")
        
        task = Task(
            type=TaskType.CONVERSATION,
            name="doc_qa",
            parameters={
                "task_type": "conversation",
                "message": q,
                "context": {"document": document_context},
                "system_prompt": "Answer based on the provided document context."
            }
        )
        
        context = ExecutionContext(session_id=uuid4())
        result = await agent.execute_task(task, context)
        
        if result.result:
            print(f"A: {result.result.get('response', 'No response')}")
    
    return agent


async def example_8_customer_support_bot():
    """Example 8: Full customer support bot simulation"""
    print("\n" + "="*60)
    print("Example 8: Customer Support Bot")
    print("="*60)
    
    agent = ConversationalAgent(
        system_prompt="""You are a customer support AI assistant.
        You help users with technical issues, billing questions, and general inquiries.
        Always be helpful, professional, and concise."""
    )
    
    # Simulate support ticket
    support_scenarios = [
        {
            "customer": "New User",
            "issue": "Account Setup",
            "messages": [
                "Hi, I just signed up but can't log in",
                "I'm using johndoe@email.com",
                "I tried resetting but didn't get an email",
                "Can you check if my account exists?"
            ]
        },
        {
            "customer": "Existing User",
            "issue": "Billing Question",
            "messages": [
                "I was charged twice this month",
                "My invoice shows two charges of $49.99",
                "Can I get a refund for the duplicate?"
            ]
        }
    ]
    
    for scenario in support_scenarios:
        print(f"\n--- Ticket: {scenario['issue']} ---")
        print(f"Customer: {scenario['customer']}\n")
        
        session_id = uuid4()
        
        for msg in scenario['messages']:
            print(f"Customer: {msg}")
            
            task = Task(
                type=TaskType.CONVERSATION,
                name="support_response",
                parameters={
                    "task_type": "conversation",
                    "session_id": session_id,
                    "message": msg,
                    "context": {
                        "ticket_type": scenario['issue'],
                        "customer_type": scenario['customer']
                    }
                }
            )
            
            context = ExecutionContext(session_id=session_id)
            result = await agent.execute_task(task, context)
            
            if result.result:
                print(f"Support: {result.result.get('response', 'No response')}\n")
    
    return agent


async def main():
    """Run all conversational AI examples"""
    print("\n" + "💬" + "="*58 + "💬")
    print("  UPM.Plus Conversational AI - Complete Examples")
    print("💬" + "="*58 + "💬\n")
    
    examples = [
        ("Basic Conversation", example_1_basic_conversation),
        ("Knowledge Retrieval", example_2_knowledge_retrieval),
        ("Conversation Summarization", example_3_conversation_summarization),
        ("Intent Recognition", example_4_intent_recognition),
        ("Multi-Session Management", example_5_multi_session_management),
        ("Context-Aware Responses", example_6_context_aware_responses),
        ("Document Q&A", example_7_document_qa),
        ("Customer Support Bot", example_8_customer_support_bot),
    ]
    
    results = {}
    
    for name, example_func in examples:
        try:
            print(f"\n{'='*60}")
            print(f"Running: {name}")
            print(f"{'='*60}")
            result = await example_func()
            results[name] = {"success": True, "result": result}
            print(f"✅ {name} completed successfully")
        except Exception as e:
            results[name] = {"success": False, "error": str(e)}
            print(f"❌ {name} failed: {e}")
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    successful = sum(1 for r in results.values() if r["success"])
    total = len(results)
    
    print(f"\nCompleted: {successful}/{total} examples")
    print("\nResults:")
    for name, result in results.items():
        status = "✅" if result["success"] else "❌"
        print(f"  {status} {name}")
    
    print("\n" + "="*60)
    print("All conversational AI examples completed!")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
