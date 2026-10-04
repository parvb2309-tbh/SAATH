"""Demo data for the SAATH prototype.

Everything here is ILLUSTRATIVE. Earnings, placement rates and stories are generated so the
prototype has something realistic to show; every record carries a "(demo)" source label and
the UI shows a Demo data badge. Real figures are loaded through the CSV importer
(see app/routers/admin.py: /api/admin/import-outcomes).
"""
import random
import uuid
from datetime import datetime, timedelta, timezone

from . import db

DISTRICTS = [
    # id, name_en, name_hi, state, state_hi, lat, lng
    ("lucknow", "Lucknow", "लखनऊ", "Uttar Pradesh", "उत्तर प्रदेश", 26.8467, 80.9462),
    ("varanasi", "Varanasi", "वाराणसी", "Uttar Pradesh", "उत्तर प्रदेश", 25.3176, 82.9739),
    ("gorakhpur", "Gorakhpur", "गोरखपुर", "Uttar Pradesh", "उत्तर प्रदेश", 26.7606, 83.3732),
    ("patna", "Patna", "पटना", "Bihar", "बिहार", 25.5941, 85.1376),
    ("gaya", "Gaya", "गया", "Bihar", "बिहार", 24.7914, 85.0002),
    ("muzaffarpur", "Muzaffarpur", "मुज़फ़्फ़रपुर", "Bihar", "बिहार", 26.1209, 85.3647),
    ("bhopal", "Bhopal", "भोपाल", "Madhya Pradesh", "मध्य प्रदेश", 23.2599, 77.4126),
    ("indore", "Indore", "इंदौर", "Madhya Pradesh", "मध्य प्रदेश", 22.7196, 75.8577),
    ("rewa", "Rewa", "रीवा", "Madhya Pradesh", "मध्य प्रदेश", 24.5373, 81.3042),
]

