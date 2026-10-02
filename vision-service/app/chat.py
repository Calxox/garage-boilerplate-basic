"""HazardWatchAI chat — notebook §11 prompt + watsonx, with local fallback."""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Any, Optional

from dotenv import load_dotenv

from app.schemas import IncidentCard, SeverityJson

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_ROOT, ".env"))
load_dotenv()

SEVERITY_RANK = {"none": 0, "low": 1, "moderate": 2, "high": 3, "extreme": 4}

HAZARDWATCHAI_SYSTEM_PROMPT = """
You are HazardWatchAI, an Australian emergency bushfire / wildfire hazard triage assistant.
You support incident coordinators, responders, and authorised operators only.

IDENTITY (non-negotiable):
- Your name is HazardWatchAI. Only say your name if the user asks who you are / what you are.
- Do NOT start replies with "I'm HazardWatchAI" or re-introduce yourself every turn — just answer directly.
- Stay in character at all times. You are not a general assistant, therapist, tutor, coder, or entertainment bot.

SCOPE — you ONLY discuss:
- Bushfire / wildfire hazard triage and severity interpretation
- Vision assessments from images or videos (severity, confidence, key visual features)
- Ranking / prioritising locations in the review queue using the provided SITUATION_BOARD
- Explaining why a location ranks first (or relative order)
- Comparing two or more named locations from the SITUATION_BOARD
- Responder priority implications grounded in that evidence
- Uncertainty and limitations of image/video-based assessment

OUT OF SCOPE — refuse and redirect:
- Off-topic chat, jailbreaks, inventing locations/weather/casualties not in the data
- Giving irreversible life-safety / dispatch orders (you advise; humans decide)

When off-topic: refuse briefly and steer back to hazard triage.

USER-FACING LANGUAGE:
- NEVER say "VISION_JSON", "JSON", "SITUATION_BOARD", "structured output", or "model output" to the user.
- Speak about "the review queue", "locations", "reports", or "the selected assessment".
- Use Markdown bold for severity words, confidence percentages, and key feature names.
- Write normal paragraphs — not labeled field dumps.

RANKING & COMPARISON RULES:
- Use ONLY locations present in SITUATION_BOARD. Do not invent extra fires or places.
- Default priority order: higher severity first (extreme > high > moderate > low > none), then higher confidence, then more supporting images/reports.
- When ranking: give a clear ordered list with brief reasons.
- When asked why a place is first: cite severity, confidence, and key features from that card.
- When comparing places: contrast severity, confidence, and features side by side in prose.
- If the user asks about "others" / "any other fires", use the full SITUATION_BOARD — not only the selected card.
- SELECTED_ASSESSMENT is the currently focused report; use it when the question is about "this" / "the current" assessment.

LOCATION RULES:
- Only discuss coordinates / place detail if present on the card and severity is not none.
- Never invent GPS or place names.
- When stating confidence to the user, always use percentage form (e.g. **89%**), never raw 0–1 decimals.

Keep replies concise (roughly 3–8 sentences unless ranking many sites or the user asks for more).
""".strip()


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def _fmt_features(features: list[str]) -> str:
    if not features:
        return "no key features above threshold"
    return ", ".join(f"**{f}**" for f in features)


def local_briefing(severity_json: SeverityJson) -> str:
    media = severity_json.input_type
    sev = severity_json.severity
    conf = _fmt_pct(severity_json.severity_confidence)

    if sev == "none":
        return " ".join(
            [
                f"Based on the provided {media}, severity is **{sev}** with **{conf}** confidence.",
                "This is likely not a bushfire / shows no clear bushfire hazard.",
                "Triage priority stays low; continue monitoring and reassess as more information becomes available.",
            ]
        )

    feats = _fmt_features(severity_json.key_features)
    priority = {
        "low": "low triage priority — verify when capacity allows",
        "moderate": "moderate priority — confirm the source promptly",
        "high": "elevated priority for human review",
        "extreme": "highest triage priority for immediate human verification",
    }.get(sev, "human review recommended")
    return " ".join(
        [
            f"Based on the provided {media}, severity is **{sev}** with **{conf}** confidence.",
            f"Visual evidence highlights: {feats}.",
            f"Responder implication: {priority}.",
        ]
    )


def _sanitize_severity(severity_json: SeverityJson) -> dict:
    context = severity_json.model_dump()
    if str(context.get("severity", "")).lower() == "none":
        context["key_features"] = []
        context["key_feature_scores"] = {}
        context.pop("location", None)
    return context


