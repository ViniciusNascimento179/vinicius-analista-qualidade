"""Versiona os recursos locais pelo conteúdo para evitar versões antigas no cache."""
from hashlib import sha256
from pathlib import Path
import re

ASSETS = ("data.js", "inspecoes_v3.js", "analise-dados.js", "analise-ui.js", "analise.css")

def versionar(pasta):
    arquivo = pasta / "index.html"
    html = arquivo.read_text(encoding="utf-8")
    for nome in ASSETS:
        digest = sha256((pasta / nome).read_bytes()).hexdigest()[:16]
        pattern = r'((?:src|href)=["\x27])' + re.escape(nome) + r'(?:\?[^"\x27]*)?(["\x27])'
        html, count = re.subn(pattern, lambda m: m[1] + nome + "?v=" + digest + m[2], html)
        if count != 1:
            raise ValueError(f"Esperada uma referência para {nome}; encontradas {count}")
    arquivo.write_text(html, encoding="utf-8")

if __name__ == "__main__":
    versionar(Path(__file__).resolve().parents[1] / "dashboard")
    print("Recursos do dashboard versionados pelo conteúdo.")