TRADES = [
    {
        "id": "electrician", "icon": "⚡", "nsqf_level": 5, "duration_months": 24, "min_schooling": "10",
        "name_en": "Electrician", "name_hi": "इलेक्ट्रीशियन",
        "sector_en": "Power", "sector_hi": "बिजली",
        "roles_en": "Electrician, wireman, maintenance technician",
        "roles_hi": "इलेक्ट्रीशियन, वायरमैन, मेंटेनेंस तकनीशियन",
        "about_en": "Two-year ITI course on house wiring, motors, panels and safety.",
        "about_hi": "दो साल का आईटीआई कोर्स: घर की वायरिंग, मोटर, पैनल और सुरक्षा।",
        "ladder": {
            "pre": {"en": "Needs Class 10. Start with a short Assistant Electrician course, and finish Class 10 through NIOS alongside.",
                    "hi": "इसके लिए 10वीं ज़रूरी है। पहले छोटा 'असिस्टेंट इलेक्ट्रीशियन' कोर्स करें और साथ में NIOS से 10वीं पूरी करें।"},
            "course": {"en": "ITI Electrician, 2 years", "hi": "आईटीआई इलेक्ट्रीशियन, 2 साल"},
            "first_job": {"en": "Electrician or wireman with a contractor, factory or power company",
                          "hi": "ठेकेदार, फ़ैक्ट्री या बिजली कंपनी में इलेक्ट्रीशियन या वायरमैन"},
            "growth": {"en": "Supervisor, or licensed electrical contractor", "hi": "सुपरवाइज़र, या लाइसेंसधारी बिजली ठेकेदार"},
            "next": [
                {"en": "Paid apprenticeship after ITI", "hi": "आईटीआई के बाद वेतन वाली अप्रेंटिसशिप"},
                {"en": "Diploma in Electrical Engineering, direct entry to 2nd year", "hi": "इलेक्ट्रिकल डिप्लोमा में सीधे दूसरे साल में दाख़िला"},
                {"en": "Own repair and installation business", "hi": "अपना रिपेयर और फ़िटिंग का काम"},
            ],
        },
    },
    {
        "id": "solar", "icon": "☀️", "nsqf_level": 4, "duration_months": 3, "min_schooling": "10",
        "name_en": "Solar PV Installer (Suryamitra)", "name_hi": "सोलर पीवी इंस्टॉलर (सूर्यमित्र)",
        "sector_en": "Green jobs", "sector_hi": "हरित रोज़गार",
        "roles_en": "Solar installer, solar pump technician, O&M technician",
        "roles_hi": "सोलर इंस्टॉलर, सोलर पंप तकनीशियन, रख-रखाव तकनीशियन",
        "about_en": "Three-month course on installing and servicing rooftop solar and solar pumps.",
        "about_hi": "तीन महीने का कोर्स: छत पर सोलर पैनल और सोलर पंप लगाना और ठीक करना।",
        "ladder": {
            "pre": {"en": "Needs Class 10. Finish Class 10 through NIOS while working as a helper with a solar team.",
                    "hi": "इसके लिए 10वीं ज़रूरी है। सोलर टीम में हेल्पर का काम करते हुए NIOS से 10वीं पूरी करें।"},
            "course": {"en": "Suryamitra solar course, 3 months", "hi": "सूर्यमित्र सोलर कोर्स, 3 महीने"},
            "first_job": {"en": "Solar installer with an installation company or government scheme vendor",
                          "hi": "सोलर कंपनी या सरकारी योजना के वेंडर के साथ सोलर इंस्टॉलर"},
            "growth": {"en": "Site in-charge, or own solar service business", "hi": "साइट इंचार्ज, या अपना सोलर सर्विस का काम"},
            "next": [
                {"en": "Electrician ITI to widen skills", "hi": "हुनर बढ़ाने के लिए आईटीआई इलेक्ट्रीशियन"},
                {"en": "Diploma in Electrical or Renewable Energy", "hi": "इलेक्ट्रिकल या नवीकरणीय ऊर्जा में डिप्लोमा"},
                {"en": "Solar pump servicing for farmers", "hi": "किसानों के सोलर पंप की सर्विसिंग"},
            ],
        },
    },
    {
        "id": "gda", "icon": "🏥", "nsqf_level": 4, "duration_months": 4, "min_schooling": "10",
        "name_en": "General Duty Assistant", "name_hi": "जनरल ड्यूटी असिस्टेंट",
        "sector_en": "Healthcare", "sector_hi": "स्वास्थ्य",
        "roles_en": "Patient care assistant, ward assistant, home-care attendant",
        "roles_hi": "मरीज़ देखभाल सहायक, वार्ड असिस्टेंट, घर पर देखभाल सहायक",
        "about_en": "Four-month course on patient care, hygiene and first aid, with hospital training.",
        "about_hi": "चार महीने का कोर्स: मरीज़ की देखभाल, साफ़-सफ़ाई और प्राथमिक उपचार, अस्पताल में ट्रेनिंग के साथ।",
        "ladder": {
            "pre": {"en": "Needs Class 10. Finish Class 10 through NIOS; home-care helper work is possible meanwhile.",
                    "hi": "इसके लिए 10वीं ज़रूरी है। NIOS से 10वीं पूरी करें; तब तक घर पर देखभाल का काम कर सकते हैं।"},
            "course": {"en": "General Duty Assistant course, 4 months", "hi": "जनरल ड्यूटी असिस्टेंट कोर्स, 4 महीने"},
            "first_job": {"en": "Ward or patient-care assistant in a hospital or nursing home",
                          "hi": "अस्पताल या नर्सिंग होम में वार्ड या मरीज़ देखभाल सहायक"},
            "growth": {"en": "Senior attendant, or specialised roles like dialysis or OT assistant",
                       "hi": "सीनियर अटेंडेंट, या डायलिसिस/ओटी असिस्टेंट जैसे ख़ास काम"},
            "next": [
                {"en": "ANM or GNM nursing after Class 12", "hi": "12वीं के बाद एएनएम या जीएनएम नर्सिंग"},
                {"en": "Paid hospital apprenticeship", "hi": "अस्पताल में वेतन वाली अप्रेंटिसशिप"},
                {"en": "Home healthcare jobs in bigger cities", "hi": "बड़े शहरों में घर पर स्वास्थ्य सेवा की नौकरी"},
            ],
        },
    },
    {
        "id": "ac_tech", "icon": "❄️", "nsqf_level": 4, "duration_months": 6, "min_schooling": "10",
        "name_en": "AC & Refrigeration Technician", "name_hi": "एसी और फ़्रिज तकनीशियन",
        "sector_en": "Electronics", "sector_hi": "इलेक्ट्रॉनिक्स",
        "roles_en": "AC technician, refrigeration mechanic, service engineer",
        "roles_hi": "एसी तकनीशियन, फ़्रिज मैकेनिक, सर्विस इंजीनियर",
        "about_en": "Six-month course on installing and repairing ACs, fridges and cold rooms.",
        "about_hi": "छह महीने का कोर्स: एसी, फ़्रिज और कोल्ड रूम लगाना और ठीक करना।",
        "ladder": {
            "pre": {"en": "Needs Class 10. Work as a service helper and finish Class 10 through NIOS.",
                    "hi": "इसके लिए 10वीं ज़रूरी है। सर्विस हेल्पर का काम करें और NIOS से 10वीं पूरी करें।"},
            "course": {"en": "AC & Refrigeration course, 6 months", "hi": "एसी और फ़्रिज कोर्स, 6 महीने"},
            "first_job": {"en": "Service technician with a brand service centre or dealer",
                          "hi": "ब्रांड सर्विस सेंटर या डीलर के साथ सर्विस तकनीशियन"},
            "growth": {"en": "Senior technician, or own service shop", "hi": "सीनियर तकनीशियन, या अपनी सर्विस की दुकान"},
            "next": [
                {"en": "ITI Refrigeration & AC (2 years)", "hi": "आईटीआई रेफ्रिजरेशन और एसी (2 साल)"},
                {"en": "Diploma in Mechanical Engineering", "hi": "मैकेनिकल इंजीनियरिंग में डिप्लोमा"},
                {"en": "Cold-chain jobs in food and pharma", "hi": "खाद्य और दवा कंपनियों में कोल्ड-चेन की नौकरी"},
            ],
        },
    },
    {
        "id": "tailoring", "icon": "🧵", "nsqf_level": 4, "duration_months": 3, "min_schooling": "8",
        "name_en": "Sewing Machine Operator", "name_hi": "सिलाई मशीन ऑपरेटर",
        "sector_en": "Apparel", "sector_hi": "परिधान",
        "roles_en": "Machine operator, tailor, stitching-unit owner",
        "roles_hi": "मशीन ऑपरेटर, दर्ज़ी, सिलाई यूनिट की मालिक",
        "about_en": "Three-month course on industrial sewing machines, measurements and finishing.",
        "about_hi": "तीन महीने का कोर्स: औद्योगिक सिलाई मशीन, नाप और फ़िनिशिंग।",
        "ladder": {
            "pre": {"en": "Class 8 is enough to start.", "hi": "शुरू करने के लिए 8वीं काफ़ी है।"},
            "course": {"en": "Sewing Machine Operator course, 3 months", "hi": "सिलाई मशीन ऑपरेटर कोर्स, 3 महीने"},
            "first_job": {"en": "Operator in a garment unit, or tailoring from home",
                          "hi": "गारमेंट यूनिट में ऑपरेटर, या घर से सिलाई"},
            "growth": {"en": "Line supervisor, or own stitching unit", "hi": "लाइन सुपरवाइज़र, या अपनी सिलाई यूनिट"},
            "next": [
                {"en": "Fashion design course", "hi": "फ़ैशन डिज़ाइन कोर्स"},
                {"en": "PM Vishwakarma loan to expand", "hi": "काम बढ़ाने के लिए पीएम विश्वकर्मा लोन"},
                {"en": "Self-help group production unit", "hi": "स्वयं सहायता समूह की उत्पादन यूनिट"},
            ],
        },
    },
    {
        "id": "beauty", "icon": "💇", "nsqf_level": 3, "duration_months": 3, "min_schooling": "8",
        "name_en": "Assistant Beauty Therapist", "name_hi": "सहायक ब्यूटी थेरेपिस्ट",
        "sector_en": "Beauty & wellness", "sector_hi": "ब्यूटी और वेलनेस",
        "roles_en": "Salon assistant, beautician, bridal make-up artist",
        "roles_hi": "सैलून असिस्टेंट, ब्यूटीशियन, दुल्हन मेकअप आर्टिस्ट",
        "about_en": "Three-month course on skin, hair and make-up services with hygiene practice.",
        "about_hi": "तीन महीने का कोर्स: त्वचा, बाल और मेकअप की सेवाएँ, साफ़-सफ़ाई के साथ।",
        "ladder": {
            "pre": {"en": "Class 8 is enough to start.", "hi": "शुरू करने के लिए 8वीं काफ़ी है।"},
            "course": {"en": "Assistant Beauty Therapist course, 3 months", "hi": "सहायक ब्यूटी थेरेपिस्ट कोर्स, 3 महीने"},
            "first_job": {"en": "Salon assistant, or home beauty services", "hi": "सैलून असिस्टेंट, या घर पर ब्यूटी सेवाएँ"},
            "growth": {"en": "Senior beautician or bridal make-up artist", "hi": "सीनियर ब्यूटीशियन या दुल्हन मेकअप आर्टिस्ट"},
            "next": [
                {"en": "Advanced make-up or hair course (higher NSQF level)", "hi": "एडवांस मेकअप या हेयर कोर्स (ऊँचा NSQF स्तर)"},
                {"en": "MUDRA loan for own parlour", "hi": "अपने पार्लर के लिए मुद्रा लोन"},
                {"en": "Salon chains in bigger cities", "hi": "बड़े शहरों में सैलून चेन"},
            ],
        },
    },
]

