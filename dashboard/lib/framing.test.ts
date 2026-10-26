import { test } from "node:test";
import assert from "node:assert/strict";
import { enquadrar, extrair } from "./framing.ts";

test("duas mensagens no mesmo chunk", () => {
  const dados = Buffer.concat([enquadrar(Buffer.from("abc")), enquadrar(Buffer.from("de"))]);
  const { mensagens, resto } = extrair(dados);
  assert.deepEqual(mensagens.map(String), ["abc", "de"]);
  assert.equal(resto.length, 0);
});

test("mensagem partida em dois chunks", () => {
  const dados = enquadrar(Buffer.from("mensagem longa"));
  const primeiro = extrair(dados.subarray(0, 6));
  assert.equal(primeiro.mensagens.length, 0);
  const segundo = extrair(Buffer.concat([primeiro.resto, dados.subarray(6)]));
  assert.deepEqual(segundo.mensagens.map(String), ["mensagem longa"]);
});
