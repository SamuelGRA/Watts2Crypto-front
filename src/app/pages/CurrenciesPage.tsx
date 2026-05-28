import { useEffect, useMemo, useState, useRef } from 'react';
import { LineChart, ChevronDown, ArrowRightLeft, Loader2 } from 'lucide-react';
import '../styles/electricity-page.css';
import '../styles/currencies-page.css';
import { fetchAllFiatRates, fetchFiatHistory, fetchAllSymbols } from '../../api/monedaTradicionalApi';
import { convertFiatAmount } from '../../api/monedaTradicionalApi';
import { fetchAllCriptomonedas, fetchCriptomonedaHistory, fetchDirectCriptomonedaHistory } from '../../api/criptomonedaApi';
import type { MonedaTradicional } from '../../types/monedaTradicional';
import type { Criptomoneda, CriptomonedaPrecio } from '../../types/criptomoneda';
import { getFiatName } from '../../utils/fiatNames';

type LineSeriesPoint = {
  timestamp: number;
  label: string;
  value: number;
};
type LineSeries = {
  color?: string;
  label: string;
  points: LineSeriesPoint[];
};

// Asegura que los precios vengan como números (evita strings sin formato)
function normalizeCriptoHist(hist: CriptomonedaPrecio[]): CriptomonedaPrecio[] {
  return hist.map(h => ({ ...h, precioEur: Number(h.precioEur) }));
}

function filterCriptoHistByRange(hist: CriptomonedaPrecio[], rangeDays: number): CriptomonedaPrecio[] {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - rangeDays);
  return hist.filter((entry) => {
    const date = new Date(entry.fecha);
    return date >= start && date <= end;
  });
}

type ViewMode = 'fiat' | 'cripto';
const typeLabels: Record<ViewMode, string> = {
  'cripto': 'Criptomonedas',
  'fiat': 'Monedas tradicionales',
}
type RangeDays = 30 | 90 | 180 | 365;

const CONVERTIBLE_CURRENCIES = ['USD', 'GBP', 'JPY', 'CNY', 'RUB', 'AUD', 'CAD', 'CHF', 'HKD', 'BRL'] as const;
type DisplayCurrency = 'EUR' | (typeof CONVERTIBLE_CURRENCIES)[number];

const CRYPTO_CHART_COLORS = ['#33d39f', '#4f7cff', '#f59e0b', '#ef4444'];

const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 30, label: '1m' },
  { value: 90, label: '3m' },
  { value: 180, label: '6m' },
  { value: 365, label: '1y' },
];