# Monthly earning bands (low, high) in rupees for year 1, year 3, year 5 before district adjustment.
BASE_BANDS = {
    "electrician": ((11000, 15000), (15000, 21000), (20000, 28000)),
    "solar": ((10000, 14000), (14000, 19000), (18000, 26000)),
    "gda": ((9000, 13000), (12000, 17000), (15000, 22000)),
    "ac_tech": ((11000, 16000), (16000, 22000), (20000, 30000)),
    "tailoring": ((7000, 11000), (10000, 15000), (12000, 20000)),
    "beauty": ((7000, 12000), (10000, 16000), (13000, 22000)),
}
BASE_PLACEMENT = {"electrician": 68, "solar": 62, "gda": 72, "ac_tech": 66, "tailoring": 55, "beauty": 58}
WOMEN_RANGE = {"electrician": (5, 12), "solar": (8, 16), "gda": (55, 70), "ac_tech": (4, 10),
               "tailoring": (70, 90), "beauty": (85, 96)}
DISTRICT_MULT = {"lucknow": 1.08, "varanasi": 0.98, "gorakhpur": 0.92, "patna": 1.0, "gaya": 0.88,
                 "muzaffarpur": 0.9, "bhopal": 1.04, "indore": 1.12, "rewa": 0.9}
PROVIDER = {"electrician": "Govt ITI {d}", "solar": "Suryamitra Centre, {d}", "gda": "Healthcare Skill Centre, {d}",
            "ac_tech": "PMKVY Centre, {d}", "tailoring": "Apparel Skill Centre, {d}", "beauty": "Beauty & Wellness Academy, {d}"}
