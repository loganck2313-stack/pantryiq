import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PantryIQ | Your kitchen, in rhythm",
  description: "A thoughtful recipe box and kitchen companion.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}