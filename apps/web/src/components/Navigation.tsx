import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="bg-mist">
      <div className="container flex flex-wrap gap-4 p-4">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/wireframes" className="hover:underline">Wireframes</Link>
        <Link href="/playground" className="hover:underline">Playground</Link>
      </div>
    </nav>
  );
}
