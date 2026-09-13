import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ArrowRight, ArrowLeft, X, Loader2, Wand2, Plus, Trash2, FileEdit } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { listTemplates, getTemplate, applyTemplate, initExistingSoul, resetExistingSoul, createCustomTemplate, deleteCustomTemplate } from '../../lib/api';
import { toast } from '../../components/Toast';

// Relationship options shown at birth. Labels are resolved via i18n; the
// values are the backend relationship type keys.
const RELATIONSHIP_TYPES = [
  'subordinate', 'partner', 'friend', 'family_parent',
  'family_spouse', 'romantic', 'rival',
];

function localizedLabel(spec, lang) {
  if (lang?.startsWith('zh')) return spec.label || spec.label_en || '';
  return spec.label_en || spec.label || '';
}

function PersonaField({ name, spec, value, onChange, lang }) {
  const label = localizedLabel(spec, lang);
  const common = "w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-sm placeholder:text-nocturne-text-muted focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <div>
      <label className="text-xs text-nocturne-text-secondary mb-1 block">
        {label}{spec.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {spec.type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={common}>
          <option value="" disabled>—</option>
          {(spec.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : spec.type === 'text' ? (
        <textarea
          rows={2}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={spec.placeholder || ''}
          className={clsx(common, 'resize-none')}
        />
      ) : (
        <input
          type={spec.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={spec.placeholder || (spec.default != null ? String(spec.default) : '')}
          className={common}
        />
      )}
    </div>
  );
}

function BirthDialog({ template, onClose, onBorn }) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(1);
  const [persona, setPersona] = useState(() => {
    const init = {};
    Object.entries(template.persona || {}).forEach(([k, spec]) => {
      init[k] = spec.default != null ? String(spec.default) : '';
    });
    return init;
  });
  const [relationship, setRelationship] = useState('partner');
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const personaEntries = Object.entries(template.persona || {});
  const missingRequired = personaEntries.some(
    ([k, spec]) => spec.required && !String(persona[k] || '').trim()
  );

  const handleBirth = async () => {
    setSubmitting(true);
    try {
      let result;
      if (forceOverwrite) {
        result = await resetExistingSoul(relationship, persona);
        toast(t('settings.soul.reset_success', { count: result.created?.length || 0 }), 'success');
      } else {
        result = await applyTemplate(template.id, { persona, relationship });
        const created = result.created_count || 0;
        const skipped = result.skipped_count || 0;
        if (skipped > 0 && created === 0) {
          toast(t('settings.soul.birth_all_skipped', { count: skipped }), 'info');
        } else {
          toast(t('settings.soul.birth_success', { count: created, skipped }), 'success');
        }
      }
      onBorn?.(result);
      onClose();
    } catch (e) {
      toast(t('settings.soul.birth_failed') + ': ' + (e.response?.data?.detail || e.message), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nocturne-bg-tertiary border border-[var(--color-border-light)] rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-2 text-nocturne-text-primary font-semibold">
            <Sparkles size={16} className="text-indigo-400" />
            {t('settings.soul.birth_title')}
          </div>
          <button onClick={onClose} className="text-nocturne-text-secondary hover:text-nocturne-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {step === 1 ? (
            <>
              <p className="text-xs text-nocturne-text-muted">{t('settings.soul.step_persona')}</p>
              {personaEntries.map(([name, spec]) => (
                <PersonaField
                  key={name}
                  name={name}
                  spec={spec}
                  lang={i18n.language}
                  value={persona[name]}
                  onChange={v => setPersona(p => ({ ...p, [name]: v }))}
                />
              ))}
            </>
          ) : (
            <>
              <p className="text-xs text-nocturne-text-muted">{t('settings.soul.step_relationship')}</p>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_TYPES.map(rel => (
                  <button
                    key={rel}
                    onClick={() => setRelationship(rel)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm border transition-all text-left',
                      relationship === rel
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                        : 'border-[var(--color-border-light)] bg-nocturne-bg-primary/50 text-nocturne-text-primary hover:border-[var(--color-border-light)]'
                    )}
                  >
                    {t(`settings.relationship.type.${rel}`)}
                  </button>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-lg bg-nocturne-bg-primary/50 border border-[var(--color-border-light)]">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceOverwrite}
                    onChange={e => setForceOverwrite(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-[var(--color-border-light)] text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-nocturne-text-secondary">
                    <span className="text-nocturne-text-primary font-medium">{t('settings.soul.force_overwrite')}</span>
                    <br />
                    {t('settings.soul.force_overwrite_desc')}
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--color-border)] flex-shrink-0">
          {step === 2 ? (
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-nocturne-text-secondary hover:text-nocturne-text-primary">
              <ArrowLeft size={14} /> {t('settings.soul.back')}
            </button>
          ) : <span />}
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={missingRequired}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-sm font-medium"
            >
              {t('settings.soul.next')} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleBirth}
              disabled={submitting}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-sm font-medium"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {t('settings.soul.birth')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TemplatesSection({ onBorn }) {
  const { t, i18n } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [birthing, setBirthing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createData, setCreateData] = useState({
    id: '',
    name: '',
    name_en: '',
    description: '',
    description_en: '',
    persona: {},
    memory_nodes: [],
  });
  const [initRelationship, setInitRelationship] = useState('partner');
  const [initing, setIniting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await listTemplates());
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openBirth = async (id) => {
    try {
      const full = await getTemplate(id);
      setBirthing(full);
    } catch (e) {
      toast(t('settings.soul.load_failed'), 'error');
    }
  };

  const handleBorn = (result) => {
    load();
    onBorn?.(result);
  };

  const handleInitExisting = async () => {
    setIniting(true);
    try {
      const result = await initExistingSoul(initRelationship);
      const created = result.created?.length || 0;
      const emotionCount = result.emotion_updated?.length || 0;
      if (created === 0 && emotionCount === 0 && !result.relationship_updated && !result.content_updated) {
        toast(t('settings.soul.init_existing_none'), 'info');
      } else {
        toast(t('settings.soul.init_existing_success', {
          createdCount: created,
          emotionCount,
          relationship: t(`settings.relationship.type.${result.relationship}`),
        }), 'success');
      }
      onBorn?.(result);
    } catch (e) {
      toast(t('settings.soul.init_existing_failed') + ': ' + (e.response?.data?.detail || e.message), 'error');
    } finally {
      setIniting(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!createData.id.trim() || !createData.name.trim()) {
      toast(t('settings.soul.template_required'), 'error');
      return;
    }
    try {
      await createCustomTemplate(createData);
      toast(t('settings.soul.template_created'), 'success');
      setCreating(false);
      setCreateData({
        id: '',
        name: '',
        name_en: '',
        description: '',
        description_en: '',
        persona: {},
        memory_nodes: [],
      });
      load();
    } catch (e) {
      toast(t('settings.soul.template_create_failed') + ': ' + (e.response?.data?.detail || e.message), 'error');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm(t('settings.soul.confirm_delete'))) return;
    try {
      await deleteCustomTemplate(id);
      toast(t('settings.soul.template_deleted'), 'success');
      load();
    } catch (e) {
      toast(t('settings.soul.template_delete_failed') + ': ' + (e.response?.data?.detail || e.message), 'error');
    }
  };

  if (loading) {
    return <div className="pt-4 text-sm text-nocturne-text-muted">{t('settings.soul.loading')}</div>;
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-xs text-nocturne-text-muted">{t('settings.soul.description')}</p>

      {/* One-click initialize existing data */}
      <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
          <Wand2 size={13} className="text-amber-400" />
          {t('settings.soul.init_existing')}
        </div>
        <p className="text-[11px] text-nocturne-text-muted leading-relaxed mb-2">
          {t('settings.soul.init_existing_description')}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={initRelationship}
            onChange={e => setInitRelationship(e.target.value)}
            className="flex-1 bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          >
            {RELATIONSHIP_TYPES.map(rel => (
              <option key={rel} value={rel}>{t(`settings.relationship.type.${rel}`)}</option>
            ))}
          </select>
          <button
            onClick={handleInitExisting}
            disabled={initing}
            className="px-3 py-1.5 bg-amber-600/90 hover:bg-amber-500 disabled:opacity-50 text-white rounded-md text-xs font-medium flex items-center gap-1 flex-shrink-0"
          >
            {initing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {t('settings.soul.init_existing')}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-nocturne-text-muted">{t('settings.soul.templates')}</span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <Plus size={12} /> {t('settings.soul.add_template')}
        </button>
      </div>

      <div className="space-y-2">
        {templates.map(tpl => {
          const desc = i18n.language?.startsWith('zh') ? tpl.description : (tpl.description_en || tpl.description);
          return (
            <div key={tpl.id} className="bg-nocturne-bg-tertiary/60 border border-[var(--color-border)] hover:border-[var(--color-border-light)] rounded-lg p-3 transition-all">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-nocturne-text-primary flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400 flex-shrink-0" />
                    {i18n.language?.startsWith('zh') ? tpl.name : (tpl.name_en || tpl.name)}
                    {tpl.is_custom && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded">
                        {t('settings.soul.custom')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-nocturne-text-muted mt-1 leading-relaxed">{desc}</p>
                  <div className="text-[11px] text-nocturne-text-muted mt-1.5">
                    {t('settings.soul.node_count', { count: tpl.node_count })} · {tpl.domains.join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {tpl.is_custom && (
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md text-xs flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => openBirth(tpl.id)}
                    className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-md text-xs font-medium flex items-center gap-1 flex-shrink-0"
                  >
                    <Sparkles size={12} /> {t('settings.soul.birth')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <p className="text-xs text-nocturne-text-muted italic">{t('settings.soul.empty')}</p>
        )}
      </div>

      {birthing && createPortal(
        <BirthDialog
          template={birthing}
          onClose={() => setBirthing(null)}
          onBorn={handleBorn}
        />,
        document.body
      )}

      {creating && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCreating(false)} />
          <div className="relative bg-nocturne-bg-tertiary border border-[var(--color-border-light)] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
              <div className="flex items-center gap-2 text-nocturne-text-primary font-semibold">
                <FileEdit size={16} className="text-indigo-400" />
                {t('settings.soul.create_template')}
              </div>
              <button onClick={() => setCreating(false)} className="text-nocturne-text-secondary hover:text-nocturne-text-primary">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              <div>
                <label className="text-xs text-nocturne-text-secondary mb-1 block">{t('settings.soul.template_id')} <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={createData.id}
                  onChange={e => setCreateData(d => ({ ...d, id: e.target.value }))}
                  className="w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="my_template"
                />
              </div>
              <div>
                <label className="text-xs text-nocturne-text-secondary mb-1 block">{t('settings.soul.template_name')} <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={createData.name}
                  onChange={e => setCreateData(d => ({ ...d, name: e.target.value }))}
                  className="w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="我的灵魂模板"
                />
              </div>
              <div>
                <label className="text-xs text-nocturne-text-secondary mb-1 block">{t('settings.soul.template_name_en')}</label>
                <input
                  type="text"
                  value={createData.name_en}
                  onChange={e => setCreateData(d => ({ ...d, name_en: e.target.value }))}
                  className="w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="My Soul Template"
                />
              </div>
              <div>
                <label className="text-xs text-nocturne-text-secondary mb-1 block">{t('settings.soul.template_description')}</label>
                <textarea
                  rows={2}
                  value={createData.description}
                  onChange={e => setCreateData(d => ({ ...d, description: e.target.value }))}
                  className="w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="描述这个模板的特点..."
                />
              </div>
              <div>
                <label className="text-xs text-nocturne-text-secondary mb-1 block">{t('settings.soul.template_description_en')}</label>
                <textarea
                  rows={2}
                  value={createData.description_en}
                  onChange={e => setCreateData(d => ({ ...d, description_en: e.target.value }))}
                  className="w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Describe this template..."
                />
              </div>
              <div className="border-t border-[var(--color-border)] pt-3">
                <label className="text-xs text-nocturne-text-secondary mb-2 block">{t('settings.soul.template_persona')}</label>
                <textarea
                  rows={4}
                  value={JSON.stringify(createData.persona, null, 2)}
                  onChange={e => {
                    try {
                      setCreateData(d => ({ ...d, persona: JSON.parse(e.target.value) }));
                    } catch {}
                  }}
                  className="w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder='{"name": {"type": "text", "label": "名字", "default": "Nocturne"}}'
                />
              </div>
              <div className="border-t border-[var(--color-border)] pt-3">
                <label className="text-xs text-nocturne-text-secondary mb-2 block">{t('settings.soul.template_nodes')}</label>
                <textarea
                  rows={6}
                  value={JSON.stringify(createData.memory_nodes, null, 2)}
                  onChange={e => {
                    try {
                      setCreateData(d => ({ ...d, memory_nodes: JSON.parse(e.target.value) }));
                    } catch {}
                  }}
                  className="w-full bg-nocturne-bg-primary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder='[{"domain": "core", "path": "agent", "content": "..."}, ...]'
                />
              </div>
            </div>
            <div className="flex items-center justify-end px-5 py-4 border-t border-[var(--color-border)] flex-shrink-0 gap-2">
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-nocturne-text-secondary hover:text-nocturne-text-primary text-sm"
              >
                {t('settings.soul.cancel')}
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium flex items-center gap-1"
              >
                <Plus size={14} /> {t('settings.soul.create')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
