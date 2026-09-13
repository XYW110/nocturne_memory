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
    pending: 'bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning-fg)] border-transparent',
    approved: 'bg-[var(--semantic-success-bg)] text-[var(--semantic-success-fg)] border-transparent',
    rejected: 'bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger-fg)] border-transparent',
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
    <div className="bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <span>{req.from_label}</span>
          <ArrowRight size={13} className="text-[var(--text-muted)]" />
          <span className="text-[var(--text-secondary)] font-medium">{req.to_label}</span>
        </div>
        <StatusBadge status={req.status} t={t} />
      </div>

      <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{req.reason}</p>

      {snap && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(snap).map(([d, v]) => (
            <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-solid)] text-[var(--text-secondary)] font-mono">
              {t(`settings.emotion.dim.${d}`)} {v}
            </span>
          ))}
        </div>
      )}

      {req.response_reason && (
        <p className="text-[11px] text-[var(--text-muted)] italic">
          {t('settings.relationship.response')}: {req.response_reason}
        </p>
      )}

      {req.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApprove(req.id)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[var(--semantic-success-fg)] hover:opacity-90 text-white rounded-md text-xs font-medium"
          >
            <Check size={13} /> {t('settings.relationship.approve')}
          </button>
          <button
            onClick={() => onReject(req)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--semantic-danger-bg)] hover:text-[var(--semantic-danger-fg)] text-[var(--text-primary)] rounded-md text-xs font-medium"
          >
            <X size={13} /> {t('settings.relationship.reject')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function RelationshipPanel({ refreshTrigger = 0 }) {
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

  useEffect(() => { load(); }, [load, refreshTrigger]);

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
    return <div className="pt-4 text-sm text-[var(--text-muted)] flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> {t('settings.relationship.loading')}</div>;
  }

  const pending = requests.filter(r => r.status === 'pending');
  const history = requests.filter(r => r.status !== 'pending');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* Current relationship */}
      <div className="bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-2">
          <Users size={12} className="text-[var(--text-muted)]" />
          {t('settings.relationship.current_title')}
        </div>
        {current?.labels?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {current.labels.map((label, i) => (
              <span key={i} className="text-sm px-2.5 py-1 rounded-[var(--radius-md)] bg-[var(--semantic-info-bg)] text-[var(--semantic-info-fg)]">
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic">{t('settings.relationship.none')}</p>
        )}
      </div>

      {/* Requests & history */}
      <div className="lg:col-span-2 space-y-4">
      {/* Pending requests */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-2">
          <Clock size={12} className="text-[var(--semantic-warning-fg)]" />
          {t('settings.relationship.pending_title')}
          {pending.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning-fg)]">{pending.length}</span>
          )}
        </div>
        <div className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)] italic">{t('settings.relationship.no_pending')}</p>
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
          <div className="text-xs text-[var(--text-muted)] mb-2">{t('settings.relationship.history_title')}</div>
          <div className="space-y-2 opacity-75">
            {history.map(req => (
              <RequestCard key={req.id} req={req} onApprove={handleApprove} onReject={setRejecting} t={t} />
            ))}
          </div>
        </div>
      )}
      </div>

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
