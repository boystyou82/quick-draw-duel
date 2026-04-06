import DuelGame from "@/components/DuelGame";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Quick Draw Duel - Reaction Time Test",
  description:
    "Western-style 1v1 reaction duel game. Test your reflexes against another player - the fastest gun wins!",
  applicationCategory: "Game",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DuelGame />
    </main>
  );
}
