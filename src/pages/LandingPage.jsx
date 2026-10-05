import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";
import "../landing-page.css";

const copy = {
  en: {
    nav: ["Features", "How it works", "About", "Safety"],
    login: "Log in", register: "Create account", explore: "Explore the workflow",
    eyebrow: "PATIENT-FIRST CLINICAL DECISION SUPPORT",
    titleA: "A clearer next step", titleB: "starts with your story.",
    intro: "Describe symptoms or upload an image. MediAssist AI offers an explainable screening result. If you visit a doctor, they can request access with your Patient ID and you approve it in your portal.",
    heroNote: "An academic decision-support prototype — not a diagnosis or an emergency service.",
    previewLabel: "THE SCREENING JOURNEY", previewTitle: "From your input to a safer next step",
    previewItems: [
      ["01", "You share", "Symptoms, a skin image, or a chest X-ray."],
      ["02", "AI screens", "A model result with a score, explanation, and guidance."],
      ["03", "Next step", "Find nearby care; approve a doctor's access request after your visit."],
    ],
    previewFoot: "Illustrative workflow · No real patient data shown",
    badgeAi: "AI + human care", badgePatient: "Patient-first",
    pillars: [
      ["Patient-led", "The patient submits information and sees the AI screening result first."],
      ["Explainable", "Feature contributions and image heatmaps help show what influenced a model."],
      ["Human-centered", "Professional assessment remains essential for diagnosis and treatment."],
    ],
    featuresEyebrow: "WHAT THE PLATFORM OFFERS", featuresTitle: "Support across the care journey.",
    featuresIntro: "Screening tools for patients and patient-approved follow-up with a doctor account.",
    features: [
      ["Symptom screening", "Structured symptom matching with XGBoost, ranked suggestions, and visible recognized terms.", "01"],
      ["Image analysis", "Skin-image and chest X-ray screening with visual explanation overlays.", "02"],
      ["Nearby care", "GPS-based OpenStreetMap search for hospitals or doctor/clinic locations, starting within 3 km.", "03"],
      ["Doctor follow-up", "At an in-person visit, a doctor uses your Patient ID to request access. You approve it before records are shared.", "04"],
    ],
    howEyebrow: "SIMPLE BY DESIGN", howTitle: "How MediAssist works",
    steps: [
      ["Share your concern", "Enter symptoms or upload a supported image from the patient portal."],
      ["Review the AI screening", "See the result, model score, recognized inputs, and any available explanation."],
      ["Take the appropriate next step", "Follow safety guidance; uncertain, moderate, and urgent results show nearby care search."],
      ["Stay connected", "After you approve a doctor's request, they can review your case and send checkup or follow-up notes."],
    ],
    aboutEyebrow: "ABOUT THE PROJECT", aboutTitle: "Technology that supports a conversation, not replaces one.",
    aboutText: "MediAssist AI is an academic healthcare decision-support project. It combines symptom and image screening with nearby-care search and a patient-approved doctor follow-up path.",
    aboutSmall: "The models are trained on separate datasets. Their outputs are not a combined diagnosis, and model scores are not verified disease probabilities.",
    aboutCards: [
      ["For patients", "See your AI result, find nearby care, and approve or revoke a doctor's access request."],
      ["For doctors", "After patient approval, review the case and write your own checkup, follow-up, or report note. AI does not prescribe."],
    ],
    safetyEyebrow: "IMPORTANT SAFETY INFORMATION", safetyTitle: "Your health deserves more than a prediction.",
    safetyText: "This system provides screening support only. It cannot confirm a disease, rule out an emergency, or replace a qualified healthcare professional. Its current decision thresholds and models are not clinically validated for real-world diagnosis.",
    emergency: "If you have severe breathing difficulty, new severe chest pain, stroke-like symptoms, uncontrolled bleeding, or feel acutely unwell, seek emergency medical care now. Do not wait for an AI result or online reply.",
    faqEyebrow: "GOOD TO KNOW", faqTitle: "Common questions",
    faqs: [
      ["Is this a diagnosis?", "No. It is a screening and decision-support prototype. A clinician must assess symptoms, history, examination, and tests."],
      ["When can a doctor see my case?", "Only after they request access using your Patient ID and you approve that specific request. Your ID alone does not grant access."],
      ["What if my symptoms are not recognized?", "The system cannot reliably screen unsupported terms. It should not be used to dismiss concerning symptoms; seek professional advice."],
      ["How is my information handled?", "The portal uses Supabase authentication and database access policies. This academic prototype still needs a full privacy and security review before use with real patient information."],
    ],
    ctaEyebrow: "READY TO BEGIN?", ctaTitle: "Start with understanding. Continue with care.",
    ctaText: "Create a patient account to explore the screening workflow, or sign in to continue an existing case.",
    footerNote: "Academic decision-support prototype. Not for emergency use or confirmed diagnosis.",
  },
  hi: {
    nav: ["सुविधाएँ", "यह कैसे काम करता है", "परिचय", "सुरक्षा"], login: "लॉग इन", register: "खाता बनाएँ", explore: "प्रक्रिया देखें",
    eyebrow: "रोगी-प्रथम नैदानिक निर्णय सहायता", titleA: "अगला कदम समझना", titleB: "आपकी बात से शुरू होता है।",
    intro: "लक्षण बताएँ या छवि अपलोड करें। MediAssist AI प्रारंभिक स्क्रीनिंग देता है। डॉक्टर से मिलने पर वह आपकी Patient ID से पहुँच माँग सकता है; आप अपने पोर्टल में अनुमति देते हैं।",
    heroNote: "यह शैक्षणिक निर्णय-सहायता प्रोटोटाइप है—न निदान, न आपातकालीन सेवा।",
    previewLabel: "देखभाल की प्रक्रिया", previewTitle: "आपकी जानकारी से आगे की देखभाल तक",
    previewItems: [["01", "आप जानकारी दें", "लक्षण, त्वचा की छवि या छाती का एक्स-रे।"], ["02", "AI स्क्रीनिंग", "मॉडल परिणाम, स्कोर, स्पष्टीकरण और मार्गदर्शन।"], ["03", "अगला कदम", "पास की देखभाल खोजें और डॉक्टर का अनुरोध स्वीकृत करें।"]],
    previewFoot: "केवल उदाहरण · कोई वास्तविक रोगी डेटा नहीं", pillars: [["रोगी-प्रथम", "रोगी पहले जानकारी देता है और AI परिणाम देखता है।"], ["समझने योग्य", "व्याख्या दिखाती है कि मॉडल पर किन बातों का असर पड़ा।"], ["मानवीय देखभाल", "निदान और उपचार के लिए डॉक्टर का आकलन आवश्यक है।"]],
    badgeAi: "AI + मानवीय देखभाल", badgePatient: "रोगी-प्रथम",
    featuresEyebrow: "प्लेटफ़ॉर्म की सुविधाएँ", featuresTitle: "देखभाल की पूरी प्रक्रिया में सहायता।", featuresIntro: "रोगियों के लिए स्क्रीनिंग और रोगी की अनुमति से डॉक्टर फॉलो-अप।",
    features: [["लक्षण स्क्रीनिंग", "XGBoost से मिलान, संभावित परिणाम और पहचाने गए लक्षण।", "01"], ["छवि विश्लेषण", "त्वचा और छाती के एक्स-रे की स्क्रीनिंग व दृश्य व्याख्या।", "02"], ["पास की देखभाल", "GPS और OpenStreetMap से अस्पताल या डॉक्टर/क्लिनिक खोजें; शुरुआत 3 किमी से।", "03"], ["डॉक्टर फॉलो-अप", "डॉक्टर Patient ID से पहुँच माँगता है; रिकॉर्ड देखने से पहले रोगी अनुमति देता है।", "04"]],
    howEyebrow: "सरल प्रक्रिया", howTitle: "MediAssist कैसे काम करता है",
    steps: [["अपनी समस्या बताएँ", "रोगी पोर्टल में लक्षण लिखें या समर्थित छवि अपलोड करें।"], ["AI परिणाम देखें", "मॉडल स्कोर, पहचाने गए इनपुट और व्याख्या देखें।"], ["उचित अगला कदम लें", "सुरक्षा मार्गदर्शन देखें; अनिश्चित, मध्यम या गंभीर परिणाम पर पास की देखभाल खोजें।"], ["जुड़े रहें", "डॉक्टर का अनुरोध स्वीकृत करने के बाद उसका फॉलो-अप नोट देखें।"]],
    aboutEyebrow: "परियोजना के बारे में", aboutTitle: "तकनीक बातचीत में मदद करती है, उसका स्थान नहीं लेती।", aboutText: "MediAssist AI एक शैक्षणिक स्वास्थ्य निर्णय-सहायता परियोजना है। यह स्क्रीनिंग, पास की देखभाल खोज और रोगी की अनुमति से डॉक्टर फॉलो-अप जोड़ता है।",
    aboutSmall: "मॉडल अलग-अलग डेटासेट पर प्रशिक्षित हैं। परिणाम संयुक्त निदान नहीं हैं और स्कोर बीमारी की प्रमाणित संभावना नहीं हैं।",
    aboutCards: [["रोगियों के लिए", "AI परिणाम देखें, पास की देखभाल खोजें और डॉक्टर की पहुँच स्वीकृत या रद्द करें।"], ["डॉक्टरों के लिए", "रोगी की अनुमति के बाद मामले की समीक्षा और अपना फॉलो-अप नोट लिखें। AI पर्चा नहीं लिखता।"]],
    safetyEyebrow: "महत्वपूर्ण सुरक्षा सूचना", safetyTitle: "आपका स्वास्थ्य एक अनुमान से अधिक महत्वपूर्ण है।", safetyText: "यह केवल स्क्रीनिंग सहायता है। यह बीमारी की पुष्टि नहीं कर सकता, आपातस्थिति को नकार नहीं सकता और डॉक्टर की जगह नहीं ले सकता। मॉडल और सीमाएँ वास्तविक निदान के लिए चिकित्सकीय रूप से प्रमाणित नहीं हैं।",
    emergency: "सांस लेने में गंभीर कठिनाई, सीने में नया तीव्र दर्द, स्ट्रोक जैसे लक्षण, न रुकने वाला रक्तस्राव या अचानक गंभीर अस्वस्थता हो तो तुरंत आपातकालीन चिकित्सा सहायता लें। AI का इंतज़ार न करें।",
    faqEyebrow: "जानना ज़रूरी है", faqTitle: "आम सवाल", faqs: [["क्या यह निदान है?", "नहीं। यह स्क्रीनिंग प्रोटोटाइप है। डॉक्टर को इतिहास, परीक्षण और जाँच का आकलन करना होगा।"], ["डॉक्टर मेरा मामला कब देख सकता है?", "डॉक्टर Patient ID से अनुरोध करता है और आप अनुमति देते हैं। अकेली Patient ID पहुँच नहीं देती।"], ["मेरे लक्षण पहचाने न जाएँ तो?", "प्रणाली विश्वसनीय स्क्रीनिंग नहीं कर सकती। चिंताजनक लक्षणों के लिए डॉक्टर से सलाह लें।"], ["मेरी जानकारी कैसे रखी जाती है?", "पोर्टल Supabase लॉगिन और डेटाबेस पहुँच नियम इस्तेमाल करता है। वास्तविक रोगी डेटा के लिए पहले पूरी सुरक्षा व गोपनीयता समीक्षा आवश्यक है।"]],
    ctaEyebrow: "शुरू करें", ctaTitle: "समझ के साथ शुरुआत। देखभाल के साथ आगे।", ctaText: "स्क्रीनिंग देखने के लिए रोगी खाता बनाएँ या मौजूदा मामले के लिए लॉग इन करें।", footerNote: "शैक्षणिक निर्णय-सहायता प्रोटोटाइप। आपातकालीन उपयोग या पक्के निदान के लिए नहीं।",
  },
  mr: {
    nav: ["वैशिष्ट्ये", "कसे कार्य करते", "आमच्याबद्दल", "सुरक्षा"], login: "लॉग इन", register: "खाते तयार करा", explore: "प्रक्रिया पाहा",
    eyebrow: "रुग्ण-प्रथम वैद्यकीय निर्णय सहाय्य", titleA: "पुढचे पाऊल स्पष्ट होते", titleB: "तुमच्या माहितीपासून.",
    intro: "लक्षणे सांगा किंवा प्रतिमा अपलोड करा. MediAssist AI प्राथमिक स्क्रीनिंग देते. डॉक्टरांना भेटल्यावर ते Patient ID वापरून प्रवेश मागू शकतात; तुम्ही पोर्टलमध्ये मंजुरी देता.",
    heroNote: "हा शैक्षणिक निर्णय-सहाय्य नमुना आहे—निदान किंवा आपत्कालीन सेवा नाही.",
    previewLabel: "काळजीची प्रक्रिया", previewTitle: "तुमच्या माहितीपासून पुढील काळजीपर्यंत",
    previewItems: [["01", "तुम्ही माहिती द्या", "लक्षणे, त्वचेची प्रतिमा किंवा छातीचा एक्स-रे."], ["02", "AI स्क्रीनिंग", "मॉडेल निकाल, गुण, स्पष्टीकरण आणि मार्गदर्शन."], ["03", "पुढचे पाऊल", "जवळची काळजी शोधा आणि डॉक्टरांची विनंती मंजूर करा."]],
    previewFoot: "केवळ उदाहरण · खरा रुग्ण डेटा नाही", pillars: [["रुग्ण-प्रथम", "रुग्ण माहिती देतो आणि AI निकाल प्रथम पाहतो."], ["समजण्यास सोपे", "स्पष्टीकरण मॉडेलवर कोणत्या गोष्टींचा परिणाम झाला ते दाखवते."], ["मानवी काळजी", "निदान आणि उपचारासाठी डॉक्टरांचे मूल्यांकन आवश्यक आहे."]],
    badgeAi: "AI + मानवी काळजी", badgePatient: "रुग्ण-प्रथम",
    featuresEyebrow: "प्लॅटफॉर्मची वैशिष्ट्ये", featuresTitle: "काळजीच्या प्रवासात सहाय्य.", featuresIntro: "रुग्णांसाठी स्क्रीनिंग आणि रुग्णाच्या मंजुरीने डॉक्टरांचा पाठपुरावा.",
    features: [["लक्षणांची स्क्रीनिंग", "XGBoost जुळवणी, संभाव्य निकाल आणि ओळखलेली लक्षणे.", "01"], ["प्रतिमा विश्लेषण", "त्वचा व छातीच्या एक्स-रेची स्क्रीनिंग आणि दृश्य स्पष्टीकरण.", "02"], ["जवळची काळजी", "GPS आणि OpenStreetMap वर रुग्णालये किंवा डॉक्टर/दवाखाने शोधा; सुरुवात 3 किमीपासून.", "03"], ["डॉक्टरांचा पाठपुरावा", "डॉक्टर Patient ID वापरून प्रवेश मागतात; नोंदी पाहण्यापूर्वी रुग्ण मंजुरी देतो.", "04"]],
    howEyebrow: "सोपी प्रक्रिया", howTitle: "MediAssist कसे कार्य करते",
    steps: [["समस्या सांगा", "रुग्ण पोर्टलमध्ये लक्षणे लिहा किंवा समर्थित प्रतिमा अपलोड करा."], ["AI निकाल पाहा", "मॉडेल गुण, ओळखलेले इनपुट आणि उपलब्ध स्पष्टीकरण पाहा."], ["योग्य पुढील पाऊल घ्या", "सुरक्षा सूचना वाचा; अनिश्चित, मध्यम किंवा गंभीर निकालावर जवळची काळजी शोधा."], ["संपर्कात राहा", "डॉक्टरांची विनंती मंजूर केल्यानंतर त्यांची पाठपुरावा नोंद पाहा."]],
    aboutEyebrow: "प्रकल्पाविषयी", aboutTitle: "तंत्रज्ञान संवादाला मदत करते; त्याची जागा घेत नाही.", aboutText: "MediAssist AI हा शैक्षणिक आरोग्य निर्णय-सहाय्य प्रकल्प आहे. यात स्क्रीनिंग, जवळची काळजी शोध आणि रुग्णाच्या मंजुरीने डॉक्टरांचा पाठपुरावा आहे.",
    aboutSmall: "मॉडेल वेगवेगळ्या डेटासेटवर प्रशिक्षित आहेत. निकाल एकत्रित निदान नाहीत आणि गुण आजाराची प्रमाणित शक्यता नाहीत.",
    aboutCards: [["रुग्णांसाठी", "AI निकाल पाहा, जवळची काळजी शोधा आणि डॉक्टरांचा प्रवेश मंजूर किंवा रद्द करा."], ["डॉक्टरांसाठी", "रुग्णाच्या मंजुरीनंतर प्रकरण पाहा आणि स्वतःच्या पाठपुरावा सूचना लिहा. AI औषधांची चिठ्ठी लिहीत नाही."]],
    safetyEyebrow: "महत्त्वाची सुरक्षा माहिती", safetyTitle: "तुमचे आरोग्य एका अंदाजापेक्षा अधिक महत्त्वाचे आहे.", safetyText: "ही केवळ स्क्रीनिंग मदत आहे. ती आजार निश्चित करू शकत नाही, आपत्कालीन स्थिती नाकारू शकत नाही किंवा डॉक्टरांची जागा घेऊ शकत नाही. मॉडेल वास्तविक निदानासाठी वैद्यकीयदृष्ट्या प्रमाणित नाहीत.",
    emergency: "श्वास घेण्यास तीव्र त्रास, छातीत नवीन तीव्र वेदना, पक्षाघातासारखी लक्षणे, न थांबणारा रक्तस्राव किंवा अचानक गंभीर अस्वस्थता असल्यास त्वरित आपत्कालीन वैद्यकीय मदत घ्या. AI निकालाची वाट पाहू नका.",
    faqEyebrow: "जाणून घ्या", faqTitle: "सामान्य प्रश्न", faqs: [["हे निदान आहे का?", "नाही. हा स्क्रीनिंग नमुना आहे. डॉक्टरांनी इतिहास, तपासणी व चाचण्या पाहणे गरजेचे आहे."], ["डॉक्टर माझे प्रकरण कधी पाहू शकतात?", "डॉक्टर Patient ID ने विनंती करतात आणि तुम्ही मंजुरी देता. केवळ Patient ID ने प्रवेश मिळत नाही."], ["लक्षणे ओळखली गेली नाहीत तर?", "प्रणाली विश्वसनीय स्क्रीनिंग करू शकत नाही. चिंताजनक लक्षणांसाठी डॉक्टरांचा सल्ला घ्या."], ["माझी माहिती कशी हाताळली जाते?", "पोर्टल Supabase लॉगिन आणि डेटाबेस प्रवेश नियम वापरते. खऱ्या रुग्ण डेटापूर्वी संपूर्ण सुरक्षा व गोपनीयता तपासणी आवश्यक आहे."]],
    ctaEyebrow: "सुरू करायचे?", ctaTitle: "समजून सुरुवात करा. काळजीने पुढे जा.", ctaText: "स्क्रीनिंग पाहण्यासाठी रुग्ण खाते तयार करा किंवा आधीचे प्रकरण सुरू ठेवण्यासाठी लॉग इन करा.", footerNote: "शैक्षणिक निर्णय-सहाय्य नमुना. आपत्कालीन वापर किंवा निश्चित निदानासाठी नाही.",
  },
};

