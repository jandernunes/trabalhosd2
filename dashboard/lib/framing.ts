export function enquadrar(corpo: Uint8Array): Buffer {
  const cabecalho = Buffer.alloc(4);
  cabecalho.writeUInt32BE(corpo.length, 0);
  return Buffer.concat([cabecalho, Buffer.from(corpo)]);
}

export function extrair(buffer: Buffer): { mensagens: Buffer[]; resto: Buffer } {
  const mensagens: Buffer[] = [];
  let b = buffer;
  while (b.length >= 4) {
    const n = b.readUInt32BE(0);
    if (b.length < 4 + n) break;
    mensagens.push(b.subarray(4, 4 + n));
    b = b.subarray(4 + n);
  }
  return { mensagens, resto: b };
}
