import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retro Football Manager",
  description: "Een klassieke voetbalmanager, opnieuw opgebouwd voor het web.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