# Gaps left on purpose so the "state-level fallback" path is visible in the demo.
MISSING = {("beauty", "rewa"), ("solar", "muzaffarpur"), ("gda", "gorakhpur")}
SOURCES = [
    ("verified", "Skill India Digital Hub placement tracker (demo)", 0.65),
    ("self-reported", "Training provider tracer survey (demo)", 0.25),
    ("estimate", "PLFS regional wage band (demo estimate)", 0.10),
]

STORIES = [
    ("electrician", "lucknow", "alumni", "Ravi", "m",
     "Ravi from Lucknow finished ITI Electrician. He now works with a power company contractor and does home wiring jobs on weekends.",
     "लखनऊ के रवि ने आईटीआई इलेक्ट्रीशियन किया। अब वह बिजली कंपनी के ठेकेदार के साथ काम करते हैं और छुट्टी के दिन घरों की वायरिंग भी करते हैं।"),
    ("electrician", "patna", "parent", "Sunita ji", "m",
     "Sunita ji from Patna worried that relatives would call her son a 'mistri'. Today he maintains the lifts and panels of a big hospital, and the family speaks of it with pride.",
     "पटना की सुनीता जी को डर था कि रिश्तेदार बेटे को 'मिस्त्री' कहेंगे। आज वह एक बड़े अस्पताल की लिफ़्ट और पैनल संभालता है, और परिवार गर्व से इसके बारे में बताता है।"),
    ("solar", "gaya", "alumni", "Pooja", "f",
     "Pooja from Gaya trained as a Suryamitra. She installs rooftop solar with an all-women team in her own block and is home every evening.",
     "गया की पूजा ने सूर्यमित्र की ट्रेनिंग ली। वह अपने ही ब्लॉक में महिलाओं की टीम के साथ छतों पर सोलर लगाती हैं और हर शाम घर लौट आती हैं।"),
    ("solar", "rewa", "parent", "Ramesh ji", "m",
     "Ramesh ji from Rewa thought solar was a passing trend. His son now services solar pumps for farmers across the district.",
     "रीवा के रमेश जी सोचते थे कि सोलर कुछ दिनों का शौक है। आज उनका बेटा पूरे ज़िले में किसानों के सोलर पंप ठीक करता है।"),
    ("gda", "varanasi", "alumni", "Neha", "f",
     "Neha from Varanasi trained as a General Duty Assistant. She works day shifts at a private hospital that provides transport for women staff.",
     "वाराणसी की नेहा ने जनरल ड्यूटी असिस्टेंट की ट्रेनिंग ली। वह एक निजी अस्पताल में दिन की शिफ़्ट में काम करती हैं, जहाँ महिला कर्मचारियों के लिए गाड़ी की सुविधा है।"),
    ("gda", "muzaffarpur", "parent", "Shabnam ji", "f",
     "Shabnam ji from Muzaffarpur was afraid of hospital night shifts for her daughter. The centre found a placement with fixed day shifts and a women's hostel nearby.",
     "मुज़फ़्फ़रपुर की शबनम जी को बेटी की रात की शिफ़्ट से डर था। सेंटर ने दिन की तय शिफ़्ट वाली नौकरी दिलाई, और पास में महिला हॉस्टल भी है।"),
    ("ac_tech", "indore", "alumni", "Arjun", "m",
     "Arjun from Indore became an AC technician. In summer he has more work than he can take, and he is saving to open his own service shop.",
     "इंदौर के अर्जुन एसी तकनीशियन बने। गर्मियों में उनके पास इतना काम होता है कि सब ले नहीं पाते, और अब वह अपनी सर्विस की दुकान के लिए बचत कर रहे हैं।"),
    ("ac_tech", "bhopal", "parent", "Mohan ji", "m",
     "Mohan ji from Bhopal wanted his son to do a BA. Now his son earns as a technician and is also studying for his BA through an open university.",
     "भोपाल के मोहन जी चाहते थे कि बेटा बीए करे। अब बेटा तकनीशियन बनकर कमाता भी है और ओपन यूनिवर्सिटी से बीए भी कर रहा है।"),
    ("tailoring", "gorakhpur", "alumni", "Rubina", "f",
     "Rubina from Gorakhpur learnt industrial sewing and now runs a small stitching unit from home with two other women.",
     "गोरखपुर की रुबीना ने औद्योगिक सिलाई सीखी और अब दो और महिलाओं के साथ घर से छोटी सिलाई यूनिट चलाती हैं।"),
    ("tailoring", "lucknow", "parent", "Asha ji", "f",
     "Asha ji from Lucknow did not want her daughter to travel far. Her daughter now works in a garment unit close to home with a fixed day shift.",
     "लखनऊ की आशा जी नहीं चाहती थीं कि बेटी दूर जाए। अब बेटी घर के पास एक गारमेंट यूनिट में दिन की तय शिफ़्ट में काम करती है।"),
    ("beauty", "bhopal", "alumni", "Kavita", "f",
     "Kavita from Bhopal works at a salon in her own city and is now training to become a bridal make-up artist.",
     "भोपाल की कविता अपने ही शहर के एक सैलून में काम करती हैं और अब दुल्हन मेकअप आर्टिस्ट बनने की ट्रेनिंग ले रही हैं।"),
    ("beauty", "gaya", "parent", "Meena ji", "f",
     "Meena ji from Gaya worried about what neighbours would say. Today the same neighbours book her daughter for weddings.",
     "गया की मीना जी को डर था कि पड़ोसी क्या कहेंगे। आज वही पड़ोसी शादियों के लिए उनकी बेटी को बुलाते हैं।"),
]

