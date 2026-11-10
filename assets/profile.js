// Whose job search this is, from the public resume and portfolio
// (https://jdshetron.github.io/portfolio-website/). Used to rank postings by fit and to centre
// the Near me page. Edit this file to change the profile.

const PROFILE = {
  name: "John Shetron",
  firstName: "John",
  headline: "Business analyst bridging civil-engineering field data and BI",
  education: "M.S. Applied Business Analytics, University of Arkansas (expected May 2027)",
  portfolio: "https://jdshetron.github.io/portfolio-website/",
  resume: "https://jdshetron.github.io/portfolio-website/assets/John_Shetron_Resume.pdf",
  home: { label: "Fayetteville, AR", lat: 36.0626, lon: -94.1574 },
  defaultRadius: 200,  // miles: Northwest Arkansas, Fort Smith, Little Rock, Tulsa, Springfield MO

  // Title words that match the resume, with how much each adds to the fit score.
  skills: [
    { label: "Power BI", re: /\bpower ?bi\b/i, w: 3 },
    { label: "Business intelligence", re: /\bbusiness intelligence\b|\bbi\b/i, w: 3 },
    { label: "SQL", re: /\bsql\b/i, w: 3 },
    { label: "Data analyst", re: /\bdata analyst/i, w: 3 },
    { label: "Business analyst", re: /\bbusiness (systems )?analyst/i, w: 3 },
    { label: "Reporting", re: /\breporting\b|\bdashboard/i, w: 2 },
    { label: "Analytics", re: /\banalytics?\b/i, w: 2 },
    { label: "Data", re: /\bdata\b/i, w: 1 },
    { label: "Salesforce", re: /\bsalesforce\b/i, w: 1 },
    { label: "SAP / ERP", re: /\bsap\b|\berp\b/i, w: 1 },
    { label: "Automation", re: /\bautomat/i, w: 1 },
    { label: "Engineering / construction", re: /\bengineering\b|\bconstruction\b|\binfrastructure\b|\bfield\b/i, w: 1 },
    { label: "Operations / supply chain", re: /\boperations\b|\bsupply chain\b|\bprocess\b/i, w: 1 },
  ],
  // Level: about 4 years of experience, finishing a master's in 2027.
  level: [
    { label: "Entry level", re: /\b(junior|jr\.?|entry|associate|new grad|early career|graduate|analyst i|analyst 1|analyst ii|analyst 2)\b/i, w: 2 },
    { label: "Internship", re: /\bintern(ship)?\b/i, w: 1 },
    { label: "Senior", re: /\b(senior|sr\.?)\b/i, w: -1 },
    { label: "Manager", re: /\bmanager\b|\blead\b/i, w: -2 },
    { label: "Too senior", re: /\b(director|vp|vice president|head of|principal|staff|chief)\b/i, w: -4 },
    { label: "Software engineering", re: /\bsoftware engineer|\bdeveloper\b|\bsre\b/i, w: -3 },
  ],
};

// Where: US-based, so jobs in Arkansas gain a point and jobs outside the US lose points.
const STATE_CODES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY US USA".split(" "));
const ABROAD = /\b(india|germany|deutschland|portugal|spain|france|italy|poland|hungary|romania|czech|netherlands|belgium|ireland|united kingdom|england|uk|scotland|canada|mexico|brazil|argentina|colombia|chile|china|japan|korea|taiwan|singapore|malaysia|vietnam|philippines|thailand|indonesia|australia|israel|turkey|egypt|south africa|switzerland|austria|sweden|denmark|norway|finland|emea|apac|latam|toronto|vancouver|montreal|london|dublin|bengaluru|bangalore|hyderabad|pune|mumbai|gurgaon|tokyo|sydney|melbourne|paris|berlin|munich|amsterdam|sao paulo|mexico city|tel aviv|shanghai|beijing|manila)\b/i;
const IN_ARKANSAS = /\barkansas\b|,\s*AR\b|\b(fayetteville|springdale|bentonville|rogers|lowell|little rock|fort smith)\b/i;
function whereScore(r) {
  const loc = r.location || "";
  if (IN_ARKANSAS.test(loc) || r.source === "uark-system") return { w: 1, label: "Arkansas" };
  const code = (loc.match(/,\s*([A-Za-z]{2})\s*$/) || [])[1];
  if (ABROAD.test(loc) || (code && !STATE_CODES.has(code.toUpperCase())) || /praktikum|werkstudent|estágio|stagiaire/i.test(r.title)) return { w: -8, label: null };  // effectively out of the running
  return { w: 0, label: null };
}

// Fit score for one posting: resume skills and level from the title, where it is, plus 1 for
// the data-analyst role. Returns { score, reasons }.
function fitScore(r) {
  let score = r.in_role ? 1 : 0;
  const reasons = [];
  for (const s of PROFILE.skills) if (s.re.test(r.title)) { score += s.w; reasons.push(s.label); }
  for (const l of PROFILE.level) if (l.re.test(r.title)) { score += l.w; if (l.w > 0) reasons.push(l.label); }
  const where = whereScore(r);
  score += where.w;
  if (where.label) reasons.push(where.label);
  return { score, reasons };
}
function fitLabel(score) {
  return score >= 7 ? "Great fit" : score >= 4 ? "Good fit" : null;
}
