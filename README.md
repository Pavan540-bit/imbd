# Portfolio

Personal finance dashboard for an individual investor in India. Amounts are in rupees. Records are stored in `data/portfolio.sqlite` and stay on this machine.

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The portfolio starts empty. Settings can load labeled demonstration data, import a CSV, and download a JSON backup.

Equity prices are fetched from Yahoo Finance and mutual fund NAVs from AMFI only when you press Refresh. If a feed does not respond, the stored price is left unchanged.
