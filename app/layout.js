import "./globals.css";

export const metadata = {
  title: "ROTW — Roommate of the Week",
  description: "The little things deserve to be remembered.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
