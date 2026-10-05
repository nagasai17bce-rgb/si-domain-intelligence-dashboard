import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: ".si Domain Intelligence",
  description: "Bulk .si domain availability and opportunity dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
