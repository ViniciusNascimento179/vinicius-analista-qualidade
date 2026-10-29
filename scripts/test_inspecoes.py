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
    def test_anos_separados_e_series_com_zeros(self):
        resultado = painel_inspecoes(pd.DataFrame([
            linha("2024-01-10"), linha("2026-01-10", "Em andamento"),
        ]))
        self.assertEqual(resultado["anos"], [2024, 2026])
        for ano in resultado["anos"]:
            bloco = resultado["por_ano"][ano]
            serie = bloco["apontamentos_mes"]
            self.assertEqual(len(serie["labels"]), len(serie["concluidos"]))
            self.assertEqual(len(serie["labels"]), len(serie["andamento"]))
            self.assertEqual(sum(serie["concluidos"]) + sum(serie["andamento"]), bloco["total"])
        self.assertEqual(resultado["por_ano"][2024]["apontamentos_mes"]["andamento"], [0])
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
