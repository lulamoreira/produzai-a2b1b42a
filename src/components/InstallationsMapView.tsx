import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, MapPin } from "lucide-react";
import type { ClientStore } from "@/hooks/useMultiClientData";
import type { Schedule } from "@/types/schedule";
import "leaflet/dist/leaflet.css";

interface Props {
  stores: ClientStore[];
  scheduleMap: Record<string, Schedule>;
  storeOccurrenceStatus: Record<string, { hasOccurrence: boolean; allResolved: boolean; count: number }>;
  photosByStore: Record<string, unknown[]>;
}

const DEFAULT_CENTER: L.LatLngExpression = [-14.235, -51.925];
const DEFAULT_ZOOM = 4;
const MARKER_COLORS = {
  pending: "#f59e0b",
  completed: "#22c55e",
  occurrence: "#ef4444",
} as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function geocodeStore(store: ClientStore): Promise<{ lat: number; lng: number } | null> {
  const queryParts = [store.city, store.state, store.street].filter(Boolean);
  if (queryParts.length < 2) return null;

  const query = `${queryParts.join(", ")}, Brasil`;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) return null;

    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;

    if (!first?.lat || !first?.lon) return null;

    return {
      lat: Number(first.lat),
      lng: Number(first.lon),
    };
  } catch (error) {
    console.error("Geocode error", { storeId: store.id, error });
    return null;
  }
}

export default function InstallationsMapView({ stores, scheduleMap, storeOccurrenceStatus }: Props) {
  const [geocodingProgress, setGeocodingProgress] = useState<{ done: number; total: number } | null>(null);
  const [localCoords, setLocalCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const geocodingInFlightRef = useRef(false);

  useEffect(() => {
    const initialCoords: Record<string, { lat: number; lng: number }> = {};

    stores.forEach((store) => {
      const latitude = (store as ClientStore & { latitude?: number | null }).latitude;
      const longitude = (store as ClientStore & { longitude?: number | null }).longitude;

      if (latitude != null && longitude != null) {
        initialCoords[store.id] = { lat: latitude, lng: longitude };
      }
    });

    setLocalCoords((prev) => ({ ...initialCoords, ...prev }));
  }, [stores]);

  useEffect(() => {
    let cancelled = false;

    async function runGeocoding() {
      if (geocodingInFlightRef.current) return;

      const pendingStores = stores.filter((store) => {
        const latitude = (store as ClientStore & { latitude?: number | null }).latitude;
        const longitude = (store as ClientStore & { longitude?: number | null }).longitude;
        return latitude == null || longitude == null;
      }).filter((store) => !localCoords[store.id]);

      if (pendingStores.length === 0) {
        setGeocodingProgress(null);
        return;
      }

      geocodingInFlightRef.current = true;
      setGeocodingProgress({ done: 0, total: pendingStores.length });

      try {
        for (let index = 0; index < pendingStores.length; index += 1) {
          if (cancelled) break;

          const store = pendingStores[index];
          const coordinates = await geocodeStore(store);

          if (coordinates && !cancelled) {
            setLocalCoords((prev) => ({ ...prev, [store.id]: coordinates }));

            const { error } = await supabase
              .from("client_stores")
              .update({ latitude: coordinates.lat, longitude: coordinates.lng })
              .eq("id", store.id);

            if (error) {
              console.error("Failed to save geocoded coordinates", { storeId: store.id, error });
            }
          }

          if (!cancelled) {
            setGeocodingProgress({ done: index + 1, total: pendingStores.length });
          }

          if (index < pendingStores.length - 1) {
            await delay(1000);
          }
        }
      } finally {
        geocodingInFlightRef.current = false;
        if (!cancelled) {
          setGeocodingProgress(null);
        }
      }
    }

    void runGeocoding();

    return () => {
      cancelled = true;
    };
  }, [stores, localCoords]);

  const markerData = useMemo(() => {
    return stores
      .filter((store) => localCoords[store.id])
      .map((store) => {
        const coordinates = localCoords[store.id];
        const schedule = scheduleMap[store.id];
        const occurrenceState = storeOccurrenceStatus[store.id];
        const hasOpenOccurrence = !!occurrenceState?.hasOccurrence && !occurrenceState?.allResolved;
        const isCompleted = !!schedule?.completed_at;

        let color = MARKER_COLORS.pending;
        let status = "Pendente";

        if (hasOpenOccurrence) {
          color = MARKER_COLORS.occurrence;
          status = "Com ocorrência";
        } else if (isCompleted) {
          color = MARKER_COLORS.completed;
          status = "Concluída";
        }

        return {
          id: store.id,
          lat: coordinates.lat,
          lng: coordinates.lng,
          color,
          status,
          name: store.nickname || store.name,
          code: store.store_code || "—",
          cityState: [store.city, store.state].filter(Boolean).join("/") || "—",
        };
      });
  }, [stores, localCoords, scheduleMap, storeOccurrenceStatus]);

  const missingCount = stores.length - markerData.length;

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(resizeTimer);
      markersLayerRef.current?.clearLayers();
      markersLayerRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;

    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    markerData.forEach((marker) => {
      const circle = L.circleMarker([marker.lat, marker.lng], {
        radius: 8,
        color: marker.color,
        fillColor: marker.color,
        fillOpacity: 0.72,
        weight: 2,
      });

      const popupHtml = `
        <div style="min-width:160px; font-size:13px; line-height:1.4;">
          <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(marker.name)}</div>
          <div style="color:#6b7280; font-size:12px; margin-bottom:2px;">Cód: ${escapeHtml(marker.code)}</div>
          <div style="font-size:12px; margin-bottom:4px;">${escapeHtml(marker.cityState)}</div>
          <div style="font-size:12px; font-weight:600; color:${marker.color};">${escapeHtml(marker.status)}</div>
        </div>
      `;

      circle.bindPopup(popupHtml);
      circle.addTo(layerGroup);
      bounds.extend([marker.lat, marker.lng]);
    });

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();

      if (markerData.length === 1) {
        const first = markerData[0];
        map.setView([first.lat, first.lng], 13);
      } else if (markerData.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
    }, 50);

    return () => {
      window.clearTimeout(resizeTimer);
    };
  }, [markerData]);

  return (
    <div className="space-y-2">
      {geocodingProgress && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <MapPin className="h-4 w-4 animate-pulse text-primary" />
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              Geocodificando lojas… {geocodingProgress.done}/{geocodingProgress.total}
            </p>
            <Progress value={(geocodingProgress.done / geocodingProgress.total) * 100} className="h-2" />
          </div>
        </div>
      )}

      {!geocodingProgress && missingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {missingCount} {missingCount === 1 ? "loja sem coordenadas" : "lojas sem coordenadas"} (endereço insuficiente para geocodificar)
        </div>
      )}

      <div ref={mapContainerRef} className="h-[550px] overflow-hidden rounded-lg border" />
    </div>
  );
}
