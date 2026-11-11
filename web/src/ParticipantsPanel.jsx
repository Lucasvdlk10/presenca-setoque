import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Search, UserRound, UserPen, X, Users } from 'lucide-react';

async function photoToData(file) {
  if (!file) return '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Escolha uma foto JPG, PNG ou WebP.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('A imagem original deve ter até 12 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 720 / bitmap.width, 720 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.84);
    if (data.length > 5.7 * 1024 * 1024) {
      throw new Error('A foto ficou grande demais; escolha uma imagem menor.');
    }
    return data;
  } finally {
    bitmap.close();
  }
}

const photoPath = (apiBase, person) => person.photo_url || `${apiBase}/participants/${encodeURIComponent(person.cpf)}/photo`;

export default function ParticipantsPanel({ participants, api, apiBase, dataSourceLabel = 'SQLite', onAdd, onRefresh, onExpandPhoto, initialEditingParticipant = null, onEditRequestConsumed }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return participants;
    return participants.filter(person =>
      person.name.toLocaleLowerCase('pt-BR').includes(needle) || person.cpf.includes(query.trim())
    );
  }, [participants, query]);

  const openEdit = useCallback(person => {
    setEditing(person);
    setForm({ ...person, photo_data: '', remove_photo: false });
    setError('');
    setMessage('');
  }, []);

  useEffect(() => {
    if (!initialEditingParticipant) return;
    const person = participants.find(item => item.cpf === initialEditingParticipant.cpf) || initialEditingParticipant;
    openEdit(person);
    onEditRequestConsumed?.();
  }, [initialEditingParticipant, participants, onEditRequestConsumed, openEdit]);

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setForm(null);
    setError('');
  }

  async function choosePhoto(file) {
    if (!file) return;
    try {
      const photo_data = await photoToData(file);
      setForm(current => ({ ...current, photo_data, remove_photo: false }));
      setError('');
    } catch (reason) {
      setError(reason.message || 'Não consegui abrir essa imagem.');
    }
  }

  async function saveParticipant(event) {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      cpf: form.cpf.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      birth_date: form.birth_date,
      notes: form.notes.trim(),
      active: Boolean(form.active),
    };
    if (form.photo_data) payload.photo_data = form.photo_data;
    if (form.remove_photo) payload.remove_photo = true;
    try {
      await api(`/participants/${encodeURIComponent(editing.cpf)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await onRefresh();
      setEditing(null);
      setForm(null);
      setMessage('Cadastro atualizado.');
      window.setTimeout(() => setMessage(''), 3000);
    } catch (reason) {
      setError(reason.message || 'Não foi possível atualizar o cadastro.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="participants-panel" aria-labelledby="participants-title">
    <div className="participants-heading">
      <div>
        <div className="eyebrow">{dataSourceLabel === 'Supabase' ? 'CADASTRO NA NUVEM · SUPABASE' : 'CADASTRO LOCAL · SQLITE'}</div>
        <h1 id="participants-title">Participantes</h1>
        <p>Lista completa de participantes, incluindo cadastros inativos.</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Users size={16} /> Adicionar pessoa
      </button>
    </div>

    <div className="participants-toolbar">
      <label className="searchbox participant-search">
        <Search size={16} />
        <input aria-label="Buscar participante" placeholder="Buscar por nome ou CPF" value={query}
          onChange={event => setQuery(event.target.value)} />
      </label>
      <span aria-live="polite">{filtered.length} de {participants.length} participantes</span>
    </div>

    {message && <p className="participant-message" role="status">{message}</p>}
    {error && !editing && <p className="error" role="alert">{error}</p>}

    {filtered.length ? <div className="participants-grid">
      {filtered.map(person => <article className="participant-card" key={person.cpf}>
        <button type="button" className="participant-avatar" disabled={!person.has_photo}
          aria-label={person.has_photo ? `Ampliar foto de ${person.name}` : `Sem foto para ${person.name}`}
          onClick={() => person.has_photo && onExpandPhoto(person)}>
          {person.has_photo
            ? <img crossOrigin={person.photo_url ? 'anonymous' : 'use-credentials'} src={photoPath(apiBase, person)} alt={`Foto de ${person.name}`} loading="lazy" />
            : <UserRound size={22} />}
        </button>
        <div className="participant-card-copy">
          <h2>{person.name}</h2>
          <p className="participant-cpf">CPF · {person.cpf}</p>
          <p>{person.phone || 'Telefone não informado'}{person.email ? ` · ${person.email}` : ''}</p>
        </div>
        <span className={`participant-status ${person.active ? 'is-active' : 'is-inactive'}`}>
          {person.active ? 'Ativo' : 'Inativo'}
        </span>
        <button type="button" className="btn btn-light participant-edit-button"
          aria-label={`Editar cadastro de ${person.name}`} onClick={() => openEdit(person)}>
          <UserPen size={15} /> Editar
        </button>
      </article>)}
    </div> : <div className="participants-empty" role="status">
      <UserRound size={22} />
      <p>{participants.length ? 'Nenhum participante corresponde à busca.' : 'Nenhum participante cadastrado.'}</p>
    </div>}

    <p className="participants-footnote">Alterar o CPF também atualiza os lançamentos de presença vinculados.</p>

    {editing && form && createPortal(<div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeEdit()}>
      <form className="modal participant-edit-modal" onSubmit={saveParticipant} aria-labelledby="edit-participant-title" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="eyebrow">EDIÇÃO DO CADASTRO</div>
            <h2 id="edit-participant-title">Editar participante</h2>
            <p>As alterações são gravadas no banco local.</p>
          </div>
          <button type="button" className="close" aria-label="Fechar edição" onClick={closeEdit}>×</button>
        </div>

        <div className="photo-pick participant-photo-editor">
          {form.photo_data
            ? <img className="photo-form-preview" src={form.photo_data} alt="Prévia da nova foto" />
            : form.has_photo && !form.remove_photo
              ? <img className="photo-form-preview" crossOrigin={editing.photo_url ? 'anonymous' : 'use-credentials'} src={photoPath(apiBase, editing)} alt={`Foto atual de ${editing.name}`} />
              : <div className="photo-form-placeholder"><UserRound size={24} /></div>}
          <div className="photo-pick-actions">
            <label className="btn btn-light photo-select">
              <ImagePlus size={16} /> {form.has_photo && !form.remove_photo ? 'Substituir foto' : 'Adicionar foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Selecionar nova foto"
                onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            {(form.photo_data || (form.has_photo && !form.remove_photo)) && <button type="button" className="btn btn-light"
              onClick={() => setForm(current => ({ ...current, photo_data: '', remove_photo: Boolean(editing.has_photo) }))}>
              <X size={15} /> Remover foto
            </button>}
          </div>
          <small>Foto JPG, PNG ou WebP · até 12 MB antes da redução</small>
        </div>

        <div className="form-grid">
          <label className="span2">Nome completo *
            <input required minLength="2" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>CPF *
            <input required inputMode="numeric" pattern="[0-9.-]{11,14}" aria-describedby="participant-cpf-help"
              value={form.cpf} onChange={event => setForm(current => ({ ...current, cpf: event.target.value }))} />
          </label>
          <label>Telefone
            <input value={form.phone || ''} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>E-mail
            <input type="email" value={form.email || ''} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} />
          </label>
          <label>Nascimento
            <input type="date" value={form.birth_date || ''} onChange={event => setForm(current => ({ ...current, birth_date: event.target.value }))} />
          </label>
          <label className="span2">Observações
            <input value={form.notes || ''} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} />
          </label>
          <small id="participant-cpf-help" className="participant-cpf-help">O CPF identifica os lançamentos; ao corrigi-lo, as presenças vinculadas são transferidas junto.</small>
          <label className="participant-active-toggle">
            <input type="checkbox" checked={Boolean(form.active)}
              onChange={event => setForm(current => ({ ...current, active: event.target.checked ? 1 : 0 }))} />
            <span>Participante ativo</span>
          </label>
        </div>

        {error && <p className="error modal-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-light" onClick={closeEdit} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>, document.body)}
  </section>;
}
