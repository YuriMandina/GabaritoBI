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
            "param": [
                {
                    "pagina": pagina_atual,
                    "registros_por_pagina": 500,
                    "filtrar_apenas_titulos_em_aberto": "S",
                }
            ],
        }
        try:
            res = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            ).json()
            if "faultstring" in res:
                break
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
        payload = {
            "call": "ListarClientes",
            "app_key": APP_KEY,
            "app_secret": APP_SECRET,
            "param": [{"pagina": pagina_atual, "registros_por_pagina": 500}],
        }
        try:
            res = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            ).json()
            total_paginas = res.get("total_de_paginas", 1)
            for cli in res.get("clientes_cadastro", []):
                dicionario[cli["codigo_cliente_omie"]] = cli.get(
                    "nome_fantasia", cli.get("razao_social", "")
                )
        except:
            pass
        pagina_atual += 1
    return dicionario


def extrair_dicionario_categorias():
    url = "https://app.omie.com.br/api/v1/geral/categorias/"
    pagina_atual, total_paginas = 1, 1
    dicionario = {}
    while pagina_atual <= total_paginas:
        payload = {
            "call": "ListarCategorias",
            "app_key": APP_KEY,
            "app_secret": APP_SECRET,
            "param": [{"pagina": pagina_atual, "registros_por_pagina": 500}],
        }
        try:
            res = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            ).json()
            total_paginas = res.get("total_de_paginas", 1)
            for cat in res.get("categoria_cadastro", []):
                dicionario[cat["codigo"]] = cat["descricao"]
        except:
            pass
        pagina_atual += 1
    return dicionario


def extrair_dicionario_contas_correntes():
    """Busca o nome dos bancos/contas correntes no Omie garantindo que o ID seja String"""
    url = "https://app.omie.com.br/api/v1/geral/contacorrente/"
    pagina_atual, total_paginas = 1, 1
    dicionario = {}
    while pagina_atual <= total_paginas:
        payload = {
            "call": "ListarContasCorrentes",
            "app_key": APP_KEY,
            "app_secret": APP_SECRET,
            "param": [{"pagina": pagina_atual, "registros_por_pagina": 500}],
        }
        try:
            res = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            ).json()
            total_paginas = res.get("total_de_paginas", 1)

            # A API do Omie devolve a lista de contas dentro da chave "ListarContasCorrentes"
            lista_contas = res.get("ListarContasCorrentes", [])

            for cc in lista_contas:
                # O ID da conta vem como nCodCC e o nome como descricao
                id_cc = str(cc.get("nCodCC", ""))
                dicionario[id_cc] = cc.get("descricao", f"Conta {id_cc}")
        except Exception as e:
            print(f"Erro ao extrair Contas Correntes: {e}")
            pass
        pagina_atual += 1
    return dicionario


def extrair_movimentos_pagos_periodo(data_inicio: str, data_fim: str):
    """Utiliza a API de Movimentos Financeiros para buscar as baixas exatas do período"""
    url = "https://app.omie.com.br/api/v1/financas/mf/"
    dt_inicio_omie = pd.to_datetime(data_inicio).strftime("%d/%m/%Y")
    dt_fim_omie = pd.to_datetime(data_fim).strftime("%d/%m/%Y")

    pagina_atual, total_paginas = 1, 1
    todos_movimentos = []

    while pagina_atual <= total_paginas:
        payload = {
            "call": "ListarMovimentos",
            "app_key": APP_KEY,
            "app_secret": APP_SECRET,
            "param": [
                {
                    "nPagina": pagina_atual,
                    "nRegPorPagina": 500,
                    "dDtPagtoDe": dt_inicio_omie,  # Filtra pela data exata do pagamento
                    "dDtPagtoAte": dt_fim_omie,
                    "cTpLancamento": "CP",  # Força trazer apenas Contas a Pagar
                }
            ],
        }
        try:
            res = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            ).json()
            if "faultstring" in res:
                break
            total_paginas = res.get("nTotPaginas", 1)
            todos_movimentos.extend(res.get("movimentos", []))
        except Exception as e:
            print(f"Erro na paginação Omie (MF): {e}")
            break
        pagina_atual += 1
    return todos_movimentos


