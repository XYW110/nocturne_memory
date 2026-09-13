import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, FileText, Database } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../../lib/api';
import { useLocale } from '../../../i18n/useLocale';

const TreeNode = ({ domain, path, name, childrenCount, activeDomain, activePath, onNavigate, level }) => {
  const isAncestor = activeDomain === domain && activePath.startsWith(path + '/');
  const isActive = activeDomain === domain && activePath === path;

  const [expanded, setExpanded] = useState(isAncestor || isActive);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const prevActivePath = useRef(activePath);
  const prevActiveDomain = useRef(activeDomain);

  const hasChildren = fetched ? children.length > 0 : (childrenCount === undefined || childrenCount > 0);

  useEffect(() => {
    if (expanded && !fetched && hasChildren) {
      fetchChildren();
    }
  }, [expanded, fetched, hasChildren]);

  useEffect(() => {
    const pathChanged = activePath !== prevActivePath.current || activeDomain !== prevActiveDomain.current;
    if (pathChanged && (isAncestor || isActive) && !expanded) {
      setExpanded(true);
    }
    prevActivePath.current = activePath;
    prevActiveDomain.current = activeDomain;
  }, [activePath, activeDomain, isAncestor, isActive, expanded]);

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const res = await api.get('/browse/node', { params: { domain, path, nav_only: true } });
      setChildren(res.data.children || []);
      setFetched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (isActive) {
      if (hasChildren) setExpanded(!expanded);
    } else {
      onNavigate(path, domain);
      if (!expanded && hasChildren) setExpanded(true);
    }
  };

  return (
    <div>
      <div
        className={clsx(
          "flex items-center gap-1.5 py-1.5 min-h-[var(--tap-target)] pr-2 rounded-[var(--radius-md)] text-sm transition-colors duration-150 cursor-pointer group border-l-[3px]",
          isActive
            ? "bg-[var(--surface-hover)] text-[var(--text-primary)] border-l-[var(--accent)]"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] border-l-transparent"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        <div
          className="w-5 h-5 flex items-center justify-center flex-shrink-0"
          onClick={(e) => {
             if (hasChildren) {
                 e.stopPropagation();
                 setExpanded(!expanded);
             }
          }}
        >
          {loading ? (
            <div className="w-3 h-3 border-2 border-[var(--text-faint)] border-t-transparent rounded-full animate-spin" />
          ) : hasChildren ? (
            <ChevronRight size={14} className={clsx("transition-transform text-[var(--text-faint)] group-hover:text-[var(--text-secondary)]", expanded && "rotate-90")} />
          ) : null}
        </div>
        <FileText size={14} className={clsx("flex-shrink-0", isActive ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover:text-[var(--text-muted)]")} />
        <span className="truncate flex-1 text-[13px]">{name}</span>
      </div>

      {expanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNode
              key={child.path}
              domain={domain}
              path={child.path}
              name={child.name}
              childrenCount={child.approx_children_count}
              activeDomain={activeDomain}
              activePath={activePath}
              onNavigate={onNavigate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DomainNode = ({ domain, rootCount, activeDomain, activePath, onNavigate }) => {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(activeDomain === domain);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const prevActiveDomain = useRef(activeDomain);
  const prevActivePath = useRef(activePath);

  const hasChildren = fetched ? children.length > 0 : (rootCount === undefined || rootCount > 0);

  useEffect(() => {
    if (expanded && !fetched && hasChildren) {
      fetchChildren();
    }
  }, [expanded, fetched, hasChildren]);

  useEffect(() => {
    const changed = activeDomain !== prevActiveDomain.current || activePath !== prevActivePath.current;
    if (changed && activeDomain === domain && !expanded) {
      setExpanded(true);
    }
    prevActiveDomain.current = activeDomain;
    prevActivePath.current = activePath;
  }, [activeDomain, activePath, domain, expanded]);

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const res = await api.get('/browse/node', { params: { domain, path: '', nav_only: true } });
      setChildren(res.data.children || []);
      setFetched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isActive = activeDomain === domain && activePath === '';

  const handleClick = (e) => {
    e.stopPropagation();
    if (isActive) {
      if (hasChildren) setExpanded(!expanded);
    } else {
      onNavigate('', domain);
      if (!expanded && hasChildren) setExpanded(true);
    }
  };

  return (
    <div className="mb-2">
      <div
        className={clsx(
          "flex items-center gap-1.5 px-2 py-2 min-h-[var(--tap-target)] rounded-[var(--radius-md)] text-sm transition-colors duration-150 cursor-pointer group border-l-[3px]",
          isActive
            ? "bg-[var(--surface-hover)] text-[var(--text-primary)] border-l-[var(--accent)]"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] border-l-transparent",
          !isActive && rootCount === 0 && "opacity-40 hover:opacity-100"
        )}
        onClick={handleClick}
      >
        <div
          className="w-5 h-5 flex items-center justify-center flex-shrink-0"
          onClick={(e) => {
             if (hasChildren) {
                 e.stopPropagation();
                 setExpanded(!expanded);
             }
          }}
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-[var(--text-faint)] border-t-transparent rounded-full animate-spin" />
          ) : hasChildren ? (
            <ChevronRight size={16} className={clsx("transition-transform text-[var(--text-faint)] group-hover:text-[var(--text-secondary)]", expanded && "rotate-90")} />
          ) : null}
        </div>
        <Database size={16} className={clsx("flex-shrink-0 ml-0.5", isActive ? "text-[var(--text-primary)]" : "text-[var(--text-faint)]")} />
        <span className="font-medium flex-1 truncate ml-1">
          {t('memory.sidebar.domain_label', { domain: domain.charAt(0).toUpperCase() + domain.slice(1) })}
        </span>
        {rootCount !== undefined && rootCount > 0 && (
          <span className="text-[10px] bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] tabular-nums">{rootCount}</span>
        )}
      </div>

      {expanded && children.length > 0 && (
        <div className="mt-1">
          {children.map(child => (
            <TreeNode
              key={child.path}
              domain={domain}
              path={child.path}
              name={child.name}
              childrenCount={child.approx_children_count}
              activeDomain={activeDomain}
              activePath={activePath}
              onNavigate={onNavigate}
              level={1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DomainNode;
