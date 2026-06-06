import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Footer from "@/components/footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "ATTO SOUND";
const description =
  "ATTO SOUND is a record label, content platform, and social network that discovers, showcases, and monetizes the creativity of incarcerated talent, giving them a way out while connecting them with the world.";

export const metadata: Metadata = {
  metadataBase: new URL("https://attosound.com"),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "ATTO SOUND",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

// Match the browser chrome / status bar to the matte black so there's no
// contrasting "bar" above the page on mobile.
export const viewport: Viewport = {
  themeColor: "#100e10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#100e10] antialiased`}
      >
        {children}
        <Footer />
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          closeButton
          duration={6000}
          // Wider toasts (default is 356px) and larger text so upload
          // status/errors are readable on mobile, where they were easy to
          // miss tucked into the bottom corner.
          style={{ "--width": "min(92vw, 480px)" } as React.CSSProperties}
          toastOptions={{
            style: { fontSize: "1rem", padding: "16px 18px" },
          }}
        />
      </body>
    </html>
  );
}
