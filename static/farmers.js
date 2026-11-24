const $ = (id) => document.getElementById(id);
const translations = {
  en: {
    language:"Language", back:"Back to India dashboard", farmer_tools:"FARMER TOOLS", hero_line1:"Plan your next", hero_line2:"growing season.",
    hero_description:"Compare a starter set of crop fits for your location, sowing month, soil, and water access. We’ll add the next week’s local forecast as context.",
    tag_calendar:"🌱 Crop calendar", tag_weather:"☁ 7-day weather", tag_pilot:"📍 Maharashtra pilot", art_label:"Grow with local context", field_profile:"YOUR FIELD PROFILE", tell_farm:"Tell us about your farm",
    field_intro:"Use a nearby city for weather context. Field conditions can vary from city forecasts.", nearby_city:"Nearest monitored city", location:"LOCATION", sowing_month:"When are you planning to sow?", season:"SEASON",
    soil:"Soil type", soil_tag:"SOIL", soil_unknown:"I’m not sure", soil_deep:"Deep black", soil_medium:"Medium black", soil_light:"Light soil", soil_well_drained:"Well-drained", soil_alluvial:"Alluvial",
    water_access:"Water access", irrigation:"IRRIGATION", rainfed:"Rainfed", limited_irrigation:"Limited irrigation", assured_irrigation:"Assured irrigation", compare:"Compare crop fits", privacy_note:"No account needed. Your farm profile is only used to create this comparison.",
    comparison_step:"02 · YOUR COMPARISON", overview:"Crop fit overview", starter_screen:"STARTER SCREEN", shortlist:"Your shortlist will appear here", shortlist_intro:"Fill in the four farm details to compare crop calendars and weather context.", step_location:"01 · Location", step_month:"02 · Sowing month", step_soil:"03 · Soil & water",
    simple_guide:"A SIMPLE GUIDE", read_fits:"How to read your crop fits", guide_intro:"These are transparent screening scores to help you explore options.", sowing_window:"Sowing window", guide_month:"Higher fit when your selected month matches the listed crop calendar.", soil_water:"Soil & water", guide_soil:"We compare your selections with each crop’s broad starter profile.", weather_context:"Weather context", guide_weather:"Rain and temperature summarize the next seven days near your selected city.",
    advisory_title:"Use this as a starting point, not a sowing instruction.", advisory_copy:"The crop list and scores are not validated for yield or profit, and the forecast only adjusts a score when it overlaps the selected sowing month. Check your district’s local advisory and field conditions.", official_advisory:"Official IMD Agromet advisories", footer_title:"WeatherAtlas · Farmer tools pilot", forecast_by:"Forecast weather by", local_guidance:"Local guidance from IMD / KVK",
    loading_locations:"Loading locations…", locations_unavailable:"Locations unavailable", location_error:"Could not load nearby locations.", refresh_retry:"Refresh the page to retry.", comparing:"Comparing your options…", compare_button:"Compare crop fits", loading_results:"Checking crop calendars and local forecast", loading_detail:"This can take a few seconds while we fetch the latest weather.",
    top_match:"Top screening match", option:"Option", why_fit:"Why this fit?", city:"City", forecast_point:"Forecast point", temp_7day:"Next 7-day temperature", daily_min_max:"Daily min to max", rainfall_forecast:"Rainfall forecast", seven_day_total:"7-day total",
    score_good:"Good profile match", score_possible:"Possible match — check local advisory", score_outside:"Outside usual sowing window", season_kharif:"Kharif", season_rabi:"Rabi",
    reason_month_outside:"The selected month is outside this crop's listed sowing window.", reason_soil_unknown:"Soil type is unknown, so soil compatibility was not scored strongly.", reason_soil_mismatch:"The selected soil is not in this starter profile's preferred soil list.", reason_water_mismatch:"This profile expects supplemental or assured irrigation.",
    weather_contextual:"The forecast is contextual only because its dates may not match the selected sowing month.", weather_dry:"The next 7-day city forecast is dry; rainfed sowing needs local soil-moisture and IMD/KVK guidance.", weather_wet:"The next 7-day city forecast is very wet; check field drainage and local advisories.", weather_neutral:"The next 7-day city rainfall forecast has no simple dry/wet screening flag. Check field conditions before sowing.",
    error_try:"Check your connection and try again.", api_error:"Crop comparison is unavailable.",
  },
  hi: {
    language:"भाषा", back:"भारत डैशबोर्ड पर वापस जाएँ", farmer_tools:"किसान टूल्स", hero_line1:"आने वाले", hero_line2:"खेती के मौसम की योजना बनाएँ।",
    hero_description:"अपने स्थान, बुवाई के महीने, मिट्टी और पानी की उपलब्धता के आधार पर शुरुआती फसल विकल्पों की तुलना करें। अगले सप्ताह का स्थानीय मौसम भी संदर्भ के रूप में दिखेगा।",
    tag_calendar:"🌱 फसल कैलेंडर", tag_weather:"☁ 7-दिन का मौसम", tag_pilot:"📍 महाराष्ट्र पायलट", art_label:"स्थानीय मौसम के साथ उगाएँ", field_profile:"आपके खेत की जानकारी", tell_farm:"अपने खेत के बारे में बताएँ",
    field_intro:"मौसम के संदर्भ के लिए पास का शहर चुनें। खेत की स्थिति शहर के पूर्वानुमान से अलग हो सकती है।", nearby_city:"नज़दीकी निगरानी वाला शहर", location:"स्थान", sowing_month:"आप बुवाई कब करना चाहते हैं?", season:"मौसम",
    soil:"मिट्टी का प्रकार", soil_tag:"मिट्टी", soil_unknown:"पता नहीं", soil_deep:"गहरी काली", soil_medium:"मध्यम काली", soil_light:"हल्की मिट्टी", soil_well_drained:"अच्छी जल-निकासी वाली", soil_alluvial:"जलोढ़", water_access:"पानी की उपलब्धता", irrigation:"सिंचाई", rainfed:"वर्षा आधारित", limited_irrigation:"सीमित सिंचाई", assured_irrigation:"निश्चित सिंचाई", compare:"फसल विकल्पों की तुलना करें", privacy_note:"खाता बनाने की ज़रूरत नहीं। खेत की जानकारी केवल इस तुलना के लिए उपयोग होती है।",
    comparison_step:"02 · आपकी तुलना", overview:"फसल उपयुक्तता का सार", starter_screen:"प्रारंभिक आकलन", shortlist:"आपके विकल्प यहाँ दिखेंगे", shortlist_intro:"फसल कैलेंडर और मौसम की तुलना के लिए खेत की चारों जानकारियाँ भरें।", step_location:"01 · स्थान", step_month:"02 · बुवाई का महीना", step_soil:"03 · मिट्टी और पानी",
    simple_guide:"सरल मार्गदर्शिका", read_fits:"फसल उपयुक्तता कैसे पढ़ें", guide_intro:"ये विकल्प समझने में मदद करने वाले स्पष्ट प्रारंभिक स्कोर हैं।", sowing_window:"बुवाई का समय", guide_month:"चुने हुए महीने और बताए गए फसल कैलेंडर के मेल पर उपयुक्तता बढ़ती है।", soil_water:"मिट्टी और पानी", guide_soil:"आपकी जानकारी की तुलना हर फसल की शुरुआती आवश्यकताओं से होती है।", weather_context:"मौसम का संदर्भ", guide_weather:"चुने हुए शहर के पास अगले सात दिनों की बारिश और तापमान का सार।",
    advisory_title:"इसे शुरुआती जानकारी मानें, बुवाई का निर्देश नहीं।", advisory_copy:"फसल सूची और स्कोर उपज या मुनाफ़े के लिए प्रमाणित नहीं हैं। पूर्वानुमान स्कोर को तभी बदलता है जब उसकी तारीखें चुने हुए बुवाई महीने से मेल खाती हैं। अपने ज़िले की सलाह और खेत की स्थिति जाँचें।", official_advisory:"IMD कृषि-मौसम सलाह देखें", footer_title:"WeatherAtlas · किसान टूल्स पायलट", forecast_by:"मौसम पूर्वानुमान:", local_guidance:"स्थानीय सलाह: IMD / KVK",
    loading_locations:"शहरों की सूची लोड हो रही है…", locations_unavailable:"शहर उपलब्ध नहीं", location_error:"नज़दीकी शहरों की सूची नहीं मिली।", refresh_retry:"फिर से कोशिश करने के लिए पेज रीफ़्रेश करें।", comparing:"फसल विकल्पों की तुलना हो रही है…", compare_button:"फसल विकल्पों की तुलना करें", loading_results:"फसल कैलेंडर और स्थानीय मौसम देखा जा रहा है", loading_detail:"नवीनतम मौसम लाने में कुछ सेकंड लग सकते हैं।",
    top_match:"सबसे अच्छा शुरुआती मेल", option:"विकल्प", why_fit:"यह मेल क्यों?", city:"शहर", forecast_point:"पूर्वानुमान स्थान", temp_7day:"अगले 7 दिनों का तापमान", daily_min_max:"दैनिक न्यूनतम से अधिकतम", rainfall_forecast:"बारिश का पूर्वानुमान", seven_day_total:"7 दिनों का कुल",
    score_good:"अच्छा शुरुआती मेल", score_possible:"संभावित मेल — स्थानीय सलाह देखें", score_outside:"सामान्य बुवाई समय से बाहर", season_kharif:"खरीफ़", season_rabi:"रबी",
    reason_month_outside:"चुना हुआ महीना इस फसल के बताए गए बुवाई समय में नहीं है।", reason_soil_unknown:"मिट्टी की जानकारी नहीं है, इसलिए मिट्टी का मेल सीमित रूप से आँका गया है।", reason_soil_mismatch:"चुनी मिट्टी इस शुरुआती प्रोफ़ाइल की पसंदीदा मिट्टी में नहीं है।", reason_water_mismatch:"इस फसल प्रोफ़ाइल में अतिरिक्त या निश्चित सिंचाई की अपेक्षा है।",
    weather_contextual:"पूर्वानुमान केवल संदर्भ है, क्योंकि उसकी तारीखें चुने हुए बुवाई महीने से मेल न खा सकती हैं।", weather_dry:"अगले 7 दिनों का शहर पूर्वानुमान सूखा है; वर्षा आधारित बुवाई से पहले मिट्टी की नमी और IMD/KVK सलाह देखें।", weather_wet:"अगले 7 दिनों में बहुत बारिश का पूर्वानुमान है; खेत की जल-निकासी और स्थानीय सलाह देखें।", weather_neutral:"अगले 7 दिनों की बारिश में स्पष्ट सूखा/गीला संकेत नहीं है। बुवाई से पहले खेत की स्थिति देखें।", error_try:"इंटरनेट जाँचें और फिर कोशिश करें।", api_error:"फसल तुलना उपलब्ध नहीं है।",
  },
  ta: {
    language:"மொழி", back:"இந்தியா வானிலைப் பலகைக்குத் திரும்பு", farmer_tools:"விவசாயி கருவிகள்", hero_line1:"அடுத்த", hero_line2:"பருவத்திற்குத் திட்டமிடுங்கள்.",
    hero_description:"இடம், விதைப்பு மாதம், மண் மற்றும் நீர் வசதியின் அடிப்படையில் தொடக்கப் பயிர் பொருத்தங்களை ஒப்பிடுங்கள். அடுத்த வார உள்ளூர் வானிலையும் சூழலாகக் காட்டப்படும்.",
    tag_calendar:"🌱 பயிர் நாட்காட்டி", tag_weather:"☁ 7 நாள் வானிலை", tag_pilot:"📍 மகாராஷ்டிரா முன்னோட்டம்", art_label:"உள்ளூர் வானிலையுடன் வளருங்கள்", field_profile:"உங்கள் வயல் விவரம்", tell_farm:"உங்கள் வயலைப் பற்றி கூறுங்கள்",
    field_intro:"வானிலைச் சூழலுக்காக அருகிலுள்ள நகரத்தைத் தேர்ந்தெடுக்கவும். வயல் நிலை நகர முன்னறிவிப்பிலிருந்து மாறுபடலாம்.", nearby_city:"அருகிலுள்ள கண்காணிப்பு நகரம்", location:"இடம்", sowing_month:"எப்போது விதைக்கத் திட்டமிடுகிறீர்கள்?", season:"பருவம்",
    soil:"மண் வகை", soil_tag:"மண்", soil_unknown:"தெரியவில்லை", soil_deep:"ஆழமான கரிசல் மண்", soil_medium:"நடுத்தர கரிசல் மண்", soil_light:"மணற்பாங்கான மண்", soil_well_drained:"நீர் வடிகால் நன்றான மண்", soil_alluvial:"வண்டல் மண்", water_access:"நீர் வசதி", irrigation:"பாசனம்", rainfed:"மானாவாரி", limited_irrigation:"குறைந்த பாசனம்", assured_irrigation:"உறுதியான பாசனம்", compare:"பயிர் பொருத்தங்களை ஒப்பிடு", privacy_note:"கணக்கு தேவையில்லை. இந்த ஒப்பீட்டிற்காக மட்டுமே உங்கள் வயல் விவரம் பயன்படுத்தப்படும்.",
    comparison_step:"02 · உங்கள் ஒப்பீடு", overview:"பயிர் பொருத்தச் சுருக்கம்", starter_screen:"தொடக்க மதிப்பீடு", shortlist:"உங்கள் தேர்வுப் பட்டியல் இங்கே வரும்", shortlist_intro:"பயிர் காலண்டர் மற்றும் வானிலையை ஒப்பிட நான்கு வயல் விவரங்களையும் நிரப்பவும்.", step_location:"01 · இடம்", step_month:"02 · விதைப்பு மாதம்", step_soil:"03 · மண் மற்றும் நீர்",
    simple_guide:"எளிய வழிகாட்டி", read_fits:"பயிர் பொருத்தத்தைப் புரிந்துகொள்வது", guide_intro:"விருப்பங்களை ஆராய உதவும் வெளிப்படையான தொடக்க மதிப்பெண்கள் இவை.", sowing_window:"விதைப்பு காலம்", guide_month:"தேர்ந்தெடுத்த மாதம் பயிர் காலண்டருடன் பொருந்தினால் பொருத்தம் அதிகரிக்கும்.", soil_water:"மண் மற்றும் நீர்", guide_soil:"உங்கள் தேர்வுகளை ஒவ்வொரு பயிரின் பொதுவான தொடக்கத் தேவைகளுடன் ஒப்பிடுகிறோம்.", weather_context:"வானிலைச் சூழல்", guide_weather:"தேர்ந்தெடுத்த நகருக்கு அருகிலான அடுத்த ஏழு நாள் மழை மற்றும் வெப்பநிலைச் சுருக்கம்.",
    advisory_title:"இதைத் தொடக்கத் தகவலாகப் பாருங்கள்; விதைப்பு அறிவுறுத்தலாக அல்ல.", advisory_copy:"பயிர் பட்டியலும் மதிப்பெண்களும் மகசூல் அல்லது லாபத்திற்காகச் சரிபார்க்கப்படவில்லை. தேர்ந்தெடுத்த விதைப்பு மாதத்துடன் முன்னறிவிப்பு தேதிகள் பொருந்தினால் மட்டுமே மதிப்பெண் மாறும். மாவட்ட ஆலோசனையையும் வயல் நிலைமையையும் சரிபார்க்கவும்.", official_advisory:"IMD வேளாண் வானிலை ஆலோசனைகள்", footer_title:"WeatherAtlas · விவசாயி கருவிகள் முன்னோட்டம்", forecast_by:"வானிலை முன்னறிவிப்பு:", local_guidance:"உள்ளூர் ஆலோசனை: IMD / KVK",
    loading_locations:"நகரங்கள் ஏற்றப்படுகின்றன…", locations_unavailable:"நகரங்கள் கிடைக்கவில்லை", location_error:"அருகிலுள்ள நகரங்களை ஏற்ற முடியவில்லை.", refresh_retry:"மீண்டும் முயற்சிக்கப் பக்கத்தைப் புதுப்பிக்கவும்.", comparing:"பயிர் பொருத்தங்கள் ஒப்பிடப்படுகின்றன…", compare_button:"பயிர் பொருத்தங்களை ஒப்பிடு", loading_results:"பயிர் காலண்டரும் உள்ளூர் வானிலையும் பார்க்கப்படுகின்றன", loading_detail:"சமீபத்திய வானிலையைப் பெற சில விநாடிகள் ஆகலாம்.",
    top_match:"சிறந்த தொடக்கப் பொருத்தம்", option:"விருப்பம்", why_fit:"இந்தப் பொருத்தம் ஏன்?", city:"நகரம்", forecast_point:"முன்னறிவிப்பு இடம்", temp_7day:"அடுத்த 7 நாள் வெப்பநிலை", daily_min_max:"தினசரி குறைந்தது முதல் அதிகபட்சம்", rainfall_forecast:"மழை முன்னறிவிப்பு", seven_day_total:"7 நாள் மொத்தம்",
    score_good:"நல்ல தொடக்கப் பொருத்தம்", score_possible:"சாத்தியமான பொருத்தம் — உள்ளூர் ஆலோசனை பார்க்கவும்", score_outside:"வழக்கமான விதைப்பு காலத்திற்கு வெளியே", season_kharif:"காரிப் பருவம்", season_rabi:"ரபி பருவம்",
    reason_month_outside:"தேர்ந்தெடுத்த மாதம் இந்தப் பயிரின் குறிப்பிடப்பட்ட விதைப்பு காலத்தில் இல்லை.", reason_soil_unknown:"மண் வகை தெரியாததால் மண் பொருத்தம் வலுவாக மதிப்பிடப்படவில்லை.", reason_soil_mismatch:"தேர்ந்தெடுத்த மண் இந்தத் தொடக்கப் பயிர் விவரத்தின் விருப்பப்பட்டியலில் இல்லை.", reason_water_mismatch:"இந்தப் பயிர் விவரத்திற்கு கூடுதல் அல்லது உறுதியான பாசனம் தேவைப்படுகிறது.",
    weather_contextual:"முன்னறிவிப்பு தேதிகள் தேர்ந்தெடுத்த விதைப்பு மாதத்துடன் பொருந்தாமல் இருக்கலாம்; இது சூழலுக்காக மட்டும்.", weather_dry:"அடுத்த 7 நாள் நகர முன்னறிவிப்பு வறண்டதாக உள்ளது; மானாவாரி விதைப்புக்கு முன் மண் ஈரப்பதம் மற்றும் IMD/KVK ஆலோசனையைச் சரிபார்க்கவும்.", weather_wet:"அடுத்த 7 நாட்களில் அதிக மழை எதிர்பார்க்கப்படுகிறது; வயல் வடிகால் மற்றும் உள்ளூர் ஆலோசனையைப் பார்க்கவும்.", weather_neutral:"அடுத்த 7 நாள் மழைக்கு தெளிவான வறட்சி/ஈர நிலைச் சுட்டி இல்லை. விதைப்புக்கு முன் வயல் நிலையைச் சரிபார்க்கவும்.", error_try:"இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.", api_error:"பயிர் ஒப்பீடு தற்போது கிடைக்கவில்லை.",
  },
};

