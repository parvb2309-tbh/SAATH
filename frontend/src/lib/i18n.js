import { createContext, useContext } from 'react'

export const STRINGS = {
  appTagline: { en: 'Family-first career counselling', hi: 'पूरे परिवार के साथ करियर सलाह' },
  navFamily: { en: 'Family', hi: 'परिवार' },
  navCounsellor: { en: 'Counsellor', hi: 'काउंसलर' },
  navAdmin: { en: 'Admin', hi: 'एडमिन' },
  demoData: { en: 'Demo data', hi: 'डेमो डेटा' },

  consentTitle: { en: 'Before we begin', hi: 'शुरू करने से पहले' },
  consentPoints: {
    en: [
      'We will ask a few simple questions about your family.',
      'We save only what helps us guide you: district, schooling and an income range, never your exact income.',
      'Your answers help the government see where families need more support. Your name is never shown.',
      'You can ask to talk to a real counsellor at any time.',
    ],
    hi: [
      'हम आपके परिवार के बारे में कुछ आसान सवाल पूछेंगे।',
      'हम सिर्फ़ वही रखते हैं जो सलाह के लिए ज़रूरी है: ज़िला, पढ़ाई और आमदनी का दायरा, आपकी असली आमदनी नहीं।',
      'आपके जवाब से सरकार जान पाती है कि किन परिवारों को ज़्यादा मदद चाहिए। आपका नाम कभी नहीं दिखाया जाता।',
      'आप कभी भी असली काउंसलर से बात करने को कह सकते हैं।',
    ],
  },
  consentAgree: { en: 'Yes, I agree. Let us start', hi: 'हाँ, मैं सहमत हूँ, शुरू करें' },
  readAloud: { en: 'Read aloud', hi: 'सुनें' },

  whoIsHere: { en: 'Who is here today?', hi: 'आज कौन-कौन साथ है?' },
  learner: { en: 'Learner', hi: 'विद्यार्थी' },
  mother: { en: 'Mother', hi: 'माँ' },
  father: { en: 'Father', hi: 'पिता' },
  guardian: { en: 'Guardian', hi: 'अभिभावक' },
  learnerIs: { en: 'The learner is a', hi: 'विद्यार्थी है' },
  son: { en: 'Son', hi: 'बेटा' },
  daughter: { en: 'Daughter', hi: 'बेटी' },
  preferNot: { en: 'Prefer not to say', hi: 'नहीं बताना' },
  district: { en: 'Your district', hi: 'आपका ज़िला' },
  schooling: { en: "Learner's schooling", hi: 'विद्यार्थी की पढ़ाई' },
  income: { en: 'Family income (range only)', hi: 'परिवार की आमदनी (सिर्फ़ दायरा)' },
  trade: { en: 'Which work interests you?', hi: 'कौन-सा काम पसंद है?' },
  notSure: { en: 'Not sure? Take a 5-question check', hi: 'पक्का नहीं? 5 सवालों से जानें' },
  start: { en: 'Start the conversation', hi: 'बातचीत शुरू करें' },
  chooseDistrict: { en: 'Choose district', hi: 'ज़िला चुनें' },

  speaking: { en: 'Who is speaking?', hi: 'कौन बोल रहा है?' },
  typeHere: { en: 'Type or press the mic and speak…', hi: 'लिखें या माइक दबाकर बोलें…' },
  send: { en: 'Send', hi: 'भेजें' },
  listening: { en: 'Listening… tap to stop', hi: 'सुन रहे हैं… रोकने के लिए दबाएँ' },
  commonWorries: { en: 'Common worries, tap to ask', hi: 'आम चिंताएँ, पूछने के लिए दबाएँ' },
  talkToCounsellor: { en: 'Talk to a counsellor', hi: 'काउंसलर से बात करें' },
  decisionTitle: { en: 'How does the family feel now?', hi: 'अब परिवार क्या सोचता है?' },
  interested: { en: 'We want to go ahead', hi: 'हम आगे बढ़ना चाहते हैं' },
  thinking: { en: 'We need more time', hi: 'थोड़ा और सोचना है' },
  notInterested: { en: 'Not for us', hi: 'हमारे लिए नहीं' },
  autoSpeak: { en: 'Speak replies', hi: 'जवाब बोलकर सुनाएँ' },
  ladderTitle: { en: 'Seedhi: the career ladder', hi: 'सीढ़ी: करियर का रास्ता' },
  familyCard: { en: 'Your family', hi: 'आपका परिवार' },
  updatesTitle: { en: 'Updates from the training centre', hi: 'ट्रेनिंग सेंटर से जानकारी' },
  newSession: { en: 'New family', hi: 'नया परिवार' },
  changeTrade: { en: 'Change', hi: 'बदलें' },
  escalatedTitle: { en: 'A counsellor will call you', hi: 'काउंसलर आपको फ़ोन करेंगे' },
  phone: { en: 'Phone number', hi: 'फ़ोन नंबर' },
  callbackTime: { en: 'Good time to call', hi: 'फ़ोन करने का सही समय' },
  note: { en: 'Anything you want to tell them (optional)', hi: 'कुछ कहना हो तो लिखें (ज़रूरी नहीं)' },
  requestCall: { en: 'Request a call', hi: 'कॉल का अनुरोध करें' },
  callRequested: { en: 'Thank you. We will call you soon.', hi: 'धन्यवाद। हम जल्द फ़ोन करेंगे।' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  source: { en: 'Source', hi: 'स्रोत' },
  stateLevel: { en: 'State-level figure', hi: 'राज्य स्तर का आँकड़ा' },
  storyLabel: { en: 'A family like yours', hi: 'आप जैसे परिवार की कहानी' },
  alumniLabel: { en: 'From a past trainee', hi: 'पुराने विद्यार्थी की कहानी' },
  schemeLabel: { en: 'Government help', hi: 'सरकारी मदद' },
  helplineLabel: { en: 'Free helpline', hi: 'मुफ़्त हेल्पलाइन' },
  quizTitle: { en: 'What does the learner enjoy?', hi: 'विद्यार्थी को क्या पसंद है?' },
  yes: { en: 'Yes', hi: 'हाँ' },
  no: { en: 'No', hi: 'नहीं' },
  quizResult: { en: 'These may suit the learner', hi: 'ये काम अच्छे लग सकते हैं' },
  thinkingDots: { en: 'SAATH is thinking…', hi: 'साथ सोच रहा है…' },
  hookStories: {
    en: [
      ['Pooja from Gaya', ' installs rooftop solar with an all-women team, and is home every evening.'],
      ['Arjun from Indore', ' fixes so many ACs each summer that he is saving for his own shop.'],
      ["A father in Patna", " feared people would call his son a 'mistri'. Today his son runs a big hospital's lifts."],
    ],
    hi: [
      ['गया की पूजा', ' महिलाओं की टीम के साथ छतों पर सोलर लगाती हैं, और हर शाम घर लौट आती हैं।'],
      ['इंदौर के अर्जुन', ' हर गर्मी इतने एसी ठीक करते हैं कि अब अपनी दुकान के लिए बचत कर रहे हैं।'],
      ['पटना के एक पिता', ' को डर था कि लोग बेटे को "मिस्त्री" कहेंगे। आज बेटा एक बड़े अस्पताल की लिफ़्ट संभालता है।'],
    ],
  },
  hookQuestion: { en: "Where could your child's skill take them?", hi: 'आपके बच्चे का हुनर उसे कहाँ तक ले जा सकता है?' },
  hookSub: { en: 'Find out together, as a family', hi: 'पूरा परिवार मिलकर जानिए' },
  hookCta: { en: "Let's find out", hi: 'चलिए जानते हैं' },
  hookNote: { en: 'Stories are illustrative examples', hi: 'कहानियाँ उदाहरण के लिए हैं' },
  howTitle: { en: 'How SAATH works', hi: 'साथ कैसे काम करता है' },
  howRows: {
    en: [
      ['🧩', 'Answer 9 quick questions', 'The learner and the parents both answer: no right or wrong.'],
      ['🪜', 'See the career ladder', 'With earnings and job figures from your own district.'],
      ['🗣️', 'Ask any worry, any time', 'By voice or text. A real counsellor is one tap away.'],
    ],
    hi: [
      ['🧩', '9 आसान सवालों के जवाब दें', 'बच्चा और माता-पिता दोनों जवाब देते हैं, कोई जवाब ग़लत नहीं।'],
      ['🪜', 'करियर की सीढ़ी देखें', 'आपके अपने ज़िले की कमाई और नौकरी के आँकड़ों के साथ।'],
      ['🗣️', 'कोई भी चिंता, कभी भी पूछें', 'बोलकर या लिखकर। असली काउंसलर बस एक बटन दूर।'],
    ],
  },
  privacyTitle: { en: 'What we keep, and what we never keep', hi: 'हम क्या रखते हैं, और क्या कभी नहीं' },
  agreeContinue: { en: 'I agree, continue', hi: 'सहमत हूँ, आगे बढ़ें' },
  profileTitle: { en: 'Tell us about your family', hi: 'अपने परिवार के बारे में बताइए' },
  profileSub: { en: 'So that every answer fits your family', hi: 'ताकि हर जवाब आपके परिवार के हिसाब से हो' },
  learnerAge: { en: "Learner's age", hi: 'बच्चे की उम्र' },
  years: { en: 'years', hi: 'साल' },
  continue: { en: 'Continue', hi: 'आगे बढ़ें' },
  pickDistrictFirst: { en: 'Choose your district to continue', hi: 'आगे बढ़ने के लिए ज़िला चुनें' },
  journeyBegins: { en: 'Your journey begins now.', hi: 'आपका सफ़र अब शुरू होता है।' },
  welcome: { en: 'Welcome', hi: 'स्वागत है' },
  back: { en: 'Back', hi: 'पीछे' },
  readQuestions: { en: 'Read questions aloud', hi: 'सवाल पढ़कर सुनाएँ' },
  skipQuiz: { en: 'Skip the questions and talk directly', hi: 'सवाल छोड़कर सीधे बात करें' },
  familyPicture: { en: "Your family's picture", hi: 'आपके परिवार की तस्वीर' },
  matchingWork: { en: 'Work that matches', hi: 'मेल खाते काम' },
  answerToSee: { en: 'Answer to see matches appear', hi: 'जवाब दीजिए, मेल खाते काम यहाँ दिखेंगे' },
  worriesHeard: { en: 'Worries we heard', hi: 'आपकी चिंताएँ' },
  resultTitle: { en: "Your family's picture is ready", hi: 'आपके परिवार की तस्वीर तैयार है' },
  resultSub: { en: 'Pick the work you want to explore first. You can change it any time.', hi: 'पहले किस काम के बारे में जानना है, चुनिए। बाद में कभी भी बदल सकते हैं।' },
  bestMatch: { en: 'Best match', hi: 'सबसे अच्छा मेल' },
  months: { en: 'months', hi: 'महीने' },
  match: { en: 'match', hi: 'मेल' },
  seeAllWork: { en: 'See all courses', hi: 'सभी कोर्स देखें' },
  weWillTalk: { en: 'We will talk about these worries first', hi: 'पहले इन चिंताओं पर बात करेंगे' },
  familyFeels: { en: 'The family feels', hi: 'परिवार की राय' },
  keenVery: { en: 'very keen', hi: 'बहुत उत्साहित' },
  keenOpen: { en: 'open to it', hi: 'सोचने को तैयार' },
  keenDoubt: { en: 'doubtful', hi: 'शक है' },
  keenAgainst: { en: 'against it for now', hi: 'अभी इसके ख़िलाफ़' },
  startTalking: { en: 'Start the conversation', hi: 'बातचीत शुरू करें' },
  family: { en: 'Family', hi: 'परिवार' },
  quizAnswers: { en: 'Answers from the opening questions', hi: 'शुरुआती सवालों के जवाब' },
}

export const STATUS = {
  verified: { en: 'Verified', hi: 'सत्यापित' },
  'self-reported': { en: 'Centre-reported', hi: 'सेंटर द्वारा बताया' },
  estimate: { en: 'Estimate', hi: 'अनुमान' },
}

export const LangContext = createContext({ lang: 'hi', setLang: () => {} })

export function useT() {
  const { lang } = useContext(LangContext)
  return (key) => STRINGS[key]?.[lang] ?? key
}

export function useLang() {
  return useContext(LangContext)
}

export function pick(obj, lang, base = 'name') {
  if (!obj) return ''
  return obj[`${base}_${lang}`] ?? obj[`${base}_en`] ?? ''
}
