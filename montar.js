(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const txt = (v) => (v === null || v === undefined ? '' : String(v).trim());
  const numNorm = (v) => { let s = txt(v); if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, '').replace(/^0+/, '') || '0'; return s.toUpperCase(); };
  const chave = (o, p, s) => [numNorm(o), numNorm(p), numNorm(s)].join('|');
  const ctKey = (s) => txt(s).toUpperCase().replace(/\s+/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cmp = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  const arred = (n, c = 1) => Math.round(n * 10 ** c) / 10 ** c;
  const fmtHH = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' HH';
  const fmtPct = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  const semAcento = (s) => txt(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const num = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    let s = txt(v).replace(/\s/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /* mesmas colunas do Nivelamento */
  const T = { ordem: 1, op: 2, sub: 3, ct: 4, texto: 5, exec: 6, dur: 7, plan: 8, stUsu: 9, stSis: 11 };
  const O = { area: 0, ordem: 3, titulo: 4 };
  const A = { ordem: 1, op: 2, sub: 3, trab: 7, exec: 8, dur: 9 };
  const CTS_FIXOS = ['AUSETU', 'CALDTU', 'CALDVAZA', 'CALDDSC', 'MANDTU', 'MANDVAZA', 'MANDDSC', 'SOLDADOR', 'SOLDVAZA'];
  const LS = 'montar.nivelamento.v1';
  const CAP = 'nivelamento.capacidade.v1';   /* a mesma capacidade da aba Nivelamento */

  /* Tempo real (Firebase Realtime Database). Preencha com os dados do seu projeto. */
  const FB = { apiKey: 'AIzaSyD3zWuUjmjQXrlM_CQ2T7VJy_dlmUieCJ0', databaseURL: 'https://planejamento-9cfd1-default-rtdb.firebaseio.com/' };

  const state = { ord: new Map(), por: null, add: [], sel: new Set(), abertas: new Set(), cap: { horasPadrao: '', cts: {}, extras: [] }, ocup: null, ctsSel: null };

  const aviso = (m) => { $('aviso').textContent = m || ''; $('aviso').hidden = !m; };
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2500); }

  try { Object.assign(state.cap, JSON.parse(localStorage.getItem(CAP)) || {}); } catch (e) { /* padrão */ }
  if (!Array.isArray(state.cap.extras)) state.cap.extras = [];
  const salvarCap = () => { try { localStorage.setItem(CAP, JSON.stringify(state.cap)); } catch (e) { /* ignora */ } publicar(); };
  const salvar = () => { try { localStorage.setItem(LS, JSON.stringify({ add: state.add, sel: [...state.sel], cts: state.ctsSel })); } catch (e) { /* ignora */ } publicar(); };

  /* ---------- Dados ---------- */
  function montarModelo(d) {
    state.ord = new Map();
    (d.ordens || []).forEach((r) => {
      const g = numNorm(r[O.ordem]);
      if (g) state.ord.set(g, { ordem: txt(r[O.ordem]), area: txt(r[O.area]), titulo: txt(r[O.titulo]) });
    });
    const atual = new Map();
    (d.atual || []).forEach((r) => {
      const k = chave(r[A.ordem], r[A.op], r[A.sub]);
      const w = num(r[A.trab]);
      atual.set(k, (atual.get(k) || 0) + (w > 0 ? w : num(r[A.exec]) * num(r[A.dur])));
    });
    state.por = new Map();
    (d.tarefas || []).forEach((r) => {
      const g = numNorm(r[T.ordem]);
      if (!g) return;
      const k = chave(r[T.ordem], r[T.op], r[T.sub]);
      const exN = num(r[T.exec]); const durN = num(r[T.dur]); const pl = num(r[T.plan]);
      const hh = pl > 0 ? pl : (exN * durN > 0 ? exN * durN : (atual.get(k) || 0));   /* planejado > exec x duração > planilha atual */
      const t = { k, g, ordem: txt(r[T.ordem]), op: txt(r[T.op]), sub: txt(r[T.sub]), ct: txt(r[T.ct]), texto: txt(r[T.texto]),
        exN, durN, hh, conf: /\bCONF\b/i.test(txt(r[T.stSis]) + ' ' + txt(r[T.stUsu])) };
      if (!state.por.has(g)) state.por.set(g, []);
      state.por.get(g).push(t);
    });
    state.por.forEach((l) => l.sort((a, b) => cmp(a.op, b.op) || cmp(a.sub, b.sub)));
    try {
      const s = JSON.parse(localStorage.getItem(LS)) || {};
      state.add = (s.add || []).filter((g) => state.por.has(g));
      const validas = new Set(); state.add.forEach((g) => state.por.get(g).forEach((t) => validas.add(t.k)));
      state.sel = new Set((s.sel || []).filter((k) => validas.has(k)));
      state.ctsSel = Array.isArray(s.cts) ? s.cts : null;
    } catch (e) { /* começa vazio */ }
    render();
    iniciarSync();
  }

  const selecionadas = () => {
    const out = [];
    state.add.forEach((g) => (state.por.get(g) || []).forEach((t) => { if (state.sel.has(t.k)) out.push(t); }));
    return out;
  };

  function visiveis(g) {
    const ct = $('f-ct').value; const b = semAcento($('f-busca').value); const soPend = $('f-pend').checked;
    return (state.por.get(g) || []).filter((t) =>
      (!ct || ctKey(t.ct) === ct) && (!b || semAcento(t.texto).includes(b)) && (!soPend || !t.conf));
  }

  /* ---------- Ordens e tarefas ---------- */
  function addOrdens() {
    if (!state.por) { aviso('Os dados ainda não carregaram. Carregue a pasta na página inicial.'); return; }
    const lista = $('oms').value.split(/[^0-9A-Za-z]+/).filter(Boolean).map(numNorm);
    const faltam = [];
    lista.forEach((g) => {
      if (!state.por.has(g)) { faltam.push(g); return; }
      if (!state.add.includes(g)) { state.add.push(g); state.abertas.add(g); }
    });
    aviso(faltam.length ? `Não achei em tarefas.xlsx: ${faltam.join(', ')}` : '');
    if (!faltam.length) $('oms').value = '';
    render();
  }

  function montarFiltroCT() {
    const sel = $('f-ct'); const atual = sel.value;
    const cts = new Map();
    state.add.forEach((g) => state.por.get(g).forEach((t) => { if (t.ct && !cts.has(ctKey(t.ct))) cts.set(ctKey(t.ct), t.ct); }));
    sel.innerHTML = '<option value="">Todos</option>' + [...cts].sort().map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('');
    if (cts.has(atual)) sel.value = atual;
  }

  function renderOrdens() {
    $('ordens-lista').innerHTML = state.add.map((g) => {
      const o = state.ord.get(g) || {}; const ts = state.por.get(g) || []; const vis = visiveis(g);
      const n = ts.filter((t) => state.sel.has(t.k)).length;
      const linhas = vis.map((t) => `<tr class="${state.sel.has(t.k) ? 'verde' : t.conf ? 'cinza' : ''}"><td><input type="checkbox" data-t="${esc(t.k)}"${state.sel.has(t.k) ? ' checked' : ''}></td>` +
        `<td class="nowrap">${esc(t.op)}${t.sub ? '.' + esc(t.sub) : ''}</td><td class="nowrap">${esc(t.ct)}</td><td class="texto">${esc(t.texto)}</td>` +
        `<td>${esc(t.exN || '')}</td><td>${esc(t.durN || '')}</td><td class="nowrap">${t.hh ? fmtHH(t.hh) : '<em>sem tempo</em>'}</td><td>${t.conf ? 'Confirmada' : 'Pendente'}</td></tr>`).join('');
      return `<details class="tag-grupo" data-g="${esc(g)}"${state.abertas.has(g) ? ' open' : ''}><summary>` +
        `<span class="tag-nome">Ordem ${esc(o.ordem || g)}</span><span class="tag-qtd">${esc(o.titulo || '')}</span>` +
        `${o.area ? `<span class="chip">${esc(o.area)}</span>` : ''}<span class="selo niv" data-cont="${esc(g)}">${n}/${ts.length} selecionadas</span>` +
        `<button type="button" class="botao pequeno" data-rm="${esc(g)}">Remover</button></summary><div class="tag-corpo">` +
        `<p><button type="button" class="botao pequeno" data-mk="${esc(g)}">Marcar visíveis</button> ` +
        `<button type="button" class="botao pequeno" data-un="${esc(g)}">Desmarcar visíveis</button></p>` +
        (vis.length ? `<div class="tabela-wrap"><table><thead><tr><th></th><th>Op.</th><th>CT</th><th>Tarefa</th><th>Exec.</th><th>Dur.</th><th>HH</th><th>Situação</th></tr></thead><tbody>${linhas}</tbody></table></div>`
          : '<p class="ajuda">Nenhuma tarefa com esses filtros.</p>') + '</div></details>';
    }).join('');
  }

  /* ---------- Ocupação ---------- */
  function calcOcup() {
    const usado = new Map(); const sem = new Map(); const nomes = new Map();
    /* todos os CTs conhecidos (alimenta o seletor "Adicionar CT") */
    CTS_FIXOS.forEach((k) => nomes.set(k, k));
    state.por.forEach((l) => l.forEach((t) => { const k = ctKey(t.ct); if (k) nomes.set(k, t.ct); }));
    selecionadas().forEach((t) => {
      const k = ctKey(t.ct) || '(SEM CT)';
      if (!nomes.has(k)) nomes.set(k, t.ct || '(sem CT)');
      usado.set(k, (usado.get(k) || 0) + t.hh);
      if (!t.hh) sem.set(k, (sem.get(k) || 0) + 1);
    });
    const ks = state.ctsSel ? state.ctsSel.slice()
      : CTS_FIXOS.concat([...usado.keys()].filter((k) => !CTS_FIXOS.includes(k)));
    return { ks, usado, sem, nomes };
  }

  const celulas = '<td class="oc-disp"></td><td class="oc-usado"></td><td><div class="oc-cel"><div class="oc-barra"><div class="oc-fill"></div></div><span class="oc-pct"></span></div></td><td class="oc-saldo"></td>';

  function renderOcup() {
    state.ocup = calcOcup();
    const { ks, nomes, usado } = state.ocup;
    const v = (x) => esc(x === undefined ? '' : x);
    const linhas = ks.map((k) => {
      const c = state.cap.cts[k] || {};
      return `<tr data-ct="${esc(k)}"><td class="nowrap"><strong>${esc(nomes.get(k) || k)}</strong></td>` +
        `<td><input type="number" min="0" step="1" class="oc-in" data-campo="exec" value="${v(c.exec)}"></td>` +
        `<td><input type="number" min="0" step="0.5" class="oc-in" data-campo="horas" value="${v(c.horas)}"></td>${celulas}` +
        `<td><button type="button" class="botao pequeno" data-oc-rm="${esc(k)}" title="Tirar este CT da lista">✕</button></td></tr>`;
    }).join('');
    const livres = [...nomes].filter(([k]) => !ks.includes(k)).sort((a, b) => cmp(a[1], b[1]));
    const hhOculto = [...usado].filter(([k]) => !ks.includes(k)).reduce((s, [, h]) => s + h, 0);
    $('ocup').innerHTML =
      `<p>Horas por executante (padrão): <input type="number" min="0" step="0.5" class="oc-in" id="oc-padrao" value="${v(state.cap.horasPadrao)}"> ` +
      '<small>Disponível = executantes × horas. Usado = HH das tarefas selecionadas.</small></p>' +
      `<p class="oc-add">Adicionar CT: <select id="oc-add"><option value="">— escolha —</option>${livres.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select> ` +
      '<button type="button" class="botao pequeno" id="oc-add-btn">Adicionar</button> ' +
      '<button type="button" class="botao pequeno" id="oc-reset">Restaurar lista padrão</button>' +
      (hhOculto ? ` <small>⚠ ${fmtHH(hhOculto)} de tarefas selecionadas estão em CTs fora da lista.</small>` : '') + '</p>' +
      '<div class="tabela-wrap"><table><thead><tr><th>CT</th><th>Executantes</th><th>Horas/exec.</th><th>Disponível</th><th>Usado (selecionado)</th><th>Ocupação</th><th>Saldo</th><th></th></tr></thead><tbody>' +
      `${linhas}<tr class="oc-total" data-total="1"><td>Total (CTs preenchidos)</td><td></td><td></td>${celulas}<td></td></tr></tbody></table></div>` +
      '<h3 class="gr-titulo">Gráfico por CT <small>(linha tracejada = 100% da capacidade)</small></h3><div id="ocup-graf" class="gr"></div>';
    pintarOcup();
  }

  function pintarOcup() {
    const raiz = $('ocup'); if (!state.ocup) return;
    const { usado, sem } = state.ocup;
    const padrao = parseFloat(state.cap.horasPadrao) || 0;
    let sd = 0; let su = 0; const graf = [];
    const preencher = (tr, disp, us, nSem) => {
      const set = (s, t) => { tr.querySelector(s).textContent = t; };
      const saldo = tr.querySelector('.oc-saldo'); const fill = tr.querySelector('.oc-fill');
      set('.oc-disp', disp > 0 ? fmtHH(disp) : '—');
      set('.oc-usado', fmtHH(us) + (nSem ? ` (${nSem} sem tempo)` : ''));
      if (disp <= 0) { fill.style.width = '0'; set('.oc-pct', '—'); saldo.className = 'oc-saldo'; saldo.textContent = us > 0 ? 'Informe executantes e horas' : ''; return; }
      const pct = (us / disp) * 100; const dif = disp - us;
      fill.style.width = Math.min(pct, 100) + '%'; fill.classList.toggle('estouro', pct > 100);
      set('.oc-pct', fmtPct(pct));
      saldo.className = 'oc-saldo ' + (dif >= 0 ? 'ok' : 'over');
      saldo.textContent = dif >= 0 ? `Faltam ${fmtHH(dif)} (livre)` : `Passou ${fmtHH(-dif)} (excesso)`;
    };
    raiz.querySelectorAll('tr[data-ct]').forEach((tr) => {
      const k = tr.dataset.ct; const c = state.cap.cts[k] || {};
      tr.querySelector('[data-campo="horas"]').placeholder = state.cap.horasPadrao || '';
      const disp = (parseFloat(c.exec) || 0) * (parseFloat(c.horas) || padrao);
      const us = usado.get(k) || 0;
      if (disp > 0) { sd += disp; su += us; graf.push({ k, nome: state.ocup.nomes.get(k) || k, pct: (us / disp) * 100 }); }
      preencher(tr, disp, us, sem.get(k) || 0);
    });
    preencher(raiz.querySelector('tr[data-total]'), sd, su, 0);
    pintarGrafico(graf);
    $('ocup-badge').textContent = sd > 0 ? `${fmtPct((su / sd) * 100)} do total` : 'informe executantes e horas';
  }

  /* gráfico de colunas: cada CT sobe até a linha de 100% */
  function pintarGrafico(d) {
    const box = $('ocup-graf'); if (!box) return;
    if (!d.length) { box.innerHTML = '<p class="ajuda">Informe executantes e horas dos CTs para ver o gráfico.</p>'; box.dataset.sig = ''; return; }
    const max = Math.max(120, Math.ceil(Math.max(...d.map((x) => x.pct)) / 20) * 20);
    const sig = d.map((x) => x.k).join('|');
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.innerHTML = '<div class="gr-area"><div class="gr-linha"><span>100%</span></div>' +
        d.map((x) => `<div class="gr-col" data-k="${esc(x.k)}"><span class="gr-val"></span><div class="gr-bar" style="height:0"></div></div>`).join('') +
        '</div><div class="gr-rot">' + d.map((x) => `<span title="${esc(x.nome)}">${esc(x.nome)}</span>`).join('') + '</div>';
      void box.offsetHeight;   /* força o navegador a animar a subida */
    }
    box.querySelector('.gr-linha').style.bottom = (100 / max * 100) + '%';
    const cols = new Map([...box.querySelectorAll('.gr-col')].map((c) => [c.dataset.k, c]));
    d.forEach((x) => {
      const c = cols.get(x.k); if (!c) return;
      const bar = c.querySelector('.gr-bar');
      bar.style.height = (Math.min(x.pct, max) / max * 100) + '%';
      bar.classList.toggle('estouro', x.pct > 100);
      c.querySelector('.gr-val').textContent = fmtPct(x.pct);
    });
  }

  /* ---------- Nivelamento montado ---------- */
  function renderMontado() {
    const ts = selecionadas();
    if (!ts.length) { $('montado').innerHTML = '<div class="banner info">Nenhuma tarefa selecionada ainda.</div>'; return; }
    const porCT = new Map();
    ts.forEach((t) => { const k = t.ct || '(sem CT)'; const g = porCT.get(k) || { n: 0, hh: 0 }; g.n++; g.hh += t.hh; porCT.set(k, g); });
    const total = ts.reduce((s, t) => s + t.hh, 0);
    let html = `<div class="chips" style="margin-bottom:12px"><span class="chip">${ts.length} tarefa(s)</span><span class="chip">${fmtHH(total)}</span>` +
      [...porCT].sort((a, b) => b[1].hh - a[1].hh).map(([ct, g]) => `<span class="chip">${esc(ct)} · ${g.n} · ${fmtHH(g.hh)}</span>`).join('') + '</div>';
    state.add.forEach((g) => {
      const l = ts.filter((t) => t.g === g); if (!l.length) return;
      const o = state.ord.get(g) || {};
      html += `<details class="tag-grupo" open><summary><span class="tag-nome">Ordem ${esc(o.ordem || g)}</span><span class="tag-qtd">${esc(o.titulo || '')}</span>` +
        `<span class="selo niv">${l.length} tarefa(s) · ${esc(fmtHH(l.reduce((s, t) => s + t.hh, 0)))}</span></summary><div class="tag-corpo"><div class="tabela-wrap"><table><thead><tr><th>Op.</th><th>CT</th><th>Tarefa</th><th>Exec.</th><th>Dur.</th><th>HH</th></tr></thead><tbody>` +
        l.map((t) => `<tr class="verde"><td class="nowrap">${esc(t.op)}${t.sub ? '.' + esc(t.sub) : ''}</td><td class="nowrap">${esc(t.ct)}</td><td class="texto">${esc(t.texto)}</td><td>${esc(t.exN || '')}</td><td>${esc(t.durN || '')}</td><td class="nowrap">${t.hh ? fmtHH(t.hh) : '<em>sem tempo</em>'}</td></tr>`).join('') +
        '</tbody></table></div></div></details>';
    });
    $('montado').innerHTML = html;
  }

  function render() {
    const tem = state.add.length > 0;
    $('inicio').hidden = tem; $('resultado').hidden = !tem;
    if (tem) { montarFiltroCT(); renderOrdens(); renderOcup(); renderMontado(); }
    salvar();
  }

  function atualizarSelecao(tr, k) {
    const t = [...state.por.values()].flat().find((x) => x.k === k);
    if (tr) tr.className = state.sel.has(k) ? 'verde' : (t && t.conf ? 'cinza' : '');
    state.add.forEach((g) => {
      const el = document.querySelector(`[data-cont="${CSS.escape(g)}"]`);
      if (el) el.textContent = `${state.por.get(g).filter((x) => state.sel.has(x.k)).length}/${state.por.get(g).length} selecionadas`;
    });
    renderOcup(); renderMontado(); salvar();
  }

  function marcar(gs, on) {
    gs.forEach((g) => visiveis(g).forEach((t) => { if (on) state.sel.add(t.k); else state.sel.delete(t.k); }));
    render();
  }

  /* ---------- Tempo real (sala compartilhada) ---------- */
  let refSala = null; let aplicando = false; let ultimo = ''; let syncIniciado = false;

  const estadoComp = () => JSON.stringify({ add: state.add, sel: [...state.sel], cts: state.ctsSel, cap: { horasPadrao: state.cap.horasPadrao, cts: state.cap.cts } });

  function publicar() {
    if (!refSala || aplicando) return;
    const j = estadoComp(); if (j === ultimo) return;
    ultimo = j; refSala.set({ json: j, t: Date.now() });
  }

  function aplicar(j) {
    let e; try { e = JSON.parse(j); } catch (x) { return; }
    const foco = document.activeElement;
    const guarda = foco && foco.classList && foco.classList.contains('oc-in') && foco.closest('tr[data-ct]')
      ? { ct: foco.closest('tr').dataset.ct, campo: foco.dataset.campo, pos: foco.selectionStart } : null;
    aplicando = true;
    state.add = (e.add || []).filter((g) => state.por.has(g));
    state.sel = new Set(e.sel || []);
    state.ctsSel = Array.isArray(e.cts) ? e.cts : null;
    state.cap.horasPadrao = (e.cap && e.cap.horasPadrao) || '';
    state.cap.cts = (e.cap && e.cap.cts) || {};
    salvarCap(); render();
    aplicando = false;
    if (guarda) {   /* devolve o cursor a quem estava digitando */
      const el = document.querySelector(`tr[data-ct="${CSS.escape(guarda.ct)}"] [data-campo="${guarda.campo}"]`);
      if (el) { el.focus(); try { el.setSelectionRange(guarda.pos, guarda.pos); } catch (x) { /* input number */ } }
    }
  }

  function iniciarSync() {
  const sala = new URLSearchParams(location.search).get('sala');

  if (!sala) {
    $('sync').textContent = 'Sem sala (só você)';
    return;
  }

  if (syncIniciado) return;
  syncIniciado = true;

  if (typeof firebase === 'undefined' ||
      !firebase.database ||
      !firebase.initializeApp) {
    syncIniciado = false;
    $('sync').textContent = 'Firebase indisponível';
    aviso('Não foi possível carregar o Firebase. Verifique os scripts no HTML.');
    return;
  }

  if (!FB.apiKey || !FB.databaseURL) {
    syncIniciado = false;
    $('sync').textContent = 'Firebase não configurado';
    aviso('Confira apiKey e databaseURL na configuração do Firebase.');
    return;
  }

  try {
    // Reutiliza a aplicação se o script.js já a inicializou.
    if (firebase.apps.length) {
      firebase.app();
    } else {
      firebase.initializeApp(FB);
    }

    const codigoSala = sala.replace(/[.#$\[\]\/]/g, '_');
    refSala = firebase.database().ref('montar/' + codigoSala);

    $('sync').textContent = `Sala: ${sala} · conectando…`;

    refSala.on('value', (snap) => {
      const v = snap.val();

      $('sync').textContent = `Sala: ${sala} · ao vivo`;

      if (!v) {
        publicar();
        return;
      }

      if (v.json === ultimo) return;

      ultimo = v.json;
      aplicar(v.json);
    }, (err) => {
      $('sync').textContent = `Sala: ${sala} · erro`;
      aviso('Erro na sincronização: ' + err.message);
    });

  } catch (e) {
    syncIniciado = false;
    refSala = null;
    $('sync').textContent = 'Falha na conexão';
    aviso('Não consegui conectar ao Firebase: ' + e.message);
  }
}

  /* ---------- Exportar ---------- */
  async function copiar() {
    const oms = [...new Set(selecionadas().map((t) => t.ordem))];
    if (!oms.length) { toast('Nada selecionado.'); return; }
    try { await navigator.clipboard.writeText(oms.join('\n')); } catch (e) {
      const ta = document.createElement('textarea'); ta.value = oms.join('\n'); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast(`${oms.length} OM(s) copiada(s)`);
  }

  function excel() {
    const ts = selecionadas();
    if (!ts.length) { aviso('Selecione tarefas antes de gerar o Excel.'); return; }
    if (typeof XLSX === 'undefined') { aviso('Biblioteca XLSX não carregou.'); return; }
    aviso('');
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([['Ordem', 'Título da ordem', 'Área', 'CT', 'Op.', 'Sub', 'Texto da operação', 'Executantes', 'Duração', 'HH', 'Situação']]
      .concat(ts.map((t) => { const o = state.ord.get(t.g) || {}; return [t.ordem, o.titulo || '', o.area || '', t.ct, t.op, t.sub, t.texto, t.exN || '', t.durN || '', arred(t.hh, 2) || '', t.conf ? 'Confirmada' : 'Pendente']; })));
    ws1['!cols'] = [10, 30, 8, 11, 6, 5, 45, 11, 8, 8, 12].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Nivelamento montado');
    const { ks, usado, nomes } = calcOcup();
    const padrao = parseFloat(state.cap.horasPadrao) || 0;
    const oc = [['CT', 'Executantes', 'Horas/exec.', 'Disponível (HH)', 'Usado (HH)', 'Ocupação (%)', 'Saldo (HH)']];
    ks.forEach((k) => {
      const c = state.cap.cts[k] || {}; const ex = parseFloat(c.exec) || 0; const h = parseFloat(c.horas) || padrao;
      const disp = ex * h; const us = usado.get(k) || 0;
      if (!disp && !us) return;
      oc.push([nomes.get(k) || k, ex || '', h || '', disp || '', arred(us), disp > 0 ? arred((us / disp) * 100) : '', disp > 0 ? arred(disp - us) : '']);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(oc);
    ws2['!cols'] = [16, 12, 12, 16, 12, 13, 12].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Ocupação');
    XLSX.writeFile(wb, `montar_nivelamento_${hoje()}.xlsx`);
  }

  function diario() {
    const ts = selecionadas();
    if (!ts.length) { aviso('Selecione tarefas antes.'); return; }
    if (typeof XLSX === 'undefined') { aviso('Biblioteca XLSX não carregou.'); return; }
    aviso('');
    /* colunas do diario: Conf, Ordem, CT, Área, Op, Sub, Texto (sem cabeçalho) */
    const ws = XLSX.utils.aoa_to_sheet(ts.map((t) => ['', t.ordem, t.ct, (state.ord.get(t.g) || {}).area || '', t.op, t.sub, t.texto]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'diario');
    XLSX.writeFile(wb, 'diario.xlsx');
  }

  /* ---------- Eventos ---------- */
  $('add-oms').addEventListener('click', addOrdens);
  $('limpar-tudo').addEventListener('click', () => { state.add = []; state.sel.clear(); state.abertas.clear(); aviso(''); render(); });
  ['f-ct', 'f-pend'].forEach((id) => $(id).addEventListener('change', renderOrdens));
  $('f-busca').addEventListener('input', renderOrdens);
  $('marcar-vis').addEventListener('click', () => marcar(state.add, true));
  $('desmarcar-vis').addEventListener('click', () => marcar(state.add, false));
  $('copiar').addEventListener('click', copiar);
  $('excel').addEventListener('click', excel);
  $('diario').addEventListener('click', diario);
  $('sala-btn').addEventListener('click', () => {
    const c = (prompt('Código da sala (combine com seu parceiro, ex.: semana44):') || '').trim();
    if (c) location.search = '?sala=' + encodeURIComponent(c);
  });

  const lista = $('ordens-lista');
  lista.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (!d.dataset || !d.dataset.g) return;
    if (d.open) state.abertas.add(d.dataset.g); else state.abertas.delete(d.dataset.g);
  }, true);
  lista.addEventListener('change', (ev) => {
    const c = ev.target.closest('[data-t]'); if (!c) return;
    if (c.checked) state.sel.add(c.dataset.t); else state.sel.delete(c.dataset.t);
    atualizarSelecao(c.closest('tr'), c.dataset.t);
  });
  lista.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.rm) {
      ev.preventDefault();
      const g = b.dataset.rm;
      (state.por.get(g) || []).forEach((t) => state.sel.delete(t.k));
      state.add = state.add.filter((x) => x !== g);
      render();
    } else if (b.dataset.mk) marcar([b.dataset.mk], true);
    else if (b.dataset.un) marcar([b.dataset.un], false);
  });

  $('ocup').addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.id === 'oc-padrao') state.cap.horasPadrao = el.value;
    else if (el.dataset.campo) { const k = el.closest('tr').dataset.ct; (state.cap.cts[k] = state.cap.cts[k] || {})[el.dataset.campo] = el.value; }
    else return;
    salvarCap(); pintarOcup();
  });

  $('ocup').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.ocRm) state.ctsSel = state.ocup.ks.filter((k) => k !== b.dataset.ocRm);
    else if (b.id === 'oc-add-btn') { const k = $('oc-add').value; if (!k) return; state.ctsSel = state.ocup.ks.concat(k); }
    else if (b.id === 'oc-reset') state.ctsSel = null;
    else return;
    salvar(); renderOcup();
  });

  /* carrega as planilhas já guardadas (neste computador e da nuvem) */
  Pasta.carregar((p) => {
    if (!p.dados.tarefas) return;
    $('fonte').textContent = `${Pasta.descricao(p)}`;
    montarModelo(p.dados);
  }, aviso);
})();
