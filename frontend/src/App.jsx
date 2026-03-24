import React, { useState } from 'react';
import { 
  LayoutDashboard, FileText, TrendingUp, Users, Settings, LogOut, 
  Bell, Search, CalendarDays, Loader2, Database, Printer
} from 'lucide-react';

function App() {
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [carregandoTela, setCarregandoTela] = useState(false);
  const [menuAtivo, setMenuAtivo] = useState('contas-pagar');

  const [dadosAgrupados, setDadosAgrupados] = useState(null);
  const [resumoCategorias, setResumoCategorias] = useState(null);
  const [totalGeral, setTotalGeral] = useState(0);

  const agruparDadosPorData = (contas) => {
    const datasUnicas = [...new Set(contas.map(c => c.data_previsao_br))];
    return datasUnicas.map(data => {
      const contasDoDia = contas.filter(c => c.data_previsao_br === data);
      const subtotal = contasDoDia.reduce((acc, c) => acc + c.saldo_devedor, 0);
      return { dataVencimento: data, contas: contasDoDia, subtotal };
    });
  };

  const agruparPorCategoria = (contas) => {
    const resumo = contas.reduce((acc, conta) => {
      const cat = conta.desc_categoria || 'Sem Categoria';
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += conta.saldo_devedor;
      return acc;
    }, {});

    return Object.entries(resumo)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  };

  const handleBuscarDados = async () => {
    if (!dataInicial || !dataFinal) {
      alert("Por favor, selecione a Data Inicial e a Data Final.");
      return;
    }
    setCarregandoTela(true);
    try {
      const url = `http://localhost:8000/api/relatorios/contas-a-pagar/dados?data_inicio=${dataInicial}&data_fim=${dataFinal}`;
      const resposta = await fetch(url);
      
      if (!resposta.ok) throw new Error("Erro de comunicação com o servidor.");

      const dados = await resposta.json();
      const contas = dados.contas || [];
      setDadosAgrupados(agruparDadosPorData(contas));
      setResumoCategorias(agruparPorCategoria(contas));
      setTotalGeral(dados.total || 0);

    } catch (erro) {
      console.error(erro);
      alert(`Erro: ${erro.message}`);
    } finally {
      setCarregandoTela(false);
    }
  }

  const handleImprimir = () => {
    window.print();
  }

  const SidebarItem = ({ id, icone: Icon, texto }) => (
    <button 
      onClick={() => setMenuAtivo(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 print:hidden ${
        menuAtivo === id 
          ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <Icon size={20} className={menuAtivo === id ? 'text-indigo-400' : ''} />
      <span className="font-medium">{texto}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden print:!block print:bg-white print:text-slate-900 print:!h-auto print:!overflow-visible">
      
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 10mm 15mm; }
            
            /* Força a transparência em todos os contêineres estruturais e anula as cores escuras do tema. */
            html, body, #root, main, div[class*="bg-slate"] { 
              background-color: transparent !important; 
              background-image: none !important;
            }

            /* Desligar efeitos visuais do tema escuro */
            * {
              animation: none !important;
              transition: none !important;
              transform: none !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              filter: none !important;
            }

            /* Garantir o fluxo de página natural */
            html, body, #root { 
              display: block !important;
              height: auto !important; 
              min-height: auto !important;
              overflow: visible !important; 
              position: static !important;
            }

            /* Solta as amarras do Tailwind nos contêineres principais */
            main, .flex-1, .h-screen {
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              position: static !important;
            }

            table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-bottom: 20px; }
            tbody { display: table-row-group; }
            
            /* Impede que o corte passe no meio da letra */
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">GabaritoBI</h1>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Relatórios</p>
          <SidebarItem id="dashboard" icone={LayoutDashboard} texto="Visão Geral" />
          <SidebarItem id="contas-pagar" icone={FileText} texto="Contas a Pagar" />
          <SidebarItem id="vendas" icone={TrendingUp} texto="Análise de Vendas" />
        </nav>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col relative overflow-y-auto print:!block print:!h-auto print:!overflow-visible">
        
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0 print:hidden"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none z-0 print:hidden"></div>

        <header className="h-20 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-10 sticky top-0 print:hidden">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-full px-4 py-2 w-96 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <Search size={18} className="text-slate-400" />
            <input type="text" placeholder="Buscar relatórios..." className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-200" />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-slate-800 cursor-pointer">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-slate-200">Admin Financeiro</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600">
                <Users size={20} className="text-slate-300" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 z-10 print:!p-0 print:!m-0 print:!block print:!overflow-visible">
          
          <div className="mb-8 print:hidden">
            <h2 className="text-2xl font-bold text-white mb-1">Módulo de Contas a Pagar</h2>
            <p className="text-slate-400">Sincronize os dados e imprima o relatório detalhado.</p>
          </div>

          <div className="hidden print:flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <TrendingUp size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">GabaritoBI</h1>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inteligência Financeira</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-slate-800 uppercase">Previsão de Pagamentos</h2>
              <p className="text-sm font-medium text-slate-600 mt-1">Período: {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}</p>
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 max-w-2xl shadow-2xl relative overflow-hidden mb-8 print:hidden">
            <div className="flex items-start gap-4 mb-8">
              <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                <CalendarDays className="text-indigo-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Parâmetros do Relatório</h3>
                <p className="text-sm text-slate-400">Selecione o período de previsão de pagamento.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Data Inicial</label>
                <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Data Final</label>
                <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
            </div>

            <button onClick={handleBuscarDados} disabled={carregandoTela} className="w-full relative group overflow-hidden rounded-xl p-[1px]">
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></span>
              <div className="relative flex items-center justify-center gap-2 w-full bg-slate-900 px-6 py-4 rounded-xl">
                {carregandoTela ? (
                  <><Loader2 className="animate-spin text-indigo-400" size={20} /><span className="font-semibold text-indigo-400">SINCRONIZANDO OMIE...</span></>
                ) : (
                  <><Database className="text-indigo-400" size={20} /><span className="font-semibold text-white tracking-wide">BUSCAR DADOS & RESUMO</span></>
                )}
              </div>
            </button>
          </div>

          {dadosAgrupados !== null && (
            <div className="bg-slate-800/40 print:bg-transparent backdrop-blur-xl border border-slate-700/50 print:border-none rounded-2xl p-8 print:!p-0 shadow-2xl print:shadow-none relative animate-[fadeIn_0.5s_ease-out] print:!block print:!overflow-visible">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 print:hidden">
                <div>
                  <h3 className="text-2xl font-bold text-white">Resultados da Sincronização</h3>
                  <p className="text-emerald-400 font-semibold text-2xl mt-1">Total Geral: R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                {dadosAgrupados.length > 0 && (
                  <button onClick={handleImprimir} className="flex items-center gap-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 px-5 py-3 rounded-xl transition-colors font-bold text-sm">
                    <Printer size={18} /> IMPRIMIR RELATÓRIO
                  </button>
                )}
              </div>

              {dadosAgrupados.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/30 border border-dashed border-slate-700 print:hidden"><p className="text-slate-400">Nenhuma conta encontrada.</p></div>
              ) : (
                <div className="print:block">
                  
                  {/* BLOCO 1: RESUMO POR CATEGORIA */}
                  <div className="mb-10 print:mb-8">
                    <h4 className="text-lg font-bold text-indigo-400 print:text-slate-900 uppercase tracking-wide mb-4">
                      Resumo por Categoria de Despesa
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-700/50 print:border-none print:overflow-visible">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-900/80 print:bg-slate-100 text-slate-300 print:text-slate-900 text-xs font-bold border-b print:border-b-2 border-slate-700/50 print:border-slate-800">
                            <th className="py-3 px-4 uppercase">Categoria</th>
                            <th className="py-3 px-4 text-right uppercase">Total a Pagar</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {resumoCategorias.map((item, idx) => (
                            <tr key={idx} className={`border-b border-slate-700/30 print:border-slate-300 text-slate-300 print:text-slate-800 hover:bg-slate-800/50 print:hover:bg-transparent ${idx % 2 === 0 ? 'print:bg-white' : 'print:bg-slate-50/50'}`}>
                              <td className="py-2.5 px-4 font-medium">{item.categoria}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-200 print:text-slate-900">
                                R$ {item.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-800/80 print:bg-slate-200 border-t-2 border-slate-600 print:border-b-2 print:border-slate-800">
                            <td className="py-3 px-4 text-right font-bold text-slate-300 print:text-slate-900 uppercase">
                              Total Geral
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-400 print:text-slate-900 text-lg">
                              R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* BLOCO 2: DETALHAMENTO DE CONTAS */}
                  <h4 className="text-lg font-bold text-indigo-400 print:text-slate-900 uppercase tracking-wide mb-4">
                    Detalhamento de Títulos
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-700/50 print:border-none print:overflow-visible">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-900/80 print:bg-slate-100 text-slate-300 print:text-slate-900 text-xs font-bold border-b print:border-b-2 border-slate-700/50 print:border-slate-800">
                          <th className="py-3 px-4 text-center">Data Emissão</th>
                          <th className="py-3 px-4">Categoria</th>
                          <th className="py-3 px-4">Fornecedor</th>
                          <th className="py-3 px-4 text-center">Vencimento</th>
                          <th className="py-3 px-4 text-center">Nº Nota</th>
                          <th className="py-3 px-4 text-center">Parcela</th>
                          <th className="py-3 px-4 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        
                        {dadosAgrupados.map((grupo, gIdx) => (
                          <React.Fragment key={gIdx}>
                            
                            {grupo.contas.map((conta, cIdx) => (
                              <tr key={`${gIdx}-${cIdx}`} className={`border-b border-slate-700/30 print:border-slate-300 text-slate-400 print:text-slate-800 text-xs hover:bg-slate-800/50 print:hover:bg-transparent ${cIdx % 2 === 0 ? 'print:bg-white' : 'print:bg-slate-50/50'}`}>
                                <td className="py-2.5 px-4 text-center">{conta.data_emissao}</td>
                                <td className="py-2.5 px-4 truncate max-w-[200px] print:max-w-none">{conta.desc_categoria}</td>
                                <td className="py-2.5 px-4 truncate max-w-[250px] print:max-w-none font-medium text-slate-200 print:text-slate-900">{conta.nome_fornecedor}</td>
                                <td className="py-2.5 px-4 text-center">{conta.data_previsao_br}</td>
                                <td className="py-2.5 px-4 text-center">{conta.numero_documento_fiscal}</td>
                                <td className="py-2.5 px-4 text-center">{conta.numero_parcela}</td>
                                <td className="py-2.5 px-4 text-right font-medium text-slate-200 print:text-slate-900">
                                  R$ {conta.saldo_devedor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </td>
                              </tr>
                            ))}

                            <tr className="bg-slate-800/60 print:bg-slate-200 border-b-2 border-slate-600 print:border-slate-800">
                              <td colSpan="6" className="py-3 px-4 text-right font-bold text-slate-300 print:text-slate-900 text-xs uppercase">
                                Total a Pagar em {grupo.dataVencimento}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-400 print:text-slate-900">
                                R$ {grupo.subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </td>
                            </tr>

                          </React.Fragment>
                        ))}
                        
                        {/* Total Geral do Período */}
                        <tr className="hidden print:table-row border-t-4 border-slate-900 print:border-slate-800">
                          <td colSpan="6" className="py-6 px-4 text-right font-black text-slate-900 print:text-slate-950 text-sm uppercase">
                            Total Geral do Período
                          </td>
                          <td className="py-6 px-4 text-right font-black text-slate-900 print:text-slate-950 text-xl">
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