// Función auxiliar que añade el punto destacado y el tooltip
function SimpleLineChart({ series }: { series: LineSeries[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; serieIndex: number; x: number; y: number; timestamp: number; label: string; value: number; clientX?: number; clientY?: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const width = 900;
  const height = 280;
  const allPoints = series.flatMap((s) => s.points);
  
  if (!series.length || allPoints.length < 2) {
    return <p className="electricity-chart__empty">No hay datos para mostrar.</p>;
  }

  const values = allPoints.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = Math.max(maxValue - minValue, 1e-6);
  const timestamps = allPoints.map((p) => p.timestamp);
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const timestampSpan = Math.max(maxTimestamp - minTimestamp, 1);

  const yTicks = 4;
  const yLabelValues = Array.from({ length: yTicks + 1 }, (_, index) => {
    const ratio = index / yTicks;
    return maxValue - ratio * valueSpan;
  });
  const yLabelStrings = yLabelValues.map((value) => value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }));
  const widestYLabel = yLabelStrings.reduce((max, label) => Math.max(max, label.length), 0);
  const padding = { top: 28, right: 50, bottom: 46, left: Math.max(54, 18 + widestYLabel * 7) };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xFromTimestamp = (timestamp: number) => {
    const ratio = (timestamp - minTimestamp) / timestampSpan;
    return padding.left + ratio * innerWidth;
  };

  const yFromValue = (value: number) => {
    return padding.top + ((maxValue - value) / valueSpan) * innerHeight;
  };

  const yLabels = Array.from({ length: yTicks + 1 }, (_, index) => {
    const ratio = index / yTicks;
    const value = maxValue - ratio * valueSpan;
    const y = padding.top + ratio * innerHeight;
    return { value, y };
  });

  const xTicks = [0, 1, 2, 3].map((step) => {
    const ratio = step / 3;
    const timestamp = minTimestamp + ratio * timestampSpan;
    const x = padding.left + ratio * innerWidth;
    const label = new Date(timestamp).toLocaleDateString('es-ES');
    return { x, label, isFirst: step === 0, isLast: step === 3 };
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (width / rect.width);
    const mouseY = (e.clientY - rect.top) * (height / rect.height);

    if (mouseX < padding.left || mouseX > width - padding.right || mouseY < padding.top || mouseY > height - padding.bottom) {
      setHoveredPoint(null);
      return;
    }

    // Encontrar el punto más cercano en el eje X
    const timestampAtMouse = minTimestamp + ((mouseX - padding.left) / innerWidth) * timestampSpan;
    
    let closestPoint: { index: number; serieIndex: number; x: number; y: number; timestamp: number; label: string; value: number, clientX: number, clientY: number } | null = null;
    let minDistance = Infinity;

    series.forEach((serie, serieIndex) => {
      serie.points.forEach((point, pointIndex) => {
        const distance = Math.abs(point.timestamp - timestampAtMouse);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = {
            index: pointIndex,
            serieIndex: serieIndex,
            x: xFromTimestamp(point.timestamp),
            y: yFromValue(point.value),
            timestamp: point.timestamp,
            label: point.label,
            value: point.value,
            clientX: e.clientX,
            clientY: e.clientY,
          };
        }
      });
    });

    setHoveredPoint(closestPoint);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        className="electricity-chart"
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Evolución histórica"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'default', display: 'block' }}
      >
        {yLabels.map((tick) => (
          <g key={`y-${tick.y}`}>
            <line x1={padding.left} y1={tick.y} x2={width - padding.right} y2={tick.y} className="electricity-chart__grid" />
            <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" className="electricity-chart__axis-label">
              {tick.value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}
            </text>
          </g>
        ))}
        {series.map((serie) => {
          const polylinePoints = serie.points.map((p) => `${xFromTimestamp(p.timestamp)},${yFromValue(p.value)}`).join(' ');
          return (
            <polyline
              key={serie.label}
              className="electricity-chart__line"
              points={polylinePoints}
              style={serie.color ? { stroke: serie.color } : undefined}
            />
          );
        })}
        {xTicks.map((tick) => (
          <text key={`x-${tick.label}-${tick.x}`} x={tick.x} y={height - 10} textAnchor={tick.isFirst ? 'start' : tick.isLast ? 'end' : 'middle'} className="electricity-chart__axis-label">
            {tick.label}
          </text>
        ))}

        {/* Línea vertical y punto destacado al hacer hover sobre la gráfica */}
        {hoveredPoint && (
          <>
            <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={height - padding.bottom} stroke="rgba(100, 100, 100, 0.3)" strokeWidth="2" strokeDasharray="4,4" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill={series[hoveredPoint.serieIndex]?.color ?? 'var(--primary)'} />
          </>
        )}

        <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} fill="transparent" />
      </svg>

      {/* Tooltip flotante alrededor del cursor */}
      {hoveredPoint && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredPoint.clientX ? hoveredPoint.clientX + 14 : hoveredPoint.x}px`,
            top: `${hoveredPoint.clientY ? hoveredPoint.clientY - 40 : hoveredPoint.y}px`,
            background: 'rgba(0, 0, 0, 0.88)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '13px',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
            transform: 'translateZ(0)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{hoveredPoint.label}</div>
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{hoveredPoint.value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      )}
    </div>
  );
}

export function CurrenciesPage() {
  const [view, setView] = useState<ViewMode>('cripto');
  const [rangeDays, setRangeDays] = useState<RangeDays>(90);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  //Estados de fiats
  const [fiatChangeStatsData, setFiatChangeStatsData] = useState<MonedaTradicional[]>([]);
  const FIATS = ["EUR", "USD", "GBP", "JPY", "CNY", "RUB", "AUD", "CAD", "CHF", "HKD", "BRL"];
  const [nonPersistedFiats, setNonPersistedFiats] = useState<string[]>([]);
  const [selectedFiatBase, setSelectedFiatBase] = useState<string>('EUR');
  const [selectedFiatTarget, setSelectedFiatTarget] = useState<string>('USD');
  const [fiatHistory, setFiatHistory] = useState<MonedaTradicional[]>([]);
  const [isBaseMenuOpen, setIsBaseMenuOpen] = useState(false);
  const [isTargetMenuOpen, setIsTargetMenuOpen] = useState(false);
  const baseMenuRef = useRef<HTMLDivElement | null>(null);
  const baseButtonRef = useRef<HTMLButtonElement | null>(null);
  const targetMenuRef = useRef<HTMLDivElement | null>(null);
  const targetButtonRef = useRef<HTMLButtonElement | null>(null);
  // Buscador de monedas no persistidas (a demanda)
  const [onDemandFiatInput, setOnDemandFiatInput] = useState('');
  const [isOnDemandFiatInputFocused, setIsOnDemandFiatInputFocused] = useState(false);
  const [isOnDemandFiatLoading, setIsOnDemandFiatLoading] = useState(false);
  const [onDemandFiatHistory, setOnDemandFiatHistory] = useState<MonedaTradicional[] | null>(null);
  const [onDemandFiatCache, setOnDemandFiatCache] = useState(() => getCachedOnDemandFiats());

  // estados de criptos
  const CRIPTOS = ['BTC', 'ETC', 'USDT', 'USDC', 'BNB', 'XRP', 'SOL', 'DOGE', 'ADA', 'TRX', 'STETH', 'HYPE', 'XMR', 'LINK', 'ZEC', 'LTC']
  const [criptos, setCriptos] = useState<Criptomoneda[]>([]);
  const [selectedCripto, setSelectedCripto] = useState<string>('BTC');
  const [cryptoSearchInput, setCryptoSearchInput] = useState('');
  const [isCryptoSearchOpen, setIsCryptoSearchOpen] = useState(false);
  const [isOnDemandCryptoLoading, setIsOnDemandCryptoLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<DisplayCurrency>('EUR');
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const currencyButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [currencyRate, setCurrencyRate] = useState(1);
  const currencyRateCacheRef = useRef<Partial<Record<DisplayCurrency, number>>>({ EUR: 1 });
  const [allCriptoCardHistories, setAllCriptoCardHistories] = useState<Record<string, CriptomonedaPrecio[]>>({});
  const [allCriptoChartHistories, setAllCriptoChartHistories] = useState<Record<string, CriptomonedaPrecio[]>>({});
  const [onDemandCryptoChartHistories, setOnDemandCryptoChartHistories] = useState<Record<string, CriptomonedaPrecio[]>>({});
  const [onDemandCryptoCache, setOnDemandCryptoCache] = useState<Record<string, CriptomonedaPrecio[]>>(() => {
    try {
      const raw = sessionStorage.getItem('onDemandCryptoCache');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Carga inicial de monedas
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    if (view === 'fiat') {
      fetchAllFiatRates()
        .then((data) => {
          if (data.length > 0 && !data.some((m) => m.monedaBase === selectedFiatBase)) {
            setSelectedFiatBase(data[0].monedaBase);
          }
        })
        .catch(() => setError('No se pudieron cargar las divisas.'))
        .finally(() => setIsLoading(false));
    } else {
      fetchAllCriptomonedas()
        .then((data) => {
          setCriptos(data);
          if (data.length > 0 && !data.some((c) => c.simbolo === selectedCripto)) {
            setSelectedCripto(data[0].simbolo);
          }
        })
        .catch(() => setError('No se pudieron cargar las criptomonedas.'));
      const endCard = new Date();
      const startCard = new Date();
      startCard.setDate(endCard.getDate() - 30);
      const startCardStr = startCard.toISOString().slice(0, 10);
      const endCardStr = endCard.toISOString().slice(0, 10);
      Promise.all(CRIPTOS.map(simbolo => fetchCriptomonedaHistory(simbolo, startCardStr, endCardStr)
        .then(hist => ({ simbolo, hist }))
        .catch(() => ({ simbolo, hist: [] as CriptomonedaPrecio[] })))).
        then(results => {
          const histories: Record<string, CriptomonedaPrecio[]> = {};
          results.forEach(({ simbolo, hist }) => { histories[simbolo] = normalizeCriptoHist(hist); });
          setAllCriptoCardHistories(histories);
        });
      const endChart = new Date();
      const startChart = new Date();
      startChart.setDate(endChart.getDate() - rangeDays);
      const startChartStr = startChart.toISOString().slice(0, 10);
      const endChartStr = endChart.toISOString().slice(0, 10);
      Promise.all(CRIPTOS.map(simbolo => fetchCriptomonedaHistory(simbolo, startChartStr, endChartStr)
        .then(hist => ({ simbolo, hist }))
        .catch(() => ({ simbolo, hist: [] as CriptomonedaPrecio[] })))).
        then(results => {
          const histories: Record<string, CriptomonedaPrecio[]> = {};
          results.forEach(({ simbolo, hist }) => { histories[simbolo] = normalizeCriptoHist(hist); });
          setAllCriptoChartHistories(histories);
        })
        .finally(() => setIsLoading(false));
    }
  }, [view, rangeDays]);

  useEffect(() => {
    let isCancelled = false;

    const loadCurrencyRate = async () => {
      if (selectedCurrency === 'EUR') {
        setCurrencyRate(1);
        setCurrencyError(null);
        return;
      }

      const cachedRate = currencyRateCacheRef.current[selectedCurrency];
      if (cachedRate) {
        setCurrencyRate(cachedRate);
        setCurrencyError(null);
        return;
      }

      try {
        setIsCurrencyLoading(true);
        setCurrencyError(null);
        const converted = await convertFiatAmount(1, 'EUR', selectedCurrency);

        if (!isCancelled) {
          const safeRate = Number.isFinite(converted) && converted > 0 ? converted : 1;
          currencyRateCacheRef.current[selectedCurrency] = safeRate;
          setCurrencyRate(safeRate);
        }
      } catch {
        if (!isCancelled) {
          setCurrencyRate(1);
          setCurrencyError('No se pudo aplicar la conversión de moneda. Mostrando EUR.');
        }
      } finally {
        if (!isCancelled) {
          setIsCurrencyLoading(false);
        }
      }
    };

    loadCurrencyRate();

    return () => {
      isCancelled = true;
    };
  }, [selectedCurrency]);

  useEffect(() => {
    if (!isCurrencyMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const menu = currencyMenuRef.current;
      const button = currencyButtonRef.current;
      if (menu && !menu.contains(event.target as Node) && button && !button.contains(event.target as Node)) {
        setIsCurrencyMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCurrencyMenuOpen]);

  // Carga histórico para la gráfica y datos para estadísticas
  useEffect(() => {
    if (view === 'fiat' && selectedFiatTarget) {
      setIsLoading(true);
      setError(null);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - rangeDays);
      fetchFiatHistory(selectedFiatBase, selectedFiatTarget, start)
        .then(setFiatHistory)
        .catch(() => setError('No se pudo cargar el histórico de la divisa.'))
        .finally(() => setIsLoading(false));

      const statsStart = new Date();
      statsStart.setDate(statsStart.getDate() - 30);
      const promises = FIATS.filter(code => code !== selectedFiatBase).map(code =>
        fetchFiatHistory(selectedFiatBase, code, statsStart)
      );
      Promise.all(promises)
        .then(results => {
          setFiatChangeStatsData(results.flat());
        })
        .catch(() => {});
    }
  }, [view, selectedFiatBase, selectedFiatTarget, rangeDays]);

  // Cierre automático los menús al pulsar fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isBaseMenuOpen) {
        const menu = baseMenuRef.current;
        const button = baseButtonRef.current;
        if (menu && !menu.contains(event.target as Node) && button && !button.contains(event.target as Node)) {
          setIsBaseMenuOpen(false);
        }
      }
      if (isTargetMenuOpen) {
        const menu = targetMenuRef.current;
        const button = targetButtonRef.current;
        if (menu && !menu.contains(event.target as Node) && button && !button.contains(event.target as Node)) {
          setIsTargetMenuOpen(false);
        }
      }
    }
    if (isBaseMenuOpen || isTargetMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBaseMenuOpen, isTargetMenuOpen]);

  // Obtener lista de monedas no persistidas al cargar la vista fiat
  useEffect(() => {
    if (view === 'fiat') {
      fetchAllSymbols()
        .then((allSymbols) => {
          const nonPersisted = allSymbols.filter(symbol => !FIATS.includes(symbol));
          setNonPersistedFiats(nonPersisted);
        })
        .catch(() => setNonPersistedFiats([]));
    }
  }, [view]);

  useEffect(() => {
    if (onDemandFiatHistory && onDemandFiatHistory.length > 0) {
      const code = onDemandFiatHistory[0].monedaObjetivo;
      if (!onDemandFiatCache.some((item: { code: string }) => item.code === code)) {
        const newItem = {
          code,
          name: getFiatName(code),
          history: onDemandFiatHistory,
        };
        const updated = [...onDemandFiatCache, newItem];
        setOnDemandFiatCache(updated);
        setCachedOnDemandFiats(updated);
      }
    }
  }, [onDemandFiatHistory]);

  const filteredCriptos = useMemo(() => {
    const term = normalize(search.trim());
    const mapBySymbol = new Map(criptos.map((c) => [c.simbolo, c]));
    const list = CRIPTOS.map((symbol) => mapBySymbol.get(symbol) ?? ({ simbolo: symbol, nombre: symbol } as Criptomoneda));
    if (!term) return list;
    return list.filter((c) =>
      normalize(c.simbolo).includes(term) ||
      normalize(c.nombre).includes(term)
    );
  }, [criptos, search]);

  const displayedCriptos = useMemo(() => {
    const baseList = filteredCriptos.slice();
    const existing = new Set(baseList.map(c => c.simbolo));
    const externalSymbols = new Set<string>([
      ...Object.keys(onDemandCryptoChartHistories),
      ...Object.keys(onDemandCryptoCache),
    ]);
    const term = normalize(search.trim());
    for (const symbol of externalSymbols) {
      if (!existing.has(symbol)) {
        const meta = criptos.find(c => c.simbolo === symbol);
        const crypto = meta ?? ({ simbolo: symbol, nombre: symbol } as Criptomoneda);
        if (!term || normalize(crypto.simbolo).includes(term) || normalize(crypto.nombre).includes(term)) {
          baseList.push(crypto);
          existing.add(symbol);
        }
      }
    }
    return baseList;
  }, [filteredCriptos, onDemandCryptoChartHistories, onDemandCryptoCache, criptos, search]);

  const cryptoSearchOptions = useMemo(() => {
    const seen = new Set<string>();
    return criptos
      .filter((crypto) => !CRIPTOS.includes(crypto.simbolo))
      .filter((crypto) => {
        if (seen.has(crypto.simbolo)) return false;
        seen.add(crypto.simbolo);
        return true;
      })
      .map((crypto) => ({
        symbol: crypto.simbolo,
        name: crypto.nombre,
      }));
  }, [criptos]);

  const filteredCryptoSearchOptions = useMemo(() => {
    const term = normalize(cryptoSearchInput.trim());
    if (!term) return cryptoSearchOptions;
    return cryptoSearchOptions.filter((option) =>
      normalize(option.symbol).includes(term) ||
      normalize(option.name).includes(term)
    );
  }, [cryptoSearchOptions, cryptoSearchInput]);

  const selectedCriptoLabel = useMemo(() => {
    const matchedCrypto = criptos.find((crypto) => crypto.simbolo === selectedCripto);
    return matchedCrypto ? `${matchedCrypto.simbolo} - ${matchedCrypto.nombre}` : selectedCripto;
  }, [criptos, selectedCripto]);

  useEffect(() => {
    if (view !== 'cripto' || CRIPTOS.includes(selectedCripto)) return;

    let isCancelled = false;

    fetchDirectCriptomonedaHistory(selectedCripto)
      .then((hist) => {
        if (!isCancelled) {
          setOnDemandCryptoChartHistories((current) => ({
            ...current,
            [selectedCripto]: normalizeCriptoHist(hist),
          }));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setOnDemandCryptoChartHistories((current) => ({
            ...current,
            [selectedCripto]: [],
          }));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [view, selectedCripto]);

  // LineSeries para el gráfico de divisas, usar histórico de búsqueda directa si existe, filtrado por rango 
  // si se ha seleccionado alguno
  const fiatHistoryToShow = useMemo(() => {
    if (onDemandFiatHistory && onDemandFiatHistory.length > 0) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - rangeDays);
      return onDemandFiatHistory.filter(d => {
        const date = new Date(d.fecha);
        return date >= start && date <= end;
      });
    }
    return fiatHistory;
  }, [onDemandFiatHistory, fiatHistory, rangeDays]);

  const activeFiatTarget = useMemo(() => {
    if (onDemandFiatHistory && onDemandFiatHistory.length > 0) {
      return onDemandFiatHistory[0].monedaObjetivo;
    }
    return selectedFiatTarget;
  }, [onDemandFiatHistory, selectedFiatTarget]);

  const fiatLineSeries: LineSeries[] = useMemo(() => {
    if (!fiatHistoryToShow.length) return [];
    return [{
      label: '',
      points: fiatHistoryToShow.map((d) => ({
        timestamp: new Date(d.fecha).getTime(),
        label: new Date(d.fecha).toLocaleDateString('es-ES'),
        value: d.tasaCambio,
      })),
    }];
  }, [fiatHistoryToShow]);

  const criptoHistory = useMemo(() => {
    if (CRIPTOS.includes(selectedCripto)) {
      return allCriptoChartHistories[selectedCripto] || [];
    }
    const fullOnDemandHistory = onDemandCryptoChartHistories[selectedCripto] || [];
    return filterCriptoHistByRange(fullOnDemandHistory, rangeDays);
  }, [selectedCripto, allCriptoChartHistories, onDemandCryptoChartHistories, rangeDays]);

  const criptoLineSeries: LineSeries[] = useMemo(() => {
    if (!criptoHistory.length) return [];

    return [{
      label: selectedCripto,
      color: CRYPTO_CHART_COLORS[0],
      points: [...criptoHistory]
        .sort((left, right) => new Date(left.fecha).getTime() - new Date(right.fecha).getTime())
        .map((d) => ({
          timestamp: new Date(d.fecha).getTime(),
          label: new Date(d.fecha).toLocaleDateString('es-ES'),
          value: d.precioEur * currencyRate,
        })),
    }];
  }, [criptoHistory, selectedCripto, currencyRate]);

  // Normaliza acentos para búsqueda insensible a tildes
  function normalize(str: string) {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  const filteredNonPersistedFiats = useMemo(() => {
    const term = normalize(onDemandFiatInput.trim());
    if (!term) return nonPersistedFiats;
    return nonPersistedFiats
      .filter(code =>
        normalize(code).includes(term) ||
        normalize(getFiatName(code)).includes(term)
      );
  }, [onDemandFiatInput, nonPersistedFiats]);

  const FIATS_TO_SHOW = FIATS.filter((code: string) => code !== selectedFiatBase);

  // Calcula el cambio porcentual entre dos valores (para las variaciones de 24h y 30d)
  function calcChange(current: number, prev: number) {
    if (!prev || prev === 0) return 0;
    return ((current - prev) / prev) * 100;
  }

  // Para cada moneda objetivo, calcula el valor actual, cambio 24h y 30d
  const fiatInfoList = FIATS_TO_SHOW.map((code: string) => {
    const hist = fiatChangeStatsData.filter((d: MonedaTradicional) => d.monedaBase === selectedFiatBase && d.monedaObjetivo === code);
    hist.sort((a: MonedaTradicional, b: MonedaTradicional) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const last = hist[hist.length - 1];
    const now = last ? new Date(last.fecha) : null;
    let prev24h = null, prev30d = null;
    if (now) {
      const d24 = new Date(now); d24.setDate(d24.getDate() - 1);
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
      prev24h = hist.reduce((acc: MonedaTradicional, d: MonedaTradicional) => Math.abs(new Date(d.fecha).getTime() - d24.getTime()) < Math.abs(new Date(acc.fecha).getTime() - d24.getTime()) ? d : acc, hist[0]);
      prev30d = hist.reduce((acc: MonedaTradicional, d: MonedaTradicional) => Math.abs(new Date(d.fecha).getTime() - d30.getTime()) < Math.abs(new Date(acc.fecha).getTime() - d30.getTime()) ? d : acc, hist[0]);
    }
    const vsBase = last ? last.tasaCambio : 0;
    const change24h = last && prev24h ? calcChange(last.tasaCambio, prev24h.tasaCambio) : 0;
    const change30d = last && prev30d ? calcChange(last.tasaCambio, prev30d.tasaCambio) : 0;
    return {
      code,
      name: getFiatName(code),
      vsBase,
      change24h,
      change30d,
    };
  });

  function formatFiatRate(rate: number, code: string) {
    if (code === 'JPY') return `¥${rate.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return rate.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatCryptoRate(rate: number) {
    return rate.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
  }

  function convertToSelectedCurrency(value: number) {
    return value * currencyRate;
  }

  async function handleOnDemandFiatSearch(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = onDemandFiatInput.trim().toUpperCase();
    if (!code) return;
    setIsOnDemandFiatLoading(true);
    setOnDemandFiatHistory(null);
    try {
      if (!nonPersistedFiats.includes(code)) {
        setError('Solo puedes buscar monedas no persistidas.');
        setIsOnDemandFiatLoading(false);
        return;
      }
      const today = new Date();
      const limit = new Date();
      limit.setFullYear(today.getFullYear() - 1);
      const history = await fetchFiatHistory(selectedFiatBase, code, limit);
      setOnDemandFiatHistory(history);
    } catch {
      setError('No se pudo cargar el histórico de la moneda.');
    } finally {
      setIsOnDemandFiatLoading(false);
    }
  }

  async function handleOnDemandCryptoSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const symbol = cryptoSearchInput.trim().toUpperCase();
    if (!symbol) return;
    setIsOnDemandCryptoLoading(true);
    try {
      if (!CRIPTOS.includes(symbol)) {
        // Primero mira la caché por si esa cripto ya se ha buscado con la API, así se ahorran llamadas
        const cached = onDemandCryptoCache[symbol];
        if (cached && cached.length) {
          setOnDemandCryptoChartHistories((current) => ({
            ...current,
            [symbol]: normalizeCriptoHist(cached),
          }));
        } else {
          const history = await fetchDirectCriptomonedaHistory(symbol);
          const normalized = normalizeCriptoHist(history);
          setOnDemandCryptoChartHistories((current) => ({
            ...current,
            [symbol]: normalized,
          }));
          setOnDemandCryptoCache(prev => {
            const next = { ...prev, [symbol]: normalized };
            setCachedOnDemandCryptos(next);
            return next;
          });
        }
      }
      setSelectedCripto(symbol);
      setIsCryptoSearchOpen(false);
    } catch {
      setError('No se pudo cargar la criptomoneda.');
    } finally {
      setIsOnDemandCryptoLoading(false);
    }
  }

  // Guarda y recupera búsquedas a demanda en caché
  function getCachedOnDemandFiats() {
    try {
      const raw = sessionStorage.getItem('onDemandFiatCache');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch { return []; }
  }

  function setCachedOnDemandFiats(list: MonedaTradicional[]) {
    try {
      sessionStorage.setItem('onDemandFiatCache', JSON.stringify(list));
    } catch { }
  }

  function setCachedOnDemandCryptos(map: Record<string, CriptomonedaPrecio[]>) {
    try {
      sessionStorage.setItem('onDemandCryptoCache', JSON.stringify(map));
    } catch { }
  }

  const fiatStat = useMemo(() => {
    if (!fiatHistoryToShow.length) return null;
    const last = fiatHistoryToShow[fiatHistoryToShow.length - 1];
    const first = fiatHistoryToShow[0];
    const min = Math.min(...fiatHistoryToShow.map((d) => d.tasaCambio));
    const max = Math.max(...fiatHistoryToShow.map((d) => d.tasaCambio));
    const avg = fiatHistoryToShow.reduce((acc, d) => acc + d.tasaCambio, 0) / fiatHistoryToShow.length;
    return { last, first, min, max, avg };
  }, [fiatHistoryToShow]);

  const criptoStat = useMemo(() => {
    if (!criptoHistory.length) return null;
    const last = criptoHistory[criptoHistory.length - 1];
    const first = criptoHistory[0];
    const min = Math.min(...criptoHistory.map((d) => d.precioEur * currencyRate));
    const max = Math.max(...criptoHistory.map((d) => d.precioEur * currencyRate));
    const avg = criptoHistory.reduce((acc, d) => acc + (d.precioEur * currencyRate), 0) / criptoHistory.length;
    return { last, first, min, max, avg };
  }, [criptoHistory, currencyRate]);


  return (
    <section className="electricity-page">
      <header className="electricity-page__header">
        <h2>Divisas</h2>
        <p>Consulta el valor actual y la evolución histórica de divisas tradicionales y criptomonedas.</p>
      </header>

      <div className="hardware-tabs" role="tablist" aria-label="Tipo de hardware">
        {(['cripto', 'fiat'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            className={`hardware-tab${view === tab ? ' hardware-tab--active' : ''}`}
            onClick={() => setView(tab)}
          >
            {typeLabels[tab]}
          </button>
        ))}
      </div>

      <div style={{ minHeight: (isLoading || error) ? 28 : 0 }}>
        {isLoading && <p className="api-info">Cargando datos...</p>}
        {error && <p className="api-info api-info--warning">{error}</p>}
      </div>

      {view === 'fiat' && (
        <>
          <div className="currencies-page__selector-row">
            <div className="currencies-page__selector-col">
              <span className="currencies-page__selector-label">Base</span>
              <div className="electricity-currency-picker" aria-label="Selector moneda base">
                <button
                  type="button"
                  className="electricity-currency-picker__trigger"
                  ref={baseButtonRef}
                  onClick={() => setIsBaseMenuOpen((open) => !open)}
                  aria-expanded={isBaseMenuOpen}
                >
                  {selectedFiatBase}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`electricity-currency-picker__icon${isBaseMenuOpen ? ' is-open' : ''}`}
                  />
                </button>
                {isBaseMenuOpen && (
                  <div
                    className="electricity-currency-picker__menu"
                    role="menu"
                    ref={baseMenuRef}
                  >
                    {FIATS.filter(m => m !== selectedFiatTarget).map((currencyCode) => (
                      <button
                        key={currencyCode}
                        type="button"
                        className={selectedFiatBase === currencyCode ? 'is-active' : ''}
                        onClick={() => {
                          setSelectedFiatBase(currencyCode);
                          setIsBaseMenuOpen(false);
                        }}
                      >
                        {currencyCode}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="currencies-page__selector-arrow">
              <ArrowRightLeft size={22} style={{ color: 'var(--muted-foreground)' }} aria-label="Intercambio" />
            </div>
            <div className="currencies-page__selector-col">
              <span className="currencies-page__selector-label">Objetivo</span>
              <div className="electricity-currency-picker" aria-label="Selector moneda objetivo">
                <button
                  type="button"
                  className="electricity-currency-picker__trigger"
                  ref={targetButtonRef}
                  onClick={() => setIsTargetMenuOpen((open) => !open)}
                  aria-expanded={isTargetMenuOpen}
                >
                  {onDemandFiatHistory && onDemandFiatHistory.length > 0
                    ? onDemandFiatHistory[0].monedaObjetivo
                    : selectedFiatTarget}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`electricity-currency-picker__icon${isTargetMenuOpen ? ' is-open' : ''}`}
                  />
                </button>
                {isTargetMenuOpen && (
                  <div
                    className="electricity-currency-picker__menu"
                    role="menu"
                    ref={targetMenuRef}
                  >
                    {FIATS.filter(m => m !== selectedFiatBase).map((currencyCode) => (
                      <button
                        key={currencyCode}
                        type="button"
                        className={selectedFiatTarget === currencyCode ? 'is-active' : ''}
                        onClick={() => {
                          setSelectedFiatTarget(currencyCode);
                          setOnDemandFiatHistory(null);
                          setIsTargetMenuOpen(false);
                        }}
                      >
                        {currencyCode}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: "center" }}>
            <div className="card electricity-chart-card" style={{ padding: '12px 14px', borderRadius: 10, width: 500 }}>
              <form className="electricity-direct-zone" onSubmit={handleOnDemandFiatSearch} style={{ gap: 8, position: 'relative', display: 'flex', alignItems: 'center' }} autoComplete="off">
                <input
                  id="on-demand-fiat-search"
                  type="text"
                  placeholder="Ej: Dólar neozelandés"
                  value={onDemandFiatInput}
                  onChange={e => setOnDemandFiatInput(e.target.value)}
                  disabled={isOnDemandFiatLoading}
                  style={{ width: '100%', padding: '0.36rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)' }}
                  autoComplete="off"
                  onFocus={e => { (e.target as HTMLInputElement).select(); setIsOnDemandFiatInputFocused(true); }}
                  onBlur={() => setTimeout(() => setIsOnDemandFiatInputFocused(false), 120)}
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-controls="on-demand-fiat-listbox"
                />
                {filteredNonPersistedFiats.length > 0 && isOnDemandFiatInputFocused && (
                  <ul
                    id="on-demand-fiat-listbox"
                    role="listbox"
                    className="currencies-page__dropdown-list"
                    style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', minWidth: 260 }}
                  >
                    {filteredNonPersistedFiats.map(code => (
                      <li key={code} role="option" tabIndex={-1} onMouseDown={() => setOnDemandFiatInput(code)} style={{ padding: '0.4rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--brand-title)' }}>{code}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{getFiatName(code)}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="submit" disabled={isOnDemandFiatLoading || !onDemandFiatInput.trim()} style={{ padding: '0.36rem 0.7rem', borderRadius: 8 }}>
                  {isOnDemandFiatLoading ?
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Loader2 size={14} className="electricity-spinner" aria-hidden="true" />
                      Buscando...
                    </span>
                    : 'Buscar'}
                </button>
              </form>
              <p className="electricity-direct-zone__hint" style={{ margin: '4px 0 0', fontSize: 12 }}>
                Las monedas buscadas aquí se obtienen por llamada directa a nuestros proveedores externos, estos datos pueden tardar en cargar. La moneda seleccionada en este buscador se usará como <b>objetivo</b> y se comparará con la base seleccionada.
              </p>
            </div>
          </div>

          <p>Parámetros del cambio {getFiatName(selectedFiatBase) + " (" + selectedFiatBase + ")"} - {getFiatName(selectedFiatTarget) + " (" + selectedFiatTarget + ")"} del último año</p>
          <div className="electricity-stats">
            <article className="card electricity-stat">
              <span>Actual</span>
              <strong>{fiatStat ? fiatStat.last.tasaCambio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) : 'N/D'}</strong>
            </article>
            <article className="card electricity-stat">
              <span>Promedio</span>
              <strong>{fiatStat ? fiatStat.avg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) : 'N/D'}</strong>
            </article>
            <article className="card electricity-stat">
              <span>Mínimo</span>
              <strong>{fiatStat ? fiatStat.min.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) : 'N/D'}</strong>
            </article>
            <article className="card electricity-stat">
              <span>Máximo</span>
              <strong>{fiatStat ? fiatStat.max.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) : 'N/D'}</strong>
            </article>
          </div>

          <div className="card electricity-chart-card">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LineChart size={18} />
                <span>Evolución histórica</span>
              </div>
              <div className="electricity-range-buttons">
                {RANGE_OPTIONS.map((rangeOption) => (
                  <button
                    key={rangeOption.value}
                    type="button"
                    className={rangeDays === rangeOption.value ? 'is-active' : ''}
                    onClick={() => setRangeDays(rangeOption.value)}
                  >
                    {rangeOption.label}
                  </button>
                ))}
              </div>
              <span style={{ fontWeight: 500, color: 'var(--muted-foreground)' }}>
                {selectedFiatBase} vs {activeFiatTarget}
              </span>
            </header>
            <SimpleLineChart series={fiatLineSeries} />
          </div>
          <div className="card electricity-chart-card" style={{ marginTop: 36 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <h3 style={{ color: 'var(--brand-title)', fontWeight: 600, fontSize: '1.2rem' }}>
                Monedas Tradicionales - Tipos de Cambio
              </h3>
              <input
                type="text"
                placeholder="Buscar moneda por código o nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '0.5rem 0.8rem',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                  fontSize: 15,
                  marginBottom: 2,
                  maxWidth: 340
                }}
                aria-label="Buscar moneda"
              />
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                Las cantidades mostradas son las equivalencias de los objetivos con la base. Por ejemplo, si la base es <b>{selectedFiatBase}</b> y el objetivo <b>{activeFiatTarget}</b>, 1 {selectedFiatBase} equivale a X {activeFiatTarget}.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
              {[
                ...fiatInfoList,
                ...onDemandFiatCache.filter(
                  (item: { code: string }) => !fiatInfoList.some(f => f.code === item.code)
                ).map((item: { code: string; name: string; history: MonedaTradicional[] }) => {
                  const hist = [...item.history].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
                  const last = hist[hist.length - 1];
                  const now = last ? new Date(last.fecha) : null;
                  let prev24h = null, prev30d = null;
                  if (now) {
                    const d24 = new Date(now); d24.setDate(d24.getDate() - 1);
                    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
                    prev24h = hist.reduce((acc, d) => Math.abs(new Date(d.fecha).getTime() - d24.getTime()) < Math.abs(new Date(acc.fecha).getTime() - d24.getTime()) ? d : acc, hist[0]);
                    prev30d = hist.reduce((acc, d) => Math.abs(new Date(d.fecha).getTime() - d30.getTime()) < Math.abs(new Date(acc.fecha).getTime() - d30.getTime()) ? d : acc, hist[0]);
                  }
                  const vsBase = last ? last.tasaCambio : 0;
                  const change24h = last && prev24h ? ((last.tasaCambio - prev24h.tasaCambio) / prev24h.tasaCambio) * 100 : 0;
                  const change30d = last && prev30d ? ((last.tasaCambio - prev30d.tasaCambio) / prev30d.tasaCambio) * 100 : 0;
                  return {
                    code: item.code,
                    name: item.name,
                    vsBase,
                    change24h,
                    change30d,
                    _isOnDemand: true,
                  };
                })
              ]
                .filter((currency: { code: string }) => {
                  const term = normalize(search.trim());
                  return (
                    normalize(currency.code).includes(term) ||
                    normalize(getFiatName(currency.code)).includes(term)
                  );
                })
                .map((currency: {
                  code: string;
                  name: string;
                  vsBase: number;
                  change24h: number;
                  change30d: number;
                  _isOnDemand?: boolean;
                }) => (
                  <div
                    key={currency.code}
                    className="card"
                    style={{
                      background: currency._isOnDemand ? 'color-mix(in srgb, var(--primary) 9%, var(--muted) 91%)' : 'var(--muted)',
                      border: currency._isOnDemand ? '2px solid color-mix(in srgb, var(--primary) 45%, var(--border) 55%)' : undefined,
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: 18 }}>{currency.code}</div>
                          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{currency.name}</div>
                          {currency._isOnDemand && (
                            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>Moneda obtenida de terceros</div>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--brand-title)', fontSize: 20 }}>
                          {formatFiatRate(currency.vsBase, currency.code)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>vs {selectedFiatBase}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Cambio 24h</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: currency.change24h > 0 ? 'var(--success)' : currency.change24h < 0 ? 'var(--negative)' : 'var(--muted-foreground)' }}>{currency.change24h > 0 ? '+' : ''}{currency.change24h.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Cambio 30d</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: currency.change30d > 0 ? 'var(--success)' : currency.change30d < 0 ? 'var(--negative)' : 'var(--muted-foreground)' }}>{currency.change30d > 0 ? '+' : ''}{currency.change30d.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}%</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {view === 'cripto' && (
        <>
          <div className="electricity-stats">
            <article className="card electricity-stat">
              <span>Actual</span>
              <strong>{criptoStat ? formatCryptoRate(convertToSelectedCurrency(criptoStat.last.precioEur)) : 'N/D'}</strong>
              <p>Último valor {selectedCurrency}</p>
            </article>
            <article className="card electricity-stat">
              <span>Promedio</span>
              <strong>{criptoStat ? formatCryptoRate(criptoStat.avg) : 'N/D'}</strong>
            </article>
            <article className="card electricity-stat">
              <span>Mínimo</span>
              <strong>{criptoStat ? formatCryptoRate(criptoStat.min) : 'N/D'}</strong>
            </article>
            <article className="card electricity-stat">
              <span>Máximo</span>
              <strong>{criptoStat ? formatCryptoRate(criptoStat.max) : 'N/D'}</strong>
            </article>
          </div>
          <div className="card electricity-chart-card">
            <header>
              <div>
                <div className="currencies-page__chart-header-left">
                  <LineChart size={18} />
                  <span>Evolución histórica</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <form className="electricity-direct-zone" onSubmit={handleOnDemandCryptoSearch} style={{ gap: 8, position: 'relative', display: 'flex', alignItems: 'center' }} autoComplete="off">
                    <div className="electricity-select-wrap" style={{ flex: 1, minWidth: 280, maxWidth: 420 }}>
                      <input
                        type="text"
                        value={cryptoSearchInput}
                        onChange={(event) => setCryptoSearchInput(event.target.value)}
                        onFocus={() => setIsCryptoSearchOpen(true)}
                        onBlur={() => setTimeout(() => setIsCryptoSearchOpen(false), 120)}
                        placeholder="Ej: Avalanche"
                        aria-label="Buscar criptomoneda externa"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
                        aria-controls="crypto-search-listbox"
                        disabled={isOnDemandCryptoLoading}
                      />
                      {isCryptoSearchOpen && filteredCryptoSearchOptions.length > 0 && (
                        <ul
                          id="crypto-search-listbox"
                          role="listbox"
                          className="currencies-page__dropdown-list"
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 'calc(100% + 6px)',
                            zIndex: 20,
                            background: 'var(--muted)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            maxHeight: 220,
                            overflowY: 'auto',
                          }}
                        >
                          {filteredCryptoSearchOptions.map((option) => (
                            <li
                              key={option.symbol}
                              role="option"
                              tabIndex={-1}
                              onMouseDown={() => {
                                setCryptoSearchInput(option.symbol)
                                setIsCryptoSearchOpen(false)
                              }}
                              style={{ padding: '0.4rem 0.7rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            >
                              <div style={{ fontWeight: 700, color: 'var(--brand-title)' }}>{option.symbol}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{option.name}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <button type="submit" disabled={isOnDemandCryptoLoading || !cryptoSearchInput.trim()} style={{ padding: '0.36rem 0.7rem', borderRadius: 8 }}>
                      {isOnDemandCryptoLoading ?
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Loader2 size={14} className="electricity-spinner" aria-hidden="true" />
                          Buscando...
                        </span>
                        : 'Buscar'}
                    </button>
                  </form>
                  <p className="electricity-direct-zone__hint" style={{ margin: '4px 0 0', fontSize: 12, maxWidth: 420 }}>
                    Las monedas buscadas aquí se obtienen por llamada directa a nuestros proveedores externos, estos datos pueden tardar en cargar.
                  </p>
                </div>
              </div>
              <p className="currencies-page__crypto-chart-title">{selectedCriptoLabel} ({selectedCurrency})</p>
              <div className="currencies-page__crypto-chart-controls-right">
                <div className="electricity-currency-picker" aria-label="Selector de moneda de visualización">
                  <button
                    type="button"
                    className="electricity-currency-picker__trigger"
                    onClick={() => setIsCurrencyMenuOpen((prev) => !prev)}
                    ref={currencyButtonRef}
                    aria-expanded={isCurrencyMenuOpen}
                  >
                    {selectedCurrency}
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={`electricity-currency-picker__icon${isCurrencyMenuOpen ? ' is-open' : ''}`}
                    />
                  </button>
                  {isCurrencyMenuOpen ? (
                    <div className="electricity-currency-picker__menu" role="menu" ref={currencyMenuRef}>
                      {(['EUR', ...CONVERTIBLE_CURRENCIES] as DisplayCurrency[]).map((currencyCode) => (
                        <button
                          key={currencyCode}
                          type="button"
                          className={selectedCurrency === currencyCode ? 'is-active' : ''}
                          onClick={() => {
                            setSelectedCurrency(currencyCode)
                            setIsCurrencyMenuOpen(false)
                          }}
                        >
                          {currencyCode}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {isCurrencyLoading ? <p className="api-info" style={{ margin: 0, fontSize: 11 }}>Convirtiendo...</p> : null}
                {currencyError ? <p className="api-info api-info--warning" style={{ margin: 0, fontSize: 11 }}>{currencyError}</p> : null}
                <div className="electricity-select-wrap" style={{ minWidth: 140 }}>
                  <select
                    value={CRIPTOS.includes(selectedCripto) ? selectedCripto : ''}
                    onChange={(e) => setSelectedCripto(e.target.value)}
                    className="electricity-select"
                    style={{ minWidth: 140 }}
                    aria-label="Seleccionar criptomoneda persistida"
                  >
                    <option value="">-</option>
                    {criptos
                      .filter((c) => CRIPTOS.includes(c.simbolo))
                      .map((cripto) => (
                        <option key={cripto.simbolo} value={cripto.simbolo}>
                          {cripto.simbolo} - {cripto.nombre}
                        </option>
                      ))}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" className="electricity-select-wrap__icon" />
                </div>
                <div className="electricity-range-buttons">
                  {RANGE_OPTIONS.map((rangeOption) => (
                    <button
                      key={rangeOption.value}
                      type="button"
                      className={rangeDays === rangeOption.value ? 'is-active' : ''}
                      onClick={() => setRangeDays(rangeOption.value)}
                    >
                      {rangeOption.label}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            <SimpleLineChart series={criptoLineSeries} />
          </div>
          <div className="card electricity-chart-card currencies-page__panel" style={{ marginTop: 36 }}>
            <div className="currencies-page__section-stack">
              <h3 className="currencies-page__section-title">Criptomonedas - Precios y fluctuaciones</h3>
              <input
                type="text"
                placeholder="Buscar cripto por símbolo o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="currencies-page__search-input"
                aria-label="Buscar cripto"
              />
            </div>
            <div className="currencies-page__cards-grid">
              {displayedCriptos.map((cripto) => {
                const rawHist = allCriptoCardHistories[cripto.simbolo]
                  || onDemandCryptoChartHistories[cripto.simbolo]
                  || onDemandCryptoCache[cripto.simbolo]
                  || [];
                const hist = (rawHist || []).slice().sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
                const last = hist[hist.length - 1];
                const now = last ? new Date(last.fecha) : null;
                let prev24h = null, prev30d = null;
                if (now) {
                  const d24 = new Date(now); d24.setDate(d24.getDate() - 1);
                  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
                  prev24h = hist.reduce((acc, d) => Math.abs(new Date(d.fecha).getTime() - d24.getTime()) < Math.abs(new Date(acc.fecha).getTime() - d24.getTime()) ? d : acc, hist[0]);
                  prev30d = hist.reduce((acc, d) => Math.abs(new Date(d.fecha).getTime() - d30.getTime()) < Math.abs(new Date(acc.fecha).getTime() - d30.getTime()) ? d : acc, hist[0]);
                }
                const precioActual = last ? last.precioEur : null;
                const change24h = last && prev24h ? ((last.precioEur - prev24h.precioEur) / prev24h.precioEur) * 100 : 0;
                const change30d = last && prev30d ? ((last.precioEur - prev30d.precioEur) / prev30d.precioEur) * 100 : 0;
                const isExternallyRequested = !!(onDemandCryptoChartHistories[cripto.simbolo] || onDemandCryptoCache[cripto.simbolo]);
                return (
                  <div
                    key={cripto.simbolo}
                    className={`card currencies-page__rate-card${isExternallyRequested ? ' currencies-page__rate-card--highlighted' : ''}`}
                  >
                    <div className="currencies-page__rate-card-top">
                      <div className="currencies-page__rate-card-left">
                        <div>
                          <div className="currencies-page__rate-card-code">{cripto.simbolo}</div>
                          <div className="currencies-page__rate-card-name">{cripto.nombre}</div>
                          {isExternallyRequested && (
                            <div className="currencies-page__rate-card-badge">Criptomoneda obtenida de terceros</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="currencies-page__rate-card-price">
                          {precioActual !== null ? `${formatCryptoRate(convertToSelectedCurrency(precioActual))}` : 'N/D'}
                        </div>
                        <div className="currencies-page__rate-card-unit">{selectedCurrency}</div>
                      </div>
                    </div>
                    <div className="currencies-page__rate-card-stats">
                      <div>
                        <div className="currencies-page__rate-card-stat-label">Cambio 24h</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: change24h > 0 ? 'var(--success)' : change24h < 0 ? 'var(--negative)' : 'var(--muted-foreground)' }}>{change24h > 0 ? '+' : ''}{change24h.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}%</div>
                      </div>
                      <div>
                        <div className="currencies-page__rate-card-stat-label">Cambio 30d</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: change30d > 0 ? 'var(--success)' : change30d < 0 ? 'var(--negative)' : 'var(--muted-foreground)' }}>{change30d > 0 ? '+' : ''}{change30d.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