SCHEMES = [
    ("pmkvy", "PMKVY 4.0", "प्रधानमंत्री कौशल विकास योजना 4.0",
     "Short-term skill training under PMKVY is free for the candidate and ends with a government-recognised certificate.",
     "PMKVY के तहत छोटी अवधि की ट्रेनिंग उम्मीदवार के लिए मुफ़्त है, और अंत में सरकारी मान्यता वाला सर्टिफ़िकेट मिलता है।",
     ["all"], "https://www.pmkvyofficial.org/"),
    ("iti", "Government ITI admission", "सरकारी आईटीआई में दाख़िला",
     "Government ITIs charge low fees, and SC/ST/OBC, minority and girl students can apply for state scholarships.",
     "सरकारी आईटीआई की फ़ीस कम है, और SC/ST/OBC, अल्पसंख्यक और छात्राएँ राज्य की छात्रवृत्ति के लिए आवेदन कर सकती हैं।",
     ["electrician", "ac_tech"], "https://dgt.gov.in/"),
    ("naps", "National Apprenticeship Promotion Scheme", "राष्ट्रीय अप्रेंटिसशिप प्रोत्साहन योजना",
     "After training, apprentices learn on the job and are paid a monthly stipend, part of it supported by the government.",
     "ट्रेनिंग के बाद अप्रेंटिस काम करते हुए सीखते हैं और हर महीने स्टाइपेंड पाते हैं, जिसका कुछ हिस्सा सरकार देती है।",
     ["all"], "https://www.apprenticeshipindia.gov.in/"),
    ("vishwakarma", "PM Vishwakarma", "पीएम विश्वकर्मा",
     "For traditional artisans such as tailors: skill training with a stipend, a toolkit incentive and collateral-free business loans.",
     "दर्ज़ी जैसे पारंपरिक कारीगरों के लिए: स्टाइपेंड के साथ ट्रेनिंग, औज़ारों के लिए मदद और बिना गारंटी का लोन।",
     ["tailoring"], "https://pmvishwakarma.gov.in/"),
    ("mudra", "PM MUDRA Yojana", "पीएम मुद्रा योजना",
     "Loans without collateral to start a small business such as a repair shop, salon or stitching unit.",
     "छोटा काम शुरू करने के लिए बिना गारंटी का लोन, जैसे रिपेयर की दुकान, पार्लर या सिलाई यूनिट।",
     ["electrician", "ac_tech", "tailoring", "beauty", "solar"], "https://www.mudra.org.in/"),
    ("suryamitra", "Suryamitra programme", "सूर्यमित्र कार्यक्रम",
     "A solar technician programme run by the National Institute of Solar Energy, free for selected candidates.",
     "राष्ट्रीय सौर ऊर्जा संस्थान का सोलर तकनीशियन कार्यक्रम, चुने गए उम्मीदवारों के लिए मुफ़्त।",
     ["solar"], "https://nise.res.in/"),
]

