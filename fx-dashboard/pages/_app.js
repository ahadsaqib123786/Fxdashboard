import "../styles/globals.css";
import Link from "next/link";
import { useRouter } from "next/router";
import SessionClock from "../components/SessionClock";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isActive = (path) => (router.pathname === path ? "active" : "");

  return (
    <div>
      <nav className="nav">
        <div className="nav-left">
          <span className="brand">
            <span className="brand-mark" />
            Atlas
          </span>
          <div className="nav-links">
            <Link href="/" className={isActive("/")}>Market Pulse</Link>
            <Link href="/analysis" className={isActive("/analysis")}>AI Analysis</Link>
            <Link href="/news" className={isActive("/news")}>News</Link>
          </div>
        </div>
        <SessionClock />
      </nav>
      <main className="main">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
