import unittest
import pandas as pd
from processa_dados import painel_huddle


class HuddleTests(unittest.TestCase):
    def test_grafias_equivalentes_preservam_totais_e_pendentes(self):
        planos = pd.DataFrame({
            'Data_Registro': ['2026-01-01'] * 5,
            'Status': ['Em andamento', ' Em Andamento ', 'Pendente', 'Concluído', 'CONCLUIDO'],
            'Unidade': ['A'] * 5, 'Categoria': ['B'] * 5, 'Ano': [2026] * 5,
        })
        follow = planos.rename(columns={'Data_Registro': 'Data Ocorrência', 'Unidade': 'Área'})
        dados = painel_huddle(planos, follow)
        esperado = {'Em andamento': 2, 'Pendente': 1, 'Concluído': 2}
        self.assertEqual(dados['planos_status'], esperado)
        self.assertEqual(dados['follow_status'], esperado)
        self.assertEqual(dados['planos_total'], sum(esperado.values()))
        self.assertEqual(dados['follow_total'], sum(esperado.values()))
        self.assertEqual(dados['planos_evolucao'], [{'ano': 2026, 'total': 5, 'concluido': 2}])


if __name__ == '__main__':
    unittest.main()

