# apresentacao/ — Slides e vídeo

**Responsável:** Pessoa D (coordena). Cada pessoa escreve os slides da própria parte.
**Arquivos esperados nesta pasta:** `slides.pdf` (versão final), `roteiro_video.md` (se mudar algo deste roteiro), `link_video.txt`.
O vídeo **não** vai para o git (está no `.gitignore`): vai para o YouTube.

---

## 1. Slides

A especificação pede foco em: **domínio escolhido**, **formato das mensagens**, **serviços gRPC** e **linguagens, frameworks e bibliotecas**. Sugestão de 14 slides:

| # | Slide | Conteúdo | Quem |
|---|---|---|---|
| 1 | Título | Aquário Plantado Inteligente, nomes e matrículas, disciplina | D |
| 2 | O problema | Aquário plantado = equilíbrio luz + CO2 + temperatura; os riscos (algas, peixes mortos) | D |
| 3 | A solução | Sistema central: monitorar, coordenar, alertar (frase da seção 1 do planejamento) | D |
| 4 | Equipamentos | Foto do aquário + tabela "por que cada equipamento importa"; reais × simulados | B |
| 5 | Arquitetura | `docs/arquitetura.svg` | A |
| 6 | Descoberta | Multicast 239.10.10.10:50000 → resposta unicast; reenvio a cada 30 s; `DiscoveryRequest`/`DiscoveryResponse` | A |
| 7 | Fluxo de dados (UDP) | Mensagem `Leitura`/`Medida`; envio periódico × evento imediato | C |
| 8 | Serviço gRPC | `service FonteControlavel` (4 RPCs) e os parâmetros aceitos | B |
| 9 | Cliente ↔ Gateway (TCP) | `Requisicao`/`Resposta` com `oneof`; enquadramento de 4 bytes (por quê) | C |
| 10 | Adaptadores | O Gateway não conhece Tuya nem Magic Home: tabela "protocolo por baixo" | B |
| 11 | Consultas e persistência | As 5 consultas + SQLite | C |
| 12 | Segurança do aquário | pH baixo → Gateway desliga o CO2; failsafe de 90 s na tomada | A |
| 13 | Tecnologias | Java (grpc-java, protobuf, sqlite-jdbc, Maven); Python (grpcio, protobuf, tinytuya, flux_led, Flask); JS (Chart.js) | todos |
| 14 | Dificuldades e lições | VPN e multicast, local key da Tuya, IPs dinâmicos, TCP sem fronteira de mensagem | todos |

**Dicas:** trechos do `.proto` em fonte monoespaçada e grande (no máximo ~12 linhas por slide); um diagrama de sequência simples no slide 6. Exporte em **PDF** para o formulário.

---

## 2. Vídeo (até 7 minutos)

A especificação exige mostrar: **processos sendo levantados**, **cliente sendo executado** e **situações como o desligamento de uma fonte simulando falha**.

### Roteiro (tempos de referência)

| Tempo | Cena | O que aparece | Fala (resumo) |
|---|---|---|---|
| 0:00–0:30 | Abertura | Câmera no aquário | "Este é um aquário plantado. Luz, CO2 e temperatura precisam andar juntos…" |
| 0:30–1:00 | Arquitetura | Slide da arquitetura | Os 5 equipamentos, o Gateway e o cliente; os protocolos de cada seta |
| 1:00–1:45 | Subida | `subir_tudo.ps1`; janelas com título; log do Gateway com as fontes aparecendo | Descoberta por multicast; fontes respondendo com tipo, IP, porta e estado |
| 1:45–2:15 | Cliente | `fontes` no CLI | Estados e últimas leituras (inclusive a potência real das tomadas) |
| 2:15–3:15 | Comandos reais | `param luminaria-smartled intensidade 20` com `rampa_s 15`; a **câmera mostra a luz baixando**; `ligar tomada-luminaria` | gRPC até a fonte; o adaptador traduz para Magic Home/Tuya |
| 3:15–4:30 | Alerta de pH | `ligar tomada-co2`; gráfico de pH caindo no dashboard; evento `ph_baixo`; o Gateway desliga o CO2 sozinho | Evento imediato além do periódico; regra de segurança |
| 4:30–5:30 | Falhas | Ctrl+C na `tomada-luminaria` → OFFLINE; reinicia → ONLINE; `falha luminaria-smartled on` (para de enviar sem matar o processo); comando para fonte offline → erro | Detecção por ausência de leituras (3 intervalos) |
| 5:30–6:30 | Consultas | `consumo 60`, `tempo-ligado 60`, `ph 60`, `media sensor-temperatura temperatura 60`, `variacao 60`; histórico no dashboard | Consultas sobre o SQLite |
| 6:30–7:00 | Fechamento | Dashboard completo | Resumo: 3 equipamentos reais, 2 simulados, 4 protocolos, Protobuf em tudo |

> **Segurança no vídeo:** a cena do pH usa o sensor simulado com `--ph-com-co2 6.2`, então o CO2 real fica ligado só por 1–2 min e é desligado pelo próprio sistema. Alguém do grupo fica de olho no aquário durante a gravação.

### Preparação

- [ ] **Ensaio completo** com `-Backend sim`, cronometrado (meta: 6 min 30 s)
- [ ] VPN desligada, IPs conferidos, `fontes/config.json` preenchido
- [ ] Banco SQLite com **pelo menos 1 h de dados**: deixar o sistema rodando antes, para as consultas terem números
- [ ] Sensor de pH com `--tau-s 30` e `--ph-com-co2 6.2` (o alerta aparece rápido)
- [ ] Terminal com **fonte grande** (≥ 16 pt) e **tema escuro**; uma janela por processo, com título
- [ ] Notificações do Windows desligadas (modo "Não perturbe")

### Gravação

- **Tela:** OBS Studio (gratuito), 1920×1080, 30 fps. Cena 1: terminais lado a lado; cena 2: dashboard; cena 3: slide.
- **Câmera do aquário:** celular como webcam (DroidCam ou Link to Windows) em um canto da tela do OBS, ou gravado à parte e intercalado na edição.
- **Áudio:** narração ao vivo ou por cima na edição. Fale devagar e nomeie o protocolo de cada passo.
- Grave **por cenas**: se uma der errado, regrave só ela.

### Edição e entrega

- Corte as esperas (por exemplo, os 30 s até o OFFLINE): use um corte com o texto "+30 s".
- Legendas curtas nos momentos-chave: "UDP multicast", "gRPC SetPower", "Evento imediato: pH < 6,4".
- **Duração final ≤ 7:00.**
- Upload no YouTube como **não listado**. Teste o link em aba anônima e salve em `link_video.txt`.

---

## 3. Formulário de entrega (um aluno envia)

- [ ] Nome e matrícula de todos os membros
- [ ] `slides.pdf`
- [ ] Link do repositório público: https://github.com/jandernunes/trabalhosd2
- [ ] Link do vídeo (≤ 7 min)
