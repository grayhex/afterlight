import Link from "next/link";

export default function Wireframes() {
  return (
    <>
      <h1>Wireframes</h1>
      <ul>
        <li><Link href="/wireframes/owner">Кабинет владельца</Link></li>
        <li><Link href="/wireframes/verifier">Кабинет верификатора</Link></li>
        <li><Link href="/wireframes/recipient">Вид получателя</Link></li>
      </ul>
    </>
  );
}