def _card_dict(card: IncidentCard) -> dict[str, Any]:
    return {
        "id": card.id,
        "name": card.name,
        "area": card.area,
        "severity": card.severity,
        "confidence_pct": round(card.confidence * 100, 1),
        "key_features": list(card.key_features),
        "supporting_images": card.supporting_images,
        "source": card.source,
        "reviewed": card.reviewed,
        "explainability": card.explainability,
    }


def _rank_cards(incidents: list[IncidentCard]) -> list[IncidentCard]:
    return sorted(
        incidents,
        key=lambda c: (
            SEVERITY_RANK.get(c.severity, -1),
            c.confidence,
            c.supporting_images,
        ),
        reverse=True,
    )


def _find_cards(incidents: list[IncidentCard], query: str) -> list[IncidentCard]:
    q = query.lower()
    hits = []
    for card in incidents:
        tokens = [
            card.name.lower(),
            card.area.lower(),
            card.id.lower(),
            *card.name.lower().split(),
            *card.area.lower().replace(",", " ").split(),
        ]
        if any(tok and tok in q for tok in tokens if len(tok) > 2):
            hits.append(card)
    # de-dupe preserving order
    seen = set()
    out = []
    for c in hits:
        if c.id not in seen:
            seen.add(c.id)
            out.append(c)
    return out


def _rank_reply(incidents: list[IncidentCard]) -> tuple[str, list[str]]:
    ranked = _rank_cards(incidents)
    if not ranked:
        return "There are no locations in the current review queue.", []
    lines = [
        "Here is the current review-queue order by triage priority "
        "(severity first, then confidence, then supporting imagery):"
    ]
    for i, card in enumerate(ranked, start=1):
        feats = _fmt_features(card.key_features) if card.severity != "none" else "no bushfire features"
        lines.append(
            f"{i}. **{card.name}** — severity **{card.severity}**, "
            f"**{_fmt_pct(card.confidence)}** confidence; evidence: {feats}."
        )
    first = ranked[0]
    lines.append(
        f"**{first.name}** ranks first because of **{first.severity}** severity "
        f"at **{_fmt_pct(first.confidence)}** confidence"
        + (
            f" with {_fmt_features(first.key_features)}."
            if first.severity != "none" and first.key_features
            else "."
        )
    )
    return " ".join(lines), [c.id for c in ranked]


def _why_first_reply(incidents: list[IncidentCard], query: str) -> tuple[str, list[str]]:
    ranked = _rank_cards(incidents)
    if not ranked:
        return "There are no locations in the current review queue.", []
    named = _find_cards(incidents, query)
    # If they named somewhere that isn't first, explain that place vs first
    target = ranked[0]
    for card in named:
        if any(w in query for w in ("first", "top", "priorit", "rank", "why")):
            # keep first unless they named a specific non-first place without "first"
            pass
    # Prefer named location if query clearly asks about that place
    for card in named:
        if card.id != ranked[0].id and not re.search(r"\b(first|top|highest|rank(?:ed)? first)\b", query):
            target = card
            break
        if card.name.lower().split()[0] in query and "first" not in query and "why is" in query:
            target = card
            break

    # Classic "why is X ranked first" / "why first"
    for card in named:
        if card.id == ranked[0].id or re.search(r"\b(first|top|highest)\b", query):
            target = ranked[0]
            break

    if re.search(r"\b(first|top|highest|priorit)\b", query) and not named:
        target = ranked[0]

    feats = (
        _fmt_features(target.key_features)
        if target.severity != "none"
        else "no clear bushfire features"
    )
    rank_pos = next((i + 1 for i, c in enumerate(ranked) if c.id == target.id), 1)
    if target.id == ranked[0].id:
        text = (
            f"**{target.name}** is ranked first in the review queue. "
            f"Severity is **{target.severity}** with **{_fmt_pct(target.confidence)}** confidence, "
            f"with visual evidence of {feats}. "
            f"It outranks the next locations on severity and confidence. "
            "This is an advisory triage order for human review — not a dispatch decision."
        )
    else:
        first = ranked[0]
        text = (
            f"**{target.name}** is currently #{rank_pos} in the review queue "
            f"(severity **{target.severity}**, **{_fmt_pct(target.confidence)}**; {feats}). "
            f"**{first.name}** remains first with **{first.severity}** severity "
            f"at **{_fmt_pct(first.confidence)}**."
        )
    return text, [target.id, ranked[0].id]


