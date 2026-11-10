import json
import unittest
from datetime import datetime

from importa_ouvidoria import agregar


class OuvidoriaTest(unittest.TestCase):
    def base(self, rows):
        return agregar(rows, ['Setor A', 'Setor B'], ['Elogio', 'Demora'],
                       ['Queixa', 'Elogio', 'Solicitação'], ['Concluído', 'Em andamento'])

    def row(self, **kwargs):
        return {'Data Abertura': datetime(2026, 1, 1), 'Nº BO': 'IDENTIFICADOR-PRIVADO',
                'Setor': 'Setor A', 'Tipo': 'Queixa', 'Status': 'Concluído',
                'Motivo Padronizado': 'Demora', **kwargs}

    def test_modelo_e_linhas_vazias_nao_contam(self):
        b = self.base([{}, {'Nº BO': 1}, self.row()])
        self.assertEqual(b['total'], 1)
        self.assertEqual(b['qualidade']['linhas_modelo_ignoradas'], 1)

    def test_ano_real_e_data_ausente(self):
        b = self.base([self.row(**{'Data Abertura': '24/08/2025'}), self.row(**{'Data Abertura': None})])
        self.assertEqual(b['anos'], ['2025', 'Sem data'])
        self.assertEqual(b['qualidade']['sem_data_valida'], 1)

    def test_vazio_e_nao_padronizado_nao_sao_inventados(self):
        b = self.base([self.row(**{'Motivo Padronizado': None, 'Tipo': None, 'Status': None, 'Setor': None}),
                       self.row(**{'Motivo Padronizado': 'Relato sensível de Pessoa Exemplo'})])
        self.assertEqual({r['motivo'] for r in b['grupos']}, {'Não informado', 'Motivo não padronizado'})
        self.assertNotIn('Relato sensível', json.dumps(b, ensure_ascii=False))
        self.assertEqual(b['qualidade']['sem_status'], 1)

    def test_bo_repetido_nao_elimina_manifestacoes(self):
        b = self.base([self.row(), self.row(Tipo='Elogio')])
        self.assertEqual(b['total'], 2)
        self.assertEqual(b['qualidade']['numeros_bo_repetidos'], 1)

    def test_dados_identificaveis_nao_sao_exportados(self):
        b = self.base([self.row(**{'Paciente': 'Paciente Privado', 'Coordenador / Supervisor': 'Responsável Privado',
                                  'Descrição Livre (vai ao gestor)': 'Descrição privada', 'Obs. Interna': 'Observação privada'})])
        payload = json.dumps(b, ensure_ascii=False)
        for palavra in ['IDENTIFICADOR-PRIVADO', 'Paciente Privado', 'Responsável Privado', 'Descrição privada', 'Observação privada']:
            self.assertNotIn(palavra, payload)
        self.assertEqual(set(b['grupos'][0]), {'ano', 'mes', 'setor', 'tipo', 'status', 'motivo', 'n'})

    def test_normalizacao_e_agregacao(self):
        b = self.base([self.row(), self.row(**{'Setor': ' setor  a ', 'Status': 'concluido', 'Tipo': 'queixa'})])
        self.assertEqual(len(b['grupos']), 1)
        self.assertEqual(b['grupos'][0]['n'], 2)
        self.assertIn('Setor B', b['setores'])


if __name__ == '__main__':
    unittest.main()
