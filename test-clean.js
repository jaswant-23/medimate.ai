const DOSAGE_SCHEDULE_RE = /\b(\d[-–]\d[-–]\d|\d+\s*[-–]\s*\d+\s*[-–]\s*\d+|OD|BD|TDS|QID|SOS|PRN|HS|AC|PC|STAT)\b/i;
function cleanMedicineName(raw) {
  let name = raw.trim();
  console.log('1:', name);
  name = name.replace(/\(.*?\)/g, '').trim();
  console.log('2:', name);
  name = name.replace(DOSAGE_SCHEDULE_RE, '').trim();
  console.log('3:', name);
  name = name.replace(/\s*(?:-?\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|iu|units?)\b).*/i, '').trim();
  console.log('4:', name);
  name = name.replace(/\s+\d+\s*(days?|weeks?|months?)\b.*/i, '').trim();
  console.log('5:', name);
  name = name.replace(/\s+(tablet|capsule|syrup|drop|spray|cream|ointment|injection|inhaler|gel|lotion|patch)s?\b.*/i, '').trim();
  console.log('6:', name);
  name = name.replace(/\b(duration|dose|dosage|frequency|qty|quantity|take|route|times|once|twice|thrice)\b.*/i, '').trim();
  console.log('7:', name);
  name = name.replace(/[.,;:\-–—\/\\]+$/, '').trim();
  console.log('8:', name);
  return name;
}
console.log(cleanMedicineName("Age: 45 | Male | G 9012345678	Follow Up: 2026-03-14"));
