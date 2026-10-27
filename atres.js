/* atres.js — ATREs monitoradas e a regra de conferência das TAREFAS (operações do tarefas.xlsx).

   Para cada ATRE:
     cts        = CTs que PODEM/DEVEM ter a ATRE (testados no nome do CT, em maiúsculas e sem espaços)
     chaves     = palavras que indicam o serviço no texto da tarefa (sem acento, MAIÚSCULAS)
     exige      = (opcional) além da chave, o texto também precisa ter UMA destas palavras (ex.: a ação)
     todasDoCT  = true  -> TODA tarefa desses CTs deve ter a ATRE (CT dedicado ao serviço)
                  false -> só as tarefas desses CTs cujo texto indica o serviço devem ter a ATRE
     proibido   = situações em que a tarefa NÃO PODE ter esta ATRE (além das REGRAS GERAIS abaixo)
     dispensa   = situações em que a tarefa NÃO PRECISA da ATRE (se citar, vai para "A conferir")

   Situações de cada tarefa:
     Faltando ATRE  = PODE ter a ATRE (CT certo, serviço certo, nenhuma proibição) e está sem
     ATRE indevida  = NÃO PODE ter ATRE (área 014, bomba, serviço interno, flange, jato...) e está com
     ATRE incorreta = o texto cita o código da ATRE, mas o CT da tarefa não é um dos permitidos
     A conferir     = cita a ATRE e o CT está certo, mas o texto não confirma o serviço
     Adequada       = cita a ATRE, CT certo e texto confere

   Para monitorar outra ATRE, copie um bloco abaixo e preencha cod, cts e chaves. */

/* As palavras são testadas pelo INÍCIO (\bPINT pega pint, pintar, pintura; \bADEQ pega adeq, adequar, adequação).
   Abreviações com ponto também valem: M.A = montar andaime, D.A = desmontar andaime. */

/* ---- REGRAS GERAIS (valem para todas as ATREs) ----
   Os testes rodam no texto SEM ACENTO e em MAIÚSCULAS.
   area14 olha a área da ordem; bomba olha também o título da ordem e a localização (onde costuma estar a TAG). */
const REGRAS_GERAIS = {
  proibido: [
    { id: 'area14',  rotulo: 'ordem da área 014 não pode ter ATRE' },
    { id: 'bomba',   rotulo: 'bomba (TAG B- ou MB-) não pode ter ATRE', re: /(^|[^A-Z0-9])M?B\s?-\s?\d/ },
    { id: 'interno', rotulo: 'serviço interno não pode ter ATRE', re: /\bINTERN[OA]S?\b|\bINTERIOR\b/ },
    { id: 'ptt',     rotulo: 'tarefa com PTT não pode ter ATRE', re: /\bPTT\b/ },
    { id: 'prco',    rotulo: 'tarefa com PRCO não pode ter ATRE', re: /\bPRCO\b/ },
    { id: 'mobil',   rotulo: 'mobilizar não pode ter ATRE', re: /\bMOBIL/ }
  ],
  dispensa: [
    { id: 'oficina', rotulo: 'serviço em oficina não precisa de ATRE', re: /\bOFIC/ },
    { id: 'dimens',  rotulo: 'dimensionar não precisa de ATRE', re: /\bDIMENS/ }
  ]
};