# District-level concern mix and baseline resistance for the synthetic sessions.
PROFILES = {
    "lucknow": (45, 0.35, {"income": .3, "social_status": .25, "degree_better": .25, "job_security": .2}),
    "varanasi": (33, 0.45, {"social_status": .35, "degree_better": .25, "income": .2, "safety": .2}),
    "gorakhpur": (28, 0.55, {"distance": .35, "income": .25, "job_security": .2, "social_status": .2}),
    "patna": (42, 0.50, {"degree_better": .4, "social_status": .25, "job_security": .2, "income": .15}),
    "gaya": (30, 0.62, {"safety": .35, "distance": .3, "social_status": .2, "cost": .15}),
    "muzaffarpur": (27, 0.58, {"safety": .3, "social_status": .3, "distance": .2, "income": .2}),
    "bhopal": (34, 0.38, {"income": .3, "job_security": .3, "degree_better": .2, "cost": .2}),
    "indore": (38, 0.28, {"income": .35, "job_security": .3, "distance": .15, "degree_better": .2}),
    "rewa": (23, 0.60, {"social_status": .35, "distance": .25, "cost": .2, "safety": .2}),
}

DEMO_ESCALATIONS = [
    {
        "district": "gaya", "trade": "gda", "gender": "f", "members": ["mother", "learner"], "priority": 2,
        "reason": "Safety concern raised again after an answer",
        "phone": "98xxxxxx21", "callback": "Evening, after 6 pm",
        "turns": [("mother", "beti ko hospital mein raat ki duty karni padegi kya?", ["safety"], -0.5),
                  ("mother", "रात में अकेले आना-जाना ठीक नहीं है, हमें डर लगता है", ["safety", "distance"], -0.7)],
        "summary": "Mother is worried about night shifts and travel for her daughter (GDA course, Gaya). The day-shift option and the women's hostel were explained, but she still feels unsafe. Suggest a call with a female counsellor and a placement partner who offers fixed day shifts.",
    },
    {
        "district": "patna", "trade": "electrician", "gender": "m", "members": ["father", "learner"], "priority": 3,
        "reason": "Same concern unresolved after 3 answers",
        "phone": "97xxxxxx08", "callback": "Sunday morning",
        "turns": [("father", "degree ke bina koi izzat nahi milti", ["degree_better", "social_status"], -0.4),
                  ("father", "BA kar lega toh sarkari exam de sakta hai", ["degree_better"], -0.3),
                  ("father", "phir bhi degree zaroori hai", ["degree_better"], -0.4)],
        "summary": "Father prefers a BA degree so the son can sit government exams. Earnings and the diploma route were shared. He wants to understand whether the son can do the ITI and a degree together. Suggest explaining the open-university route and ITI-to-diploma entry.",
    },
    {
        "district": "rewa", "trade": "tailoring", "gender": "f", "members": ["father", "mother", "learner"], "priority": 3,
        "reason": "Family remains upset across two turns",
        "phone": "", "callback": "",
        "turns": [("father", "log kya kahenge, beti silai karegi?", ["social_status"], -0.6),
                  ("father", "हमारे समाज में यह ठीक नहीं माना जाता", ["social_status"], -0.7)],
        "summary": "Father is worried about the family's standing in the community if the daughter takes up tailoring. A local story was shared. He is still hesitant. Suggest connecting the family with a local woman who runs her own stitching unit.",
    },
    {
        "district": "gorakhpur", "trade": "solar", "gender": "m", "members": ["learner"], "priority": 2,
        "reason": "Family asked to speak to a counsellor",
        "phone": "99xxxxxx54", "callback": "Any time",
        "turns": [("learner", "mujhe counsellor se baat karni hai, papa nahi maan rahe", ["human_request"], -0.4)],
        "summary": "The learner wants to do the Suryamitra course, but his father does not agree. He asked to speak to a person. Suggest a joint call with the father.",
    },
]


