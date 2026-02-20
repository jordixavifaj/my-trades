import os
import re
import logging
from datetime import datetime, timedelta, date as date_type
from typing import Any, Dict, List, Optional, Tuple

import httpx
import numpy as np
import pandas as pd
import yfinance as yf
from bs4 import BeautifulSoup
from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

APP_NAME = "ticker-lab-backend"

logger = logging.getLogger(APP_NAME)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

# Cache: avoid hammering Yahoo + sites
PROFILE_CACHE = TTLCache(maxsize=512, ttl=60 * 60)  # 1h
INTRADAY_CACHE = TTLCache(maxsize=512, ttl=60 * 2)  # 2m
DAILY_CACHE = TTLCache(maxsize=512, ttl=60 * 60 * 6)  # 6h

DEFAULT_TZ = os.getenv("TICKER_LAB_TZ", "America/New_York")

# Load env files (best-effort): backend-local .env, then project-root .env
_here = os.path.dirname(__file__)
load_dotenv(os.path.join(_here, ".env"), override=False)
load_dotenv(os.path.join(_here, "..", ".env"), override=False)

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


def _clean_symbol(symbol: str) -> str:
    s = symbol.strip().upper()
    if not re.fullmatch(r"[A-Z0-9.\-]{1,15}", s):
        raise HTTPException(status_code=400, detail="Invalid symbol")
    return s


def _to_unix_seconds(ts: pd.Timestamp) -> int:
    if ts.tzinfo is None:
        # yfinance sometimes returns naive timestamps; assume DEFAULT_TZ
        ts = ts.tz_localize(DEFAULT_TZ)
    return int(ts.tz_convert("UTC").timestamp())


def _market_cap_to_number(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _get_yf_ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(symbol)


def _safe_get(d: Dict[str, Any], key: str) -> Any:
    return d.get(key) if isinstance(d, dict) else None


def _parse_human_number(text: str) -> Optional[float]:
    if not text:
        return None
    s = text.strip().replace(",", "")
    m = re.fullmatch(r"(-?[0-9]*\.?[0-9]+)\s*([KMBT])?", s, flags=re.IGNORECASE)
    if not m:
        return None
    try:
        num = float(m.group(1))
    except Exception:
        return None
    mult = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}.get((m.group(2) or "").upper(), 1.0)
    return num * mult


def _polygon_key() -> str:
    if not POLYGON_API_KEY:
        raise HTTPException(status_code=500, detail="POLYGON_API_KEY not configured")
    return POLYGON_API_KEY


def fetch_polygon_profile(symbol: str) -> Dict[str, Any]:
    cache_key = ("polygon_profile", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    key = _polygon_key()
    url = f"https://api.polygon.io/v3/reference/tickers/{symbol}"
    params = {"apiKey": key}
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code != 200:
                PROFILE_CACHE[cache_key] = {"ok": False, "error": f"Polygon status {resp.status_code}"}
                return PROFILE_CACHE[cache_key]
            data = resp.json() if resp.text else {}
    except Exception as e:
        logger.exception("polygon profile request failed", extra={"symbol": symbol})
        PROFILE_CACHE[cache_key] = {"ok": False, "error": f"Polygon exception {type(e).__name__}"}
        return PROFILE_CACHE[cache_key]

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, dict):
        PROFILE_CACHE[cache_key] = {"ok": False, "error": "Polygon results missing"}
        return PROFILE_CACHE[cache_key]

    payload = {
        "ok": True,
        "symbol": symbol,
        "exchange": results.get("primary_exchange") or results.get("exchange"),
        "sector": results.get("sic_description") or results.get("sector"),
        "industry": results.get("industry"),
        "employees": results.get("total_employees") or results.get("employees"),
        "country": results.get("locale"),
        "marketCap": results.get("market_cap"),
        # Best-effort float/shares. Polygon naming depends on plan/version.
        "sharesOutstanding": results.get("weighted_shares_outstanding")
        or results.get("share_class_shares_outstanding")
        or results.get("shares_outstanding"),
        "sourceUrl": f"https://polygon.io/stocks/{symbol}",
    }

    PROFILE_CACHE[cache_key] = payload
    return payload


def _map_exchange_to_google(exchange: Optional[str]) -> Optional[str]:
    """Map exchange names from Yahoo/Finviz/Polygon to Google Finance format."""
    if not exchange:
        return None
    ex = exchange.upper().strip()
    mapping = {
        "XNAS": "NASDAQ", "NASDAQ": "NASDAQ", "NASD": "NASDAQ", "NMS": "NASDAQ", "NGM": "NASDAQ", "NCM": "NASDAQ",
        "XNYS": "NYSE", "NYSE": "NYSE", "NYQ": "NYSE",
        "XASE": "NYSEAMERICAN", "AMEX": "NYSEAMERICAN", "ASE": "NYSEAMERICAN",
        "XBOS": "NYSEARCA", "ARCA": "NYSEARCA", "PCX": "NYSEARCA",
    }
    return mapping.get(ex)


