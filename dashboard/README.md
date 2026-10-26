# dashboard/ — Cliente gráfico web (pontuação extra)

**Responsável:** Pessoa D
**Por que tem backend:** o navegador não abre socket TCP puro, então não consegue falar o protocolo `Requisicao`/`Resposta` direto com o Gateway. O backend é **mais um cliente TCP do Gateway**, igual ao CLI, que expõe uma API HTTP/JSON para a página.

```
Navegador (HTML + Chart.js)  --HTTP/JSON-->  backend (Python, Flask)  --TCP + Protobuf-->  Gateway :50010
```

## Backend (`dashboard/backend/`)

- Python + Flask. Reaproveita a função `enviar(req)` do `cliente_cli` (importar, não copiar).
- Converte as respostas com `google.protobuf.json_format.MessageToDict`.
- Rotas:

| Rota | Requisição ao Gateway |
|---|---|
| `GET /api/fontes` | `ListarFontes` |
| `POST /api/comando` `{fonte_id, acao: "power"\|"parametro"\|"falha", ...}` | `Comando` |
| `GET /api/consulta?tipo=CONSUMO_WH&janela_min=60[&fonte_id=&medida=]` | `Consulta` |
| `GET /api/historico?fonte_id=sensor-ph&medida=ph&janela_min=30&max_pontos=200` | `PedidoHistorico` |
| `GET /` | serve `frontend/index.html` |

- Porta `8080`. Execução: `python -m dashboard.backend --gateway 192.168.0.33:50010`.

## Frontend (`dashboard/frontend/index.html`)

Página única, sem build (Chart.js por CDN). Atualiza a cada 2–3 s.

1. **Cartões das fontes:** nome, online/offline (cor), última leitura, botões liga/desliga e um slider de intensidade para a luminária.
2. **Gráfico pH × CO2:** linha do pH com o estado do CO2 (0/1) em um segundo eixo. É o gráfico que conta a história do aquário.
3. **Gráfico de temperatura** e **gráfico de potência das tomadas**.
4. **Painel de consultas:** botões que chamam as 5 consultas e mostram o resultado.
5. **Faixa de alertas:** últimos eventos (`evento=true`).

## Pronto quando

- [ ] O dashboard mostra as 5 fontes e muda para offline quando uma cai.
- [ ] O slider muda o brilho da luminária real.
- [ ] O gráfico de pH mostra a queda com o CO2 ligado e a recuperação depois do desligamento automático.
- [ ] Funciona com o Gateway reiniciando (o backend reconecta).
