"""
PDF Report generation — monthly, investor, due diligence, regulatory, carbon.

Tenant isolation: the tenant is ALWAYS derived from the authenticated user (JWT),
never from the request body/query. Report content is built from real persisted
data; no random/mock KPIs.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import os

from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "reports_output")
os.makedirs(REPORTS_DIR, exist_ok=True)

VALID_TYPES = {"monthly", "investor", "due_diligence", "regulatory", "carbon"}
TITLES = {
    "monthly": "Monthly Performance Report",
    "investor": "Investor Report",
    "due_diligence": "Technical Due Diligence Report",
    "regulatory": "Regulatory Compliance Report",
    "carbon": "Carbon Footprint & ESG Report",
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _effective_tenant(user: dict):
    """Tenant filter value, or None for SUPER_ADMIN bypass (matches other routers)."""
    if user.get("role") == "SUPER_ADMIN":
        return None
    return user.get("tenant_id")


def _get_owned_report(db: Session, job_id: int, user: dict) -> models.ReportJob:
    """Return a ReportJob visible to `user`, or 404 without leaking existence."""
    q = db.query(models.ReportJob).filter(models.ReportJob.id == job_id)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.ReportJob.tenant_id == tenant)
    job = q.first()
    if not job:
        raise HTTPException(404, "Report not found")
    return job


def _validate_site_ids(db: Session, site_ids, user: dict) -> Optional[List[int]]:
    """Ensure every site belongs to the effective tenant; 404 no-leak otherwise."""
    if not site_ids:
        return None
    tenant = _effective_tenant(user)
    q = db.query(models.Site).filter(models.Site.id.in_(site_ids))
    if tenant is not None:
        q = q.filter(models.Site.tenant_id == tenant)
    found = {s.id for s in q.all()}
    if len(found) != len(set(site_ids)):
        raise HTTPException(404, "Site not found")
    return list(found)


class GenerateRequest(BaseModel):
    report_type: str
    period: Optional[str] = None        # "2025-05" for monthly
    site_ids: Optional[List[int]] = None
    include_forecast: bool = False
    include_carbon: bool = False
    currency: str = "EUR"
    language: str = "en"


class ReportJobOut(BaseModel):
    id: int
    tenant_id: int
    report_type: str
    period: Optional[str]
    status: str
    file_path: Optional[str]
    error: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    requested_by: Optional[str]
    model_config = ConfigDict(from_attributes=True)

@router.post("/generate", response_model=ReportJobOut, status_code=201)
def generate_report(body: GenerateRequest, bg: BackgroundTasks, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Create a report job. The tenant always comes from the authenticated user."""
    if body.report_type not in VALID_TYPES:
        raise HTTPException(400, "Invalid report type")
    tenant_id = user.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(400, "tenant_id could not be resolved")
    site_ids = _validate_site_ids(db, body.site_ids, user)
    job = models.ReportJob(
        tenant_id=tenant_id,
        report_type=body.report_type,
        period=body.period or models.utcnow_naive().strftime("%Y-%m"),
        site_ids=site_ids,
        requested_by=user.get("sub"),
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    params = {
        "report_type": body.report_type,
        "period": job.period,
        "site_ids": site_ids,
        "include_forecast": body.include_forecast,
        "include_carbon": body.include_carbon,
        "currency": body.currency,
        "language": body.language,
    }
    bg.add_task(_build_pdf, job.id, params)
    return job


@router.get("", response_model=List[ReportJobOut])
def list_reports(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """List jobs for the effective tenant; SUPER_ADMIN sees all."""
    q = db.query(models.ReportJob)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.ReportJob.tenant_id == tenant)
    return q.order_by(models.ReportJob.created_at.desc()).limit(50).all()


@router.get("/{job_id}", response_model=ReportJobOut)
def get_report(job_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    return _get_owned_report(db, job_id, user)


@router.get("/{job_id}/download")
def download_report(job_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    job = _get_owned_report(db, job_id, user)
    if job.status != "done" or not job.file_path or not os.path.exists(job.file_path):
        raise HTTPException(404, "Report not ready yet")
    return FileResponse(
        job.file_path,
        media_type="application/pdf",
        filename=os.path.basename(job.file_path),
    )


# ── Background PDF builder ────────────────────────────────────────────────────
def _build_pdf(job_id: int, params: dict):
    """Generate the PDF from real DB data. Runs in a background task."""
    db = SessionLocal()
    try:
        job = db.query(models.ReportJob).filter(models.ReportJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        db.commit()

        metrics = _collect_metrics(db, job)
        html = _build_html(metrics, params)

        fname = f"voltaris_{params['report_type']}_{params.get('period', 'now')}_{job_id}.pdf"
        fpath = os.path.join(REPORTS_DIR, fname)
        _html_to_pdf(html, fpath)

        job.status = "done"
        job.file_path = fpath
        job.completed_at = models.utcnow_naive()
        db.commit()
    except Exception as e:
        db.query(models.ReportJob).filter(models.ReportJob.id == job_id).update(
            {"status": "error", "error": str(e)}
        )
        db.commit()
    finally:
        db.close()


def _collect_metrics(db: Session, job: models.ReportJob) -> dict:
    """Aggregate real, persisted metrics scoped to the job's tenant and sites."""
    tenant_id = job.tenant_id

    sq = db.query(models.Site)
    if tenant_id is not None:
        sq = sq.filter(models.Site.tenant_id == tenant_id)
    if job.site_ids:
        sq = sq.filter(models.Site.id.in_(job.site_ids))
    sites = sq.all()
    site_ids = [s.id for s in sites]

    solar_capacity = round(sum(s.solar_kw or 0 for s in sites), 1)
    bess_capacity = round(sum(s.battery_kwh or 0 for s in sites), 1)
    ev_chargers = sum(s.ev_chargers or 0 for s in sites)

    dq = db.query(models.Device)
    if tenant_id is not None:
        dq = dq.filter(models.Device.tenant_id == tenant_id)
    if site_ids:
        dq = dq.filter(models.Device.site_id.in_(site_ids))
    devices = dq.all()
    total_devices = len(devices)
    enabled_devices = sum(1 for d in devices if d.enabled)
    online_devices = sum(1 for d in devices if d.status == "online")

    # Current power = sum of the latest real reading power_kw per device.
    current_power_kw = 0.0
    has_telemetry = False
    for d in devices:
        r = (
            db.query(models.DeviceReading)
            .filter(models.DeviceReading.device_id == d.id)
            .order_by(models.DeviceReading.timestamp.desc())
            .first()
        )
        if r and r.power_kw is not None:
            current_power_kw += r.power_kw
            has_telemetry = True

    bids = db.query(models.VPPBid).filter(models.VPPBid.tenant_id == tenant_id).all() if tenant_id is not None else []
    total_bids = len(bids)
    accepted_bids = sum(1 for b in bids if b.status == "accepted")
    pnl_eur = round(sum(b.pnl_eur or 0 for b in bids), 2)

    aq = db.query(models.Alert)
    if tenant_id is not None:
        aq = aq.filter(models.Alert.tenant_id == tenant_id)
    alerts = aq.all()
    total_alerts = len(alerts)
    unacked_alerts = sum(1 for a in alerts if not a.acknowledged)
    critical_alerts = sum(1 for a in alerts if a.severity == "critical")

    return {
        "sites": sites,
        "solar_capacity": solar_capacity,
        "bess_capacity": bess_capacity,
        "ev_chargers": ev_chargers,
        "total_devices": total_devices,
        "enabled_devices": enabled_devices,
        "online_devices": online_devices,
        "current_power_kw": round(current_power_kw, 1) if has_telemetry else None,
        "has_telemetry": has_telemetry,
        "total_bids": total_bids,
        "accepted_bids": accepted_bids,
        "pnl_eur": pnl_eur,
        "total_alerts": total_alerts,
        "unacked_alerts": unacked_alerts,
        "critical_alerts": critical_alerts,
    }


def _html_to_pdf(html: str, path: str):
    try:
        from weasyprint import HTML
        HTML(string=html).write_pdf(path)
    except Exception:
        # Fallback: write plain PDF via reportlab
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        c = canvas.Canvas(path, pagesize=A4)
        w, h = A4
        c.setFont("Helvetica-Bold", 20)
        c.drawString(60, h - 80, "VoltarisOS Report")
        c.setFont("Helvetica", 12)
        y = h - 130
        for line in html.replace("<br>", "\n").split("\n"):
            import re
            clean = re.sub(r"<[^>]+>", "", line).strip()
            if clean:
                c.drawString(60, y, clean[:90])
                y -= 18
                if y < 60:
                    c.showPage()
                    y = h - 60
        c.save()


def _money(v, sym):
    if v is None:
        return "Sem dados financeiros"
    return f"{sym}{v:,.2f}"


def _build_html(metrics: dict, params: dict) -> str:
    rtype = params["report_type"]
    period = params.get("period") or ""
    currency = params.get("currency", "EUR")
    sym = "€" if currency == "EUR" else "$"
    title = TITLES.get(rtype, "VoltarisOS Report")
    m = metrics
    now = models.utcnow_naive().strftime("%d %B %Y at %H:%M UTC")

    site_rows = "".join(
        f"<tr><td>{s.name}</td><td>{s.location or '—'}</td>"
        f"<td>{s.solar_kw or 0}</td><td>{s.battery_kwh or 0}</td>"
        f"<td>{s.ev_chargers or 0}</td><td>{s.status or '—'}</td></tr>"
        for s in m["sites"]
    )

    current_power = f"{m['current_power_kw']} kW" if m["has_telemetry"] else "Sem dados de telemetria"

    sections = f"""
    <h2>Executive Summary</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="val">{len(m['sites'])}</div><div class="lbl">Total Sites</div></div>
      <div class="kpi"><div class="val">{m['solar_capacity']:,.1f} kW</div><div class="lbl">Solar Capacity</div></div>
      <div class="kpi"><div class="val">{m['bess_capacity']:,.1f} kWh</div><div class="lbl">BESS Capacity</div></div>
      <div class="kpi"><div class="val">{m['total_devices']}</div><div class="lbl">Total Devices</div></div>
      <div class="kpi"><div class="val">{m['online_devices']} / {m['total_devices']}</div><div class="lbl">Online Devices</div></div>
      <div class="kpi"><div class="val">{current_power}</div><div class="lbl">Current Power</div></div>
    </div>

    <h2>Sites</h2>
    <table>
      <tr><th>Site</th><th>Location</th><th>Solar (kW)</th><th>BESS (kWh)</th><th>EV Chargers</th><th>Status</th></tr>
      {site_rows if site_rows else '<tr><td colspan="6">Sem sites.</td></tr>'}
    </table>

    <h2>Financial (VPP bids)</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="val">{m['total_bids']}</div><div class="lbl">Bids</div></div>
      <div class="kpi"><div class="val">{m['accepted_bids']}</div><div class="lbl">Accepted</div></div>
      <div class="kpi"><div class="val">{_money(m['pnl_eur'] if m['pnl_eur'] != 0 else None, sym)}</div><div class="lbl">Realised PnL</div></div>
    </div>
    <p>Valores financeiros refletem apenas o PnL persistido dos bids VPP; não são uma estimativa de receita.</p>

    <h2>Alerts</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="val">{m['total_alerts']}</div><div class="lbl">Total Alerts</div></div>
      <div class="kpi"><div class="val">{m['unacked_alerts']}</div><div class="lbl">Unacknowledged</div></div>
      <div class="kpi"><div class="val">{m['critical_alerts']}</div><div class="lbl">Critical</div></div>
    </div>
    """

    if params.get("include_carbon"):
        sections += "\n    <h2>Carbon</h2>\n    <p>Dados de carbono não disponíveis para o relatório.</p>\n"

    if params.get("include_forecast"):
        sections += "\n    <h2>Forecast</h2>\n    <p>Sem dados de forecast disponíveis para o relatório.</p>\n"

    return f"""<!DOCTYPE html>

<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; background: #fff; }}
  .cover {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 80px 60px; min-height: 260px; }}
  .cover h1 {{ font-size: 32px; font-weight: 800; margin-bottom: 8px; }}
  .cover .sub {{ color: #94a3b8; font-size: 15px; margin-top: 6px; }}
  .cover .badge {{ display: inline-block; background: #f59e0b; color: #000; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-top: 16px; }}
  .content {{ padding: 48px 60px; }}
  h2 {{ font-size: 18px; font-weight: 700; color: #0f172a; margin: 36px 0 14px; border-bottom: 2px solid #f59e0b; padding-bottom: 6px; }}
  .kpi-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }}
  .kpi {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; }}
  .kpi .val {{ font-size: 22px; font-weight: 800; color: #f59e0b; }}
  .kpi .lbl {{ font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }}
  th {{ background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 700; color: #475569; }}
  td {{ padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }}
  .footer {{ margin-top: 60px; padding: 20px 60px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }}
  p {{ line-height: 1.6; color: #475569; font-size: 13px; margin: 8px 0; }}
</style>
</head>
<body>
<div class="cover">
  <div style="font-size:13px;color:#94a3b8;margin-bottom:20px;">⚡ VOLTARIS OS — ENERGY INTELLIGENCE PLATFORM</div>
  <h1>{title}</h1>
  <div class="sub">Generated {now}</div>
  <div class="badge">CONFIDENTIAL</div>
</div>
<div class="content">
  <p style="color:#64748b;font-size:12px;">Period: {period}</p>
  {sections}
</div>
<div class="footer">
  <span>VoltarisOS — Confidential — {models.utcnow_naive().year}</span>
  <span>Generated automatically by VoltarisOS Report Engine</span>
</div>
</body>
</html>"""

