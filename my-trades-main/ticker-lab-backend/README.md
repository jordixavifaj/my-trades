# Ticker Lab Backend (FastAPI)

## Run

1. Create venv

```bash
python -m venv .venv
.venv\\Scripts\\activate
```

2. Install deps

```bash
pip install -r requirements.txt
```

3. Start server

```bash
uvicorn main:app --reload --port 8001
```

## Endpoints

- `GET /health`
- `GET /ticker/profile?symbol=TSLA`
- `GET /ticker/intraday?symbol=TSLA&date=2026-02-03`
- `GET /ticker/gaps?symbol=TSLA&months=9&gap_threshold=24`

## Notes

- Yahoo 1m intraday is limited to recent days (~7). This is enough for testing.
- KnowTheFloat / DilutionTracker integrations are best-effort; scraping may fail depending on site protections.
- Caching is enabled to reduce calls.
