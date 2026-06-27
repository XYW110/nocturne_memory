"""
Nocturne Memory — DB package public API.

Provides per-service getters instead of a single god-object.
Services are lazily constructed on first access and share a
single DatabaseManager instance.
"""

from typing import Optional, TYPE_CHECKING

from .database import DatabaseManager
from .snapshot import ChangesetStore, get_changeset_store
from .namespace import get_namespace, set_namespace
from .models import (
    Base, ROOT_NODE_UUID, Node, Memory, Edge, Path,
    GlossaryKeyword, SearchDocument, ChangeCollector, Preset,
    EmotionLedger, RelationshipRequest,
)

if TYPE_CHECKING:
    from .graph import GraphService
    from .search import SearchIndexer
    from .glossary import GlossaryService
    from .presets import PresetService

_db_manager: Optional[DatabaseManager] = None
_graph_service: Optional["GraphService"] = None
_search_indexer: Optional["SearchIndexer"] = None
_glossary_service: Optional["GlossaryService"] = None
_preset_service: Optional["PresetService"] = None
_emotion_service = None
_relationship_service = None
_template_loader = None


def _resolve_database_url() -> str:
    """Resolve DATABASE_URL from config.json."""
    import sys
    from pathlib import Path
    
    # Ensure backend directory is in sys.path so we can import config
    backend_dir = str(Path(__file__).resolve().parent.parent)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
        
    import config
    url = config.get("database_url")
    if not url:
        raise ValueError("database_url is not configured in config.json")
    return url


def _ensure_initialized():
    global _db_manager, _graph_service, _search_indexer, _glossary_service, _preset_service
    if _db_manager is not None:
        return

    database_url = _resolve_database_url()

    from .search import SearchIndexer
    from .glossary import GlossaryService
    from .graph import GraphService
    from .presets import PresetService

    # _resolve_database_url() has already put backend/ on sys.path.
    import config
    _db_manager = DatabaseManager(
        database_url,
        pool_size=config.get("db_pool_size"),
        max_overflow=config.get("db_max_overflow"),
    )
    _search_indexer = SearchIndexer(_db_manager)
    _glossary_service = GlossaryService(_db_manager, _search_indexer)
    _graph_service = GraphService(_db_manager, _search_indexer)
    _preset_service = PresetService(_db_manager)


def get_db_manager() -> DatabaseManager:
    _ensure_initialized()
    return _db_manager  # type: ignore[return-value]


def get_graph_service() -> "GraphService":
    _ensure_initialized()
    return _graph_service  # type: ignore[return-value]


def get_search_indexer() -> "SearchIndexer":
    _ensure_initialized()
    return _search_indexer  # type: ignore[return-value]


def get_glossary_service() -> "GlossaryService":
    _ensure_initialized()
    return _glossary_service  # type: ignore[return-value]


def get_preset_service() -> "PresetService":
    _ensure_initialized()
    return _preset_service  # type: ignore[return-value]


def get_emotion_service():
    _ensure_initialized()
    global _emotion_service
    if _emotion_service is None:
        from emotion_service import EmotionService
        _emotion_service = EmotionService(_db_manager)
    return _emotion_service


def get_relationship_service():
    _ensure_initialized()
    global _relationship_service
    if _relationship_service is None:
        from relationship_service import RelationshipService
        _relationship_service = RelationshipService(_db_manager)
    return _relationship_service


def get_template_loader():
    _ensure_initialized()
    global _template_loader
    if _template_loader is None:
        from template_loader import TemplateLoader
        _template_loader = TemplateLoader(_db_manager, _graph_service)
    return _template_loader


async def close_db():
    """Tear down all services and close the database connection."""
    global _db_manager, _graph_service, _search_indexer, _glossary_service, _preset_service
    global _emotion_service, _relationship_service, _template_loader
    if _db_manager:
        await _db_manager.close()
    _db_manager = None
    _graph_service = None
    _search_indexer = None
    _glossary_service = None
    _preset_service = None
    _emotion_service = None
    _relationship_service = None
    _template_loader = None


__all__ = [
    "DatabaseManager",
    "get_db_manager", "get_graph_service",
    "get_search_indexer", "get_glossary_service",
    "get_preset_service",
    "get_emotion_service", "get_relationship_service", "get_template_loader",
    "close_db",
    "ChangesetStore", "get_changeset_store",
    "get_namespace", "set_namespace",
    "Base", "ROOT_NODE_UUID", "Node", "Memory", "Edge", "Path",
    "GlossaryKeyword", "SearchDocument", "ChangeCollector", "Preset",
    "EmotionLedger", "RelationshipRequest",
]
