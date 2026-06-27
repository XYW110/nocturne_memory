import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { listTemplates, getTemplate, applyTemplate } from '../../lib/api';
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
  const common = "w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-2.5 py-1.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">
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
  const [submitting, setSubmitting] = useState(false);

  const personaEntries = Object.entries(template.persona || {});
  const missingRequired = personaEntries.some(
    ([k, spec]) => spec.required && !String(persona[k] || '').trim()
  );

  const handleBirth = async () => {
    setSubmitting(true);
    try {
      const result = await applyTemplate(template.id, { persona, relationship });
      toast(t('settings.soul.birth_success', { count: result.created_count }), 'success');
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
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Sparkles size={16} className="text-indigo-400" />
            {t('settings.soul.birth_title')}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {step === 1 ? (
            <>
              <p className="text-xs text-slate-500">{t('settings.soul.step_persona')}</p>
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
              <p className="text-xs text-slate-500">{t('settings.soul.step_relationship')}</p>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_TYPES.map(rel => (
                  <button
                    key={rel}
                    onClick={() => setRelationship(rel)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm border transition-all text-left',
                      relationship === rel
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                        : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600'
                    )}
                  >
                    {t(`settings.relationship.type.${rel}`)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800">
          {step === 2 ? (
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
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

export default function TemplatesSection() {
  const { t, i18n } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [birthing, setBirthing] = useState(null); // full template object

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

  if (loading) {
    return <div className="pt-4 text-sm text-slate-500">{t('settings.soul.loading')}</div>;
  }

  return (
    <div className="space-y-3 pt-4">
      <p className="text-xs text-slate-500">{t('settings.soul.description')}</p>

      <div className="space-y-2">
        {templates.map(tpl => {
          const desc = i18n.language?.startsWith('zh') ? tpl.description : (tpl.description_en || tpl.description);
          return (
            <div key={tpl.id} className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-all">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400 flex-shrink-0" />
                    {i18n.language?.startsWith('zh') ? tpl.name : (tpl.name_en || tpl.name)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
                  <div className="text-[11px] text-slate-600 mt-1.5">
                    {t('settings.soul.node_count', { count: tpl.node_count })} · {tpl.domains.join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => openBirth(tpl.id)}
                  className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-md text-xs font-medium flex items-center gap-1 flex-shrink-0"
                >
                  <Sparkles size={12} /> {t('settings.soul.birth')}
                </button>
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <p className="text-xs text-slate-600 italic">{t('settings.soul.empty')}</p>
        )}
      </div>

      {birthing && (
        <BirthDialog
          template={birthing}
          onClose={() => setBirthing(null)}
          onBorn={() => load()}
        />
      )}
    </div>
  );
}
