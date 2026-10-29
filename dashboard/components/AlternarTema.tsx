"use client";

import { useEffect, useState } from "react";
import Icone from "./Icone";

type Tema = "claro" | "escuro";

export default function AlternarTema() {
  // O tema inicial é aplicado no <head> (layout.tsx), antes da hidratação; aqui só lemos o que ficou.
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    setTema(document.documentElement.dataset.tema === "escuro" ? "escuro" : "claro");
  }, []);

  function alternar() {
    const novo: Tema = tema === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {}
    setTema(novo);
  }

  const rotulo = tema === "escuro" ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button className="botao-icone" onClick={alternar} aria-label={rotulo} title={rotulo}>
      {tema && <Icone nome={tema === "escuro" ? "sol" : "lua"} />}
    </button>
  );
}
