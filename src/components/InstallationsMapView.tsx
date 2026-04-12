import { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, MapPin } from "lucide-react";
import type { ClientStore } from "@/hooks/useMultiClientData";
import type { Schedule } from "@/types/schedule";
import "leaflet/dist/leaflet.css";

interface Props {
  stores: ClientStore[];
  scheduleMap: Record<string, Schedule>;
  storeOccurrenceStatus: Record<string, boolean>;
  photosByStore: Record<string, any[]>;
}

/** Auto-fit bounds when markers change */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      const L = (window as any).L;
      if (L) map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
}

async function geocodeStore(store: ClientStore): Promise<{ lat: number; lng: number } | null> {
  const parts = [store.street, store.number, store.city, store.state].filter(Boolean);
  if (parts.length < 2) return null;
  const q = parts.join(", ") + ", Brasil";
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "ProduzAI/1.0" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocode error for", store.name, e);
  }
  return null;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function InstallationsMapView({ stores, scheduleMap, storeOccurrenceStatus, photosByStore }: Props) {
  const [geocodingProgress, setGeocodingProgress] = useState<{ done: number; total: number } | null>(null);
  const [localCoords, setLocalCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const geocodingRef = useRef(false);

  // Build initial coords from stores that already have lat/lng
  useEffect(() => {
    const initial: Record<string, { lat: number; lng: number }> = {};
    stores.forEach((s) => {
      const lat = (s as any).latitude;
      const lng = (s as any).longitude;
      if (lat != null && lng != null) {
        initial[s.id] = { lat, lng };
      }
    });
    setLocalCoords(initial);
  }, [stores]);

  // Auto-geocode stores without coordinates
  useEffect(() => {
    if (geocodingRef.current) return;
    geocodingRef.current = true;

    const needsGeocode = stores.filter(
      (s) => (s as any).latitude == null || (s as any).longitude == null
    );
    if (needsGeocode.length === 0) return;

    setGeocodingProgress({ done: 0, total: needsGeocode.length });

    (async () => {
      for (let i = 0; i < needsGeocode.length; i++) {
        const store = needsGeocode[i];
        const coords = await geocodeStore(store);
        if (coords) {
          // Save to DB
          await supabase
            .from("client_stores")
            .update({ latitude: coords.lat, longitude: coords.lng } as any)
            .eq("id", store.id);
          setLocalCoords((prev) => ({ ...prev, [store.id]: coords }));
        }
        setGeocodingProgress({ done: i + 1, total: needsGeocode.length });
        // Nominatim rate limit: 1 req/sec
        if (i < needsGeocode.length - 1) await delay(1100);
      }
      setGeocodingProgress(null);
    })();
  }, [stores]);

  const markerData = useMemo(() => {
    return stores
      .filter((s) => localCoords[s.id])
      .map((s) => {
        const coords = localCoords[s.id];
        const schedule = scheduleMap[s.id];
        const isCompleted = !!schedule?.completed_at;
        const hasOccurrence = !!storeOccurrenceStatus[s.id];
        let color = "#f59e0b"; // amber = pending
        let status = "Pendente";
        if (isCompleted) {
          color = "#22c55e";
          status = "Concluída";
        } else if (hasOccurrence) {
          color = "#ef4444";
          status = "Com ocorrência";
        }
        return { store: s, lat: coords.lat, lng: coords.lng, color, status };
      });
  }, [stores, localCoords, scheduleMap, storeOccurrenceStatus]);

  const positions = useMemo(
    () => markerData.map((m) => [m.lat, m.lng] as [number, number]),
    [markerData]
  );

  const missingCount = stores.length - Object.keys(localCoords).length;

  return (
    <div className="space-y-2">
      {geocodingProgress && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <MapPin className="w-4 h-4 text-primary animate-pulse" />
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              Geocodificando lojas… {geocodingProgress.done}/{geocodingProgress.total}
            </p>
            <Progress
              value={(geocodingProgress.done / geocodingProgress.total) * 100}
              className="h-2"
            />
          </div>
        </div>
      )}

      {!geocodingProgress && missingCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {missingCount} {missingCount === 1 ? "loja sem coordenadas" : "lojas sem coordenadas"} (endereço insuficiente para geocodificar)
        </div>
      )}

      <div className="rounded-lg overflow-hidden border" style={{ height: 550 }}>
        <MapContainer
          center={[-14.235, -51.925]}
          zoom={4}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={positions} />
          {markerData.map((m) => (
            <CircleMarker
              key={m.store.id}
              center={[m.lat, m.lng]}
              radius={8}
              pathOptions={{ color: m.color, fillColor: m.color, fillOpacity: 0.7, weight: 2 }}
            >
              <Popup>
                <div className="text-sm space-y-1 min-w-[160px]">
                  <p className="font-semibold">{m.store.nickname || m.store.name}</p>
                  {m.store.store_code && (
                    <p className="text-xs text-muted-foreground">Cód: {m.store.store_code}</p>
                  )}
                  <p className="text-xs">
                    {[m.store.city, m.store.state].filter(Boolean).join("/")}
                  </p>
                  <p className="text-xs font-medium" style={{ color: m.color }}>
                    {m.status}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
