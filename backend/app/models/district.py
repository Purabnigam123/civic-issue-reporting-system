"""
Delhi district definitions and utility constants.
"""

from typing import List, Dict, Any


# ── Delhi's 13 administrative & operational districts ────────────────
# Each entry has a machine-readable `id`, display `name`, sub_divisions,
# and a list of keyword fragments used for geocoding & address matching.

DELHI_DISTRICTS: List[Dict[str, Any]] = [
    {
        "id": "central_delhi",
        "name": "Central Delhi",
        "sub_divisions": ["Patel Nagar", "Karol Bagh"],
        "keywords": ["central delhi", "patel nagar", "karol bagh", "rajender nagar", "paharganj"],
    },
    {
        "id": "central_north_delhi",
        "name": "Central North Delhi",
        "sub_divisions": ["Shakur Basti", "Shalimar Bagh", "Model Town"],
        "keywords": ["central north delhi", "shakur basti", "shalimar bagh", "model town", "keshav puram", "wazirpur", "tri nagar"],
    },
    {
        "id": "east_delhi",
        "name": "East Delhi",
        "sub_divisions": ["Gandhi Nagar", "Vishwas Nagar", "Patparganj"],
        "keywords": ["east delhi", "gandhi nagar", "vishwas nagar", "patparganj", "mayur vihar", "laxmi nagar", "preet vihar", "pandav nagar"],
    },
    {
        "id": "new_delhi",
        "name": "New Delhi",
        "sub_divisions": ["New Delhi", "Delhi Cantonment"],
        "keywords": ["new delhi", "delhi cantonment", "delhi cantt", "connaught place", "india gate", "mandi house", "barakhamba", "janpath", "parliament", "chanakyapuri"],
    },
    {
        "id": "north_delhi",
        "name": "North Delhi",
        "sub_divisions": ["Burari", "Adarsh Nagar", "Badli"],
        "keywords": ["north delhi", "burari", "adarsh nagar", "badli", "civil lines", "kamla nagar", "shakti nagar", "timarpur"],
    },
    {
        "id": "north_east_delhi",
        "name": "North East Delhi",
        "sub_divisions": ["Karawal Nagar", "Gokal Puri", "Yamuna Vihar", "Shahdara"],
        "keywords": ["north east delhi", "karawal nagar", "gokal puri", "yamuna vihar", "shahdara", "seelampur", "jaffrabad", "nand nagri", "bhajanpura", "dilshad garden", "northeast delhi"],
    },
    {
        "id": "north_west_delhi",
        "name": "North West Delhi",
        "sub_divisions": ["Kirari", "Nangloi Jat", "Rohini"],
        "keywords": ["north west delhi", "kirari", "nangloi jat", "nangloi", "rohini", "pitampura", "mangal bazar", "northwest delhi"],
    },
    {
        "id": "old_delhi",
        "name": "Old Delhi",
        "sub_divisions": ["Sadar Bazar", "Chandni Chowk"],
        "keywords": ["old delhi", "sadar bazar", "sadar bazaar", "chandni chowk", "daryaganj", "chawri bazar", "jama masjid", "kashmere gate", "ballimaran"],
    },
    {
        "id": "outer_north_delhi",
        "name": "Outer North Delhi",
        "sub_divisions": ["Mundka", "Narela", "Bawana"],
        "keywords": ["outer north delhi", "mundka", "narela", "bawana", "alipur", "bakhtawarpur", "khera kalan"],
    },
    {
        "id": "south_delhi",
        "name": "South Delhi",
        "sub_divisions": ["Chhatarpur", "Malviya Nagar", "Deoli", "Mehrauli"],
        "keywords": ["south delhi", "chhatarpur", "malviya nagar", "deoli", "mehrauli", "saket", "hauz khas", "vasant kunj", "green park", "sangam vihar"],
    },
    {
        "id": "south_east_delhi",
        "name": "South East Delhi",
        "sub_divisions": ["Jangpura", "Kalkaji", "Badarpur"],
        "keywords": ["south east delhi", "jangpura", "kalkaji", "badarpur", "okhla", "tughlakabad", "lajpat nagar", "defence colony", "sarita vihar", "southeast delhi"],
    },
    {
        "id": "south_west_delhi",
        "name": "South West Delhi",
        "sub_divisions": ["Najafgarh", "Matiala", "Dwarka", "Bijwasan"],
        "keywords": ["south west delhi", "najafgarh", "matiala", "dwarka", "bijwasan", "palam", "kapashera", "dabri", "chhawla", "southwest delhi"],
    },
    {
        "id": "west_delhi",
        "name": "West Delhi",
        "sub_divisions": ["Vikaspuri", "Janakpuri", "Rajouri Garden"],
        "keywords": ["west delhi", "vikaspuri", "janakpuri", "rajouri garden", "tilak nagar", "hari nagar", "subhash nagar", "uttam nagar", "paschim vihar"],
    },
]

# Quick lookup dicts
DISTRICT_BY_ID: Dict[str, Dict[str, Any]] = {d["id"]: d for d in DELHI_DISTRICTS}
DISTRICT_NAMES: Dict[str, str] = {d["id"]: d["name"] for d in DELHI_DISTRICTS}


def get_all_districts() -> List[Dict[str, str]]:
    """Return public-facing list of districts (id + name only)."""
    return [{"id": d["id"], "name": d["name"]} for d in DELHI_DISTRICTS]
