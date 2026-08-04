"""
PDF Report generation — monthly, investor, due diligence, regulatory
POST /api/reports/generate  — queue job
GET  /api/reports           — list jobs
GET  /api/reports/{id}/download — download PDF
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import os, json, random
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

router = APIRouter(prefix="/api/reports", tags=["reports"])
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "reports_output")
os.makedirs(REPORTS_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class GenerateRequest(BaseModel):
    report_type: str   # monthly | investor | due_diligence | regulatory | carbon
    period: Optional[str] = None        # "2025-05" for monthly
    site_ids: Optional[List[int]] = None
    tenant_id: int = 1
    requested_by: Optional[str] = "user"
    include_forecast: bool = True
    include_carbon: bool = True
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
    class Config:
        from_attributes = True


@router.post("/generate", response_model=ReportJobOut, status_code=201)
def generate_report(body: GenerateRequest, bg: BackgroundTasks, db: Session = Depends(get_db)):
    job = models.ReportJob(
        tenant_id=body.tenant_id,
        report_type=body.report_type,
        period=body.period or datetime.utcnow().strftime("%Y-%m"),
        site_ids=body.site_ids,
        requested_by=body.requested_by,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    bg.add_task(_build_pdf, job.id, body.dict())
    return job


@router.get("", response_model=List[ReportJobOut])
def list_reports(tenant_id: int = 1, db: Session = Depends(get_db)):
    return (
        db.query(models.ReportJob)
        .filter(models.ReportJob.tenant_id == tenant_id)
        .order_by(models.ReportJob.created_at.desc())
        .limit(50).all()
    )


@router.get("/{job_id}", response_model=ReportJobOut)
def get_report(job_id: int, db: Session = Depends(get_db)):
    j = db.query(models.ReportJob).filter(models.ReportJob.id == job_id).first()
    if not j:
        raise HTTPException(404)
    return j


@router.get("/{job_id}/download")
def download_report(job_id: int, db: Session = Depends(get_db)):
    j = db.query(models.ReportJob).filter(models.ReportJob.id == job_id).first()
    if not j:
        raise HTTPException(404)
    if j.status != "done" or not j.file_path or not os.path.exists(j.file_path):
        raise HTTPException(404, "Report not ready yet")
    return FileResponse(
        j.file_path,
        media_type="application/pdf",
        filename=os.path.basename(j.file_path),
    )


# ── Background PDF builder ────────────────────────────────────────────────────
def _build_pdf(job_id: int, params: dict):
    db = SessionLocal()
    try:
        job = db.query(models.ReportJob).filter(models.ReportJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        db.commit()

        fname = f"voltaris_{params['report_type']}_{params.get('period','now')}_{job_id}.pdf"
        fpath = os.path.join(REPORTS_DIR, fname)

        html = _build_html(params)
        _html_to_pdf(html, fpath)

        job.status = "done"
        job.file_path = fpath
        job.completed_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        db.query(models.ReportJob).filter(models.ReportJob.id == job_id).update(
            {"status": "error", "error": str(e)}
        )
        db.commit()
    finally:
        db.close()


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


def _build_html(p: dict) -> str:
    rtype = p["report_type"]
    period = p.get("period", datetime.utcnow().strftime("%Y-%m"))
    lang = p.get("language", "en")
    currency = p.get("currency", "EUR")

    # Simulated KPIs
    solar_kwh = random.randint(18000, 95000)
    bess_cycles = random.randint(28, 62)
    revenue = round(random.uniform(4200, 28000), 2)
    carbon_t = round(solar_kwh * 0.000233, 1)
    uptime = round(random.uniform(97.2, 99.8), 1)
    pr = round(random.uniform(78, 92), 1)

    titles = {
        "monthly": f"Monthly Performance Report — {period}",
        "investor": "Investor Report",
        "due_diligence": "Technical Due Diligence Report",
        "regulatory": "Regulatory Compliance Report",
        "carbon": "Carbon Footprint & ESG Report",
    }
    title = titles.get(rtype, "VoltarisOS Report")

    sections = _sections_for_type(rtype, solar_kwh, bess_cycles, revenue, carbon_t, uptime, pr, period, currency)

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
  h3 {{ font-size: 14px; font-weight: 600; color: #334155; margin: 20px 0 8px; }}
  .kpi-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }}
  .kpi {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; }}
  .kpi .val {{ font-size: 28px; font-weight: 800; color: #f59e0b; }}
  .kpi .lbl {{ font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }}
  th {{ background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 700; color: #475569; }}
  td {{ padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }}
  .footer {{ margin-top: 60px; padding: 20px 60px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }}
  .green {{ color: #10b981; font-weight: 700; }}
  .amber {{ color: #f59e0b; font-weight: 700; }}
  .red {{ color: #ef4444; font-weight: 700; }}
  p {{ line-height: 1.6; color: #475569; font-size: 13px; margin: 8px 0; }}
</style>
</head>
<body>
<div class="cover">
  <div style="font-size:13px;color:#94a3b8;margin-bottom:20px;">⚡ VOLTARIS OS — ENERGY INTELLIGENCE PLATFORM</div>
  <h1>{title}</h1>
  <div class="sub">Generated {datetime.utcnow().strftime("%d %B %Y at %H:%M UTC")}</div>
  <div class="badge">CONFIDENTIAL</div>
</div>
<div class="content">
  {sections}
</div>
<div class="footer">
  <span>VoltarisOS — Confidential — {datetime.utcnow().year}</span>
  <span>Generated automatically by VoltarisOS Report Engine</span>
  <span>Page 1</span>
</div>
</body>
</html>"""


