import "./globals.css";

export const metadata = {
  title: "ROTW",
  description: "Weekly posts, voting, and results.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