def tratar_vazio(valor):
    if pd.isna(valor) or str(valor).strip().lower() in ["", "nan", "none", "nat"]:
        return "-"
    return str(valor)


@app.get("/api/relatorios/contas-a-pagar/dados")
def obter_dados_tela(data_inicio: str, data_fim: str):
    try:
        dict_fornecedores = extrair_dicionario_fornecedores()
        dict_categorias = extrair_dicionario_categorias()

        # --- BLINDAGEM DE TIPAGEM PARA O CONTAS A PAGAR ---
        dict_forn_str = {str(k): v for k, v in dict_fornecedores.items()}
        dict_cat_str = {str(k): v for k, v in dict_categorias.items()}

        contas_brutas = extrair_contas_pagar_abertas()
        if not contas_brutas:
            return JSONResponse(content={"total": 0.0, "contas": []})

        df_contas = pd.json_normalize(contas_brutas)
        if df_contas.empty:
            return JSONResponse(content={"total": 0.0, "contas": []})

        df_contas["valor_documento"] = pd.to_numeric(
            df_contas.get("valor_documento", pd.Series(dtype=float)), errors="coerce"
        ).fillna(0.0)

        if "valor_pag" in df_contas.columns:
            df_contas["valor_pag"] = pd.to_numeric(
                df_contas["valor_pag"], errors="coerce"
            ).fillna(0.0)
            df_contas["saldo_devedor"] = df_contas.apply(
                lambda row: (
                    row["valor_documento"]
                    if row["valor_pag"] == 0
                    else row["valor_pag"]
                ),
                axis=1,
            )
        else:
            df_contas["saldo_devedor"] = df_contas["valor_documento"]

        if "data_previsao" not in df_contas.columns:
            return JSONResponse(content={"total": 0.0, "contas": []})

        df_contas["data_previsao_dt"] = pd.to_datetime(
            df_contas["data_previsao"], format="%d/%m/%Y", errors="coerce"
        )
        df_contas = df_contas.dropna(subset=["data_previsao_dt"])
        df_contas["data_previsao_br"] = df_contas["data_previsao_dt"].dt.strftime(
            "%d/%m/%Y"
        )

        if "status_titulo" not in df_contas.columns:
            df_contas["status_titulo"] = "-"

        # Filtro de datas
        inicio_dt = pd.to_datetime(data_inicio)
        fim_dt = pd.to_datetime(data_fim)
        mask_periodo = (df_contas["data_previsao_dt"] >= inicio_dt) & (
            df_contas["data_previsao_dt"] <= fim_dt
        )
        df_abertos = df_contas[mask_periodo].copy()

        if df_abertos.empty:
            return JSONResponse(content={"total": 0.0, "contas": []})

        df_abertos = df_abertos.sort_values(by="data_previsao_dt")
        total = float(df_abertos["saldo_devedor"].sum())

        contas_lista = []
        for _, row in df_abertos.iterrows():

            # --- LIMPEZA DO PANDAS ---
            # Remove o ".0" fantasma que o Pandas coloca em colunas com IDs vazios
            val_forn = row.get("codigo_cliente_fornecedor")
            id_forn = ""
            if pd.notna(val_forn) and str(val_forn).strip() not in ["", "nan", "None"]:
                try:
                    # int(float(123.0)) -> 123 -> "123"
                    id_forn = str(int(float(val_forn)))
                except:
                    id_forn = str(val_forn).strip()

            val_cat = row.get("codigo_categoria")
            id_cat = str(val_cat).strip() if pd.notna(val_cat) else ""

            # Cruzamento perfeito garantido
            nome_fornecedor = dict_forn_str.get(id_forn, tratar_vazio(val_forn))
            desc_categoria = dict_cat_str.get(id_cat, tratar_vazio(val_cat))

            contas_lista.append(
                {
                    "data_previsao_br": tratar_vazio(row.get("data_previsao_br")),
                    "data_emissao": tratar_vazio(row.get("data_emissao")),
                    "numero_documento_fiscal": tratar_vazio(
                        row.get("numero_documento_fiscal")
                    ),
                    "numero_parcela": tratar_vazio(row.get("numero_parcela")),
                    "nome_fornecedor": nome_fornecedor,
                    "desc_categoria": desc_categoria,
                    "status_titulo": tratar_vazio(row.get("status_titulo")),
                    "saldo_devedor": float(row.get("saldo_devedor", 0.0)),
                }
            )

        return JSONResponse(content={"total": total, "contas": contas_lista})

    except Exception as e:
        import traceback

        traceback.print_exc()
        return JSONResponse(
            status_code=500, content={"detail": f"Falha no Backend: {e}"}
        )


