import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, FileText, TrendingUp, Users, Settings, LogOut, 
  Bell, Search, CalendarDays, Loader2, Database, Printer, Filter
} from 'lucide-react';

function App() {
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [carregandoTela, setCarregandoTela] = useState(false);
  const [menuAtivo, setMenuAtivo] = useState('contas-pagar');

  // Armazena os dados brutos para permitir filtros rápidos sem rechamar a API
  const [contasBrutas, setContasBrutas] = useState([]);
  const [contaFiltro, setContaFiltro] = useState('TODAS');

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

      if (tipoRelatorio === 'contas-pagas') {
        const cc = conta.conta_corrente || 'Conta Não Identificada';
        if (!acc[cat].contasCorrentes[cc]) acc[cat].contasCorrentes[cc] = 0;
        acc[cat].contasCorrentes[cc] += conta[campoValor];
      }

      return acc;
    }, {});

    return Object.entries(resumo)
      .map(([categoria, dados]) => ({ 
        categoria, 
        total: dados.total,
        contasCorrentes: Object.entries(dados.contasCorrentes)
                               .map(([cc, valor]) => ({cc, valor}))
                               .sort((a,b) => b.valor - a.valor)
      }))
      .sort((a, b) => b.total - a.total);
  };

  const handleBuscarDados = async () => {
    if (!dataInicial || !dataFinal) {
      alert("Por favor, selecione a Data Inicial e a Data Final.");
      return;
    }
    setCarregandoTela(true);
    setContaFiltro('TODAS'); // Reseta o filtro ao buscar novos dados
    try {
      const endpoint = menuAtivo === 'contas-pagas' ? 'contas-pagas' : 'contas-a-pagar';
      const url = `http://localhost:8000/api/relatorios/${endpoint}/dados?data_inicio=${dataInicial}&data_fim=${dataFinal}`;
      const resposta = await fetch(url);
      
      if (!resposta.ok) throw new Error("Erro de comunicação com o servidor.");

      const dados = await resposta.json();
      setContasBrutas(dados.contas || []);
    } catch (erro) {
      console.error(erro);
      alert(`Erro: ${erro.message}`);
    } finally {
      setCarregandoTela(false);
    }
  }

  const handleImprimir = () => window.print();

  // DERIVAÇÃO DE DADOS: O React recalcula isso instantaneamente quando o filtro muda
  const contasFiltradas = useMemo(() => {
    if (contaFiltro === 'TODAS') return contasBrutas;
    return contasBrutas.filter(c => c.conta_corrente === contaFiltro);
  }, [contasBrutas, contaFiltro]);

  const dadosAgrupados = useMemo(() => agruparDadosPorData(contasFiltradas, menuAtivo), [contasFiltradas, menuAtivo]);
  const resumoCategorias = useMemo(() => agruparPorCategoria(contasFiltradas, menuAtivo), [contasFiltradas, menuAtivo]);
  const totalGeral = useMemo(() => contasFiltradas.reduce((acc, c) => acc + (menuAtivo === 'contas-pagas' ? c.valor_pago : c.saldo_devedor), 0), [contasFiltradas, menuAtivo]);
  
  // Extrai nomes únicos de contas para popular o select
  const contasCorrentesDisponiveis = useMemo(() => {
    if (menuAtivo !== 'contas-pagas') return [];
    return [...new Set(contasBrutas.map(c => c.conta_corrente))].sort();
  }, [contasBrutas, menuAtivo]);

  const tituloModulo = menuAtivo === 'contas-pagas' ? 'Módulo de Contas Pagas' : 'Módulo de Contas a Pagar';
  const descModulo = menuAtivo === 'contas-pagas' ? 'Sincronize as baixas realizadas e concilie contas correntes.' : 'Sincronize os dados e imprima o relatório detalhado.';
  const tituloRelatorio = menuAtivo === 'contas-pagas' ? 'Pagamentos Realizados' : 'Previsão de Pagamentos';

  const SidebarItem = ({ id, icone: Icon, texto }) => (
    <button 
      onClick={() => {
        setMenuAtivo(id);
        setContasBrutas([]); // Limpa a tela ao trocar de aba
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 print:hidden ${
        menuAtivo === id 
          ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}
    >
      <Icon size={20} className={menuAtivo === id ? 'text-indigo-400' : ''} />
      <span className="font-medium text-left">{texto}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden print:!block print:bg-white print:text-slate-900 print:!h-auto print:!overflow-visible">
      
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 10mm 15mm; }
            html, body, #root, main, div[class*="bg-slate"] { background-color: transparent !important; background-image: none !important; }
            * { animation: none !important; transition: none !important; transform: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; filter: none !important; }
            html, body, #root { display: block !important; height: auto !important; min-height: auto !important; overflow: visible !important; position: static !important; }
            main, .flex-1, .h-screen { height: auto !important; min-height: auto !important; overflow: visible !important; position: static !important; }
            table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-bottom: 20px; }
            tbody { display: table-row-group; }
            tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
            thead { display: table-header-group; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .no-print { display: none !important; }
          }
        `}
      </style>

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
          <SidebarItem id="vendas" icone={TrendingUp} texto="Análise de Vendas" />
        </nav>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden print:!block print:!h-auto print:!overflow-visible">
        
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0 print:hidden"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none z-0 print:hidden"></div>

        <header className="h-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-50 sticky top-0 print:hidden">
          <div className="flex items-center bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2 w-96 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all shadow-inner">
            <Search size={18} className="text-slate-400" />
            <input type="text" placeholder="Buscar relatórios..." className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-200" />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-slate-800 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-slate-200">Admin Financeiro</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600 shadow-md">
                <Users size={20} className="text-slate-300" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 z-10 print:!p-0 print:!m-0 print:!block print:!overflow-visible">
          
          {/* LAYOUT HORIZONTAL DOS PARÂMETROS E TÍTULO */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 print:hidden">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{tituloModulo}</h2>
              <p className="text-slate-400">{descModulo}</p>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-inner hidden sm:block">
                  <CalendarDays className="text-indigo-400" size={20} />
                </div>
                <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="w-full sm:w-auto bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                <span className="text-slate-500 text-sm font-medium">até</span>
                <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="w-full sm:w-auto bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
              </div>

              <button onClick={handleBuscarDados} disabled={carregandoTela} className="relative w-full sm:w-auto group overflow-hidden rounded-lg p-[1px] disabled:opacity-70 disabled:cursor-not-allowed">
                <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#c084fc_0%,#818cf8_50%,#c084fc_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/80 to-purple-500/80 group-hover:opacity-0 transition-opacity duration-500"></span>
                
                <div className="relative flex items-center justify-center gap-2 w-full bg-slate-900/90 backdrop-blur-xl px-5 py-2.5 rounded-lg transition-all text-sm">
                  {carregandoTela ? (
                    <><Loader2 className="animate-spin text-indigo-400" size={16} /><span className="font-bold text-indigo-300">BUSCANDO...</span></>
                  ) : (
                    <><Database className="text-indigo-400 group-hover:text-indigo-300 transition-colors" size={16} /><span className="font-bold text-white tracking-wide">SINCRONIZAR DADOS</span></>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* CABEÇALHO DE IMPRESSÃO */}
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
              <p className="text-sm font-medium text-slate-600 mt-1">
                Período: {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}
                {contaFiltro !== 'TODAS' && ` | Conta: ${contaFiltro}`}
              </p>
            </div>
          </div>

          {carregandoTela && (
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-2xl p-8 mb-8 animate-pulse print:hidden">
              <div className="h-8 bg-slate-700/30 rounded-lg w-1/3 mb-8"></div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex gap-4">
                    <div className="h-10 bg-slate-700/20 rounded-lg w-1/4"></div>
                    <div className="h-10 bg-slate-700/20 rounded-lg w-1/2"></div>
                    <div className="h-10 bg-slate-700/20 rounded-lg w-1/4"></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!carregandoTela && contasBrutas.length > 0 && (
            <div className="bg-white/[0.02] print:bg-transparent backdrop-blur-2xl border border-white/[0.05] print:border-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-2xl p-8 print:!p-0 print:shadow-none relative animate-[fadeIn_0.5s_ease-out] print:!block print:!overflow-visible">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 print:hidden">
                <div>
                  <h3 className="text-2xl font-bold text-white">Resultados da Sincronização</h3>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p className="text-emerald-400 font-bold text-xl">Total Geral: R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                    
                    {/* SELECT DE FILTRO DE CONTAS CORRENTES */}
                    {menuAtivo === 'contas-pagas' && contasCorrentesDisponiveis.length > 0 && (
                      <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2">
                        <Filter size={16} className="text-indigo-400" />
                        <select 
                          value={contaFiltro} 
                          onChange={(e) => setContaFiltro(e.target.value)}
                          className="bg-transparent text-slate-200 text-sm font-medium focus:outline-none appearance-none pr-4"
                        >
                          <option value="TODAS">Todas as Contas Correntes</option>
                          {contasCorrentesDisponiveis.map(cc => (
                            <option key={cc} value={cc}>{cc}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={handleImprimir} className="flex items-center gap-2 bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-slate-700 px-6 py-3 rounded-xl transition-all duration-300 font-bold text-sm group">
                  <Printer size={18} className="group-hover:scale-110 transition-transform" /> IMPRIMIR RELATÓRIO
                </button>
              </div>

              {contasFiltradas.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/30 border border-dashed border-slate-700 rounded-2xl print:hidden">
                  <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 font-medium">Nenhum registro encontrado para o filtro atual.</p>
                </div>
              ) : (
                <div className="print:block">
                  
                  {/* BLOCO 1: RESUMO POR CATEGORIA */}
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

                  {/* BLOCO 2: DETALHAMENTO DE CONTAS */}
                  <h4 className="text-lg font-bold text-indigo-400 print:text-slate-900 uppercase tracking-wider mb-4">
                    Detalhamento de Títulos
                  </h4>
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
                        
                        <tr className="bg-indigo-900/40 print:bg-slate-200 border-b-2 border-indigo-500/30 print:border-slate-800">
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
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}

export default App;