let language = localStorage.getItem("weatheratlas-language") || "en";
const languageLocale = { en:"en-IN", hi:"hi-IN", ta:"ta-IN" };
const englishMonths = Array.from({ length:12 }, (_, index) => new Intl.DateTimeFormat("en", {month:"long", timeZone:"UTC"}).format(new Date(Date.UTC(2020,index,15,12))));
let monthNames = [];
let latestAdvice = null;

function t(key) { return translations[language]?.[key] || translations.en[key] || key; }

function localMonthNames() {
  return Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(languageLocale[language], {
    month: "long", timeZone: "Asia/Kolkata",
  }).format(new Date(Date.UTC(2020, index, 15, 12))));
}

function applyLanguage(nextLanguage) {
  language = translations[nextLanguage] ? nextLanguage : "en";
  document.documentElement.lang = language;
  document.title = language === "hi" ? "किसान टूल्स — WeatherAtlas" : language === "ta" ? "விவசாயி கருவிகள் — WeatherAtlas" : "Farmer tools — WeatherAtlas";
  localStorage.setItem("weatheratlas-language", language);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[language][key]) element.textContent = t(key);
  });
  monthNames = localMonthNames();
  const selectedMonth = $("crop-month").value || new Intl.DateTimeFormat("en-IN", { month:"numeric", timeZone:"Asia/Kolkata" }).format(new Date());
  const monthSelect = $("crop-month");
  monthSelect.replaceChildren(...monthNames.map((name, index) => new Option(name, String(index + 1))));
  monthSelect.value = selectedMonth;
  const languageSelect = $("farmer-language");
  if (languageSelect) languageSelect.value = language;
  updateGeneratedLanguage();
}

