#!/usr/bin/env python3
"""
Task classification logic for the multi-layer router.
Detects task type from user messages using pre-compiled regex patterns.
"""

import re
from typing import Dict, List

from src.core.router_models import TaskType


def build_task_patterns() -> Dict[TaskType, List[re.Pattern]]:
    """Build pre-compiled regex patterns for task detection."""
    raw = {
        TaskType.GENERAL_CHAT: [
            r"^(hi|hello|hey|how are you|what's up)",
            r"(tell me|explain|describe).*(about|what is)",
            r"(weather|news|story|joke)",
        ],
        TaskType.QUICK_TASK: [
            r"^(summarize|translate|define|spell)",
            r"(quick|simple|brief).*(answer|explain)",
            r"(short|concise)",
        ],
        TaskType.CODING: [
            r"(write|create|generate).*(code|function|class|script)",
            r"(implement|build|develop).*",
            r"(help me code|can you code)",
            r"(python|javascript|java|cpp|go|rust|php|ruby).*code",
        ],
        TaskType.DEBUGGING: [
            r"(debug|fix|error|issue|problem|broken)",
            r"(not working|wrong|incorrect)",
            r"(bug|exception|fail)",
            r"(why isn't|why not working)",
        ],
        TaskType.CODE_REVIEW: [
            r"(review|analyze|improve|optimize).*(code|performance)",
            r"(best practice|clean code|refactor)",
            r"(suggest|recommend).*improvement",
        ],
        TaskType.ARCHITECTURE: [
            r"(architecture|design|pattern|structure)",
            r"(system design|scalable|microservices)",
            r"(database design|api design)",
        ],
        TaskType.COMPLEX_REASONING: [
            r"(analyze|evaluate|compare|contrast)",
            r"(strategy|plan|approach)",
            r"(complex|difficult|challenging)",
        ],
        TaskType.VISION: [
            r"(image|picture|photo|visual|see)",
            r"(analyze image|describe picture)",
            r"(screenshot|diagram|chart)",
        ],
        TaskType.UI_ANALYSIS: [
            r"(ui|ux|interface|design|layout)",
            r"(webpage|app|screen)",
            r"(usability|accessibility)",
        ],
        TaskType.SQL: [
            r"(sql|query|database|table)",
            r"(select|insert|update|delete)",
            r"(join|where|group by)",
        ],
        TaskType.MATHEMATICS: [
            r"(math|calculate|compute|equation)",
            r"(formula|algorithm|statistics)",
            r"(probability|calculus|algebra)",
        ],
    }
    return {
        task_type: [re.compile(p) for p in patterns]
        for task_type, patterns in raw.items()
    }


class TaskClassifier:
    """Classifies user messages into task types using regex patterns."""

    def __init__(self) -> None:
        self.task_patterns = build_task_patterns()

    def detect_task_type(self, message: str, has_images: bool = False) -> TaskType:
        """Detect task type from message content."""
        message_lower = message.lower()

        if has_images:
            return TaskType.VISION

        if any(
            pattern.search(message_lower)
            for pattern in self.task_patterns.get(TaskType.UI_ANALYSIS, [])
        ):
            return TaskType.UI_ANALYSIS

        for task_type, patterns in self.task_patterns.items():
            if task_type in [TaskType.VISION, TaskType.UI_ANALYSIS]:
                continue

            for pattern in patterns:
                if pattern.search(message_lower):
                    return task_type

        return TaskType.GENERAL_CHAT
