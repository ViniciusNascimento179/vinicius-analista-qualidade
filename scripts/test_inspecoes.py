"""Regressões de agregação que afetam os gráficos e os filtros de Inspeções."""
import unittest
import pandas as pd

from painel_inspecoes_v3 import painel_inspecoes, _andar_do_setor


def linha(data, status="Concluído", setor="2°C"):
    return {
        "Data_Registro": pd.Timestamp(data), "Status": status,
        "Prioridade GUT": "Alta", "Pontuação GUT": 45, "Setor": setor,
        "Prazo": "30 dias", "Setor Responsável": "Manutenção",
        "Categoria por Tópico do FMS": "Instalações", "Apontamento": "Verificar item",
    }


class InspecoesTests(unittest.TestCase):
    def test_conclusao_por_responsavel_e_filtro_anual(self):
        registros = [linha("2024-01-10"), linha("2026-01-10", "Em andamento"), linha("2026-02-10")]
        registros[-1]["Setor Responsável"] = None
        resultado = painel_inspecoes(pd.DataFrame(registros))
        for bloco in [resultado["total"], *resultado["por_ano"].values()]:
            rows = bloco["conclusao_responsavel"]
            for campo in ["total", "concluidos", "abertos"]:
                self.assertEqual(sum(x[campo] for x in rows), bloco[campo])
            self.assertTrue(all(x["concluidos"] + x["abertos"] == x["total"] for x in rows))
        self.assertEqual(resultado["por_ano"][2024]["conclusao_responsavel"],
                         [{"setor": "Manutenção", "total": 1, "concluidos": 1, "abertos": 0}])
        manutencao = next(x for x in resultado["por_ano"][2026]["conclusao_responsavel"] if x["setor"] == "Manutenção")
        self.assertEqual(manutencao["concluidos"], 0)
        self.assertEqual(manutencao["abertos"], 1)

    def test_apontamentos_responsavel_inclui_todos_status_e_anos(self):
        registros = [linha("2024-01-10"), linha("2026-01-10", "Em andamento")]
        for i in range(20):
            registro = linha("2026-01-10")
            registro["Setor Responsável"] = f"Setor {i}"
            registros.append(registro)
        registros[-1]["Setor Responsável"] = None
        resultado = painel_inspecoes(pd.DataFrame(registros))
        for bloco in [resultado["total"], *resultado["por_ano"].values()]:
            self.assertEqual(sum(x["total"] for x in bloco["apontamentos_responsavel"]), bloco["total"])
        self.assertEqual(resultado["por_ano"][2024]["apontamentos_responsavel"], [{"setor": "Manutenção", "total": 1}])
        self.assertEqual(len(resultado["total"]["apontamentos_responsavel"]), 21)
        self.assertTrue(any(x["setor"] == "Não informado" for x in resultado["total"]["apontamentos_responsavel"]))

    def test_fms_inclui_concluidos_abertos_e_todas_categorias(self):
        registros = [linha("2024-01-10"), linha("2026-01-10", "Em andamento")]
        for i in range(22):
            registro = linha("2026-01-10")
            registro["Categoria por Tópico do FMS"] = f"Categoria {i}"
            registros.append(registro)
        resultado = painel_inspecoes(pd.DataFrame(registros))
        for bloco in [resultado["total"], *resultado["por_ano"].values()]:
            self.assertEqual(sum(x["total"] for x in bloco["categoria_fms"]), bloco["total"])
            self.assertEqual(sum(x["total"] for x in bloco["categoria_fms_aberto"]), bloco["abertos"])
        self.assertEqual(len(resultado["total"]["categoria_fms"]), 23)
        self.assertEqual(resultado["por_ano"][2024]["categoria_fms"][0]["total"], 1)

    def test_anos_separados_e_series_com_zeros(self):
        resultado = painel_inspecoes(pd.DataFrame([
            linha("2024-01-10"), linha("2026-01-10", "Em andamento"),
        ]))
        self.assertEqual(resultado["anos"], [2024, 2026])
        for ano in resultado["anos"]:
            bloco = resultado["por_ano"][ano]
            self.assertEqual(sum(x["total"] for x in bloco["achados_setor"]), bloco["total"])
            serie = bloco["apontamentos_mes"]
            self.assertEqual(len(serie["labels"]), len(serie["concluidos"]))
            self.assertEqual(len(serie["labels"]), len(serie["andamento"]))
            self.assertEqual(sum(serie["concluidos"]) + sum(serie["andamento"]), bloco["total"])
        self.assertEqual(resultado["por_ano"][2024]["apontamentos_mes"]["andamento"], [0])
        self.assertEqual(resultado["por_ano"][2024]["achados_setor"], [{"setor": "2°C", "total": 1}])
        self.assertEqual(resultado["total"]["achados_setor"], [{"setor": "2°C", "total": 2}])
        self.assertEqual(resultado["por_ano"][2026]["apontamentos_mes"]["concluidos"], [0])

    def test_nao_omite_setores_abertos(self):
        resultado = painel_inspecoes(pd.DataFrame([
            linha("2026-01-10", "Em andamento", f"Serviço {i}") for i in range(25)
        ]))["total"]
        self.assertEqual(len(resultado["abertos_setor"]), 25)
        self.assertEqual(sum(x["total"] for x in resultado["abertos_setor"]), 25)
        self.assertEqual(sum(x["total"] for x in resultado["abertos_andar"]), 25)

    def test_andar_sem_inventar_localizacao(self):
        for setor in ["UTI Pediátrica", "Semi Intensiva 1", "CME", "Farmácia Central"]:
            self.assertEqual(_andar_do_setor(setor), "Não identificado")
        for setor in ["2°C", "Corredor 2º andar", "2D"]:
            self.assertEqual(_andar_do_setor(setor), "2° Andar")
        self.assertEqual(_andar_do_setor("Cozinha térreo"), "Térreo")

    def test_mes_sem_registro_e_visita_com_multiplos_apontamentos(self):
        resultado = painel_inspecoes(pd.DataFrame([
            linha("2026-01-10"), linha("2026-01-10"), linha("2026-03-10"),
        ]))["total"]
        self.assertEqual(resultado["total"], 3)
        self.assertEqual(resultado["inspecoes"], 2)
        self.assertEqual(resultado["inspecoes_mes"]["valores"], [1, 0, 1])

    def test_data_1900_nao_cria_ano_falso(self):
        resultado = painel_inspecoes(pd.DataFrame([linha("1900-01-27"), linha("2026-01-10")]))
        self.assertEqual(resultado["anos"], [2026])
        self.assertEqual(resultado["total"]["total"], 1)


if __name__ == "__main__":
    unittest.main()
