// Ten plik to Root Layout Next.js — opakowuje każdą stronę aplikacji
// Navbar i globals.css ładują się raz i są wspólne dla wszystkich tras
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Project-N",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>
        <div className="app-wrapper">
          <Navbar />
          {children} {/* tutaj Next.js wstrzykuje aktualną stronę */}
        </div>
      </body>
    </html>
  );
}