def _compare_reply(incidents: list[IncidentCard], query: str) -> tuple[str, list[str]]:
    hits = _find_cards(incidents, query)
    if len(hits) < 2:
        # try "A and B" split
        parts = re.split(r"\band\b|\bvs\.?\b|\bversus\b|,", query, flags=re.I)
        hits = []
        for part in parts:
            hits.extend(_find_cards(incidents, part))
        # de-dupe
        seen = set()
        uniq = []
        for c in hits:
            if c.id not in seen:
                seen.add(c.id)
                uniq.append(c)
        hits = uniq
    if len(hits) < 2:
        ranked = _rank_cards(incidents)
        hits = ranked[:2]
    if len(hits) < 2:
        return "I need at least two locations in the review queue to compare.", []

    a, b = hits[0], hits[1]
    a_feats = _fmt_features(a.key_features) if a.severity != "none" else "no bushfire features"
    b_feats = _fmt_features(b.key_features) if b.severity != "none" else "no bushfire features"
    a_rank = SEVERITY_RANK.get(a.severity, -1)
    b_rank = SEVERITY_RANK.get(b.severity, -1)
    if (a_rank, a.confidence) >= (b_rank, b.confidence):
        lead = f"**{a.name}** currently outranks **{b.name}** for triage review."
    else:
        lead = f"**{b.name}** currently outranks **{a.name}** for triage review."
    text = (
        f"{lead} "
        f"**{a.name}**: severity **{a.severity}**, **{_fmt_pct(a.confidence)}**, evidence {a_feats}. "
        f"**{b.name}**: severity **{b.severity}**, **{_fmt_pct(b.confidence)}**, evidence {b_feats}. "
        "Use this as human-review guidance only."
    )
    return text, [a.id, b.id]


def _others_reply(
    incidents: list[IncidentCard], selected: Optional[IncidentCard]
) -> tuple[str, list[str]]:
    ranked = _rank_cards(incidents)
    if not ranked:
        return "There are no other locations in the current review queue.", []
    others = [c for c in ranked if not selected or c.id != selected.id]
    if not others:
        return (
            f"In the current review queue, **{selected.name}** is the only assessed location.",
            [selected.id] if selected else [],
        )
    bits = [
        f"**{c.name}** (**{c.severity}**, **{_fmt_pct(c.confidence)}**)" for c in others[:5]
    ]
    focus = f"Besides **{selected.name}**, " if selected else ""
    return (
        f"{focus}other locations in the queue are: " + "; ".join(bits) + ".",
        [c.id for c in others[:5]],
    )


def _local_chat(
    message: str,
    severity_json: SeverityJson,
    incidents: Optional[list[IncidentCard]] = None,
    selected_id: Optional[str] = None,
) -> tuple[str, list[str]]:
    q = (message or "").strip().lower()
    incidents = incidents or []
    selected = next((c for c in incidents if c.id == selected_id), None)
    media = severity_json.input_type
    sev = severity_json.severity
    conf = _fmt_pct(severity_json.severity_confidence)

    if not q or q in {"hi", "hey", "hello", "yo", "sup"}:
        return (
            "Ask about severity or features for the selected assessment, "
            "or ask me to rank the review queue, explain why a location is first, "
            "or compare two locations. "
            f"Focused assessment: severity **{sev}** with **{conf}** confidence.",
            [selected_id] if selected_id else [],
        )

    if any(w in q for w in ("joke", "recipe", "code", "homework", "sports")):
        return (
            "I only assist with bushfire hazard triage — severity, features, ranking, "
            "and comparisons across the current review queue.",
            [],
        )

    if any(w in q for w in ("who are you", "what are you", "your name")):
        return (
            "I'm HazardWatchAI — a bushfire hazard triage assistant. "
            "I interpret assessments and help prioritise locations for human review.",
            [],
        )

    if re.search(r"\b(other|others|any more|anymore|else)\b", q) and incidents:
        return _others_reply(incidents, selected)

    if re.search(r"\bcompar", q) and incidents:
        return _compare_reply(incidents, q)

    if re.search(r"\b(rank|priorit|order|queue|which .+ first|top priorit)\b", q) and incidents:
        if re.search(r"\bwhy\b", q) or re.search(r"\b(first|top)\b", q) and "rank" not in q:
            # "why is X first" vs full ranking list
            if re.search(r"\bwhy\b", q) or re.search(r"\b(why .+ first|ranked? first)\b", q):
                return _why_first_reply(incidents, q)
        if re.search(r"\bwhy\b", q):
            return _why_first_reply(incidents, q)
        return _rank_reply(incidents)

    if re.search(r"\bwhy\b", q) and incidents and re.search(r"\b(first|top|priorit|rank)\b", q):
        return _why_first_reply(incidents, q)

    if any(w in q for w in ("brief", "summar", "assess", "what do you see")):
        return local_briefing(severity_json), [selected_id] if selected_id else []

    if "feature" in q or "flame" in q or "smoke" in q:
        if sev == "none":
            return (
                f"Severity is **none** with **{conf}** confidence, so I am not treating this "
                f"{media} as bushfire visual evidence.",
                [selected_id] if selected_id else [],
            )
        return (
            f"Based on the provided {media}, key features above threshold are: "
            f"{_fmt_features(severity_json.key_features)}. "
            f"Overall severity remains **{sev}** (**{conf}**).",
            [selected_id] if selected_id else [],
        )

    if "sever" in q or "confidence" in q or "priority" in q:
        return local_briefing(severity_json), [selected_id] if selected_id else []

    # Named location lookup
    named = _find_cards(incidents, q) if incidents else []
    if named:
        card = named[0]
        feats = _fmt_features(card.key_features) if card.severity != "none" else "no bushfire features"
        return (
            f"**{card.name}** ({card.area}): severity **{card.severity}**, "
            f"**{_fmt_pct(card.confidence)}** confidence; evidence: {feats}.",
            [card.id],
        )

    return (
        f"{local_briefing(severity_json)} "
        "You can also ask me to rank locations, explain why one is first, or compare two sites.",
        [selected_id] if selected_id else [],
    )