function translateMonth(name) {
  const index = englishMonths.findIndex((month) => month.toLowerCase() === String(name).toLowerCase());
  return index < 0 ? name : monthNames[index];
}

function translateCropName(name) {
  const names = {
    hi: {"Kharif sorghum (jowar)":"खरीफ़ ज्वार", "Cotton":"कपास", "Rabi sorghum (jowar)":"रबी ज्वार", "Chickpea (gram)":"चना", "Wheat":"गेहूँ", "Safflower":"कुसुम"},
    ta: {"Kharif sorghum (jowar)":"காரிப் பருவச் சோளம் (ஜோவர்)", "Cotton":"பருத்தி", "Rabi sorghum (jowar)":"ரபி பருவச் சோளம்", "Chickpea (gram)":"கொண்டைக்கடலை", "Wheat":"கோதுமை", "Safflower":"குசும்பா"},
  };
  return names[language]?.[name] || name;
}

function translateScoreLabel(label) {
  if (label === "Good profile match") return t("score_good");
  if (label === "Possible match — check local advisory") return t("score_possible");
  return t("score_outside");
}

function translateWeatherNote(note) {
  if (note.startsWith("The forecast is contextual only")) return t("weather_contextual");
  if (note.startsWith("The next 7-day city forecast is dry")) return t("weather_dry");
  if (note.startsWith("The next 7-day city forecast is very wet")) return t("weather_wet");
  if (note.startsWith("The next 7-day city rainfall forecast")) return t("weather_neutral");
  return note;
}

