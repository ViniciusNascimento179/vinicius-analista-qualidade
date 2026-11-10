import json
import unittest
from datetime import datetime

from importa_ouvidoria import agregar
from ouvidoria_historico import mesclar, mapas, chave, ler


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

    def test_historico_preserva_fonte_atual_e_sua_data(self):
        atual = self.row(Paciente='Pessoa teste')
        antigo = self.row(Paciente='Pessoa teste', Status='Em andamento', **{'Data Abertura': datetime(2025, 1, 1)})
        rows, iguais, novos = mesclar([atual], [antigo])
        self.assertEqual((iguais, len(novos)), (1, 0))
        self.assertEqual(rows, [atual])

    def test_mesmo_bo_outro_paciente_nao_e_excluido(self):
        atual = self.row(Paciente='Pessoa teste')
        outro = self.row(Paciente='Outra pessoa')
        rows, iguais, novos = mesclar([atual], [outro])
        self.assertEqual((len(rows), iguais, len(novos)), (2, 0, 1))

    def test_correspondencia_consumida_uma_vez_por_manifestacao(self):
        atual = self.row(Paciente='Pessoa teste')
        outra = self.row(Paciente='Pessoa teste', Tipo='Elogio')
        rows, iguais, novos = mesclar([atual], [atual.copy(), outra])
        self.assertEqual((iguais, len(novos), len(rows)), (1, 1, 2))
        self.assertEqual(novos[0]['Tipo'], 'Elogio')

    def test_ausencia_de_identificador_nao_deduplica(self):
        atual = self.row(Paciente=None)
        rows, iguais, novos = mesclar([atual], [atual.copy()])
        self.assertEqual((iguais, len(novos)), (0, 1))

    def test_depara_ambiguo_ou_vazio_nao_inventa_setor(self):
        sm, mm = mapas(['Setor A'], ['Demora'], [('-', 'Setor A'), ('Ambíguo', 'Setor A'), ('Ambíguo', 'Setor B')])
        self.assertNotIn('', sm)
        self.assertNotIn(chave('Ambíguo'), sm)
        self.assertEqual(sm[chave('setor a')], 'Setor A')

    def test_layout_antigo_campos_vazios_relato_livre_e_ano_real(self):
        class Sheet:
            title = 'BOLETINS 2025'
            def iter_rows(self, **kwargs):
                return iter([(10,), ('Nº BO', 'DATA ABERTURA ', 'PACIENTE', 'TIPO', 'SETOR', 'MOTIVO DO BOLETIM', 'STATUS'),
                             (1, datetime(2024, 1, 1), 'Pessoa privada', 'Solciitação', None, None, 'Concluido'),
                             (2, None, 'Outra pessoa', 'Queixa', 'Nome privado', 'Relato confidencial', None)])
        rows, abas = ler([Sheet()], {}, {})
        self.assertIsNone(rows[0]['Setor'])
        self.assertEqual(rows[0]['Tipo'], 'Solicitação')
        self.assertEqual(rows[0]['Data Abertura'].year, 2024)
        self.assertEqual(rows[1]['Setor'], 'Setor não padronizado')
        self.assertEqual(rows[1]['Motivo Padronizado'], 'Motivo não padronizado')
        self.assertEqual(abas, ['BOLETINS 2025'])


if __name__ == '__main__':
    unittest.main()
