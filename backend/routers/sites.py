from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import json
import os

router = APIRouter()

SITES_FILE = "sites.json"

class Site(BaseModel):
    name: str
    location: str
    lat: float
    lng: float
    solar_kw: float
    battery_kwh: float
    ev_chargers: int
    owner: str
    status: str = "active"

def load_sites():
    if not os.path.exists(SITES_FILE):
        return []
    with open(SITES_FILE, "r") as f:
        return json.load(f)

def save_sites(sites):
    with open(SITES_FILE, "w") as f:
        json.dump(sites, f, indent=2)

@router.get("/sites")
def get_sites():
    return load_sites()

@router.post("/sites")
def create_site(site: Site):
    sites = load_sites()
    new_site = site.dict()
    new_site["id"] = len(sites) + 1
    sites.append(new_site)
    save_sites(sites)
    return new_site

@router.delete("/sites/{site_id}")
def delete_site(site_id: int):
    sites = load_sites()
    sites = [s for s in sites if s["id"] != site_id]
    save_sites(sites)
    return {"message": "Site removed"}