const ATRES = [
  { cod: 'CA01', titulo: 'Instalação e remoção de mangueiras', inicio: '17/02/2026', validade: '17/02/2027',
    cts: [/^CALD/], ctsRotulo: 'CALD (CALDTU, CALDDSC, CALDVAZA...)', todasDoCT: false,
    libera: 'No planejamento, só INSTALAÇÃO e REMOÇÃO de mangueiras recebem a CA01 (a ATRE em si também cobre caps e flanges terminais). Testar mangueira não precisa de ATRE.',
    proibe: ['Serviços com liberação do equipamento e aplicação de LIBRA', 'Serviços com necessidade de RAS', 'Trabalhos de corte/solda', 'Flange'],
    chaves: [/\bMANGUEIR/, /\bMANG\b/, /\bMGUEIRA/],
    exige: [/\bINST/, /\bREM\b/, /\bREMOV/, /\bREMOC/, /\bRETIR/, /\bMONT/, /\bDESM/],
    proibido: [{ id: 'flange', rotulo: 'flange não pode ter ATRE', re: /\bFLANGE|\bFLG\b/ }],
    dispensa: [] },

  { cod: 'CO01', titulo: 'Montagem, desmontagem e adequação de andaime', inicio: '17/02/2026', validade: '17/02/2027',
    cts: [/^MAND/], ctsRotulo: 'MAND (MANDTU, MANDDSC, MANDVAZA...)', todasDoCT: false,
    libera: 'Só montagem, desmontagem e adequação (readequação) de andaimes simplesmente apoiados; ferramentas manuais, furadeira à bateria e apoio de movimentação de cargas.',
    proibe: ['Serviços com LIBRA', 'Serviços com RAS', 'Andaimes especiais que exigem projeto (fachadeiro, em balanço, suspenso e especial)', 'Sobre bombas em operação, blow down de tocha, interior de bacias ou próximo a descarga de PSV'],
    chaves: [/\bANDAIM/, /\bAND\b/, /\bM[.\/]\s?A\b/, /\bD[.\/]\s?A\b/],
    exige: [/\bMONT/, /\bDESM/, /\bADEQ/, /\bREADEQ/, /\bM[.\/]\s?A\b/, /\bD[.\/]\s?A\b/],
    proibido: [], dispensa: [] },

  { cod: 'CO02', titulo: 'Instalação e/ou remoção de isolamento térmico', inicio: '17/02/2026', validade: '17/02/2027',
    cts: [/^ISOL/], ctsRotulo: 'ISOLADOR', todasDoCT: true,
    libera: 'Remoção e instalação de isolamento térmico com ferramentas manuais e furadeira à bateria.',
    proibe: ['Serviços com LIBRA', 'Serviços com RAS', 'Serviços com alpinismo'],
    chaves: [/\bISOL/],
    proibido: [], dispensa: [] },

  { cod: 'CO03', titulo: 'Limpeza de área', inicio: '17/02/2026', validade: '17/02/2027',
    cts: [/^AUSE/], ctsRotulo: 'AUSE (AUSETU, AUSEDSC...)', todasDoCT: false,
    libera: 'Limpeza de área em geral: pisos, plataformas, grades, organização, coleta de líquidos ou sólidos e limpeza das ruas no entorno das unidades; mangueira de água, desengraxante, água de hidrante e apoio de movimentação de cargas.',
    proibe: ['Serviços com LIBRA', 'Serviços com RAS', 'Utilização de ar comprimido'],
    chaves: [/\bLIMP/],
    proibido: [], dispensa: [] },

  { cod: 'CO04', titulo: 'Pintura', inicio: '17/02/2026', validade: '17/02/2027',
    cts: [/^(PINTJCHT|PINTJATQ|PINTJATO|PINTLETRI)$/], ctsRotulo: 'PINTJCHT, PINTJATQ, PINTJATO e PINTLETRI', todasDoCT: true,
    libera: 'Pintura de TAGs, equipamentos, demarcações, pisos, estruturas em geral, guarda-corpo e tubulações; plataforma elevatória móvel. No planejamento, jato e preparar superfície NÃO recebem ATRE.',
    proibe: ['Serviços com LIBRA', 'Serviços com RAS', 'Alpinismo, ferramentas mecânicas abrasivas, jateamento (qualquer tipo), bomba airless e hidrojateamento de alta pressão', 'Atividades em espaço confinado', 'Preparar superfície'],
    chaves: [/\bPINT/],
    proibido: [
      { id: 'jato', rotulo: 'jato não pode ter ATRE', re: /\bJAT/ },
      { id: 'prepsup', rotulo: 'preparar superfície não pode ter ATRE', re: /\bPREP\w*\.?\s+(D[EA]\s+)?SUP/ }
    ],
    dispensa: [] }
];

