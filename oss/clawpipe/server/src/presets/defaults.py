"""Built-in role presets — 20 AI personas across 5 categories."""

from src.presets.coding_presets import CODING_PRESETS
from src.presets.writing_presets import WRITING_PRESETS
from src.presets.business_presets import BUSINESS_PRESETS
from src.presets.creative_presets import CREATIVE_PRESETS
from src.presets.education_presets import EDUCATION_PRESETS

DEFAULT_PRESETS: list[dict] = [
    *CODING_PRESETS,
    *WRITING_PRESETS,
    *BUSINESS_PRESETS,
    *CREATIVE_PRESETS,
    *EDUCATION_PRESETS,
]