@app.get("/api/relatorios/contas-pagas/dados")
def obter_dados_contas_pagas(data_inicio: str, data_fim: str):
    try:
        dict_fornecedores = extrair_dicionario_fornecedores()
        dict_categorias = extrair_dicionario_categorias()
        dict_contas = extrair_dicionario_contas_correntes()

        # --- A BLINDAGEM DE TIPAGEM ---
        # Força as chaves dos dicionários a serem texto (string) para garantir o cruzamento,
        # sem quebrar as outras rotas do sistema!
        dict_forn_str = {str(k): v for k, v in dict_fornecedores.items()}
        dict_cat_str = {str(k): v for k, v in dict_categorias.items()}

        movimentos_brutos = extrair_movimentos_pagos_periodo(data_inicio, data_fim)
        if not movimentos_brutos:
            return JSONResponse(content={"total": 0.0, "contas": []})

        contas_lista = []
        total_pago = 0.0

        for mov in movimentos_brutos:
            det = mov.get("detalhes", {})
            res = mov.get("resumo", {})

            valor = float(res.get("nValPago", 0.0))
            if valor <= 0:
                continue

            # Pega os IDs originais do Omie
            id_forn_orig = det.get("nCodCliente")
            id_cat_orig = det.get("cCodCateg")
            id_conta_orig = det.get("nCodCC")

            # Transforma todos em string de forma segura para a busca
            id_fornecedor = str(id_forn_orig) if id_forn_orig else ""
            id_categoria = str(id_cat_orig) if id_cat_orig else ""
            id_conta = str(id_conta_orig) if id_conta_orig else ""

            contas_lista.append(
                {
                    "data_pagamento_br": tratar_vazio(det.get("dDtPagamento")),
                    "data_emissao": tratar_vazio(det.get("dDtEmissao")),
                    "numero_documento_fiscal": tratar_vazio(det.get("cNumDocFiscal")),
                    "numero_parcela": tratar_vazio(det.get("cNumParcela")),
                    # Busca no dicionário blindado (Texto procurando Texto)
                    "nome_fornecedor": dict_forn_str.get(
                        id_fornecedor, tratar_vazio(id_forn_orig)
                    ),
                    "desc_categoria": dict_cat_str.get(
                        id_categoria, tratar_vazio(id_cat_orig)
                    ),
                    "conta_corrente": dict_contas.get(id_conta, f"Conta {id_conta}"),
                    "valor_pago": valor,
                }
            )
            total_pago += valor

        contas_lista = sorted(
            contas_lista,
            key=lambda x: (
                pd.to_datetime(
                    x["data_pagamento_br"], format="%d/%m/%Y", errors="coerce"
                )
                if x["data_pagamento_br"] != "-"
                else pd.Timestamp.min
            ),
        )

        return JSONResponse(content={"total": total_pago, "contas": contas_lista})

    except Exception as e:
        import traceback

        traceback.print_exc()
        return JSONResponse(
            status_code=500, content={"detail": f"Falha no Backend: {e}"}
        )
