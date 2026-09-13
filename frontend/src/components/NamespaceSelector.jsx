import React, { useState, useEffect } from "react";
import { Layers } from "lucide-react";
import { getNamespaces } from "../lib/api";

const NAMESPACE_SWITCH_ROOT_REDIRECT_KEY =
  "nocturne:namespace-switch-root-redirect";

/**
 * NamespaceSelector — reusable across desktop and mobile layouts.
 *
 * Known namespaces fetched from the DB are offered as dropdown options;
 * the user can also type a custom value. Selected namespace is stored in
 * localStorage; the axios interceptor in api.js attaches it as X-Namespace
 * on every request.
 */
export default function NamespaceSelector() {
  const [knownNamespaces, setKnownNamespaces] = useState([]);
  const [selected, setSelected] = useState(
    () => localStorage.getItem("selected_namespace") ?? ""
  );
  const [inputValue, setInputValue] = useState(
    () => localStorage.getItem("selected_namespace") ?? ""
  );
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    getNamespaces()
      .then((nsList) => setKnownNamespaces(nsList.filter((ns) => ns !== "")))
      .catch(() => setKnownNamespaces([]));
  }, []);

  const applyNamespace = (ns) => {
    const trimmed = ns.trim();
    const changed = trimmed !== selected;
    setSelected(trimmed);
    setInputValue(trimmed);
    if (trimmed) {
      localStorage.setItem("selected_namespace", trimmed);
    } else {
      localStorage.removeItem("selected_namespace");
    }
    if (changed) {
      sessionStorage.setItem(
        NAMESPACE_SWITCH_ROOT_REDIRECT_KEY,
        JSON.stringify({ from: selected, to: trimmed, at: Date.now() })
      );
    }
    window.location.reload();
  };

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setShowInput(true);
      return;
    }
    applyNamespace(val);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") applyNamespace(inputValue);
    if (e.key === "Escape") setShowInput(false);
  };

  const activeLabel = selected || "(default)";

  return (
    <div className="flex items-center gap-2 text-sm">
      <Layers size={14} className="text-nocturne-text-muted flex-shrink-0" />
      {showInput ? (
        <input
          autoFocus
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={() => setShowInput(false)}
          placeholder="namespace (Enter to apply)"
          className="bg-nocturne-bg-tertiary border border-indigo-500 text-nocturne-text-primary rounded px-2 py-1 text-xs w-40 focus:outline-none"
        />
      ) : (
        <select
          value={selected}
          onChange={handleSelectChange}
          className="bg-nocturne-bg-tertiary border border-[var(--color-border-light)] text-nocturne-text-primary rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          title={`Current namespace: ${activeLabel}`}
        >
          <option value="">(default)</option>
          {knownNamespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
          {selected && !knownNamespaces.includes(selected) && (
            <option key={selected} value={selected}>
              {selected}
            </option>
          )}
          <option value="__custom__">+ enter custom…</option>
        </select>
      )}
    </div>
  );
}