/* ---- regras de conferência (não precisa mexer) ---- */
const Atre = (() => {
  const norm = (s) => String(s === null || s === undefined ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const porCod = {};
  ATRES.forEach((a) => { porCod[a.cod] = a; });
  const reCod = new RegExp('(^|[^A-Z0-9])(' + ATRES.map((a) => a.cod).join('|') + ')(?![A-Z0-9])', 'g');

  function data(s) { const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }

  /* vigente, vencida ou futura */
  function vigencia(a) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const i = data(a.inicio), v = data(a.validade);
    if (v && hoje > v) return { estado: 'vencida', rotulo: 'vencida' };
    if (i && hoje < i) return { estado: 'futura', rotulo: 'ainda não vigente' };
    return { estado: 'vigente', rotulo: 'vigente' };
  }

  /* regras (gerais + da ATRE) que se aplicam a esta tarefa.
     ctx = { cods: ['14','18'] (áreas da ordem), extra: 'título da ordem + localização' } */
  function regras(a, t, ctx) {
    const area = (ctx && ctx.cods) || [];
    const extra = norm((ctx && ctx.extra) || '');
    const casa = (r) => {
      if (r.id === 'area14') return area.includes('14');
      if (r.id === 'bomba') return r.re.test(t) || r.re.test(extra);
      return r.re.test(t);
    };
    return {
      proibido: REGRAS_GERAIS.proibido.concat(a.proibido || []).filter(casa).map((r) => r.rotulo),
      dispensa: REGRAS_GERAIS.dispensa.concat(a.dispensa || []).filter(casa).map((r) => r.rotulo)
    };
  }

  /* Analisa UMA tarefa (texto + CT + contexto da ordem). Devolve:
     declaradas = códigos citados no texto | erradas = declaradas que o CT não pode ter
     indevidas  = [{cod, motivos}] declaradas que a tarefa NÃO PODE ter (área 014, bomba, flange...)
     esperadas  = [{cod, motivo}] ATREs que a tarefa PODE/DEVE ter e não cita (motivo: 'ct' ou 'texto')
     sit        = ok | indevida | incorreta | falta | conferir | nenhuma (sem relação com as ATREs monitoradas) */
  function analisar(texto, ct, ctx) {
    const t = norm(texto);
    const c = norm(ct).replace(/\s+/g, '');
    const permitida = (a) => a.cts.some((re) => re.test(c));
    const servico = (a) => a.chaves.some((re) => re.test(t)) && (!a.exige || a.exige.some((re) => re.test(t)));
    const declaradas = [];
    for (const m of t.matchAll(reCod)) if (!declaradas.includes(m[2])) declaradas.push(m[2]);

    const indevidas = declaradas
      .map((d) => ({ cod: d, motivos: regras(porCod[d], t, ctx).proibido }))
      .filter((x) => x.motivos.length);
    const erradas = declaradas.filter((d) => !permitida(porCod[d]) && !indevidas.some((x) => x.cod === d));

    const esperadas = ATRES
      .filter((a) => {
        if (declaradas.includes(a.cod) || !permitida(a)) return false;
        const r = regras(a, t, ctx);
        if (r.proibido.length || r.dispensa.length) return false;
        return a.todasDoCT || servico(a);
      })
      .map((a) => ({ cod: a.cod, motivo: a.todasDoCT ? 'ct' : 'texto' }));

    const confirma = (d) => {
      const a = porCod[d];
      return !regras(a, t, ctx).dispensa.length && (a.todasDoCT || servico(a));
    };

    let sit = 'nenhuma';
    if (indevidas.length) sit = 'indevida';
    else if (erradas.length) sit = 'incorreta';
    else if (declaradas.length) sit = declaradas.some(confirma) ? 'ok' : 'conferir';
    else if (esperadas.length) sit = 'falta';
    const primaria = (indevidas[0] && indevidas[0].cod) || erradas[0] || declaradas[0] || (esperadas[0] && esperadas[0].cod) || '';
    return { declaradas, erradas, indevidas, esperadas, primaria, sit };
  }

  return { lista: ATRES, porCod, analisar, vigencia, gerais: REGRAS_GERAIS };
})();
