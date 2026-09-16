import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivacyGuard AI — AI Agent phát hiện & Masking PII phục vụ tuân thủ",
  description: "Trợ lý AI bảo vệ dữ liệu cá nhân với Tool Calling và Human-in-the-loop.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className="h-screen w-screen overflow-hidden bg-white text-neutral-900 font-sans antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
