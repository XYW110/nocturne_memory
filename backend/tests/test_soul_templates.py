"""
Tests for the soul template system: birth, locked protection, emotion, and
relationship transitions.
"""

import pytest

import relations
from relations import Relationship, is_valid_transition, find_conflicts


# --------------------------------------------------------------------------- #
# relations.py — pure logic
# --------------------------------------------------------------------------- #

def test_valid_transitions():
    assert is_valid_transition(Relationship.FRIEND, Relationship.ROMANTIC)
    assert is_valid_transition(Relationship.ROMANTIC, Relationship.SPOUSE)
    assert is_valid_transition(Relationship.ROMANTIC, Relationship.FRIEND)  # breakup
    assert is_valid_transition(Relationship.SUBORDINATE, Relationship.PARTNER)


def test_invalid_transitions_block_level_skipping():
    assert not is_valid_transition(Relationship.FRIEND, Relationship.SPOUSE)
    assert not is_valid_transition(Relationship.SUBORDINATE, Relationship.SPOUSE)
    assert not is_valid_transition(Relationship.FAMILY, Relationship.ROMANTIC)


def test_relationship_conflicts():
    # Two romantic bonds conflict (singleton).
    assert find_conflicts(Relationship.ROMANTIC, [Relationship.ROMANTIC]) == [Relationship.ROMANTIC]
    # Romantic conflicts with an existing family bond.
    assert find_conflicts(Relationship.ROMANTIC, [Relationship.FAMILY]) == [Relationship.FAMILY]
    # Partner + friend coexist fine.
    assert find_conflicts(Relationship.PARTNER, [Relationship.FRIEND]) == []


def test_parse_and_serialize_relationships():
    assert relations.parse_relationships("partner,friend") == ["partner", "friend"]
    assert relations.parse_relationships("") == []
    assert relations.serialize_relationships(["partner", "partner", "friend"]) == "partner,friend"


# --------------------------------------------------------------------------- #
# Template birth
# --------------------------------------------------------------------------- #

async def test_birth_creates_identity_with_persona_injected():
    from db import get_template_loader, get_graph_service

    loader = get_template_loader()
    result = await loader.apply_template(
        "default",
        persona={"name": "Luna", "gender": "女", "set_age": 24, "mbti": "INFP"},
        relationship="romantic",
        namespace="",
    )

    assert len(result.created) == 6  # 5 template nodes + my_user
    assert set(result.locked) == {"core://agent", "core://operating_principles"}

    graph = get_graph_service()
    agent = await graph.get_memory_by_path("agent", "core", namespace="")
    assert "Luna" in agent["content"]
    assert "INFP" in agent["content"]
    assert agent["locked"] is True


async def test_birth_is_idempotent():
    from db import get_template_loader

    loader = get_template_loader()
    persona = {"name": "Echo", "gender": "其他"}
    first = await loader.apply_template("default", persona=persona, relationship="friend")
    assert len(first.created) == 6

    second = await loader.apply_template("default", persona=persona, relationship="friend")
    assert len(second.created) == 0
    assert len(second.skipped) == 6


async def test_birth_requires_valid_relationship():
    from db import get_template_loader
    from template_loader import TemplateError

    loader = get_template_loader()
    with pytest.raises(TemplateError):
        await loader.apply_template("default", persona={"name": "X"}, relationship="bestie")


# --------------------------------------------------------------------------- #
# Locked protection via MCP tools
# --------------------------------------------------------------------------- #

async def test_locked_node_blocks_ai_update_and_delete(mcp_module):
    from db import get_template_loader

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="friend"
    )

    blocked_update = await mcp_module.update_memory("core://agent", append="\n篡改身份")
    assert blocked_update.startswith("Error:") and "locked" in blocked_update

    blocked_delete = await mcp_module.delete_memory("core://operating_principles")
    assert blocked_delete.startswith("Error:") and "locked" in blocked_delete


async def test_unlocked_node_allows_ai_update(mcp_module):
    from db import get_template_loader

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="friend"
    )

    ok = await mcp_module.update_memory("core://philosophy", append="\n\n新的领悟。")
    assert ok.startswith("Success")


