// Turns the free-text location a job board gives ("US, CA, Santa Clara", "Corporate -
// Springdale, Arkansas", "Menlo Park, CA; New York, NY") into places with coordinates, so the
// Near me page can measure distance. A small hand-made list of places: Arkansas and its
// neighbours in detail, plus the main US and world job hubs (so "France - Paris" isn't read as
// Paris, Arkansas). A place marked strict only matches when its state or country is also in the text.

// [name, region, lat, lon, strict?, aliases?]
const PLACES = [
  // Arkansas
  ["Fayetteville", "AR", 36.0626, -94.1574], ["Springdale", "AR", 36.1867, -94.1288],
  ["Rogers", "AR", 36.3320, -94.1185, 1], ["Bentonville", "AR", 36.3729, -94.2088],
  ["Lowell", "AR", 36.2554, -94.1308, 1], ["Siloam Springs", "AR", 36.1881, -94.5405],
  ["Fort Smith", "AR", 35.3859, -94.3985, 0, ["UAFS"]], ["Van Buren", "AR", 35.4368, -94.3483, 1],
  ["Little Rock", "AR", 34.7465, -92.2896, 0, ["UAMS"]],
  ["North Little Rock", "AR", 34.7695, -92.2671, 0, ["Pulaski Technical College"]],
  ["Conway", "AR", 35.0887, -92.4421, 1], ["Jonesboro", "AR", 35.8423, -90.7043],
  ["Hot Springs", "AR", 34.5037, -93.0552], ["Pine Bluff", "AR", 34.2284, -92.0032],
  ["Russellville", "AR", 35.2784, -93.1338, 1], ["Harrison", "AR", 36.2298, -93.1077, 1],
  ["Benton", "AR", 34.5645, -92.5868, 1], ["Monticello", "AR", 33.6290, -91.7910, 1, ["UAM"]],
  ["Hope", "AR", 33.6671, -93.5916, 1], ["Newport", "AR", 35.6070, -91.2818, 1],
  ["Searcy", "AR", 35.2506, -91.7362], ["Batesville", "AR", 35.7698, -91.6410, 1],
  ["Texarkana", "AR", 33.4418, -94.0377], ["El Dorado", "AR", 33.2076, -92.6663, 1],
  ["Paris", "AR", 35.2918, -93.7299, 1], ["Magnolia", "AR", 33.2671, -93.2393, 1],
  ["Arkadelphia", "AR", 34.1209, -93.0538], ["Clarksville", "AR", 35.4715, -93.4666, 1],
  ["Dardanelle", "AR", 35.2234, -93.1577], ["Waldron", "AR", 34.8984, -94.0905, 1],
  ["Berryville", "AR", 36.3648, -93.5679], ["Green Forest", "AR", 36.3354, -93.4360],
  ["Huntsville", "AR", 36.0862, -93.7413, 1], ["Nashville", "AR", 33.9457, -93.8471, 1],
  ["Dexter", "AR", 33.9, -91.3, 1],
  // Oklahoma, Missouri, Kansas
  ["Tulsa", "OK", 36.1540, -95.9928], ["Oklahoma City", "OK", 35.4676, -97.5164],
  ["Norman", "OK", 35.2226, -97.4395, 1], ["Broken Arrow", "OK", 36.0526, -95.7908],
  ["Stillwater", "OK", 36.1156, -97.0584, 1], ["Spavinaw", "OK", 36.3901, -95.0477],
  ["Kansas City", "MO", 39.0997, -94.5786], ["St. Louis", "MO", 38.6270, -90.1994, 0, ["Saint Louis", "St Louis"]],
  ["Springfield", "MO", 37.2090, -93.2923, 1], ["Joplin", "MO", 37.0842, -94.5133],
  ["Columbia", "MO", 38.9517, -92.3341, 1], ["O'Fallon", "MO", 38.8106, -90.6998, 1],
  ["Pineville", "MO", 36.5945, -94.3841, 1], ["Monett", "MO", 36.9289, -93.9277],
  ["Noel", "MO", 36.5456, -94.4855, 1], ["Neosho", "MO", 36.8689, -94.3680],
  ["Overland Park", "KS", 38.9822, -94.6708], ["Lenexa", "KS", 38.9536, -94.7336], ["Wichita", "KS", 37.6872, -97.3301],
  // Texas, Louisiana, Tennessee, Mississippi
  ["Dallas", "TX", 32.7767, -96.7970], ["Plano", "TX", 33.0198, -96.6989], ["Fort Worth", "TX", 32.7555, -97.3308],
  ["Irving", "TX", 32.8140, -96.9489], ["Frisco", "TX", 33.1507, -96.8236], ["Richardson", "TX", 32.9483, -96.7299, 1],
  ["Houston", "TX", 29.7604, -95.3698], ["Austin", "TX", 30.2672, -97.7431], ["San Antonio", "TX", 29.4241, -98.4936],
  ["Seguin", "TX", 29.5688, -97.9647], ["Center", "TX", 31.7949, -94.1791, 1], ["Carthage", "TX", 32.1574, -94.3374, 1],
  ["Amarillo", "TX", 35.2220, -101.8313], ["El Paso", "TX", 31.7619, -106.4850], ["Sherman", "TX", 33.6357, -96.6089, 1],
  ["Nacogdoches", "TX", 31.6035, -94.6555],
  ["New Orleans", "LA", 29.9511, -90.0715], ["Baton Rouge", "LA", 30.4515, -91.1871], ["Shreveport", "LA", 32.5252, -93.7502],
  ["Memphis", "TN", 35.1495, -90.0490], ["Nashville", "TN", 36.1627, -86.7816], ["Knoxville", "TN", 35.9606, -83.9207],
  ["Chattanooga", "TN", 35.0456, -85.3097], ["Union City", "TN", 36.4242, -89.0570, 1], ["Shelbyville", "TN", 35.4834, -86.4603, 1],
  ["Jackson", "MS", 32.2988, -90.1848, 1], ["Forest", "MS", 32.3646, -89.4742, 1],
  // Northeast and mid-Atlantic
  ["New York", "NY", 40.7128, -74.0060, 0, ["New York City", "NYC", "Manhattan", "Brooklyn"]],
  ["Purchase", "NY", 41.0409, -73.7146, 1], ["Jersey City", "NJ", 40.7178, -74.0431], ["Newark", "NJ", 40.7357, -74.1724, 1],
  ["Stamford", "CT", 41.0534, -73.5387], ["Hartford", "CT", 41.7658, -72.6734],
  ["Boston", "MA", 42.3601, -71.0589], ["Cambridge", "MA", 42.3736, -71.1097, 1],
  ["Philadelphia", "PA", 39.9526, -75.1652], ["Pittsburgh", "PA", 40.4406, -79.9959],
  ["Washington, D.C.", "DC", 38.9072, -77.0369, 0, ["Washington DC", "Washington D.C.", "Washington, DC"]],
  ["McLean", "VA", 38.9339, -77.1773], ["Tysons", "VA", 38.9187, -77.2311], ["Arlington", "VA", 38.8816, -77.0910, 1],
  ["Reston", "VA", 38.9586, -77.3570], ["Herndon", "VA", 38.9696, -77.3861], ["Richmond", "VA", 37.5407, -77.4360, 1],
  ["Baltimore", "MD", 39.2904, -76.6122], ["Wilmington", "DE", 39.7391, -75.5398, 1],
  // Southeast
  ["Raleigh", "NC", 35.7796, -78.6382], ["Durham", "NC", 35.9940, -78.8986, 1], ["Charlotte", "NC", 35.2271, -80.8431],
  ["Fayetteville", "NC", 35.0527, -78.8784, 1], ["Monroe", "NC", 34.9854, -80.5495, 1], ["Wilkesboro", "NC", 36.1460, -81.1606],
  ["Roaring River", "NC", 36.2, -81.03], ["Atlanta", "GA", 33.7490, -84.3880], ["Miami", "FL", 25.7617, -80.1918],
  ["Tampa", "FL", 27.9506, -82.4572], ["Orlando", "FL", 28.5383, -81.3792], ["Jacksonville", "FL", 30.3322, -81.6557, 1],
  ["Birmingham", "AL", 33.5186, -86.8104, 1], ["Huntsville", "AL", 34.7304, -86.5861, 1],
  ["Louisville", "KY", 38.2527, -85.7585], ["Lexington", "KY", 38.0406, -84.5037, 1],
  // Midwest
  ["Chicago", "IL", 41.8781, -87.6298], ["Detroit", "MI", 42.3314, -83.0458], ["Ann Arbor", "MI", 42.2808, -83.7430],
  ["Zeeland", "MI", 42.8125, -86.0187], ["Columbus", "OH", 39.9612, -82.9988, 1], ["Cleveland", "OH", 41.4993, -81.6944],
  ["Cincinnati", "OH", 39.1031, -84.5120], ["Indianapolis", "IN", 39.7684, -86.1581],
  ["Minneapolis", "MN", 44.9778, -93.2650], ["St. Paul", "MN", 44.9537, -93.0900, 0, ["Saint Paul"]],
  ["Milwaukee", "WI", 43.0389, -87.9065], ["Madison", "WI", 43.0731, -89.4012, 1],
  ["Omaha", "NE", 41.2565, -95.9345], ["Lincoln", "NE", 40.8136, -96.7026, 1], ["Waverly", "NE", 40.9175, -96.5281, 1],
  ["Des Moines", "IA", 41.5868, -93.6250],
  // West
  ["Denver", "CO", 39.7392, -104.9903], ["Boulder", "CO", 40.0150, -105.2705], ["Salt Lake City", "UT", 40.7608, -111.8910],
  ["Lehi", "UT", 40.3916, -111.8508], ["Phoenix", "AZ", 33.4484, -112.0740], ["Tempe", "AZ", 33.4255, -111.9400],
  ["Scottsdale", "AZ", 33.4942, -111.9261], ["Las Vegas", "NV", 36.1699, -115.1398],
  ["Los Angeles", "CA", 34.0522, -118.2437], ["Santa Monica", "CA", 34.0195, -118.4912], ["Irvine", "CA", 33.6846, -117.8265],
  ["San Diego", "CA", 32.7157, -117.1611], ["San Francisco", "CA", 37.7749, -122.4194], ["Oakland", "CA", 37.8044, -122.2712],
  ["San Jose", "CA", 37.3382, -121.8863], ["Santa Clara", "CA", 37.3541, -121.9552], ["Sunnyvale", "CA", 37.3688, -122.0363],
  ["Mountain View", "CA", 37.3861, -122.0839], ["Palo Alto", "CA", 37.4419, -122.1430], ["Menlo Park", "CA", 37.4530, -122.1817],
  ["Redwood City", "CA", 37.4852, -122.2364], ["San Mateo", "CA", 37.5630, -122.3255], ["Sacramento", "CA", 38.5816, -121.4944],
  ["Seattle", "WA", 47.6062, -122.3321], ["Bellevue", "WA", 47.6101, -122.2015, 1], ["Redmond", "WA", 47.6740, -122.1215],
  ["Pasco", "WA", 46.2396, -119.1006], ["Vancouver", "WA", 45.6387, -122.6615, 1],
  ["Portland", "OR", 45.5152, -122.6784, 1], ["Hillsboro", "OR", 45.5229, -122.9898, 1],
  // Outside the US (mainly so their names aren't read as US towns)
  ["London", "GB", 51.5074, -0.1278], ["Birmingham", "GB", 52.4862, -1.8904, 1], ["Cambridge", "GB", 52.2053, 0.1218, 1],
  ["Manchester", "GB", 53.4808, -2.2426], ["Nottingham", "GB", 52.9548, -1.1581], ["Dublin", "IE", 53.3498, -6.2603],
  ["Paris", "FR", 48.8566, 2.3522], ["Berlin", "DE", 52.5200, 13.4050], ["Munich", "DE", 48.1351, 11.5820],
  ["Stuttgart", "DE", 48.7758, 9.1829], ["Amsterdam", "NL", 52.3676, 4.9041], ["Madrid", "ES", 40.4168, -3.7038],
  ["Barcelona", "ES", 41.3874, 2.1686], ["Warsaw", "PL", 52.2297, 21.0122], ["Tel Aviv", "IL", 32.0853, 34.7818],
  ["Toronto", "CA-ON", 43.6532, -79.3832], ["Vancouver", "CA-BC", 49.2827, -123.1207], ["Montreal", "CA-QC", 45.5019, -73.5674],
  ["Mexico City", "MX", 19.4326, -99.1332], ["Sao Paulo", "BR", -23.5505, -46.6333, 0, ["São Paulo"]],
  ["Bogota", "CO", 4.7110, -74.0721, 0, ["Bogotá"]], ["Singapore", "SG", 1.3521, 103.8198],
  ["Tokyo", "JP", 35.6762, 139.6503], ["Shanghai", "CN", 31.2304, 121.4737], ["Beijing", "CN", 39.9042, 116.4074],
  ["Bengaluru", "IN", 12.9716, 77.5946, 0, ["Bangalore"]], ["Hyderabad", "IN", 17.3850, 78.4867],
  ["Pune", "IN", 18.5204, 73.8567], ["Gurgaon", "IN", 28.4595, 77.0266, 0, ["Gurugram"]], ["Mumbai", "IN", 19.0760, 72.8777],
  ["Sydney", "AU", -33.8688, 151.2093], ["Melbourne", "AU", -37.8136, 144.9631], ["Manila", "PH", 14.5995, 120.9842],
];