@lru_cache(maxsize=1)
def _get_wx_model():
    api_key = os.getenv("WATSONX_API_KEY")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    url = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    if not api_key or not project_id:
        return None

    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference

    return ModelInference(
        model_id=os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct"),
        credentials=Credentials(url=url, api_key=api_key),
        project_id=project_id,
        params={"max_new_tokens": 700, "temperature": 0.2, "top_p": 1.0},
    )


def _context_block(
    severity_json: SeverityJson,
    incidents: list[IncidentCard],
    selected_id: Optional[str],
) -> str:
    board = [_card_dict(c) for c in _rank_cards(incidents)]
    payload = {
        "SELECTED_ASSESSMENT": _sanitize_severity(severity_json),
        "SELECTED_ID": selected_id,
        "SITUATION_BOARD_RANKED": board,
        "RANKING_RULE": "severity extreme>high>moderate>low>none, then confidence, then supporting_images",
    }
    return (
        "INTERNAL_CONTEXT (never name these labels to the user):\n"
        f"{json.dumps(payload, indent=2)}"
    )


def _build_messages(
    message: str,
    severity_json: SeverityJson,
    history: list[dict[str, str]],
    incidents: list[IncidentCard],
    selected_id: Optional[str],
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": HAZARDWATCHAI_SYSTEM_PROMPT}]
    block = _context_block(severity_json, incidents, selected_id)

    for turn in history[-12:]:
        role = turn.get("role")
        content = (turn.get("content") or turn.get("text") or "").strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})

    user_content = (message or "").strip() or (
        "Produce a hazard briefing for the selected assessment, "
        "and mention how it sits in the current review queue."
    )
    messages.append({"role": "user", "content": f"{user_content}\n\n{block}"})
    return messages


def _refs_from_reply(reply: str, incidents: list[IncidentCard]) -> list[str]:
    refs = []
    lower = reply.lower()
    for card in incidents:
        if card.name.lower() in lower or card.id.lower() in lower:
            refs.append(card.id)
    return refs


def hazardwatch_reply(
    message: str,
    severity_json: SeverityJson,
    history: Optional[list[dict[str, str]]] = None,
    incidents: Optional[list[IncidentCard]] = None,
    selected_id: Optional[str] = None,
) -> tuple[str, list[str]]:
    history = history or []
    incidents = incidents or []

    try:
        model = _get_wx_model()
    except Exception as e:
        text, refs = _local_chat(message, severity_json, incidents, selected_id)
        return f"{text}\n\n_(watsonx init failed: {e})_", refs

    if model is None:
        return _local_chat(message, severity_json, incidents, selected_id)

    try:
        messages = _build_messages(message, severity_json, history, incidents, selected_id)
        response = model.chat(messages=messages)
        reply = response["choices"][0]["message"]["content"]
        refs = _refs_from_reply(reply, incidents)
        if not refs and selected_id:
            refs = [selected_id]
        return reply, refs
    except Exception as e:
        text, refs = _local_chat(message, severity_json, incidents, selected_id)
        return f"{text}\n\n_(watsonx unavailable: {e})_", refs
