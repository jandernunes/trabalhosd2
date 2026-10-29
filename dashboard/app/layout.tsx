import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aquário Plantado Inteligente",
  description: "Monitoramento e controle do aquário (Gateway via TCP + Protobuf)",
};

// Aplica o tema salvo (ou o do sistema) antes da primeira pintura, para não piscar.
const scriptTema = `(function(){try{var t=localStorage.getItem("tema");if(t!=="claro"&&t!=="escuro"){t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro"}document.documentElement.dataset.tema=t}catch(e){document.documentElement.dataset.tema="claro"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
