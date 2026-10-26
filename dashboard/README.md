# dashboard/ — Cliente gráfico web em Next.js (pontuação extra)

**Responsável:** Pessoa D
**Stack:** Next.js (App Router) + TypeScript, `protobufjs`, `swr` e `recharts`.

## Como ele fala com o Gateway

O navegador não abre socket TCP puro, então não consegue falar `Requisicao`/`Resposta` direto com o Gateway. Os **Route Handlers do Next** rodam no servidor Node e **eles** abrem a conexão TCP. Assim, o próprio Next é mais um cliente TCP do Gateway, igual ao CLI, e não precisa de um backend separado.

```
Navegador (React)  --fetch /api/*-->  Route Handlers do Next (Node)  --TCP 4 bytes + Protobuf-->  Gateway :50010
```

## Estrutura

```
dashboard/
  package.json            # next, react, react-dom, protobufjs, swr, recharts
  .env.local              # GATEWAY_ADDR=192.168.0.33:50010  (no .gitignore)
  lib/gateway.ts          # cliente TCP + enquadramento + protobufjs (só no servidor)
  app/api/fontes/route.ts
  app/api/comando/route.ts
  app/api/consulta/route.ts
  app/api/historico/route.ts
  app/page.tsx            # painel principal
  components/             # CartaoFonte, GraficoPh, GraficoPotencia, PainelConsultas, FaixaAlertas
```

## `lib/gateway.ts` (o ponto mais delicado)

- **Protobuf sem geração de código:** `protobufjs` carrega o `.proto` em tempo de execução, então o mesmo arquivo da equipe serve sem passo extra de build:
  ```ts
  import protobuf from "protobufjs";
  import path from "node:path";
  const root = await protobuf.load(path.join(process.cwd(), "..", "proto", "aquario.proto"));
  const Requisicao = root.lookupType("aquario.Requisicao");
  const Resposta = root.lookupType("aquario.Resposta");
  ```
- **Enquadramento:** antes da mensagem, 4 bytes `uint32` big-endian com o tamanho (`Buffer.writeUInt32BE`). Na leitura, acumule os chunks do `socket.on("data")` até ter 4 + N bytes. Um chunk pode trazer meia mensagem ou mais de uma.
- **Uma conexão só, reaproveitada** (singleton no módulo). Se cair, reconecta na próxima chamada.
- **Uma requisição por vez:** a `Resposta` não tem id de correlação, então as chamadas são enfileiradas (cadeia de Promises). Timeout de 3 s por chamada.
- **Conversão para JSON:** `Resposta.toObject(msg, { enums: String, longs: Number, defaults: true, oneofs: true })`. O `oneofs: true` acrescenta `corpo: "fontes" | "resultado" | ...`, que diz qual campo veio preenchido.
- **Atenção aos nomes:** o `protobufjs` converte os campos para **camelCase** (`fonte_id` vira `fonteId`, `visto_em_ms` vira `vistoEmMs`). O frontend usa camelCase. (Testado: o `aquario.proto` carrega e faz ida e volta no `protobufjs`.)
- Todo Route Handler declara `export const runtime = "nodejs"`, porque o módulo `net` não existe no runtime Edge, e `export const dynamic = "force-dynamic"`, para desligar o cache.

## Rotas da API

| Rota | Requisição ao Gateway |
|---|---|
| `GET /api/fontes` | `ListarFontes` |
| `POST /api/comando` `{fonte_id, power?: {ligada}, parametro?: {nome, valor}, falha?: {ativa}}` | `Comando` |
| `GET /api/consulta?tipo=CONSUMO_WH&janela_min=60[&fonte_id=&medida=]` | `Consulta` |
| `GET /api/historico?fonte_id=sensor-ph&medida=ph&janela_min=30&max_pontos=200` | `PedidoHistorico` |

Se o Gateway estiver fora, a rota responde `503 { erro: "Gateway indisponível" }` e a página mostra um aviso, sem quebrar.

## Página (`app/page.tsx`, client component)

Atualiza com `useSWR(..., { refreshInterval: 2000 })`.

1. **Cartões das fontes:** nome, online/offline (cor), última leitura, botões liga/desliga e um slider de intensidade para a luminária (envia ao soltar o slider, não a cada pixel).
2. **Gráfico pH × CO2:** linha do pH com o estado do CO2 (0/1) em um segundo eixo. É o gráfico que conta a história do aquário.
3. **Gráfico de temperatura** e **gráfico de potência das tomadas**.
4. **Painel de consultas:** botões que chamam as 5 consultas e mostram o resultado em tabela.
5. **Faixa de alertas:** últimos eventos (`evento=true`), destacando `ph_baixo`.

## Execução

```bash
cd dashboard
npm install
npm run dev        # http://localhost:3000
```
Para a gravação, prefira `npm run build && npm start`, que é mais rápido e não mostra o overlay de desenvolvimento.

## Pronto quando

- [ ] O dashboard mostra as 5 fontes e muda para offline quando uma cai.
- [ ] O slider muda o brilho da luminária real.
- [ ] O gráfico de pH mostra a queda com o CO2 ligado e a recuperação depois do desligamento automático.
- [ ] Com o Gateway reiniciando, mostra "Gateway indisponível" e volta sozinho.
- [ ] Teste de `lib/gateway.ts`: duas mensagens no mesmo chunk e uma mensagem partida em dois chunks são lidas corretamente.