function translateReason(reason) {
  if (language === "en") return reason;
  if (reason.endsWith("is in the listed sowing window.")) {
    const englishMonth = reason.split(" is in the listed")[0];
    const month = translateMonth(englishMonth);
    return language === "hi" ? `${month} इस फसल के बताए गए बुवाई समय में है।` : `${month} இந்தப் பயிரின் குறிப்பிடப்பட்ட விதைப்பு காலத்தில் உள்ளது.`;
  }
  const exact = {
    "The selected month is outside this crop's listed sowing window.":"reason_month_outside",
    "Soil type is unknown, so soil compatibility was not scored strongly.":"reason_soil_unknown",
    "The selected soil is not in this starter profile's preferred soil list.":"reason_soil_mismatch",
    "This profile expects supplemental or assured irrigation.":"reason_water_mismatch",
    "A dry next-week forecast lowers this prototype's weather screen for rainfed kharif sowing.":"weather_dry",
    "High forecast rainfall adds a small field-condition caution.":"weather_wet",
  };
  if (exact[reason]) return t(exact[reason]);
  if (reason.includes("is included in this starter profile")) {
    return language === "hi" ? "चुनी हुई मिट्टी इस शुरुआती फसल प्रोफ़ाइल से मेल खाती है।" : "தேர்ந்தெடுத்த மண் இந்தத் தொடக்கப் பயிர் விவரத்துடன் பொருந்துகிறது.";
  }
  if (reason.includes("matches the profile's water options")) {
    return language === "hi" ? "चुनी हुई पानी की उपलब्धता इस फसल प्रोफ़ाइल से मेल खाती है।" : "தேர்ந்தெடுத்த நீர் வசதி இந்தப் பயிர் விவரத்துடன் பொருந்துகிறது.";
  }
  if (reason.includes("next-week weather screen has no simple dry/wet flag")) {
    return language === "hi" ? "अगले सप्ताह मौसम में स्पष्ट सूखा या बहुत बारिश का संकेत नहीं है।" : "அடுத்த வார வானிலையில் தெளிவான வறட்சி அல்லது அதிக மழைச் சுட்டி இல்லை.";
  }
  return reason;
}