def _round500(x: float) -> int:
    return int(round(x / 500.0)) * 500


def _pick(rng: random.Random, weights: dict) -> str:
    r, acc = rng.random(), 0.0
    for k, w in weights.items():
        acc += w
        if r <= acc:
            return k
    return list(weights)[-1]


def seed(force: bool = False) -> None:
    db.init_db()
    if db.count("districts") and not force:
        return
    if force:
        with db.connect() as c:
            for t in ("districts", "trades", "outcomes", "stories", "schemes", "sessions", "messages",
                      "escalations", "updates"):
                c.execute(f"DELETE FROM {t}")

    rng = random.Random(26241)
    db.insert_many("districts", [dict(zip(("id", "name_en", "name_hi", "state", "state_hi", "lat", "lng"), d))
                                 for d in DISTRICTS])
    db.insert_many("trades", TRADES)

    outcomes = []
    for t in TRADES:
        tid = t["id"]
        for d in DISTRICTS:
            did = d[0]
            if (tid, did) in MISSING:
                continue
            m = DISTRICT_MULT[did] * rng.uniform(0.96, 1.04)
            (l1, h1), (l3, h3), (l5, h5) = BASE_BANDS[tid]
            r = rng.random()
            status, source = next((s, src) for s, src, p in _cumulative(SOURCES) if r <= p)
            outcomes.append({
                "trade_id": tid, "district_id": did, "provider": PROVIDER[tid].format(d=d[1]),
                "earn_low": _round500(l1 * m), "earn_high": _round500(h1 * m),
                "earn3_low": _round500(l3 * m), "earn3_high": _round500(h3 * m),
                "earn5_low": _round500(l5 * m), "earn5_high": _round500(h5 * m),
                "placement_pct": max(35, min(88, BASE_PLACEMENT[tid] + rng.randint(-10, 8) + int((m - 1) * 40))),
                "local_pct": rng.randint(45, 85), "women_pct": rng.randint(*WOMEN_RANGE[tid]),
                "cohort": rng.randint(25, 120), "source": source, "year": rng.choice([2024, 2025]), "status": status,
            })
    db.insert_many("outcomes", outcomes)

    db.insert_many("stories", [dict(zip(("trade_id", "district_id", "kind", "name", "gender", "text_en", "text_hi"), s))
                               for s in STORIES])
    db.insert_many("schemes", [dict(zip(("id", "name_en", "name_hi", "text_en", "text_hi", "trades", "link"), s))
                               for s in SCHEMES])
    _seed_sessions(rng)
    _seed_escalations()


