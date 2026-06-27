# pyright: reportArgumentType=false, reportAttributeAccessIssue=false

"""
ORM Models and shared utilities for Nocturne Memory System.

Graph-based memory storage with:
- Node: a conceptual entity (UUID), version-independent
- Memory: a content version of a node
- Edge: parent→child relationship between nodes, carrying metadata
- Path: materialized URI cache (domain://path → edge)
"""

from datetime import datetime
from typing import Dict, Any, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# Sentinel root node — parent_uuid of all top-level edges.
# Using a fixed UUID instead of NULL avoids SQLite's NULL != NULL uniqueness quirk.
ROOT_NODE_UUID = "00000000-0000-0000-0000-000000000000"


# =============================================================================
# Shared Utilities
# =============================================================================


def escape_like_literal(value: str) -> str:
    """Escape special chars in SQL LIKE patterns for literal matching."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def serialize_row(obj) -> Dict[str, Any]:
    """Convert an ORM model instance to a plain dict for snapshot storage.

    Keys are DB column names (what the snapshot/rollback layer expects), but
    values are read via each column's mapped attribute. These usually match,
    but can differ when an attribute is mapped to a differently-named column
    (e.g. Edge.relationship_types → column "relationship").
    """
    from sqlalchemy import inspect as sa_inspect

    d = {}
    mapper = sa_inspect(obj).mapper
    for prop in mapper.column_attrs:
        col = prop.columns[0]
        val = getattr(obj, prop.key)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


def serialize_memory_ref(obj) -> Dict[str, Any]:
    """Serialize a Memory row as a pointer (no content).

    The actual content stays in the DB and is resolved at review time.
    """
    d = serialize_row(obj)
    d.pop("content", None)
    return d


# =============================================================================
# ORM Models
# =============================================================================


class Node(Base):
    """A conceptual entity whose UUID persists across content versions.

    Edges reference nodes by UUID, so updating a memory's content (which
    creates a new Memory row) never requires touching the graph structure.
    """

    __tablename__ = "nodes"

    uuid = Column(String(36), primary_key=True)
    created_at = Column(DateTime, default=datetime.now)
    last_accessed_at = Column(DateTime, nullable=True)

    memories = relationship("Memory", back_populates="node")
    child_edges = relationship(
        "Edge", foreign_keys="Edge.child_uuid", back_populates="child_node"
    )
    parent_edges = relationship(
        "Edge", foreign_keys="Edge.parent_uuid", back_populates="parent_node"
    )


class Memory(Base):
    """A single content version of a node.

    Version chain: old.migrated_to → new.id.  All versions of the same
    conceptual entity share the same node_uuid.
    """

    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_uuid = Column(String(36), ForeignKey("nodes.uuid"), nullable=True)
    content = Column(Text, nullable=False)
    deprecated = Column(Boolean, default=False)
    migrated_to = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    node = relationship("Node", back_populates="memories")


class Edge(Base):
    """Directed parent→child relationship between two nodes.

    Carries display name, priority, and disclosure.  The (parent_uuid,
    child_uuid) pair is unique — one edge per structural relationship.
    Multiple Path rows can reference the same edge (aliases).
    """

    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    parent_uuid = Column(String(36), ForeignKey("nodes.uuid"), nullable=False)
    child_uuid = Column(String(36), ForeignKey("nodes.uuid"), nullable=False)
    name = Column(String(256), nullable=False)
    priority = Column(Integer, default=0)
    disclosure = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    # --- Soul template system (v2.6.0) ---
    # locked: when True, the AI (via MCP tools) cannot modify or delete the
    # memory behind this edge. The human (via REST API) is never restricted.
    locked = Column(Boolean, nullable=False, default=False)

    # relationship_types: comma-separated relationship types toward the child
    # node, e.g. "partner,friend". Empty string for ordinary structural edges.
    # (DB column is named "relationship"; the Python attribute avoids shadowing
    # SQLAlchemy's relationship() function used below.)
    relationship_types = Column("relationship", Text, nullable=False, default="")

    # Six emotional dimensions toward the relationship target (0-100, 50=neutral).
    # The AI adjusts these via deltas; every change is logged to emotion_ledger.
    emotion_trust = Column(Integer, nullable=False, default=50)
    emotion_closeness = Column(Integer, nullable=False, default=50)
    emotion_respect = Column(Integer, nullable=False, default=50)
    emotion_dependency = Column(Integer, nullable=False, default=50)
    emotion_security = Column(Integer, nullable=False, default=50)
    emotion_resonance = Column(Integer, nullable=False, default=50)

    __table_args__ = (
        UniqueConstraint("parent_uuid", "child_uuid", name="uq_edge_parent_child"),
    )

    parent_node = relationship(
        "Node", foreign_keys=[parent_uuid], back_populates="parent_edges"
    )
    child_node = relationship(
        "Node", foreign_keys=[child_uuid], back_populates="child_edges"
    )
    paths = relationship("Path", back_populates="edge")


class Path(Base):
    """Materialized URI cache: (namespace, domain, path_string) → edge.

    The source of truth for tree structure is the edges table.
    Paths are a routing convenience for URI resolution.
    Namespace enables multi-agent memory isolation within a single instance.
    """

    __tablename__ = "paths"

    namespace = Column(String(64), primary_key=True, default="")
    domain = Column(String(64), primary_key=True, default="core")
    path = Column(String(512), primary_key=True)
    edge_id = Column(Integer, ForeignKey("edges.id"), nullable=True)
    node_uuid = Column(
        String(36),
        ForeignKey("nodes.uuid"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.now)

    edge = relationship("Edge", back_populates="paths")
    node = relationship("Node")


class GlossaryKeyword(Base):
    """Glossary keyword-to-node binding (豆辞典).

    When a keyword appears in a memory's content, the MCP layer surfaces
    the associated nodes and the frontend highlights the keyword.
    Multiple keywords can point to the same node, and the same keyword
    can point to multiple nodes.
    """

    __tablename__ = "glossary_keywords"

    id = Column(Integer, primary_key=True, autoincrement=True)
    keyword = Column(Text, nullable=False)
    node_uuid = Column(
        String(36),
        ForeignKey("nodes.uuid", ondelete="CASCADE"),
        nullable=False,
    )
    namespace = Column(String(64), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        UniqueConstraint("keyword", "node_uuid", "namespace", name="uq_glossary_keyword_node"),
    )

    node = relationship("Node")


class SearchDocument(Base):
    """Derived search row for one reachable path of an active node."""

    __tablename__ = "search_documents"

    namespace = Column(String(64), primary_key=True, default="")
    domain = Column(String(64), primary_key=True, default="core")
    path = Column(String(512), primary_key=True)
    node_uuid = Column(
        String(36),
        ForeignKey("nodes.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    memory_id = Column(
        Integer,
        ForeignKey("memories.id", ondelete="CASCADE"),
        nullable=False,
    )
    uri = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    disclosure = Column(Text, nullable=True)
    # Stores glossary keywords plus auxiliary CJK search terms.
    search_terms = Column(Text, nullable=False, default="")
    priority = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.now)


class MemoryAccessLog(Base):
    """Asynchronous access log for tracking memory reading frequency and sequences."""

    __tablename__ = "memory_access_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_uuid = Column(
        String(36),
        ForeignKey("nodes.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    namespace = Column(String(64), nullable=False, default="")
    accessed_at = Column(DateTime, default=datetime.now, index=True)
    context = Column(String(64), nullable=True)

    node = relationship("Node")


class Preset(Base):
    """Boot URI preset — a named set of boot URIs and path masks.

    Only one preset can be active at a time (is_active=True).
    The active preset determines which URIs are loaded at boot.
    """

    __tablename__ = "presets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False, unique=True)
    boot_uris = Column(Text, nullable=False, default="{}")
    path_masks = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index(
            "uq_presets_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active = true"),
            sqlite_where=text("is_active = 1"),
        ),
    )


class EmotionLedger(Base):
    """Audit log of every emotional adjustment toward a relationship target.

    The AI never writes absolute values — it submits deltas (e.g. trust +2)
    with a required reason. Each row records both the delta and the resulting
    value, so the Dashboard can render the full emotional history without
    replaying every delta.
    """

    __tablename__ = "emotion_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    namespace = Column(String(64), nullable=False, default="")
    edge_id = Column(
        Integer,
        ForeignKey("edges.id", ondelete="CASCADE"),
        nullable=False,
    )

    delta_trust = Column(Integer, nullable=False, default=0)
    delta_closeness = Column(Integer, nullable=False, default=0)
    delta_respect = Column(Integer, nullable=False, default=0)
    delta_dependency = Column(Integer, nullable=False, default=0)
    delta_security = Column(Integer, nullable=False, default=0)
    delta_resonance = Column(Integer, nullable=False, default=0)

    after_trust = Column(Integer, nullable=False)
    after_closeness = Column(Integer, nullable=False)
    after_respect = Column(Integer, nullable=False)
    after_dependency = Column(Integer, nullable=False)
    after_security = Column(Integer, nullable=False)
    after_resonance = Column(Integer, nullable=False)

    reason = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now, index=True)


class RelationshipRequest(Base):
    """An AI-initiated request to change its relationship with the user.

    The AI cannot change the relationship directly. It files a request with a
    from→to transition and a reason; the human approves or rejects it from the
    Dashboard. While a request is pending, the AI behaves per the current
    relationship.
    """

    __tablename__ = "relationship_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    namespace = Column(String(64), nullable=False, default="")
    edge_id = Column(
        Integer,
        ForeignKey("edges.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_relationship = Column(Text, nullable=False)
    to_relationship = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="pending")  # pending|approved|rejected
    response_reason = Column(Text, nullable=True)
    emotional_snapshot = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.now)
    resolved_at = Column(DateTime, nullable=True)


# =============================================================================
# Change Collector
# =============================================================================


class ChangeCollector:
    """Accumulates serialized row data before mutations for changeset recording.

    Passed optionally through the operation layers so that each delete
    primitive can record pre-deletion state without coupling the "what to
    record" concern into the "what to delete" logic.

    Memory rows are stored as pointers only (no content) — the actual
    content lives in the DB (deprecated but not deleted) and can be
    resolved on the fly at review time.
    """

    def __init__(self):
        self.nodes: List[Dict[str, Any]] = []
        self.memories: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.paths: List[Dict[str, Any]] = []
        self.glossary_keywords: List[Dict[str, Any]] = []

    def record(self, table: str, row_data: Dict[str, Any]):
        if table == "memories":
            row_data = {k: v for k, v in row_data.items() if k != "content"}
        getattr(self, table).append(row_data)

    def to_dict(self) -> Dict[str, list]:
        return {
            "nodes": self.nodes,
            "memories": self.memories,
            "edges": self.edges,
            "paths": self.paths,
            "glossary_keywords": self.glossary_keywords,
        }