function translateSourceNote(cropName, sourceNote) {
  if (language === "en") return sourceNote;
  const crop = cropName.toLowerCase();
  if (crop.includes("cotton")) return language === "hi" ? "ICAR महाराष्ट्र सलाह में कपास के लिए मई–जून बुवाई और काली/मध्यम मिट्टी बताई गई है।" : "ICAR மகாராஷ்டிரா ஆலோசனையில் பருத்திக்கு மே–ஜூன் விதைப்பும் கரிசல்/நடுத்தர மண்ணும் குறிப்பிடப்பட்டுள்ளன.";
  if (crop.includes("chickpea")) return language === "hi" ? "ICAR अक्टूबर–नवंबर बुवाई और जलभराव से बचाव की सलाह देता है।" : "ICAR அக்டோபர்–நவம்பர் விதைப்பையும் நீர் தேங்குவதைத் தவிர்க்கவும் அறிவுறுத்துகிறது.";
  if (crop.includes("wheat")) return language === "hi" ? "यह शुरुआती प्रोफ़ाइल पूरक या निश्चित सिंचाई मानती है; ज़िले की सलाह देखें।" : "இந்தத் தொடக்க விவரம் துணை அல்லது உறுதியான பாசனத்தை கருதுகிறது; மாவட்ட ஆலோசனையைப் பார்க்கவும்.";
  if (crop.includes("safflower")) return language === "hi" ? "ICAR कुसुम को महाराष्ट्र और गुजरात की प्रमुख रबी फसलों में गिनता है।" : "ICAR குசும்பாவை மகாராஷ்டிரா மற்றும் குஜராத்தின் முக்கிய ரபி பயிர்களில் ஒன்றாகக் குறிப்பிடுகிறது.";
  return language === "hi" ? "महाराष्ट्र के जिला फसल कैलेंडर से शुरुआती बुवाई समय लिया गया है।" : "மகாராஷ்டிரா மாவட்ட பயிர் நாட்காட்டியிலிருந்து தொடக்க விதைப்பு காலம் பெறப்பட்டது.";
}

