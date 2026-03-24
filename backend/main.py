import os
import requests
import pandas as pd
from dotenv import load_dotenv
from fpdf import FPDF
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# 1. SEGURANÇA E SETUP
load_dotenv()
APP_KEY = os.getenv("OMIE_APP_KEY")
APP_SECRET = os.getenv("OMIE_APP_SECRET")

app = FastAPI(title="API GabaritoBI", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- FUNÇÕES DE EXTRAÇÃO DA API OMIE ---
def extrair_contas_pagar_nativas(data_inicial, data_final):
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
                    "filtrar_por_data_de": data_inicial,
                    "filtrar_por_data_ate": data_final,
                }
            ],
        }
        res = requests.post(
            url, json=payload, headers={"Content-Type": "application/json"}
        ).json()
        total_paginas = res.get("total_de_paginas", 1)
        todas_contas.extend(res.get("conta_pagar_cadastro", []))
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
        res = requests.post(
            url, json=payload, headers={"Content-Type": "application/json"}
        ).json()
        total_paginas = res.get("total_de_paginas", 1)
        for cli in res.get("clientes_cadastro", []):
            dicionario[cli["codigo_cliente_omie"]] = cli.get(
                "nome_fantasia", cli.get("razao_social", "")
            )
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
        res = requests.post(
            url, json=payload, headers={"Content-Type": "application/json"}
        ).json()
        total_paginas = res.get("total_de_paginas", 1)
        for cat in res.get("categoria_cadastro", []):
            dicionario[cat["codigo"]] = cat["descricao"]
        pagina_atual += 1
    return dicionario


# --- MOTOR DO PDF (A IMPRESSORA VIRTUAL) ---
class RelatorioPDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 12)
        self.set_fill_color(180, 167, 124)
        self.cell(
            277, 10, "Contas a Pagar - GabaritoBI", border=1, align="C", fill=True
        )
        self.ln(10)

        self.set_font("helvetica", "B", 8)
        self.set_fill_color(242, 242, 233)
        colunas = [
            (26, "Data de Emissão"),
            (55, "Categoria da Despesa"),
            (88, "Fornecedor"),
            (25, "Vencimento"),
            (25, "Nº da Nota"),
            (20, "Parcela"),
            (38, "Valor da Conta"),
        ]
        for largura, titulo in colunas:
            alinhamento = (
                "C"
                if titulo in ["Data de Emissão", "Vencimento", "Nº da Nota", "Parcela"]
                else "L"
            )
            self.cell(largura, 8, titulo, border=1, align=alinhamento, fill=True)
        self.ln(8)


def tratar_vazio(valor):
    if pd.isna(valor) or str(valor).strip().lower() in ["", "nan", "none", "nat"]:
        return "-"
    return str(valor)


def truncar_texto(texto, limite):
    texto = str(texto)
    return texto[:limite] + "..." if len(texto) > limite else texto


def gerar_pdf_final(df, nome_arquivo):
    pdf = RelatorioPDF(orientation="L", unit="mm", format="A4")
    pdf.add_page()
    pdf.set_font("helvetica", "", 8)

    total_periodo = 0
    dias_ordenados = df["data_previsao_dt"].sort_values().unique()

    w_emissao, w_cat, w_forn, w_venc, w_nf, w_parc, w_valor = 26, 55, 88, 25, 25, 20, 38

    for dia in dias_ordenados:
        df_dia = df[df["data_previsao_dt"] == dia]
        subtotal_dia = 0
        linha_impar = False

        for _, row in df_dia.iterrows():
            emissao = truncar_texto(tratar_vazio(row.get("data_emissao")), 10)
            categoria = truncar_texto(tratar_vazio(row.get("desc_categoria")), 35)
            fornecedor = truncar_texto(tratar_vazio(row.get("nome_fornecedor")), 60)
            vencimento = truncar_texto(tratar_vazio(row.get("data_previsao_br")), 10)
            nf = truncar_texto(tratar_vazio(row.get("numero_documento_fiscal")), 15)
            parcela = truncar_texto(tratar_vazio(row.get("numero_parcela")), 10)
            valor_fmt = (
                f"R$ {row['saldo_devedor']:,.2f}".replace(",", "X")
                .replace(".", ",")
                .replace("X", ".")
            )

            if linha_impar:
                pdf.set_fill_color(248, 248, 248)
                fill_flag = True
            else:
                pdf.set_fill_color(255, 255, 255)
                fill_flag = True

            pdf.set_font("helvetica", "", 8)
            pdf.cell(w_emissao, 6, emissao, border="B", align="C", fill=fill_flag)
            pdf.cell(w_cat, 6, categoria, border="B", align="L", fill=fill_flag)
            pdf.cell(w_forn, 6, fornecedor, border="B", align="L", fill=fill_flag)
            pdf.cell(w_venc, 6, vencimento, border="B", align="C", fill=fill_flag)
            pdf.cell(w_nf, 6, nf, border="B", align="C", fill=fill_flag)
            pdf.cell(w_parc, 6, parcela, border="B", align="C", fill=fill_flag)
            pdf.cell(w_valor, 6, valor_fmt, border="B", align="R", fill=fill_flag)
            pdf.ln(6)

            subtotal_dia += row["saldo_devedor"]
            linha_impar = not linha_impar

        pdf.set_font("helvetica", "B", 8)
        pdf.set_fill_color(242, 242, 233)
        data_str = pd.to_datetime(dia).strftime("%d/%m/%Y")
        texto_subtotal = f"Total a Pagar em {data_str}  "
        valor_subtotal_fmt = (
            f" R$ {subtotal_dia:,.2f} ".replace(",", "X")
            .replace(".", ",")
            .replace("X", ".")
        )

        largura_texto = pdf.get_string_width(texto_subtotal) + 4
        largura_valor = pdf.get_string_width(valor_subtotal_fmt) + 4
        espaco_vazio = 277 - (largura_texto + largura_valor)

        pdf.set_y(pdf.get_y() + 0.5)
        pdf.cell(espaco_vazio, 7, "", border=0)
        pdf.cell(largura_texto, 7, texto_subtotal, border=0, align="R", fill=True)
        pdf.cell(largura_valor, 7, valor_subtotal_fmt, border=0, align="R", fill=True)
        pdf.ln(7)

        total_periodo += subtotal_dia

    pdf.ln(3)
    pdf.set_font("helvetica", "B", 9)
    pdf.set_fill_color(180, 167, 124)
    texto_total_semana = "Total do Período  "
    valor_total_fmt = (
        f" R$ {total_periodo:,.2f} ".replace(",", "X")
        .replace(".", ",")
        .replace("X", ".")
    )

    largura_texto_total = pdf.get_string_width(texto_total_semana) + 4
    largura_valor_total = pdf.get_string_width(valor_total_fmt) + 4
    espaco_vazio_total = 277 - (largura_texto_total + largura_valor_total)

    pdf.cell(espaco_vazio_total, 8, "", border=0)
    pdf.cell(largura_texto_total, 8, texto_total_semana, border=0, align="R", fill=True)
    pdf.cell(largura_valor_total, 8, valor_total_fmt, border=0, align="R", fill=True)

    pdf.output(nome_arquivo)


