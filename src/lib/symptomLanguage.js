// The prediction model was trained with English symptom feature names. This
// explicit glossary lets common Hindi and Marathi entries reach those features.
const localizedSymptoms = {
  hi: {
    "खांसी": "cough", "बुखार": "high fever", "तेज बुखार": "high fever",
    "हल्का बुखार": "mild fever", "सांस लेने में तकलीफ": "breathlessness",
    "सांस की तकलीफ": "breathlessness", "सीने में दर्द": "chest pain",
    "सिरदर्द": "headache", "थकान": "fatigue", "मतली": "nausea",
    "उल्टी": "vomiting", "दस्त": "diarrhoea", "पेट दर्द": "stomach pain",
    "गले में खराश": "throat irritation", "नाक बहना": "runny nose",
    "चक्कर": "dizziness", "पसीना": "sweating", "ठंड लगना": "chills",
    "मांसपेशियों में दर्द": "muscle pain", "त्वचा पर दाने": "skin rash", "खुजली": "itching",
  },
  mr: {
    "खोकला": "cough", "ताप": "high fever", "जास्त ताप": "high fever",
    "हलका ताप": "mild fever", "श्वास घ्यायला त्रास": "breathlessness",
    "धाप लागणे": "breathlessness", "छातीत दुखणे": "chest pain",
    "डोकेदुखी": "headache", "थकवा": "fatigue", "मळमळ": "nausea",
    "उलटी": "vomiting", "जुलाब": "diarrhoea", "पोटदुखी": "stomach pain",
    "घसा खवखवणे": "throat irritation", "नाक वाहणे": "runny nose",
    "चक्कर": "dizziness", "घाम येणे": "sweating", "थंडी वाजणे": "chills",
    "स्नायू दुखणे": "muscle pain", "त्वचेवर पुरळ": "skin rash", "खाज": "itching",
  },
};

export function extractLocalizedSymptoms(text, language) {
  const glossary = localizedSymptoms[language];
  if (!glossary || !text) return [];
  const matchedTerms = Object.keys(glossary)
    .filter((term) => text.includes(term))
    .sort((a, b) => b.length - a.length);
  const specificTerms = matchedTerms.filter((term, index) =>
    !matchedTerms.slice(0, index).some((longerTerm) => longerTerm.includes(term)));
  return [...new Set(specificTerms.map((term) => glossary[term]))];
}
