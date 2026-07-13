import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "田中メモ", description: "気づきを、次のアクションへ。" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="ja"><body>{children}</body></html>; }
