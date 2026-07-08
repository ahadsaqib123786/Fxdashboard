import "../styles/globals.css";
import Link from "next/link";

export default function App({ Component, pageProps }) {
  return (
    <div>
      <nav className="nav">
        <span className="brand">FX Dashboard</span>
        <Link href="/">Dashboard</Link>
        <Link href="/analysis">AI Analysis</Link>
        <Link href="/news">News</Link>
      </nav>
      <main className="main">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