# --- A ROTA DA API ---
@app.get("/api/relatorios/contas-a-pagar")
def gerar_relatorio_contas_pagar(
    data_inicio: str, data_fim: str, background_tasks: BackgroundTasks
):
    print(f"Gerando relatório do período: {data_inicio} a {data_fim}")

    dict_fornecedores = extrair_dicionario_fornecedores()
    dict_categorias = extrair_dicionario_categorias()

    # Nossa extração "Rede Absoluta"
    contas_brutas = extrair_contas_pagar_nativas("01/01/2024", "31/12/2028")
    df_contas = pd.json_normalize(contas_brutas)

    if df_contas.empty:
        return {"erro": "Nenhum dado encontrado no Omie"}

    # Tratamento Financeiro
    df_contas["valor_documento"] = pd.to_numeric(
        df_contas["valor_documento"], errors="coerce"
    )
    if "valor_pag" in df_contas.columns:
        df_contas["valor_pag"] = pd.to_numeric(df_contas["valor_pag"], errors="coerce")
        df_contas["saldo_devedor"] = df_contas["valor_pag"].fillna(
            df_contas["valor_documento"]
        )
    else:
        df_contas["saldo_devedor"] = df_contas["valor_documento"]

    df_contas["data_previsao_dt"] = pd.to_datetime(
        df_contas["data_previsao"], format="%d/%m/%Y", errors="coerce"
    )
    df_contas["data_previsao_br"] = df_contas["data_previsao_dt"].dt.strftime(
        "%d/%m/%Y"
    )

    inicio_dt = pd.to_datetime(data_inicio)
    fim_dt = pd.to_datetime(data_fim)

    status_em_aberto = ["A VENCER", "VENCE HOJE", "ATRASADO"]
    df_abertos = df_contas[df_contas["status_titulo"].isin(status_em_aberto)].copy()

    mask_periodo = (df_abertos["data_previsao_dt"] >= inicio_dt) & (
        df_abertos["data_previsao_dt"] <= fim_dt
    )
    df_filtrado = df_abertos[mask_periodo].copy()

    if df_filtrado.empty:
        # Se não houver dados, retorna erro claro
        return {"mensagem": "Não há contas a pagar neste período!"}

    # Cruzamento
    df_filtrado["nome_fornecedor"] = (
        df_filtrado["codigo_cliente_fornecedor"]
        .map(dict_fornecedores)
        .fillna(df_filtrado["codigo_cliente_fornecedor"])
    )
    df_filtrado["desc_categoria"] = (
        df_filtrado["codigo_categoria"]
        .map(dict_categorias)
        .fillna(df_filtrado["codigo_categoria"])
    )

    # Gera o arquivo real
    nome_arquivo = f"Relatorio_GabaritoBI_{data_inicio}_a_{data_fim}.pdf"
    gerar_pdf_final(df_filtrado, nome_arquivo)

    # Diz para o servidor deletar o arquivo logo após enviar para o navegador
    background_tasks.add_task(os.remove, nome_arquivo)

    return FileResponse(
        path=nome_arquivo, filename=nome_arquivo, media_type="application/pdf"
    )
