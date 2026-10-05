import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const translations = {
  en: {
    language: "Language", overview: "Overview", submissions: "Submissions", reports: "AI Reports", profile: "Profile",
    logout: "Log out", patientPortal: "Patient Portal", securePortal: "Secure portal",
    symptoms: "Symptoms", skinImage: "Skin image", chestXray: "Chest X-ray", submitSymptoms: "Analyse symptoms",
    uploadSkin: "Analyse skin image", uploadXray: "Analyse chest X-ray", useMicrophone: "Use microphone to speak symptoms",
    listening: "Listening... speak your symptoms",
    nearbyHospitals: "Live Nearby Hospitals", nearbyDescription: "Uses OpenStreetMap to search hospitals, starting within 3 km of your GPS location.",
    nearbyDoctors: "Nearby doctors and clinics", nearbyDoctorsDescription: "Mapped doctor offices and clinics within 3 km of your GPS location.",
    findDoctors: "Find nearby doctors and clinics", noDoctorWithin: "No mapped doctor office or clinic was found within",
    mappedType: "Mapped type", doctorMapCaveat: "Listings do not verify a clinician's identity, licence, availability, or appointment.",
    findHospitals: "Find hospitals near me", searching: "Searching hospitals...", noHospitals: "No mapped hospital was found within 3 km of your location.",
    directions: "Directions", kmAway: "km away", emergency: "Emergency services", notListed: "Not listed",
    recommendedAction: "Recommended action", aiResult: "Your AI screening result", confidence: "Model confidence score",
    shapTitle: "Tree SHAP feature contribution analysis", gradcamTitle: "Grad-CAM visual heatmap attention",
    blendOverlay: "Blend overlay", sideBySide: "Side-by-side", originalImage: "Original image", gradcam: "Grad-CAM activation",
    login: "Login", register: "Register", email: "Email", password: "Password", fullName: "Full name",
    patient: "Patient", doctor: "Doctor", createAccount: "Create account", refresh: "Refresh",
    redFlagTitle: "Before AI analysis: do you have any of these emergency warning signs?",
    redFlagBreathing: "Severe difficulty breathing", redFlagChest: "New severe chest pain",
    redFlagStroke: "Sudden weakness, facial droop, or trouble speaking", redFlagBleeding: "Uncontrolled bleeding",
    redFlagAction: "Seek emergency medical care now. Do not wait for this AI result or an online reply. This checklist is not exhaustive.",
    scoreDisclaimer: "This is a model score, not a verified probability of disease.",
    expandHospitalSearch: "Search up to 5 km instead",
    searchRadius: "Search radius", noHospitalWithin: "No mapped hospital was found within", noHospitalCaveat: "This does not mean there is no medical care nearby.",
    hospitalMapType: "Type: hospital (OpenStreetMap)", hospitalMapLimitations: "Map listings may be incomplete; distance is straight-line, not travel distance. Confirm emergency services before travelling.",
  },
  hi: {
    language: "भाषा", overview: "अवलोकन", submissions: "सबमिशन", reports: "एआई रिपोर्ट", profile: "प्रोफ़ाइल",
    logout: "लॉग आउट", patientPortal: "रोगी पोर्टल", securePortal: "सुरक्षित पोर्टल",
    symptoms: "लक्षण", skinImage: "त्वचा की छवि", chestXray: "छाती का एक्स-रे", submitSymptoms: "लक्षणों का विश्लेषण करें",
    uploadSkin: "त्वचा छवि का विश्लेषण करें", uploadXray: "छाती एक्स-रे का विश्लेषण करें", useMicrophone: "लक्षण बोलने के लिए माइक्रोफ़ोन का उपयोग करें",
    listening: "सुन रहा है... अपने लक्षण बोलें",
    nearbyHospitals: "पास के अस्पताल", nearbyDescription: "OpenStreetMap से अस्पताल खोजता है; आपके GPS स्थान से 3 किमी की दूरी पर खोज शुरू होती है।",
    nearbyDoctors: "पास के डॉक्टर और क्लिनिक", nearbyDoctorsDescription: "GPS से 3 किमी के भीतर मानचित्रित डॉक्टर कार्यालय और क्लिनिक।",
    findDoctors: "पास के डॉक्टर और क्लिनिक खोजें", noDoctorWithin: "इतनी दूरी में कोई मानचित्रित डॉक्टर कार्यालय या क्लिनिक नहीं मिला:",
    mappedType: "मानचित्र प्रकार", doctorMapCaveat: "सूची डॉक्टर की पहचान, लाइसेंस, उपलब्धता या अपॉइंटमेंट की पुष्टि नहीं करती।",
    findHospitals: "मेरे पास के अस्पताल खोजें", searching: "अस्पताल खोजे जा रहे हैं...", noHospitals: "आपके स्थान के 3 किमी के भीतर कोई मानचित्रित अस्पताल नहीं मिला।",
    directions: "दिशा-निर्देश", kmAway: "किमी दूर", emergency: "आपातकालीन सेवाएँ", notListed: "सूचीबद्ध नहीं",
    recommendedAction: "सुझाया गया कार्य", aiResult: "आपका एआई स्क्रीनिंग परिणाम", confidence: "मॉडल विश्वास स्कोर",
    shapTitle: "ट्री SHAP फीचर योगदान विश्लेषण", gradcamTitle: "Grad-CAM दृश्य हीटमैप ध्यान",
    blendOverlay: "ओवरले मिलाएँ", sideBySide: "साथ-साथ", originalImage: "मूल छवि", gradcam: "Grad-CAM सक्रियण",
    login: "लॉगिन", register: "पंजीकरण", email: "ईमेल", password: "पासवर्ड", fullName: "पूरा नाम",
    patient: "रोगी", doctor: "डॉक्टर", createAccount: "खाता बनाएं", refresh: "रीफ़्रेश",
    redFlagTitle: "AI विश्लेषण से पहले: क्या इनमें से कोई आपातकालीन संकेत है?",
    redFlagBreathing: "सांस लेने में गंभीर कठिनाई", redFlagChest: "सीने में नया गंभीर दर्द",
    redFlagStroke: "अचानक कमजोरी, चेहरा टेढ़ा होना या बोलने में कठिनाई", redFlagBleeding: "रक्तस्राव बंद न होना",
    redFlagAction: "अभी आपातकालीन चिकित्सा सहायता लें। AI परिणाम या ऑनलाइन उत्तर की प्रतीक्षा न करें। यह सूची पूरी नहीं है।",
    scoreDisclaimer: "यह मॉडल स्कोर है, बीमारी की प्रमाणित संभावना नहीं।",
    expandHospitalSearch: "इसके बजाय 5 किमी तक खोजें",
    searchRadius: "खोज की सीमा", noHospitalWithin: "इतने क्षेत्र में मानचित्रित अस्पताल नहीं मिला:", noHospitalCaveat: "इसका अर्थ यह नहीं कि आसपास चिकित्सा सेवा उपलब्ध नहीं है।",
    hospitalMapType: "प्रकार: अस्पताल (OpenStreetMap)", hospitalMapLimitations: "मानचित्र सूची अधूरी हो सकती है; दूरी सीधी रेखा में है, सड़क की दूरी नहीं। जाने से पहले आपातकालीन सेवाओं की पुष्टि करें।",
  },
  mr: {
    language: "भाषा", overview: "आढावा", submissions: "सबमिशन", reports: "एआय अहवाल", profile: "प्रोफाइल",
    logout: "लॉग आउट", patientPortal: "रुग्ण पोर्टल", securePortal: "सुरक्षित पोर्टल",
    symptoms: "लक्षणे", skinImage: "त्वचेची प्रतिमा", chestXray: "छातीचा एक्स-रे", submitSymptoms: "लक्षणांचे विश्लेषण करा",
    uploadSkin: "त्वचेच्या प्रतिमेचे विश्लेषण करा", uploadXray: "छातीच्या एक्स-रेचे विश्लेषण करा", useMicrophone: "लक्षणे सांगण्यासाठी मायक्रोफोन वापरा",
    listening: "ऐकत आहे... तुमची लक्षणे सांगा",
    nearbyHospitals: "जवळची रुग्णालये", nearbyDescription: "OpenStreetMap वापरून रुग्णालये शोधते; तुमच्या GPS स्थानापासून 3 किमीवर शोध सुरू होतो.",
    nearbyDoctors: "जवळचे डॉक्टर आणि दवाखाने", nearbyDoctorsDescription: "GPS पासून 3 किमीतील नकाशावर नोंदलेले डॉक्टर कार्यालय आणि दवाखाने.",
    findDoctors: "जवळचे डॉक्टर आणि दवाखाने शोधा", noDoctorWithin: "या अंतरात नकाशावर डॉक्टर कार्यालय किंवा दवाखाना सापडला नाही:",
    mappedType: "नकाशातील प्रकार", doctorMapCaveat: "यादी डॉक्टरांची ओळख, परवाना, उपलब्धता किंवा अपॉइंटमेंट निश्चित करत नाही.",
    findHospitals: "माझ्या जवळची रुग्णालये शोधा", searching: "रुग्णालये शोधत आहे...", noHospitals: "तुमच्या स्थानाच्या 3 किमीमध्ये नकाशावर नोंदलेले रुग्णालय सापडले नाही।",
    directions: "दिशानिर्देश", kmAway: "किमी दूर", emergency: "आपत्कालीन सेवा", notListed: "नोंदलेले नाही",
    recommendedAction: "शिफारस केलेली कृती", aiResult: "तुमचा एआय स्क्रीनिंग निकाल", confidence: "मॉडेल विश्वास स्कोअर",
    shapTitle: "ट्री SHAP वैशिष्ट्य योगदान विश्लेषण", gradcamTitle: "Grad-CAM दृश्य हीटमॅप लक्ष",
    blendOverlay: "ओव्हरले मिसळा", sideBySide: "शेजारी शेजारी", originalImage: "मूळ प्रतिमा", gradcam: "Grad-CAM सक्रियता",
    login: "लॉगिन", register: "नोंदणी", email: "ईमेल", password: "पासवर्ड", fullName: "पूर्ण नाव",
    patient: "रुग्ण", doctor: "डॉक्टर", createAccount: "खाते तयार करा", refresh: "रिफ्रेश",
    redFlagTitle: "AI विश्लेषणापूर्वी: यापैकी काही आपत्कालीन लक्षण आहे का?",
    redFlagBreathing: "श्वास घेण्यास तीव्र त्रास", redFlagChest: "छातीत नवीन तीव्र वेदना",
    redFlagStroke: "अचानक अशक्तपणा, चेहरा वाकडा होणे किंवा बोलण्यात अडचण", redFlagBleeding: "रक्तस्राव थांबत नाही",
    redFlagAction: "आत्ताच आपत्कालीन वैद्यकीय मदत घ्या. AI निकालाची किंवा ऑनलाइन उत्तराची वाट पाहू नका. ही यादी पूर्ण नाही.",
    scoreDisclaimer: "हा मॉडेलचा स्कोअर आहे; आजाराची प्रमाणित शक्यता नाही.",
    expandHospitalSearch: "त्याऐवजी 5 किमीपर्यंत शोधा",
    searchRadius: "शोध त्रिज्या", noHospitalWithin: "या अंतरात नकाशावर रुग्णालय सापडले नाही:", noHospitalCaveat: "याचा अर्थ जवळ वैद्यकीय सेवा नाही असा नाही.",
    hospitalMapType: "प्रकार: रुग्णालय (OpenStreetMap)", hospitalMapLimitations: "नकाशावरील नोंदी अपूर्ण असू शकतात; अंतर सरळ रेषेत आहे, रस्त्याचे नाही. जाण्यापूर्वी आपत्कालीन सेवांची खात्री करा.",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("mediassist-language") || "en");
  useEffect(() => {
    localStorage.setItem("mediassist-language", language);
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key) => translations[language][key] || translations.en[key] || key }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  return (
    <label className={`language-selector ${location.pathname === "/" ? "landing-language-selector" : ""}`}>
      <span>{t("language")}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t("language")}>
        <option value="en">English</option>
        <option value="hi">हिंदी</option>
        <option value="mr">मराठी</option>
      </select>
    </label>
  );
}