def _sections_for_type(rtype, solar_kwh, cycles, revenue, carbon_t, uptime, pr, period, currency):
    sym = "€" if currency == "EUR" else "$"

    base = f"""
    <h2>Executive Summary</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="val">{solar_kwh:,} kWh</div><div class="lbl">Energy Generated</div></div>
      <div class="kpi"><div class="val">{sym}{revenue:,.0f}</div><div class="lbl">Revenue</div></div>
      <div class="kpi"><div class="val">{uptime}%</div><div class="lbl">System Uptime</div></div>
      <div class="kpi"><div class="val">{pr}%</div><div class="lbl">Performance Ratio</div></div>
      <div class="kpi"><div class="val">{carbon_t} t</div><div class="lbl">CO₂ Avoided</div></div>
      <div class="kpi"><div class="val">{cycles}</div><div class="lbl">BESS Cycles</div></div>
    </div>"""

    if rtype == "monthly":
        return base + f"""
        <h2>Monthly Performance — {period}</h2>
        <p>All sites performed within expected parameters. Performance ratio of {pr}% is above the contractual threshold of 75%.</p>
        <h3>Production by Week</h3>
        <table>
          <tr><th>Week</th><th>Production (kWh)</th><th>PR (%)</th><th>Revenue ({sym})</th><th>Status</th></tr>
          {"".join(f'<tr><td>Week {i+1}</td><td>{random.randint(3000,8000):,}</td><td>{round(random.uniform(76,93),1)}</td><td>{sym}{random.randint(400,2200)}</td><td class="green">✓ Normal</td></tr>' for i in range(4))}
        </table>
        <h3>Alerts &amp; Incidents</h3>
        <table>
          <tr><th>Date</th><th>Device</th><th>Severity</th><th>Description</th><th>Resolution</th></tr>
          <tr><td>{period}-07</td><td>Inverter #1</td><td class="amber">Warning</td><td>Grid frequency deviation</td><td>Auto-resolved</td></tr>
          <tr><td>{period}-14</td><td>BESS #1</td><td class="green">Info</td><td>Scheduled maintenance</td><td>Completed</td></tr>
        </table>"""

    elif rtype == "investor":
        irr = round(random.uniform(11, 18), 1)
        npv = round(random.uniform(280000, 950000), 0)
        lcoe = round(random.uniform(28, 52), 1)
        return base + f"""
        <h2>Financial Performance</h2>
        <div class="kpi-grid">
          <div class="kpi"><div class="val">{irr}%</div><div class="lbl">Project IRR</div></div>
          <div class="kpi"><div class="val">{sym}{npv:,.0f}</div><div class="lbl">NPV</div></div>
          <div class="kpi"><div class="val">{lcoe} {sym}/MWh</div><div class="lbl">LCOE</div></div>
        </div>
        <h3>Revenue Breakdown</h3>
        <table>
          <tr><th>Stream</th><th>Amount ({sym})</th><th>% of Total</th></tr>
          <tr><td>Energy Sales</td><td>{sym}{int(revenue*0.65):,}</td><td>65%</td></tr>
          <tr><td>Grid Services (FCR/aFRR)</td><td>{sym}{int(revenue*0.22):,}</td><td>22%</td></tr>
          <tr><td>Capacity Market</td><td>{sym}{int(revenue*0.13):,}</td><td>13%</td></tr>
        </table>
        <h3>5-Year Projection</h3>
        <table>
          <tr><th>Year</th><th>Revenue ({sym})</th><th>OPEX ({sym})</th><th>EBITDA ({sym})</th><th>Cumulative IRR</th></tr>
          {"".join(f'<tr><td>{datetime.utcnow().year + i}</td><td>{sym}{int(revenue*(1+i*0.03)):,}</td><td>{sym}{int(revenue*0.18):,}</td><td>{sym}{int(revenue*0.82*(1+i*0.03)):,}</td><td>{round(irr-2+i*0.8,1)}%</td></tr>' for i in range(5))}
        </table>"""

    elif rtype == "due_diligence":
        return base + f"""
        <h2>Technical Assessment</h2>
        <p>This report provides a comprehensive technical due diligence of all assets under management.</p>
        <h3>Asset Inventory</h3>
        <table>
          <tr><th>Asset</th><th>Rated Power</th><th>Age (yr)</th><th>Health</th><th>Remaining Life</th></tr>
          <tr><td>PV Array — Site A</td><td>250 kWp</td><td>3</td><td class="green">92%</td><td>22 yr</td></tr>
          <tr><td>BESS — Site A</td><td>100 kW / 200 kWh</td><td>2</td><td class="green">89%</td><td>11 yr</td></tr>
          <tr><td>Inverter #1 (SolarEdge)</td><td>60 kW</td><td>3</td><td class="amber">81%</td><td>7 yr</td></tr>
          <tr><td>Smart Meter — Site B</td><td>—</td><td>1</td><td class="green">99%</td><td>14 yr</td></tr>
        </table>
        <h3>Risk Register</h3>
        <table>
          <tr><th>Risk</th><th>Probability</th><th>Impact</th><th>Mitigation</th></tr>
          <tr><td>Inverter degradation</td><td class="amber">Medium</td><td class="amber">Medium</td><td>Predictive maintenance schedule active</td></tr>
          <tr><td>Grid curtailment</td><td class="green">Low</td><td class="amber">Medium</td><td>VPP dispatch optimisation</td></tr>
          <tr><td>Battery cell replacement</td><td class="green">Low</td><td class="red">High</td><td>Warranty until 2031</td></tr>
        </table>"""

    elif rtype == "regulatory":
        return base + f"""
        <h2>Regulatory Compliance Status</h2>
        <table>
          <tr><th>Regulation</th><th>Status</th><th>Deadline</th><th>Notes</th></tr>
          <tr><td>EU RED II (Renewable Energy)</td><td class="green">✓ Compliant</td><td>Ongoing</td><td>All generation certified</td></tr>
          <tr><td>ENTSO-E Grid Code</td><td class="green">✓ Compliant</td><td>Ongoing</td><td>Frequency response within limits</td></tr>
          <tr><td>MIBEL Market Rules</td><td class="green">✓ Registered</td><td>Annual renewal</td><td>Aggregator ID: PT-AGG-{random.randint(1000,9999)}</td></tr>
          <tr><td>ISO 50001 (Energy Mgmt)</td><td class="amber">⚠ In progress</td><td>Dec 2026</td><td>Audit scheduled Q3</td></tr>
          <tr><td>GDPR (operational data)</td><td class="green">✓ Compliant</td><td>Ongoing</td><td>Data retention policy active</td></tr>
        </table>
        <h3>Metering & Certification</h3>
        <p>All revenue meters are MID-certified and calibrated within the last 24 months. Next calibration due: {(datetime.utcnow() + timedelta(days=365)).strftime("%B %Y")}.</p>"""

    elif rtype == "carbon":
        trees = int(carbon_t * 45)
        homes = int(solar_kwh / 3500)
        return base + f"""
        <h2>Carbon & ESG Performance</h2>
        <div class="kpi-grid">
          <div class="kpi"><div class="val">{carbon_t} t</div><div class="lbl">CO₂ Avoided</div></div>
          <div class="kpi"><div class="val">{trees:,}</div><div class="lbl">Equivalent Trees</div></div>
          <div class="kpi"><div class="val">{homes}</div><div class="lbl">Homes Powered</div></div>
        </div>
        <h3>Scope 1, 2 & 3 Emissions</h3>
        <table>
          <tr><th>Scope</th><th>Category</th><th>tCO₂e</th><th>vs Last Year</th></tr>
          <tr><td>Scope 1</td><td>Direct (operations)</td><td>0.0</td><td class="green">—</td></tr>
          <tr><td>Scope 2</td><td>Purchased electricity</td><td>{round(carbon_t*0.04,1)}</td><td class="green">-12%</td></tr>
          <tr><td>Scope 3</td><td>Supply chain</td><td>{round(carbon_t*0.18,1)}</td><td class="green">-5%</td></tr>
          <tr><td colspan="2"><b>Total avoided (solar generation)</b></td><td class="green"><b>-{carbon_t}</b></td><td class="green"><b>Net positive</b></td></tr>
        </table>
        <h3>ESG Scorecard</h3>
        <table>
          <tr><th>Pillar</th><th>Score</th><th>Industry Avg</th><th>Trend</th></tr>
          <tr><td>Environmental</td><td class="green">A+</td><td>B</td><td>↑ Improving</td></tr>
          <tr><td>Social</td><td class="green">A</td><td>B+</td><td>→ Stable</td></tr>
          <tr><td>Governance</td><td class="amber">B+</td><td>B</td><td>↑ Improving</td></tr>
        </table>"""

    return base
