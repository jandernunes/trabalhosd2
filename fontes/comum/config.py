import json
import os

CONFIG_PADRAO = os.path.join(os.path.dirname(__file__), "..", "config.json")


def carregar(caminho: str | None) -> dict:
    caminho = os.path.abspath(caminho or CONFIG_PADRAO)
    if not os.path.exists(caminho):
        raise SystemExit(f"Configuração não encontrada: {caminho}\n"
                         f"Copie fontes/config.exemplo.json para fontes/config.json e preencha.")
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def dispositivo_tuya(config: dict, fonte_id: str) -> dict:
    """Junta o que está no config.json com o devices.json do `tinytuya wizard` (as chaves ficam só lá)."""
    entrada = dict(config.get("tomadas", {}).get(fonte_id) or {})
    if not entrada:
        raise SystemExit(f"'{fonte_id}' não está em tomadas no config.json")
    if not (entrada.get("dev_id") and entrada.get("local_key")):
        caminho = config.get("devices_json")
        if not caminho or not os.path.exists(caminho):
            raise SystemExit("Informe dev_id/local_key ou 'devices_json' (arquivo gerado pelo tinytuya wizard)")
        with open(caminho, encoding="utf-8") as f:
            dispositivos = json.load(f)
        alvo = (entrada.get("nome") or entrada.get("dev_id") or "").casefold()
        achado = next((d for d in dispositivos
                       if d.get("name", "").casefold() == alvo or d.get("id", "").casefold() == alvo), None)
        if achado is None:
            nomes = ", ".join(d.get("name", "?") for d in dispositivos)
            raise SystemExit(f"'{entrada.get('nome')}' não encontrado no devices.json (disponíveis: {nomes})")
        entrada.setdefault("dev_id", achado["id"])
        entrada.setdefault("local_key", achado["key"])
        entrada.setdefault("ip", achado.get("ip") or "")
        entrada.setdefault("version", float(achado.get("version") or 3.3))
    entrada["ip"] = entrada.get("ip") or "Auto"  # tinytuya procura pelo device id na rede
    entrada.setdefault("version", 3.3)
    return entrada
