// Cliente TCP do Gateway, usado só pelos Route Handlers (roda no servidor Node, nunca no navegador).
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import protobuf from "protobufjs";
import { enquadrar, extrair } from "./framing";

// O mesmo .proto da equipe, carregado em tempo de execução (sem geração de código).
const root = protobuf.parse(fs.readFileSync(path.join(process.cwd(), "..", "proto", "aquario.proto"), "utf8")).root;
const Requisicao = root.lookupType("aquario.Requisicao");
const Resposta = root.lookupType("aquario.Resposta");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Objeto = Record<string, any>;

const [HOST, PORTA] = (process.env.GATEWAY_ADDR ?? "127.0.0.1:50010").split(":");
const TIMEOUT_MS = 3000;

type Pendente = { resolve: (r: Objeto) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

class ConexaoGateway {
  private sock?: net.Socket;
  private buffer: Buffer = Buffer.alloc(0);
  private pendente?: Pendente;
  private fila: Promise<unknown> = Promise.resolve();

  /** A Resposta não tem id de correlação, então as requisições são enviadas uma por vez. */
  enviar(req: Objeto): Promise<Objeto> {
    const executar = () => this.enviarAgora(req);
    const p = this.fila.then(executar, executar);
    this.fila = p.catch(() => undefined);
    return p;
  }

  private conectar(): Promise<net.Socket> {
    if (this.sock && !this.sock.destroyed) return Promise.resolve(this.sock);
    return new Promise((resolve, reject) => {
      const s = net.createConnection({ host: HOST, port: Number(PORTA) });
      s.setTimeout(TIMEOUT_MS, () => s.destroy(new Error("tempo de conexão esgotado")));
      s.once("connect", () => {
        s.setTimeout(0);
        this.sock = s;
        this.buffer = Buffer.alloc(0);
        resolve(s);
      });
      s.on("data", (chunk) => this.receber(chunk));
      s.on("error", (e) => {
        this.falhar(e);
        reject(e);
      });
      s.on("close", () => this.falhar(new Error("conexão fechada pelo gateway")));
    });
  }

  private async enviarAgora(req: Objeto): Promise<Objeto> {
    const sock = await this.conectar();
    const corpo = Requisicao.encode(Requisicao.fromObject(req)).finish();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendente = undefined;
        sock.destroy();
        reject(new Error("gateway não respondeu em 3 s"));
      }, TIMEOUT_MS);
      this.pendente = { resolve, reject, timer };
      sock.write(enquadrar(corpo));
    });
  }

  private receber(chunk: Buffer) {
    const { mensagens, resto } = extrair(Buffer.concat([this.buffer, chunk]));
    this.buffer = resto;
    for (const m of mensagens) {
      const p = this.pendente;
      if (!p) continue;
      clearTimeout(p.timer);
      this.pendente = undefined;
      p.resolve(Resposta.toObject(Resposta.decode(m), { enums: String, longs: Number, defaults: true, oneofs: true }));
    }
  }

  private falhar(e: Error) {
    this.sock = undefined;
    this.buffer = Buffer.alloc(0);
    const p = this.pendente;
    if (p) {
      clearTimeout(p.timer);
      this.pendente = undefined;
      p.reject(e);
    }
  }
}

// Uma conexão só por processo (sobrevive ao hot reload do `next dev`).
const global = globalThis as unknown as { __gateway?: ConexaoGateway };
export const gateway = (global.__gateway ??= new ConexaoGateway());
