import {
  RADAR_DISCLAIMER,
  formatSpeedMph,
  formatTemperatureF,
  radarTileTemplate,
  type RadarCatalog,
  type WeatherForecast,
} from '@huntos/core';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkyRadarMap } from '@/components/sky-radar-map';
import { Colors, Nomad } from '@/constants/theme';
import { fetchRadarCatalog, fetchWeatherForecast } from '@/src/api';
import { compassPoint, temperatureLabel, weatherCodeLabel, windLabel } from '@/src/format';
import { useFieldStore } from '@/src/store';
import { useFieldLocation } from '@/src/use-field-location';

export default function SkyScreen() {
  useFieldLocation();
  const gps = useFieldStore((state) => state.gps);
  const storeWeather = useFieldStore((state) => state.weather);
  const [forecast, setForecast] = useState<WeatherForecast | undefined>();
  const [radar, setRadar] = useState<RadarCatalog | undefined>();
  const latitude = gps.latitude;
  const longitude = gps.longitude;

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    void fetchWeatherForecast(latitude, longitude).then(setForecast);
    void fetchRadarCatalog().then(setRadar);
  }, [latitude, longitude]);

  const current = forecast?.current ?? storeWeather;
  const radarUrl = useMemo(() => {
    if (!radar) return undefined;
    const frame = radar.frames[Math.max(0, radar.nowcastStartIndex - 1)];
    if (!frame) return undefined;
    return radarTileTemplate(radar.host, frame.path);
  }, [radar]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>NOMAD</Text>
          <Text style={styles.title}>Sky</Text>
        <Text style={styles.subtitle}>
            Open-Meteo forecast at your GPS fix. Radar is observed reflectivity, not a site forecast.
          </Text>
        </View>

        {latitude != null && longitude != null ? (
          <SkyRadarMap
            latitude={latitude}
            longitude={longitude}
            radarUrl={radarUrl}
            windFrom={current?.windDirectionFromDegrees}
          />
        ) : (
          <View style={styles.radarFallback}>
            <Text style={styles.quiet}>Waiting on a GPS fix for radar.</Text>
          </View>
        )}

        <View style={styles.nowRow}>
          <WindArrow degrees={current?.windDirectionFromDegrees} />
          <View style={styles.nowCopy}>
            <Text style={styles.temp}>{temperatureLabel(current)}</Text>
            <Text style={styles.body}>{windLabel(current)}</Text>
            {current?.humidityPct != null ? (
              <Text style={styles.quiet}>{Math.round(current.humidityPct)}% humidity</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.group}>7-day</Text>
        {(forecast?.daily ?? []).map((day) => (
          <View key={day.date} style={styles.day}>
            <Text style={styles.dayName}>
              {new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.daySky}>{weatherCodeLabel(day.weatherCode)}</Text>
            <Text style={styles.dayTemp}>
              {day.temperatureMaxC != null ? formatTemperatureF(day.temperatureMaxC) : '—'} /{' '}
              {day.temperatureMinC != null ? formatTemperatureF(day.temperatureMinC) : '—'}
            </Text>
            <Text style={styles.quiet}>
              {day.windDirectionFromDegrees != null ? compassPoint(day.windDirectionFromDegrees) : 'Wind'}{' '}
              {day.windSpeedMps != null ? formatSpeedMph(day.windSpeedMps) : 'unknown'}
              {day.precipitationMm != null ? ` · ${day.precipitationMm.toFixed(1)} mm` : ''}
            </Text>
          </View>
        ))}

        <Text style={styles.group}>Next 12 hours</Text>
        {(current?.hourly ?? []).slice(0, 12).map((hour) => (
          <View key={hour.time} style={styles.hour}>
            <Text style={styles.hourTime}>
              {new Date(hour.time).toLocaleTimeString([], { hour: 'numeric' })}
            </Text>
            <Text style={styles.body}>
              {hour.temperatureC != null ? formatTemperatureF(hour.temperatureC) : '—'}
            </Text>
            <Text style={styles.quiet}>
              {hour.windDirectionFromDegrees != null ? compassPoint(hour.windDirectionFromDegrees) : '—'}{' '}
              {hour.windSpeedMps != null ? formatSpeedMph(hour.windSpeedMps) : ''}
            </Text>
          </View>
        ))}

        <Text style={styles.warn}>{RADAR_DISCLAIMER}</Text>
        <Text style={styles.quiet}>Weather data by Open-Meteo.com. Radar by RainViewer.com.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function WindArrow({ degrees }: { degrees?: number | null }) {
  if (degrees == null || !Number.isFinite(degrees)) {
    return (
      <View style={styles.arrowWrap}>
        <Text style={styles.quiet}>Wind</Text>
      </View>
    );
  }
  return (
    <View style={styles.arrowWrap}>
      <View style={[styles.arrow, { transform: [{ rotate: `${degrees}deg` }] }]} />
      <Text style={styles.arrowLabel}>{compassPoint(degrees)}</Text>
      <Text style={styles.quiet}>from</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Nomad.ink,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  header: {
    marginBottom: 6,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Nomad.line,
  },
  kicker: {
    color: Nomad.rust,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: Nomad.bone,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: Colors.dark.muted,
    fontSize: 14,
    marginTop: 4,
  },
  radarFallback: {
    height: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Nomad.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Nomad.steel,
  },
  nowRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: Nomad.steel,
    borderWidth: 1,
    borderColor: Nomad.line,
    borderRadius: 14,
    padding: 14,
  },
  nowCopy: {
    flex: 1,
    gap: 2,
  },
  temp: {
    color: Nomad.bone,
    fontSize: 28,
    fontWeight: '800',
  },
  body: {
    color: Colors.dark.text,
    fontSize: 15,
  },
  quiet: {
    color: Colors.dark.muted,
    fontSize: 12,
  },
  group: {
    color: Nomad.mist,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  day: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingVertical: 10,
    gap: 2,
  },
  dayName: {
    color: Nomad.bone,
    fontWeight: '700',
  },
  daySky: {
    color: Nomad.rust,
    fontWeight: '700',
  },
  dayTemp: {
    color: Colors.dark.text,
  },
  hour: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  hourTime: {
    color: Nomad.mist,
    width: 64,
    fontWeight: '700',
  },
  warn: {
    color: '#ffd166',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  arrowWrap: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Nomad.rust,
  },
  arrowLabel: {
    color: Nomad.bone,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