function updateGeneratedLanguage() {
  if (latestAdvice) renderAdvice(latestAdvice);
}

function initializeMonths() {
  applyLanguage(language);
}

async function loadCropCities() {
  const select = $("crop-city");
  try {
    const response = await fetch("/api/crop-cities");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("location_error"));
    select.replaceChildren();
    data.cities.forEach((city) => {
      const option = document.createElement("option");
      option.value = city.name;
      const stateName = language === "hi" ? "महाराष्ट्र" : language === "ta" ? "மகாராஷ்டிரா" : city.state;
      option.textContent = `${city.name} · ${stateName}`;
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === "Pune")) select.value = "Pune";
  } catch (error) {
    select.replaceChildren(new Option(t("locations_unavailable"), ""));
    showError(`${t("location_error")} ${t("refresh_retry")}`);
  }
}

function showError(message) {
  const status = $("crop-status");
  status.hidden = false;
  status.className = "error-message";
  status.textContent = message;
}

function createCropCard(crop, index) {
  const card = document.createElement("article");
  card.className = `crop-result${index === 0 ? " top-match" : ""}`;

  const heading = document.createElement("div");
  heading.className = "crop-result-heading";
  const cropName = document.createElement("div");
  const rank = document.createElement("span");
  rank.className = "crop-rank";
  rank.textContent = index === 0 ? t("top_match") : `${t("option")} ${index + 1}`;
  const name = document.createElement("strong");
  name.textContent = translateCropName(crop.name);
  cropName.append(rank, name);

  const score = document.createElement("span");
  score.className = "crop-score";
  score.textContent = `${crop.score} / 100`;
  const scoreLabel = document.createElement("small");
  scoreLabel.textContent = translateScoreLabel(crop.label);
  score.appendChild(scoreLabel);
  heading.append(cropName, score);

  const track = document.createElement("div");
  track.className = "score-track";
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", language === "en" ? `Screening score ${crop.score} out of 100` : `${t("starter_screen")}: ${crop.score} / 100`);
  const fill = document.createElement("span");
  fill.style.width = `${Math.max(0, Math.min(100, Number(crop.score)))}%`;
  track.appendChild(fill);

  const season = document.createElement("p");
  season.className = "crop-season";
  const seasonName = crop.season === "Kharif" ? t("season_kharif") : t("season_rabi");
  const months = crop.sowing_months.map(translateMonth).join(", ");
  const seasonPrefix = language === "hi" ? "सामान्य बुवाई समय" : language === "ta" ? "வழக்கமான விதைப்பு காலம்" : "usual sowing window";
  season.textContent = `${seasonName} · ${seasonPrefix}: ${months}`;
  const weatherNote = document.createElement("p");
  weatherNote.className = "crop-weather-note";
  weatherNote.textContent = translateWeatherNote(crop.weather_note);

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = t("why_fit");
  const reasons = document.createElement("ul");
  crop.reasons.forEach((reason) => {
    const item = document.createElement("li");
    item.textContent = translateReason(reason);
    reasons.appendChild(item);
  });
  const source = document.createElement("a");
  source.href = crop.source;
  source.target = "_blank";
  source.rel = "noreferrer";
  source.textContent = `${translateSourceNote(crop.name, crop.source_note)} ↗`;
  details.append(summary, reasons, source);
  card.append(heading, track, season, weatherNote, details);
  return card;
}

