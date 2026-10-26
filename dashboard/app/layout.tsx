import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aquário Plantado Inteligente",
  description: "Monitoramento e controle do aquário (Gateway via TCP + Protobuf)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
