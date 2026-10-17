import { useCallback, useEffect, useRef, useState } from 'react';

const CACHE_KEY = 'velon-device-place';

export type DevicePlace = {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
};

type LocationStatus = 'locating' | 'live' | 'denied' | 'unavailable';

function readCache(): DevicePlace | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DevicePlace>;
    if (typeof parsed.city !== 'string' || typeof parsed.latitude !== 'number') return null;
    if (!parsed.city.trim() && !parsed.region?.trim()) return null;
    return {
      city: parsed.city,
      region: typeof parsed.region === 'string' ? parsed.region : '',
      country: typeof parsed.country === 'string' ? parsed.country : '',
      latitude: parsed.latitude,
      longitude: typeof parsed.longitude === 'number' ? parsed.longitude : 0,
    };
  } catch {
    return null;
  }
}

function writeCache(place: DevicePlace) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(place));
  } catch {
    /* ignore quota / private mode */
  }
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePlace(cityRaw: string, regionRaw: string, country: string) {
  const same = cityRaw && regionRaw && cityRaw.toLowerCase() === regionRaw.toLowerCase();
  const city = cityRaw || regionRaw || country;
  const region = cityRaw && regionRaw && !same ? regionRaw : '';
  const shownCountry = city.toLowerCase() === country.toLowerCase() ? '' : country;
  if (!city) return null;
  return { city, region, country: shownCountry };
}

function placeFromBigDataCloud(data: Record<string, unknown>) {
  return normalizePlace(
    text(data.city) || text(data.locality),
    text(data.principalSubdivision),
    text(data.countryName),
  );
}

function placeFromNominatim(data: Record<string, unknown>) {
  const address =
    data.address && typeof data.address === 'object'
      ? (data.address as Record<string, unknown>)
      : {};
  return normalizePlace(
    text(address.city) ||
      text(address.town) ||
      text(address.village) ||
      text(address.municipality) ||
      text(address.suburb),
    text(address.state) || text(address.region) || text(address.county),
    text(address.country),
  );
}

async function reverseGeocode(latitude: number, longitude: number) {
  const bigData = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  bigData.searchParams.set('latitude', String(latitude));
  bigData.searchParams.set('longitude', String(longitude));
  bigData.searchParams.set('localityLanguage', 'en');
  try {
    const response = await fetch(bigData);
    if (response.ok) {
      const place = placeFromBigDataCloud((await response.json()) as Record<string, unknown>);
      if (place) return place;
    }
  } catch {
    /* try the fallback geocoder */
  }

  const nominatim = new URL('https://nominatim.openstreetmap.org/reverse');
  nominatim.searchParams.set('format', 'jsonv2');
  nominatim.searchParams.set('lat', String(latitude));
  nominatim.searchParams.set('lon', String(longitude));
  nominatim.searchParams.set('zoom', '10');
  nominatim.searchParams.set('accept-language', 'en');
  const response = await fetch(nominatim, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not resolve this location');
  const place = placeFromNominatim((await response.json()) as Record<string, unknown>);
  if (!place) throw new Error('Could not resolve this location');
  return place;
}

export function useDeviceLocation() {
  const [place, setPlace] = useState<DevicePlace | null>(null);
  const [status, setStatus] = useState<LocationStatus>('locating');
  const lastPoint = useRef<{ latitude: number; longitude: number } | null>(null);
  const requestId = useRef(0);

  const applyPosition = useCallback(async (coords: GeolocationCoordinates, force: boolean) => {
    const nextPoint = { latitude: coords.latitude, longitude: coords.longitude };
    if (!force && lastPoint.current && distanceMeters(lastPoint.current, nextPoint) < 500) {
      setStatus('live');
      return;
    }
    const currentRequest = ++requestId.current;
    const named = await reverseGeocode(nextPoint.latitude, nextPoint.longitude);
    if (currentRequest !== requestId.current) return;
    const next: DevicePlace = { ...named, ...nextPoint };
    lastPoint.current = nextPoint;
    writeCache(next);
    setPlace(next);
    setStatus('live');
  }, []);

  const refresh = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus(place ? 'live' : 'unavailable');
      return;
    }
    setStatus((current) => (current === 'live' ? current : 'locating'));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void applyPosition(position.coords, true).catch(() => {
          setStatus((current) => (current === 'live' ? 'live' : 'unavailable'));
        });
      },
      (error) => {
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? place
              ? 'live'
              : 'denied'
            : place
              ? 'live'
              : 'unavailable',
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }, [applyPosition, place]);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setPlace(cached);
      setStatus('live');
      lastPoint.current = cached;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus(cached ? 'live' : 'unavailable');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void applyPosition(position.coords, false).catch(() => {
          setStatus((current) => (current === 'live' ? 'live' : 'unavailable'));
        });
      },
      (error) => {
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? lastPoint.current
              ? 'live'
              : 'denied'
            : lastPoint.current
              ? 'live'
              : 'unavailable',
        );
      },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 20_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      requestId.current += 1;
    };
  }, [applyPosition]);

  return { place, status, refresh };
}
