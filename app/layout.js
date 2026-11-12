import './globals.css';

export const metadata = { title: 'Skills Library', description: 'Browse, search and copy SKILL.md files' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&family=Literata:opsz,wght@7..72,400;7..72,600&family=JetBrains+Mono:wght@400&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
