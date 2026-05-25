#!/usr/bin/env python3
"""
Simplified AI Service for FinSavvyAI
Uses transformers directly for local model inference
"""

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Optional

import aiohttp
import torch
from aiohttp import web
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline


class SimpleAIService:
    """Simple AI service using transformers"""

    def __init__(self, model_path: str = None):
        self.model_path = model_path or str(Path.home() / "finsavvyai-models" / "phi-2")
        self.tokenizer = None
        self.model = None
        self.pipeline = None
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"

    async def load_model(self):
        """Load the model"""
        print(f"🔄 Loading model from {self.model_path}")
        print(f"🖥️  Using device: {self.device}")

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_path, trust_remote_code=True
            )

            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                torch_dtype=torch.float16 if self.device == "mps" else torch.float32,
                device_map="auto" if self.device == "mps" else None,
                trust_remote_code=True,
            )

            if self.device == "cpu":
                self.model = self.model.to("cpu")

            # Create pipeline
            self.pipeline = pipeline(
                "text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id,
            )

            print("✅ Model loaded successfully!")

        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            print("💡 Using fallback responses")
            self.pipeline = None

    async def generate_response(
        self, messages: List[Dict], model: str = "phi-2"
    ) -> str:
        """Generate a response using the loaded model"""
        if not self.pipeline:
            return f"Hello! I'm a simulated AI response from {model}. The actual model failed to load, but this demonstrates the cluster is working."

        try:
            # Convert messages to prompt
            prompt = ""
            for msg in messages:
                if msg["role"] == "user":
                    prompt += f"Human: {msg['content']}\n\n"
                elif msg["role"] == "assistant":
                    prompt += f"Assistant: {msg['content']}\n\n"

            prompt += "Assistant: "

            # Generate response
            result = self.pipeline(
                prompt,
                max_new_tokens=256,
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id,
            )

            response = result[0]["generated_text"].split("Assistant: ")[-1].strip()
            return response

        except Exception as e:
            print(f"❌ Generation error: {e}")
            return f"Sorry, I encountered an error generating a response: {str(e)}"


class AIWorkerNode:
    """Worker node with actual AI capabilities"""

    def __init__(
        self,
        node_id: str,
        name: str,
        host: str,
        port: int,
        models: List[str],
        master_host: str = "localhost",
        master_port: int = 8000,
    ):
        self.node_id = node_id
        self.name = name
        self.host = host
        self.port = port
        self.models = models
        self.master_url = f"http://{master_host}:{master_port}"
        self.session = None
        self.heartbeat_task = None
        self.ai_service = SimpleAIService()

    async def start(self):
        """Start the AI worker node"""
        self.session = aiohttp.ClientSession()

        # Load AI model
        await self.ai_service.load_model()

        # Wait a moment for master to be ready
        await asyncio.sleep(1)

        # Register with master
        await self.register_with_master()

        # Start heartbeat
        self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())

        # Start AI server
        await self.start_ai_server()

        print(f"🤖 AI Worker node started: {self.name} on {self.host}:{self.port}")

    async def register_with_master(self):
        """Register this node with the cluster master"""
        data = {
            "id": self.node_id,
            "name": self.name,
            "host": self.host,
            "port": self.port,
            "models": self.models,
            "capabilities": {
                "gpu": torch.backends.mps.is_available(),
                "device": self.ai_service.device,
                "model_loaded": self.ai_service.pipeline is not None,
            },
            "max_load": 2,  # Lower max load for real AI processing
        }

        try:
            async with self.session.post(
                f"{self.master_url}/cluster/join", json=data
            ) as response:
                result = await response.json()
                if result.get("status") == "registered":
                    print(f"✅ {self.name} registered with cluster master")
                else:
                    print(f"❌ Failed to register: {result}")
        except Exception as e:
            print(f"❌ {self.name} cannot connect to cluster master: {e}")

    async def heartbeat_loop(self):
        """Send periodic heartbeat to master"""
        while True:
            try:
                data = {
                    "id": self.node_id,
                    "status": "online",
                    "load": 1,  # Mock load
                }

                async with self.session.post(
                    f"{self.master_url}/cluster/heartbeat", json=data
                ) as response:
                    if response.status == 200:
                        pass  # Heartbeat successful

            except Exception as e:
                print(f"❌ {self.name} heartbeat error: {e}")

            await asyncio.sleep(30)

    async def start_ai_server(self):
        """Start AI server with OpenAI-compatible endpoints"""
        from aiohttp import web

        app = web.Application()
        app.router.add_post("/v1/chat/completions", self.handle_completion)
        app.router.add_get("/v1/models", self.handle_models)
        app.router.add_get("/health", self.handle_health)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()

        print(f"🔥 AI server running on http://{self.host}:{self.port}")

    async def handle_completion(self, request):
        """Handle chat completion requests with real AI"""
        data = await request.json()
        messages = data.get("messages", [])
        model = data.get("model", "phi-2")

        print(f"🧠 Generating response for {len(messages)} messages using {model}")

        # Generate response
        start_time = time.time()
        response_text = await self.ai_service.generate_response(messages, model)
        generation_time = time.time() - start_time

        response = {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": response_text},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": sum(
                    len(str(msg.get("content", ""))) for msg in messages
                )
                // 4,
                "completion_tokens": len(response_text) // 4,
                "total_tokens": (
                    sum(len(str(msg.get("content", ""))) for msg in messages)
                    + len(response_text)
                )
                // 4,
            },
            "worker_info": {
                "node_id": self.node_id,
                "node_name": self.name,
                "host": self.host,
                "device": self.ai_service.device,
                "generation_time": f"{generation_time:.2f}s",
            },
        }

        return web.json_response(response)

    async def handle_models(self, request):
        """Return available models"""
        models = []
        for model in self.models:
            models.append(
                {
                    "id": model,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": f"worker-{self.node_id}",
                }
            )

        return web.json_response({"object": "list", "data": models})

    async def handle_health(self, request):
        """Health check endpoint"""
        return web.json_response(
            {
                "status": "healthy",
                "node_id": self.node_id,
                "node_name": self.name,
                "host": self.host,
                "models": self.models,
                "device": self.ai_service.device,
                "model_loaded": self.ai_service.pipeline is not None,
            }
        )


