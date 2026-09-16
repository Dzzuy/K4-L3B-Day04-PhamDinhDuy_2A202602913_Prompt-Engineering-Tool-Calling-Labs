# PrivacyGuard AI web UI

Dark-mode 3-panel demo for CSV PII scan, masking preview, and confirmation.

## Run

Terminal 1, from `starter_v0`:

```bash
python -m pip install -r requirements.txt
python run_web.py
```

Terminal 2, from `web`:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Upload `starter_v0/privacyguard/sample_contacts.csv`, then send:

`Scan this dataset and preview masking.`

Click **Confirm Masking** to write redacted values. Chat uses a deterministic `scan_dataset → detect_pii → preview_masking` pipeline. If a provider key is present in `starter_v0/.env`, the same tools can also be selected by the model.
