'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEFAULT_IMAGE_STYLE_ID, IMAGE_STYLES, getImageStyle } from '../../lib/images/styles';
import { pickSceneDirection, type SceneDirection } from '../../lib/images/sceneDirection';
import { getSelectedStyleId, setSelectedStyleId } from '../../lib/images/styleSelection';

type PreviewState = {
  loading: boolean;
  imageUrl: string | null;
  error: string | null;
};

export default function AdminImagesPage() {
  const searchParams = useSearchParams();
  const isDev = process.env.NODE_ENV === 'development';
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
  const hasAccess = isDev || (adminKey && searchParams.get('key') === adminKey);

  const [selectedStyleId, setSelectedStyleIdState] =
    useState<string>(DEFAULT_IMAGE_STYLE_ID);
  const [defaultStyleId, setDefaultStyleId] = useState<string>(DEFAULT_IMAGE_STYLE_ID);
  const [subject, setSubject] = useState('Learning ritual');
  const [summary, setSummary] = useState('');
  const [promptOverride, setPromptOverride] = useState('');
  const [sceneOverride, setSceneOverride] = useState<SceneDirection | 'auto'>('auto');
  const [lastSceneUsed, setLastSceneUsed] = useState<SceneDirection>('object_scene');
  const [preview, setPreview] = useState<PreviewState>({
    loading: false,
    imageUrl: null,
    error: null,
  });
  const [purgeLogs, setPurgeLogs] = useState<string[]>([]);
  const [purgeRunning, setPurgeRunning] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setSelectedStyleIdState(getSelectedStyleId());
    void (async () => {
      try {
        const response = await fetch('/api/images/styles');
        const payload = await response.json();
        if (response.ok && payload?.defaultStyleId) {
          setDefaultStyleId(payload.defaultStyleId);
        }
      } catch {
        // ignore registry fetch errors
      }
    })();
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('loe_admin_scene_direction') as
        | SceneDirection
        | 'auto'
        | null;
      setSceneOverride(stored ?? 'auto');
    }
  }, []);

  if (!hasAccess) {
    return (
      <section className="admin-shell">
        <div className="admin-card">
          <h1>Not found</h1>
          <p>This page is not available.</p>
        </div>
      </section>
    );
  }

  const selectedStyle = isClient
    ? getImageStyle(selectedStyleId)
    : IMAGE_STYLES[DEFAULT_IMAGE_STYLE_ID];
  const promptPreview = promptOverride.trim() || selectedStyle.prompt;
  const autoScene = pickSceneDirection(subject, summary);

  const handleUseStyle = (id: string) => {
    setSelectedStyleId(id);
    setSelectedStyleIdState(id);
    const style = getImageStyle(id);
    setPromptOverride(style.prompt);
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch('/api/images/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultStyleId: id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.defaultStyleId) {
        throw new Error(payload?.error ?? 'default_style_update_failed');
      }
      setDefaultStyleId(payload.defaultStyleId);
    } catch (error) {
      setPreview({
        loading: false,
        imageUrl: null,
        error: error instanceof Error ? error.message : 'default_style_update_failed',
      });
    }
  };

  const handleSceneOverride = (value: SceneDirection | 'auto') => {
    setSceneOverride(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('loe_admin_scene_direction', value);
    }
  };

  const handleGenerate = async () => {
    setPreview({ loading: true, imageUrl: null, error: null });
    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleId: selectedStyleId,
          title: subject.trim(),
          summary: summary.trim(),
          promptOverride: promptOverride.trim() || undefined,
          sceneDirection: sceneOverride === 'auto' ? undefined : sceneOverride,
        }),
      });
      const payload = await response.json();
      const resolvedImage = payload?.imageUrl ?? payload?.imageDataUrl ?? null;
      if (!response.ok || !resolvedImage) {
        throw new Error(payload?.error ?? 'generation_failed');
      }
      setLastSceneUsed(sceneOverride === 'auto' ? autoScene : sceneOverride);
      setPreview({ loading: false, imageUrl: resolvedImage, error: null });
    } catch (error) {
      setPreview({
        loading: false,
        imageUrl: null,
        error: error instanceof Error ? error.message : 'generation_failed',
      });
    }
  };

  const handleDryRunPurge = async () => {
    setPurgeRunning(true);
    setPurgeLogs([]);
    try {
      const response = await fetch('/api/admin/purge-data?dryRun=1');
      const payload = await response.json();
      if (!response.ok || !payload?.logs) {
        throw new Error(payload?.error ?? 'purge_failed');
      }
      setPurgeLogs(payload.logs);
    } catch (error) {
      setPurgeLogs([
        `[purge-data] Failed: ${error instanceof Error ? error.message : 'purge_failed'}`,
      ]);
    } finally {
      setPurgeRunning(false);
    }
  };

  const handlePurge = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Purge data now? This will delete files.');
      if (!confirmed) {
        return;
      }
    }
    setPurgeRunning(true);
    setPurgeLogs([]);
    try {
      const response = await fetch('/api/admin/purge-data?dryRun=0');
      const payload = await response.json();
      if (!response.ok || !payload?.logs) {
        throw new Error(payload?.error ?? 'purge_failed');
      }
      setPurgeLogs(payload.logs);
    } catch (error) {
      setPurgeLogs([
        `[purge-data] Failed: ${error instanceof Error ? error.message : 'purge_failed'}`,
      ]);
    } finally {
      setPurgeRunning(false);
    }
  };

  return (
    <section className="admin-shell">
      <div className="admin-header">
        <h1>Image styles</h1>
        <p>Internal preview & style registry.</p>
      </div>

      <div className="admin-section">
        <h2>Registered styles</h2>
        <div className="admin-style-list">
          {Object.values(IMAGE_STYLES).map((style) => {
            const isActive = style.id === selectedStyleId;
            const isDefault = style.id === defaultStyleId;
            return (
              <div key={style.id} className="admin-style-card">
                <div>
                  <div className="admin-style-title">
                    <strong>{style.id}</strong>
                    {isDefault && <span className="admin-pill">default</span>}
                    {isActive && <span className="admin-pill admin-pill-active">active</span>}
                  </div>
                  <div className="admin-style-meta">Version {style.version}</div>
                  <p className="admin-style-prompt">
                    {style.prompt.length > 120 ? `${style.prompt.slice(0, 120)}…` : style.prompt}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => handleUseStyle(style.id)}
                >
                  Use
                </button>
                {!isDefault && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleSetDefault(style.id)}
                  >
                    Set default
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-section admin-grid">
        <div className="admin-card">
          <h2>Quick preview</h2>
          <label className="input-label" htmlFor="preview-style">
            Style
          </label>
          <select
            id="preview-style"
            value={selectedStyleId}
            onChange={(event) => handleUseStyle(event.target.value)}
          >
            {Object.values(IMAGE_STYLES).map((style) => (
              <option key={style.id} value={style.id}>
                {style.id}
              </option>
            ))}
          </select>
          <label className="input-label" htmlFor="preview-subject">
            Subject / title
          </label>
          <input
            id="preview-subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <label className="input-label" htmlFor="preview-summary">
            Mission summary (optional)
          </label>
          <textarea
            id="preview-summary"
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
          <label className="input-label" htmlFor="preview-override">
            Prompt override (optional)
          </label>
          <textarea
            id="preview-override"
            rows={5}
            value={promptOverride}
            onChange={(event) => setPromptOverride(event.target.value)}
          />
          <div className="admin-segmented">
            {(['human_action', 'object_scene', 'abstract_symbolic'] as SceneDirection[]).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  className={sceneOverride === value ? 'is-active' : ''}
                  onClick={() => handleSceneOverride(value)}
                >
                  {value}
                </button>
              ),
            )}
          </div>
          <div className="admin-scene-meta">
            {sceneOverride === 'auto' ? (
              <span>Auto: {autoScene}</span>
            ) : (
              <button type="button" onClick={() => handleSceneOverride('auto')}>
                Use auto (Auto: {autoScene})
              </button>
            )}
          </div>
          <div className="admin-actions">
            <button className="primary-button" type="button" onClick={handleGenerate}>
              Generate preview
            </button>
          </div>
          <div className="admin-prompt-preview">
            <span className="admin-muted">Active prompt</span>
            <p>{promptPreview}</p>
          </div>
        </div>

        <div className="admin-card">
          <h2>Preview output</h2>
          {preview.loading ? (
            <div className="admin-preview-skeleton">
              <div className="skeleton-line skeleton-line-title" />
              <div className="skeleton-line skeleton-line-wide" />
              <div className="mission-image-placeholder is-loading">
                <span className="mission-image-badge">Generating artwork…</span>
              </div>
            </div>
          ) : preview.imageUrl ? (
            <div className="admin-preview-image">
              <img src={preview.imageUrl} alt="Preview" />
            </div>
          ) : (
            <div className="admin-preview-empty">No preview yet.</div>
          )}
          {preview.imageUrl && <div className="admin-scene-label">Scene: {lastSceneUsed}</div>}
          {preview.error && <p className="admin-error">{preview.error}</p>}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-card">
          <h2>Maintenance</h2>
          <p className="admin-muted">Dry-run purge (no deletions).</p>
          <div className="admin-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={handleDryRunPurge}
              disabled={purgeRunning}
            >
              {purgeRunning ? 'Running…' : 'Dry-run purge'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handlePurge}
              disabled={purgeRunning}
            >
              {purgeRunning ? 'Running…' : 'Purge data'}
            </button>
          </div>
          {purgeLogs.length > 0 && (
            <pre className="admin-code-block">{purgeLogs.join('\n')}</pre>
          )}
        </div>
      </div>

      <div className="admin-footer-link">
        <a href="/admin/images?key=1">Retour à l’admin images</a>
      </div>
    </section>
  );
}
