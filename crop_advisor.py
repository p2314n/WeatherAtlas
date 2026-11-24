"""Transparent prototype crop screening rules for a Maharashtra pilot.

These broad crop-calendar rules are for a student project demo, not farm
instructions. Site-specific recommendations must be checked with a local KVK
or IMD Agromet advisory.
"""

from calendar import month_name


MAHARASHTRA_CROPS = [
    {
        "name": "Kharif sorghum (jowar)", "season": "Kharif", "months": [6, 7],
        "soils": ["light", "medium_black", "deep_black"],
        "water": ["rainfed", "limited", "assured"],
        "source": "https://www.gazetteers.maharashtra.gov.in/cultural.maharashtra.gov.in/english/gazetteer/Poona/PART%20IV/Chap%20%285%29/Agricultural%20Operation.htm",
        "note": "Maharashtra district calendars list kharif jowar in June–July.",
    },
    {
        "name": "Cotton", "season": "Kharif", "months": [5, 6],
        "soils": ["medium_black", "deep_black"],
        "water": ["rainfed", "limited", "assured"],
        "source": "https://icar.gov.in/sites/default/files/Circulars/ICAR%20En-Kharif%20Agro-Advisories%20for%20Farmers%202025.pdf",
        "note": "ICAR's Maharashtra advisory describes May–June sowing and black/medium soils.",
    },
    {
        "name": "Rabi sorghum (jowar)", "season": "Rabi", "months": [9, 10],
        "soils": ["medium_black", "deep_black"],
        "water": ["rainfed", "limited", "assured"],
        "source": "https://www.gazetteers.maharashtra.gov.in/cultural.maharashtra.gov.in/english/gazetteer/Poona/PART%20IV/Chap%20%285%29/Agricultural%20Operation.htm",
        "note": "Maharashtra district calendars list rabi jowar in September–October.",
    },
    {
        "name": "Chickpea (gram)", "season": "Rabi", "months": [10, 11],
        "soils": ["light", "medium_black", "well_drained", "alluvial"],
        "water": ["rainfed", "limited", "assured"],
        "source": "https://www.icar.org.in/sites/default/files/inline-files/Rabi-Agro-Advisory-2021-22.pdf",
        "note": "ICAR advises October–November sowing and well-drained, light-to-medium soil; avoid waterlogged ground.",
    },
    {
        "name": "Wheat", "season": "Rabi", "months": [10, 11],
        "soils": ["medium_black", "deep_black", "well_drained", "alluvial"],
        "water": ["limited", "assured"],
        "source": "https://www.icar.org.in/sites/default/files/inline-files/Rabi-Agro-Advisory-2021-22.pdf",
        "note": "This starter profile assumes supplemental or assured irrigation; follow district sowing dates and variety advice.",
    },
    {
        "name": "Safflower", "season": "Rabi", "months": [10, 11],
        "soils": ["medium_black", "deep_black", "well_drained"],
        "water": ["rainfed", "limited", "assured"],
        "source": "https://www.icar.org.in/sites/default/files/inline-files/Rabi-Agro-Advisory-2021-22.pdf",
        "note": "ICAR lists safflower among important rabi crops in Maharashtra and Gujarat; local variety guidance matters.",
    },
]

SOIL_LABELS = {
    "light": "Light soil", "medium_black": "Medium black soil",
    "deep_black": "Deep black soil", "well_drained": "Well-drained soil",
    "alluvial": "Alluvial soil", "unknown": "Not sure",
}
WATER_LABELS = {"rainfed": "Rainfed", "limited": "Limited irrigation", "assured": "Assured irrigation"}


def make_recommendations(month, soil, irrigation, rainfall_next_7d, current_month):
    """Rank season-window/profile matches and return the reasons for each score."""
    results = []
    for crop in MAHARASHTRA_CROPS:
        score = 0
        reasons = []
        if month in crop["months"]:
            score += 45
            reasons.append(f"{month_name[month]} is in the listed sowing window.")
        else:
            reasons.append("The selected month is outside this crop's listed sowing window.")

        if soil == "unknown":
            score += 10
            reasons.append("Soil type is unknown, so soil compatibility was not scored strongly.")
        elif soil in crop["soils"]:
            score += 25
            reasons.append(f"The selected {SOIL_LABELS[soil].lower()} is included in this starter profile.")
        else:
            reasons.append("The selected soil is not in this starter profile's preferred soil list.")

        if irrigation in crop["water"]:
            score += 20
            reasons.append(f"{WATER_LABELS[irrigation]} matches the profile's water options.")
        else:
            reasons.append("This profile expects supplemental or assured irrigation.")

        weather_note = "The forecast is contextual only because its dates may not match the selected sowing month."
        if month == current_month and rainfall_next_7d is not None:
            if irrigation == "rainfed" and crop["season"] == "Kharif" and rainfall_next_7d < 10:
                score -= 10
                weather_note = "The next 7-day city forecast is dry; rainfed sowing needs local soil-moisture and IMD/KVK guidance."
                reasons.append("A dry next-week forecast lowers this prototype's weather screen for rainfed kharif sowing.")
            elif rainfall_next_7d >= 100:
                score -= 5
                weather_note = "The next 7-day city forecast is very wet; check field drainage and local advisories."
                reasons.append("High forecast rainfall adds a small field-condition caution.")
            else:
                score += 10
                weather_note = "The next 7-day city rainfall forecast has no simple dry/wet screening flag. Check field conditions before sowing."
                reasons.append("The next-week weather screen has no simple dry/wet flag.")

        score = max(0, min(100, score))
        if month in crop["months"] and score >= 70:
            label = "Good profile match"
        elif month in crop["months"]:
            label = "Possible match — check local advisory"
        else:
            label = "Outside usual sowing window"
        results.append({
            "name": crop["name"], "season": crop["season"], "score": score,
            "sowing_months": [month_name[value] for value in crop["months"]],
            "label": label, "reasons": reasons, "weather_note": weather_note,
            "source": crop["source"], "source_note": crop["note"],
        })
    results.sort(key=lambda item: (month_name[month] in item["sowing_months"], item["score"]), reverse=True)
    return results[:4]
