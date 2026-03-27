import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, FileText, TrendingUp, Users, Search, CalendarDays, 
  Loader2, Database, Printer, Filter, CreditCard, CheckCircle, 
  CheckSquare, Square, Calculator
} from 'lucide-react';

function App() {
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [carregandoTela, setCarregandoTela] = useState(false);
  const [menuAtivo, setMenuAtivo] = useState('contas-pagar');

  const [contasBrutas, setContasBrutas] = useState([]);
  
  const [contaFiltro, setContaFiltro] = useState('TODAS');
  const [clienteFiltro, setClienteFiltro] = useState('');
  
  const [listaBancos, setListaBancos] = useState([]);
  const [selecionados, setSelecionados] = useState([]); 
  const [modalBaixa, setModalBaixa] = useState({ aberto: false, cliente: '', contas: [] });
  const [contaDestino, setContaDestino] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  
  const [descontoTipo, setDescontoTipo] = useState('VALOR');
  const [descontoValor, setDescontoValor] = useState('');
  const [jurosTipo, setJurosTipo] = useState('VALOR');
  const [jurosValor, setJurosValor] = useState('');
  
  const [processandoBaixa, setProcessandoBaixa] = useState(false);
  const [reciboGerado, setReciboGerado] = useState(null);

  const agruparDadosPorData = (contas, tipoRelatorio) => {
    const campoData = tipoRelatorio === 'contas-pagas' ? 'data_pagamento_br' : 'data_previsao_br';
    const campoValor = tipoRelatorio === 'contas-pagas' ? 'valor_pago' : 'saldo_devedor';
    
    const datasUnicas = [...new Set(contas.map(c => c[campoData]))];
    return datasUnicas.map(data => {
      const contasDoDia = contas.filter(c => c[campoData] === data);
      const subtotal = contasDoDia.reduce((acc, c) => acc + c[campoValor], 0);
      return { dataReferencia: data, contas: contasDoDia, subtotal };
    });
  };

  const agruparPorCategoria = (contas, tipoRelatorio) => {
    const campoValor = tipoRelatorio === 'contas-pagas' ? 'valor_pago' : 'saldo_devedor';
    const resumo = contas.reduce((acc, conta) => {
      const cat = conta.desc_categoria || 'Sem Categoria';
      if (!acc[cat]) acc[cat] = { total: 0, contasCorrentes: {} };
      acc[cat].total += conta[campoValor];
      if (tipoRelatorio === 'contas-pagas' || tipoRelatorio === 'recebimentos') {
        const cc = conta.conta_corrente || 'Conta Não Identificada';
        if (!acc[cat].contasCorrentes[cc]) acc[cat].contasCorrentes[cc] = 0;
        acc[cat].contasCorrentes[cc] += conta[campoValor];
      }
      return acc;
    }, {});

    return Object.entries(resumo)
      .map(([categoria, dados]) => ({ 
        categoria, total: dados.total,
        contasCorrentes: Object.entries(dados.contasCorrentes).map(([cc, valor]) => ({cc, valor})).sort((a,b) => b.valor - a.valor)
      })).sort((a, b) => b.total - a.total);
  };

  const handleBuscarDados = async () => {
    if (menuAtivo !== 'recebimentos' && (!dataInicial || !dataFinal)) {
      alert("Por favor, selecione a Data Inicial e a Data Final.");
      return;
    }
    setCarregandoTela(true);
    setContaFiltro('TODAS'); 
    setClienteFiltro('');
    setSelecionados([]); 
    try {
      const endpoint = menuAtivo === 'contas-pagas' ? 'contas-pagas' : menuAtivo === 'recebimentos' ? 'recebimentos' : 'contas-a-pagar';
      const url = menuAtivo === 'recebimentos' 
        ? `http://localhost:8000/api/relatorios/recebimentos/dados` 
        : `http://localhost:8000/api/relatorios/${endpoint}/dados?data_inicio=${dataInicial}&data_fim=${dataFinal}`;
      
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error("Erro de comunicação com o servidor.");
      const dados = await resposta.json();
      setContasBrutas(dados.contas || []);

      if (menuAtivo === 'recebimentos' && listaBancos.length === 0) {
        fetch('http://localhost:8000/api/geral/bancos')
          .then(res => res.json())
          .then(data => setListaBancos(data))
          .catch(e => console.error(e));
      }
    } catch (erro) {
      alert(`Erro: ${erro.message}`);
    } finally {
      setCarregandoTela(false);
    }
  }

  const toggleSelecao = (conta) => {
    setSelecionados(prev => {
      const existe = prev.find(c => c.codigo_lancamento === conta.codigo_lancamento);
      if (existe) return prev.filter(c => c.codigo_lancamento !== conta.codigo_lancamento);
      return [...prev, conta];
    });
  };

  const toggleTodosCliente = (contasCliente) => {
    const todosSelecionados = contasCliente.every(c => selecionados.find(s => s.codigo_lancamento === c.codigo_lancamento));
    if (todosSelecionados) {
      setSelecionados(prev => prev.filter(s => !contasCliente.find(c => c.codigo_lancamento === s.codigo_lancamento)));
    } else {
      const novos = contasCliente.filter(c => !selecionados.find(s => s.codigo_lancamento === c.codigo_lancamento));
      setSelecionados(prev => [...prev, ...novos]);
    }
  };

  const abrirModalLote = (cliente, contas) => {
    const selecionadasDoCliente = contas.filter(c => selecionados.find(s => s.codigo_lancamento === c.codigo_lancamento));
    if (selecionadasDoCliente.length === 0) {
      alert("Selecione pelo menos uma nota deste cliente para receber!");
      return;
    }
    setDescontoValor(''); setJurosValor('');
    setDescontoTipo('VALOR'); setJurosTipo('VALOR');
    setDataPagamento(new Date().toISOString().split('T')[0]); 
    setModalBaixa({ aberto: true, cliente: cliente, contas: selecionadasDoCliente });
  };

  const calcularRateio = () => {
    const totalOriginal = modalBaixa.contas.reduce((acc, c) => acc + c.saldo_devedor, 0);
    let dVal = descontoTipo === 'VALOR' ? parseFloat(descontoValor || 0) : totalOriginal * (parseFloat(descontoValor || 0) / 100);
    let jVal = jurosTipo === 'VALOR' ? parseFloat(jurosValor || 0) : totalOriginal * (parseFloat(jurosValor || 0) / 100);
    if (dVal > totalOriginal) dVal = totalOriginal; 

    const pagamentosTratados = modalBaixa.contas.map(c => {
      const peso = c.saldo_devedor / totalOriginal;
      const descProporcional = Number((dVal * peso).toFixed(2));
      const jurosProporcional = Number((jVal * peso).toFixed(2));
      const valorPagar = Number((c.saldo_devedor - descProporcional + jurosProporcional).toFixed(2));
      
      return {
        codigo_lancamento: c.codigo_lancamento,
        valor: valorPagar,
        desconto: descProporcional,
        juros: jurosProporcional,
        contaOriginal: c
      };
    });
    const totalAposRateio = pagamentosTratados.reduce((acc, p) => acc + p.valor, 0);
    return { pagamentos: pagamentosTratados, totalOriginal, totalFinal: totalAposRateio, dVal, jVal };
  };

  const handleEfetuarBaixaLote = async () => {
    setProcessandoBaixa(true);
    try {
      const { pagamentos, totalOriginal, totalFinal, dVal, jVal } = calcularRateio();
      const [ano, mes, dia] = dataPagamento.split('-');
      
      const payload = {
        id_conta_corrente: parseInt(contaDestino),
        data_pagamento: `${dia}/${mes}/${ano}`,
        pagamentos: pagamentos.map(p => ({
          codigo_lancamento: p.codigo_lancamento,
          valor: p.valor,
          desconto: p.desconto,
          juros: p.juros
        }))
      };

      const res = await fetch('http://localhost:8000/api/relatorios/recebimentos/baixar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro no rateio de notas.");
      
      const bancoSelecionado = listaBancos.find(b => b.id === contaDestino)?.nome;
      
      setReciboGerado({
        cliente: modalBaixa.cliente,
        banco: bancoSelecionado,
        data_pagamento: `${dia}/${mes}/${ano}`,
        totalOriginal, totalDesconto: dVal, totalJuros: jVal, totalPago: totalFinal,
        notas: pagamentos
      });
      
      setModalBaixa({aberto: false, cliente: '', contas: []});
      handleBuscarDados(); 
    } catch (e) {
      alert("Erro ao receber lote: " + e.message);
    } finally {
      setProcessandoBaixa(false);
    }
  }

  const contasFiltradas = useMemo(() => {
    let filtrado = contasBrutas;
    if (contaFiltro !== 'TODAS') {
      filtrado = filtrado.filter(c => c.conta_corrente === contaFiltro);
    }
    if (clienteFiltro.trim() !== '') {
      const termo = clienteFiltro.toLowerCase();
      filtrado = filtrado.filter(c => 
        (c.nome_cliente && c.nome_cliente.toLowerCase().includes(termo)) ||
        (c.nome_fornecedor && c.nome_fornecedor.toLowerCase().includes(termo)) ||
        (c.numero_documento_fiscal && c.numero_documento_fiscal.toLowerCase().includes(termo))
      );
    }
    return filtrado;
  }, [contasBrutas, contaFiltro, clienteFiltro]);

  const dadosAgrupados = useMemo(() => {
    if (menuAtivo === 'recebimentos') {
       const clientesUnicos = [...new Set(contasFiltradas.map(c => c.nome_cliente))];
       return clientesUnicos.map(cli => {
          const contasDoCli = contasFiltradas.filter(c => c.nome_cliente === cli);
          const subtotal = contasDoCli.reduce((acc, c) => acc + c.saldo_devedor, 0);
          return { dataReferencia: cli, contas: contasDoCli, subtotal };
       }).sort((a,b) => b.subtotal - a.subtotal); 
    }
    return agruparDadosPorData(contasFiltradas, menuAtivo);
  }, [contasFiltradas, menuAtivo]);

  const resumoCategorias = useMemo(() => agruparPorCategoria(contasFiltradas, menuAtivo), [contasFiltradas, menuAtivo]);
  
  const totalGeral = useMemo(() => contasFiltradas.reduce((acc, c) => acc + (menuAtivo === 'contas-pagas' ? c.valor_pago : c.saldo_devedor), 0), [contasFiltradas, menuAtivo]);
  
  const contasCorrentesDisponiveis = useMemo(() => {
    if (menuAtivo === 'contas-a-pagar') return [];
    return [...new Set(contasBrutas.map(c => c.conta_corrente))].sort();
  }, [contasBrutas, menuAtivo]);

  const tituloModulo = menuAtivo === 'contas-pagas' ? 'Módulo de Contas Pagas' : menuAtivo === 'recebimentos' ? 'Crediário e Fiado' : 'Módulo de Contas a Pagar';
  const descModulo = menuAtivo === 'contas-pagas' ? 'Sincronize as baixas realizadas e concilie contas correntes.' : menuAtivo === 'recebimentos' ? 'Acompanhe faturas, aplique descontos proporcionais e gere recibos em lote.' : 'Sincronize os dados e imprima o relatório detalhado.';
  const tituloRelatorio = menuAtivo === 'contas-pagas' ? 'Pagamentos Realizados' : menuAtivo === 'recebimentos' ? 'Títulos a Receber' : 'Previsão de Pagamentos';

  const SidebarItem = ({ id, icone: Icon, texto }) => (
    <button onClick={() => { setMenuAtivo(id); setContasBrutas([]); setSelecionados([]); setClienteFiltro(''); setContaFiltro('TODAS'); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 print:hidden ${
        menuAtivo === id ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}>
      <Icon size={20} className={menuAtivo === id ? 'text-indigo-400' : ''} />
      <span className="font-medium text-left text-sm">{texto}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden print:!block print:bg-white print:text-slate-900 print:!h-auto print:!overflow-visible">
      
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm 15mm; }
          html, body, #root, main, div[class*="bg-slate"] { background-color: transparent !important; background-image: none !important; }
          * { animation: none !important; transition: none !important; transform: none !important; backdrop-filter: none !important; filter: none !important; }
          html, body, #root, main { display: block !important; height: auto !important; min-height: auto !important; overflow: visible !important; position: static !important; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-bottom: 20px; }
          tbody { display: table-row-group; }
          tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
          thead { display: table-header-group; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-20 print:hidden">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">GabaritoBI</h1>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Relatórios</p>
          <SidebarItem id="dashboard" icone={LayoutDashboard} texto="Visão Geral" />
          <SidebarItem id="contas-pagar" icone={FileText} texto="Contas a Pagar (Previsão)" />
          <SidebarItem id="contas-pagas" icone={Database} texto="Contas Pagas (Realizado)" />
          <SidebarItem id="recebimentos" icone={CreditCard} texto="Contas a Receber (Fiado)" />
          <SidebarItem id="vendas" icone={TrendingUp} texto="Análise de Vendas" />
        </nav>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className={`flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden print:!block print:!h-auto print:!overflow-visible ${reciboGerado ? 'print:hidden' : ''}`}>
        
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0 print:hidden"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none z-0 print:hidden"></div>

        <header className="h-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-50 sticky top-0 print:hidden">
          <div className="flex items-center bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2 w-96">
            <Search size={18} className="text-slate-400" />
            <input type="text" placeholder="Buscar no sistema..." className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-200" />
          </div>
          <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
            <p className="text-sm font-medium text-slate-200 hidden md:block">Admin Financeiro</p>
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600"><Users size={20} className="text-slate-300" /></div>
          </div>
        </header>

        <div className="flex-1 p-8 z-10 print:!p-0 print:!m-0 print:!block print:!overflow-visible">
          
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 print:hidden">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{tituloModulo}</h2>
              <p className="text-slate-400">{descModulo}</p>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
              {menuAtivo !== 'recebimentos' && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="text-indigo-400 hidden sm:block" size={20} />
                  <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 text-sm [color-scheme:dark]" />
                  <span className="text-slate-500 text-sm font-medium">até</span>
                  <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 text-sm [color-scheme:dark]" />
                </div>
              )}

              <button onClick={handleBuscarDados} disabled={carregandoTela} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50">
                {carregandoTela ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
                SINCRONIZAR DADOS
              </button>
            </div>
          </div>

          <div className="hidden print:flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <TrendingUp size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">GabaritoBI</h1>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inteligência Financeira</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-slate-800 uppercase">{tituloRelatorio}</h2>
              {menuAtivo !== 'recebimentos' && <p className="text-sm font-medium text-slate-600 mt-1">Período: {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}</p>}
            </div>
          </div>

          {!carregandoTela && contasBrutas.length > 0 && (
            <div className="animate-[fadeIn_0.5s_ease-out] print:!block">
              
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-10 gap-4 print:hidden">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-emerald-400 font-bold text-lg xl:text-xl">Global a {menuAtivo === 'recebimentos' ? 'Receber' : 'Pagar'}: R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2">
                    <Search size={16} className="text-indigo-400" />
                    <input 
                      type="text" 
                      placeholder={menuAtivo === 'recebimentos' ? "Filtrar cliente/nota..." : "Filtrar fornecedor..."}
                      value={clienteFiltro}
                      onChange={(e) => setClienteFiltro(e.target.value)}
                      className="bg-transparent text-slate-200 text-sm font-medium focus:outline-none placeholder-slate-500 w-40"
                    />
                  </div>

                  {(menuAtivo === 'contas-pagas' || menuAtivo === 'recebimentos') && contasCorrentesDisponiveis.length > 0 && (
                    <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2">
                      <Filter size={16} className="text-indigo-400" />
                      <select 
                        value={contaFiltro} 
                        onChange={(e) => setContaFiltro(e.target.value)}
                        className="bg-transparent text-slate-200 text-sm font-medium focus:outline-none appearance-none pr-4"
                      >
                        <option value="TODAS">Todas as Contas</option>
                        {contasCorrentesDisponiveis.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 text-slate-300 hover:text-white px-6 py-3 rounded-xl font-bold group border border-slate-700">
                  <Printer size={18} className="group-hover:scale-110 transition-transform" /> IMPRIMIR
                </button>
              </div>

              {contasFiltradas.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/30 border border-dashed border-slate-700 rounded-2xl print:hidden">
                  <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 font-medium">Nenhum registo encontrado para o filtro atual.</p>
                </div>
              ) : (
                <>
                  {menuAtivo === 'recebimentos' ? (
                    <div className="space-y-8">
                      {dadosAgrupados.map((grupo, gIdx) => {
                        const selecionadasDoCliente = grupo.contas.filter(c => selecionados.find(s => s.codigo_lancamento === c.codigo_lancamento));
                        const totalSelecionado = selecionadasDoCliente.reduce((acc, c) => acc + c.saldo_devedor, 0);
                        const todasSelecionadas = grupo.contas.every(c => selecionados.find(s => s.codigo_lancamento === c.codigo_lancamento));

                        return (
                          <div key={gIdx} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden print:border-slate-300 print:bg-white print:break-inside-avoid shadow-lg relative z-10">
                            
                            <div className="bg-slate-900/50 p-6 border-b border-white/[0.05] flex justify-between items-center print:bg-slate-100 print:border-slate-300">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl print:border print:border-slate-400">
                                  {grupo.dataReferencia.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-white print:text-slate-900">{grupo.dataReferencia}</h3>
                                  <p className="text-slate-400 text-sm font-medium print:text-slate-600">{grupo.contas.length} títulos em aberto</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-400 uppercase font-bold print:text-slate-600">Total Devido</p>
                                <p className="text-2xl font-black text-emerald-400 print:text-slate-900">R$ {grupo.subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                              </div>
                            </div>

                            <div className="overflow-x-auto print:overflow-visible">
                              <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                  <tr className="bg-slate-800/30 text-slate-300 print:bg-slate-50 print:text-slate-900 text-xs font-bold border-b border-slate-700/50 print:border-slate-300">
                                    <th className="py-3 px-5 print:hidden w-10">
                                      <button onClick={() => toggleTodosCliente(grupo.contas)} className="text-slate-400 hover:text-indigo-400">
                                        {todasSelecionadas ? <CheckSquare size={18} className="text-indigo-400" /> : <Square size={18} />}
                                      </button>
                                    </th>
                                    <th className="py-3 px-5">Emissão</th>
                                    <th className="py-3 px-5 text-indigo-300">Hora</th>
                                    <th className="py-3 px-5">Vencimento</th>
                                    <th className="py-3 px-5">Nota / Parcela</th>
                                    <th className="py-3 px-5">Conta Corrente</th>
                                    <th className="py-3 px-5 text-right">Valor</th>
                                  </tr>
                                </thead>
                                <tbody className="text-sm">
                                  {grupo.contas.map(conta => {
                                    const taSelecionado = selecionados.find(s => s.codigo_lancamento === conta.codigo_lancamento);
                                    return (
                                      <tr key={conta.codigo_lancamento} className={`border-b border-slate-700/30 print:border-slate-300 ${taSelecionado ? 'bg-indigo-500/5' : 'hover:bg-slate-800/40'} transition-colors`}>
                                        <td className="py-3 px-5 print:hidden cursor-pointer" onClick={() => toggleSelecao(conta)}>
                                          {taSelecionado ? <CheckSquare size={18} className="text-indigo-400" /> : <Square size={18} className="text-slate-500" />}
                                        </td>
                                        <td className="py-3 px-5 text-slate-300 print:text-slate-800">{conta.data_emissao}</td>
                                        
                                        {/* NOVA CÉLULA EXIBINDO A HORA COM FONTE MONOESPAÇADA E COR DESTACADA */}
                                        <td className="py-3 px-5 font-mono text-xs text-indigo-400 print:text-slate-600">{conta.hora_emissao}</td> 
                                        
                                        <td className="py-3 px-5 text-slate-300 print:text-slate-800">{conta.data_previsao_br}</td>
                                        <td className="py-3 px-5 text-slate-300 print:text-slate-800">{conta.numero_documento_fiscal} - {conta.numero_parcela}</td>
                                        <td className="py-3 px-5 text-slate-400 print:text-slate-600">{conta.conta_corrente}</td>
                                        <td className="py-3 px-5 text-right font-medium text-slate-200 print:text-slate-900">
                                          R$ {conta.saldo_devedor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="p-4 bg-slate-900/80 border-t border-slate-700/50 flex justify-between items-center print:hidden">
                              <span className="text-sm font-medium text-slate-400">
                                {selecionadasDoCliente.length} nota(s) selecionada(s)
                              </span>
                              <button 
                                onClick={() => abrirModalLote(grupo.dataReferencia, grupo.contas)}
                                disabled={selecionadasDoCliente.length === 0}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
                              >
                                <Calculator size={18} /> RECEBER R$ {totalSelecionado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] print:bg-transparent backdrop-blur-2xl border border-white/[0.05] print:border-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-2xl p-8 print:!p-0 print:shadow-none relative z-10">
                      
                      {/* BLOCO 1: RESUMO POR CATEGORIA (RESTAURADO) */}
                      <div className="mb-12 print:mb-8">
                        <h4 className="text-lg font-bold text-indigo-400 print:text-slate-900 uppercase tracking-wider mb-4">
                          Resumo por Categoria de Despesa
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-700/50 print:border-none print:overflow-visible shadow-lg shadow-black/20 print:shadow-none">
                          <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-900/80 print:bg-slate-100 text-slate-300 print:text-slate-900 text-xs font-bold border-b print:border-b-2 border-slate-700/50 print:border-slate-800">
                                <th className="py-4 px-5 uppercase">Categoria {menuAtivo === 'contas-pagas' && '/ Conta Corrente'}</th>
                                <th className="py-4 px-5 text-right uppercase">Total {menuAtivo === 'contas-pagas' ? 'Pago' : 'a Pagar'}</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm">
                              {resumoCategorias.map((item, idx) => (
                                <React.Fragment key={idx}>
                                  <tr className={`group border-b border-slate-700/30 print:border-slate-300 text-slate-300 print:text-slate-800 hover:bg-slate-800/80 print:hover:bg-transparent transition-colors ${idx % 2 === 0 ? 'print:bg-white' : 'print:bg-slate-50/50'}`}>
                                    <td className="py-3 px-5 font-bold group-hover:text-indigo-300 transition-colors">{item.categoria}</td>
                                    <td className="py-3 px-5 text-right font-bold text-slate-200 print:text-slate-900 group-hover:text-white transition-colors">
                                      R$ {item.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </td>
                                  </tr>
                                  
                                  {menuAtivo === 'contas-pagas' && item.contasCorrentes.map((ccItem, ccIdx) => (
                                    <tr key={`cc-${idx}-${ccIdx}`} className="border-b border-slate-700/10 print:border-slate-200 bg-slate-900/40 print:bg-transparent">
                                      <td className="py-2 px-5 pl-12 text-slate-400 print:text-slate-600 text-xs flex items-center gap-2 border-l-2 border-indigo-500/30 ml-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 print:bg-slate-400"></div> {ccItem.cc}
                                      </td>
                                      <td className="py-2 px-5 text-right text-slate-400 print:text-slate-600 text-xs">
                                        R$ {ccItem.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                              <tr className="bg-slate-800/80 print:bg-slate-200 border-t-2 border-slate-600 print:border-b-2 print:border-slate-800">
                                <td className="py-4 px-5 text-right font-bold text-slate-300 print:text-slate-900 uppercase text-lg">
                                  Total Geral
                                </td>
                                <td className="py-4 px-5 text-right font-bold text-emerald-400 print:text-slate-900 text-lg">
                                  R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* BLOCO 2: DETALHAMENTO COM O TOTAL GERAL (RESTAURADO) */}
                      <h3 className="text-xl font-bold text-indigo-400 mb-4 print:text-slate-900 uppercase tracking-wider">Detalhamento Financeiro</h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-700/50 print:border-none print:overflow-visible shadow-lg shadow-black/20 print:shadow-none">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                          <thead>
                            <tr className="bg-slate-900/80 print:bg-slate-100 text-slate-300 print:text-slate-900 text-xs font-bold border-b print:border-b-2 border-slate-700/50 print:border-slate-800">
                              <th className="py-4 px-5 text-center">Data Emissão</th>
                              <th className="py-4 px-5">Categoria</th>
                              <th className="py-4 px-5">Fornecedor</th>
                              <th className="py-4 px-5 text-center">{menuAtivo === 'contas-pagas' ? 'Data Pagto' : 'Vencimento'}</th>
                              {menuAtivo === 'contas-pagas' && <th className="py-4 px-5">Conta Corrente</th>}
                              <th className="py-4 px-5 text-center">Nº Nota</th>
                              <th className="py-4 px-5 text-center">Parcela</th>
                              <th className="py-4 px-5 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            {dadosAgrupados.map((grupo, gIdx) => (
                              <React.Fragment key={gIdx}>
                                {grupo.contas.map((conta, cIdx) => (
                                  <tr key={`${gIdx}-${cIdx}`} className={`group border-b border-slate-700/30 print:border-slate-300 text-slate-400 print:text-slate-800 text-xs hover:bg-slate-800/80 print:hover:bg-transparent transition-colors ${cIdx % 2 === 0 ? 'print:bg-white' : 'print:bg-slate-50/50'}`}>
                                    <td className="py-3 px-5 text-center group-hover:text-slate-300 transition-colors">{conta.data_emissao}</td>
                                    <td className="py-3 px-5 truncate max-w-[200px] print:max-w-none group-hover:text-indigo-300 transition-colors">{conta.desc_categoria}</td>
                                    <td className="py-3 px-5 truncate max-w-[250px] print:max-w-none font-medium text-slate-200 print:text-slate-900 group-hover:text-white transition-colors">{conta.nome_fornecedor}</td>
                                    <td className="py-3 px-5 text-center group-hover:text-slate-300 transition-colors">{menuAtivo === 'contas-pagas' ? conta.data_pagamento_br : conta.data_previsao_br}</td>
                                    {menuAtivo === 'contas-pagas' && <td className="py-3 px-5 text-slate-300 truncate max-w-[200px] print:max-w-none">{conta.conta_corrente}</td>}
                                    <td className="py-3 px-5 text-center group-hover:text-slate-300 transition-colors">{conta.numero_documento_fiscal}</td>
                                    <td className="py-3 px-5 text-center group-hover:text-slate-300 transition-colors">{conta.numero_parcela}</td>
                                    <td className="py-3 px-5 text-right font-medium text-slate-200 print:text-slate-900 group-hover:text-emerald-400 transition-colors">
                                      R$ {(menuAtivo === 'contas-pagas' ? conta.valor_pago : conta.saldo_devedor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-800/60 print:bg-slate-200 border-b-2 border-slate-600 print:border-slate-800">
                                  <td colSpan={menuAtivo === 'contas-pagas' ? "7" : "6"} className="py-4 px-5 text-right font-bold text-slate-300 print:text-slate-900 text-xs uppercase">
                                    Total em {grupo.dataReferencia}
                                  </td>
                                  <td className="py-4 px-5 text-right font-bold text-emerald-400 print:text-slate-900">
                                    R$ {grupo.subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                  </td>
                                </tr>
                              </React.Fragment>
                            ))}
                            
                            {/* O TOTAL GERAL NA TABELA DE DETALHAMENTO RESTAURADO */}
                            <tr className="bg-indigo-900/40 print:bg-slate-200 border-t-2 border-indigo-500/30 print:border-slate-800">
                              <td colSpan={menuAtivo === 'contas-pagas' ? "7" : "6"} className="py-5 px-5 text-right font-bold text-white print:text-slate-900 text-xl uppercase tracking-wider">
                                Total Geral do Período
                              </td>
                              <td className="py-5 px-5 text-right font-black text-emerald-400 print:text-slate-950 text-2xl">
                                R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                            
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>

        {modalBaixa.aberto && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center print:hidden p-4">
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-1">Pagamento Múltiplo</h3>
              <p className="text-slate-400 mb-6">Rateio matemático para o cliente <span className="text-indigo-400 font-bold">{modalBaixa.cliente}</span></p>
              
              {(() => {
                const { totalOriginal, totalFinal } = calcularRateio();
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-sm text-slate-400 font-medium">Qtd. Notas Selecionadas</p>
                        <p className="text-xl font-bold text-white">{modalBaixa.contas.length} nota(s)</p>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-sm text-slate-400 font-medium">Subtotal Original</p>
                        <p className="text-xl font-bold text-slate-300">R$ {totalOriginal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Desconto</label>
                        <div className="flex bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
                          <select value={descontoTipo} onChange={e => setDescontoTipo(e.target.value)} className="bg-slate-700 text-white px-3 py-2 text-sm focus:outline-none border-none">
                            <option value="VALOR">R$</option>
                            <option value="PERCENTUAL">%</option>
                          </select>
                          <input type="number" min="0" placeholder="0.00" value={descontoValor} onChange={e => setDescontoValor(e.target.value)} className="w-full bg-transparent px-3 py-2 text-white outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Juros / Multa</label>
                        <div className="flex bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
                          <select value={jurosTipo} onChange={e => setJurosTipo(e.target.value)} className="bg-slate-700 text-white px-3 py-2 text-sm focus:outline-none border-none">
                            <option value="VALOR">R$</option>
                            <option value="PERCENTUAL">%</option>
                          </select>
                          <input type="number" min="0" placeholder="0.00" value={jurosValor} onChange={e => setJurosValor(e.target.value)} className="w-full bg-transparent px-3 py-2 text-white outline-none" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-900/30 p-4 rounded-xl border border-indigo-500/30 mb-6 flex justify-between items-center">
                      <p className="text-indigo-200 font-medium">Total com Rateio (A Pagar)</p>
                      <p className="text-3xl font-black text-emerald-400">R$ {totalFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Conta de Destino</label>
                        <select value={contaDestino} onChange={e => setContaDestino(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm">
                          <option value="">Selecione...</option>
                          {listaBancos.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Data</label>
                        <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm [color-scheme:dark]" />
                      </div>
                    </div>
                  </>
                )
              })()}

              <div className="flex gap-4">
                <button onClick={() => setModalBaixa({aberto: false, cliente: '', contas: []})} className="flex-1 px-4 py-3 rounded-lg font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition">Cancelar</button>
                <button onClick={handleEfetuarBaixaLote} disabled={processandoBaixa || !contaDestino || !dataPagamento} className="flex-1 px-4 py-3 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-50 flex justify-center items-center gap-2">
                  {processandoBaixa ? <><Loader2 size={18} className="animate-spin" /> Processando...</> : 'Confirmar Baixa Múltipla'}
                </button>
              </div>
            </div>
          </div>
        )}

        {reciboGerado && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 flex items-center justify-center p-4 print:p-0 print:bg-white print:block overflow-y-auto">
            <div className="bg-white text-slate-900 p-10 rounded-2xl max-w-2xl w-full shadow-2xl print:shadow-none print:w-full print:max-w-none relative my-8 print:my-0">
              
              <div className="text-center mb-8 border-b-2 border-slate-200 pb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 print:hidden">
                  <CheckCircle size={32} className="text-emerald-600" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Recibo de Pagamento</h1>
                <p className="text-slate-500 font-medium mt-1">GabaritoBI - Açougue</p>
              </div>

              <div className="grid grid-cols-2 gap-y-4 mb-8 text-sm">
                <div className="col-span-2 flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Recebemos de:</span>
                  <span className="font-bold text-slate-900 text-lg">{reciboGerado.cliente}</span>
                </div>
                <div className="col-span-2 flex justify-between border-b border-slate-100 pb-2 bg-emerald-50 p-3 rounded-lg">
                  <span className="text-emerald-700 font-bold uppercase">Valor Total Pago:</span>
                  <span className="font-black text-emerald-600 text-2xl">R$ {reciboGerado.totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 pr-4">
                  <span className="text-slate-500 font-medium">Data Pgto:</span>
                  <span className="font-bold text-slate-900">{reciboGerado.data_pagamento}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 pl-4">
                  <span className="text-slate-500 font-medium">Destino:</span>
                  <span className="font-bold text-slate-900">{reciboGerado.banco}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 pr-4">
                  <span className="text-slate-500 font-medium">Subtotal Orig:</span>
                  <span className="font-bold text-slate-900">R$ {reciboGerado.totalOriginal.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 pl-4">
                  <span className="text-slate-500 font-medium">Desc / Juros:</span>
                  <span className="font-bold text-slate-900">-R$ {reciboGerado.totalDesconto.toLocaleString('pt-BR')} / +R$ {reciboGerado.totalJuros.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className="mb-12">
                <h4 className="font-bold text-slate-700 mb-3 uppercase text-xs">Composição das Notas (Rateio)</h4>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="py-2 px-3 rounded-l-lg">Nota/Parc</th>
                      <th className="py-2 px-3 text-right">Original</th>
                      <th className="py-2 px-3 text-right">Desc/Juros</th>
                      <th className="py-2 px-3 text-right rounded-r-lg font-bold">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reciboGerado.notas.map(n => (
                      <tr key={n.codigo_lancamento} className="border-b border-slate-100">
                        <td className="py-2 px-3">{n.contaOriginal.numero_documento_fiscal} - {n.contaOriginal.numero_parcela}</td>
                        <td className="py-2 px-3 text-right">R$ {n.contaOriginal.saldo_devedor.toLocaleString('pt-BR')}</td>
                        <td className="py-2 px-3 text-right text-slate-500">
                          {n.desconto > 0 && <span className="text-red-500">-R${n.desconto.toLocaleString('pt-BR')}</span>}
                          {n.juros > 0 && <span className="text-amber-500">+R${n.juros.toLocaleString('pt-BR')}</span>}
                          {n.desconto===0 && n.juros===0 && '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">R$ {n.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-center pt-8 border-t border-slate-200">
                <p className="text-slate-400 text-sm mb-12">Assinatura do Recebedor / Responsável</p>
                <div className="w-72 h-[1px] bg-slate-800 mx-auto"></div>
              </div>

              <div className="flex gap-4 mt-12 print:hidden">
                <button onClick={() => setReciboGerado(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition">Fechar</button>
                <button onClick={() => window.print()} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                  <Printer size={18} /> Imprimir Recibo
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;