function Symbol({ type }) {
  const paths = {
    pulse: <><path d="M2 12h5l2.5-6 4 12 2.5-6H22" /></>,
    spark: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z" /><path d="m19 17 .6 2.4L22 20l-2.4.6L19 23l-.6-2.4L16 20l2.4-.6z" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 6 6" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    people: <><circle cx="8" cy="8" r="3" /><path d="M2 20v-2a6 6 0 0 1 12 0v2" /><circle cx="17" cy="8" r="2.5" /><path d="M16 15a5 5 0 0 1 6 5" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

export default function LandingPage() {
  const { language } = useLanguage();
  const c = copy[language] || copy.en;
  const featureIcons = ["pulse", "image", "pin", "people"];

  return (
    <div className="landing-page" id="top">
      <header className="landing-header">
        <div className="landing-shell landing-nav-row">
          <a className="landing-brand" href="#top" aria-label="MediAssist AI home">
            <span className="landing-brand-mark"><Symbol type="pulse" /></span>
            <span><strong>MediAssist <em>AI</em></strong><small>CLINICAL DECISION SUPPORT</small></span>
          </a>
          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#features">{c.nav[0]}</a>
            <a href="#how-it-works">{c.nav[1]}</a>
            <a href="#about">{c.nav[2]}</a>
            <a href="#safety">{c.nav[3]}</a>
          </nav>
          <div className="landing-nav-actions">
            <Link className="landing-login-link" to="/login">{c.login}</Link>
            <Link className="landing-button landing-button-small" to="/register">{c.register}<span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-shell landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow"><span className="landing-dot" />{c.eyebrow}</span>
              <h1 id="landing-title">{c.titleA}<br /><span>{c.titleB}</span></h1>
              <p className="landing-lead">{c.intro}</p>
              <div className="landing-hero-actions">
                <Link className="landing-button" to="/register">{c.register}<span aria-hidden="true">↗</span></Link>
                <a className="landing-text-link" href="#how-it-works">{c.explore}<span aria-hidden="true">→</span></a>
              </div>
              <p className="landing-hero-note"><Symbol type="shield" />{c.heroNote}</p>
            </div>
            <div className="landing-hero-art" aria-label={c.previewTitle}>
              <div className="landing-orbit landing-orbit-one" /><div className="landing-orbit landing-orbit-two" />
              <div className="landing-journey-card">
                <div className="landing-journey-top"><span className="landing-mini-brand"><Symbol type="pulse" /> MediAssist AI</span><span className="landing-status-dot" /></div>
                <span className="landing-card-eyebrow">{c.previewLabel}</span>
                <h2>{c.previewTitle}</h2>
                <div className="landing-journey-list">
                  {c.previewItems.map(([number, title, description]) => (
                    <div className="landing-journey-item" key={number}>
                      <span className="landing-step-number">{number}</span>
                      <div><strong>{title}</strong><p>{description}</p></div>
                    </div>
                  ))}
                </div>
                <div className="landing-journey-bottom"><span className="landing-wave" aria-hidden="true" /><small>{c.previewFoot}</small></div>
              </div>
              <div className="landing-floating-badge landing-floating-badge-one"><Symbol type="spark" /><span>{c.badgeAi}</span></div>
              <div className="landing-floating-badge landing-floating-badge-two"><Symbol type="shield" /><span>{c.badgePatient}</span></div>
            </div>
          </div>
        </section>

        <section className="landing-pillars" aria-label="Project principles">
          <div className="landing-shell landing-pillars-grid">
            {c.pillars.map(([title, description], index) => <div className="landing-pillar" key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></div>)}
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-shell">
            <div className="landing-section-head"><span className="landing-section-kicker">{c.featuresEyebrow}</span><h2>{c.featuresTitle}</h2><p>{c.featuresIntro}</p></div>
            <div className="landing-feature-grid">
              {c.features.map(([title, description, number], index) => <article className="landing-feature-card" key={number}><div className="landing-feature-top"><span className="landing-feature-icon"><Symbol type={featureIcons[index]} /></span><span>{number} / 04</span></div><h3>{title}</h3><p>{description}</p></article>)}
            </div>
          </div>
        </section>

        <section className="landing-section landing-how" id="how-it-works">
          <div className="landing-shell landing-how-grid">
            <div className="landing-how-intro"><span className="landing-section-kicker">{c.howEyebrow}</span><h2>{c.howTitle}</h2><p>{c.heroNote}</p><Link className="landing-button" to="/register">{c.register}<span aria-hidden="true">↗</span></Link></div>
            <ol className="landing-timeline">{c.steps.map(([title, description], index) => <li key={title}><span className="landing-timeline-num">{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
          </div>
        </section>

        <section className="landing-section landing-about" id="about">
          <div className="landing-shell landing-about-grid">
            <div><span className="landing-section-kicker">{c.aboutEyebrow}</span><h2>{c.aboutTitle}</h2><p className="landing-about-lead">{c.aboutText}</p><p>{c.aboutSmall}</p></div>
            <div className="landing-about-cards">{c.aboutCards.map(([title, description], index) => <article key={title}><span className="landing-feature-icon"><Symbol type={index === 0 ? "people" : "shield"} /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
          </div>
        </section>

        <section className="landing-section landing-safety" id="safety">
          <div className="landing-shell landing-safety-grid"><div><span className="landing-section-kicker">{c.safetyEyebrow}</span><h2>{c.safetyTitle}</h2><p>{c.safetyText}</p></div><aside className="landing-emergency-card" role="note"><div className="landing-emergency-icon">!</div><p>{c.emergency}</p></aside></div>
        </section>

        <section className="landing-section landing-faq" id="questions"><div className="landing-shell landing-faq-grid"><div><span className="landing-section-kicker">{c.faqEyebrow}</span><h2>{c.faqTitle}</h2></div><div className="landing-faq-list">{c.faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>

        <section className="landing-cta"><div className="landing-shell landing-cta-inner"><div><span className="landing-section-kicker">{c.ctaEyebrow}</span><h2>{c.ctaTitle}</h2><p>{c.ctaText}</p></div><div className="landing-cta-actions"><Link className="landing-button landing-button-light" to="/register">{c.register}<span aria-hidden="true">↗</span></Link><Link className="landing-cta-login" to="/login">{c.login} →</Link></div></div></section>
      </main>

      <footer className="landing-footer"><div className="landing-shell landing-footer-inner"><div className="landing-footer-brand"><span className="landing-brand-mark"><Symbol type="pulse" /></span><span><strong>MediAssist AI</strong><small>{c.footerNote}</small></span></div><div className="landing-footer-links"><a href="#features">{c.nav[0]}</a><a href="#about">{c.nav[2]}</a><a href="#safety">{c.nav[3]}</a><Link to="/login">{c.login}</Link></div></div></footer>
    </div>
  );
}
