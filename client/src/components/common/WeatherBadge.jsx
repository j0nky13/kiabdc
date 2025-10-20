import { useEffect, useState } from 'react';
import {
  Sun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudOff
} from 'lucide-react';

const codeMap = {
  0: { label: 'Clear', icon: Sun },
  1: { label: 'Mainly clear', icon: Sun },
  2: { label: 'Partly cloudy', icon: Cloud },
  3: { label: 'Overcast', icon: Cloud },
  45: { label: 'Fog', icon: CloudFog },
  48: { label: 'Depositing rime fog', icon: CloudFog },
  51: { label: 'Drizzle', icon: CloudDrizzle },
  53: { label: 'Drizzle', icon: CloudDrizzle },
  55: { label: 'Drizzle', icon: CloudDrizzle },
  61: { label: 'Rain', icon: CloudRain },
  63: { label: 'Rain', icon: CloudRain },
  65: { label: 'Rain', icon: CloudRain },
  66: { label: 'Freezing rain', icon: CloudRain },
  67: { label: 'Freezing rain', icon: CloudRain },
  71: { label: 'Snow', icon: CloudSnow },
  73: { label: 'Snow', icon: CloudSnow },
  75: { label: 'Snow', icon: CloudSnow },
  77: { label: 'Snow grains', icon: CloudSnow },
  80: { label: 'Rain showers', icon: CloudDrizzle },
  81: { label: 'Rain showers', icon: CloudDrizzle },
  82: { label: 'Rain showers', icon: CloudDrizzle },
  85: { label: 'Snow showers', icon: CloudSnow },
  86: { label: 'Snow showers', icon: CloudSnow },
  95: { label: 'Thunderstorm', icon: CloudLightning },
  96: { label: 'Thunderstorm', icon: CloudLightning },
  99: { label: 'Thunderstorm', icon: CloudLightning }
};

export default function WeatherBadge() {
  const [state, setState] = useState({ loading: true, temp: null, cond: '', icon: null, err: '' });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Coordinates for Charleston, SC
        const latitude = 32.78;
        const longitude = -79.93;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const res = await fetch(url);
        const data = await res.json();
        const cw = data.current_weather;

        // Convert Celsius to Fahrenheit
        const tempF = (cw.temperature * 9) / 5 + 32;
        const weatherInfo = codeMap[cw.weathercode] || { label: 'Weather', icon: CloudOff };
        setState({ loading: false, temp: tempF, cond: weatherInfo.label, icon: weatherInfo.icon, err: '' });
      } catch (err) {
        setState({ loading: false, temp: null, cond: '', icon: CloudOff, err: 'Weather unavailable' });
      }
    };
    fetchWeather();
  }, []);

  if (state.loading) {
    return <div className="text-sm opacity-70">Loading weather…</div>;
  }
  if (state.err) {
    return <div className="text-sm opacity-60 flex items-center gap-2"><CloudOff size={16} /> {state.err}</div>;
  }

  const Icon = state.icon || CloudOff;

  return (
    <div className="text-sm flex items-center gap-2">
      <Icon size={16} className="text-sky-400" />
      <span>{state.cond}</span>
      <span className="opacity-70">•</span>
      <span>{Math.round(state.temp)}° F</span>
    </div>
  );
}