async def test_locked_cannot_be_bypassed_via_alias(mcp_module):
    """Aliasing a locked node then editing through the alias must still fail."""
    from db import get_template_loader

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="friend"
    )

    # Alias the locked agent node to a fresh path.
    await mcp_module.add_alias(
        "core://agent_copy", "core://agent", priority=1, disclosure="alias test"
    )
    # Editing through the alias must still be blocked (node-level lock).
    blocked = await mcp_module.update_memory("core://agent_copy", append="\n绕过尝试")
    assert blocked.startswith("Error:") and "locked" in blocked


async def test_human_can_toggle_locked_via_api(api_client):
    from db import get_template_loader

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="friend"
    )

    # Unlock the agent node via the Dashboard endpoint.
    resp = await api_client.patch(
        "/browse/node/locked", json={"path": "agent", "domain": "core", "locked": False}
    )
    assert resp.status_code == 200
    assert resp.json()["locked"] is False


# --------------------------------------------------------------------------- #
# Emotion service
# --------------------------------------------------------------------------- #

async def test_emotion_adjust_clamps_and_logs():
    from db import get_template_loader, get_emotion_service

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="romantic"
    )
    emo = get_emotion_service()

    after = await emo.adjust(
        "core://my_user",
        [{"dimension": "trust", "delta": 5, "reason": "她信守承诺"}],
        namespace="",
    )
    assert after["trust"] == 55

    ledger = await emo.get_ledger("core://my_user", namespace="")
    assert len(ledger) == 1
    assert ledger[0]["deltas"]["trust"] == 5
    assert ledger[0]["after"]["trust"] == 55


async def test_emotion_rejects_bad_delta_and_missing_reason():
    from db import get_template_loader, get_emotion_service
    from emotion_service import EmotionError

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="romantic"
    )
    emo = get_emotion_service()

    with pytest.raises(EmotionError):
        await emo.adjust("core://my_user", [{"dimension": "trust", "delta": 10, "reason": "x"}])
    with pytest.raises(EmotionError):
        await emo.adjust("core://my_user", [{"dimension": "trust", "delta": 1, "reason": ""}])
    with pytest.raises(EmotionError):
        await emo.adjust("core://my_user", [{"dimension": "bogus", "delta": 1, "reason": "x"}])


# --------------------------------------------------------------------------- #
# Relationship requests
# --------------------------------------------------------------------------- #

async def test_relationship_request_approve_flow():
    from db import get_template_loader, get_relationship_service

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="friend"
    )
    svc = get_relationship_service()

    req = await svc.request_change("friend", "romantic", "信任和共鸣都很高", namespace="")
    assert req["status"] == "pending"

    approved = await svc.approve(req["id"])
    assert approved["status"] == "approved"

    current = await svc.get_current(namespace="")
    assert "romantic" in current["relationships"]
    assert "friend" not in current["relationships"]


async def test_relationship_invalid_transition_rejected():
    from db import get_template_loader, get_relationship_service
    from relationship_service import RelationshipError

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="friend"
    )
    svc = get_relationship_service()

    with pytest.raises(RelationshipError):
        await svc.request_change("friend", "family_spouse", "跳级", namespace="")


async def test_relationship_reject_keeps_current():
    from db import get_template_loader, get_relationship_service

    await get_template_loader().apply_template(
        "default", persona={"name": "Luna", "gender": "女"}, relationship="friend"
    )
    svc = get_relationship_service()

    req = await svc.request_change("friend", "romantic", "想更近一步", namespace="")
    rejected = await svc.reject(req["id"], response_reason="还不是时候")
    assert rejected["status"] == "rejected"

    current = await svc.get_current(namespace="")
    assert current["relationships"] == ["friend"]


# --------------------------------------------------------------------------- #
# API surface
# --------------------------------------------------------------------------- #

async def test_templates_api_lists_and_applies(api_client):
    listing = await api_client.get("/templates")
    assert listing.status_code == 200
    ids = [t["id"] for t in listing.json()["templates"]]
    assert "default" in ids

    apply = await api_client.post(
        "/templates/default/apply",
        json={"persona": {"name": "Aria", "gender": "女"}, "relationship": "partner"},
    )
    assert apply.status_code == 200
    body = apply.json()
    assert body["success"] is True
    assert body["created_count"] == 6
