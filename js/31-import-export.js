/* LIVRO-CAIXA · js/31-import-export.js — importação e exportação (app.js: 14364-15128). Separação por responsabilidade; conteúdo preservado. */

  function setPasteStatus(message) { document.getElementById('pasteStatus').textContent = message; }


  // ===== Exportação: colunas fixas do arquivo; período segue os filtros ativos + período ativo da tela =====
  const EXPORT_COLUMN_DEFS = [
    { key: 'date', label: 'Data', width: 25 },
    { key: 'desc', label: 'Descrição', width: 58 },
    { key: 'cat', label: 'Categoria', width: 32 },
    { key: 'in', label: 'Entrada', width: 25 },
    { key: 'out', label: 'Saída', width: 25 },
    { key: 'balance', label: 'Saldo', width: 32 }
  ];

  function getExportRangeBounds() {
    return {
      start: document.getElementById('filterDateStart').value,
      end: document.getElementById('filterDateEnd').value
    };
  }

  function getExportEntries() {
    return getFilteredEntries();
  }

  function getExportMeta(activeEntries = getExportEntries()) {
    const { start: startFilter, end: endFilter } = getExportRangeBounds();
    const dates = activeEntries.map(e => e.date).filter(Boolean).sort();
    const dateStart = startFilter || dates[0] || todayISO();
    const dateEnd = endFilter || dates[dates.length - 1] || dateStart;
    const initialForBank = bankId => (Number(banks.find(b => b.id === bankId)?.initial) || 0) + entries.filter(e => e.bank === bankId && e.date < dateStart).reduce((sum,e)=>sum+(e.type==='in'?Number(e.amount||0):-Number(e.amount||0)),0);
    return { dateStart, dateEnd, initialForBank };
  }
  function getOrganizedExportData() {
    const activeEntries = getExportEntries();
    const meta = getExportMeta(activeEntries);
    const bankIds = [...new Set(activeEntries.map(e => e.bank))];
    return bankIds.map(id => {
      const bank = banks.find(b => b.id === id);
      if (!bank) return null;
      const bankEntries = activeEntries.filter(e => e.bank === id).sort((a,b)=>a.date.localeCompare(b.date) || (a.type==='in'?-1:1));
      const initialBalance = meta.initialForBank(id);
      const finalBalance = initialBalance + bankEntries.reduce((sum,e)=>sum+(e.type==='in'?Number(e.amount||0):-Number(e.amount||0)),0);
      return { bank, entries: bankEntries, initialBalance, finalBalance };
    }).filter(Boolean);
  }
  function downloadBlob(blob, filename) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }

  // ===== P1.4 — Blocos adicionais de exportação: Caixinhas, Investimentos, Resumo Patrimonial =====
  function getPocketsExportBlock(dateStart, dateEnd) {
    return pockets.map(pocket => {
      const movs = yieldsLog.filter(y => y.targetType === 'pocket' && y.targetId === pocket.id && (!dateStart || y.date >= dateStart) && (!dateEnd || y.date <= dateEnd)).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      return {
        name: pocket.name,
        goal: pocket.goal || '',
        initial: Number(pocket.initial) || 0,
        current: pocketCurrentBalance(pocket),
        movements: movs.map(m => ({ date: m.date, kind: m.kind === 'aporte' ? 'Aporte' : m.kind === 'resgate' ? 'Resgate' : 'Rendimento', amount: Number(m.amount) || 0, desc: m.desc || '' }))
      };
    });
  }
  function getInvestmentsExportBlock(dateStart, dateEnd) {
    return investments.map(inv => {
      const movs = yieldsLog.filter(y => y.targetType === 'invest' && y.targetId === inv.id && (!dateStart || y.date >= dateStart) && (!dateEnd || y.date <= dateEnd)).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      const isCrypto = isCryptoType(inv.type);
      return {
        name: inv.name,
        alias: inv.alias || '',
        type: inv.type,
        units: isCrypto && inv.units != null ? formatCryptoUnits(inv.type, inv.units) : (inv.units != null ? String(inv.units) : ''),
        price: inv.price || null,
        currentValue: inv.type === 'Renda Fixa' ? fixedIncomeCurrentValue(inv) : Number(inv.value || 0),
        movements: movs.map(m => ({
          date: m.date,
          kind: m.kind === 'aporte' ? 'Aporte' : m.kind === 'resgate' ? 'Resgate' : 'Rendimento',
          amount: Number(m.amount) || 0,
          units: isCrypto && m.units != null ? formatCryptoUnits(inv.type, m.units, inv.name) : ''
        }))
      };
    });
  }
  function getPatrimonySummaryBlock() {
    const bankTotal = totalBankBalance();
    const pocketTotal = totalPocketBalance();
    const investTotal = totalInvestBalance();
    return { bankTotal, pocketTotal, investTotal, total: bankTotal + pocketTotal + investTotal };
  }
  function renderExportPreview() {
    // P2.4.3 — formato original da prévia + blocos Caixinhas/Investimentos (período)
    const grouped = getOrganizedExportData();
    const count = grouped.reduce((sum, group) => sum + group.entries.length, 0);
    const meta = getExportMeta();
    const initial = grouped.reduce((sum, g) => sum + g.initialBalance, 0);
    const final = grouped.reduce((sum, g) => sum + g.finalBalance, 0);
    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    const preview = document.getElementById('exportPreview');
    const hasNothing = count === 0 && pocketsBlock.length === 0 && investBlock.length === 0;
    ['btnExportFormatPdf', 'btnExportFormatXlsx', 'btnExportFormatDocx'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = hasNothing;
    });
    document.getElementById('exportPreviewCaption').textContent =
      `${count} movimentação(ões) · ${meta.dateStart.split('-').reverse().join('/')} a ${meta.dateEnd.split('-').reverse().join('/')} · Saldo inicial ${fmt(initial)} · Saldo final ${fmt(final)}.`;

    const bankHtml = grouped.map(group => {
      const rows = group.entries.slice(0, 6).map(entry => {
        const category = categories.find(c => c.id === entry.category);
        return `<div class="export-preview-row"><span>${escapeHTML(entry.date.split('-').reverse().join('/'))}</span><strong>${escapeHTML(entry.desc || 'Lançamento')}</strong><span>${escapeHTML(category?.name || 'Sem categoria')}</span><b class="${entry.type === 'in' ? 'positive' : 'negative'}">${entry.type === 'in' ? '+' : '−'} ${fmt(Math.abs(entry.amount))}</b></div>`;
      }).join('');
      const extra = group.entries.length > 6 ? `<div class="export-preview-more">+ ${group.entries.length - 6} lançamento(s)</div>` : '';
      return `<section class="export-preview-bank"><h4>${escapeHTML(group.bank.name)} <small>Inicial ${fmt(group.initialBalance)} · Final ${fmt(group.finalBalance)}</small></h4>${rows}${extra}</section>`;
    }).join('');

    const pocketsHtml = pocketsBlock.length ? `<section class="export-preview-bank"><h4>Caixinhas <small>no período</small></h4>${pocketsBlock.map(p => {
      const rows = p.movements.slice(0, 4).map(m => `<div class="export-preview-row"><span>${escapeHTML(m.date.split('-').reverse().join('/'))}</span><strong>${escapeHTML(p.name)} · ${escapeHTML(m.kind)}</strong><span>${escapeHTML(m.desc || '')}</span><b class="${m.kind === 'Resgate' ? 'negative' : 'positive'}">${m.kind === 'Resgate' ? '−' : '+'} ${fmt(Math.abs(m.amount))}</b></div>`).join('');
      return `<div class="export-preview-sub"><strong>${escapeHTML(p.name)}</strong> <small>Saldo ${fmt(p.current)}</small></div>${rows || '<div class="export-preview-more">Sem movimentos no período</div>'}`;
    }).join('')}</section>` : '';

    const investHtml = investBlock.length ? `<section class="export-preview-bank"><h4>Investimentos <small>no período</small></h4>${investBlock.map(inv => {
      const label = inv.alias || inv.name;
      const rows = inv.movements.slice(0, 4).map(m => `<div class="export-preview-row"><span>${escapeHTML(m.date.split('-').reverse().join('/'))}</span><strong>${escapeHTML(label)} · ${escapeHTML(m.kind)}</strong><span>${escapeHTML(inv.type)}${m.units ? ` · ${m.units}` : ''}</span><b class="${m.kind === 'Resgate' ? 'negative' : 'positive'}">${m.kind === 'Resgate' ? '−' : '+'} ${fmtPrecise(Math.abs(m.amount))}</b></div>`).join('');
      return `<div class="export-preview-sub"><strong>${escapeHTML(label)}</strong> <small>${fmt(inv.currentValue)}</small></div>${rows || '<div class="export-preview-more">Sem movimentos no período</div>'}`;
    }).join('')}</section>` : '';

    preview.innerHTML = (bankHtml || '') + pocketsHtml + investHtml || '<div class="empty">Nada para pré-visualizar no período.</div>';
  }
  function exportExtractPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert('A biblioteca PDF ainda está carregando.'); return; }
    const grouped=getOrganizedExportData(); const meta=getExportMeta(); const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'mm',format:'a4'}); const initial=grouped.reduce((s,g)=>s+g.initialBalance,0); const final=grouped.reduce((s,g)=>s+g.finalBalance,0);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - 2 * margin;
    const pdfCols = EXPORT_COLUMN_DEFS;
    const colsTotal = pdfCols.reduce((sum, c) => sum + c.width, 0) || 1;
    const colsScale = Math.min(1, contentWidth / colsTotal);
    const pdfWidths = pdfCols.map(c => c.width * colsScale);
    const descWidth = (pdfCols.find(c => c.key === 'desc')?.width || 58) * colsScale - 4;
    let y = 18;
    let pageNum = 1;
    const totalPages = estimateTotalPages(grouped, meta);

    const addHeader = (title) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('Livro-Caixa — Extrato', margin, y); y+=7;
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.text(`Período: ${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`, margin, y); y+=5;
      doc.text(`Saldo Inicial: ${fmt(initial)} | Saldo Final: ${fmt(final)}`, margin, y); y+=8;
      doc.setDrawColor(200,200,200); doc.line(margin, y, pageWidth - margin, y); y+=10;
    };

    const addFooter = () => {
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.setTextColor(120,120,120);
        doc.text(`Livro-Caixa — Extrato | Página ${i} de ${pageCount} | ${todayISO()}`, pageWidth/2, pageHeight - 8, {align:'center'});
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth/2, pageHeight - 4, {align:'center'});
      }
    };

    const addPageIfNeeded = (spaceNeeded) => {
      if (y + spaceNeeded > pageHeight - 20) {
        doc.addPage(); y = 14; pageNum++;
        doc.setDrawColor(200,200,200); doc.line(margin, y - 4, pageWidth - margin, y - 4);
      }
    };

    const drawTableHeader = (cols, widths) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.setFillColor(40,40,40);
      let x = margin;
      cols.forEach((col, i) => {
        doc.rect(x, y, widths[i], 7, 'F');
        doc.setTextColor(255,255,255);
        doc.text(col, x + 3, y + 5);
        x += widths[i];
      });
      y += 8;
      doc.setDrawColor(0,0,0); doc.line(margin, y, pageWidth - margin, y); y += 3;
      doc.setTextColor(0,0,0);
    };


    function estimateTotalPages(grouped, meta) {
      let total = 1; // capa
      grouped.forEach(g => total += Math.ceil((g.entries.length + 2) / 30));
      return total + 3; // caixinhas, investimentos, resumo
    }

    addHeader('Livro-Caixa — Extrato');

    grouped.forEach((group, gi) => {
      addPageIfNeeded(30);
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.setTextColor(40,40,40);
      doc.text(group.bank.name, margin, y); y+=6;
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      doc.setTextColor(80,80,80);
      doc.text(`Saldo inicial: ${fmt(group.initialBalance)}  |  Saldo final: ${fmt(group.finalBalance)}`, margin, y); y+=5;
      doc.setDrawColor(200,200,200); doc.line(margin, y, pageWidth - margin, y); y+=4;

      const widths = pdfWidths;
      drawTableHeader(pdfCols.map(c => c.label), widths);

      let running = group.initialBalance;
      group.entries.forEach(e => {
        addPageIfNeeded(8);
        const cat = categories.find(c => c.id === e.category);
        const dateFmt = e.date.split('-').reverse().join('/');
        running += e.type === 'in' ? Number(e.amount||0) : -Number(e.amount||0);
        const descLines = doc.splitTextToSize((e.desc||'Lançamento'), descWidth);
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0,0,0);
        const descText = descLines.join(' ');
        let x = margin;
        pdfCols.forEach(col => {
          if (col.key === 'date') {
            doc.text(dateFmt, x + 2, y, {maxWidth: col.width * colsScale - 4});
          } else if (col.key === 'desc') {
            doc.text(escapeHTML(descText).slice(0, 80), x + 2, y, {maxWidth: col.width * colsScale - 4});
          } else if (col.key === 'cat') {
            doc.text(cat ? cat.name.slice(0,18) : '—', x + 2, y, {maxWidth: col.width * colsScale - 4});
          } else if (col.key === 'in' && e.type === 'in') {
            doc.setTextColor(0x2F,0x6F,0x4F);
            doc.text('+' + fmt(Math.abs(e.amount)).replace(moneyDisplaySymbol(), ''), x + col.width * colsScale - 2, y, {align:'right'});
            doc.setTextColor(0,0,0);
          } else if (col.key === 'out' && e.type === 'out') {
            doc.setTextColor(0xB4,0x4D,0x3A);
            doc.text('−' + fmt(Math.abs(e.amount)).replace(moneyDisplaySymbol(), ''), x + col.width * colsScale - 2, y, {align:'right'});
            doc.setTextColor(0,0,0);
          } else if (col.key === 'balance') {
            doc.setFontSize(7); doc.setTextColor(100,100,100);
            doc.text(fmt(running).replace(moneyDisplaySymbol(), ''), x + col.width * colsScale - 2, y, {align:'right'});
            doc.setTextColor(0,0,0); doc.setFontSize(8);
          }
          x += col.width * colsScale;
        });
        y += 7;
      });
      y += 8;
    });

    // Caixinhas
    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    if (pocketsBlock.length) {
      // Don't force new page if there's space
      addPageIfNeeded(50);
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(40,40,40);
      doc.text('2. Caixinhas', margin, y); y+=10;
      pocketsBlock.forEach(p => {
        addPageIfNeeded(30);
        doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(40,40,40);
        doc.text(p.name, margin, y); y+=6;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
        doc.text(`${p.goal ? 'Objetivo: ' + p.goal + ' · ' : ''}Saldo inicial: ${fmt(p.initial)} · Saldo atual: ${fmt(p.current)}`, margin, y); y+=8;
        p.movements.forEach(m => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(0,0,0);
          doc.text(`${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmt(m.amount)}${m.desc ? ' (' + m.desc + ')' : ''}`, margin + 4, y);
          y += 6;
        });
        y += 6;
      });
    }

    // Investimentos
    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    if (investBlock.length) {
      addPageIfNeeded(50);
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(40,40,40);
      doc.text('3. Investimentos', margin, y); y+=10;
      investBlock.forEach(inv => {
        addPageIfNeeded(30);
        doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(40,40,40);
        doc.text(`${inv.name}${inv.alias ? ' (' + inv.alias + ')' : ''}`, margin, y); y+=6;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
        doc.text(`Tipo: ${inv.type}${inv.units ? ' · Quantidade: ' + inv.units : ''}${inv.price ? ' · Cotação: ' + fmt(inv.price) : ''} · Valor atual: ${fmt(inv.currentValue)}`, margin, y); y+=8;
        inv.movements.forEach(m => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(0,0,0);
          doc.text(`${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmtPrecise(m.amount)}${m.units ? ` · ${m.units}` : ''}`, margin + 4, y); y+=6;
        });
        y += 6;
      });
    }

    // Resumo Patrimonial
    const summary = getPatrimonySummaryBlock();
    doc.addPage(); y = 14;
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(40,40,40);
    doc.text('Resumo Patrimonial', margin, y); y+=10;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text(`Total em contas: ${fmt(getPatrimonySummaryBlock().bankTotal)}`, margin, y); y+=8;
    doc.text(`Total em Caixinhas: ${fmt(getPatrimonySummaryBlock().pocketTotal)}`, margin, y); y+=8;
    doc.text(`Total investido: ${fmt(getPatrimonySummaryBlock().investTotal)}`, margin, y); y+=10;
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(0,0,0);
    doc.text(`Patrimônio Total: ${fmt(getPatrimonySummaryBlock().total)}`, margin, y);

    addFooter();
    doc.save(`livro-caixa-extrato-${todayISO()}.pdf`); logInfo('Exportação','Exportação PDF','Sucesso','Extrato PDF completo gerado.',{dateStart:meta.dateStart,dateEnd:meta.dateEnd});
  }
  function exportExtractXlsx() {
    if(typeof XLSX==='undefined'){alert('A biblioteca de Excel ainda está carregando.');return;}
    const exportCols = EXPORT_COLUMN_DEFS;
    const grouped=getOrganizedExportData(); const meta=getExportMeta(); const wb=XLSX.utils.book_new(); const totalInitial=grouped.reduce((s,g)=>s+g.initialBalance,0); const totalFinal=grouped.reduce((s,g)=>s+g.finalBalance,0);
    const xlsxWidths = { date: 12, desc: 40, cat: 22, in: 14, out: 14, balance: 16 };

    grouped.forEach(group=>{
      const rows=[
        ['Extrato — Livro-Caixa'],
        ['Período',`${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`],
        ['Saldo Inicial',group.initialBalance],
        [],
        exportCols.map(c => c.label)
      ];
      let running=group.initialBalance;
      group.entries.forEach(e=>{
        const cat=categories.find(c=>c.id===e.category);
        running+=e.type==='in'?Number(e.amount||0):-Number(e.amount||0);
        rows.push(exportCols.map(c => {
          if (c.key === 'date') return e.date.split('-').reverse().join('/');
          if (c.key === 'desc') return e.desc||'';
          if (c.key === 'cat') return cat?cat.name:'—';
          if (c.key === 'in') return e.type==='in'?e.amount:'';
          if (c.key === 'out') return e.type==='out'?e.amount:'';
          return running;
        }));
      });
      const balIdx = exportCols.findIndex(c => c.key === 'balance');
      if (balIdx > 0) {
        rows.push([], exportCols.map((c, i) => i === balIdx - 1 ? 'Saldo Final' : (i === balIdx ? group.finalBalance : '')));
      } else if (balIdx === 0) {
        rows.push([], ['Saldo Final'], [group.finalBalance]);
      } else {
        rows.push([], ['Saldo Final', group.finalBalance]);
      }
      const ws=XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = exportCols.map(c => ({ wch: xlsxWidths[c.key] }));
      // Currency formatting for money columns
      exportCols.forEach((c, i) => {
        if (!['in','out','balance'].includes(c.key)) return;
        const colLetter = XLSX.utils.encode_col(i);
        for (let r = 6; r <= rows.length; r++) {
          const cell = ws[`${colLetter}${r}`];
          if (cell && typeof cell.v === 'number') {
            cell.t = 'n'; cell.z = '#,##0.00';
          }
        }
      });
      const safeName=group.bank.name.replace(/[\/*?:\[\]]/g,'').slice(0,31)||'Banco';
      XLSX.utils.book_append_sheet(wb,ws,safeName);
    });

    const summaryRows=[
      ['Extrato — Livro-Caixa'],
      ['Período',`${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`],
      [],
      ['Banco','Saldo Inicial','Saldo Final']
    ];
    grouped.forEach(g=>summaryRows.push([g.bank.name,g.initialBalance,g.finalBalance]));
    summaryRows.push([],['Saldo Inicial Total',totalInitial],['Saldo Final Total',totalFinal]);
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols']=[{wch:30},{wch:18},{wch:18}];
    // Currency format for summary
    for(let r=5;r<=summaryRows.length;r++){
      ['B','C'].forEach(col=>{
        const cell = summaryWs[`${col}${r}`];
        if(cell && cell.v!==null) { cell.t='n'; cell.z='#,##0.00'; }
      });
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summaryRows),'Resumo');

    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    if (pocketsBlock.length) {
      const rows = [['2. Caixinhas'], []];
      pocketsBlock.forEach(p => {
        rows.push([p.name, p.goal ? `Objetivo: ${p.goal}` : '', `Saldo inicial: ${p.initial}`, `Saldo atual: ${p.current}`]);
        rows.push(['Data', 'Tipo', 'Valor', 'Observação']);
        p.movements.forEach(m => rows.push([m.date.split('-').reverse().join('/'), m.kind, m.amount, m.desc || '']));
        rows.push([]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:22},{wch:20},{wch:14},{wch:30}];
      XLSX.utils.book_append_sheet(wb, ws, 'Caixinhas');
    }

    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    if (investBlock.length) {
      const rows = [['3. Investimentos'], []];
      investBlock.forEach(inv => {
        rows.push([`${inv.name}${inv.alias ? ' (' + inv.alias + ')' : ''}`, `Tipo: ${inv.type}`, inv.units ? `Quantidade: ${inv.units}` : '', inv.price ? `Cotação: ${inv.price}` : '', `Valor atual: ${inv.currentValue}`]);
        rows.push(['Data', 'Tipo', 'Valor', 'Quantidade']);
        inv.movements.forEach(m => rows.push([m.date.split('-').reverse().join('/'), m.kind, m.amount, m.units || '']));
        rows.push([]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:26},{wch:18},{wch:16},{wch:16},{wch:16}];
      XLSX.utils.book_append_sheet(wb, ws, 'Investimentos');
    }

    const patrimony = getPatrimonySummaryBlock();
    const patrimonyRows = [['4. Resumo Patrimonial'], [], ['Total em contas', patrimony.bankTotal], ['Total em Caixinhas', patrimony.pocketTotal], ['Total investido', patrimony.investTotal], [], ['Patrimônio Total', patrimony.total]];
    const wsPatrimony = XLSX.utils.aoa_to_sheet(patrimonyRows);
    wsPatrimony['!cols']=[{wch:30},{wch:20}];
    // Currency format
    for(let r=4;r<=patrimonyRows.length;r++){
      const cell = wsPatrimony[`B${r}`];
      if(cell && cell.v!==null) { cell.t='n'; cell.z='#,##0.00'; }
    }
    XLSX.utils.book_append_sheet(wb, wsPatrimony, 'Patrimônio');

    XLSX.writeFile(wb,`livro-caixa-extrato-${todayISO()}.xlsx`);
    logInfo('Exportação','Exportação Excel','Sucesso','Extrato Excel completo gerado (4 blocos).',{dateStart:meta.dateStart,dateEnd:meta.dateEnd});
  }
  async function exportExtractDocx() {
    if (!window.docx) { alert('A biblioteca Word ainda está carregando.'); return; }
    const exportCols = EXPORT_COLUMN_DEFS;
    const hasCol = key => exportCols.some(c => c.key === key);
    const grouped = getOrganizedExportData();
    const meta = getExportMeta();
    const d = window.docx;
    const initial = grouped.reduce((sum, group) => sum + group.initialBalance, 0);
    const final = grouped.reduce((sum, group) => sum + group.finalBalance, 0);
    const children = [
      new d.Paragraph({ text: 'Livro-Caixa — Extrato', heading: d.HeadingLevel.TITLE }),
      new d.Paragraph(`Período: ${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`),
      new d.Paragraph(`Saldo Inicial: ${fmt(initial)}   |   Saldo Final: ${fmt(final)}`),
      new d.Paragraph({ text: '', spacing: { after: 200 } })
    ];

    const detailLine = (label, value, color = '1C2B24') => new d.Paragraph({
      spacing: { after: 40 },
      children: [
        new d.TextRun({ text: label, bold: true }),
        new d.TextRun({ text: String(value || '—'), color })
      ]
    });

    const moneyColor = (val) => val >= 0 ? '2F6F4F' : 'B44D3A';
    const moneySign = (val) => val >= 0 ? '+' : '−';

    grouped.forEach(group => {
      children.push(
        new d.Paragraph({ text: group.bank.name, heading: d.HeadingLevel.HEADING_1 }),
        new d.Paragraph(`Saldo inicial: ${fmt(group.initialBalance)} · Saldo final: ${fmt(group.finalBalance)}`),
        new d.Paragraph({ text: '', spacing: { after: 100 } })
      );
      let running = group.initialBalance;
      group.entries.forEach(entry => {
        const category = categories.find(c => c.id === entry.category);
        running += entry.type === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0);
        const date = entry.date.split('-').reverse().join('/');
        const movement = `${entry.type === 'in' ? '+' : '−'} ${fmt(Math.abs(entry.amount))}`;
        const movementColor = entry.type === 'in' ? '2F6F4F' : 'B44D3A';
        const entryChildren = [];
        const title = [hasCol('date') ? date : '', hasCol('desc') ? (entry.desc || 'Lançamento') : ''].filter(Boolean).join(' — ');
        if (title) {
          entryChildren.push(new d.Paragraph({
            spacing: { before: 120, after: 60 },
            children: [new d.TextRun({ text: title, bold: true, size: 24 })]
          }));
        }
        if (hasCol('cat')) entryChildren.push(detailLine('Categoria: ', category ? category.name : '—'));
        if (hasCol('in') || hasCol('out')) entryChildren.push(detailLine('Movimentação: ', movement, movementColor));
        if (hasCol('balance')) entryChildren.push(detailLine('Saldo após o lançamento: ', fmt(running)));
        entryChildren.push(new d.Paragraph({ text: '', spacing: { after: 60 } }));
        children.push(...entryChildren);
      });
    });

    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    if (pocketsBlock.length) {
      children.push(new d.Paragraph({ text: '2. Caixinhas', heading: d.HeadingLevel.TITLE, pageBreakBefore: true }));
      pocketsBlock.forEach(p => {
        children.push(
          new d.Paragraph({ text: p.name, heading: d.HeadingLevel.HEADING_1 }),
          detailLine('Objetivo: ', p.goal || 'Não definido'),
          detailLine('Saldo inicial: ', fmt(p.initial)),
          detailLine('Saldo atual: ', fmt(p.current))
        );
        p.movements.forEach(m => children.push(new d.Paragraph({ text: `${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmt(m.amount)}${m.desc ? ' (' + m.desc + ')' : ''}`, spacing: { after: 40 } })));
      });
    }

    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    if (investBlock.length) {
      children.push(new d.Paragraph({ text: '3. Investimentos', heading: d.HeadingLevel.TITLE, pageBreakBefore: true }));
      investBlock.forEach(inv => {
        children.push(
          new d.Paragraph({ text: `${inv.name}${inv.alias ? ' (' + inv.alias + ')' : ''}`, heading: d.HeadingLevel.HEADING_1 }),
          detailLine('Tipo: ', inv.type),
          detailLine('Quantidade: ', inv.units || '—'),
          detailLine('Cotação atual: ', inv.price ? fmt(inv.price) : '—'),
          detailLine('Valor atual: ', fmt(inv.currentValue))
        );
        inv.movements.forEach(m => children.push(new d.Paragraph({ text: `${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmtPrecise(m.amount)}${m.units ? ` · ${m.units}` : ''}`, spacing: { after: 40 } })));
      });
    }

    const patrimony = getPatrimonySummaryBlock();
    children.push(
      new d.Paragraph({ text: '4. Resumo Patrimonial', heading: d.HeadingLevel.TITLE, pageBreakBefore: true }),
      detailLine('Total em contas: ', fmt(patrimony.bankTotal)),
      detailLine('Total em Caixinhas: ', fmt(patrimony.pocketTotal)),
      detailLine('Total investido: ', fmt(patrimony.investTotal)),
      new d.Paragraph({ spacing: { before: 120 }, children: [new d.TextRun({ text: `Patrimônio Total: ${fmt(patrimony.total)}`, bold: true, size: 28 })] })
    );

    const blob = await d.Packer.toBlob(new d.Document({ sections: [{ children }] }));
    downloadBlob(blob, `livro-caixa-extrato-${todayISO()}.docx`);
    logInfo('Exportação', 'Exportação DOCX', 'Sucesso', 'Extrato Word completo gerado (4 blocos).', { dateStart: meta.dateStart, dateEnd: meta.dateEnd, layout: 'vertical-mobile' });
  }
  function extractPdfPageLines(content) {
    const groups = [];
    content.items.filter(item => String(item.str || '').trim()).forEach(item => {
      const y = Number(item.transform?.[5] || 0);
      const x = Number(item.transform?.[4] || 0);
      let group = groups.find(current => Math.abs(current.y - y) < 3);
      if (!group) { group = { y, items: [] }; groups.push(group); }
      group.items.push({ x, text: String(item.str).trim() });
    });
    return groups.sort((a, b) => b.y - a.y).map(group => group.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')).filter(Boolean).join('\n');
  }

  let IMPORT_MAX_TEXT_LENGTH;

  let IMPORT_MAX_ROWS;

  function isValidImportDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function normalizeImportDescription(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Lançamento importado';
  }
  function normalizeImportToken(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function findImportMatch(raw, items) {
    const token = normalizeImportToken(raw);
    if (!token) return { id: '', confidence: 0, raw: String(raw || '').trim() };
    const exact = (items || []).find(item => normalizeImportToken(item.name) === token);
    if (exact) return { id: exact.id, confidence: 1, raw: String(raw || '').trim(), name: exact.name };
    const partial = (items || []).map(item => ({ item, key: normalizeImportToken(item.name) })).filter(x => x.key && (x.key.includes(token) || token.includes(x.key) || token.split(' ').some(part => part.length > 3 && x.key.split(' ').includes(part)))).sort((a, b) => b.key.length - a.key.length)[0];
    if (partial) return { id: partial.item.id, confidence: 0.7, raw: String(raw || '').trim(), name: partial.item.name };
    return { id: '', confidence: 0, raw: String(raw || '').trim() };
  }
  function importSignature(row) {
    const descriptionKey = normalizeImportDescription(row.desc).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
    return [row.date, String(row.bank || ''), String(row.type || ''), Number(row.amount || 0).toFixed(2), descriptionKey].join('|');
  }
  function isValidImportRow(row) {
    return Boolean(row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) && isValidImportDate(row.date) && Number(row.amount) > 0 && (row.type === 'in' || row.type === 'out') && row.bank && (!row.category || categories.some(c => c.id === row.category)));
  }
  function refreshImportFlags() {
    const existing = new Set(entries.map(importSignature));
    const seen = new Set();
    pendingImport.forEach(row => {
      row.valid = isValidImportRow(row);
      const signature = importSignature(row);
      row.duplicate = existing.has(signature) || seen.has(signature);
      seen.add(signature);
    });
  }

  function parseClosingImportText(text, source) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean);
    const rows = [];
    const dateRe = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const amountRe = /^[+\-−]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/;
    const makeInvalid = (line, reason) => ({ date:'', desc:'', amount:0, type:'out', bank:'', category:'', rawBank:'', rawCategory:'', matchStatus:`Linha inválida: ${reason}`, balance:null, source, valid:false, duplicate:false, rawLine:line });
    const parseAmountStrict = value => {
      const raw=String(value||'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
      if(!amountRe.test(raw)) return NaN;
      const sign=(raw.startsWith('-')||raw.startsWith('−'))?-1:1;
      const n=Number(raw.replace(/^[+\-−]/,'').replace(/\./g,'').replace(',','.'));
      return Number.isFinite(n)&&n>0 ? sign*n : NaN;
    };
    lines.forEach(line=>{
      const structure=line.match(/^(\d{2}\/\d{2}\/\d{4})\s*\/\s*(.*)$/);
      const fields=structure ? [structure[1], ...structure[2].split('/').map(v=>v.trim())] : [];
      if(fields.length<3 || fields.length>5){ rows.push(makeInvalid(line,'use DATA / VALOR / BANCO / CATEGORIA / OBSERVAÇÃO; categoria e observação são opcionais')); return; }
      const [dateRaw,amountRaw,bankRaw,categoryRaw='',...obsParts]=fields; const obs=obsParts.join(' / ').trim();
      const dm=dateRaw.match(dateRe); if(!dm){rows.push(makeInvalid(line,'data deve estar no formato DD/MM/AAAA'));return;}
      const date=`${dm[3]}-${dm[2]}-${dm[1]}`; if(!isValidImportDate(date)){rows.push(makeInvalid(line,'data inválida'));return;}
      const amount=parseAmountStrict(amountRaw); if(!Number.isFinite(amount)){rows.push(makeInvalid(line,'valor inválido'));return;}
      const bankMatch=findImportMatch(bankRaw,banks); if(!bankMatch.id){rows.push({...makeInvalid(line,`banco não reconhecido: ${bankRaw||'(vazio)'}`),rawBank:bankRaw});return;}
      let categoryId='';
      if(categoryRaw){const cm=findImportMatch(categoryRaw,categories);if(!cm.id){rows.push({...makeInvalid(line,`categoria não reconhecida: ${categoryRaw}`),bank:bankMatch.id,rawBank:bankRaw,rawCategory:categoryRaw});return;}categoryId=cm.id;}
      rows.push({date,desc:obs,amount:Math.abs(amount),type:amount>=0?'in':'out',bank:bankMatch.id,category:categoryId,rawBank:bankRaw,rawCategory:categoryRaw,matchStatus:`Banco reconhecido${categoryRaw?' · Categoria reconhecida':' · Categoria opcional'}`,balance:null,source,valid:true,duplicate:false,rawLine:line});
    });
    return rows;
  }
  function parseImportedText(text, source = 'Importação') {
    const normalizedText = String(text || '').replace(/\r/g, '\n').replace(/\u00A0/g, ' ').trim();
    if (!normalizedText) { alert('Não encontrei texto para importar.'); return false; }
    if (normalizedText.length > IMPORT_MAX_TEXT_LENGTH) { alert('O conteúdo é muito extenso. Importe um trecho menor, de até 120 mil caracteres.'); return false; }
    const rows = applySimpleAutoCategorization(parseClosingImportText(normalizedText, source)).slice(0, IMPORT_MAX_ROWS);
    if (!rows.length) { alert('Não encontrei lançamentos estruturados. Use o texto do fechamento com data, descrição, categoria e valor.'); return false; }
    pendingImport = rows;
    pendingImportSource = source;
    refreshImportFlags();
    renderImportReview();
    openModal('panelImport');
    return true;
  }

  function renderImportReview() {
    refreshImportFlags();
    const ready = pendingImport.filter(row => row.valid && !row.duplicate).length;
    const duplicates = pendingImport.filter(row => row.duplicate).length;
    const invalid = pendingImport.filter(row => !row.valid).length;
    document.getElementById('importSummary').innerHTML = `<b>${escapeHTML(pendingImportSource || 'Importação')}</b> · ${pendingImport.length} linha(s) identificada(s) · <span class="import-ready">${ready} pronta(s)</span>${duplicates ? ` · <span class="import-warning">${duplicates} possível(is) duplicidade(s)</span>` : ''}${invalid ? ` · <span class="import-warning">${invalid} inválida(s)</span>` : ''}`;
    const list = document.getElementById('importList');
list.innerHTML = pendingImport.map((row, i) => `
      <div class="import-row ${row.duplicate ? 'is-duplicate' : ''}">
        <select aria-label="Tipo" onchange="updateImportRow(${i}, 'type', this.value)"><option value="in" ${row.type === 'in' ? 'selected' : ''}>Entrada</option><option value="out" ${row.type === 'out' ? 'selected' : ''}>Saída</option></select>
        <input type="date" value="${row.date}" aria-label="Data" placeholder="DD/MM/AAAA" onchange="updateImportRow(${i}, 'date', this.value)">
        <input type="number" step="0.01" min="0.01" value="${row.amount}" aria-label="Valor" placeholder="0,00" onchange="updateImportRow(${i}, 'amount', this.value)">
        <select aria-label="Banco" onchange="updateImportRow(${i}, 'bank', this.value)"><option value="">Banco</option>${banks.map(b => `<option value="${b.id}" ${b.id === row.bank ? 'selected' : ''}>${escapeHTML(b.name)}</option>`).join('')}</select>
        <select aria-label="Categoria" onchange="updateImportRow(${i}, 'category', this.value)"><option value="">Categoria</option>${categories.map(c => `<option value="${c.id}" ${c.id === row.category ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}</select>
        <input type="text" value="${escapeHTML(row.desc)}" aria-label="Descrição" placeholder="Descrição" onchange="updateImportRow(${i}, 'desc', this.value)">
        <button class="action-btn del" onclick="removeImportRow(${i})" aria-label="Remover linha ${i + 1}">×</button>
        <div class="import-status">${row.duplicate ? 'Possível duplicidade: esta linha será ignorada até que você a edite ou remova.' : (row.valid ? `${escapeHTML(row.matchStatus || 'Banco e categoria conferidos.')}. Pronta para importar.` : `${escapeHTML(row.matchStatus || 'Revise banco, categoria, data, descrição e valor.')}. Corrija antes de confirmar.`)}</div>
      </div>
    `).join('');
    const confirm = document.getElementById('importConfirm');
    confirm.disabled = ready === 0;
    confirm.textContent = ready ? `Confirmar ${ready} lançamento(s)` : 'Nenhum lançamento válido';

    const btnRemoveDup = document.getElementById('importRemoveDuplicates');
    const btnRemoveInv = document.getElementById('importRemoveInvalid');
    if (btnRemoveDup) btnRemoveDup.disabled = duplicates === 0;
    if (btnRemoveInv) btnRemoveInv.disabled = invalid === 0;

    // Focus first invalid/editable field when modal opens
    setTimeout(() => {
      const firstInvalid = document.querySelector('.import-row:not(.is-duplicate) input, .import-row:not(.is-duplicate) select');
      if (firstInvalid) firstInvalid.focus();
    }, 50);
  }
