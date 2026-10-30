"""Pendentes calculados quando o Excel não grava o resultado da fórmula."""
import unittest
import pandas as pd
from processa_dados import painel_rounds


class RoundsTests(unittest.TestCase):
    def test_formulas_sem_cache_sao_recuperadas_por_ano_e_mes(self):
        rows = [
            ["Equipe", "Setor A", 2025, "Janeiro", 9, 12, None],
            ["Equipe", "Setor B", 2025, "Janeiro", 8, 12, None],
            ["Equipe", "Setor A", 2026, "Fevereiro", 4, 12, None],
            ["Equipe", "Setor A", 2026, "Março", 0, 0, None],
        ]
        result = self.calculate(rows)
        self.assertEqual({r["ano"]: r["pendentes"] for r in result["por_ano"]}, {2025: 7, 2026: 8})
        for year in result["por_ano"]:
            self.assertEqual(sum(r["pendentes"] for r in result["evolucao"][year["ano"]]), year["pendentes"])
            self.assertEqual(year["pendentes"], year["previstos"] - year["realizados"])
        self.assertEqual(len(result["evolucao"][2026]), 1)

    def test_valores_explicitos_inclusive_zero_sao_preservados(self):
        result = self.calculate([
            ["Equipe", "Setor A", 2024, "Janeiro", 8, 12, 4],
            ["Equipe", "Setor B", 2024, "Fevereiro", 8, 12, 0],
        ])
        self.assertEqual(result["por_ano"][0]["pendentes"], 4)
        self.assertEqual(result["evolucao"][2024][1]["pendentes"], 0)

    @staticmethod
    def calculate(rows):
        rounds = pd.DataFrame(rows, columns=["Responsáveis", "Setores", "Ano", "Meses", "Realizados", "Previstos", "Pendentes"])
        detail = pd.DataFrame(columns=["Ano", "Categoria", "Setor", "Mês"])
        return painel_rounds(rounds, detail)


if __name__ == '__main__':
    unittest.main()