def fetch_google_finance_ebitda(symbol: str, exchange: Optional[str]) -> Dict[str, Any]:
    cache_key = ("google_finance_ebitda", symbol, exchange)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    exch = _map_exchange_to_google(exchange)

    candidates = []
    if exch:
        candidates.append(f"{symbol}:{exch}")
    # Common US exchanges as fallback
    for fb in ["NASDAQ", "NYSE", "NYSEAMERICAN"]:
        cand = f"{symbol}:{fb}"
        if cand not in candidates:
            candidates.append(cand)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    cookies = {
        "CONSENT": "YES+cb.20210720-07-p0.en+FX+111",
        "SOCS": "CAISHAgCEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiAo_CmBg",
    }
    for c in candidates:
        url = f"https://www.google.com/finance/quote/{c}?gl=US&hl=en"
        try:
            with httpx.Client(timeout=15.0, headers=headers, follow_redirects=True, cookies=cookies) as client:
                resp = client.get(url)
                if resp.status_code != 200:
                    continue
                html = resp.text
        except Exception:
            continue

        # Try multiple regex patterns for EBITDA extraction
        ebitda_patterns = [
            r"EBITDA[^<]*?<[^>]*>([0-9.,]+\s*[KMBT]?)\s*(USD)?",
            r">EBITDA<[^>]*>\s*(?:<[^>]*>)*\s*([0-9.,]+\s*[KMBT]?)",
            r"EBITDA\s*</[^>]+>\s*<[^>]+>\s*([0-9.,]+\s*[KMBT]?)",
            r"EBITDA\s*([0-9.,]+\s*[KMBT]?)",
            r"data-[^>]*EBITDA[^>]*>([0-9.,]+\s*[KMBT]?)<",
        ]
        for pattern in ebitda_patterns:
            m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            if m:
                ebitda = _parse_human_number(m.group(1).replace(" ", "").strip())
                if ebitda is not None:
                    logger.info("google finance EBITDA found", extra={"symbol": symbol, "url": url, "ebitda": ebitda})
                    payload = {"ok": True, "ebitda": ebitda, "sourceUrl": url, "error": None}
                    PROFILE_CACHE[cache_key] = payload
                    return payload

    payload = {"ok": False, "ebitda": None, "sourceUrl": None, "error": "EBITDA not found in Google Finance"}
    PROFILE_CACHE[cache_key] = payload
    return payload


def fetch_finviz_ebitda(symbol: str) -> Optional[float]:
    """Try to extract EBITDA from Finviz snapshot table only (avoids false positives)."""
    soup, _url, _err = _fetch_finviz_soup(symbol)
    if soup is None:
        return None
    # Only trust the structured snapshot table, not full-text regex
    for table in soup.find_all("table", class_="snapshot-table2"):
        cells = table.find_all("td")
        for i in range(0, len(cells) - 1, 2):
            label = cells[i].get_text(strip=True)
            if label.upper() == "EBITDA":
                val = cells[i + 1].get_text(strip=True)
                if val and val != "-":
                    return _parse_human_number(val)
    return None


def _fetch_finviz_soup(symbol: str) -> Tuple[Optional[BeautifulSoup], str, Optional[str]]:
    """Fetch and cache the Finviz HTML page for a symbol."""
    cache_key = ("finviz_html", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    url = f"https://finviz.com/quote.ashx?t={symbol}&p=d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finviz.com/",
    }
    try:
        with httpx.Client(timeout=20.0, headers=headers, follow_redirects=True) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                result = (None, url, f"HTTP {resp.status_code}")
                PROFILE_CACHE[cache_key] = result
                return result
            soup = BeautifulSoup(resp.text, "html.parser")
            result = (soup, url, None)
            PROFILE_CACHE[cache_key] = result
            return result
    except Exception as e:
        logger.exception("finviz page fetch failed", extra={"symbol": symbol})
        result = (None, url, f"Exception {type(e).__name__}")
        PROFILE_CACHE[cache_key] = result
        return result