def _cumulative(sources):
    acc = 0.0
    for s, src, p in sources:
        acc += p
        yield s, src, acc


def _seed_sessions(rng: random.Random) -> None:
    today = datetime.now(timezone.utc)
    trades = [t["id"] for t in TRADES]
    sessions, messages = [], []
    for did, (n, resist, mix) in PROFILES.items():
        for _ in range(n):
            sid = "demo-" + uuid.UUID(int=rng.getrandbits(128)).hex[:12]
            # more recent weeks have more sessions
            age = int(56 * (rng.random() ** 1.6))
            created = today - timedelta(days=age, hours=rng.randint(0, 23))
            first = max(-1.0, min(0.3, rng.gauss(-0.35, 0.2)))
            shift = rng.gauss(0.55 * (1 - resist) + 0.05, 0.25)
            if rng.random() < resist * 0.6:
                shift = rng.gauss(-0.05, 0.15)
            last = max(-1.0, min(1.0, first + shift))
            if last > 0.2:
                status = "interested"
                if rng.random() < 0.55:
                    status = "enrolled" if rng.random() > 0.8 or age < 21 else "retained"
            elif last > -0.1:
                status = "thinking"
            else:
                status = "not_interested"
            gender = "f" if rng.random() < 0.4 else "m"
            sessions.append({
                "id": sid, "created_at": created.isoformat(timespec="seconds"), "district_id": did,
                "trade_id": rng.choice(trades), "income_bracket": rng.choice(["lt10", "10_25", "25_50"]),
                "schooling": rng.choice(["8", "10", "10", "12", "12"]), "language": "hi",
                "members": ["learner", rng.choice(["mother", "father"])], "learner_gender": gender,
                "consent": 1, "status": status, "first_sentiment": round(first, 2),
                "last_sentiment": round(last, 2), "synthetic": 1, "phone": "",
            })
            for k in range(rng.randint(2, 5)):
                c = _pick(rng, mix)
                messages.append({
                    "session_id": sid, "created_at": (created + timedelta(minutes=2 * k)).isoformat(timespec="seconds"),
                    "role": "user", "speaker": rng.choice(["mother", "father", "learner"]), "text": "",
                    "lang": "hi", "concerns": [c], "sentiment": round(first + (last - first) * k / 4, 2),
                    "engine": "synthetic", "cards": [],
                })
    db.insert_many("sessions", sessions)
    db.insert_many("messages", messages)


def _seed_escalations() -> None:
    today = datetime.now(timezone.utc)
    for i, e in enumerate(DEMO_ESCALATIONS):
        sid = f"demo-esc-{i + 1}"
        created = (today - timedelta(hours=3 + 5 * i)).isoformat(timespec="seconds")
        sents = [t[3] for t in e["turns"]]
        db.insert("sessions", {
            "id": sid, "created_at": created, "district_id": e["district"], "trade_id": e["trade"],
            "income_bracket": "lt10", "schooling": "10", "language": "hi", "members": e["members"],
            "learner_gender": e["gender"], "consent": 1, "status": "thinking", "first_sentiment": sents[0],
            "last_sentiment": sents[-1], "synthetic": 1, "phone": e["phone"],
        })
        for speaker, text, concerns, s in e["turns"]:
            db.insert("messages", {"session_id": sid, "created_at": created, "role": "user", "speaker": speaker,
                                   "text": text, "lang": "hi", "concerns": concerns, "sentiment": s,
                                   "engine": "synthetic", "cards": []})
        db.insert("escalations", {"session_id": sid, "created_at": created, "reason": e["reason"],
                                  "priority": e["priority"], "summary": e["summary"], "status": "open",
                                  "phone": e["phone"], "callback_time": e["callback"], "notes": "",
                                  "engine": "demo"})


if __name__ == "__main__":
    seed(force=True)
    print("seeded", db.DB_PATH)
