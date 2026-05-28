import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { verifyCompPassword, unlockSession } from '../utils.js';
import { SFX } from '../hooks.js';
import { CompEmoji } from './shared.jsx';

/**
 * PasswordModal — Login-Gate für geschützte Wettkämpfe (Phase A).
 *
 * Props:
 *  - comp:      { id, info } — der zu entsperrende Wettkampf
 *  - onUnlock:  ()=>void — wird nach korrektem Passwort aufgerufen
 *  - onCancel:  ()=>void — Modal schließen ohne Aktion
 */
export const PasswordModal = ({ comp, onUnlock, onCancel }) => {
  const { lang } = useLang();
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [shake, setShake] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const inputRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const onKeyEvt = (e) => {
    try { setCapsOn(e.getModifierState && e.getModifierState('CapsLock')); } catch {}
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onCancel?.();
  };

  const submit = () => {
    if (!pw) return;
    if (verifyCompPassword(comp, pw)) {
      unlockSession(comp.id, pw);
      SFX.complete?.();
      onUnlock?.();
    } else {
      SFX.fall?.();
      setShake(true);
      setErrorCount(c => c + 1);
      try { navigator.vibrate?.([60, 40, 60]); } catch {}
      setTimeout(() => setShake(false), 460);
      setPw('');
      inputRef.current?.focus();
    }
  };

  const compName = comp?.info?.name || 'Wettkampf';
  const compDate = comp?.info?.date || '';
  const compLoc = comp?.info?.location || '';

  return (
    <div
      ref={overlayRef}
      className="modal-overlay modal-center"
      onClick={e => { if (e.target === overlayRef.current) onCancel?.(); }}
    >
      <div className={`modal-sheet${shake ? ' shake' : ''}`} style={{ maxWidth: 420 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <CompEmoji emoji={comp?.info?.emoji} logo={comp?.info?.logo} s={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="type-subheading" style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {compName}
            </div>
            <div className="type-caption" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              {compDate}{compLoc ? ` · ${compLoc}` : ''}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="type-heading" style={{ marginBottom: 4 }}>
          {lang === 'de' ? 'Passwort eingeben' : 'Enter password'}
        </div>
        <div className="type-caption" style={{ marginBottom: 16 }}>
          {lang === 'de'
            ? 'Dieser Wettkampf ist geschützt. Nur autorisierte Personen können öffnen.'
            : 'This competition is protected. Only authorized people can open it.'}
        </div>

        {/* Password input */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            ref={inputRef}
            type={showPw ? 'text' : 'password'}
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={onKeyEvt}
            onKeyUp={onKeyEvt}
            placeholder={lang === 'de' ? 'Wettkampf-Passwort' : 'Competition password'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{ paddingRight: 46, fontSize: 16 }}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw(s => !s)}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex'
            }}
            aria-label={showPw ? (lang === 'de' ? 'Verbergen' : 'Hide') : (lang === 'de' ? 'Anzeigen' : 'Show')}
          >
            {showPw
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><path d="M1 1l22 22" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
          </button>
        </div>

        {/* Caps Lock warning */}
        {capsOn && (
          <div className="caps-warning" style={{ marginBottom: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 9h-5v6h-6v-6H4l8-9z" />
            </svg>
            {lang === 'de' ? 'Caps Lock ist aktiv' : 'Caps Lock is on'}
          </div>
        )}

        {/* Error hint (subtle, no specifics) */}
        {errorCount > 0 && (
          <div className="type-caption" style={{ color: 'var(--danger)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {lang === 'de' ? 'Passwort falsch' : 'Wrong password'}
            {errorCount >= 3 && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>
                {lang === 'de' ? 'Beim Coordinator nachfragen' : 'Ask the coordinator'}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, padding: 12, fontSize: 14 }}
            onClick={() => { SFX.click?.(); onCancel?.(); }}
          >
            {lang === 'de' ? 'Abbrechen' : 'Cancel'}
          </button>
          <button
            className="btn btn-coral"
            style={{ flex: 1.4, padding: 12, fontSize: 14, fontWeight: 700 }}
            onClick={submit}
            disabled={pw.length === 0}
          >
            {lang === 'de' ? 'Entsperren' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordModal;
