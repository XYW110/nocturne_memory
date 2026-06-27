import React, { useState, useEffect, useCallback } from 'react';
import { Users, Check, X, RefreshCw, ArrowRight, Clock } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  getCurrentRelationship, listRelationshipRequests,
  approveRelationshipRequest, rejectRelationshipRequest,
} from '../../lib/api';
import { toast } from '../../components/Toast';
import PromptModal from '../../components/PromptModal';

function StatusBadge({ status, t }) {
  const map = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', map[status])}>
      {t(`settings.relationship.status.${status}`)}
    </span>
  );
}

function RequestCard({ req, onApprove, onReject, t }) {
  const snap = req.emotional_snapshot;
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <span>{req.from_label}</span>
          <ArrowRight size={13} className="text-indigo-400" />
          <span className="text-indigo-300">{req.to_label}</span>
        </div>
        <StatusBadge status={req.status} t={t} />
      </div>

      <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{req.reason}</p>

      {snap && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(snap).map(([d, v]) => (
            <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {t(`settings.emotion.dim.${d}`)} {v}
            </span>
          ))}
        </div>
      )}

      {req.response_reason && (
        <p className="text-[11px] text-slate-600 italic">
          {t('settings.relationship.response')}: {req.response_reason}
        </p>
      )}

      {req.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApprove(req.id)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-md text-xs font-medium"
          >
            <Check size={13} /> {t('settings.relationship.approve')}
          </button>
          <button
            onClick={() => onReject(req)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-red-600/80 text-slate-200 rounded-md text-xs font-medium"
          >
            <X size={13} /> {t('settings.relationship.reject')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function RelationshipPanel() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null); // request being rejected

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, reqs] = await Promise.all([
        getCurrentRelationship(),
        listRelationshipRequests(),
      ]);
      setCurrent(cur);
      setRequests(reqs || []);
    } catch (e) {
      console.error('Failed to load relationship:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try {
      await approveRelationshipRequest(id);
      toast(t('settings.relationship.approved_toast'), 'success');
      await load();
    } catch (e) {
      toast(t('settings.relationship.action_failed') + ': ' + (e.response?.data?.detail || e.message), 'error');
    }
  };

  const handleReject = async (reason) => {
    const req = rejecting;
    setRejecting(null);
    try {
      await rejectRelationshipRequest(req.id, reason || '');
      toast(t('settings.relationship.rejected_toast'), 'success');
      await load();
    } catch (e) {
      toast(t('settings.relationship.action_failed') + ': ' + (e.response?.data?.detail || e.message), 'error');
    }
  };

  if (loading) {
    return <div className="pt-4 text-sm text-slate-500 flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> {t('settings.relationship.loading')}</div>;
  }

  const pending = requests.filter(r => r.status === 'pending');
  const history = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-4 pt-4">
      {/* Current relationship */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <Users size={12} className="text-indigo-400" />
          {t('settings.relationship.current_title')}
        </div>
        {current?.labels?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {current.labels.map((label, i) => (
              <span key={i} className="text-sm px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">{t('settings.relationship.none')}</p>
        )}
      </div>

      {/* Pending requests */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <Clock size={12} className="text-amber-400" />
          {t('settings.relationship.pending_title')}
          {pending.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{pending.length}</span>
          )}
        </div>
        <div className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-[11px] text-slate-600 italic">{t('settings.relationship.no_pending')}</p>
          ) : (
            pending.map(req => (
              <RequestCard key={req.id} req={req} onApprove={handleApprove} onReject={setRejecting} t={t} />
            ))
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2">{t('settings.relationship.history_title')}</div>
          <div className="space-y-2 opacity-75">
            {history.map(req => (
              <RequestCard key={req.id} req={req} onApprove={handleApprove} onReject={setRejecting} t={t} />
            ))}
          </div>
        </div>
      )}

      {rejecting && (
        <PromptModal
          title={t('settings.relationship.reject_title')}
          message={t('settings.relationship.reject_message')}
          placeholder={t('settings.relationship.reject_placeholder')}
          submitLabel={t('settings.relationship.reject')}
          cancelLabel={t('settings.relationship.cancel')}
          onSubmit={handleReject}
          onCancel={() => setRejecting(null)}
        />
      )}
    </div>
  );
}
