const QUOTES = [
  "Small steps every day.",
  "Follow up like a pro.",
  "Activity beats talent when talent doesn’t act.",
  "Be the reason a customer smiles today.",
  "Calls create chances."
];

export default function QuoteOfDay() {
  const d = new Date();
  const idx = (d.getFullYear() * 1000 + (d.getMonth() + 1) * 50 + d.getDate()) % QUOTES.length;
  return <div className="text-xs italic opacity-80">{QUOTES[idx]}</div>;
}