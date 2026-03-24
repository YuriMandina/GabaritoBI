import { useState } from 'react'

function App() {
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleGerarRelatorio = async () => {
    // Validação básica para garantir que o utilizador escolheu as datas
    if (!dataInicial || !dataFinal) {
      alert("Por favor, selecione a Data Inicial e a Data Final.");
      return;
    }

    setCarregando(true); // Muda o botão para "A Processar..."

    try {
      // 1. A PONTE: O Frontend chama o Backend enviando as datas escolhidas
      const url = `http://localhost:8000/api/relatorios/contas-a-pagar?data_inicio=${dataInicial}&data_fim=${dataFinal}`;
      
      const resposta = await fetch(url);
      
      if (!resposta.ok) {
        throw new Error("Erro no servidor ao processar o relatório.");
      }

      // 2. O RECEBIMENTO: Pegamos a resposta em formato binário (Blob = o nosso PDF)
      const blob = await resposta.blob();
      
      // 3. A MAGIA DO DOWNLOAD: Criamos um link temporário para forçar o browser a guardar o ficheiro
      const urlDownload = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlDownload;
      
      // Define o nome do ficheiro que será salvo
      link.setAttribute('download', `GabaritoBI_Pagamentos_${dataInicial}_a_${dataFinal}.pdf`);
      
      // Adiciona o link ao ecrã (invisível), clica nele e depois remove
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      // Limpa a memória do navegador
      window.URL.revokeObjectURL(urlDownload);
      
    } catch (erro) {
      console.error("Falha na comunicação:", erro);
      alert("Ocorreu um erro. Verifique se o servidor Backend do GabaritoBI está ligado.");
    } finally {
      // Devolve o botão ao estado normal quer tenha tido sucesso ou falhado
      setCarregando(false);
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      
      {/* Cabeçalho */}
      <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', color: 'white', marginBottom: '30px' }}>
        <h1 style={{ margin: 0 }}>GabaritoBI 🥩</h1>
        <p style={{ margin: '5px 0 0 0', color: '#9ca3af' }}>Inteligência Financeira para o Varejo</p>
      </div>

      {/* Cartão de Filtros */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '500px' }}>
        <h2 style={{ marginTop: 0, color: '#374151' }}>Relatório de Contas a Pagar</h2>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
          Selecione o período de previsão de pagamento para gerar o PDF para a diretoria e banco.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Data Inicial:</label>
            <input 
              type="date" 
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#4b5563' }}>Data Final:</label>
            <input 
              type="date" 
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button 
          onClick={handleGerarRelatorio}
          disabled={carregando}
          style={{ 
            backgroundColor: carregando ? '#9ca3af' : '#10b981', 
            color: 'white', padding: '14px 20px', border: 'none', 
            borderRadius: '4px', cursor: carregando ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold', width: '100%', fontSize: '16px',
            transition: 'background-color 0.3s'
          }}
        >
          {carregando ? 'A Processar Dados no Omie...' : 'Gerar Relatório em PDF'}
        </button>
      </div>

    </div>
  )
}

export default App