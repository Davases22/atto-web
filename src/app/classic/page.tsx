import Hero from "@/components/sections/hero";

/**
 * The previous landing page, kept reachable while the new one sits at the
 * root. Nothing was removed: this is the same Hero the home used to render.
 */
export default function ClassicHome() {
  return (
    <main>
      <Hero />
    </main>
  );
}
