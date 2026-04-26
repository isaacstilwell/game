import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Approach Vector",
  description: "A first-person rail shooter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-black">{children}</body>
    </html>
  );
}