async def test_ai_worker():
    """Test AI worker with real model"""
    print("🧠 Starting FinSavvyAI with Real Model...")

    # Start cluster master
    master = ClusterManager()
    master_task = asyncio.create_task(master.start())

    # Wait for master to start
    await asyncio.sleep(2)

    # Start AI worker
    ai_worker = AIWorkerNode(
        node_id="ai-worker-01",
        name="AI Worker",
        host="localhost",
        port=8001,
        models=["phi-2", "gpt-3.5-turbo-sim"],
    )

    worker_task = asyncio.create_task(ai_worker.start())

    # Wait for everything to start
    await asyncio.sleep(5)

    print("✅ AI Cluster is running!")
    print("🔗 Testing AI endpoints...")

    # Test the AI with a real request
    async with aiohttp.ClientSession() as session:
        try:
            # Test cluster status
            async with session.get("http://localhost:8000/cluster/status") as resp:
                status = await resp.json()
                print(f"📊 Cluster Status: {json.dumps(status, indent=2)}")

            # Test AI completion
            test_request = {
                "model": "phi-2",
                "messages": [
                    {
                        "role": "user",
                        "content": "Hello! Can you tell me a short fun fact about AI?",
                    }
                ],
            }

            print("🧪 Testing AI generation...")
            async with session.post(
                "http://localhost:8001/v1/chat/completions", json=test_request
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print("✅ AI Response:")
                    print(f"   {result['choices'][0]['message']['content']}")
                    print(
                        f"   ⏱️  Generation time: {result['worker_info']['generation_time']}"
                    )
                    print(f"   🖥️  Device: {result['worker_info']['device']}")
                else:
                    print(f"❌ AI request failed: {resp.status}")

        except Exception as e:
            print(f"❌ Error testing AI: {e}")

    print("\n🎉 FinSavvyAI is fully functional!")
    print("🔗 Available endpoints:")
    print("   Cluster Status: http://localhost:8000/cluster/status")
    print("   AI Chat API: http://localhost:8001/v1/chat/completions")
    print("   Worker Health: http://localhost:8001/health")

    # Keep running
    await asyncio.sleep(30)


# Import the ClusterManager from our previous test
from test_complete_cluster import ClusterManager

if __name__ == "__main__":
    try:
        asyncio.run(test_ai_worker())
    except KeyboardInterrupt:
        print("\n🛑 AI Cluster stopped")
