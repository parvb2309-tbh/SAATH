"""The concern taxonomy shared by the classifier, templates, LLM prompt, dashboard and UI."""

OBJECTIONS = ["income", "job_security", "social_status", "safety", "distance", "degree_better", "cost"]
OTHER = ["course_info", "human_request", "distress", "greeting", "other"]
ALL = OBJECTIONS + OTHER

LABELS = {
    "income": {"en": "Earnings", "hi": "कमाई", "icon": "💰", "ask_en": "How much will they earn?", "ask_hi": "कितना कमाएगा/कमाएगी?"},
    "job_security": {"en": "Job security", "hi": "पक्की नौकरी", "icon": "🧰", "ask_en": "Will there be a steady job?", "ask_hi": "नौकरी पक्की मिलेगी?"},
    "social_status": {"en": "Respect in society", "hi": "समाज में इज़्ज़त", "icon": "🏘️", "ask_en": "What will people say?", "ask_hi": "लोग क्या कहेंगे?"},
    "safety": {"en": "Safety", "hi": "सुरक्षा", "icon": "🛡️", "ask_en": "Is it safe, especially for girls?", "ask_hi": "क्या यह सुरक्षित है, ख़ासकर बेटी के लिए?"},
    "distance": {"en": "Far from home", "hi": "घर से दूरी", "icon": "🏠", "ask_en": "Will they have to move far away?", "ask_hi": "क्या घर से दूर जाना पड़ेगा?"},
    "degree_better": {"en": "Degree vs skill", "hi": "डिग्री या हुनर", "icon": "🎓", "ask_en": "Isn't a degree better?", "ask_hi": "डिग्री ज़्यादा अच्छी नहीं है?"},
    "cost": {"en": "Fees & cost", "hi": "फ़ीस और ख़र्च", "icon": "🪙", "ask_en": "How much will it cost?", "ask_hi": "कितना ख़र्च होगा?"},
    "course_info": {"en": "About the course", "hi": "कोर्स के बारे में", "icon": "📘", "ask_en": "What will they learn?", "ask_hi": "कोर्स में क्या सीखेंगे?"},
    "human_request": {"en": "Wants a counsellor", "hi": "काउंसलर से बात", "icon": "🙋", "ask_en": "I want to talk to a person", "ask_hi": "मुझे किसी से बात करनी है"},
    "distress": {"en": "Distress", "hi": "परेशानी", "icon": "🤝"},
    "greeting": {"en": "Greeting", "hi": "नमस्ते", "icon": "👋"},
    "other": {"en": "Other", "hi": "अन्य", "icon": "💬"},
}
