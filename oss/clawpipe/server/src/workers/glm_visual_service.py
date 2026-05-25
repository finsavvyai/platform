"""GLM-4V Multimodal AI Service for FinSavvyAI."""

import base64
import io
import logging
from pathlib import Path
from typing import Dict, List, Optional

try:
    import torch
except ImportError:
    torch = None

AutoModel = None
AutoTokenizer = None
GenerationConfig = None
GLM_AVAILABLE = False

try:
    from transformers import AutoModel, AutoTokenizer
    from transformers_stream_generator import GenerationConfig

    GLM_AVAILABLE = True
except ImportError:
    pass

Image = None
VISION_AVAILABLE = False

try:
    from PIL import Image

    VISION_AVAILABLE = True
except ImportError:
    pass

logger = logging.getLogger("finsavvyai.glm_visual")


class GLMVisualService:
    """GLM-4V Multimodal AI Service."""

    def __init__(self, model_path: Optional[str] = None) -> None:
        if model_path is None:
            self.model_path = str(Path.home() / "finsavvyai-models" / "glm-4v-9b")
        else:
            self.model_path = model_path

        self.tokenizer = None
        self.model = None
        self.device = "mps" if (torch and torch.backends.mps.is_available()) else "cpu"
        self.loaded = False

        logger.info(
            "Initializing GLM-4V Service",
            extra={
                "model_path": self.model_path,
                "device": self.device,
                "glm_available": GLM_AVAILABLE,
                "vision_available": VISION_AVAILABLE,
            },
        )

    async def load_model(self) -> bool:
        """Load GLM-4V model."""
        if not GLM_AVAILABLE or not VISION_AVAILABLE:
            logger.error("Required dependencies not available")
            return False

        logger.info("Loading GLM-4V model...")
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path, trust_remote_code=True)
            self.model = AutoModel.from_pretrained(
                self.model_path,
                trust_remote_code=True,
                torch_dtype=torch.float16 if self.device == "mps" else torch.float32,
                device_map="auto" if self.device == "mps" else None,
                low_cpu_mem_usage=True,
            ).eval()

            if self.device == "cpu":
                self.model = self.model.to("cpu")

            self.model.config.use_cache = True
            self.loaded = True
            logger.info("GLM-4V model loaded successfully")
            return True
        except Exception as e:
            logger.error("Failed to load GLM-4V model: %s", e)
            return False

    @staticmethod
    def encode_image(image_data: bytes) -> str:
        """Encode image data to base64."""
        return base64.b64encode(image_data).decode("utf-8")

    @staticmethod
    def preprocess_image(image_data: bytes) -> "Image.Image":
        """Preprocess image for GLM-4V."""
        try:
            image = Image.open(io.BytesIO(image_data))
            if image.mode != "RGB":
                image = image.convert("RGB")
            max_size = 1024
            if max(image.size) > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            return image
        except Exception as e:
            raise ValueError(f"Could not process image: {e}") from e

    async def generate_response(
        self,
        messages: List[Dict],
        model: str = "glm-4v-9b",
        image_data: Optional[bytes] = None,
    ) -> str:
        """Generate response using GLM-4V with optional image."""
        if not self.loaded or not self.model or not self.tokenizer:
            fallback = "Hello! I'm a simulated GLM-4V response."
            if image_data:
                fallback += " I can see you included an image!"
            return fallback

        try:
            glm_messages = [{"role": m["role"], "content": m["content"]} for m in messages]

            if image_data:
                image = self.preprocess_image(image_data)
                if glm_messages and glm_messages[-1]["role"] == "user":
                    glm_messages[-1]["content"] = [
                        {"type": "text", "text": glm_messages[-1]["content"]},
                        {"type": "image", "image": image},
                    ]
                logger.info("Processing image with GLM-4V")

            with torch.no_grad():
                response, _ = self.model.chat(
                    self.tokenizer,
                    glm_messages,
                    history=[],
                    generation_config=GenerationConfig(
                        temperature=0.7, top_p=0.9, max_new_tokens=512
                    ),
                )
            return response
        except Exception as e:
            logger.error("GLM-4V generation error: %s", e)
            return f"Sorry, I encountered an error processing your request: {e}"
