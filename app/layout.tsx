import type { Metadata } from "next";
import type { ReactNode } from "react";
import BackupRestore from "../components/BackupRestore";
import "./globals.css";

export const metadata: Metadata = { title: "Work Board", description: "気づきを、次のアクションへ。" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ja"><body>{children}<BackupRestore /></body></html>;
}
