import { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  Users, 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  CalendarDays,
  FileDown,
  Loader2
} from 'lucide-react';

function App() {
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [menuAtivo, setMenuAtivo] = useState('contas-pagar');

  const handleGerarRelatorio = async () => {
    if (!dataInicial || !dataFinal) {
      alert("Por favor, selecione a Data Inicial e a Data Final.");
      return;
    }

    setCarregando(true);

    try {
      const url = `http://localhost:8000/api/relatorios/contas-a-pagar?data_inicio=${dataInicial}&data_fim=${dataFinal}`;
      const resposta = await fetch(url);
      
      if (!resposta.ok) {
        throw new Error("Erro no servidor ao processar o relatório.");
      }

      const blob = await resposta.blob();
      const urlDownload = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlDownload;
      link.setAttribute('download', `GabaritoBI_Pagamentos_${dataInicial}_a_${dataFinal}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(urlDownload);
      
    } catch (erro) {
      console.error("Falha na comunicação:", erro);
      alert("Ocorreu um erro. Verifique se o servidor Backend está ligado.");
    } finally {
      setCarregando(false);
    }
  }

  // --- COMPONENTES DA INTERFACE ---

  const SidebarItem = ({ id, icone: Icon, texto }) => (
    <button 
      onClick={() => setMenuAtivo(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
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
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden">
      
      {/* SIDEBAR (Navegação Lateral) */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Logotipo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              GabaritoBI
            </h1>
          </div>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Relatórios</p>
          <SidebarItem id="dashboard" icone={LayoutDashboard} texto="Visão Geral" />
          <SidebarItem id="contas-pagar" icone={FileText} texto="Contas a Pagar" />
          <SidebarItem id="vendas" icone={TrendingUp} texto="Análise de Vendas" />
          <SidebarItem id="clientes" icone={Users} texto="Inadimplência" />
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-4 border-t border-slate-800">
          <SidebarItem id="config" icone={Settings} texto="Configurações" />
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors mt-2">
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Efeitos de Luz de Fundo (Glow style como na referência) */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Cabeçalho Superior */}
        <header className="h-20 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-full px-4 py-2 w-96 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <Search size={18} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar relatórios ou clientes..." 
              className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-200 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative text-slate-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-800 cursor-pointer">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-slate-200">Admin Financeiro</p>
                <p className="text-xs text-slate-500">Matriz - Ilhéus</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600">
                <Users size={20} className="text-slate-300" />
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo Dinâmico da Tela */}
        <div className="flex-1 p-8 overflow-y-auto z-10">
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">Módulo de Contas a Pagar</h2>
            <p className="text-slate-400">Gere relatórios formatados em PDF diretamente do Omie.</p>
          </div>

          {/* Cartão de Ação (Estilo Glassmorphism) */}
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 max-w-2xl shadow-2xl relative overflow-hidden">
            
            {/* Decoração sutil do cartão */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>

            <div className="flex items-start gap-4 mb-8">
              <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                <CalendarDays className="text-indigo-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Parâmetros do Relatório</h3>
                <p className="text-sm text-slate-400">Selecione o período de previsão de pagamento do caixa.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Input Data Inicial */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Data Inicial</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={dataInicial}
                    onChange={(e) => setDataInicial(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
              
              {/* Input Data Final */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Data Final</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={dataFinal}
                    onChange={(e) => setDataFinal(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
            </div>

            {/* Divisória */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-8"></div>

            {/* Botão de Ação Primária */}
            <button 
              onClick={handleGerarRelatorio}
              disabled={carregando}
              className={`w-full relative group overflow-hidden rounded-xl p-[1px] ${carregando ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></span>
              <div className={`relative flex items-center justify-center gap-2 w-full bg-slate-900 px-6 py-4 rounded-xl transition-all duration-300 ${carregando ? 'bg-slate-800' : 'group-hover:bg-opacity-0'}`}>
                {carregando ? (
                  <>
                    <Loader2 className="animate-spin text-emerald-400 group-hover:text-white" size={20} />
                    <span className="font-semibold text-emerald-400 group-hover:text-white transition-colors">Sincronizando com Omie...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="text-emerald-400 group-hover:text-white transition-colors" size={20} />
                    <span className="font-semibold text-emerald-400 group-hover:text-white transition-colors tracking-wide">
                      BAIXAR RELATÓRIO PDF
                    </span>
                  </>
                )}
              </div>
            </button>

          </div>
        </div>
      </main>
    </div>
  );
}

export default App;