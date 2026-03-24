import os
import requests
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 1. SEGURANÇA E SETUP
load_dotenv()
APP_KEY = os.getenv("OMIE_APP_KEY")
APP_SECRET = os.getenv("OMIE_APP_SECRET")

app = FastAPI(title="API GabaritoBI", version="4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FUNÇÕES DE EXTRAÇÃO DA API OMIE  ---
def extrair_contas_pagar_abertas():
    """ 
    Extrai as contas a pagar em aberto da API do Omie, paginando os resultados para garantir a obtenção de todas as contas. 
    Retorna uma lista de dicionários representando cada conta a pagar. 
    """
    url = "https://app.omie.com.br/api/v1/financas/contapagar/"
    pagina_atual, total_paginas = 1, 1
    todas_contas = []
    while pagina_atual <= total_paginas:
        payload = {
            "call": "ListarContasPagar",
            "app_key": APP_KEY,
            "app_secret": APP_SECRET,
            "param": [{
                "pagina": pagina_atual, 
                "registros_por_pagina": 500, 
                "filtrar_apenas_titulos_em_aberto": "S"
            }],
        }
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15).json()
            if "faultstring" in res: break
            total_paginas = res.get("total_de_paginas", 1)
            todas_contas.extend(res.get("conta_pagar_cadastro", []))
        except: 
            break
        pagina_atual += 1
    return todas_contas

def extrair_dicionario_fornecedores():
    url = "https://app.omie.com.br/api/v1/geral/clientes/"
    pagina_atual, total_paginas = 1, 1
    dicionario = {}
    while pagina_atual <= total_paginas:
        payload = {"call": "ListarClientes", "app_key": APP_KEY, "app_secret": APP_SECRET, "param": [{"pagina": pagina_atual, "registros_por_pagina": 500}]}
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15).json()
            total_paginas = res.get("total_de_paginas", 1)
            for cli in res.get("clientes_cadastro", []):
                dicionario[cli["codigo_cliente_omie"]] = cli.get("nome_fantasia", cli.get("razao_social", ""))
        except: pass
        pagina_atual += 1
    return dicionario

def extrair_dicionario_categorias():
    url = "https://app.omie.com.br/api/v1/geral/categorias/"
    pagina_atual, total_paginas = 1, 1
    dicionario = {}
    while pagina_atual <= total_paginas:
        payload = {"call": "ListarCategorias", "app_key": APP_KEY, "app_secret": APP_SECRET, "param": [{"pagina": pagina_atual, "registros_por_pagina": 500}]}
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15).json()
            total_paginas = res.get("total_de_paginas", 1)
            for cat in res.get("categoria_cadastro", []):
                dicionario[cat["codigo"]] = cat["descricao"]
        except: pass
        pagina_atual += 1
    return dicionario

def tratar_vazio(valor):
    if pd.isna(valor) or str(valor).strip().lower() in ["", "nan", "none", "nat"]: return "-"
    return str(valor)

@app.get("/api/relatorios/contas-a-pagar/dados")
def obter_dados_tela(data_inicio: str, data_fim: str):
    try:
        dict_fornecedores = extrair_dicionario_fornecedores()
        dict_categorias = extrair_dicionario_categorias()

        contas_brutas = extrair_contas_pagar_abertas()
        if not contas_brutas:
            return JSONResponse(content={"total": 0.0, "contas": []})

        df_contas = pd.json_normalize(contas_brutas)
        if df_contas.empty:
            return JSONResponse(content={"total": 0.0, "contas": []})

        df_contas["valor_documento"] = pd.to_numeric(df_contas.get("valor_documento", pd.Series(dtype=float)), errors="coerce").fillna(0.0)
        if "valor_pag" in df_contas.columns:
            df_contas["valor_pag"] = pd.to_numeric(df_contas["valor_pag"], errors="coerce").fillna(0.0)
            df_contas["saldo_devedor"] = df_contas.apply(lambda row: row["valor_documento"] if row["valor_pag"] == 0 else row["valor_pag"], axis=1)
        else:
            df_contas["saldo_devedor"] = df_contas["valor_documento"]

        if "data_previsao" not in df_contas.columns:
            return JSONResponse(content={"total": 0.0, "contas": []})
            
        df_contas["data_previsao_dt"] = pd.to_datetime(df_contas["data_previsao"], format="%d/%m/%Y", errors="coerce")
        df_contas = df_contas.dropna(subset=["data_previsao_dt"])
        df_contas["data_previsao_br"] = df_contas["data_previsao_dt"].dt.strftime("%d/%m/%Y")

        if "status_titulo" not in df_contas.columns:
            df_contas["status_titulo"] = "-"

        # O Filtro do Pandas cortando os dias com precisão absoluta
        inicio_dt = pd.to_datetime(data_inicio)
        fim_dt = pd.to_datetime(data_fim)
        mask_periodo = (df_contas["data_previsao_dt"] >= inicio_dt) & (df_contas["data_previsao_dt"] <= fim_dt)
        df_abertos = df_contas[mask_periodo].copy()

        if df_abertos.empty:
            return JSONResponse(content={"total": 0.0, "contas": []})

        if "codigo_cliente_fornecedor" in df_abertos.columns:
            df_abertos["nome_fornecedor"] = df_abertos["codigo_cliente_fornecedor"].map(dict_fornecedores).fillna(df_abertos["codigo_cliente_fornecedor"])
        else:
            df_abertos["nome_fornecedor"] = "-"

        if "codigo_categoria" in df_abertos.columns:
            df_abertos["desc_categoria"] = df_abertos["codigo_categoria"].map(dict_categorias).fillna(df_abertos["codigo_categoria"])
        else:
            df_abertos["desc_categoria"] = "-"

        df_abertos = df_abertos.sort_values(by="data_previsao_dt")
        total = float(df_abertos["saldo_devedor"].sum())

        contas_lista = []
        for _, row in df_abertos.iterrows():
            contas_lista.append({
                "data_previsao_br": tratar_vazio(row.get("data_previsao_br")),
                "data_emissao": tratar_vazio(row.get("data_emissao")),
                "numero_documento_fiscal": tratar_vazio(row.get("numero_documento_fiscal")),
                "numero_parcela": tratar_vazio(row.get("numero_parcela")),
                "nome_fornecedor": tratar_vazio(row.get("nome_fornecedor")),
                "desc_categoria": tratar_vazio(row.get("desc_categoria")),
                "status_titulo": tratar_vazio(row.get("status_titulo")),
                "saldo_devedor": float(row.get("saldo_devedor", 0.0))
            })

        return JSONResponse(content={"total": total, "contas": contas_lista})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": f"Falha no Backend: {e}"})