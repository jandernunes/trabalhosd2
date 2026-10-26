# Resultados dos testes — 26/10/2026

Ambiente: Windows 11, Java 21, Python 3.11, Node 22. Todos os processos rodaram no mesmo PC (`192.168.0.33`), **sem VPN**.

## Testes automatizados

| Conjunto | Comando | Resultado |
|---|---|---|
| Python (modelo do pH, limiar com histerese, DPS das tomadas, enquadramento TCP) | `python -m unittest discover -s . -p "test_*.py" -t .` | 5/5 ✅ |
| Gateway — consultas (JUnit) | `cd gateway && mvn package` | 6/6 ✅ |
| Dashboard — enquadramento | `cd dashboard && npm test` | 2/2 ✅ |
| Dashboard — build e checagem de tipos | `npx next build` | ✅ |

## Integração com backend simulado

| # | Cenário | Resultado |
|---|---|---|
| M1 | Gateway descobre as 5 fontes por multicast | ✅ |
| M2 | Leituras UDP chegam e são gravadas no SQLite | ✅ |
| M3 | Comandos CLI → Gateway → gRPC → fonte (liga/desliga, intensidade, rampa, intervalo) | ✅ |
| I3 | Comando em fonte não controlável / parâmetro inválido | ✅ erro claro, nada trava |
| I5 | CO2 ligado → pH cai → `ph_baixo` imediato → Gateway desliga o CO2 → pH volta a subir | ✅ |
| M4 | 5 consultas + histórico | ✅ |
| F1/F2 | Matar uma fonte → OFFLINE em ~32 s; reiniciar → ONLINE | ✅ |
| F3 | `falha <id> on/off` | ✅ |
| F4 | Comando para fonte morta → `fonte inacessível (UNAVAILABLE)` | ✅ |
| F5 | Reiniciar o Gateway → redescobre as 5 fontes | ✅ |
| F6 | Gateway morto com CO2 ligado → failsafe desliga em 82 s | ✅ |
| M7 | Dashboard: cartões, gráficos, comandos, consultas, alertas | ✅ |

## Hardware real (M6)

| Teste | Resultado |
|---|---|
| Leitura das 2 tomadas Gaya (Tuya v3.3) e da Smartled (Magic Home 0x41), com as chaves lidas do `devices.json` | ✅ potência, corrente e tensão reais |
| Tomada da luminária secundária: desligar/ligar pelo CLI | ✅ |
| Smartled: rampa 100→30 % em 8 s, desligar/ligar, voltar a 100 % | ✅ |
| `mudou_estado`: aparelho alterado por fora do sistema (simulando o app) | ✅ alerta no Gateway em 1–2 s |
| Ciclo pH/CO2 com a **tomada real do CO2**: alerta `ph_baixo` → Gateway desliga o CO2 real no mesmo segundo | ✅ |
| Consultas com energia real (`consumo`, `tempo-ligado`, `variacao`) | ✅ |
| Dashboard: slider e falha simulada na Smartled real | ✅ (depois da correção abaixo) |
| `subir_tudo.ps1 -Backend real` e `parar_tudo.ps1` | ✅ 5 fontes online em < 25 s; nenhum processo restante |
| Estado dos aparelhos restaurado ao final (CO2 e luminárias ligados, Smartled 100 %) | ✅ |

**Não testado no hardware real:** failsafe (F6) e reinício do Gateway (F5) com a tomada real do CO2, para não interferir no timer do aquário. Os dois foram validados no backend simulado, que usa o mesmo código.

## Problemas encontrados e corrigidos

| Problema | Causa | Correção |
|---|---|---|
| Comandos gRPC davam `UNAVAILABLE` | O servidor gRPC do Python era coletado pelo garbage collector (sem referência) | Referência guardada em `Fonte._grpc`; erro explícito se a porta não abrir |
| Falso alarme `ligada_sem_consumo` ao ligar a tomada real | A tomada Gaya leva ~30 s para atualizar a potência | Espera aumentada de 10 s para 60 s |
| Segundo movimento do slider do dashboard não era enviado | O handler lia um estado antigo do React | Lê o valor direto do elemento; teclado também envia |
| Fontes que sobem depois do Gateway esperavam até 30 s | Descoberta periódica de 30 s | `subir_tudo.ps1` sobe as fontes antes do Gateway |
| Evento detectado antes de o Gateway ser conhecido era perdido | O detector consumia o alerta sem ter para quem enviar | Eventos só são avaliados depois da descoberta |
| Primeira leitura saía 10 s depois da descoberta; hora do log sem segundos quando `:00` | Detalhes de implementação | Corrigidos |