const US_STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const COUNTRIES = {
  GB: ["United Kingdom", "UK", "England", "Eng", "GB", "Great Britain"], IE: ["Ireland"], FR: ["France"],
  DE: ["Germany"], NL: ["Netherlands"], ES: ["Spain"], PL: ["Poland"], IL: ["Israel"], MX: ["Mexico"],
  BR: ["Brazil"], CO: ["Colombia"], SG: ["Singapore"], JP: ["Japan"], CN: ["China"], IN: ["India"],
  AU: ["Australia"], PH: ["Philippines"],
  "CA-ON": ["Canada", "Ontario", "ON"], "CA-BC": ["Canada", "British Columbia", "BC"], "CA-QC": ["Canada", "Quebec", "QC"],
};

const placeIndex = (() => {
  const byName = new Map();
  const names = [];
  for (const [name, region, lat, lon, strict = 0, aliases = []] of PLACES) {
    const p = { name, region, lat, lon, strict: !!strict, label: name.includes(",") ? name : `${name}, ${region.replace(/^CA-/, "")}` };
    for (const n of [name, ...aliases]) {
      const k = n.toLowerCase();
      if (!byName.has(k)) { byName.set(k, []); names.push(n); }
      byName.get(k).push(p);
    }
  }
  names.sort((a, b) => b.length - a.length);  // longest first: "North Little Rock" before "Little Rock"
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![A-Za-z])(${names.map(esc).join("|")})(?![A-Za-z])`, "gi");
  return { byName, re };
})();

function regionInText(region, text) {
  if (US_STATES[region]) {
    const code = new RegExp(`(?<![A-Za-z])${region}(?![A-Za-z])`);  // upper-case code: ", AR" / "US-AR-" / "US, CA,"
    return code.test(text) || new RegExp(`\\b${US_STATES[region]}\\b`, "i").test(text);
  }
  return (COUNTRIES[region] || []).some(w => new RegExp(`(?<![A-Za-z])${w}(?![A-Za-z])`, w.length <= 3 ? "" : "i").test(text));
}

const locateCache = new Map();
// -> { places: [place...], remote: bool, multi: bool }. `hint` is a region to assume when the text
// names none (the University of Arkansas System and Tyson boards often give just a town).
function locate(text, hint) {
  const key = `${hint || ""}|${text || ""}`;
  if (locateCache.has(key)) return locateCache.get(key);
  const t = text || "";
  const out = { places: [], remote: /\bremote\b|\banywhere\b/i.test(t), multi: /^\s*\d+\s+locations\s*$/i.test(t) };
  for (const part of t.split(/;|\||\bor\b|\n/)) {
    const hits = [...part.matchAll(placeIndex.re)].map(m => m[1].toLowerCase());
    for (const h of hits) {
      const cands = placeIndex.byName.get(h) || [];
      const p = cands.find(c => regionInText(c.region, part))
        || (hint && cands.find(c => c.region === hint && !regionInTextAnyOther(c, cands, part)))
        || cands.find(c => !c.strict);
      if (p && !out.places.includes(p)) { out.places.push(p); break; }  // one place per part
    }
  }
  locateCache.set(key, out);
  return out;
}
function regionInTextAnyOther(c, cands, part) {
  return cands.some(o => o !== c && regionInText(o.region, part));
}

function milesBetween(a, b) {
  const R = 3958.8, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
