import { useAuth } from "../../context/AuthContext";
import WeatherBadge from "./WeatherBadge";

export default function TopBar() {
  const { user } = useAuth();
  const name = user?.name || 'there';

  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <h1 className="text-xl font-semibold">Good {getPartOfDay()}, {name}</h1>
        <div className="mt-1 opacity-80">
          <WeatherBadge />
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-sm opacity-80">Online</span>
      </div>
    </div>
  );
}

function getPartOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}