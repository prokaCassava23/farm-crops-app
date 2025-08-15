from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import requests
import os
import uvicorn
import threading
import time

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EMAIL = os.getenv("email")
PASSWORD = os.getenv("password")

login_url = 'https://farmmanagergame.com/login-check.php'
data_url = 'https://farmmanagergame.com/api/market.php'
data_price_url = 'https://farmmanagergame.com/api/get-crop-values.php'
crop_data_url = 'https://farmmanagergame.com/api/crop-data.php'

cached_data = []

def fetch_crop_data():
    global cached_data
    try:
        with requests.Session() as s:
            s.post(login_url, data={"email": EMAIL, "password": PASSWORD})
            seeds = s.get(data_url).json().get("seed", [])
            values = s.get(data_price_url).json().get("cropValues", {})
            crops = s.get(crop_data_url).json().get("crops", [])

            enriched = []
            for crop in crops:
                cid = str(crop.get("id"))
                seed = next((s for s in seeds if str(s['id']) == cid), {})
                val = values.get(cid, {})
                enriched.append({
                    "id": cid,
                    "name": crop.get("name"),
                    "type": seed.get("type", crop.get("type")),
                    "cropValueRating": val.get("cropValueRating"),
                    "cropValuePer1k": val.get("cropValuePer1k"),
                    "seedCost": seed.get("seedCost"),
                    "kgPerHa": seed.get("kgPerHa"),
                    "yieldPerHa": seed.get("yieldPerHa", crop.get("yieldPerHa")),
                    "tempMinC": seed.get("tempMinC"),
                    "tempMaxC": seed.get("tempMaxC"),
                    "bestPh": seed.get("bestPh"),
                    "irrigation": seed.get("irrigation"),
                    "maturingTime": crop.get("maturingTime"),
                    "haTraded": crop.get("haTraded"),
                    "harvestCycles": crop.get("harvestCycles")
                })
            cached_data = enriched
    except Exception as e:
        print("Error updating crop data:", e)

def background_updater():
    while True:
        fetch_crop_data()
        time.sleep(7)

@app.get("/api/crops")
def get_crops():
    return cached_data

@app.get("/api/price-chart/{crop_id}")
def get_price_chart(crop_id: int):
    try:
        with requests.Session() as s:
            s.post(login_url, data={"email": EMAIL, "password": PASSWORD})        
            form_data = {
                "type": "crop",
                "cropId": crop_id,
                "BT": "your_BT_value_here",
                "BC03B460556A6B8D": "your_BC_value_here"
            }
            
            resp = s.post(
                "https://farmmanagergame.com/api/price-chart.php",
                data=form_data
            )
            resp.raise_for_status()
            data = resp.json()

            if not isinstance(data, list):
                return []
            return data
    except Exception as e:
        print("Error fetching price chart:", e)
        return []

@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("index.html", "r", encoding="utf-8") as f: 
        return HTMLResponse(f.read())

threading.Thread(target=background_updater, daemon=True).start()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
