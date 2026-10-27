# Alterações

## A) Todas as ordens (IMPD, descrição da tarefa, horas do CT)

### carteira.html
Dentro de `.filtros` da tela `tela-ordens`, logo depois do `<label>Status do sistema ...</label>`, acrescente:

```html
<label>IMPD
  <select id="filtro-impd">
    <option value="">Todas</option>
    <option value="sim">Só com IMPD</option>
    <option value="nao">Sem IMPD</option>
  </select>
</label>
<label>Descrição da tarefa
  <input type="search" id="filtro-desc" placeholder="ex.: andaime, mangueira">
</label>
```
E no `<select id="ordenar">` acrescente: `<option value="horas">Horas do CT (maior primeiro)</option>`.

Troque `carteira.js?v=11` por `carteira.js?v=12`.

### carteira.js

**1.** Na seção 2 (Utilitários), acrescente:

```js
const num = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = txt(v).replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const fmtHH = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' HH';
```

**2.** Em `processar()`, troque a linha
`pega(numNorm(ordem), ordem).ops.push(p);` por:

```js
const exN = num(r[OP.ex]), durN = num(r[OP.dur]), trabN = num(r[OP.trab]);
p.hh = trabN > 0 ? trabN : exN * durN;     /* HH: planejado, senão executantes x duração */
pega(numNorm(ordem), ordem).ops.push(p);
```

**3.** Troque a função `visiveis()` inteira por:

```js
function visiveis() {
  const busca = $('busca').value.trim().toLowerCase();
  const area = $('filtro-area').value;
  const ct = $('filtro-ct').value;
  const st = $('filtro-st').value;
  const impd = $('filtro-impd').value;
  const desc = semAcento($('filtro-desc').value);
  const lista = baseOrdens().filter((o) => {
    if (area === 'ct' ? !o.porCT : (area && !o.cods.includes(area))) return false;
    if (ct && !o.ops.some((p) => ctKey(p.ct) === ct)) return false;
    if (st && !(o.om && o.om.stSis === st)) return false;
    if (impd === 'sim' && !o.impd) return false;
    if (impd === 'nao' && o.impd) return false;
    if (desc && !o.ops.some((p) => semAcento(p.texto).includes(desc) && (!ct || ctKey(p.ct) === ct))) return false;
    if (busca && !o.busca.includes(busca)) return false;
    if (state.esp && !o.esp[state.esp]) return false;
    if (state.esp === 'cnpa') {
      if (state.cnpaSit === 'impd' && !o.impd) return false;
      if (state.cnpaSit === 'semimpd' && o.impd) return false;
      if (state.cnpaSit === 'pend' && !o.pend.length) return false;
    }
    return true;
  });
  const ord = $('ordenar').value;
  if (ord === 'inicio') {
    lista.sort((a, b) => (a.dataBase ? a.dataBase.getTime() : Infinity) - (b.dataBase ? b.dataBase.getTime() : Infinity) || cmpNum(a.ordem, b.ordem));
  } else if (ord === 'horas') {
    lista.sort((a, b) => ((horasCT(b) || {}).total || 0) - ((horasCT(a) || {}).total || 0) || cmpNum(a.ordem, b.ordem));
  } else {
    lista.sort((a, b) => cmpNum(a.ordem, b.ordem));
  }
  return lista;
}

/* horas do CT filtrado dentro de uma ordem (null se nenhum CT estiver filtrado) */
function horasCT(o) {
  const ct = $('filtro-ct').value;
  if (!ct) return null;
  const ts = o.ops.filter((p) => ctKey(p.ct) === ct);
  const soma = (l) => l.reduce((s, p) => s + p.hh, 0);
  return { n: ts.length, total: soma(ts), pend: soma(ts.filter((p) => p.pend)), semHH: ts.filter((p) => !p.hh).length };
}
```

**4.** Troque `opsMostradas` por (a tabela da ordem passa a mostrar só o CT e a descrição filtrados, batendo com as horas):

```js
const opsMostradas = (o) => {
  let ops = state.esp === 'cnpa' && o.esp.cnpa ? o.pend : o.ops;
  const ct = $('filtro-ct').value, desc = semAcento($('filtro-desc').value);
  if (ct) ops = ops.filter((p) => ctKey(p.ct) === ct);
  if (desc) ops = ops.filter((p) => semAcento(p.texto).includes(desc));
  return ops;
};
```

**5.** Em `chipsHTML(o)`, logo antes de `return c.join('');`, acrescente:

```js
const h = horasCT(o);
if (h) c.push(`<span class="chip sit-ok">${esc($('filtro-ct').selectedOptions[0].text)}: ${fmtHH(h.total)} · ${fmtHH(h.pend)} pendentes · ${h.n} tarefa(s)${h.semHH ? ` (${h.semHH} sem HH)` : ''}</span>`);
```

**6.** Em `renderResumoOrdens(lista)`, logo depois de `const itens = [ ... ];`, acrescente:

```js
if ($('filtro-ct').value) {
  const hs = lista.map(horasCT);
  itens.push(['HH do CT', fmtHH(hs.reduce((s, h) => s + h.total, 0))], ['HH pendentes', fmtHH(hs.reduce((s, h) => s + h.pend, 0))]);
}
```

**7.** Em `resetFiltros()`, acrescente `'filtro-impd', 'filtro-desc'` na lista de ids.

**8.** Em `iniciarApp()`, troque a linha dos filtros por:

```js
['filtro-area', 'filtro-ct', 'filtro-st', 'filtro-impd', 'ordenar'].forEach((id) => $(id).addEventListener('change', () => { if (temDados()) renderOrdens(); }));
$('filtro-desc').addEventListener('input', () => { if (temDados()) renderOrdens(); });
```

## B) Acesso à nova aba

**nivelamento.html**, dentro de `<div class="topo-direita">`, antes do link "Início":
```html
<a class="voltar" href="montar.html">Montar nivelamento</a>
```

**index.html**, dentro de `<section class="cartoes-home">`:
```html
<a class="cartao-home" href="montar.html">
  <span class="cartao-icone" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6M17 15l2 2 3-3"/></svg></span>
  <span class="cartao-texto"><strong>Montar nivelamento</strong>
    <span>Escolha as ordens e as tarefas e veja a ocupação por centro de trabalho antes de nivelar.</span></span>
  <span class="cartao-seta" aria-hidden="true">Abrir →</span>
</a>
```
