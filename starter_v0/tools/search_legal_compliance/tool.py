from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE_FILE = ROOT / "pii_data" / "decree_13_knowledge.json"


def _terms(value: str) -> set[str]:
    normalized = unicodedata.normalize("NFD", value.casefold())
    folded = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return {term for term in re.findall(r"[a-z0-9]+", folded) if len(term) > 1}


def search_legal_compliance(
    query: str,
    regulation: str = "Nghị định 13/2023/NĐ-CP",
) -> dict[str, Any]:
    """Search the small local legal catalog used by the v0 lab baseline."""
    try:
        items = json.loads(KNOWLEDGE_FILE.read_text(encoding="utf-8"))
        query_terms = _terms(query or "")
        matches: list[dict[str, Any]] = []

        for item in items:
            text = " ".join(str(item.get(key, "")) for key in ("article", "title", "content"))
            score = len(query_terms & _terms(text))
            if score:
                matches.append({
                    "article": item.get("article"),
                    "title": item.get("title"),
                    "summary": item.get("content"),
                    "score": score,
                })

        matches.sort(key=lambda match: (-match["score"], str(match["article"])))
        return {
            "tool": "search_legal_compliance",
            "query": query,
            "regulation": regulation,
            "results": matches[:3],
            "source": "local_decree_13_knowledge",
            "notice": "Thông tin tham khảo từ catalog nội bộ của bài lab, không phải tư vấn pháp lý.",
        }
    except Exception as exc:
        return {
            "tool": "search_legal_compliance",
            "error": type(exc).__name__,
            "message": str(exc),
        }
