// All user-facing interface text (English only). Clinical decision wording and
// numbers live in shared/rules.json; this file holds layout/chrome text only.
// {placeholders} are filled with fmt().

export const S = {
  appTitle: "Amr Score",
  appAlt: "SAFER Score",
  by: "By Amr",
  logoAlt: "Preterm baby on ventilation in an incubator",
  subtitle: "Surfactant decision in preterm respiratory distress, first {hours} hours.",

  qrButton: "QR",
  qrCaption: "Scan to open on another phone",

  alarmTitle: "Reassessment alarm",
  alarmHint: "Reminds you to reassess every {minutes} min for {hours} hours, with a gentle melody",
  alarmIdle: "{rounds} reminders · {minutes} min apart",
  alarmRunning: "Reminder {n} of {rounds} at {time}",
  alarmRinging: "Time to reassess ({fired} of {rounds})",
  alarmDone: "{hours} hours completed",
  alarmStart: "Start {hours} h reminders",
  alarmRestart: "Restart {hours} h reminders",
  alarmStop: "Stop alarm",
  alarmCancel: "Cancel",
  recordScore: "Record score",
  testSound: "Test sound",

  doseTitle: "Surfactant dose & ETT position",
  weightLabel: "Weight (kg)",
  weightPlaceholder: "kg",
  gaLabel: "GA (weeks)",
  gaPlaceholder: "wk",
  surfactantType: "Surfactant type",
  doseKind: "Dose",
  initialDose: "Initial dose",
  repeatDose: "Repeat dose",
  surfactantDose: "Surfactant dose",
  ettDepth: "ETT depth at the lip",
  doseHintNoType: "Choose type and enter weight",
  doseChooseType: "Choose a surfactant type",
  doseEnterWeight: "Enter the weight",
  ettEnter: "Enter GA or weight",
  ettFromTable: "NRP table for {ga} wk",
  ettFromWeight: "Weight + {offset} cm",
  ettBoth: " · weight + {offset} = {cm} cm",
  ettTube: " · tube size {mm} mm",
  doseDetail: "{mg} mg · {mgkg} mg/kg ({mlkg} mL/kg) · vials {vials}",

  clearAll: "Clear all",
  pointsUnit: "{p} pt",
  noPoints: "—",

  legendScore: "**Score ≥ {cutoff}:** give surfactant. **Score < {cutoff}:** reassess every {minutes} min during the first {hours} hours.",
  legendMax: "**Max {max}.** {parts}",
  legendDoses: "**Surfactant doses (product labels):** {doses}. **ETT depth:** NRP gestational-age table when GA is entered (more accurate in small babies), otherwise weight + {offset} cm.",
  keepOpen: "Keep this page open on screen for the alarm to sound.",

  about: "About",
  aboutRules: "Rules version {version} · status: {status}",
  aboutReviewed: "Clinical review: {who}",
  aboutNotReviewed: "not yet reviewed",
  aboutOffline: "Works offline once loaded. No data leaves this device.",

  fatalTitle: "Clinical rules could not be loaded",
  fatalBody: "Do not use this tool until this is fixed. Reload the page. If the problem continues, contact the administrator.",
  noscript: "This tool needs JavaScript.",
};

export function fmt(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`Missing template value: ${key}`);
    return String(vars[key]);
  });
}
