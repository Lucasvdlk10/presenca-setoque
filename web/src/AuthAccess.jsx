import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, KeyRound, LogOut, UserRound, X } from 'lucide-react';

export function LoginScreen({ setupRequired, busy, error, onSubmit, onRetry, unavailable, supabaseMode = false }) {
  const [form, setForm] = useState({ display_name: '', username: '', password: '', confirm: '' });
  const [localError, setLocalError] = useState('');
  const isSetup = setupRequired;

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setLocalError('');
  }

  function submit(event) {
    event.preventDefault();
    setLocalError('');
    if (isSetup && form.password !== form.confirm) {
      setLocalError('As senhas não conferem.');
      return;
    }
    if (isSetup && form.password.length < 15) {
      setLocalError('Use uma senha com pelo menos 15 caracteres. Uma frase longa funciona bem.');
      return;
    }
    onSubmit({
      username: form.username.trim(),
      ...(isSetup ? { display_name: form.display_name.trim() } : {}),
      password: form.password,
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <img src={`${import.meta.env.BASE_URL}logo-se-toque.svg`} alt="Grupo Se Toque" className="auth-logo" />
          <span>SISTEMA DE PRESENÇA</span>
        </div>
        <p className="auth-kicker">{isSetup ? 'PRIMEIRO ACESSO' : supabaseMode ? 'ACESSO NO SUPABASE' : 'ACESSO LOCAL'}</p>
        <h1 id="auth-title">{isSetup ? 'Criar acesso ao sistema' : 'Entrar no sistema'}</h1>
        <p className="auth-intro">
          {isSetup
            ? 'Crie o perfil administrador deste computador. Não existe uma senha padrão.'
            : supabaseMode
              ? 'Entre com seu e-mail e senha para acessar os registros de presença.'
              : 'Entre com seu usuário e senha para acessar os registros de presença.'}
        </p>

        {unavailable ? (
          <div className="auth-unavailable" role="alert">
            <p>{supabaseMode ? 'O Supabase não está respondendo ou ainda não foi configurado.' : 'O serviço local não está respondendo.'}</p>
            <button className="auth-secondary-button" type="button" onClick={onRetry}>
              Tentar novamente <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {isSetup && (
              <label className="auth-field">
                <span>Nome do perfil</span>
                <input
                  autoComplete="name"
                  maxLength={80}
                  name="display_name"
                  onChange={event => update('display_name', event.target.value)}
                  required
                  value={form.display_name}
                />
              </label>
            )}
            <label className="auth-field">
              <span>{supabaseMode ? 'E-mail' : 'Usuário'}</span>
              <input
                autoComplete={supabaseMode ? 'email' : 'username'}
                inputMode={supabaseMode ? 'email' : 'text'}
                maxLength={supabaseMode ? 254 : 32}
                minLength={supabaseMode ? undefined : 3}
                pattern={supabaseMode ? undefined : '[A-Za-z0-9._-]{3,32}'}
                name="username"
                onChange={event => update('username', event.target.value)}
                required
                type={supabaseMode ? 'email' : 'text'}
                value={form.username}
              />
              {isSetup && <small>3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.</small>}
            </label>
            <label className="auth-field">
              <span>Senha</span>
              <input
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                maxLength={128}
                minLength={isSetup ? 15 : undefined}
                name="password"
                onChange={event => update('password', event.target.value)}
                required
                type="password"
                value={form.password}
              />
              {isSetup && <small>15 caracteres ou mais; você pode usar uma frase.</small>}
            </label>
            {isSetup && (
              <label className="auth-field">
                <span>Confirmar senha</span>
                <input
                  autoComplete="new-password"
                  maxLength={128}
                  minLength={15}
                  name="confirm_password"
                  onChange={event => update('confirm', event.target.value)}
                  required
                  type="password"
                  value={form.confirm}
                />
              </label>
            )}
            {(localError || error) && <p className="auth-error" role="alert">{localError || error}</p>}
            <button className="auth-submit" disabled={busy} type="submit">
              {busy ? 'Aguarde…' : isSetup ? 'Criar acesso e entrar' : 'Entrar'}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
        )}
        <p className="auth-local-note">{supabaseMode ? 'Acesso protegido pelo Supabase' : 'Acesso local · seus dados continuam neste computador'}</p>
      </section>
    </main>
  );
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ST';
  return parts.slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('pt-BR');
}

export function ProfileMenu({ profile, onSaveProfile, onChangePassword, onLogout, supabaseMode = false }) {
  const rootRef = useRef(null);
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ username: '', display_name: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const keyboard = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  useEffect(() => {
    if (!dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keyboard = event => {
      if (event.key === 'Escape' && !busy) setDialog('');
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyboard);
    };
  }, [dialog, busy]);

  function openProfile() {
    setDraft({ username: profile.username || '', display_name: profile.display_name || '' });
    setError('');
    setOpen(false);
    setDialog('profile');
  }

  function openPassword() {
    setPasswords({ current: '', next: '', confirm: '' });
    setError('');
    setOpen(false);
    setDialog('password');
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSaveProfile(supabaseMode
        ? { display_name: draft.display_name.trim() }
        : { username: draft.username.trim(), display_name: draft.display_name.trim() });
      setDialog('');
    } catch (cause) {
      setError(cause.message || 'Não foi possível salvar o perfil.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError('');
    if (passwords.next.length < 15) {
      setError('A nova senha precisa ter pelo menos 15 caracteres.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setError('A nova senha e a confirmação não conferem.');
      return;
    }
    setBusy(true);
    try {
      await onChangePassword({ current_password: passwords.current, new_password: passwords.next });
      setPasswords({ current: '', next: '', confirm: '' });
      setDialog('');
    } catch (cause) {
      setError(cause.message || 'Não foi possível alterar a senha.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await onLogout();
    } catch (cause) {
      setError(cause.message || 'Não foi possível sair da sessão.');
      setBusy(false);
    }
  }

  function dialogKeyDown(event) {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="profile-menu-wrap" ref={rootRef}>
      <button
        aria-controls="profile-options"
        aria-expanded={open}
        aria-label={`Abrir opções do perfil de ${profile.display_name || profile.username}`}
        className="avatar profile-trigger"
        onClick={() => { setError(''); setOpen(value => !value); }}
        title={profile.display_name || profile.username}
        type="button"
      >
        {initials(profile.display_name)}
      </button>
      {open && (
        <div className="profile-popover" id="profile-options" aria-label="Opções do perfil">
          <div className="profile-popover-heading">
            <strong>{profile.display_name}</strong>
            <span>{supabaseMode ? profile.email : `@${profile.username}`}</span>
          </div>
          <button className="profile-menu-action" onClick={openProfile} type="button">
            <UserRound size={17} /> Editar perfil
          </button>
          <button className="profile-menu-action" onClick={openPassword} type="button">
            <KeyRound size={17} /> Configurar senha
          </button>
          <div className="profile-menu-divider" />
          <button className="profile-menu-action profile-logout" disabled={busy} onClick={logout} type="button">
            <LogOut size={17} /> Sair da sessão
          </button>
          {error && <p className="profile-menu-error" role="alert">{error}</p>}
        </div>
      )}

      {dialog && (
        <div className="profile-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && setDialog('')}>
          <section
            aria-labelledby="profile-dialog-title"
            aria-modal="true"
            className="profile-dialog"
            onKeyDown={dialogKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <button
              aria-label="Fechar janela"
              autoFocus
              className="profile-dialog-close"
              disabled={busy}
              onClick={() => setDialog('')}
              type="button"
            >
              <X size={18} />
            </button>
            <p className="profile-dialog-kicker">{supabaseMode ? 'CONTA SUPABASE' : 'CONTA LOCAL'}</p>
            <h2 id="profile-dialog-title">{dialog === 'profile' ? 'Editar perfil' : supabaseMode ? 'Alterar senha' : 'Configurar senha'}</h2>
            {dialog === 'profile' ? (
              <form className="auth-form" onSubmit={saveProfile}>
                <label className="auth-field">
                  <span>Nome do perfil</span>
                  <input autoComplete="name" maxLength={80} onChange={event => setDraft(current => ({ ...current, display_name: event.target.value }))} required value={draft.display_name} />
                </label>
                {supabaseMode ? (
                  <label className="auth-field">
                    <span>E-mail de acesso</span>
                    <input autoComplete="email" readOnly value={profile.email || ''} />
                    <small>O e-mail é gerenciado pelo Supabase Auth.</small>
                  </label>
                ) : (
                  <label className="auth-field">
                    <span>Usuário de acesso</span>
                    <input autoComplete="username" maxLength={32} minLength={3} pattern="[A-Za-z0-9._-]{3,32}" onChange={event => setDraft(current => ({ ...current, username: event.target.value }))} required value={draft.username} />
                    <small>3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.</small>
                  </label>
                )}
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="auth-submit" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar perfil'} {!busy && <ArrowRight size={17} />}</button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={changePassword}>
                <label className="auth-field">
                  <span>Senha atual</span>
                  <input autoComplete="current-password" maxLength={128} onChange={event => setPasswords(current => ({ ...current, current: event.target.value }))} required type="password" value={passwords.current} />
                </label>
                <label className="auth-field">
                  <span>Nova senha</span>
                  <input autoComplete="new-password" maxLength={128} minLength={15} onChange={event => setPasswords(current => ({ ...current, next: event.target.value }))} required type="password" value={passwords.next} />
                  <small>15 caracteres ou mais; uma frase longa funciona bem.</small>
                </label>
                <label className="auth-field">
                  <span>Confirmar nova senha</span>
                  <input autoComplete="new-password" maxLength={128} minLength={15} onChange={event => setPasswords(current => ({ ...current, confirm: event.target.value }))} required type="password" value={passwords.confirm} />
                </label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="auth-submit" disabled={busy} type="submit">{busy ? 'Atualizando…' : 'Alterar senha'} {!busy && <ArrowRight size={17} />}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
