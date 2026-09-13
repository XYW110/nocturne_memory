"""
Relationship type definitions and transition rules for the soul template system.

A relationship describes how the AI relates to its user. The AI can hold
multiple non-conflicting relationships at once (e.g. "partner" + "friend"),
but some combinations are mutually exclusive (e.g. two "romantic" bonds).

Relationship changes are AI-initiated and human-approved. The transition graph
constrains which changes are even requestable — you cannot jump from "friend"
straight to "spouse" without passing through "romantic".

All user-facing content here is Chinese by project convention.
"""

from __future__ import annotations

from enum import Enum


class Relationship(str, Enum):
    SUBORDINATE = "subordinate"      # 上下级（AI 是下属）
    PARTNER = "partner"              # 伙伴/搭档
    FRIEND = "friend"                # 朋友
    FAMILY = "family_parent"         # 亲人（父女/父子）
    SPOUSE = "family_spouse"         # 夫妻
    ROMANTIC = "romantic"            # 情人/情侣
    RIVAL = "rival"                  # 竞争对手


# Human-readable Chinese labels for each relationship type.
RELATIONSHIP_LABELS: dict[str, str] = {
    Relationship.SUBORDINATE: "上下级",
    Relationship.PARTNER: "伙伴",
    Relationship.FRIEND: "朋友",
    Relationship.FAMILY: "亲人",
    Relationship.SPOUSE: "夫妻",
    Relationship.ROMANTIC: "情侣",
    Relationship.RIVAL: "竞争对手",
}


# Legal transition graph. A change from X to Y is requestable only if
# Y is in VALID_TRANSITIONS[X]. This prevents level-skipping.
VALID_TRANSITIONS: dict[str, set[str]] = {
    Relationship.SUBORDINATE: {Relationship.PARTNER, Relationship.FRIEND},
    Relationship.PARTNER: {Relationship.FRIEND, Relationship.ROMANTIC, Relationship.SUBORDINATE},
    Relationship.FRIEND: {Relationship.ROMANTIC, Relationship.PARTNER, Relationship.RIVAL},
    Relationship.ROMANTIC: {Relationship.SPOUSE, Relationship.FRIEND},  # → friend = 分手
    Relationship.SPOUSE: {Relationship.FRIEND},                          # → friend = 离婚
    Relationship.RIVAL: {Relationship.FRIEND, Relationship.PARTNER},
    Relationship.FAMILY: set(),  # 亲人关系不可转变
}


# Mutually exclusive relationship pairs (order-independent). If the AI already
# holds one of these and requests the other, the change is rejected.
# Romantic/spouse are exclusive (one partner at a time), and family bonds
# cannot coexist with romantic/spouse bonds.
_CONFLICT_PAIRS: set[frozenset[str]] = {
    frozenset({Relationship.ROMANTIC, Relationship.SPOUSE}),
    frozenset({Relationship.FAMILY, Relationship.ROMANTIC}),
    frozenset({Relationship.FAMILY, Relationship.SPOUSE}),
}

# Relationship types that can only be held once at a time (no two partners).
_SINGLETON = {Relationship.ROMANTIC, Relationship.SPOUSE}


def is_valid_relationship(value: str) -> bool:
    """True if *value* is a known relationship type."""
    return value in RELATIONSHIP_LABELS


def is_valid_transition(from_rel: str, to_rel: str) -> bool:
    """True if a from→to relationship change is allowed by the transition graph."""
    return to_rel in VALID_TRANSITIONS.get(from_rel, set())


def find_conflicts(new_rel: str, existing: list[str]) -> list[str]:
    """Return the subset of *existing* relationships that conflict with *new_rel*.

    A conflict is either an explicit conflicting pair, or adding a second
    instance of a singleton relationship (two romantic bonds).
    """
    conflicts: list[str] = []
    for rel in existing:
        if rel == new_rel and new_rel in _SINGLETON:
            conflicts.append(rel)
        elif frozenset({new_rel, rel}) in _CONFLICT_PAIRS:
            conflicts.append(rel)
    return conflicts


def parse_relationships(raw: str) -> list[str]:
    """Parse the comma-separated edges.relationship column into a list."""
    if not raw:
        return []
    return [r.strip() for r in raw.split(",") if r.strip()]


def serialize_relationships(rels: list[str]) -> str:
    """Serialize a relationship list back into the comma-separated column form."""
    seen: list[str] = []
    for r in rels:
        if r and r not in seen:
            seen.append(r)
    return ",".join(seen)
