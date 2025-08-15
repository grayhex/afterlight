export default function Header() {
  return (
    <header
      className="border-b border-white/10 backdrop-blur sticky top-0 z-50"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--brand-bg, #0e1116) 80%, transparent)",
      }}
    >
      <div className="container py-4 text-center md:text-left">
        <h1 className="text-xl font-semibold">AfterLight</h1>
      </div>
    </header>
  );
}
