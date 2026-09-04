import React, { useState, useEffect, useCallback } from 'react';
import { getApiBase } from '../lib/api';

export interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  ipAddress?: string;
  changes?: Record<string, unknown>;
  createdAt?: string;
}

interface AuditLogResponse {
  auditLogs: AuditLog[];
  nextCursor: string | null;
  total: number;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [resourceType, setResourceType] = useState('');
  const [action, setAction] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Detail Drawer
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async (cursor?: string | null, append = false) => {
    setLoading(!autoRefresh);
    setError('');
    try {
      const params = new URLSearchParams();
      if (resourceType) params.append('resourceType', resourceType);
      if (action) params.append('action', action);
      if (cursor) params.append('cursor', cursor);
      params.append('limit', '50');

      const res = await fetch(`${getApiBase()}/api/audit-logs?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data: AuditLogResponse = await res.json();
      
      setLogs(prev => append ? [...prev, ...data.auditLogs] : data.auditLogs);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching logs');
    } finally {
      setLoading(false);
    }
  }, [resourceType, action, autoRefresh]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchLogs();
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  const handleExportCsv = () => {
    if (!logs.length) return;
    const header = ['ID,Timestamp,Action,Resource Type,Resource ID,Actor,IP Address,Changes'];
    const rows = logs.map(l => {
      const changes = l.changes ? JSON.stringify(l.changes).replace(/"/g, '""') : '';
      return `${l.id},${l.createdAt},${l.action},${l.resourceType},${l.resourceId || ''},${l.userId || ''},${l.ipAddress || ''},"${changes}"`;
    });
    const csv = [...header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityClass = (actionName: string) => {
    if (actionName.includes('delete') || actionName.includes('remove') || actionName.includes('revoke')) return 'gcp-status-failed';
    if (actionName.includes('create') || actionName.includes('add')) return 'gcp-status-running';
    if (actionName.includes('update') || actionName.includes('patch')) return 'gcp-status-warning';
    return 'gcp-muted';
  };

  return (
    <div className="cl-audit-viewer">
      <div className="cl-console-actions" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input 
          placeholder="Filter by Resource Type..." 
          value={resourceType} 
          onChange={e => setResourceType(e.target.value)}
          className="gcp-input-sm"
        />
        <input 
          placeholder="Filter by Action..." 
          value={action} 
          onChange={e => setAction(e.target.value)}
          className="gcp-input-sm"
        />
        <label className="gcp-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="checkbox" 
            checked={autoRefresh} 
            onChange={e => setAutoRefresh(e.target.checked)} 
          />
          Auto-refresh (5s)
        </label>
        <div style={{ flex: 1 }} />
        <span className="gcp-muted">Total: {total}</span>
        <button type="button" className="gcp-btn-secondary gcp-btn-compact" onClick={handleExportCsv} disabled={!logs.length}>
          Export CSV
        </button>
      </div>

      {error && <div className="gcp-form-error">{error}</div>}

      <div className="gcp-table" style={{ position: 'relative' }}>
        {loading && !logs.length && <div style={{ padding: '1rem' }} className="gcp-muted">Loading...</div>}
        
        <div className="gcp-table-row gcp-table-head" style={{ gridTemplateColumns: 'minmax(80px, auto) 2fr 1fr 1fr 1fr 1fr 1.5fr' }}>
          <span>Severity</span>
          <span>Action</span>
          <span>Resource Type</span>
          <span>Resource ID</span>
          <span>Actor</span>
          <span>IP Address</span>
          <span>When</span>
        </div>
        
        {!loading && logs.length === 0 && (
          <div className="gcp-table-row cl-console-empty">No audit events match the current filters.</div>
        )}
        
        {logs.map((log) => (
          <div 
            key={log.id} 
            className="gcp-table-row" 
            style={{ 
              gridTemplateColumns: 'minmax(80px, auto) 2fr 1fr 1fr 1fr 1fr 1.5fr',
              cursor: 'pointer',
              backgroundColor: selectedLog?.id === log.id ? 'var(--gcp-hover)' : undefined
            }}
            onClick={() => setSelectedLog(log)}
          >
            <span className={`gcp-status ${getSeverityClass(log.action)}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
              {log.action.split('.')[1] || 'info'}
            </span>
            <span className="gcp-service">{log.action}</span>
            <span className="gcp-muted">{log.resourceType}</span>
            <span className="gcp-muted" title={log.resourceId}>{log.resourceId ? log.resourceId.slice(0, 8) + '...' : '—'}</span>
            <span className="gcp-muted" title={log.userId}>{log.userId ? log.userId.slice(0, 8) + '...' : 'System'}</span>
            <span className="gcp-muted">{log.ipAddress || '—'}</span>
            <span className="gcp-muted">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</span>
          </div>
        ))}
      </div>

      {nextCursor && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button 
            type="button" 
            className="gcp-btn-secondary gcp-btn-compact" 
            onClick={() => fetchLogs(nextCursor, true)}
            disabled={loading}
          >
            Load More
          </button>
        </div>
      )}

      {selectedLog && (
        <div className="cl-audit-drawer" style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '400px',
          backgroundColor: 'var(--gcp-bg)',
          borderLeft: '1px solid var(--gcp-border)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Log Details</h3>
            <button 
              type="button" 
              onClick={() => setSelectedLog(null)}
              style={{ background: 'none', border: 'none', color: 'var(--gcp-text)', cursor: 'pointer', fontSize: '1.5rem' }}
            >
              &times;
            </button>
          </div>
          
          <dl className="cl-resource-meta" style={{ gap: '1rem' }}>
            <div className="cl-resource-full"><dt>ID</dt><dd><code>{selectedLog.id}</code></dd></div>
            <div className="cl-resource-full"><dt>Action</dt><dd>{selectedLog.action}</dd></div>
            <div className="cl-resource-full"><dt>Timestamp</dt><dd>{selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : '—'}</dd></div>
            <div className="cl-resource-full"><dt>Resource Type</dt><dd>{selectedLog.resourceType}</dd></div>
            <div className="cl-resource-full"><dt>Resource ID</dt><dd><code>{selectedLog.resourceId || '—'}</code></dd></div>
            <div className="cl-resource-full"><dt>Actor ID</dt><dd><code>{selectedLog.userId || 'System'}</code></dd></div>
            <div className="cl-resource-full"><dt>IP Address</dt><dd>{selectedLog.ipAddress || '—'}</dd></div>
            
            <div className="cl-resource-full" style={{ marginTop: '1rem' }}>
              <dt>Changes Payload</dt>
              <dd>
                <pre style={{ 
                  backgroundColor: 'var(--gcp-shell-bg)', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  overflowX: 'auto',
                  fontSize: '0.85rem',
                  marginTop: '0.5rem',
                  border: '1px solid var(--gcp-border)'
                }}>
                  {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 
                    ? JSON.stringify(selectedLog.changes, null, 2) 
                    : 'No payload data'}
                </pre>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