function renderAdvice(data) {
  latestAdvice = data;
  const status = $("crop-status");
  status.hidden = true;
  status.className = "empty-state";

  const forecast = data.forecast;
  const strip = $("forecast-strip");
  strip.hidden = false;
  strip.replaceChildren();
  const stats = [
    [t("city"), data.location.city, t("forecast_point")],
    [t("temp_7day"), `${forecast.minimum_temperature_c ?? "—"}°–${forecast.maximum_temperature_c ?? "—"}°C`, t("daily_min_max")],
    [t("rainfall_forecast"), `${forecast.rainfall_total_mm} mm`, t("seven_day_total")],
  ];
  stats.forEach(([label, value, note]) => {
    const item = document.createElement("div"); item.className = "weather-stat";
    const title = document.createElement("span"); title.textContent = label;
    const result = document.createElement("strong"); result.textContent = value;
    const hint = document.createElement("small"); hint.textContent = note;
    item.append(title, result, hint); strip.appendChild(item);
  });

  const results = $("crop-results");
  results.replaceChildren(...data.recommendations.map(createCropCard));
}

async function compareCropFits(event) {
  event.preventDefault();
  const button = $("compare-button");
  const status = $("crop-status");
  const results = $("crop-results");
  const strip = $("forecast-strip");
  button.disabled = true;
  button.querySelector("span:first-child").textContent = t("comparing");
  status.hidden = false;
  status.className = "empty-state";
  status.replaceChildren();
  const spinner = document.createElement("span"); spinner.className = "spinner"; spinner.setAttribute("aria-hidden", "true");
  const loadingTitle = document.createElement("strong"); loadingTitle.textContent = t("loading_results");
  const loadingDetail = document.createElement("p"); loadingDetail.textContent = t("loading_detail");
  status.append(spinner, loadingTitle, loadingDetail);
  results.replaceChildren();
  strip.hidden = true;
  try {
    const query = new URLSearchParams({
      city: $("crop-city").value,
      month: $("crop-month").value,
      soil: $("crop-soil").value,
      irrigation: $("crop-water").value,
    });
    const response = await fetch(`/api/crop-advice?${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("api_error"));
    renderAdvice(data);
  } catch (error) {
    showError(`${language === "en" ? error.message : t("api_error")} ${t("error_try")}`);
  } finally {
    button.disabled = false;
    button.querySelector("span:first-child").textContent = t("compare_button");
  }
}

initializeMonths();
loadCropCities();
$("crop-form").addEventListener("submit", compareCropFits);
$("farmer-language").addEventListener("change", (event) => {
  applyLanguage(event.target.value);
  loadCropCities();
});
