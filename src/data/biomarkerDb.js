/**
 * Biomarker database: reference ranges, units, descriptions.
 * Ranges inspired by Blueprint Biomarkers; see blueprintbiomarkers.com.
 */
export const BIOMARKER_DB = {
  // ── LIPIDS ────────────────────────────────────────────────────────────────
  "Total Cholesterol": {
    category: "Lipids",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Blueprint goal is <150 mg/dL. Achieving it should NOT show "low".
    // Dangerously low (<100) is extremely rare and only with severe malabsorption.
    optimal: [100, 150],    // Blueprint achieved ✓
    sufficient: [150, 200], // Acceptable for general population
    high: [200, 9999],      // Elevated cardiovascular risk (AHA threshold)
    low: [0, 100],          // Pathologically low — malnutrition or severe illness
    description: "Total cholesterol is the sum of all cholesterol fractions. Bryan Johnson's Blueprint targets <150 mg/dL — the lower range associated with minimal atherosclerosis risk. Standard labs flag >200 as high; Blueprint sets the bar much stricter.",
    improve: "Reduce saturated fat (<7% of calories) and eliminate trans fats. Increase soluble fiber (oat beta-glucan, psyllium husk 10–15 g/day). Plant sterols/stanols 2 g/day. Regular aerobic exercise 150+ min/week.",
    icon: "💧",
  },
  "LDL Cholesterol": {
    category: "Lipids",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Blueprint / longevity target: <70 mg/dL. Very low LDL (<30) with statins may
    // rarely affect steroid hormone synthesis — worth monitoring.
    optimal: [30, 70],      // Blueprint target range
    sufficient: [70, 100],  // ACC/AHA low-risk threshold
    high: [100, 9999],      // Elevated — increased atherosclerosis risk
    low: [0, 30],           // Unusually low; monitor hormone levels
    description: "LDL is the primary atherogenic lipoprotein. Each LDL particle can embed in arterial walls. Blueprint targets <70 mg/dL; aggressive longevity protocols aim for <50 mg/dL. Standard labs flag >130 as high — Blueprint sets a far stricter threshold.",
    improve: "Reduce saturated fat to <7% of calories. Soluble fiber 15–30 g/day. Avoid trans fats entirely. Aerobic exercise 150+ min/week. Berberine 500 mg 2×/day or red yeast rice as natural alternatives.",
    icon: "⬇️",
  },
  "HDL Cholesterol": {
    category: "Lipids",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Higher is generally better up to ~100. Above ~100 mg/dL HDL can become
    // dysfunctional (SR-BI pathway) and paradoxically increase CV risk.
    optimal: [55, 100],     // Cardioprotective range
    sufficient: [40, 55],   // Meets minimum ACC/AHA threshold (men ≥40, women ≥50)
    high: [100, 9999],      // Potentially dysfunctional HDL
    low: [0, 40],           // Low HDL — independent CV risk factor
    description: "HDL removes cholesterol from arterial walls (reverse cholesterol transport). Blueprint targets >55 mg/dL. Importantly, extremely high HDL (>100 mg/dL) can paradoxically indicate dysfunctional HDL particles with pro-inflammatory properties.",
    improve: "Aerobic exercise is the most potent HDL raiser (+5–10%). Quit smoking. Reduce refined carbohydrates. Moderate healthy fat intake. Niacin raises HDL but has side effects; use under medical supervision.",
    icon: "⬆️",
  },
  "Triglycerides": {
    category: "Lipids",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Blueprint target: <80 mg/dL. Very low triglycerides are not clinically harmful.
    optimal: [0, 80],       // Blueprint target — optimal metabolic health
    sufficient: [80, 150],  // ACC/AHA normal threshold
    high: [150, 9999],      // Borderline high begins at 150; very high ≥500 is pancreatitis risk
    low: [0, 0],            // Very low TG is fine; no lower threshold needed
    description: "Triglycerides are the primary form of stored fat and a strong marker of metabolic health. Blueprint target <80 mg/dL reflects optimal carbohydrate metabolism and insulin sensitivity. Standard labs flag ≥150 as borderline high.",
    improve: "Eliminate refined carbohydrates, sugar and fructose. Limit alcohol. Omega-3 fatty acids (EPA+DHA 2–4 g/day) can reduce triglycerides by 20–30%. Low-carb or ketogenic diet is highly effective.",
    icon: "🔻",
  },
  "ApoB": {
    category: "Lipids",
    unit: "mg/dL",
    monitorFrequency: "1y",
    // ApoB counts every atherogenic particle (LDL, VLDL, IDL, Lp(a)).
    // Blueprint target: <60 mg/dL. Normal population average ~90 mg/dL.
    optimal: [30, 60],      // Blueprint / aggressive longevity target
    sufficient: [60, 90],   // ACC/AHA acceptable threshold for moderate risk
    high: [90, 9999],       // Elevated particle burden
    low: [0, 30],           // Extremely low; possible with high-dose statin + ezetimibe
    description: "ApoB is one molecule per atherogenic particle (LDL, VLDL, IDL, Lp(a)), making it the most accurate cardiovascular risk marker. Blueprint targets <60 mg/dL — well below the standard lab upper normal of ~100 mg/dL.",
    improve: "ApoB mirrors LDL reduction strategies: reduce saturated fat, increase soluble fiber, regular aerobic exercise. Statins + ezetimibe most effective medically. PCSK9 inhibitors for refractory cases.",
    icon: "🎯",
  },
  "ApoA-1": {
    category: "Lipids",
    unit: "mg/dL",
    monitorFrequency: "1y",
    optimal: [120, 220],     // Cardioprotective; higher is better (typical normal 1.2–1.8 g/L = 120–180 mg/dL)
    sufficient: [100, 120], // Borderline low
    high: [0, 0],           // No upper limit — higher ApoA-1 is protective
    low: [0, 100],          // Low HDL particle protein — increased CV risk
    description: "ApoA-1 is the main structural protein of HDL (~65% of HDL apolipoprotein) and drives reverse cholesterol transport. Low ApoA-1 increases coronary risk; it is often a better marker than HDL-C. ApoB/ApoA-1 ratio is used in some risk scores. Blueprint-relevant in advanced lipid panels.",
    improve: "Same as HDL: aerobic exercise, quit smoking, reduce refined carbs; niacin can raise ApoA-1.",
    icon: "⬆️",
  },
  "Lp(a)": {
    category: "Lipids",
    unit: "nmol/L",
    monitorFrequency: "1y",
    // EHJ 2022 guidelines: <75 nmol/L normal, 75–125 borderline, >125 high risk.
    // Lp(a) is ~80% genetically determined.
    optimal: [0, 75],       // Low cardiovascular risk
    sufficient: [75, 125],  // Moderate risk — monitor closely
    high: [125, 9999],      // High risk — independent CV risk factor
    low: [0, 0],            // No clinical lower threshold
    description: "Lp(a) is a genetically determined LDL-like particle that independently causes atherosclerosis and thrombosis. ~20% of the population carries elevated Lp(a). Blueprint tracks this closely as it is unresponsive to most lifestyle interventions.",
    improve: "Largely genetic; diet has minimal impact. Niacin 1–2 g/day can reduce Lp(a) by 20–30%. Emerging RNA-targeting therapies (pelacarsen, olpasiran) show 80–90% reductions in trials. Low-carb diet modestly helpful.",
    icon: "🧬",
  },
  "Non-HDL Cholesterol": {
    category: "Lipids",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    calculated: true,
    optimal: [0, 130],     // Total minus HDL; target <130
    sufficient: [130, 160],
    high: [160, 9999],
    low: [0, 0],
    description: "Non-HDL cholesterol (Total Cholesterol − HDL). Reflects all atherogenic particles. Blueprint baseline and follow-up.",
    improve: "Same as LDL: reduce saturated fat, soluble fiber, exercise.",
    icon: "💧",
  },
  "LDL Particle Number": {
    category: "Lipids",
    unit: "nmol/L",
    monitorFrequency: "1y",
    optimal: [0, 1000],    // Lower is better; often 400–900 normal
    sufficient: [1000, 1500],
    high: [1500, 99999],
    low: [0, 0],
    description: "LDL particle number (NMR). More predictive than LDL-C for cardiovascular risk. Blueprint may include in advanced lipid panel.",
    improve: "Same as LDL cholesterol; statins reduce particle number.",
    icon: "🎯",
  },
  "Cholesterol/HDL Ratio": {
    category: "Lipids",
    unit: "ratio",
    monitorFrequency: "6mo",
    calculated: true,
    optimal: [0, 3.5],     // Lower CV risk
    sufficient: [3.5, 5],
    high: [5, 9999],
    low: [0, 0],
    description: "Total cholesterol divided by HDL. Cardiovascular risk marker. Blueprint baseline.",
    improve: "Lower LDL and raise HDL (exercise, niacin, reduce refined carbs).",
    icon: "💧",
  },
  "ApoB/ApoA-1 Ratio": {
    category: "Lipids",
    unit: "ratio",
    monitorFrequency: "1y",
    calculated: true,
    optimal: [0, 0.6],     // Lower atherogenic/protective ratio — lower CV risk
    sufficient: [0.6, 0.9],
    high: [0.9, 9999],     // Higher ratio = higher risk
    low: [0, 0],
    description: "ApoB ÷ ApoA-1. Single ratio of atherogenic particles to protective HDL protein; used in some CV risk scores. Lower is better. Blueprint-relevant when both ApoB and ApoA-1 are measured.",
    improve: "Lower ApoB and raise ApoA-1: same as LDL/HDL strategies (diet, exercise, niacin).",
    icon: "🎯",
  },

  // ── METABOLIC ─────────────────────────────────────────────────────────────
  "Fasting Glucose": {
    category: "Metabolic",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // ADA: Normal 70–99, prediabetes 100–125, diabetes ≥126.
    // Blueprint target: 70–90 mg/dL. Clinical hypoglycemia: <70.
    optimal: [70, 90],      // Blueprint optimal — lower ADA normal, excellent insulin sensitivity
    sufficient: [90, 100],  // ADA normal upper range — acceptable but not optimized
    high: [100, 9999],      // Prediabetes threshold (ADA: 100–125 = prediabetes)
    low: [0, 70],           // Clinical hypoglycemia — symptomatic below 70 mg/dL
    description: "Fasting glucose (no food 8–12 hrs) is the primary screening test for insulin resistance and diabetes. Blueprint targets 70–90 mg/dL — the lower half of ADA's normal range. Levels ≥100 indicate prediabetes. Clinical hypoglycemia begins below 70 mg/dL.",
    improve: "Time-restricted eating (16:8 window). Low-carbohydrate diet reduces fasting glucose reliably. Daily post-meal walks (10–15 min) significantly lower glucose response. Berberine 500 mg 2×/day. Metformin under physician supervision.",
    icon: "🍬",
  },
  "HbA1c": {
    category: "Metabolic",
    unit: "%",
    monitorFrequency: "6mo",
    // ADA: Normal <5.7%, prediabetes 5.7–6.4%, diabetes ≥6.5%.
    // Blueprint target: <5.3% reflects superior long-term glucose control.
    optimal: [4.5, 5.3],    // Blueprint optimal
    sufficient: [5.3, 5.7], // ADA normal — acceptable but not optimal
    high: [5.7, 100],       // Prediabetes range begins at 5.7%
    low: [0, 4.5],          // Very low A1c may indicate hemolytic anemia — investigate
    description: "HbA1c measures glycated hemoglobin, reflecting average blood glucose over the past 2–3 months. Blueprint targets <5.3%. The ADA 'normal' cutoff of <5.7% is too permissive for longevity optimization — each 0.1% rise increases cardiovascular risk.",
    improve: "Consistent low-carbohydrate diet is most impactful. Daily aerobic exercise (even short post-meal walks). 7–9 hours quality sleep per night. Reduce chronic stress (cortisol directly raises glucose). Metformin 500–1000 mg/day under supervision.",
    icon: "📊",
  },
  "Fasting Insulin": {
    category: "Metabolic",
    unit: "μIU/mL",
    monitorFrequency: "6mo",
    // Most labs flag >25 as high — far too permissive. Insulin resistance detectable
    // at >8–10 μIU/mL. Blueprint target: 2–6 μIU/mL.
    optimal: [2, 6],        // Blueprint optimal — excellent insulin sensitivity
    sufficient: [6, 10],    // Acceptable but early insulin resistance possible
    high: [10, 9999],       // Elevated fasting insulin = insulin resistance
    low: [0, 2],            // Very low may indicate type 1 diabetes or pancreatic insufficiency
    description: "Fasting insulin is among the earliest detectable markers of insulin resistance — often elevated for years before glucose rises. Blueprint targets 2–6 μIU/mL. Standard labs flag >25 as high, which is diagnostic of severe insulin resistance, not optimization.",
    improve: "Intermittent fasting (16:8 or 18:6) acutely lowers fasting insulin. Eliminate liquid calories: juice, soda, alcohol. Low-carb diet. Progressive resistance training improves insulin sensitivity. Lose visceral fat.",
    icon: "💉",
  },
  "HOMA-IR": {
    category: "Metabolic",
    unit: "score",
    monitorFrequency: "6mo",
    calculated: true,
    // HOMA-IR = (fasting glucose mg/dL × fasting insulin μIU/mL) / 405.
    // Clinical insulin resistance: >2.5. Optimal for longevity: <1.0.
    optimal: [0, 1.0],      // Excellent insulin sensitivity — Blueprint target
    sufficient: [1.0, 1.9], // Acceptable; mild resistance beginning above 1.5
    high: [1.9, 999],       // Insulin resistance (clinical threshold >2.5)
    low: [0, 0],            // No clinical lower threshold
    description: "HOMA-IR calculates insulin resistance from fasting glucose × fasting insulin ÷ 405. A score <1.0 reflects excellent insulin sensitivity. Standard medicine flags >2.5 as insulin resistant; Blueprint's stricter <1.0 target identifies subclinical metabolic dysfunction years earlier.",
    improve: "Improve both component markers: reduce fasting glucose and insulin through low-carb diet, intermittent fasting, resistance training, and cardiovascular exercise. Berberine mimics metformin's mechanism of action.",
    icon: "🔢",
  },

  // ── INFLAMMATION ──────────────────────────────────────────────────────────
  "hs-CRP": {
    category: "Inflammation",
    unit: "mg/L",
    monitorFrequency: "6mo",
    // AHA cardiovascular risk: <1.0 low, 1–3 average, >3 high.
    // Blueprint target: <0.5 mg/L reflects minimal systemic inflammation.
    optimal: [0, 0.5],      // Blueprint optimal — minimal chronic inflammation
    sufficient: [0.5, 1.0], // AHA low cardiovascular risk zone
    high: [1.0, 9999],      // Elevated inflammatory burden (>3 = high CV risk)
    low: [0, 0],            // No clinical lower threshold — lower is better
    description: "hs-CRP is the most widely used inflammatory biomarker. Blueprint targets <0.5 mg/L — well below the AHA's low-risk threshold of 1.0 mg/L. Chronic low-grade inflammation (often 1–3 mg/L) silently accelerates atherosclerosis, cancer, and neurodegeneration.",
    improve: "Anti-inflammatory diet: Mediterranean pattern, minimize processed foods and seed oils. Increase omega-3 intake (EPA+DHA 2–4 g/day). Regular exercise. 7–9 hours sleep. Treat periodontal disease. Lose visceral fat. Reduce chronic stress.",
    icon: "🔥",
  },
  "Rheumatoid Factor": {
    category: "Inflammation",
    unit: "IU/mL",
    monitorFrequency: "1y",
    optimal: [0, 15],
    sufficient: [15, 30],
    high: [30, 9999],
    low: [0, 0],
    description: "Rheumatoid factor (RF). Positive in rheumatoid arthritis and other conditions. Blueprint baseline.",
    improve: "Evaluate for autoimmune disease; treat underlying condition.",
    icon: "🔥",
  },
  "ANA Screen": {
    category: "Inflammation",
    unit: "titer",
    monitorFrequency: "1y",
    optimal: [0, 9999],
    sufficient: [0, 9999],
    high: [0, 0],
    low: [0, 0],
    description: "Antinuclear antibodies (ANA) screen. Positive in lupus, Sjögren's, etc. Blueprint baseline.",
    improve: "Interpret with clinician; treat underlying autoimmune condition.",
    icon: "🔥",
  },
  "Homocysteine": {
    category: "Inflammation",
    unit: "μmol/L",
    monitorFrequency: "1y",
    // Standard normal: <15 μmol/L. Blueprint and functional medicine target: <8 μmol/L.
    // Each 5 μmol/L increase raises CV risk ~20% and dementia risk substantially.
    optimal: [5, 8],        // Blueprint optimal — low cardiovascular/neurological risk
    sufficient: [8, 12],    // Acceptable — moderately elevated
    high: [12, 9999],       // Elevated risk for CVD, stroke, Alzheimer's disease
    low: [0, 5],            // Rare; possible with very high B-vitamin supplementation
    description: "Homocysteine is an inflammatory amino acid produced during methionine metabolism. Blueprint targets <8 μmol/L. Elevated homocysteine (>12 μmol/L) independently predicts cardiovascular disease, stroke, and Alzheimer's — correctable with B vitamins.",
    improve: "Methylated B vitamins: methylfolate (5-MTHF) 400–1000 mcg, methylcobalamin (B12) 1000 mcg, and pyridoxal-5-phosphate (B6) 25–50 mg/day. TMG (trimethylglycine) 1–3 g/day is also highly effective.",
    icon: "🧠",
  },
  "IL-6": {
    category: "Inflammation",
    unit: "pg/mL",
    monitorFrequency: "1y",
    // Standard lab upper normal: ~7 pg/mL. Blueprint / longevity target: <1.0 pg/mL.
    // IL-6 is a hallmark of inflammaging.
    optimal: [0, 1.0],      // Blueprint optimal — minimal inflammaging
    sufficient: [1.0, 3.0], // Acceptable background level
    high: [3.0, 9999],      // Elevated — associated with accelerated aging and disease
    low: [0, 0],            // No lower threshold — lower is better
    description: "Interleukin-6 (IL-6) is a key pro-inflammatory cytokine and hallmark of 'inflammaging' — chronic low-grade inflammation that accelerates biological aging. Blueprint targets <1.0 pg/mL. Elevated IL-6 predicts frailty, sarcopenia, and cognitive decline.",
    improve: "Regular moderate aerobic exercise paradoxically reduces chronic resting IL-6. Anti-inflammatory diet. Adequate sleep (IL-6 surges with sleep deprivation). Reduce visceral adiposity. Omega-3 supplementation 2–4 g/day.",
    icon: "⚗️",
  },

  // ── LIVER ─────────────────────────────────────────────────────────────────
  "ALT": {
    category: "Liver",
    unit: "U/L",
    monitorFrequency: "6mo",
    // Standard lab normal: men <56 U/L, women <36 U/L. Blueprint: <25 U/L.
    // ALT is liver-specific; elevation = hepatocellular damage.
    optimal: [7, 25],       // Blueprint optimal — healthy hepatocellular function
    sufficient: [25, 40],   // Acceptable — within most lab normals
    high: [40, 9999],       // Elevated — liver stress, NAFLD, alcohol, medications
    low: [0, 7],            // Very low — possible vitamin B6 deficiency
    description: "ALT (alanine aminotransferase) is liver-specific and the primary marker of hepatocellular damage. Blueprint targets <25 U/L. Elevations indicate fatty liver disease (NAFLD/NASH), alcohol damage, or medication toxicity. ALT is the best single marker of liver health.",
    improve: "Eliminate alcohol. Aggressively reduce fructose and refined carbohydrates (NAFLD reversal). Lose visceral fat (even 5–10% body weight reduction normalizes ALT). Coffee 2–4 cups/day is hepatoprotective. Vitamin E 400–800 IU for confirmed NASH.",
    icon: "🫁",
  },
  "AST": {
    category: "Liver",
    unit: "U/L",
    monitorFrequency: "6mo",
    // AST is in liver AND muscle. Standard normal: men <40 U/L, women <32 U/L.
    // Blueprint: <25 U/L. AST:ALT ratio >2 suggests alcoholic liver disease.
    optimal: [10, 25],      // Blueprint optimal
    sufficient: [25, 40],   // Within standard lab normals
    high: [40, 9999],       // Elevated — liver or muscle damage
    low: [0, 10],           // Very low — possible B6 deficiency
    description: "AST (aspartate aminotransferase) is found in liver, heart, and skeletal muscle. Blueprint targets <25 U/L. The AST:ALT ratio provides diagnostic clues: ratio >2 suggests alcoholic liver disease; ratio <1 with elevations suggests NAFLD or viral hepatitis.",
    improve: "Same as ALT: reduce alcohol and fructose, lose weight, exercise regularly. Note: intense exercise transiently raises AST from muscle — wait 48–72 hours after hard training before testing.",
    icon: "🫀",
  },
  "GGT": {
    category: "Liver",
    unit: "U/L",
    monitorFrequency: "6mo",
    // Standard normal: men <60 U/L, women <40 U/L. BUT GGT is a sensitive marker
    // of oxidative stress and metabolic syndrome even at 20–40 U/L.
    // Blueprint targets <20 U/L for optimal oxidative stress status.
    optimal: [8, 20],       // Blueprint optimal — low oxidative stress
    sufficient: [20, 40],   // Acceptable range
    high: [40, 9999],       // Elevated — oxidative stress, alcohol, fatty liver
    low: [0, 8],            // Rare; not clinically significant
    description: "GGT (gamma-glutamyl transferase) is highly sensitive to alcohol, oxidative stress, and metabolic syndrome — often elevated before other liver enzymes. Blueprint targets <20 U/L. Even mildly elevated GGT (30–50 U/L) is associated with increased all-cause mortality.",
    improve: "Reduce or eliminate alcohol (GGT's primary driver). Reduce oxidative stress: NAC 600 mg/day, glutathione precursors, milk thistle (silymarin 140 mg 3×/day). Coffee 2–4 cups/day significantly reduces GGT.",
    icon: "🧪",
  },
  "Alkaline Phosphatase": {
    category: "Liver",
    unit: "U/L",
    monitorFrequency: "6mo",
    optimal: [44, 80],      // Normal adult range (bone + liver isoenzymes)
    sufficient: [40, 120],  // Standard reference (age-dependent)
    high: [120, 9999],      // Cholestasis, bone turnover, liver disease
    low: [0, 40],           // Hypophosphatasia, malnutrition
    description: "Alkaline phosphatase (ALP) comes from liver, bone, and intestine. Blueprint includes it in baseline and follow-up. Elevated in cholestasis and bone disorders.",
    improve: "Address liver/bile duct or bone cause; ensure adequate zinc and magnesium.",
    icon: "🫁",
  },
  "Creatine Kinase": {
    category: "Liver",
    unit: "U/L",
    monitorFrequency: "6mo",
    optimal: [30, 200],      // Normal (sex and activity dependent)
    sufficient: [0, 250],   // Standard reference (higher in athletes)
    high: [250, 9999],      // Muscle damage, rhabdomyolysis, statins
    low: [0, 30],           // No clinical lower threshold
    description: "Creatine kinase (CK, S-CK) reflects muscle and cardiac damage. Blueprint tracks for baseline; elevated after intense exercise or statin use.",
    improve: "If elevated: rule out rhabdomyolysis; reduce statin dose or switch; avoid excessive eccentric exercise before draw.",
    icon: "🫀",
  },
  "Lipase": {
    category: "Liver",
    unit: "U/L",
    monitorFrequency: "1y",
    optimal: [0, 60],
    sufficient: [0, 78],
    high: [78, 9999],
    low: [0, 0],
    description: "Pancreatic lipase. Elevated in acute pancreatitis. Blueprint baseline panel.",
    improve: "Avoid alcohol; treat pancreatitis and biliary disease.",
    icon: "🫀",
  },
  "Amylase": {
    category: "Liver",
    unit: "U/L",
    monitorFrequency: "1y",
    optimal: [0, 100],
    sufficient: [0, 140],
    high: [140, 9999],
    low: [0, 0],
    description: "Amylase (pancreatic/salivary). Elevated in acute pancreatitis. Blueprint baseline.",
    improve: "Treat pancreatitis; avoid alcohol.",
    icon: "🫀",
  },
  "Bilirubin, Total": {
    category: "Liver",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    optimal: [0.2, 0.8],   // Normal — efficient conjugation and clearance
    sufficient: [0.1, 1.2], // Standard reference
    high: [1.2, 9999],      // Hemolysis, Gilbert's, liver/gallbladder disease
    low: [0, 0.1],          // No clinical significance
    description: "Total bilirubin reflects heme breakdown and liver function. Mild elevation (1–2 mg/dL) is often Gilbert's syndrome (benign). Blueprint tracks in follow-up.",
    improve: "Rule out hemolysis and liver disease; Gilbert's requires no treatment.",
    icon: "🟡",
  },

  // ── KIDNEY ────────────────────────────────────────────────────────────────
  "Creatinine": {
    category: "Kidney",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Standard male normal: 0.74–1.35 mg/dL; female: 0.59–1.04 mg/dL.
    // Creatinine rises with muscle mass, so high-muscled athletes may be 1.2–1.4 normally.
    optimal: [0.7, 1.2],    // Normal range for most adults
    sufficient: [0.6, 1.3], // Within acceptable clinical range
    high: [1.3, 9999],      // May indicate reduced kidney filtration — investigate with eGFR
    low: [0, 0.6],          // Low creatinine — possible muscle wasting or low protein intake
    description: "Creatinine is a muscle metabolism waste product filtered by kidneys. Blueprint monitors it alongside eGFR for kidney health. Important context: athletes and muscular individuals will naturally have higher creatinine (1.2–1.4 mg/dL) without kidney disease.",
    improve: "Maintain adequate hydration (2–3 L water/day). Avoid chronic NSAID use. Control blood pressure and blood sugar. Creatine supplementation transiently raises creatinine without kidney harm.",
    icon: "🫘",
  },
  "eGFR": {
    category: "Kidney",
    unit: "mL/min/1.73m²",
    monitorFrequency: "6mo",
    // CKD staging: G1 ≥90, G2 60–89, G3a 45–59, G3b 30–44, G4 15–29, G5 <15.
    // Blueprint target: >100 mL/min/1.73m² for optimal kidney reserve.
    optimal: [90, 9999],    // Normal to excellent kidney filtration
    sufficient: [59, 90],   // Mildly reduced — CKD G2 if persistent; 59–60 borderline G3
    high: [0, 0],           // High eGFR is not clinically problematic
    low: [0, 59],           // Moderately reduced — CKD G3+ requires evaluation (strictly <60)
    description: "eGFR (estimated Glomerular Filtration Rate) is the best overall measure of kidney function. Blueprint targets >100 mL/min/1.73m². Values of 60–90 may be normal for older adults but warrant monitoring; below 60 is CKD stage 3 and requires specialist evaluation.",
    improve: "Control blood pressure (<120/80). Optimize blood sugar. Stay well hydrated. Limit NSAIDs and nephrotoxic substances. SGLT2 inhibitors (empagliflozin, dapagliflozin) have proven nephroprotective effects.",
    icon: "⚡",
  },
  "BUN": {
    category: "Kidney",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Standard normal: 7–20 mg/dL. BUN rises with dehydration, high protein intake,
    // or reduced kidney function. Blueprint optimal: 10–20 mg/dL.
    optimal: [10, 20],      // Blueprint optimal range
    sufficient: [7, 25],    // Standard lab normal range
    high: [25, 9999],       // Elevated — dehydration, high protein, or reduced kidney clearance
    low: [0, 7],            // Low BUN — liver disease, malnutrition, or overhydration
    description: "BUN (blood urea nitrogen) reflects protein metabolism and kidney urea clearance. Context is critical: BUN rises with high protein intake (not a concern) and dehydration (a concern). The BUN:creatinine ratio (normal 10:1–20:1) helps distinguish causes.",
    improve: "Adequate hydration (primary driver of high BUN). If persistently elevated despite hydration, evaluate kidney function with eGFR. BUN moderately elevated on high-protein diets without kidney disease is generally benign.",
    icon: "💧",
  },
  "Cystatin C": {
    category: "Kidney",
    unit: "mg/L",
    monitorFrequency: "1y",
    optimal: [0.5, 0.9],    // Optimal kidney filtration — less muscle-dependent than creatinine
    sufficient: [0.9, 1.2],  // Acceptable
    high: [1.2, 9999],      // Reduced GFR — kidney dysfunction
    low: [0, 0.5],          // Rare; very high filtration
    description: "Cystatin C is an alternative kidney filtration marker, less influenced by muscle mass than creatinine. Blueprint uses it for a more accurate GFR estimate. Useful when creatinine is misleading (e.g. low muscle mass).",
    improve: "Same as eGFR: blood pressure control, hydration, limit nephrotoxins.",
    icon: "🫘",
  },
  "Urine Albumin": {
    category: "Kidney",
    unit: "mg/L",
    monitorFrequency: "1y",
    optimal: [0, 30],       // Normal — no significant albuminuria (when combined with urine creatinine for ACR)
    sufficient: [30, 300],  // Microalbuminuria range
    high: [300, 9999],      // Macroalbuminuria
    low: [0, 0],            // No lower threshold
    description: "Urine albumin from a spot or timed urine sample. Used with Urine Creatinine to compute Albumin-to-Creatinine Ratio (ACR).",
    improve: "Control blood pressure and blood sugar; reduce sodium; SGLT2 inhibitors when indicated.",
    icon: "🫘",
  },
  "Urine Creatinine": {
    category: "Kidney",
    unit: "mg/dL",
    monitorFrequency: "1y",
    optimal: [0, 9999],     // No single optimal; used as denominator for ACR
    sufficient: [0, 9999],
    high: [0, 0],
    low: [0, 0],
    description: "Urine creatinine from a spot or timed urine sample. Used with Urine Albumin to compute Albumin-to-Creatinine Ratio (ACR).",
    improve: "N/A — used for ACR calculation only.",
    icon: "🫘",
  },
  "Urine Protein": {
    category: "Kidney",
    unit: "mg/dL",
    monitorFrequency: "1y",
    optimal: [0, 15],       // Negative to trace
    sufficient: [15, 30],
    high: [30, 9999],      // Proteinuria
    low: [0, 0],
    description: "Urine protein (dipstick or quantitative). Blueprint urine panel. Distinct from serum Total Protein.",
    improve: "Control blood pressure and blood sugar; evaluate kidney disease.",
    icon: "🫘",
  },
  "Specific Gravity (Urine)": {
    category: "Kidney",
    unit: "ratio",
    monitorFrequency: "1y",
    optimal: [1.010, 1.025],
    sufficient: [1.005, 1.030],
    high: [1.030, 1.05],
    low: [1.0, 1.005],
    description: "Urine specific gravity reflects concentration. Blueprint urine panel.",
    improve: "Hydration; avoid dehydration or overhydration.",
    icon: "🫘",
  },
  "pH (Urine)": {
    category: "Kidney",
    unit: "pH",
    monitorFrequency: "1y",
    optimal: [5, 7],       // Normal range
    sufficient: [4.5, 8],
    high: [8, 10],
    low: [4, 4.5],
    description: "Urine pH. Blueprint urine panel. Affected by diet and kidney function.",
    improve: "Diet and hydration; evaluate if persistently extreme.",
    icon: "🫘",
  },
  "Albumin-to-Creatinine Ratio": {
    category: "Kidney",
    unit: "mg/g",
    monitorFrequency: "1y",
    calculated: true,
    optimal: [0, 30],       // Normal — no significant albuminuria
    sufficient: [30, 300],   // Microalbuminuria — early kidney/ vascular damage
    high: [300, 9999],      // Macroalbuminuria — kidney disease
    low: [0, 0],            // No lower threshold
    description: "Urine albumin-to-creatinine ratio (ACR) detects early kidney damage and cardiovascular risk. Auto-calculated from Urine Albumin and Urine Creatinine when both are present (same test).",
    improve: "Control blood pressure and blood sugar. Reduce sodium. SGLT2 inhibitors have nephroprotective effects.",
    icon: "📊",
  },
  "BUN/Creatinine Ratio": {
    category: "Kidney",
    unit: "ratio",
    monitorFrequency: "6mo",
    calculated: true,
    optimal: [10, 20],      // Normal range — adequate hydration, normal protein
    sufficient: [8, 25],    // Acceptable
    high: [25, 9999],       // Dehydration, high protein, or reduced kidney perfusion
    low: [0, 8],            // Low protein intake, liver disease, overhydration
    description: "BUN:creatinine ratio helps distinguish causes of elevated BUN (dehydration vs. kidney disease). Normal is typically 10:1–20:1. Blueprint includes it in the follow-up panel.",
    improve: "Address underlying cause: hydration for high ratio; evaluate liver/protein intake for low.",
    icon: "💧",
  },
  "Uric Acid": {
    category: "Kidney",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Standard normal: men 3.5–7.2 mg/dL; women 2.5–6.0 mg/dL.
    // Blueprint target: <5.5 mg/dL to minimize gout, kidney stones, and CVD risk.
    // Gout threshold: >6.8 mg/dL (saturation point of sodium urate).
    optimal: [3.0, 5.5],    // Blueprint optimal — minimal crystal deposition risk
    sufficient: [5.5, 6.8], // Elevated but below saturation threshold
    high: [6.8, 9999],      // Above saturation threshold — gout and kidney stone risk
    low: [0, 3.0],          // Low uric acid — xanthinuria or excess vitamin C
    description: "Uric acid is the final product of purine metabolism. Blueprint targets <5.5 mg/dL to minimize risk of gout, kidney stones, hypertension, and metabolic syndrome. Uric acid above 6.8 mg/dL reaches the crystallization threshold — this causes gout attacks.",
    improve: "Eliminate high-fructose corn syrup (primary driver of uric acid). Limit alcohol especially beer. Reduce organ meats, anchovies, sardines. Increase water intake to 3 L/day. Vitamin C 500–1000 mg/day lowers uric acid. Cherry extract also effective.",
    icon: "🔴",
  },

  // ── THYROID ───────────────────────────────────────────────────────────────
  "TSH": {
    category: "Thyroid",
    unit: "mIU/L",
    monitorFrequency: "1y",
    // Standard lab normal: 0.4–4.5 mIU/L. But functional medicine and Blueprint
    // target 0.5–2.0 mIU/L as the optimal zone. TSH >3.5 suggests subclinical hypothyroidism.
    optimal: [0.5, 2.0],    // Blueprint / functional medicine optimal
    sufficient: [2.0, 3.5], // Acceptable — subclinical hypothyroid risk above 3.0
    high: [3.5, 9999],      // Elevated — subclinical or overt hypothyroidism
    low: [0, 0.5],          // Suppressed — subclinical or overt hyperthyroidism
    description: "TSH controls thyroid hormone production. Blueprint targets 0.5–2.0 mIU/L — the lower half of the standard lab normal. TSH >2.5 mIU/L is associated with higher cardiovascular risk, fatigue, and weight gain even within the 'normal' lab range.",
    improve: "Adequate iodine (150–300 mcg/day) and selenium (200 mcg/day). Avoid thyroid-disrupting chemicals (BPA, perchlorate, fluoride excess). Ashwagandha 300–600 mg/day supports thyroid function. Rule out Hashimoto's (check TPO antibodies).",
    icon: "🦋",
  },
  "Free T3": {
    category: "Thyroid",
    unit: "pg/mL",
    monitorFrequency: "1y",
    // Standard normal (LabCorp): 2.0–4.4 pg/mL. Optimal upper range of normal.
    // Blueprint / functional: 3.0–4.2 pg/mL (mid-to-upper of normal range).
    optimal: [3.0, 4.2],    // Blueprint optimal — upper half of normal range
    sufficient: [2.3, 3.0], // Lower half of normal range — may feel suboptimal
    high: [4.2, 9999],      // Elevated — possible hyperthyroidism
    low: [0, 2.3],          // Low active thyroid hormone — hypothyroid symptoms likely
    description: "Free T3 is the biologically active thyroid hormone that enters cells and drives metabolism. Blueprint tracks this as it better reflects cellular thyroid activity than TSH alone. Low Free T3 causes fatigue, brain fog, weight gain, and hair loss even with normal TSH.",
    improve: "Selenium 200 mcg/day is essential for T4-to-T3 conversion (deiodinase enzyme). Address gut dysbiosis (gut bacteria aid T4 conversion). Zinc 15–30 mg/day. Reduce chronic cortisol (cortisol impairs T4→T3 conversion). Optimize iron (Fe deficiency impairs conversion).",
    icon: "🔄",
  },
  "Free T4": {
    category: "Thyroid",
    unit: "ng/dL",
    monitorFrequency: "1y",
    // Standard normal: 0.8–1.8 ng/dL (lab-dependent). Blueprint targets 1.0–1.8 ng/dL.
    optimal: [1.0, 1.8],    // Blueprint optimal range
    sufficient: [0.8, 1.0], // Adequate but lower end — may indicate hypothyroid tendency
    high: [1.8, 9999],      // Elevated — possible hyperthyroidism
    low: [0, 0.8],          // Low — hypothyroid (primary or secondary)
    description: "Free T4 is the primary thyroid hormone produced by the thyroid gland, stored and converted to active T3 in peripheral tissues. Blueprint monitors both T4 and T3 since poor T4→T3 conversion is common and missed by TSH testing alone.",
    improve: "Adequate dietary iodine (seaweed, iodized salt) for T4 production. Selenium 200 mcg/day. Tyrosine 500 mg/day (T4 = iodinated tyrosine). Avoid excessive goitrogens (raw cruciferous vegetables in large amounts if hypothyroid).",
    icon: "🧬",
  },
  "TPO Antibodies": {
    category: "Thyroid",
    unit: "IU/mL",
    monitorFrequency: "1y",
    optimal: [0, 9],        // Negative — no Hashimoto's
    sufficient: [9, 35],   // Borderline / low positive
    high: [35, 9999],       // Positive — Hashimoto's thyroiditis
    low: [0, 0],            // No lower threshold
    description: "Thyroid peroxidase (TPO) antibodies indicate autoimmune thyroid disease (Hashimoto's). Blueprint baseline panel. Positive result explains hypothyroidism and guides management.",
    improve: "Selenium 200 mcg/day may reduce antibody titers; treat hypothyroidism if present.",
    icon: "🦋",
  },
  "Thyroglobulin Antibodies": {
    category: "Thyroid",
    unit: "IU/mL",
    monitorFrequency: "1y",
    optimal: [0, 1],        // Negative
    sufficient: [0, 4],     // Low positive
    high: [4, 9999],        // Positive — autoimmune thyroid disease
    low: [0, 0],            // No lower threshold
    description: "Thyroglobulin antibodies are another marker of autoimmune thyroid disease. Blueprint baseline. Often elevated with TPO antibodies in Hashimoto's.",
    improve: "Interpret with TPO and TSH; optimize selenium and treat thyroid dysfunction.",
    icon: "🦋",
  },

  // ── HORMONES ──────────────────────────────────────────────────────────────
  "Total Testosterone": {
    category: "Hormones",
    unit: "ng/dL",
    monitorFrequency: "1y",
    // Standard male normal: 264–916 ng/dL (varies by lab). Blueprint targets the
    // upper quartile: 700–1100 ng/dL for peak vitality and longevity.
    optimal: [700, 1100],   // Blueprint / top quartile male range
    sufficient: [400, 700], // Adequate but not optimized
    high: [1100, 9999],     // Supraphysiological — likely exogenous TRT
    low: [0, 400],          // Hypogonadism threshold — symptoms likely
    description: "Total testosterone drives muscle mass, bone density, libido, cognition, mood, and cardiovascular health in men. Blueprint targets the upper quartile (700–1100 ng/dL). Standard labs flag <300 as deficient, but symptoms of low testosterone appear at levels below 400–500 ng/dL.",
    improve: "Resistance training 3–5×/week (most effective). Optimize sleep (testosterone peaks during REM sleep). Reduce visceral fat. Ensure adequate zinc, magnesium, and vitamin D. Reduce alcohol and chronic stress. Consider TRT under physician supervision if persistently below 400 ng/dL.",
    icon: "💪",
  },
  "Free Testosterone": {
    category: "Hormones",
    unit: "pg/mL",
    monitorFrequency: "1y",
    calculated: true,
    // Adult male reference (calculated/dialysis, 18+): 32–168 pg/mL (UIowa, Endocrine Society–aligned).
    // Blueprint targets upper-normal; deficiency <32 pg/mL.
    optimal: [70, 150],    // Blueprint target — upper reference range (robust)
    sufficient: [32, 70],   // Lower normal — acceptable
    high: [150, 9999],      // Above optimal; >168 is above lab reference
    low: [0, 32],           // Below reference — hypogonadism / high SHBG
    description: "Free testosterone is the biologically active fraction unbound to SHBG or albumin. Reference range for adult men (calculated, e.g. Vermeulen): 32–168 pg/mL. Often more clinically relevant than total testosterone; two men can have the same total T but very different free T if SHBG differs.",
    improve: "Reduce SHBG to liberate more free testosterone: resistance training, adequate dietary fat, moderate carbohydrate intake. Boron 6–10 mg/day demonstrably reduces SHBG. Address insulin resistance.",
    icon: "⚡",
  },
  "PSA": {
    category: "Hormones",
    unit: "ng/mL",
    monitorFrequency: "1y",
    gender: "male",
    optimal: [0, 2.5],      // Low prostate cancer risk
    sufficient: [2.5, 4],  // Gray zone — monitor
    high: [4, 9999],       // Elevated — further workup
    low: [0, 0],
    description: "Prostate-specific antigen (PSA) total. Used for prostate health screening. Blueprint measures this in men only (baseline).",
    improve: "Discuss elevated PSA with a urologist. Diet and lifestyle can modestly affect PSA.",
    icon: "🫘",
  },
  "Free PSA": {
    category: "Hormones",
    unit: "ng/mL",
    monitorFrequency: "1y",
    gender: "male",
    optimal: [0, 9999],
    sufficient: [0, 9999],
    high: [0, 0],
    low: [0, 0],
    description: "Free (unbound) PSA. Used with total PSA to calculate PSA % Free (free/total ratio) for prostate cancer risk stratification.",
    improve: "N/A — interpret with total PSA.",
    icon: "🫘",
  },
  "PSA % Free": {
    category: "Hormones",
    unit: "%",
    monitorFrequency: "1y",
    gender: "male",
    optimal: [15, 100],    // Higher % free = lower cancer probability
    sufficient: [10, 15],
    high: [0, 0],
    low: [0, 10],         // Low % free associated with higher cancer risk
    description: "Percentage of PSA that is free (unbound). Lower values may warrant further evaluation. Blueprint: men only.",
    improve: "Interpret with urologist in context of total PSA and clinical findings.",
    icon: "🫘",
  },
  "AMH": {
    category: "Hormones",
    unit: "ng/mL",
    monitorFrequency: "1y",
    gender: "female",
    optimal: [1.0, 4.0],   // Good ovarian reserve (age-dependent)
    sufficient: [0.5, 1.0],
    high: [4.0, 9999],
    low: [0, 0.5],         // Low ovarian reserve
    description: "Anti-Müllerian hormone reflects ovarian reserve (egg supply). Used for fertility and menopause context. Blueprint measures this in women only (baseline).",
    improve: "Low AMH: discuss fertility options with a specialist. No proven way to increase ovarian reserve.",
    icon: "🌸",
  },
  "DHEA-S": {
    category: "Hormones",
    unit: "μg/dL",
    monitorFrequency: "1y",
    // Male reference by age: 30–40 yr: 138–475 μg/dL; 40–50 yr: 102–416 μg/dL.
    // Blueprint supplements DHEA to maintain levels of a young adult (~250–450 μg/dL).
    optimal: [250, 450],    // Blueprint target — youthful DHEA-S levels
    sufficient: [150, 500], // Adequate — within standard adult male reference
    high: [500, 9999],      // Above typical adult range
    low: [0, 150],          // Low DHEA-S — adrenal fatigue or aging
    description: "DHEA-S is the most abundant adrenal steroid and a precursor to testosterone and estrogen. Levels peak at age 25 and decline ~2% per year. Blueprint supplements DHEA to maintain levels associated with youthful vitality. Low DHEA-S is strongly linked to accelerated aging.",
    improve: "DHEA supplementation 25–50 mg/day (consult physician — affects downstream hormones). Manage chronic stress (cortisol and DHEA compete for the same precursor). Resistance training. Adequate sleep. Ashwagandha 300–600 mg/day supports adrenal function.",
    icon: "🌟",
  },
  "IGF-1": {
    category: "Hormones",
    unit: "ng/mL",
    monitorFrequency: "1y",
    // Standard normal (adults): 94–252 ng/mL (age-dependent). Blueprint maintains
    // mid-range: ~150–200 ng/mL. Too high (>250) linked to cancer risk;
    // too low (<100) linked to sarcopenia, frailty, and poor tissue repair.
    optimal: [140, 200],    // Blueprint optimal — balanced longevity zone
    sufficient: [100, 250], // Below or above Blueprint optimal but not dangerously elevated
    high: [250, 9999],      // Elevated — excess growth signaling, potential cancer risk
    low: [0, 100],          // Low — impaired tissue repair, sarcopenia risk
    description: "IGF-1 mediates growth hormone's anabolic effects on muscle, bone, and brain. Blueprint deliberately targets mid-range (140–200 ng/mL): high IGF-1 activates mTOR and is linked to increased cancer risk; low IGF-1 accelerates sarcopenia and neurodegeneration. Balance is key.",
    improve: "Protein intake 1.6–2.2 g/kg/day elevates IGF-1. Resistance training acutely stimulates IGF-1. Intermittent fasting temporarily lowers IGF-1 (potentially longevity-beneficial). Quality sleep (GH pulses during deep sleep). Zinc deficiency reduces IGF-1.",
    icon: "📈",
  },
  "Estradiol": {
    category: "Hormones",
    unit: "pg/mL",
    monitorFrequency: "1y",
    // Standard male normal: 10–40 pg/mL. Blueprint targets 20–35 pg/mL:
    // enough for bone health and libido, not so high as to cause gynecomastia.
    optimal: [20, 35],      // Blueprint optimal for men — balanced range
    sufficient: [10, 50],   // Low-normal or mildly elevated — watch but not critical
    high: [50, 9999],       // Elevated — gynecomastia, water retention, libido issues
    low: [0, 10],           // Very low — joint pain, bone loss, cardiovascular risk
    description: "Estradiol (E2) is the primary estrogen. Men need physiological estradiol for bone density, cardiovascular health, cognitive function, and libido. Too little causes bone loss and joint pain; too much (>50 pg/mL) causes gynecomastia and suppresses testosterone.",
    improve: "For high E2: lose visceral fat (aromatase enzyme is concentrated in fat). Reduce alcohol. DIM (diindolylmethane) from cruciferous vegetables helps estrogen metabolism. Zinc 30 mg/day has mild aromatase-inhibiting effect. For low E2: optimize testosterone levels first.",
    icon: "⚖️",
  },
  "SHBG": {
    category: "Hormones",
    unit: "nmol/L",
    monitorFrequency: "1y",
    // Standard male normal: 10–57 nmol/L (highly age-dependent — rises with age).
    // Blueprint targets 20–40 nmol/L: binds enough to buffer hormones, not so high
    // as to reduce free testosterone.
    optimal: [20, 40],      // Blueprint optimal — balanced free hormone availability
    sufficient: [14, 55],   // Within standard adult male reference range
    high: [55, 9999],       // High SHBG — significantly reduces free testosterone
    low: [0, 14],           // Low SHBG — associated with metabolic syndrome, insulin resistance
    description: "SHBG (sex hormone binding globulin) binds testosterone and estradiol, making them inactive. High SHBG (>55 nmol/L) leaves too little free testosterone even if total T is normal. Low SHBG (<14 nmol/L) is a marker of insulin resistance and metabolic syndrome.",
    improve: "To lower SHBG: resistance training, adequate carbohydrate intake, reduce excessive fasting, boron 6–10 mg/day, zinc 30 mg/day. To raise SHBG: increase aerobic exercise, optimize thyroid (low T3 reduces SHBG).",
    icon: "🔗",
  },
  "Prolactin": {
    category: "Hormones",
    unit: "ng/mL",
    monitorFrequency: "1y",
    optimal: [4, 15],       // Normal adult (non-pregnant)
    sufficient: [2, 25],    // Standard reference (sex-dependent)
    high: [25, 9999],       // Prolactinoma, hypothyroidism, medications
    low: [0, 2],            // Rare; pituitary insufficiency
    description: "Prolactin is secreted by the pituitary. Blueprint baseline. Elevated prolactin suppresses gonadotropins and can cause low libido and fertility issues.",
    improve: "Rule out prolactinoma and hypothyroidism; review medications (e.g. antipsychotics).",
    icon: "📊",
  },
  "FSH": {
    category: "Hormones",
    unit: "mIU/mL",
    monitorFrequency: "1y",
    optimal: [2, 8],        // Normal adult male / premenopausal female (cycle-dependent)
    sufficient: [1, 12],    // Broad reference (interpret with LH and sex)
    high: [12, 9999],       // Primary gonadal failure, menopause
    low: [0, 1],            // Hypothalamic/pituitary suppression
    description: "Follicle-stimulating hormone (FSH) from pituitary. Blueprint baseline. With LH, assesses gonadal axis. Interpretation is sex and age dependent.",
    improve: "Address underlying cause (e.g. ovarian/testicular, pituitary).",
    icon: "📈",
  },
  "LH": {
    category: "Hormones",
    unit: "mIU/mL",
    monitorFrequency: "1y",
    optimal: [2, 9],        // Normal adult (sex and cycle dependent)
    sufficient: [1, 12],    // Broad reference
    high: [12, 9999],       // Primary gonadal failure, menopause
    low: [0, 1],            // Hypothalamic/pituitary suppression
    description: "Luteinizing hormone (LH) from pituitary. Blueprint baseline. With FSH, evaluates reproductive axis and testosterone/estrogen production.",
    improve: "Interpret with FSH and sex steroids; treat underlying cause.",
    icon: "📈",
  },
  "Progesterone": {
    category: "Hormones",
    unit: "ng/mL",
    monitorFrequency: "1y",
    gender: "female",
    optimal: [0, 1],        // Follicular phase; luteal 5–20
    sufficient: [0, 25],     // Cycle-dependent
    high: [25, 9999],       // Pregnancy, luteal phase, tumors
    low: [0, 0],             // Interpret with cycle phase
    description: "Progesterone (S-Progesteron). Female reproductive hormone; Blueprint tracks in comprehensive panels for women. Interpret with cycle phase.",
    improve: "Address ovarian function; interpret with clinician.",
    icon: "📈",
  },
  "Free Testosterone Index": {
    category: "Hormones",
    unit: "ratio",
    monitorFrequency: "1y",
    optimal: [0, 9999],     // Lab- and sex-dependent
    sufficient: [0, 9999],
    high: [0, 0],
    low: [0, 0],
    description: "Free testosterone index (Fri Testosteron indeks): calculated ratio (e.g. Total T / SHBG × 100 or similar). Reflects bioavailable testosterone. Blueprint-relevant when reported by lab.",
    improve: "Interpret with Total Testosterone and SHBG.",
    icon: "📈",
  },
  "Cortisol": {
    category: "Hormones",
    unit: "μg/dL",
    monitorFrequency: "1y",
    // Morning cortisol (drawn 7–9 AM): standard normal 6–23 μg/dL.
    // Blueprint targets 10–18 μg/dL — adequate adrenal function without excess.
    optimal: [10, 18],      // Blueprint optimal — adequate morning cortisol
    sufficient: [6, 23],    // Standard lab normal range (morning fasting)
    high: [23, 9999],       // Elevated — chronic stress, Cushing's syndrome
    low: [0, 6],            // Low morning cortisol — adrenal insufficiency risk
    description: "Morning cortisol (tested 7–9 AM fasting) reflects adrenal function and stress load. Blueprint targets 10–18 μg/dL. Chronically elevated cortisol suppresses the immune system, promotes insulin resistance, reduces testosterone, and accelerates telomere shortening.",
    improve: "Stress management: mindfulness, breathwork, cold exposure (brief). Ashwagandha (KSM-66) 300 mg twice/day reduces cortisol by 27–30%. Phosphatidylserine 400 mg/day for exercise-induced cortisol. Rhodiola rosea 400 mg/day. Prioritize 7–9 hours sleep.",
    icon: "😰",
  },
  "Leptin": {
    category: "Hormones",
    unit: "ng/mL",
    monitorFrequency: "1y",
    optimal: [2, 8],
    sufficient: [0, 15],
    high: [15, 9999],
    low: [0, 2],
    description: "Leptin (satiety hormone). Elevated in obesity (leptin resistance). Blueprint baseline.",
    improve: "Weight loss, sleep, reduce inflammation.",
    icon: "⚖️",
  },

  // ── COMPLETE BLOOD COUNT ──────────────────────────────────────────────────
  "WBC": {
    category: "Complete Blood Count",
    unit: "×10³/μL",
    monitorFrequency: "6mo",
    // Standard normal: 4.5–11.0 ×10³/μL. Blueprint targets the lower-normal range
    // (4.5–7.0) as a sign of low chronic inflammation.
    optimal: [4.5, 7.0],    // Blueprint optimal — low inflammatory burden
    sufficient: [3.5, 10.5], // Within lab normal range
    high: [10.5, 9999],     // Elevated — infection, inflammation, or hematological disorder
    low: [0, 3.5],          // Low — possible immune suppression, B12/folate deficiency
    description: "WBC (white blood cell count) reflects immune system activity. Blueprint targets the lower end of normal (4.5–7.0 ×10³/μL) as chronically high-normal WBC is associated with systemic inflammation and increased all-cause mortality risk.",
    improve: "Support immune homeostasis: adequate zinc, vitamin D3 (60–80 ng/mL), vitamin C, selenium. Manage chronic infections. Maintain gut microbiome diversity. Avoid immunosuppressive medications unless necessary.",
    icon: "🛡️",
  },
  "RBC": {
    category: "Complete Blood Count",
    unit: "×10⁶/μL",
    monitorFrequency: "6mo",
    // Standard: men 4.7–6.1; women 4.2–5.4 ×10⁶/μL. Using a combined range:
    optimal: [4.5, 5.8],    // Normal-to-optimal for most adults
    sufficient: [4.0, 6.1], // Full standard reference range
    high: [6.1, 9999],      // Polycythemia risk — dehydration, altitude, EPO abuse
    low: [0, 4.0],          // Anemia territory
    description: "Red blood cells carry oxygen via hemoglobin. RBC count reflects oxygen-carrying capacity and is a key indicator of anemia or polycythemia. Blueprint monitors RBC as part of complete hematological assessment for longevity and performance.",
    improve: "Ensure adequate iron (ferritin >50), vitamin B12 (>500 pg/mL), folate, and vitamin B6 for RBC synthesis. Erythropoiesis depends on adequate protein. Address blood loss sources if anemic.",
    icon: "🔴",
  },
  "Hemoglobin": {
    category: "Complete Blood Count",
    unit: "g/dL",
    monitorFrequency: "6mo",
    // Standard: men 13.5–17.5 g/dL; women 12.0–15.5 g/dL. Using inclusive range:
    optimal: [13.5, 17.0],  // Normal healthy range for most adults
    sufficient: [12.0, 17.5], // Full standard reference (includes women)
    high: [17.5, 9999],     // Elevated — polycythemia vera, dehydration, altitude adaptation
    low: [0, 12.0],         // Anemia — impaired oxygen delivery
    description: "Hemoglobin carries oxygen within red blood cells. Blueprint monitors hemoglobin as a key marker of oxygen-carrying capacity, energy levels, and exercise performance. Hemoglobin <12 g/dL (anemia) significantly impairs cognition, endurance, and tissue repair.",
    improve: "Iron supplementation if ferritin <30 ng/mL. Methylcobalamin (B12) 1000 mcg/day. Methylfolate 400–1000 mcg/day. Adequate dietary protein (hemoglobin synthesis requires amino acids). Vitamin C with iron-rich meals enhances absorption.",
    icon: "💗",
  },
  "Hematocrit": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    // Standard: men 41–53%; women 36–46%. Combined range:
    optimal: [40, 50],      // Normal for most adults
    sufficient: [36, 53],   // Full standard reference range
    high: [53, 9999],       // Elevated — polycythemia, dehydration
    low: [0, 36],           // Low — anemia
    description: "Hematocrit is the percentage of blood volume occupied by red blood cells, closely correlated with hemoglobin. It reflects oxygen-carrying capacity and blood viscosity. Very high hematocrit (>52%) increases clot risk; very low causes anemia symptoms.",
    improve: "See hemoglobin improvement strategies. Adequate hydration is important — dehydration artificially elevates hematocrit. Iron, B12, and folate are the primary nutritional drivers.",
    icon: "🩸",
  },
  "Platelets": {
    category: "Complete Blood Count",
    unit: "×10³/μL",
    monitorFrequency: "6mo",
    // Standard normal: 150–400 ×10³/μL. Blueprint optimal: 175–350 ×10³/μL.
    optimal: [175, 350],    // Optimal clotting function without thrombocytosis
    sufficient: [150, 400], // Standard lab reference range
    high: [400, 9999],      // Thrombocytosis — reactive or clonal cause
    low: [0, 150],          // Thrombocytopenia — bleeding risk
    description: "Platelets are small cell fragments essential for blood clotting. Blueprint monitors platelet count as part of comprehensive hematological assessment. Low platelets (<150) increase bleeding risk; high platelets (>400) increase thrombosis risk and often indicate underlying inflammation.",
    improve: "Low platelets: rule out autoimmune causes, optimize B12, folate, and iron. High platelets: identify and treat underlying inflammation or iron deficiency. Omega-3 supplementation has mild anti-platelet aggregation effects.",
    icon: "🩺",
  },
  "RDW": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    optimal: [11.5, 13.5],  // Normal red cell size variation
    sufficient: [11, 15],   // Standard reference
    high: [15, 9999],       // Anisocytosis — iron/B12/folate deficiency, hemolysis
    low: [0, 11],           // Rare
    description: "Red cell distribution width (RDW) measures variation in RBC size. Elevated RDW is an early marker of anemia (iron, B12, folate) and is associated with mortality risk. Blueprint includes it in baseline and follow-up.",
    improve: "Address underlying deficiency: iron, B12, or folate as indicated.",
    icon: "📏",
  },
  "MCV": {
    category: "Complete Blood Count",
    unit: "fL",
    monitorFrequency: "6mo",
    optimal: [80, 100],     // Normocytic — healthy RBC size
    sufficient: [80, 100],  // Standard reference
    high: [100, 9999],      // Macrocytosis — B12/folate deficiency, hypothyroidism
    low: [0, 80],           // Microcytosis — iron deficiency, thalassemia
    description: "Mean corpuscular volume (MCV) is average red blood cell size. Blueprint tracks it to classify anemia and screen for B12/folate or iron deficiency.",
    improve: "Correct underlying deficiency; treat hypothyroidism if relevant.",
    icon: "⭕",
  },
  "MCH": {
    category: "Complete Blood Count",
    unit: "pg",
    monitorFrequency: "6mo",
    optimal: [27, 33],      // Normal hemoglobin content per RBC
    sufficient: [26, 34],    // Standard reference
    high: [34, 9999],       // Macrocytic anemia
    low: [0, 26],           // Microcytic/hypochromic — iron deficiency
    description: "Mean corpuscular hemoglobin (MCH) is average hemoglobin per red cell. Used with MCV and MCHC to classify anemia. Blueprint includes in follow-up panel.",
    improve: "Address iron, B12, or folate deficiency as indicated.",
    icon: "🔴",
  },
  "MCHC": {
    category: "Complete Blood Count",
    unit: "g/dL",
    monitorFrequency: "6mo",
    optimal: [32, 36],      // Normal hemoglobin concentration
    sufficient: [32, 36],   // Standard reference
    high: [36, 9999],       // Spherocytosis, hemolysis
    low: [0, 32],           // Iron deficiency, thalassemia
    description: "Mean corpuscular hemoglobin concentration (MCHC). With MCV and MCH, helps differentiate types of anemia. Blueprint follow-up panel.",
    improve: "Iron repletion if low; evaluate hemolysis if high.",
    icon: "🔬",
  },
  "MPV": {
    category: "Complete Blood Count",
    unit: "fL",
    monitorFrequency: "6mo",
    optimal: [7.5, 11.5],   // Normal platelet size
    sufficient: [7, 12],    // Standard reference
    high: [12, 9999],       // High turnover — inflammation, ITP
    low: [0, 7],            // Low production — bone marrow suppression
    description: "Mean platelet volume (MPV) reflects platelet size and turnover. Elevated MPV can indicate inflammation or cardiovascular risk. Blueprint baseline and follow-up.",
    improve: "Address underlying inflammation or hematologic cause.",
    icon: "🩺",
  },
  "Neutrophils": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    optimal: [40, 60],      // Normal proportion
    sufficient: [40, 70],   // Standard reference (percent)
    high: [70, 9999],       // Infection, stress, inflammation
    low: [0, 40],           // Viral infection, autoimmune, drug-induced
    description: "Neutrophil percentage (or absolute count) from CBC differential. Blueprint tracks WBC differential for immune and inflammatory context.",
    improve: "Treat underlying infection or inflammation; avoid offending drugs.",
    icon: "🛡️",
  },
  "Lymphocytes": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    optimal: [20, 40],      // Normal proportion
    sufficient: [20, 45],   // Standard reference
    high: [45, 9999],       // Viral infection, lymphoproliferative
    low: [0, 20],           // Immunosuppression, steroid use
    description: "Lymphocyte percentage from CBC differential. Part of Blueprint's complete blood count with differential.",
    improve: "Address infection or immunosuppression; optimize sleep and stress.",
    icon: "🛡️",
  },
  "Monocytes": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    optimal: [2, 8],        // Normal range
    sufficient: [2, 10],    // Standard reference
    high: [10, 9999],       // Chronic inflammation, recovery from infection
    low: [0, 2],            // Rare
    description: "Monocyte percentage from CBC differential. Blueprint includes in baseline and follow-up panels.",
    improve: "Address chronic inflammation or infection.",
    icon: "🛡️",
  },
  "Eosinophils": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    optimal: [0, 4],        // Normal
    sufficient: [0, 5],     // Standard reference
    high: [5, 9999],        // Allergy, parasites, drug reaction
    low: [0, 0],            // No clinical lower threshold
    description: "Eosinophil percentage from CBC differential. Elevation suggests allergy, parasites, or drug reaction. Blueprint follow-up.",
    improve: "Identify and remove allergen or parasite; review medications.",
    icon: "🛡️",
  },
  "Basophils": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    optimal: [0, 1],        // Normal — usually <1%
    sufficient: [0, 2],     // Standard reference
    high: [2, 9999],        // Myeloproliferative, hypothyroidism
    low: [0, 0],            // No clinical lower threshold
    description: "Basophil percentage from CBC differential. Blueprint baseline and follow-up panel.",
    improve: "Evaluate for myeloproliferative disorder or thyroid dysfunction if elevated.",
    icon: "🛡️",
  },
  "Band Neutrophils": {
    category: "Complete Blood Count",
    unit: "%",
    monitorFrequency: "6mo",
    optimal: [0, 5],       // Bands usually 0–5%
    sufficient: [0, 8],
    high: [8, 9999],       // Left shift — infection
    low: [0, 0],
    description: "Band neutrophils (immature neutrophils). Elevated in bacterial infection (left shift). Blueprint CBC differential.",
    improve: "Treat underlying infection.",
    icon: "🛡️",
  },
  "Neutrophils (Absolute)": {
    category: "Complete Blood Count",
    unit: "10⁹/L",
    monitorFrequency: "6mo",
    optimal: [1.5, 5.5],    // Normal absolute count
    sufficient: [1.0, 7.0], // Standard reference
    high: [7.0, 9999],
    low: [0, 1.0],          // Neutropenia
    description: "Neutrophil absolute count (10⁹/L). When the lab reports differential as absolute counts instead of %, use this. Blueprint tracks WBC differential.",
    improve: "Address infection or inflammation; avoid offending drugs.",
    icon: "🛡️",
  },
  "Lymphocytes (Absolute)": {
    category: "Complete Blood Count",
    unit: "10⁹/L",
    monitorFrequency: "6mo",
    optimal: [1.0, 3.5],
    sufficient: [0.8, 4.0],
    high: [4.0, 9999],
    low: [0, 0.8],          // Lymphopenia
    description: "Lymphocyte absolute count (10⁹/L). Extract when report gives absolute counts for differential.",
    improve: "Address immune cause.",
    icon: "🛡️",
  },
  "Monocytes (Absolute)": {
    category: "Complete Blood Count",
    unit: "10⁹/L",
    monitorFrequency: "6mo",
    optimal: [0.2, 0.8],
    sufficient: [0.1, 1.0],
    high: [1.0, 9999],
    low: [0, 0.1],
    description: "Monocyte absolute count (10⁹/L). Extract when report gives absolute counts.",
    improve: "Address chronic inflammation or infection.",
    icon: "🛡️",
  },
  "Eosinophils (Absolute)": {
    category: "Complete Blood Count",
    unit: "10⁹/L",
    monitorFrequency: "6mo",
    optimal: [0, 0.4],
    sufficient: [0, 0.5],
    high: [0.5, 9999],
    low: [0, 0],
    description: "Eosinophil absolute count (10⁹/L). Extract when report gives absolute counts.",
    improve: "Identify allergen or parasite.",
    icon: "🛡️",
  },
  "Basophils (Absolute)": {
    category: "Complete Blood Count",
    unit: "10⁹/L",
    monitorFrequency: "6mo",
    optimal: [0, 0.1],
    sufficient: [0, 0.2],
    high: [0.2, 9999],
    low: [0, 0],
    description: "Basophil absolute count (10⁹/L). Extract when report gives absolute counts.",
    improve: "Evaluate if elevated.",
    icon: "🛡️",
  },

  // ── PROTEINS ──────────────────────────────────────────────────────────────
  "Total Protein": {
    category: "Proteins",
    unit: "g/dL",
    monitorFrequency: "6mo",
    optimal: [6.0, 7.5],   // Normal serum total protein
    sufficient: [6.0, 8.3], // Standard reference
    high: [8.3, 9999],      // Dehydration, monoclonal gammopathy
    low: [0, 6.0],          // Malnutrition, liver disease, kidney loss
    description: "Serum total protein reflects albumin and globulins. Blueprint includes it in baseline and follow-up. Low levels suggest malnutrition or liver/kidney disease.",
    improve: "Adequate protein intake; address liver/kidney or malabsorption.",
    icon: "🧪",
  },
  "Albumin": {
    category: "Proteins",
    unit: "g/dL",
    monitorFrequency: "6mo",
    optimal: [4.0, 5.0],   // Blueprint optimal — robust protein status
    sufficient: [3.5, 5.0], // Standard reference
    high: [5.0, 9999],      // Dehydration (relative)
    low: [0, 3.5],          // Liver disease, malnutrition, kidney loss, inflammation
    description: "Serum albumin is the main circulating protein; marker of nutrition and liver function. Blueprint targets upper-normal range. Low albumin predicts mortality.",
    improve: "Adequate protein intake (1.2–1.6 g/kg); treat liver/kidney disease.",
    icon: "🥛",
  },
  "Globulin": {
    category: "Proteins",
    unit: "g/dL",
    monitorFrequency: "6mo",
    calculated: true,
    optimal: [2.0, 3.0],   // Normal range
    sufficient: [2.0, 3.5], // Standard reference
    high: [3.5, 9999],      // Chronic inflammation, infection, monoclonal gammopathy
    low: [0, 2.0],          // Immunodeficiency, liver disease
    description: "Globulins (total protein minus albumin). Elevated in chronic inflammation. Blueprint follow-up includes albumin/globulin ratio.",
    improve: "Address chronic inflammation or infection.",
    icon: "🧪",
  },
  "Albumin/Globulin Ratio": {
    category: "Proteins",
    unit: "ratio",
    monitorFrequency: "6mo",
    calculated: true,
    optimal: [1.2, 2.2],   // Normal A/G
    sufficient: [1.0, 2.5],
    high: [2.5, 9999],
    low: [0, 1.0],
    description: "Albumin divided by globulin. Blueprint baseline (Albumin/Globulin Ratio).",
    improve: "Address liver or inflammatory cause.",
    icon: "🧪",
  },

  // ── VITAMINS & MINERALS ───────────────────────────────────────────────────
  "Vitamin D": {
    category: "Vitamins & Minerals",
    unit: "ng/mL",
    monitorFrequency: "1y",
    // Endocrine Society: deficiency <20, insufficiency 20–30, sufficient 30–40, optimal 40–80.
    // WHOOP optimal: 40–80 ng/mL. AHA/NIH sufficient: >30. Toxicity risk >100 ng/mL.
    optimal: [40, 80],      // Endocrine Society / WHOOP consensus optimal zone
    sufficient: [30, 100],  // Sufficient: covers 30–40 (below optimal) and 80–100 (above, not yet toxic)
    high: [100, 9999],      // Toxicity territory — hypercalcemia risk above 100 ng/mL
    low: [0, 30],           // Deficient — immune dysfunction, bone loss, cardiovascular risk
    description: "Vitamin D3 is a steroid hormone regulating 3,000+ genes including immune function, bone metabolism, muscle strength, and cancer suppression. The Endocrine Society defines optimal as 40–80 ng/mL — consistent with WHOOP's reference ranges. About 70% of people are below 30 ng/mL (deficient). Toxicity risk becomes relevant above 100 ng/mL.",
    improve: "Sun exposure 15–30 min/day on large body surface area. Vitamin D3 supplementation: 4,000–8,000 IU/day to reach 40–80 ng/mL. Always pair with vitamin K2 (MK-7) 100–200 mcg/day to direct calcium to bones. Magnesium activates vitamin D — supplement both.",
    icon: "☀️",
  },
  "Total B12": {
    category: "Vitamins & Minerals",
    unit: "pg/mL",
    monitorFrequency: "1y",
    // Standard lab lower cutoff: 200 pg/mL. Functional deficiency can occur 200–400.
    // Blueprint / functional medicine optimal: 600–2000 pg/mL.
    // Note: Total B12 includes inactive analogues; Active B12 (holoTC) is more specific.
    optimal: [600, 2000],   // Blueprint / functional optimal — neurological protection zone
    sufficient: [200, 600], // Standard lab normal — adequate but below functional target
    high: [2000, 99999],    // Very high — investigate if not supplementing; possible liver disease
    low: [0, 200],          // Deficiency — neurological and hematological risk
    description: "Total B12 measures all cobalamin forms in serum including inactive analogues. Blueprint targets 600–2000 pg/mL — well above the standard lab lower cutoff of 200 pg/mL. Neurological damage occurs at levels many labs consider 'normal' (200–400 pg/mL). Combine with Active B12 (holoTC) for a complete picture.",
    improve: "Methylcobalamin or adenosylcobalamin (not cyanocobalamin) 1000–5000 mcg/day sublingually or by injection for fastest repletion. Dietary sources: meat, fish, eggs, dairy. Vegans must supplement. Metformin depletes B12 — monitor closely. If total B12 is normal but symptoms persist, check Active B12.",
    icon: "🔵",
  },
  "Active B12": {
    category: "Vitamins & Minerals",
    unit: "pmol/L",
    monitorFrequency: "1y",
    // Active B12 = holotranscobalamin (holoTC) — the only form taken up by cells.
    // Most specific functional marker of true B12 status.
    // Reference ranges (NHS / NICE / ECLIA): deficient <35, borderline 35–75, normal >75.
    // Functional / Blueprint optimal: >100 pmol/L.
    optimal: [100, 9999],   // Robustly replete — excellent functional B12 status
    sufficient: [50, 100],  // NHS normal but below functional target — worth monitoring
    high: [0, 0],           // No upper threshold — higher is fine in routine testing
    low: [0, 50],           // Deficient active B12 — tissue-level depletion even if total B12 normal
    description: "Active B12 (holotranscobalamin / holoTC) is the only form of B12 cells can actually absorb — it makes up only 10–30% of total serum B12. It's the earliest and most sensitive marker of functional B12 deficiency, detecting depletion before total B12 falls below lab reference ranges. Critical for methylation, nerve conduction, and DNA synthesis.",
    improve: "Same as Total B12: methylcobalamin 1000–5000 mcg/day. Active B12 responds faster to supplementation than total B12. If active B12 is low despite normal total B12, it suggests poor cellular uptake — check for TCII (transcobalamin II) receptor gene variants. Methylcobalamin is superior to cyanocobalamin for raising holoTC.",
    icon: "💠",
  },
  "Folate": {
    category: "Vitamins & Minerals",
    unit: "ng/mL",
    monitorFrequency: "1y",
    // Standard reference: 3.1–20.5 ng/mL (varies widely by lab).
    // Blueprint targets >10 ng/mL for optimal methylation and homocysteine control.
    optimal: [10, 25],      // Blueprint optimal — robust methylation cycle support
    sufficient: [5, 10],    // Adequate — meets basic metabolic needs
    high: [25, 9999],       // Very high — possible with aggressive supplementation
    low: [0, 5],            // Deficient — neural tube defects, elevated homocysteine, anemia
    description: "Folate (vitamin B9) is the master regulator of the methylation cycle, critical for DNA synthesis, repair, and methylation. Blueprint targets >10 ng/mL. Low folate elevates homocysteine, impairs cell division, and is strongly linked to neural tube defects and cognitive decline.",
    improve: "Methylfolate (5-MTHF) 400–1000 mcg/day — avoid folic acid (synthetic form less effective, especially if MTHFR variant). Leafy greens, legumes, asparagus, avocado are top food sources. Test MTHFR C677T and A1298C variants to determine optimal dose.",
    icon: "🌿",
  },
  "Iron": {
    category: "Vitamins & Minerals",
    unit: "μg/dL",
    monitorFrequency: "6mo",
    // Standard male normal: 60–170 μg/dL; women: 37–145 μg/dL. Serum iron
    // fluctuates diurnally — ferritin is a better iron status marker.
    optimal: [80, 140],     // Blueprint optimal range
    sufficient: [60, 160],  // Standard lab reference range
    high: [160, 9999],      // Elevated — iron overload or hemochromatosis
    low: [0, 60],           // Iron deficiency — impaired oxygen transport
    description: "Serum iron reflects circulating iron but fluctuates up to 30% throughout the day. Best interpreted alongside ferritin (storage) and TIBC (transport capacity). Blueprint monitors iron as part of comprehensive nutritional assessment. Ferritin is a more reliable marker of iron stores.",
    improve: "Iron from heme sources (red meat, oysters) is 2–3× more bioavailable than plant iron. Vitamin C 500 mg with non-heme iron meals doubles absorption. Avoid calcium, tannins (tea/coffee), and phytates with iron-rich meals or supplements.",
    icon: "⚙️",
  },
  "TIBC": {
    category: "Vitamins & Minerals",
    unit: "μg/dL",
    monitorFrequency: "1y",
    optimal: [250, 400],    // Total iron-binding capacity
    sufficient: [250, 450],
    high: [450, 9999],      // Iron deficiency (elevated TIBC)
    low: [0, 250],          // Chronic disease, iron overload
    description: "Total iron-binding capacity. Used with serum iron for Iron Saturation (Iron/TIBC×100). Blueprint baseline.",
    improve: "Interpret with Iron and Ferritin; treat underlying cause.",
    icon: "⚙️",
  },
  "Methylmalonic Acid": {
    category: "Vitamins & Minerals",
    unit: "nmol/L",
    monitorFrequency: "1y",
    optimal: [0, 250],      // Normal; elevated in B12 deficiency
    sufficient: [250, 400],
    high: [400, 9999],      // B12 deficiency (functional)
    low: [0, 0],
    description: "Methylmalonic acid (MMA). Rises in B12 deficiency before serum B12 falls. Blueprint baseline panel.",
    improve: "B12 supplementation; recheck MMA after repletion.",
    icon: "🔵",
  },
  "Iron Saturation": {
    category: "Vitamins & Minerals",
    unit: "%",
    monitorFrequency: "1y",
    calculated: true,
    optimal: [20, 45],      // Normal transferrin saturation
    sufficient: [15, 50],
    high: [50, 9999],       // Iron overload
    low: [0, 15],           // Iron deficiency
    description: "Iron saturation (Iron ÷ TIBC × 100). Blueprint baseline (Iron % Saturation).",
    improve: "Interpret with Iron and Ferritin; treat deficiency or overload.",
    icon: "⚙️",
  },
  "Ferritin": {
    category: "Vitamins & Minerals",
    unit: "ng/mL",
    monitorFrequency: "6mo",
    // Standard: men 24–336 ng/mL (wide range). Blueprint targets 50–150 ng/mL:
    // enough to prevent iron deficiency; not so high as to drive oxidative stress.
    // Ferritin above 200 is an independent cardiovascular risk factor.
    optimal: [50, 150],     // Blueprint optimal — adequate storage, minimal oxidative risk
    sufficient: [30, 200],  // Within reasonable clinical range
    high: [200, 9999],      // Elevated — iron overload, or ferritin as acute phase reactant
    low: [0, 30],           // Iron depletion — fatigue, hair loss, impaired thyroid function
    description: "Ferritin is the primary iron storage protein and the most reliable marker of iron status. Blueprint targets 50–150 ng/mL. Critically, ferritin above 200 ng/mL is an independent cardiovascular risk factor — excess iron drives oxidative stress (Fenton reaction).",
    improve: "Low ferritin: iron supplementation (ferrous bisglycinate for best tolerance), increase dietary heme iron, treat blood loss causes. High ferritin: regular blood donation is most effective; reduce red meat if non-inflammatory elevation; rule out hereditary hemochromatosis.",
    icon: "🔩",
  },
  "Magnesium": {
    category: "Vitamins & Minerals",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    // Standard serum normal: 1.7–2.2 mg/dL (some labs 1.6–2.6). Note: serum reflects
    // only ~1% of total body magnesium — RBC magnesium is more accurate.
    // Blueprint targets the upper end of normal: 2.0–2.5 mg/dL.
    optimal: [2.0, 2.5],    // Blueprint optimal — upper normal range
    sufficient: [1.7, 2.0], // Lower normal range — may be functionally deficient
    high: [2.5, 9999],      // Elevated — hypermagnesemia (rare without kidney disease)
    low: [0, 1.7],          // Hypomagnesemia — cramps, arrhythmias, insulin resistance
    description: "Magnesium is a cofactor in 300+ enzymatic reactions including ATP production, DNA synthesis, and neuromuscular function. About 45% of people are deficient. Serum magnesium is insensitive — consider RBC magnesium for accuracy. Blueprint supplements magnesium routinely.",
    improve: "Magnesium glycinate (sleep/anxiety) or magnesium L-threonate (cognitive function) 200–400 mg/day. Dietary sources: pumpkin seeds, leafy greens, almonds, dark chocolate. Reduce alcohol and refined foods (deplete magnesium). Vitamin D increases magnesium demand.",
    icon: "💊",
  },
  "Zinc": {
    category: "Vitamins & Minerals",
    unit: "μg/dL",
    monitorFrequency: "1y",
    // Standard normal: 60–130 μg/dL. Blueprint optimal 90–130 μg/dL.
    // Zinc >130 μg/dL from supplementation can impair copper absorption.
    optimal: [90, 130],     // Blueprint optimal — immune and hormonal support
    sufficient: [70, 90],   // Adequate but below optimal
    high: [130, 9999],      // Excess — impairs copper absorption (anemia risk)
    low: [0, 70],           // Deficiency — immune dysfunction, low testosterone
    description: "Zinc is essential for immune function (200+ enzymes), testosterone biosynthesis, wound healing, taste/smell, and cognitive function. Blueprint supplements zinc regularly. Deficiency is common in vegetarians, vegans, the elderly, and those with gut malabsorption.",
    improve: "Zinc picolinate or bisglycinate 15–30 mg/day with food (reduces nausea). Top food sources: oysters (#1 by far), beef, pumpkin seeds, hemp seeds. Balance with copper: take 1–2 mg copper for every 15–30 mg zinc supplemented to prevent copper deficiency.",
    icon: "⚡",
  },
  "Vitamin A": {
    category: "Vitamins & Minerals",
    unit: "μg/dL",
    monitorFrequency: "1y",
    optimal: [30, 80],      // Normal — adequate retinol
    sufficient: [20, 100],  // Standard reference
    high: [100, 9999],       // Toxicity risk — liver, bone
    low: [0, 20],            // Deficiency — vision, immune
    description: "Serum vitamin A (retinol). Blueprint tracks fat-soluble vitamins. Deficiency affects vision and immunity; excess is toxic.",
    improve: "Dietary retinol (liver, eggs) or beta-carotene (vegetables). Avoid megadoses.",
    icon: "🥕",
  },
  "Thiamine (B1)": {
    category: "Vitamins & Minerals",
    unit: "nmol/L",
    monitorFrequency: "1y",
    optimal: [70, 180],     // Adequate (lab-dependent)
    sufficient: [70, 200],  // Standard reference
    high: [200, 9999],      // Supplementation
    low: [0, 70],            // Deficiency — beriberi, Wernicke
    description: "Thiamine (B1) is essential for energy metabolism. Blueprint includes B vitamins in comprehensive panels. Deficiency common in alcohol use and refined diets.",
    improve: "Thiamine 100 mg/day; whole grains, legumes, pork.",
    icon: "🌾",
  },
  "Riboflavin (B2)": {
    category: "Vitamins & Minerals",
    unit: "μg/dL",
    monitorFrequency: "1y",
    optimal: [4, 24],       // Normal (lab-dependent)
    sufficient: [4, 24],    // Standard reference
    high: [24, 9999],       // Supplementation
    low: [0, 4],            // Deficiency — fatigue, mouth sores
    description: "Riboflavin (B2) supports energy and antioxidant systems. Blueprint tracks B vitamins for longevity optimization.",
    improve: "Riboflavin 25–50 mg/day; dairy, eggs, leafy greens.",
    icon: "🥬",
  },
  "Vitamin B3 (Niacin)": {
    category: "Vitamins & Minerals",
    unit: "mg/dL",
    monitorFrequency: "1y",
    optimal: [0.5, 8.5],    // Normal (lab-dependent)
    sufficient: [0.5, 8.5], // Standard reference
    high: [8.5, 9999],      // Supplementation
    low: [0, 0.5],          // Deficiency — pellagra
    description: "Niacin (B3) supports NAD+ and lipid metabolism. Blueprint tracks for cardiovascular and metabolic context.",
    improve: "Niacin from diet (meat, fish) or supplementation; monitor liver with high dose.",
    icon: "💊",
  },
  "Vitamin B6": {
    category: "Vitamins & Minerals",
    unit: "ng/mL",
    monitorFrequency: "1y",
    optimal: [5, 50],       // Adequate (pyridoxal-5-phosphate)
    sufficient: [5, 50],    // Standard reference
    high: [50, 9999],       // Excess — neuropathy risk
    low: [0, 5],            // Deficiency — anemia, neurological
    description: "Vitamin B6 (pyridoxal-5-phosphate) is critical for amino acid metabolism and homocysteine. Blueprint tracks B vitamins.",
    improve: "P-5-P 25–50 mg/day; avoid very high doses (neuropathy).",
    icon: "🔬",
  },
  "Biotin (B7)": {
    category: "Vitamins & Minerals",
    unit: "ng/L",
    monitorFrequency: "1y",
    optimal: [200, 500],    // Normal (lab-dependent)
    sufficient: [200, 500], // Standard reference
    high: [500, 9999],      // Supplementation
    low: [0, 200],          // Deficiency — rare; hair/skin/nails
    description: "Biotin (B7) supports metabolism and hair/skin health. Blueprint includes in comprehensive panels. Note: biotin supplements can interfere with some lab assays.",
    improve: "Biotin 2.5–5 mg/day if deficient; eggs, nuts, avocado.",
    icon: "💇",
  },
  "Vitamin C": {
    category: "Vitamins & Minerals",
    unit: "mg/dL",
    monitorFrequency: "1y",
    optimal: [0.4, 2.0],    // Adequate (0.4–2.0 mg/dL serum)
    sufficient: [0.2, 2.0], // Standard reference
    high: [2.0, 9999],      // Supplementation
    low: [0, 0.2],          // Deficiency — scurvy
    description: "Serum vitamin C. Blueprint tracks for antioxidant and immune support. Deficiency is common in smokers and low fruit/vegetable intake.",
    improve: "Vitamin C 500–1000 mg/day; citrus, berries, bell peppers.",
    icon: "🍊",
  },
  "Vitamin E (Alpha-Tocopherol)": {
    category: "Vitamins & Minerals",
    unit: "mg/L",
    monitorFrequency: "1y",
    optimal: [5, 20],       // Normal (lab-dependent)
    sufficient: [5, 20],    // Standard reference
    high: [20, 9999],       // Supplementation — bleeding risk at very high
    low: [0, 5],            // Deficiency — rare; neuropathy
    description: "Alpha-tocopherol (vitamin E) is the main fat-soluble antioxidant. Blueprint tracks fat-soluble vitamins.",
    improve: "Vitamin E from nuts, seeds, leafy greens; supplement with mixed tocopherols if needed.",
    icon: "🌿",
  },
  "PIVKA-II": {
    category: "Vitamins & Minerals",
    unit: "mAU/mL",
    monitorFrequency: "1y",
    optimal: [0, 40],       // Normal — adequate vitamin K
    sufficient: [0, 40],    // Standard reference (DCP / PIVKA-II)
    high: [40, 9999],       // Vitamin K deficiency, liver disease
    low: [0, 0],            // No lower threshold
    description: "PIVKA-II (des-gamma-carboxy prothrombin) is a marker of vitamin K status and liver function. Blueprint tracks for K status.",
    improve: "Vitamin K2 (MK-7) 100–200 mcg/day; leafy greens (K1).",
    icon: "🩸",
  },
  "Calcium": {
    category: "Vitamins & Minerals",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    optimal: [9.0, 10.0],   // Normal ionized equivalent (total Ca ~9–10.5)
    sufficient: [8.6, 10.2], // Standard reference
    high: [10.2, 9999],      // Hyperparathyroidism, malignancy
    low: [0, 8.6],           // Hypoparathyroidism, vitamin D deficiency
    description: "Serum total calcium. Blueprint includes in baseline and follow-up. When the lab reports both total and corrected, also extract Corrected Calcium.",
    improve: "Adequate vitamin D and dietary calcium; treat underlying cause.",
    icon: "🦴",
  },
  "Corrected Calcium": {
    category: "Vitamins & Minerals",
    unit: "mg/dL",
    monitorFrequency: "6mo",
    optimal: [9.0, 10.0],   // Same reference as total; corrected for albumin
    sufficient: [8.6, 10.2],
    high: [10.2, 9999],
    low: [0, 8.6],
    description: "Albumin-corrected calcium (S-Kalsium korrigert). Preferred for interpretation when albumin is abnormal. Blueprint-relevant when reported.",
    improve: "Interpret with total calcium and albumin; adequate vitamin D and dietary calcium.",
    icon: "🦴",
  },
  "Chloride": {
    category: "Vitamins & Minerals",
    unit: "mEq/L",
    monitorFrequency: "6mo",
    optimal: [98, 106],     // Normal electrolyte
    sufficient: [98, 106],  // Standard reference
    high: [106, 9999],      // Dehydration, renal tubular acidosis
    low: [0, 98],           // Vomiting, diuretics, metabolic alkalosis
    description: "Serum chloride. Part of basic metabolic panel. Blueprint follow-up.",
    improve: "Address hydration and acid-base balance.",
    icon: "🧪",
  },
  "Sodium": {
    category: "Vitamins & Minerals",
    unit: "mEq/L",
    monitorFrequency: "6mo",
    optimal: [136, 142],   // Normal
    sufficient: [136, 145],  // Standard reference
    high: [145, 9999],      // Dehydration, diabetes insipidus
    low: [0, 136],          // Overhydration, SIADH, diuretics
    description: "Serum sodium. Blueprint baseline and follow-up. Key electrolyte for fluid balance.",
    improve: "Hydration and diet; correct underlying cause of dysnatremia.",
    icon: "💧",
  },
  "Potassium": {
    category: "Vitamins & Minerals",
    unit: "mEq/L",
    monitorFrequency: "6mo",
    optimal: [4.0, 5.0],    // Normal
    sufficient: [3.5, 5.0], // Standard reference
    high: [5.0, 9999],      // Kidney disease, supplements, potassium-sparing diuretics
    low: [0, 3.5],          // Diuretics, vomiting, hypokalemia
    description: "Serum potassium. Blueprint baseline and follow-up. Critical for cardiac and muscle function.",
    improve: "Dietary potassium (avocado, banana, spinach); correct cause of imbalance.",
    icon: "🍌",
  },
  "Carbon Dioxide": {
    category: "Vitamins & Minerals",
    unit: "mEq/L",
    monitorFrequency: "6mo",
    optimal: [23, 29],      // Normal bicarbonate
    sufficient: [23, 29],   // Standard reference (CO2 = bicarbonate)
    high: [29, 9999],       // Metabolic alkalosis
    low: [0, 23],           // Metabolic acidosis, kidney disease
    description: "Serum CO2 (bicarbonate). Part of metabolic panel. Blueprint follow-up.",
    improve: "Address acid-base disorder and kidney function.",
    icon: "💨",
  },
  "Serum pH": {
    category: "Vitamins & Minerals",
    unit: "pH",
    monitorFrequency: "1y",
    optimal: [7.35, 7.45],   // Normal arterial/venous
    sufficient: [7.32, 7.48], // Slight deviation
    high: [7.48, 9999],      // Alkalosis
    low: [0, 7.32],          // Acidosis
    description: "Blood/serum pH (from blood gas or venous). Normal 7.35–7.45. Track when reported; often from critical care or metabolic panels.",
    improve: "Address acid-base cause (respiratory vs metabolic); interpret with CO2 and bicarbonate.",
    icon: "🧪",
  },
  "Phosphate": {
    category: "Vitamins & Minerals",
    unit: "mg/dL",
    monitorFrequency: "1y",
    optimal: [3.0, 4.5],    // Normal
    sufficient: [2.5, 4.5], // Standard reference
    high: [4.5, 9999],      // Kidney disease, hypoparathyroidism
    low: [0, 2.5],          // Refeeding, hyperparathyroidism, deficiency
    description: "Serum phosphate. Essential for bone, energy (ATP). Blueprint tracks minerals.",
    improve: "Dietary phosphate (dairy, nuts); correct underlying cause.",
    icon: "⚗️",
  },
  "Chromium": {
    category: "Vitamins & Minerals",
    unit: "μg/L",
    monitorFrequency: "1y",
    optimal: [0.1, 2.0],    // Normal (lab-dependent)
    sufficient: [0.1, 2.0], // Standard reference
    high: [2.0, 9999],      // Supplementation
    low: [0, 0.1],          // Deficiency — glucose metabolism
    description: "Chromium supports insulin sensitivity. Blueprint tracks trace minerals in comprehensive panels.",
    improve: "Chromium picolinate 200–400 mcg/day if deficient; broccoli, whole grains.",
    icon: "⚙️",
  },
  "Copper": {
    category: "Vitamins & Minerals",
    unit: "μg/dL",
    monitorFrequency: "1y",
    optimal: [70, 140],    // Normal (plasma/serum)
    sufficient: [70, 140],  // Standard reference
    high: [140, 9999],      // Wilson's, supplementation
    low: [0, 70],           // Zinc excess, malabsorption
    description: "Copper is essential for enzymes and iron metabolism. Balance with zinc. Blueprint baseline.",
    improve: "Balance zinc and copper (1–2 mg Cu per 15–30 mg Zn if supplementing).",
    icon: "🟤",
  },
  "Manganese": {
    category: "Vitamins & Minerals",
    unit: "μg/L",
    monitorFrequency: "1y",
    optimal: [4, 15],       // Normal (whole blood or plasma)
    sufficient: [4, 15],    // Standard reference
    high: [15, 9999],       // Toxicity — occupational, well water
    low: [0, 4],            // Deficiency — rare
    description: "Manganese is a trace mineral for bone and metabolism. Blueprint tracks in comprehensive panels.",
    improve: "Dietary sources (nuts, whole grains); avoid excess supplementation.",
    icon: "⚗️",
  },
  "Selenium": {
    category: "Vitamins & Minerals",
    unit: "μg/L",
    monitorFrequency: "1y",
    optimal: [100, 150],    // Adequate (serum/plasma)
    sufficient: [70, 150],  // Standard reference
    high: [150, 9999],      // Toxicity risk
    low: [0, 70],           // Deficiency — thyroid, immune
    description: "Selenium is essential for thyroid (deiodinases), antioxidant enzymes, and immune function. Blueprint tracks for longevity.",
    improve: "Brazil nuts (1–2/day) or selenium 200 mcg/day.",
    icon: "🌰",
  },
  "Iodine": {
    category: "Vitamins & Minerals",
    unit: "μg/L",
    monitorFrequency: "1y",
    optimal: [100, 199],    // Sufficient (urine or serum)
    sufficient: [100, 300],  // WHO adequate (urine)
    high: [300, 9999],       // Excess — thyroid dysfunction
    low: [0, 100],           // Deficiency — goiter, hypothyroidism
    description: "Iodine is essential for thyroid hormone synthesis. Blueprint tracks for thyroid optimization.",
    improve: "Iodized salt, seaweed, or potassium iodide 150 mcg/day if deficient.",
    icon: "🧂",
  },
  "CoQ10": {
    category: "Vitamins & Minerals",
    unit: "μg/mL",
    monitorFrequency: "1y",
    optimal: [0.5, 2.0],    // Normal (plasma; statin users may be lower)
    sufficient: [0.4, 2.0], // Standard reference
    high: [2.0, 9999],      // Supplementation
    low: [0, 0.4],          // Statins, aging, deficiency
    description: "Coenzyme Q10 supports mitochondrial energy and is an antioxidant. Depleted by statins. Blueprint tracks for cardiovascular and cellular health.",
    improve: "CoQ10 (ubiquinol) 100–200 mg/day, especially on statins.",
    icon: "⚡",
  },
  "Omega-3 Total": {
    category: "Vitamins & Minerals",
    unit: "%",
    monitorFrequency: "1y",
    optimal: [8, 15],       // Omega-3 index (RBC %); target 8%+
    sufficient: [6, 8],
    high: [15, 9999],
    low: [0, 6],
    description: "Omega-3 fatty acids (EPA+DHA+DPA) as % of total fatty acids (Omega-3 index). Blueprint baseline.",
    improve: "EPA+DHA 2–4 g/day from fish oil or algae.",
    icon: "🐟",
  },
  "Omega-6 Total": {
    category: "Vitamins & Minerals",
    unit: "%",
    monitorFrequency: "1y",
    optimal: [0, 9999],
    sufficient: [0, 9999],
    high: [0, 0],
    low: [0, 0],
    description: "Omega-6 fatty acids as % of total. Blueprint baseline; interpret with Omega-3 and ratio.",
    improve: "Reduce refined seed oils; balance with omega-3.",
    icon: "🐟",
  },
  "Omega-6/Omega-3 Ratio": {
    category: "Vitamins & Minerals",
    unit: "ratio",
    monitorFrequency: "1y",
    optimal: [1, 4],        // Lower ratio = less inflammation
    sufficient: [4, 10],
    high: [10, 9999],
    low: [0, 1],
    description: "Ratio of omega-6 to omega-3. Western diets often 15:1; Blueprint targets lower.",
    improve: "Increase omega-3; reduce omega-6 (seed oils).",
    icon: "🐟",
  },
  "EPA+DPA+DHA": {
    category: "Vitamins & Minerals",
    unit: "%",
    monitorFrequency: "1y",
    optimal: [8, 15],       // Combined as % (similar to Omega-3 index)
    sufficient: [6, 8],
    high: [15, 9999],
    low: [0, 6],
    description: "EPA plus DPA plus DHA (combined omega-3). Blueprint baseline; often reported with fatty acid panel.",
    improve: "Fish oil or algae oil 2–4 g EPA+DHA daily.",
    icon: "🐟",
  },
  "Lead": {
    category: "Vitamins & Minerals",
    unit: "μg/dL",
    monitorFrequency: "1y",
    optimal: [0, 3],        // Minimal exposure
    sufficient: [3, 5],
    high: [5, 9999],        // CDC action level 5 μg/dL (adults)
    low: [0, 0],
    description: "Blood lead. Blueprint may include in environmental toxins panel.",
    improve: "Remove exposure (water, paint, occupational); chelation if elevated.",
    icon: "⚠️",
  },
  "Mercury": {
    category: "Vitamins & Minerals",
    unit: "μg/L",
    monitorFrequency: "1y",
    optimal: [0, 5],       // Low exposure
    sufficient: [5, 10],
    high: [10, 9999],       // EPA reference 5.8 μg/L
    low: [0, 0],
    description: "Blood mercury. Blueprint baseline (Mercury, Blood). Fish consumption and amalgams.",
    improve: "Limit high-mercury fish; consider amalgam removal if high.",
    icon: "⚠️",
  },
  "Glutathione": {
    category: "Vitamins & Minerals",
    unit: "μmol/L",
    monitorFrequency: "1y",
    optimal: [2.0, 5.0],    // Normal (whole blood or RBC; lab-dependent)
    sufficient: [1.5, 5.0], // Standard reference
    high: [5.0, 9999],      // Supplementation / antioxidant support
    low: [0, 1.5],          // Oxidative stress, aging, liver burden
    description: "Glutathione is the master cellular antioxidant. Blueprint tracks for oxidative stress and liver health.",
    improve: "NAC 600 mg/day, glycine, selenium; reduce alcohol and toxins.",
    icon: "🛡️",
  },

  // ── CARDIOVASCULAR ────────────────────────────────────────────────────────
  "Blood Pressure Systolic": {
    category: "Cardiovascular",
    unit: "mmHg",
    monitorFrequency: "3mo",
    // ACC/AHA 2017: Normal <120, Elevated 120–129, Stage 1 HTN 130–139, Stage 2 ≥140.
    // Blueprint target: <120 mmHg (the ACC/AHA "normal" threshold).
    optimal: [100, 120],    // Blueprint optimal — normal range
    sufficient: [120, 130], // Elevated — cardiovascular risk begins increasing
    high: [130, 9999],      // Stage 1+ hypertension
    low: [0, 100],          // Hypotension — clinical hypotension <90; 90–99 is low-normal (optimal starts at 100)
    description: "Systolic blood pressure is the peak arterial pressure during cardiac contraction. Blueprint targets <120 mmHg (ACC/AHA 'normal'). Hypertension is the single largest modifiable risk factor for cardiovascular disease, stroke, and kidney disease globally.",
    improve: "DASH diet (high potassium, low sodium): reduce sodium to <1500 mg/day. Increase potassium to 4700 mg/day from vegetables and fruits. Aerobic exercise 150+ min/week. Beet root/nitrates, hibiscus tea, L-citrulline, and CoQ10 have clinical evidence for reduction.",
    icon: "❤️",
  },
  "Blood Pressure Diastolic": {
    category: "Cardiovascular",
    unit: "mmHg",
    monitorFrequency: "3mo",
    // ACC/AHA: Normal <80, Stage 1 HTN 80–89, Stage 2 ≥90.
    // Blueprint target: <80 mmHg.
    optimal: [60, 80],      // Blueprint optimal — ACC/AHA normal range
    sufficient: [80, 90],   // Stage 1 hypertension range — elevated risk
    high: [90, 9999],       // Stage 2 hypertension — clinical intervention needed
    low: [0, 60],           // Hypotension — impaired organ perfusion
    description: "Diastolic blood pressure is the arterial pressure between heartbeats, reflecting vascular tone and resistance. Blueprint targets <80 mmHg. Isolated diastolic hypertension (≥90 with normal systolic) is common in younger adults and warrants treatment.",
    improve: "Same as systolic: reduce sodium, increase potassium and magnesium. Aerobic exercise. Stress management. Reduce alcohol to <1 drink/day. Quit smoking. Magnesium glycinate 400 mg/day has documented antihypertensive effects.",
    icon: "💓",
  },
  "Resting Heart Rate": {
    category: "Cardiovascular",
    unit: "bpm",
    monitorFrequency: "3mo",
    // Normal range: 60–100 bpm. Fit athletes: 40–60 bpm. Blueprint targets fit range.
    // RHR >80 bpm associated with increased all-cause mortality.
    optimal: [40, 65],      // Blueprint optimal — cardiovascular fitness range
    sufficient: [65, 80],   // Normal range — acceptable
    high: [80, 9999],       // Elevated — poor cardiovascular fitness or autonomic dysfunction
    low: [0, 40],           // Severe bradycardia — evaluate for cardiac conduction block
    description: "Resting heart rate reflects cardiovascular efficiency and autonomic nervous system balance. Blueprint targets 40–65 bpm. Each 10 bpm increase in resting HR above 65 is associated with ~14% increase in all-cause mortality risk. Athletes commonly achieve 40–55 bpm.",
    improve: "Zone 2 aerobic training (conversational pace) 150+ min/week is the primary driver of RHR reduction. Progressive aerobic fitness over months/years. Weight loss reduces resting HR. Reduce caffeine after 2 PM. Improve sleep quality (HRV and RHR improve together).",
    icon: "💗",
  },

  // ── LONGEVITY ─────────────────────────────────────────────────────────────
  "VO2 Max": {
    category: "Longevity",
    unit: "mL/kg/min",
    monitorFrequency: "1y",
    // ACSM age-adjusted percentiles (men, all ages combined as approximate guide):
    // Very poor/Poor <33 · Fair 33–42 · Good 42–52 · Excellent 52–62 · Elite/Athlete >62
    // Blueprint target: ≥50 (top quartile); "elite" ≥60 represents athlete-level fitness.
    // Higher is always better — no true upper limit. Using "high" slot as Elite zone.
    eliteZone: true,          // Repurposes the "high" band as "Elite" rather than a risk zone
    optimal: [42, 60],        // Good to Excellent — Blueprint target range
    sufficient: [33, 42],     // Fair to Good — meaningful protection, still below target
    high: [60, 9999],         // Elite / Athlete — exceptional cardiovascular capacity
    low: [0, 33],             // Poor / Very poor — significantly elevated mortality risk
    description: "VO2 Max is the gold standard measure of cardiorespiratory fitness and the strongest predictor of all-cause mortality. ACSM classifies 42–52 as 'Good', 52–62 as 'Excellent', and >62 as 'Elite'. Blueprint targets ≥50 (top quartile). Moving from 'Low' to 'Sufficient' reduces all-cause mortality risk by ~45% — larger than any drug effect.",
    improve: "Zone 2 steady-state cardio (conversational pace, 150–200 min/week) builds aerobic base. Norwegian 4×4 intervals (4 min at 90–95% max HR × 4 sets, 2×/week) raise VO2 Max ~10% in 8 weeks. Combine both modalities. Each 1 mL/kg/min increase corresponds to ~1% mortality risk reduction.",
    icon: "🫁",
  },
  "Grip Strength": {
    category: "Longevity",
    unit: "kg",
    monitorFrequency: "3mo",
    // Average men 40–50: ~44–52 kg (dominant hand, dynamometer).
    // Blueprint targets maximal grip strength >50 kg for men.
    optimal: [50, 9999],    // Blueprint target — strong longevity signal
    sufficient: [38, 50],   // Adequate — within normal adult male range
    high: [0, 0],           // Higher is always better — no upper threshold
    low: [0, 38],           // Low grip strength — predictor of frailty and early mortality
    description: "Grip strength is a reliable proxy for total body strength and one of the most consistent predictors of all-cause mortality and disability-free life years. Each 5 kg reduction in grip strength corresponds to a 17% increase in cardiovascular mortality. Blueprint tracks this as a core longevity biomarker.",
    improve: "Progressive compound resistance training: deadlifts, rows, pull-ups, loaded carries (farmer's walks). Direct grip work: plate pinches, thick bar training, wrist curls. Creatine monohydrate 5 g/day. Adequate protein 1.6–2.2 g/kg/day to support muscle mass.",
    icon: "✊",
  },
  "Bone Mineral Density": {
    category: "Longevity",
    unit: "T-score",
    monitorFrequency: "1y",
    // WHO criteria: Normal T ≥ -1.0; Osteopenia -2.5 to -1.0; Osteoporosis < -2.5.
    // Blueprint targets T-score > -0.5 (solidly normal, upper half of normal range).
    optimal: [-0.5, 9],       // Blueprint optimal — upper half of normal bone density
    sufficient: [-1.0, -0.5], // Normal per WHO but below Blueprint target
    high: [0, 0],             // No upper threshold — higher T-score is always better
    low: [-9, -1.01],         // Osteopenia (<−1.0) or osteoporosis (<−2.5)
    description: "Bone mineral density measured by DEXA scan (T-score vs. young adult peak). Blueprint targets T-score > -0.5. Osteoporosis (T-score < -2.5) dramatically increases fracture risk, and hip fractures have 20–30% 1-year mortality in the elderly.",
    improve: "Weight-bearing exercise and progressive resistance training are the primary drivers of bone density. Adequate calcium from food (1000–1200 mg/day). Vitamin D3 60–80 ng/mL. Vitamin K2 (MK-7) 200 mcg/day directs calcium to bone. Collagen peptides 10 g/day. Reduce alcohol.",
    icon: "🦴",
  },
};
