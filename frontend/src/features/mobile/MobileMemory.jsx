import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, ArrowLeft, Database } from "lucide-react";
import { api, getDomains, searchMemories } from "../../lib/api";
import NodeGridCard from "../memory/components/NodeGridCard";
import Breadcrumb from "../memory/components/Breadcrumb";

/**
 * MobileMemory — domain dropdown + search + grid-cols-1 card list.
 * No sidebar tree. Tap card → full-screen detail (placeholder for now).
 */
export default function MobileMemory() {
  const { t } = useTranslation("mobile");
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [data, setData] = useState(null); // { node, children, breadcrumbs }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);

  // Load domains on mount
  useEffect(() => {
    getDomains()
      .then((d) => setDomains(d || []))
      .catch(() => setDomains([]));
  }, []);

  // Load data for selected domain
  const loadDomain = useCallback(async (domain) => {
    if (!domain) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSearchResults(null);
    try {
      const res = await api.get("/browse/node", {
        params: { domain, path: "" },
      });
      setData(res.data);
    } catch (err) {
      setError(err?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // When domain changes, load it
  const handleDomainChange = (e) => {
    const domain = e.target.value;
    setSelectedDomain(domain);
    setSearchQuery("");
    loadDomain(domain);
  };

  // Search
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      loadDomain(selectedDomain);
      return;
    }
    setSearching(true);
    try {
      const res = await searchMemories(searchQuery.trim());
      setSearchResults(Array.isArray(res?.results) ? res.results : []);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    if (selectedDomain) loadDomain(selectedDomain);
  };

  // Navigate to child path
  const handleNavigate = async (path) => {
    if (!selectedDomain || !data) return;
    setLoading(true);
    try {
      const res = await api.get("/browse/node", {
        params: { domain: selectedDomain, path },
      });
      setData(res.data);
    } catch (err) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: domain dropdown + search */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-nocturne-bg-secondary p-3 space-y-2">
        <div className="flex gap-2">
          <select
            value={selectedDomain}
            onChange={handleDomainChange}
            className="flex-1 bg-nocturne-bg-tertiary border border-[var(--color-border-light)] text-nocturne-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">{t("memory.domain.all")}</option>
            {domains.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.domain}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("memory.search.placeholder")}
            className="flex-1 bg-nocturne-bg-tertiary border border-[var(--color-border-light)] text-nocturne-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500"
          >
            <Search size={16} />
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {/* Search results */}
        {searchResults !== null && (
          <div>
            <button
              onClick={handleClearSearch}
              className="flex items-center gap-1 text-sm text-nocturne-text-muted hover:text-nocturne-text-secondary mb-3"
            >
              <ArrowLeft size={14} />
              {t("memory.search.back")}
            </button>
            {searching ? (
              <div className="text-center text-nocturne-text-muted text-sm">
                Searching…
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center text-nocturne-text-muted text-sm mt-8">
                {t("memory.search.noResults", { query: searchQuery })}
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((item) => (
                  <NodeGridCard key={item.uri} node={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Domain browsing */}
        {searchResults === null && (
          <>
            {loading && (
              <div className="text-center text-nocturne-text-muted text-sm mt-8">
                Loading…
              </div>
            )}
            {error && (
              <div className="text-center text-red-400 text-sm mt-8">
                {error}
              </div>
            )}
            {!loading && !error && data && (
              <div>
                <Breadcrumb
                  items={data.breadcrumbs}
                  onNavigate={handleNavigate}
                />
                <div className="grid grid-cols-1 gap-3 mt-3">
                  {data.children?.map((child) => (
                    <NodeGridCard
                      key={child.uri || child.path}
                      node={child}
                      onClick={() =>
                        handleNavigate(
                          child.path || child.uri?.split("/").pop()
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {!loading && !error && !data && !selectedDomain && (
              <div className="text-center text-nocturne-text-muted text-sm mt-8">
                {t("memory.empty.noDomain")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
