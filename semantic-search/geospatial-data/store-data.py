import requests
import pandas as pd

OVERPASS_URL = "http://overpass-api.de/api/interpreter"

# Categories grouped by key
CATEGORIES = {
    "amenity": [
        "hospital","clinic","doctors","dentist","pharmacy",
        "school","college","university","kindergarten","library",
        "bus_station","taxi","parking","bicycle_parking","fuel",
        "restaurant","fast_food","cafe","bar","pub",
        "cinema","theatre","bank","atm","post_office","police","fire_station"
    ],
    "shop": ["supermarket","convenience","mall","department_store"],
    "leisure": ["park","sports_centre","gym","swimming_pool","stadium"],
    "railway": ["station","subway_entrance","tram_stop"],
    "aeroway": ["aerodrome"]
}

def build_query(city: str, categories: dict) -> str:
    query = f'[out:json][timeout:180];\narea["name"="{city}"]->.a;\n(\n'
    for key, values in categories.items():
        for val in values:
            query += f'  node["{key}"="{val}"](area.a);\n'
    query += ");\nout center;"
    return query

def fetch_osm_data(query: str):
    response = requests.get(OVERPASS_URL, params={'data': query})
    response.raise_for_status()
    return response.json()

def parse_elements(data):
    pois = []
    for el in data['elements']:
        tags = el.get('tags', {})
        pois.append({
            "id": el.get("id"),
            "lat": el.get("lat"),
            "lon": el.get("lon"),
            "name": tags.get("name"),
            "category": next((k for k,v in tags.items() if v in sum(CATEGORIES.values(), [])), None),
            "tags": tags
        })
    return pois

if __name__ == "__main__":
    city = "Mumbai"
    query = build_query(city, CATEGORIES)
    print(f"Fetching POIs for {city}...")
    data = fetch_osm_data(query)
    pois = parse_elements(data)

    df = pd.DataFrame(pois)
    df.to_csv("mumbai_pois.csv", index=False)
    print(f"✅ Saved {len(df)} POIs to mumbai_pois.csv")
