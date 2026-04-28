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
          {children}
        </div>
      </body>
    </html>
  );
}