def fetch_finviz_profile(symbol: str) -> Dict[str, Any]:
    """Scrape comprehensive profile from Finviz: Exchange, Sector, Industry, Country, Market Cap, Float, Short %."""
    cache_key = ("finviz_profile", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    soup, url, fetch_err = _fetch_finviz_soup(symbol)

    result: Dict[str, Any] = {
        "ok": False,
        "symbol": symbol,
        "exchange": None,
        "sector": None,
        "industry": None,
        "country": None,
        "marketCap": None,
        "float": None,
        "shortInterestPercent": None,
        "sourceUrl": url,
        "error": fetch_err,
    }

    if soup is None:
        PROFILE_CACHE[cache_key] = result
        return result

    # --- Snapshot table (financial metrics) ---
    snapshot: Dict[str, str] = {}
    for table in soup.find_all("table", class_="snapshot-table2"):
        cells = table.find_all("td")
        for i in range(0, len(cells) - 1, 2):
            label = cells[i].get_text(strip=True)
            value = cells[i + 1].get_text(strip=True)
            if label:
                snapshot[label] = value

    # --- Header links (Sector | Industry | Country | Exchange) ---
    for a in soup.find_all("a", class_="tab-link"):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if not text or text == "-":
            continue
        if "f=sec_" in href:
            result["sector"] = text
        elif "f=ind_" in href:
            result["industry"] = text
        elif "f=geo_" in href:
            result["country"] = text
        elif "f=exch_" in href:
            result["exchange"] = text

    # Exchange fallback from snapshot Index field
    if not result["exchange"]:
        idx = snapshot.get("Index", "")
        if idx and idx != "-":
            result["exchange"] = idx

    # Market Cap
    mc = snapshot.get("Market Cap", "")
    if mc and mc != "-":
        result["marketCap"] = _parse_human_number(mc)

    # Float (Shs Float)
    fl = snapshot.get("Shs Float", "")
    if fl and fl != "-":
        result["float"] = _parse_human_number(fl)

    # Short Interest %
    sf = snapshot.get("Short Float / Ratio", "") or snapshot.get("Short Float", "")
    if sf and sf != "-":
        m = re.match(r"([0-9.]+)%", sf)
        if m:
            try:
                result["shortInterestPercent"] = float(m.group(1))
            except Exception:
                pass

    # Fallback: regex on full text
    if result["shortInterestPercent"] is None:
        text = soup.get_text(" ")
        m = re.search(r"Short Float\s*([0-9.]+)%", text, re.IGNORECASE)
        if m:
            try:
                result["shortInterestPercent"] = float(m.group(1))
            except Exception:
                pass

    logger.info(
        "finviz profile scraped",
        extra={
            "symbol": symbol,
            "exchange": result["exchange"],
            "sector": result["sector"],
            "industry": result["industry"],
            "country": result["country"],
            "marketCap": result["marketCap"],
            "float": result["float"],
            "shortInterestPercent": result["shortInterestPercent"],
        },
    )

    result["error"] = None
    result["ok"] = any(
        result.get(k) is not None
        for k in ["exchange", "sector", "industry", "country", "marketCap", "float", "shortInterestPercent"]
    )

    PROFILE_CACHE[cache_key] = result
    return result


def fetch_finviz_news(symbol: str) -> List[Dict[str, Any]]:
    """Scrape recent news headlines from Finviz news table."""
    cache_key = ("finviz_news", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    soup, _url, _err = _fetch_finviz_soup(symbol)
    if soup is None:
        PROFILE_CACHE[cache_key] = []
        return []

    news_table = soup.find("table", id="news-table")
    if not news_table:
        PROFILE_CACHE[cache_key] = []
        return []

    items: List[Dict[str, Any]] = []
    current_date_str: Optional[str] = None
    today = datetime.utcnow().date()
    cutoff = today - timedelta(days=3)

    for row in news_table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 2:
            continue

        date_cell = cells[0].get_text(strip=True)
        link_el = cells[1].find("a")
        if not link_el:
            continue

        title = link_el.get_text(strip=True)
        href = link_el.get("href", "")
        source_span = cells[1].find("span")
        source = source_span.get_text(strip=True).strip("()") if source_span else "Finviz"

        # Date parsing: "Feb-20-26 09:30AM" or just "09:30AM"
        date_match = re.match(r"([A-Z][a-z]{2}-\d{2}-\d{2})", date_cell)
        if date_match:
            current_date_str = date_match.group(1)

        pub_date = None
        if current_date_str:
            try:
                pub_date = datetime.strptime(current_date_str, "%b-%d-%y").date()
            except Exception:
                pass

        # Filter: only last 3 days
        if pub_date and pub_date < cutoff:
            continue

        items.append({
            "title": title,
            "description": None,
            "url": href,
            "source": source,
            "publishedAt": pub_date.isoformat() if pub_date else None,
        })

    PROFILE_CACHE[cache_key] = items
    return items


def fetch_polygon_news(symbol: str) -> Dict[str, Any]:
    cache_key = ("polygon_news", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    key = _polygon_key()
    url = "https://api.polygon.io/v2/reference/news"
    params = {"ticker": symbol, "limit": 10, "order": "desc", "sort": "published_utc", "apiKey": key}
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code != 200:
                payload = {"ok": False, "items": [], "error": f"Polygon news status {resp.status_code}"}
                PROFILE_CACHE[cache_key] = payload
                return payload
            data = resp.json() if resp.text else {}
    except Exception as e:
        logger.exception("polygon news request failed", extra={"symbol": symbol})
        payload = {"ok": False, "items": [], "error": f"Polygon news exception {type(e).__name__}"}
        PROFILE_CACHE[cache_key] = payload
        return payload

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        payload = {"ok": False, "items": [], "error": "Polygon news results missing"}
        PROFILE_CACHE[cache_key] = payload
        return payload

    items = []
    for it in results:
        if not isinstance(it, dict):
            continue
        items.append(
            {
                "title": it.get("title"),
                "description": it.get("description") or it.get("summary"),
                "url": it.get("article_url"),
                "publishedAt": it.get("published_utc"),
                "source": (it.get("publisher") or {}).get("name") if isinstance(it.get("publisher"), dict) else None,
            }
        )

    payload = {"ok": True, "items": items, "error": None}
    PROFILE_CACHE[cache_key] = payload
    return payload


def fetch_polygon_financials(symbol: str) -> Dict[str, Any]:
    cache_key = ("polygon_financials", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    key = _polygon_key()
    url = "https://api.polygon.io/vX/reference/financials"
    params = {
        "ticker": symbol,
        "limit": 1,
        "sort": "filing_date",
        "order": "desc",
        "apiKey": key,
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code != 200:
                payload = {"ok": False, "error": f"Polygon financials status {resp.status_code}"}
                PROFILE_CACHE[cache_key] = payload
                return payload
            data = resp.json() if resp.text else {}
    except Exception as e:
        logger.exception("polygon financials request failed", extra={"symbol": symbol})
        payload = {"ok": False, "error": f"Polygon financials exception {type(e).__name__}"}
        PROFILE_CACHE[cache_key] = payload
        return payload

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or not results:
        payload = {"ok": False, "error": "Polygon financials empty"}
        PROFILE_CACHE[cache_key] = payload
        return payload

    last = results[0] if isinstance(results[0], dict) else {}
    financials = last.get("financials") if isinstance(last, dict) else None
    income = financials.get("income_statement") if isinstance(financials, dict) else None

    ebitda = None
    if isinstance(income, dict):
        # Polygon commonly uses 'ebitda' field inside income_statement.
        raw = income.get("ebitda")
        if isinstance(raw, dict):
            raw = raw.get("value")
        try:
            if raw is not None:
                ebitda = float(raw)
        except Exception:
            ebitda = None

    payload = {
        "ok": ebitda is not None,
        "ebitda": ebitda,
        "sourceUrl": "https://polygon.io/docs/stocks/get_vx_reference_financials",
        "error": None if ebitda is not None else "EBITDA not available from Polygon financials",
    }
    PROFILE_CACHE[cache_key] = payload
    return payload


def fetch_polygon_daily(symbol: str, months: int) -> pd.DataFrame:
    cache_key = ("polygon_daily", symbol, months)
    if cache_key in DAILY_CACHE:
        return DAILY_CACHE[cache_key]

    key = _polygon_key()
    end = datetime.utcnow().date()
    start = end - timedelta(days=months * 31)
    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/day/{start.strftime('%Y-%m-%d')}/{end.strftime('%Y-%m-%d')}"
    params = {
        "adjusted": "true",
        "sort": "asc",
        "limit": 50000,
        "apiKey": key,
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Polygon daily status {resp.status_code}")
            data = resp.json() if resp.text else {}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("polygon daily request failed", extra={"symbol": symbol, "months": months})
        raise HTTPException(status_code=502, detail=f"Polygon daily exception {type(e).__name__}")

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or len(results) == 0:
        raise HTTPException(status_code=404, detail=f"No Polygon daily data for {symbol}")

    rows = []
    for bar in results:
        try:
            rows.append(
                {
                    "Open": float(bar.get("o")),
                    "High": float(bar.get("h")),
                    "Low": float(bar.get("l")),
                    "Close": float(bar.get("c")),
                    "Volume": float(bar.get("v") or 0),
                    "_t": int(bar.get("t")),
                }
            )
        except Exception:
            continue

    if not rows:
        raise HTTPException(status_code=404, detail=f"No Polygon daily rows for {symbol}")

    df = pd.DataFrame(rows)
    # Create a time index compatible with existing compute_gap_stats
    df.index = pd.to_datetime(df["_t"], unit="ms", utc=True)
    df = df.drop(columns=["_t"])

    DAILY_CACHE[cache_key] = df
    return df


def fetch_yahoo_profile(symbol: str) -> Dict[str, Any]:
    cache_key = symbol
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    t = _get_yf_ticker(symbol)
    info = {}
    info_error: Optional[str] = None
    try:
        info = t.get_info()
    except Exception as e:
        # Some tickers error on get_info; fallback to fast_info
        info = {}
        info_error = f"get_info failed: {type(e).__name__}"

    fast = {}
    fast_error: Optional[str] = None
    try:
        fast = dict(t.fast_info) if getattr(t, "fast_info", None) is not None else {}
    except Exception as e:
        fast = {}
        fast_error = f"fast_info failed: {type(e).__name__}"

    logger.info(
        "yahoo profile fetched",
        extra={
            "symbol": symbol,
            "info_keys": len(info) if isinstance(info, dict) else 0,
            "fast_keys": len(fast) if isinstance(fast, dict) else 0,
            "info_error": info_error,
            "fast_error": fast_error,
        },
    )

    profile = {
        "symbol": symbol,
        "exchange": _safe_get(info, "exchange") or _safe_get(info, "fullExchangeName") or _safe_get(fast, "exchange"),
        "sector": _safe_get(info, "sector"),
        "industry": _safe_get(info, "industry"),
        "employees": _safe_get(info, "fullTimeEmployees"),
        "country": _safe_get(info, "country"),
        "marketCap": _market_cap_to_number(_safe_get(info, "marketCap") or _safe_get(fast, "market_cap")),
        "ebitda": _market_cap_to_number(_safe_get(info, "ebitda")),
        "shortInterestPercent": None,
        "yahooOk": True,
        "yahooError": info_error or fast_error,
        "sources": {
            "yahoo": True,
            "knowTheFloat": False,
            "dilutionTracker": False,
        },
    }

    # Short interest: Yahoo varies, might be shortPercentOfFloat or sharesShort / floatShares.
    spof = _safe_get(info, "shortPercentOfFloat")
    if spof is not None:
        try:
            profile["shortInterestPercent"] = float(spof) * 100 if float(spof) <= 1 else float(spof)
        except Exception:
            profile["shortInterestPercent"] = None

    # If Yahoo returns no useful fields, don't poison the cache.
    useful = any(
        profile.get(k) not in (None, "")
        for k in [
            "exchange",
            "sector",
            "industry",
            "employees",
            "country",
            "marketCap",
            "ebitda",
            "shortInterestPercent",
        ]
    )
    if not useful:
        profile["yahooOk"] = False
        profile["sources"]["yahoo"] = False
        if not profile.get("yahooError"):
            profile["yahooError"] = "Yahoo returned empty profile (possible rate limit)"
        return profile

    PROFILE_CACHE[cache_key] = profile
    return profile


def fetch_knowthefloat(symbol: str) -> Dict[str, Any]:
    # NOTE: KnowTheFloat might block scraping. We keep this best-effort + cached.
    cache_key = ("ktf", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    url = f"https://www.knowthefloat.com/stock/{symbol.lower()}.htm"
    float_shares = None
    error: Optional[str] = None
    try:
        with httpx.Client(timeout=15.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                text = soup.get_text(" ")
                m = re.search(r"Float\s*:\s*([0-9,.]+)\s*(K|M|B)?", text, re.IGNORECASE)
                if m:
                    num = float(m.group(1).replace(",", ""))
                    mult = {"K": 1e3, "M": 1e6, "B": 1e9}.get((m.group(2) or "").upper(), 1.0)
                    float_shares = num * mult
                if float_shares is None:
                    error = "Float not found in page"
            else:
                error = f"HTTP {resp.status_code}"
    except Exception:
        float_shares = None
        error = "Exception while scraping"

    payload = {
        "symbol": symbol,
        "float": float_shares,
        "sourceUrl": url,
        "ok": float_shares is not None,
        "error": error,
    }
    PROFILE_CACHE[cache_key] = payload
    return payload


def fetch_dilutiontracker(symbol: str) -> Dict[str, Any]:
    """Scrape dilution info from DilutionTracker (best-effort, may be paywalled)."""
    cache_key = ("dilution", symbol)
    if cache_key in PROFILE_CACHE:
        return PROFILE_CACHE[cache_key]

    url = f"https://dilutiontracker.com/app/search/{symbol.upper()}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    result: Dict[str, Any] = {
        "symbol": symbol,
        "dilutionInfo": None,
        "ok": False,
        "sourceUrl": url,
        "error": None,
        "note": None,
    }

    try:
        with httpx.Client(timeout=15.0, headers=headers, follow_redirects=True) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                result["error"] = f"HTTP {resp.status_code}"
                PROFILE_CACHE[cache_key] = result
                return result

            soup = BeautifulSoup(resp.text, "html.parser")
            text = soup.get_text(" ", strip=True)

            # Try to find dilution-related info snippets
            dilution_patterns = [
                r"(ATM\s+offering[^.]{5,120}\.)",
                r"(shelf\s+registration[^.]{5,120}\.)",
                r"(shares\s+outstanding[:\s]+[0-9,.]+[KMBT]?)",
                r"(authorized\s+shares[:\s]+[0-9,.]+[KMBT]?)",
                r"(dilution\s+risk[^.]{5,80}\.)",
                r"(S-3\s+filing[^.]{5,80}\.)",
            ]

            snippets: List[str] = []
            for pattern in dilution_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                for match in matches[:2]:
                    cleaned = match.strip()
                    if len(cleaned) > 15 and cleaned not in snippets:
                        snippets.append(cleaned)

            if snippets:
                result["dilutionInfo"] = " | ".join(snippets[:3])
                result["ok"] = True
            else:
                result["error"] = "No dilution data found (may require subscription)"
                result["note"] = "DilutionTracker may require a paid subscription for full data."

    except Exception as e:
        logger.exception("dilutiontracker scrape failed", extra={"symbol": symbol})
        result["error"] = f"Exception {type(e).__name__}"

    PROFILE_CACHE[cache_key] = result
    return result


def fetch_intraday_1m(symbol: str, day: str) -> Dict[str, Any]:
    cache_key = (symbol, day)
    if cache_key in INTRADAY_CACHE:
        return INTRADAY_CACHE[cache_key]

    try:
        start_dt = datetime.strptime(day, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date. Expected YYYY-MM-DD")

    end_dt = start_dt + timedelta(days=1)

    # yfinance: last ~7 days for 1m
    try:
        df = yf.download(
            tickers=symbol,
            interval="1m",
            start=start_dt.strftime("%Y-%m-%d"),
            end=end_dt.strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=False,
            prepost=True,
            threads=False,
        )
    except Exception as e:
        logger.exception("yfinance intraday download failed", extra={"symbol": symbol, "date": day})
        raise HTTPException(status_code=502, detail=f"Yahoo intraday request failed: {type(e).__name__}")

    if df is None or df.empty:
        logger.warning(
            "yfinance intraday returned empty",
            extra={"symbol": symbol, "date": day},
        )
        raise HTTPException(
            status_code=404,
            detail=f"No intraday data for {symbol} on {day} (Yahoo 1m only supports recent days)",
        )

    # yfinance returns columns: Open High Low Close Adj Close Volume (multiindex sometimes)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    required = {"Open", "High", "Low", "Close", "Volume"}
    if not required.issubset(set(df.columns)):
        raise HTTPException(status_code=500, detail=f"Unexpected Yahoo columns: {list(df.columns)}")

    df = df.dropna(subset=["Open", "High", "Low", "Close"])

    candles: List[Dict[str, Any]] = []
    for idx, row in df.iterrows():
        ts = pd.Timestamp(idx)
        candles.append(
            {
                "time": _to_unix_seconds(ts),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row.get("Volume", 0) or 0),
            }
        )

    payload = {"symbol": symbol, "date": day, "count": len(candles), "candles": candles}
    INTRADAY_CACHE[cache_key] = payload
    return payload


def fetch_daily(symbol: str, months: int) -> pd.DataFrame:
    cache_key = ("daily", symbol, months)
    if cache_key in DAILY_CACHE:
        return DAILY_CACHE[cache_key]

    end = datetime.utcnow().date() + timedelta(days=1)
    start = end - timedelta(days=months * 31)

    try:
        df = yf.download(
            tickers=symbol,
            interval="1d",
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=False,
            threads=False,
        )
    except Exception as e:
        logger.exception("yfinance daily download failed", extra={"symbol": symbol, "months": months})
        raise HTTPException(status_code=502, detail=f"Yahoo daily request failed: {type(e).__name__}")

    if df is None or df.empty:
        logger.warning(
            "yfinance daily returned empty",
            extra={"symbol": symbol, "months": months},
        )
        # Empty daily data is frequently caused by temporary Yahoo throttling.
        raise HTTPException(status_code=502, detail=f"Yahoo daily returned empty for {symbol}")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    DAILY_CACHE[cache_key] = df
    return df


def compute_gap_stats(df: pd.DataFrame, gap_threshold: float = 24.0) -> Dict[str, Any]:
    # Gap = (Open - prevClose) / prevClose * 100
    if df.shape[0] < 3:
        return {
            "gapThresholdPercent": gap_threshold,
            "gapsCount": 0,
            "redAfterGapCount": 0,
            "redAfterGapPercent": 0.0,
        }

    prev_close = df["Close"].shift(1)
    gap_pct = (df["Open"] - prev_close) / prev_close * 100.0

    gaps = gap_pct >= gap_threshold
    gaps_count = int(np.nansum(gaps.astype(int)))

    red_after_gap = gaps & (df["Close"] < df["Open"])
    red_after_gap_count = int(np.nansum(red_after_gap.astype(int)))

    red_after_gap_percent = (red_after_gap_count / gaps_count * 100.0) if gaps_count else 0.0

    return {
        "gapThresholdPercent": gap_threshold,
        "gapsCount": gaps_count,
        "redAfterGapCount": red_after_gap_count,
        "redAfterGapPercent": round(red_after_gap_percent, 2),
    }


@app.get("/health")
def health():
    return {"ok": True, "name": APP_NAME}


@app.get("/ticker/profile")
def ticker_profile(symbol: str = Query(...)):
    sym = _clean_symbol(symbol)

    logger.info("ticker_profile request", extra={"symbol": sym})

    yahoo = fetch_yahoo_profile(sym)
    polygon = None
    if not bool(yahoo.get("yahooOk", True)):
        try:
            polygon = fetch_polygon_profile(sym)
        except HTTPException as e:
            polygon = {"ok": False, "error": e.detail}
        except Exception as e:
            polygon = {"ok": False, "error": f"Polygon exception {type(e).__name__}"}

    poly_ok = bool(polygon and polygon.get("ok"))
    poly_fin = None
    try:
        poly_fin = fetch_polygon_financials(sym)
    except HTTPException as e:
        poly_fin = {"ok": False, "error": e.detail}
    except Exception as e:
        poly_fin = {"ok": False, "error": f"Polygon financials exception {type(e).__name__}"}

    poly_fin_ok = bool(poly_fin and poly_fin.get("ok"))
    ktf = fetch_knowthefloat(sym)
    dil = fetch_dilutiontracker(sym)

    finviz = fetch_finviz_profile(sym)
    finviz_ok = bool(finviz and finviz.get("ok"))

    ebitda_source = "yahoo" if yahoo.get("ebitda") is not None else None
    ebitda_value = yahoo.get("ebitda")
    if ebitda_value is None and poly_fin_ok:
        ebitda_value = poly_fin.get("ebitda")
        ebitda_source = "polygon"
    if ebitda_value is None:
        gf = fetch_google_finance_ebitda(sym, yahoo.get("exchange") or (finviz.get("exchange") if finviz_ok else None) or (polygon.get("exchange") if poly_ok else None))
        if gf.get("ok"):
            ebitda_value = gf.get("ebitda")
            ebitda_source = "google"
        else:
            gf = gf
    else:
        gf = {"ok": False, "error": "not used"}
    # Last resort: Finviz snapshot table (only if EBITDA label exists in table)
    if ebitda_value is None:
        fv_ebitda = fetch_finviz_ebitda(sym)
        if fv_ebitda is not None:
            ebitda_value = fv_ebitda
            ebitda_source = "finviz"

    logger.info(
        "ebitda chosen",
        extra={"symbol": sym, "source": ebitda_source, "has_value": ebitda_value is not None},
    )

    merged = {
        **yahoo,
        # Priority: Yahoo → Finviz → Polygon
        "exchange": yahoo.get("exchange") or (finviz.get("exchange") if finviz_ok else None) or (polygon.get("exchange") if poly_ok else None),
        "sector": yahoo.get("sector") or (finviz.get("sector") if finviz_ok else None) or (polygon.get("sector") if poly_ok else None),
        "industry": yahoo.get("industry") or (finviz.get("industry") if finviz_ok else None) or (polygon.get("industry") if poly_ok else None),
        "employees": yahoo.get("employees") or (polygon.get("employees") if poly_ok else None),
        "country": yahoo.get("country") or (finviz.get("country") if finviz_ok else None) or (polygon.get("country") if poly_ok else None),
        "marketCap": yahoo.get("marketCap") or (finviz.get("marketCap") if finviz_ok else None) or (polygon.get("marketCap") if poly_ok else None),
        "ebitda": ebitda_value,
        # Float: Finviz (primary) → KnowTheFloat (fallback)
        "float": (finviz.get("float") if finviz_ok else None) or ktf.get("float"),
        # Short interest: Finviz
        "shortInterestPercent": (finviz.get("shortInterestPercent") if finviz_ok else None),
        "dilutionInfo": dil.get("dilutionInfo"),
        "sources": {
            "yahoo": bool(yahoo.get("yahooOk", True)),
            "polygon": poly_ok,
            "polygonFinancials": poly_fin_ok,
            "googleFinance": bool(ebitda_source == "google"),
            "finviz": finviz_ok,
            "knowTheFloat": bool(ktf.get("ok")),
            "dilutionTracker": bool(dil.get("ok")),
        },
        "errors": {
            "yahoo": yahoo.get("yahooError"),
            "polygon": None if poly_ok else (polygon.get("error") if polygon else None),
            "polygonFinancials": None if poly_fin_ok else (poly_fin.get("error") if poly_fin else None),
            "googleFinance": None if ebitda_source == "google" else (gf.get("error") if isinstance(gf, dict) else None),
            "finviz": None if finviz_ok else finviz.get("error"),
            "knowTheFloat": None if ktf.get("ok") else (ktf.get("error") or "KnowTheFloat unavailable"),
            "dilutionTracker": None if dil.get("ok") else (dil.get("error") or dil.get("note")),
        },
        "sourceUrls": {
            "finviz": finviz.get("sourceUrl"),
            "knowTheFloat": ktf.get("sourceUrl"),
            "polygon": polygon.get("sourceUrl") if poly_ok else None,
            "polygonFinancials": poly_fin.get("sourceUrl") if isinstance(poly_fin, dict) else None,
            "googleFinance": gf.get("sourceUrl") if isinstance(gf, dict) else None,
            "dilutionTracker": dil.get("sourceUrl"),
        },
    }

    logger.info(
        "ticker_profile mapped",
        extra={
            "symbol": sym,
            "exchange": merged.get("exchange"),
            "sector": merged.get("sector"),
            "industry": merged.get("industry"),
            "employees": merged.get("employees"),
            "country": merged.get("country"),
            "marketCap": merged.get("marketCap"),
            "float": merged.get("float"),
            "ebitda": merged.get("ebitda"),
            "shortInterestPercent": merged.get("shortInterestPercent"),
            "yahooOk": merged.get("yahooOk"),
        },
    )

    return merged


@app.get("/ticker/news")
def ticker_news(symbol: str = Query(...)):
    sym = _clean_symbol(symbol)
    logger.info("ticker_news request", extra={"symbol": sym})

    today = datetime.utcnow().date()
    cutoff = today - timedelta(days=3)

    # --- Source 1: Polygon news ---
    polygon_data = fetch_polygon_news(sym)
    polygon_items = polygon_data.get("items", []) if polygon_data.get("ok") else []

    # --- Source 2: Finviz news (already date-filtered to 3 days) ---
    finviz_items = fetch_finviz_news(sym)

    # --- Merge & normalise ---
    all_items: List[Dict[str, Any]] = []

    for it in polygon_items:
        pub = it.get("publishedAt")
        pub_date = None
        if pub:
            try:
                pub_date = datetime.fromisoformat(pub.replace("Z", "+00:00")).date()
            except Exception:
                try:
                    pub_date = datetime.strptime(pub[:10], "%Y-%m-%d").date()
                except Exception:
                    pass
        if pub_date and pub_date < cutoff:
            continue
        all_items.append({
            "title": it.get("title"),
            "description": it.get("description"),
            "url": it.get("url"),
            "publishedAt": it.get("publishedAt"),
            "source": it.get("source") or "Polygon",
        })

    for it in finviz_items:
        all_items.append({
            "title": it.get("title"),
            "description": it.get("description"),
            "url": it.get("url"),
            "publishedAt": it.get("publishedAt"),
            "source": it.get("source") or "Finviz",
        })

    # --- Deduplicate by title ---
    seen_titles: set = set()
    unique_items: List[Dict[str, Any]] = []
    for it in all_items:
        title_key = (it.get("title") or "").lower().strip()[:60]
        if title_key and title_key in seen_titles:
            continue
        seen_titles.add(title_key)
        unique_items.append(it)

    # --- Sort by date descending ---
    unique_items.sort(key=lambda x: x.get("publishedAt") or "", reverse=True)
    unique_items = unique_items[:20]

    sources_found = sorted(set(it.get("source", "") for it in unique_items if it.get("source")))

    logger.info(
        "ticker_news merged",
        extra={
            "symbol": sym,
            "polygon_count": len(polygon_items),
            "finviz_count": len(finviz_items),
            "merged_count": len(unique_items),
            "sources": sources_found,
        },
    )

    return {
        "symbol": sym,
        "ok": len(unique_items) > 0,
        "items": unique_items,
        "sources": sources_found,
        "error": None if unique_items else "No recent news found (last 3 days)",
    }


@app.get("/ticker/intraday")
def ticker_intraday(symbol: str = Query(...), date: str = Query(...)):
    sym = _clean_symbol(symbol)
    return fetch_intraday_1m(sym, date)


@app.get("/ticker/gaps")
def ticker_gaps(symbol: str = Query(...), months: int = Query(9, ge=6, le=12), gap_threshold: float = Query(24.0, ge=0.0, le=200.0)):
    sym = _clean_symbol(symbol)
    logger.info("ticker_gaps request", extra={"symbol": sym, "months": months, "gap_threshold": gap_threshold})
    try:
        try:
            df = fetch_daily(sym, months=months)
            provider = "yahoo"
        except HTTPException as e:
            logger.warning("yahoo daily unavailable, trying polygon", extra={"symbol": sym, "detail": e.detail})
            df = fetch_polygon_daily(sym, months=months)
            provider = "polygon"

        logger.info("daily rows downloaded", extra={"symbol": sym, "rows": int(df.shape[0]), "provider": provider})
        stats = compute_gap_stats(df, gap_threshold=gap_threshold)
        logger.info(
            "gap stats computed",
            extra={
                "symbol": sym,
                "rows": int(df.shape[0]),
                "gapsCount": stats.get("gapsCount"),
                "redAfterGapCount": stats.get("redAfterGapCount"),
                "provider": provider,
            },
        )
        return {"symbol": sym, "months": months, "ok": True, "provider": provider, **stats}
    except HTTPException as e:
        logger.warning(
            "gaps unavailable",
            extra={"symbol": sym, "months": months, "status": e.status_code, "detail": e.detail},
        )
        # Best-effort: keep the frontend stable.
        empty = {
            "gapThresholdPercent": gap_threshold,
            "gapsCount": 0,
            "redAfterGapCount": 0,
            "redAfterGapPercent": 0.0,
        }
        return {"symbol": sym, "months": months, "ok": False, "error": e.detail, **empty}
