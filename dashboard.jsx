import { useState, useEffect, useCallback, useRef } from "react";
import { ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Area, AreaChart } from "recharts";

// ─── BIOMARKER DATABASE ───────────────────────────────────────────────────────
// Ranges: Blueprint Biomarkers (blueprintbiomarkers.com) does not publish numeric reference
// ranges publicly; we use Blueprint-inspired targets + peer-reviewed clinical thresholds.
// optimal  = Blueprint target zone; sufficient = acceptable; high/low = out of range.
// monitorFrequency: "6mo" = follow-up panel, "1y" = baseline (per blueprintbiomarkers.com).
// gender: optional "male" | "female" — only that sex sees the marker (Blueprint: men = PSA; women = AMH).
const BIOMARKER_DB = {
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
    description: "Serum calcium. Blueprint includes in baseline and follow-up. Best interpreted with albumin and vitamin D.",
    improve: "Adequate vitamin D and dietary calcium; treat underlying cause.",
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

const CATEGORIES = [...new Set(Object.values(BIOMARKER_DB).map(b => b.category))];

// Biomarkers applicable to this person's gender. No gender or "Other" => all; Male => exclude female-only; Female => exclude male-only.
function getBiomarkersForPerson(person) {
  const all = Object.keys(BIOMARKER_DB);
  if (!person?.gender || person.gender === "Other") return all;
  const personGender = (person.gender || "").toLowerCase();
  return all.filter(name => {
    const g = BIOMARKER_DB[name].gender;
    return !g || (g && g.toLowerCase() === personGender);
  });
}

// Derived biomarkers: computed from others when components exist. Only set if not already in data.
// All derived values are computed from the SAME test only (same entry/date) — never mix dates.
// Order matters: values are read from `out`, so e.g. Globulin (from Total Protein, Albumin) is available for Albumin/Globulin Ratio.
const DERIVED_BIOMARKERS = {
  "Non-HDL Cholesterol": {
    from: ["Total Cholesterol", "HDL Cholesterol"],
    formula: (total, hdl) => {
      const t = Number(total);
      const h = Number(hdl);
      if (!Number.isFinite(t) || !Number.isFinite(h)) return null;
      const v = t - h;
      return v >= 0 && Number.isFinite(v) ? v : null;
    },
    unit: "mg/dL",
  },
  "HOMA-IR": {
    from: ["Fasting Glucose", "Fasting Insulin"],
    formula: (glucose, insulin) => (glucose * insulin) / 405,
    unit: "score",
  },
  "BUN/Creatinine Ratio": {
    from: ["BUN", "Creatinine"],
    formula: (bun, creat) => (creat != null && Number(creat) !== 0 ? Number(bun) / Number(creat) : null),
    unit: "ratio",
  },
  "Albumin-to-Creatinine Ratio": {
    from: ["Urine Albumin", "Urine Creatinine"],
    // ACR (mg/g) = urine albumin (mg/L) / (urine creatinine (mg/dL) × 0.01). Only when both urine values present.
    formula: (alb, creat) => (creat != null && Number(creat) !== 0 ? Number(alb) / (Number(creat) * 0.01) : null),
    unit: "mg/g",
  },
  "Globulin": {
    from: ["Total Protein", "Albumin"],
    formula: (totalProtein, albumin) => {
      const tp = Number(totalProtein);
      const alb = Number(albumin);
      const g = tp - alb;
      // Allow 0 and small rounding errors; globulin must be <= total protein
      if (!Number.isFinite(g) || g < -0.01 || g > tp + 0.01) return null;
      return Math.max(0, g);
    },
    unit: "g/dL",
  },
  "Cholesterol/HDL Ratio": {
    from: ["Total Cholesterol", "HDL Cholesterol"],
    formula: (total, hdl) => {
      const t = Number(total);
      const h = Number(hdl);
      if (!Number.isFinite(t) || !Number.isFinite(h) || h === 0) return null;
      return t / h;
    },
    unit: "ratio",
  },
  "Albumin/Globulin Ratio": {
    from: ["Albumin", "Globulin"],
    formula: (alb, glob) => (glob != null && Number(glob) !== 0 ? Number(alb) / Number(glob) : null),
    unit: "ratio",
  },
  "Iron Saturation": {
    from: ["Iron", "TIBC"],
    formula: (iron, tibc) => (tibc != null && Number(tibc) !== 0 ? (Number(iron) / Number(tibc)) * 100 : null),
    unit: "%",
  },
  "Omega-6/Omega-3 Ratio": {
    from: ["Omega-6 Total", "Omega-3 Total"],
    formula: (o6, o3) => (o3 != null && Number(o3) !== 0 ? Number(o6) / Number(o3) : null),
    unit: "ratio",
  },
  "LDL Cholesterol": {
    from: ["Total Cholesterol", "HDL Cholesterol", "Triglycerides"],
    formula: (total, hdl, tg) => {
      const t = Number(total);
      const h = Number(hdl);
      const trig = Number(tg);
      if (!Number.isFinite(t) || !Number.isFinite(h) || !Number.isFinite(trig) || trig >= 400) return null;
      const ldl = t - h - trig / 5;
      return ldl >= 0 && Number.isFinite(ldl) ? ldl : null;
    },
    unit: "mg/dL",
  },
  "Free Testosterone": {
    from: ["Total Testosterone", "SHBG", "Albumin"],
    // Vermeulen 1999: all inputs required (no default). Use same-test Total T, SHBG, Albumin.
    formula: (totalT_ng_dL, shbg_nmol_L, albumin_g_dL) => {
      const t = Number(totalT_ng_dL);
      const shbg = Number(shbg_nmol_L);
      const albumin_g_dLNum = Number(albumin_g_dL);
      if (!Number.isFinite(t) || !Number.isFinite(shbg) || shbg <= 0 || !Number.isFinite(albumin_g_dLNum)) return null;
      const totalT_nmol_L = t / 28.84;
      const T_mol = totalT_nmol_L * 1e-9;
      const SHBG_mol = shbg * 1e-9;
      const albumin_g_L = albumin_g_dLNum * 10;
      const Alb_mol = albumin_g_L / 66000;
      const kat = 3.6e4;
      const kt = 1e9;
      const a = kat + kt + (kat * kt) * (SHBG_mol + Alb_mol - T_mol);
      const b = 1 + kt * SHBG_mol + kat * Alb_mol - (kat + kt) * T_mol;
      const disc = b * b + 4 * a * T_mol;
      if (disc < 0 || !Number.isFinite(a) || a <= 0) return null;
      const freeT_mol_L = (-b + Math.sqrt(disc)) / (2 * a);
      const freeT_nmol_L = freeT_mol_L * 1e9;
      const freeT_pg_mL = freeT_nmol_L * 288; // nmol/L → pg/mL (testosterone MW ~288)
      return freeT_pg_mL > 0 && Number.isFinite(freeT_pg_mL) ? freeT_pg_mL : null;
    },
    unit: "pg/mL",
  },
};

// Resolve biomarker value from object (same key or case-insensitive) and coerce to number for formulas
function getNumericFromBiomarkers(biomarkers, key) {
  let v = biomarkers[key];
  if (v === undefined) {
    const keyLower = key.toLowerCase();
    const foundKey = Object.keys(biomarkers || {}).find(k => k.toLowerCase() === keyLower);
    v = foundKey != null ? biomarkers[foundKey] : undefined;
  }
  if (v == null || v === "") return null;
  const num = typeof v === "object" && v !== null && "numeric" in v ? v.numeric : parseLabValue(v).numeric;
  return Number.isFinite(num) ? num : null;
}

// Returns list of source biomarker names missing from this test (for tooltip). No defaults — derived only when all present.
function getMissingDerivedSources(derivedName, biomarkers) {
  const def = DERIVED_BIOMARKERS[derivedName];
  if (!def) return [];
  const sources = [...(def.from || []), ...(def.optionalFrom || [])];
  const missing = sources.filter(s => getNumericFromBiomarkers(biomarkers, s) == null);
  return missing;
}

// Returns list of source biomarker names used to calculate this derived biomarker (for display).
function getCalculatedFrom(name) {
  const def = DERIVED_BIOMARKERS[name];
  if (!def) return [];
  return [...(def.from || []), ...(def.optionalFrom || [])];
}

function computeDerivedBiomarkers(biomarkers) {
  if (!biomarkers || typeof biomarkers !== "object") return biomarkers || {};
  const out = { ...biomarkers };
  Object.entries(DERIVED_BIOMARKERS).forEach(([name, def]) => {
    const { from: sources, formula } = def;
    const vals = sources.map(s => getNumericFromBiomarkers(out, s));
    if (!vals.every(v => v != null)) return;
    const forceRecompute = name === "Cholesterol/HDL Ratio";
    if (!forceRecompute && out[name] !== undefined && out[name] !== "") return;
    try {
      const computed = formula(...vals);
      if (computed != null && Number.isFinite(computed)) out[name] = String(Math.round(computed * 100) / 100);
    } catch (_) {}
  });
  return out;
}

// Parse lab values like "<5", ">100", "5.2", "4,2" (European) → { display, numeric } for display and graphs
function parseLabValue(value) {
  if (value == null || value === "") return { display: "–", numeric: NaN };
  const s = String(value).trim();
  const lessMatch = /^<\s*([-\d.,]+)$/i.exec(s);
  const greaterMatch = /^>\s*([-\d.,]+)$/i.exec(s);
  const parseNum = (str) => parseFloat(str.replace(/,/g, "."));
  if (lessMatch) {
    const n = parseNum(lessMatch[1]);
    return { display: isNaN(n) ? s : `< ${lessMatch[1]}`, numeric: n };
  }
  if (greaterMatch) {
    const n = parseNum(greaterMatch[1]);
    return { display: isNaN(n) ? s : `> ${greaterMatch[1]}`, numeric: n };
  }
  const n = parseNum(s);
  return { display: isNaN(n) ? s : s, numeric: n };
}

// Single palette for status/range colors — used in UI, charts, and reference range pills
const RANGE_COLORS = {
  optimal: "#00e5a0",
  sufficient: "#50ddc8",
  low: "#ff8c42",
  high: "#ff5e5e",
  elite: "#b48fff",
  "out-of-range": "#ff5e5e",
  unknown: "#555",
};
const RANGE_BG = {
  optimal: "rgba(0,229,160,0.12)",
  sufficient: "rgba(80,221,200,0.12)",
  low: "rgba(255,140,66,0.12)",
  high: "rgba(255,94,94,0.12)",
  elite: "rgba(180,143,255,0.12)",
  "out-of-range": "rgba(255,94,94,0.12)",
  unknown: "rgba(80,80,80,0.1)",
};
const RANGE_BAND_FILL = {
  optimal: "rgba(0,229,160,0.20)",
  sufficient: "rgba(80,221,200,0.18)",
  low: "rgba(255,140,66,0.18)",
  high: "rgba(255,94,94,0.18)",
  elite: "rgba(180,143,255,0.20)",
};
// Stronger opacity for table horizontal bar so segments and value position are easier to see
const RANGE_BAR_FILL = {
  optimal: "rgba(0,200,140,0.55)",
  sufficient: "rgba(64,200,180,0.5)",
  low: "rgba(255,120,50,0.5)",
  high: "rgba(255,80,80,0.5)",
  elite: "rgba(160,120,240,0.55)",
};
const RANGE_RGB = {
  optimal: [0, 229, 160],
  sufficient: [80, 221, 200],
  low: [255, 140, 66],
  high: [255, 94, 94],
  elite: [180, 143, 255],
};

// Blueprint Biomarkers (blueprintbiomarkers.com) suggested retest frequency
const MONITOR_FREQUENCY_LABELS = { "3mo": "Retest every 3 mo", "6mo": "Retest every 6 mo", "1y": "Retest yearly" };
function MonitorFrequencyBadge({ frequency, themeColors }) {
  if (!frequency || !MONITOR_FREQUENCY_LABELS[frequency]) return null;
  const label = MONITOR_FREQUENCY_LABELS[frequency];
  return (
    <span
      title={`Blueprint Biomarkers: ${label}`}
      style={{
        fontSize: 9,
        padding: "2px 6px",
        borderRadius: 4,
        background: themeColors ? `${themeColors.accent}22` : "rgba(80,140,200,0.2)",
        color: themeColors ? themeColors.accent : "#6a9acc",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// Build horizontal range bar segments and value position (0–100) for table view.
// Uses a capped display range so the "high" segment (e.g. 100–9999) doesn't dominate the bar.
function buildRangeBar(b, numericValue) {
  const lowEnabled = b.low && !(b.low[0] === 0 && b.low[1] === 0);
  const sufEnabled = b.sufficient && !(b.sufficient[0] === 0 && b.sufficient[1] === 0);
  // high [0,0] means "no high segment" (e.g. eGFR, Active B12); don't use it for displayMax or we get 0 and squash the bar
  const highEnabled = b.high && b.high[0] < 9999 && !(b.high[0] === 0 && b.high[1] === 0);
  const optHigh = b.optimal[1] > 900 ? null : b.optimal[1];

  const allVals = [b.optimal[0]];
  if (optHigh) allVals.push(optHigh);
  if (lowEnabled) allVals.push(b.low[0], b.low[1]);
  if (sufEnabled) allVals.push(b.sufficient[0], b.sufficient[1]);
  if (highEnabled) allVals.push(b.high[0]);
  const valid = allVals.filter(v => v != null && isFinite(v));
  const rawMin = valid.length ? Math.min(...valid) : 0;
  const rawMax = valid.length ? Math.max(...valid) : 100;
  const optWidth = optHigh != null ? optHigh - b.optimal[0] : (b.sufficient && b.sufficient[1] < 9000 ? b.sufficient[1] - b.sufficient[0] : 50);
  // Cap both ends so no zone dominates: low and high get ~same visual weight as optimal (scale-based).
  const rawHighEnd = highEnabled ? b.high[1] : null;
  const normalSpan = highEnabled ? b.high[0] - rawMin : Math.max(rawMax - rawMin, 1);
  const highAdd = optWidth > 0 ? optWidth : Math.max(normalSpan * 0.25, 0.1);
  const displayMax = highEnabled
    ? Math.min(rawHighEnd >= 9999 ? Infinity : rawHighEnd, b.high[0] + highAdd)
    : (optHigh == null ? b.optimal[0] + highAdd : rawMax); // when optimal is open-ended (e.g. eGFR, Active B12), cap so all zones are visible
  // Low segment: strict cap so a huge low range (e.g. eGFR 0–59, Active B12 0–50) doesn't dominate the bar.
  const lowRangeWidth = lowEnabled ? b.low[1] - rawMin : 0;
  const lowDisplayWidth = lowEnabled && lowRangeWidth > 0
    ? Math.min(optWidth > 0 ? optWidth * 0.5 : highAdd, lowRangeWidth * 0.25, 18)
    : (optWidth > 0 ? optWidth : highAdd);
  const displayMin = lowEnabled && b.low[1] > rawMin
    ? Math.max(rawMin, b.low[1] - lowDisplayWidth)
    : rawMin;
  const rangeMin = displayMin;
  const rangeMax = Math.max(displayMax, rangeMin + 0.001);
  const span = rangeMax - rangeMin || 1;
  const clamp = (v) => Math.max(rangeMin, Math.min(rangeMax, v));
  const toPct = (v) => ((clamp(v) - rangeMin) / span) * 100;

  const segments = [];
  let prev = rangeMin;

  const fill = RANGE_BAR_FILL;
  if (lowEnabled && b.low[1] > prev) {
    const end = clamp(b.low[1]);
    segments.push({ pct: toPct(end) - toPct(prev), fill: fill.low });
    prev = end;
  }
  if (sufEnabled && b.sufficient[0] < b.optimal[0] && b.optimal[0] > prev) {
    const end = clamp(b.optimal[0]);
    const start = Math.max(prev, b.sufficient[0]);
    if (end > start) segments.push({ pct: toPct(end) - toPct(start), fill: fill.sufficient });
    prev = end;
  }
  const optEnd = optHigh != null ? clamp(optHigh) : rangeMax;
  if (optEnd > prev) {
    const start = Math.max(prev, b.optimal[0]);
    segments.push({ pct: toPct(optEnd) - toPct(start), fill: fill.optimal });
    prev = optEnd;
  }
  if (sufEnabled && optHigh != null && (highEnabled ? b.high[0] : b.sufficient[1]) > prev) {
    const end = highEnabled ? clamp(b.high[0]) : clamp(Math.min(b.sufficient[1], rangeMax));
    if (end > prev) segments.push({ pct: toPct(end) - toPct(prev), fill: fill.sufficient });
    prev = end;
  }
  if (highEnabled && rangeMax > prev) {
    segments.push({ pct: toPct(rangeMax) - toPct(prev), fill: b.eliteZone ? fill.elite : fill.high });
  }

  if (segments.length === 0) segments.push({ pct: 100, fill: "rgba(128,128,128,0.35)" });

  // Value position: clamp to [0, 100]; if above displayMax, show at 100%
  const valuePos = !Number.isNaN(numericValue) && isFinite(numericValue)
    ? Math.max(0, Math.min(100, ((numericValue - rangeMin) / span) * 100))
    : null;

  return { segments, valuePos };
}

function RangeBarSegments({ segments, valuePos, height = 20 }) {
  const total = segments.reduce((s, seg) => s + seg.pct, 0);
  const scale = total > 0 ? 100 / total : 1;
  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: 6, overflow: "visible" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 6, overflow: "hidden", background: "rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          {segments.map((seg, i) => (
            <div key={i} style={{ width: `${seg.pct * scale}%`, background: seg.fill, flexShrink: 0, minWidth: 1 }} />
          ))}
        </div>
      </div>
      {valuePos != null && (
        <div
          style={{
            position: "absolute",
            left: `${valuePos}%`,
            top: -2,
            bottom: -2,
            width: 5,
            transform: "translateX(-50%)",
            background: "#0a0a0a",
            boxShadow: "0 0 0 2px #fff",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getStatus(name, value) {
  const b = BIOMARKER_DB[name];
  if (!b) return "unknown";
  const { numeric: v } = typeof value === "object" && value?.numeric !== undefined ? value : parseLabValue(value);
  if (isNaN(v)) return "unknown";
  // optimal first
  if (b.optimal && v >= b.optimal[0] && v <= b.optimal[1]) return "optimal";
  // elite zone (repurposed "high" field for metrics where more = better)
  const highEnabled = b.high && b.high[0] > 0 && b.high[0] < 9999;
  if (b.eliteZone && highEnabled && v >= b.high[0]) return "elite";
  // low: skip when sentinel [0,0]. For Creatinine, low is benign (reflects muscle mass/diet, not kidney disease); literature does not define low as "optimal", so we use sufficient.
  const lowEnabled = b.low && !(b.low[0] === 0 && b.low[1] === 0);
  if (lowEnabled && v < b.low[1]) {
    if (name === "Creatinine") return "sufficient";
    return "low";
  }
  // high (only for non-elite zones)
  if (!b.eliteZone && highEnabled && v >= b.high[0]) return "high";
  // sufficient falls through
  if (b.sufficient && v >= b.sufficient[0] && v <= b.sufficient[1]) return "sufficient";
  // Below sufficient but not in low band: out-of-range. For Creatinine, low values are acceptable.
  if (name === "Creatinine" && b.sufficient && v < b.sufficient[0]) return "sufficient";
  return "out-of-range";
}

function statusColor(status) {
  return RANGE_COLORS[status] || RANGE_COLORS.unknown;
}

// True when higher values are better (e.g. HDL, Hemoglobin). Used for trend improvement coloring.
// When optimal starts strictly above the "low" ceiling, we want to go up from low → higher is better.
function higherIsBetter(name) {
  const b = BIOMARKER_DB[name];
  if (!b || !b.optimal) return false;
  const lowOk = b.low && b.low[1] > 0;
  return lowOk && b.optimal[0] > b.low[1];
}

function statusBg(status) {
  return RANGE_BG[status] || RANGE_BG.unknown;
}

const INIT_PEOPLE = [];

const THEME_STORAGE_KEY = "biotracker-theme";
const THEME_COLORS = {
  dark: {
    appBg: "#050a14",
    text: "#c8d8f0",
    textMuted: "#8aabcc",
    textDim: "#4a6a8a",
    navBg: "rgba(5,10,20,0.95)",
    border: "#1a3050",
    borderHover: "#2a4060",
    accent: "#0ef",
    accentDark: "#0090a8",
  },
  light: {
    appBg: "#e8eef4",
    text: "#1a2332",
    textMuted: "#4a6078",
    textDim: "#6b7c8f",
    navBg: "rgba(255,255,255,0.95)",
    border: "#b8c8d8",
    borderHover: "#8aa0b8",
    accent: "#007a8a",
    accentDark: "#005a68",
  },
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [people, setPeople] = useState(INIT_PEOPLE);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [entries, setEntries] = useState({});
  const [view, setView] = useState("dashboard");
  const [selectedBiomarker, setSelectedBiomarker] = useState(null);
  const [viewBeforeTrendDetail, setViewBeforeTrendDetail] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetPersonId, setImportTargetPersonId] = useState(null);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterRecord, setFilterRecord] = useState("all"); // "all" | "noRecord"
  const [biomarkersViewMode, setBiomarkersViewMode] = useState("table"); // "cards" | "table"
  const [biomarkersTableSort, setBiomarkersTableSort] = useState({ by: "name", dir: "asc" });
  const [overviewTableSort, setOverviewTableSort] = useState({ by: "name", dir: "asc" });
  const [historyTableSort, setHistoryTableSort] = useState({ by: "name", dir: "asc" });
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState(null);
  const [driveStatus, setDriveStatus] = useState("disconnected");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(null); // person id pending deletion
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showEditPersonModal, setShowEditPersonModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(THEME_STORAGE_KEY) || "dark");
  });

  const themeColors = THEME_COLORS[theme];

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColors.appBg);
  }, [theme, themeColors.appBg]);

  const getAge = (person) => {
    if (person.birthday) {
      const today = new Date();
      const birth = new Date(person.birthday + "T12:00:00");
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    }
    return person.age || null;
  };

  const getBirthdayDisplay = (person) => {
    if (!person.birthday) return null;
    return new Date(person.birthday + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  // In-memory fallback when window.storage (e.g. extension) is not available
  const storage = typeof window !== "undefined" && window.storage
    ? window.storage
    : {
        get: async (key) => {
          try {
            const v = localStorage.getItem(key);
            return v != null ? { value: v } : null;
          } catch {
            return null;
          }
        },
        set: async (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (_) {}
        },
      };

  const dataApiUrl = () => `${import.meta.env.VITE_API_BASE || ""}/api/data`;

  // Load: server first (shared across browsers), then fallback to local storage
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(dataApiUrl());
        if (res.ok) {
          const data = await res.json();
          const parsedPeople = Array.isArray(data.people) ? data.people : [];
          const parsedEntries = data.entries && typeof data.entries === "object" ? data.entries : {};
          setPeople(parsedPeople);
          setEntries(parsedEntries);
          setSelectedPerson(parsedPeople[0]?.id ?? null);
          await storage.set("bloodwork-people", JSON.stringify(parsedPeople));
          await storage.set("bloodwork-entries", JSON.stringify(parsedEntries));
          setLoading(false);
          return;
        }
      } catch (_) {}
      try {
        const pr = await storage.get("bloodwork-people");
        const en = await storage.get("bloodwork-entries");
        if (pr && pr.value) {
          const parsedPeople = JSON.parse(pr.value);
          setPeople(Array.isArray(parsedPeople) ? parsedPeople : []);
          setSelectedPerson(parsedPeople[0]?.id ?? null);
        }
        if (en && en.value) {
          const parsedEntries = JSON.parse(en.value);
          setEntries(parsedEntries && typeof parsedEntries === "object" ? parsedEntries : {});
        }
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, []);

  // Keep selectedPerson valid when people list changes (add/delete)
  useEffect(() => {
    if (people.length === 0) setSelectedPerson(null);
    else if (!selectedPerson || !people.some((p) => p.id === selectedPerson)) setSelectedPerson(people[0].id);
  }, [people]);

  // Read-merge-write: fetch latest from server, merge in our changes (by id), then save. Prevents concurrent browsers from overwriting each other.
  const save = async (newPeople, newEntries) => {
    let toSavePeople = newPeople;
    let toSaveEntries = newEntries;
    try {
      const res = await fetch(dataApiUrl());
      if (res.ok) {
        const data = await res.json();
        const serverPeople = Array.isArray(data.people) ? data.people : [];
        const serverEntries = data.entries && typeof data.entries === "object" ? data.entries : {};
        const peopleById = new Map(serverPeople.map((p) => [p.id, p]));
        newPeople.forEach((p) => peopleById.set(p.id, p));
        toSavePeople = [...peopleById.values()];
        const allPersonIds = new Set([...Object.keys(serverEntries), ...Object.keys(newEntries)]);
        const merged = {};
        allPersonIds.forEach((pid) => {
          const list = Object.hasOwn(newEntries, pid) ? (newEntries[pid] || []) : (serverEntries[pid] || []);
          merged[pid] = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
        });
        toSaveEntries = Object.fromEntries(Object.entries(merged).filter(([pid]) => peopleById.has(pid)));
      }
    } catch (_) {}
    try {
      await storage.set("bloodwork-people", JSON.stringify(toSavePeople));
      await storage.set("bloodwork-entries", JSON.stringify(toSaveEntries));
    } catch (_) {}
    try {
      const postRes = await fetch(dataApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: toSavePeople, entries: toSaveEntries }),
      });
      if (postRes.ok) {
        setPeople(toSavePeople);
        setEntries(toSaveEntries);
      }
    } catch (_) {}
  };


  const addEntry = (personId, date, biomarkers, extractedName = null, extractedNameEnglish = null) => {
    const newEntries = {
      ...entries,
      [personId]: [...(entries[personId] || []), { date, biomarkers, id: Date.now(), extractedName: extractedName || undefined, extractedNameEnglish: extractedNameEnglish || undefined }]
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    };
    setEntries(newEntries);
    save(people, newEntries);
  };

  const deleteEntry = (personId, entryId) => {
    const newEntries = {
      ...entries,
      [personId]: (entries[personId] || []).filter(e => e.id !== entryId),
    };
    setEntries(newEntries);
    save(people, newEntries);
  };

  const addPerson = (person) => {
    const newPeople = [...people, { ...person, id: String(Date.now()), avatar: person.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() }];
    setPeople(newPeople);
    setSelectedPerson(newPeople[newPeople.length - 1].id);
    save(newPeople, entries);
    setShowAddPersonModal(false);
  };

  const updatePerson = (personId, updates) => {
    const newPeople = people.map(p =>
      p.id !== personId
        ? p
        : {
            ...p,
            ...updates,
            id: p.id,
            avatar: (updates.name ?? p.name).trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase() || p.avatar,
          }
    );
    setPeople(newPeople);
    save(newPeople, entries);
  };

  const deletePerson = (personId) => {
    const newPeople = people.filter(p => p.id !== personId);
    const newEntries = { ...entries };
    delete newEntries[personId];
    setPeople(newPeople);
    setEntries(newEntries);
    save(newPeople, newEntries);
    if (selectedPerson === personId) setSelectedPerson(newPeople[0]?.id || null);
    setConfirmDeletePerson(null);
  };

  const currentPerson = people.find(p => p.id === selectedPerson);
  const personEntries = entries[selectedPerson] || [];
  const latestEntry = personEntries[personEntries.length - 1];

  const allBiomarkers = getBiomarkersForPerson(currentPerson);

  const getTrend = (name) => {
    const vals = personEntries.map(e => e.biomarkers?.[name]).filter(v => v !== undefined);
    if (vals.length < 2) return null;
    const last = parseLabValue(vals[vals.length - 1]).numeric;
    const prev = parseLabValue(vals[vals.length - 2]).numeric;
    if (isNaN(last) || isNaN(prev)) return null;
    if (last > prev * 1.02) return "up";
    if (last < prev * 0.98) return "down";
    return "stable";
  };

  // Cumulative snapshot: for each biomarker, the most recent measured value across ALL entries
  const getCumulativeSnapshot = () => {
    const snapshot = {}; // { biomarkerName: { val, date } }
    // personEntries are sorted oldest→newest; include derived biomarkers computed per entry
    personEntries.forEach(entry => {
      const withDerived = computeDerivedBiomarkers(entry.biomarkers || {});
      Object.entries(withDerived).forEach(([name, val]) => {
        snapshot[name] = { val, date: entry.date };
      });
    });
    return snapshot;
  };

  const cumulativeSnapshot = getCumulativeSnapshot();

  const hasNoRecord = (name) => !cumulativeSnapshot[name];
  const noRecordCount = allBiomarkers.filter(hasNoRecord).length;
  const totalBiomarkersCount = allBiomarkers.length;

  const filteredBiomarkers = allBiomarkers.filter(b => {
    const cat = BIOMARKER_DB[b].category;
    const matchCat = filterCat === "All" || cat === filterCat;
    const matchSearch = !searchTerm || b.toLowerCase().includes(searchTerm.toLowerCase()) || cat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRecord = filterRecord === "all" || (filterRecord === "noRecord" && hasNoRecord(b));
    return matchCat && matchSearch && matchRecord;
  });

  const getStatusCounts = () => {
    const counts = { optimal: 0, sufficient: 0, high: 0, low: 0, elite: 0, total: 0 };
    Object.entries(cumulativeSnapshot).forEach(([name, { val }]) => {
      const s = getStatus(name, val);
      if (s === "optimal") counts.optimal++;
      else if (s === "sufficient") counts.sufficient++;
      else if (s === "elite") counts.elite++;
      else if (s === "high" || s === "out-of-range") counts.high++;
      else if (s === "low") counts.low++;
      counts.total++;
    });
    return counts;
  };

  const counts = getStatusCounts();
  const healthScore = counts.total > 0 ? Math.round((counts.optimal + counts.elite + counts.sufficient * 0.5) / counts.total * 100) : null;

  if (loading) return (
    <div style={{ background: themeColors.appBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", border: `3px solid ${themeColors.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ color: themeColors.accent, fontFamily: "'Courier New', monospace", fontSize: 14, letterSpacing: 2 }}>LOADING</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div data-theme={theme} style={{ background: themeColors.appBg, minHeight: "100vh", fontFamily: "'DM Mono', 'Courier New', monospace", color: themeColors.text, display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        [data-theme="dark"] {
          --app-bg: #050a14;
          --card-bg: linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%);
          --card-border: #1a3050;
          --card-hover: #2a4060;
          --input-bg: #0a1628;
          --input-border: #1a3050;
          --input-color: #c8d8f0;
          --input-focus: #0ef;
          --modal-bg: #0a1628;
          --modal-overlay: rgba(5,10,20,0.85);
          --accent: #0ef;
          --accent-dark: #0090a8;
          --tab-inactive: #5a7a9a;
          --scroll-track: #0a1628;
          --scroll-thumb: #1a3050;
        }
        [data-theme="light"] {
          --app-bg: #e8eef4;
          --card-bg: linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%);
          --card-border: #b8c8d8;
          --card-hover: #8aa0b8;
          --input-bg: #ffffff;
          --input-border: #b8c8d8;
          --input-color: #1a2332;
          --input-focus: #007a8a;
          --modal-bg: #ffffff;
          --modal-overlay: rgba(0,0,0,0.4);
          --accent: #007a8a;
          --accent-dark: #005a68;
          --tab-inactive: #6b7c8f;
          --scroll-track: #e0e8f0;
          --scroll-thumb: #b8c8d8;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: var(--scroll-track); }
        ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideIn { from { transform: translateY(-10px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 10px rgba(0,238,255,0.2); } 50% { box-shadow: 0 0 20px rgba(0,238,255,0.4); } }
        .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; transition: border-color 0.2s; }
        .card:hover { border-color: var(--card-hover); }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent-dark)); color: #fff; font-weight: 600; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-secondary { background: var(--input-bg); border: 1px solid var(--card-border); color: var(--tab-inactive); }
        .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
        .btn-danger { background: rgba(255,94,94,0.1); border: 1px solid rgba(255,94,94,0.3); color: #ff5e5e; }
        .stat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        input, select, textarea { background: var(--input-bg); border: 1px solid var(--input-border); color: var(--input-color); font-family: inherit; font-size: 13px; border-radius: 8px; padding: 8px 12px; width: 100%; outline: none; transition: border-color 0.2s; }
        input:focus, select:focus, textarea:focus { border-color: var(--input-focus); }
        select option { background: var(--input-bg); }
        .modal-bg { position: fixed; inset: 0; background: var(--modal-overlay); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: var(--modal-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 28px; width: 100%; animation: slideIn 0.2s ease; overflow-y: auto; max-height: 90vh; }
        .tab-btn { padding: 8px 16px; border-radius: 8px; font-family: inherit; font-size: 12px; cursor: pointer; border: none; transition: all 0.2s; background: transparent; color: var(--tab-inactive); }
        .tab-btn.active { background: var(--input-bg); color: var(--accent); border: 1px solid var(--card-border); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 768px) {
          .grid-2, .grid-3 { grid-template-columns: 1fr; }
          .card { padding: 14px; }
          .modal { padding: 16px; max-height: 85vh; }
          .btn { min-height: 44px; padding: 10px 16px; }
          input, select, textarea { min-height: 44px; }
          .modal-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* TOP NAV */}
      <nav style={{ padding: isMobile ? "10px 12px" : "12px 24px", borderBottom: `1px solid ${themeColors.border}`, display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexWrap: "wrap", background: themeColors.navBg, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 50 }}>
        {isMobile && (
          <button type="button" onClick={() => setSidebarOpen(o => !o)} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${themeColors.border}`, borderRadius: 8, color: themeColors.textMuted, cursor: "pointer", fontSize: 20 }} aria-label="Menu">☰</button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: isMobile ? 4 : 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${themeColors.accent}, ${themeColors.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧬</div>
          <div>
            <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: themeColors.accent, letterSpacing: 1, fontFamily: "Space Grotesk, sans-serif" }}>BIOTRACKER</div>
            <div style={{ fontSize: 9, color: themeColors.textDim, letterSpacing: 2 }}>BIOMARKER TRACKER</div>
          </div>
        </div>

        {/* Current person + dropdown (other persons & Add person) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, position: "relative" }}>
          {people.length === 0 ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={() => setShowAddPersonModal(true)}
            >
              <span style={{ marginRight: 6 }}>👤</span> Add person
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setPersonDropdownOpen(o => !o)}
              style={{ background: `${themeColors.accent}1a`, border: `1px solid ${themeColors.accent}`, borderRadius: 8, color: themeColors.accent, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg, ${themeColors.accentDark}, #003070)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: themeColors.accent }}>{currentPerson?.avatar}</div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{currentPerson?.name}</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
            </button>
          )}
          {personDropdownOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setPersonDropdownOpen(false)} role="presentation" />
              <div style={{ position: "absolute", left: 0, top: "100%", marginTop: 4, minWidth: 220, maxHeight: 320, overflowY: "auto", background: theme === "dark" ? "#0a1628" : "#fff", border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: 6, zIndex: 99, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                {people.filter(p => p.id !== selectedPerson).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "flex-start", padding: "10px 12px", fontSize: 13 }}
                    onClick={() => { setSelectedPerson(p.id); setPersonDropdownOpen(false); }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${themeColors.accentDark}, #003070)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: themeColors.accent, flexShrink: 0 }}>{p.avatar}</div>
                    {p.name}
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${themeColors.border}`, marginTop: 4, paddingTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "flex-start", padding: "10px 12px", fontSize: 13 }}
                    onClick={() => { setShowAddPersonModal(true); setPersonDropdownOpen(false); }}
                  >
                    <span style={{ fontSize: 16 }}>+</span> Add person
                  </button>
                </div>
              </div>
            </>
          )}
          {confirmDeletePerson != null && (() => {
            const p = people.find(x => x.id === confirmDeletePerson);
            if (!p) return null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,94,94,0.5)", background: "rgba(255,94,94,0.08)", marginLeft: 8 }}>
                <span style={{ fontSize: 12, color: "#ff8888" }}>Delete {p.name}?</span>
                <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => deletePerson(p.id)}>Yes</button>
                <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setConfirmDeletePerson(null)}>No</button>
              </div>
            );
          })()}
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
            style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${themeColors.border}`, borderRadius: 8, color: themeColors.textMuted, cursor: "pointer", fontSize: 18 }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>
          <button className="btn btn-secondary" onClick={() => { setImportStatus(null); setImportTargetPersonId(selectedPerson); setShowImportModal(true); }} style={{ fontSize: 11 }} disabled={!currentPerson} title={!currentPerson ? "Add a person first" : undefined}>📄 Import LAB results</button>
          <button className="btn btn-secondary" onClick={() => setShowManualEntry(true)} style={{ fontSize: 11 }} disabled={!currentPerson} title={!currentPerson ? "Add a person first" : undefined}>+ Manual Entry</button>

          <div style={{ position: "relative" }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowSettingsMenu(m => !m)}
              style={{ fontSize: 11 }}
              title="Tools & settings"
            >
              ⚙ Tools
            </button>
            {showSettingsMenu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowSettingsMenu(false)} />
                <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, minWidth: 200, background: theme === "dark" ? "#0a1628" : "#fff", border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: 8, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    disabled={!currentPerson}
                    onClick={() => { setShowEditPersonModal(true); setShowSettingsMenu(false); }}
                  >
                    ✏ Edit person
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    disabled={!currentPerson}
                    onClick={() => { setShowExportModal(true); setShowSettingsMenu(false); }}
                  >
                    ⬇ Export PDF
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    onClick={() => {
                      setShowSettingsMenu(false);
                      const payload = { people, entries, exportedAt: new Date().toISOString(), version: 1 };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `biotracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    📦 Export backup (JSON)
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", marginBottom: 4, fontSize: 12 }}
                    onClick={() => {
                      setShowSettingsMenu(false);
                      if (driveStatus === "connected") setDriveStatus("disconnected");
                      else alert("Google Drive\n\n• Export backup (above) to download a JSON file, then upload it to Google Drive for your own backup.\n• Full automatic sync requires a Google Cloud project with Drive API and OAuth; data is already stored on the server and shared across browsers.");
                    }}
                  >
                    ☁️ {driveStatus === "connected" ? "Drive: Disconnect" : "Drive: Connect"}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ display: "block", width: "100%", justifyContent: "flex-start", fontSize: 12 }}
                    disabled={!currentPerson}
                    onClick={() => { if (currentPerson) setConfirmDeletePerson(currentPerson.id); setShowSettingsMenu(false); }}
                  >
                    🗑 Delete person
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {isMobile && sidebarOpen && (
          <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 55 }} onClick={() => setSidebarOpen(false)} />
        )}
        {/* SIDEBAR */}
        <aside style={{
          width: 200,
          borderRight: `1px solid ${themeColors.border}`,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
          ...(isMobile ? {
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 60,
            background: themeColors.appBg,
            transition: "transform 0.2s ease",
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          } : {}),
        }}>
          {[
            { id: "dashboard", icon: "◈", label: "Overview" },
            { id: "biomarkers", icon: "⬡", label: "All Markers" },
            { id: "trends", icon: "◫", label: "Trends" },
            { id: "history", icon: "◧", label: "History" },
          ].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); if (isMobile) setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", minHeight: 44, borderRadius: 8, border: "none", cursor: "pointer", background: view === item.id ? `${themeColors.accent}14` : "transparent", color: view === item.id ? themeColors.accent : themeColors.textMuted, transition: "all 0.2s", textAlign: "left", fontSize: 13, fontFamily: "inherit" }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${themeColors.border}`, marginTop: 8, paddingTop: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { setFilterCat(cat); setView("biomarkers"); if (isMobile) setSidebarOpen(false); }} style={{ display: "block", width: "100%", padding: "10px 12px", minHeight: 40, borderRadius: 6, border: "none", cursor: "pointer", background: filterCat === cat && view === "biomarkers" ? `${themeColors.accent}0d` : "transparent", color: filterCat === cat && view === "biomarkers" ? themeColors.textMuted : themeColors.textDim, transition: "all 0.2s", textAlign: "left", fontSize: 11, fontFamily: "inherit" }}>
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, padding: isMobile ? 12 : 24, overflow: "auto", minWidth: 0 }}>
          {/* No person: prompt to add first */}
          {!currentPerson && (
            <div className="card" style={{ textAlign: "center", padding: 80, maxWidth: 480, margin: "40px auto" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
              <div style={{ fontSize: 18, color: "#8aabcc", marginBottom: 8, fontFamily: "Space Grotesk, sans-serif" }}>No person yet</div>
              <div style={{ fontSize: 13, color: "#3a5a7a", marginBottom: 24 }}>Add your first person to start tracking biomarkers and importing bloodwork.</div>
              <button className="btn btn-primary" onClick={() => setShowAddPersonModal(true)}>+ Add Person</button>
            </div>
          )}

          {/* Person Header */}
          {currentPerson && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: isMobile ? 12 : 16, marginBottom: 24 }}>
              <div style={{ width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14, background: `linear-gradient(135deg, ${themeColors.accentDark}, #003070)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 16 : 18, fontWeight: 700, color: themeColors.accent, border: `2px solid ${themeColors.border}`, flexShrink: 0 }}>{currentPerson.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: themeColors.text, fontFamily: "Space Grotesk, sans-serif" }}>{currentPerson.name}</div>
                <div style={{ fontSize: 11, color: themeColors.textDim }}>
                  {getBirthdayDisplay(currentPerson) && (
                    <span>Born {getBirthdayDisplay(currentPerson)}{getAge(currentPerson) ? ` · Age ${getAge(currentPerson)}` : ""}</span>
                  )}
                  {!getBirthdayDisplay(currentPerson) && getAge(currentPerson) && <span>Age {getAge(currentPerson)}</span>}
                  {currentPerson.gender && <span> · {currentPerson.gender}</span>}
                  <span> · {personEntries.length} tests recorded</span>
                </div>
              </div>
              {healthScore !== null && (
                <div style={{ marginLeft: isMobile ? 0 : "auto", textAlign: "center" }}>
                  <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, color: healthScore > 70 ? RANGE_COLORS.optimal : healthScore > 40 ? RANGE_COLORS.sufficient : RANGE_COLORS.high, fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>{healthScore}</div>
                  <div style={{ fontSize: 10, color: themeColors.textDim, letterSpacing: 1 }}>HEALTH SCORE</div>
                </div>
              )}
            </div>
          )}

          {/* ── VIEWS (only when a person is selected) ── */}
          {currentPerson && view === "dashboard" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {Object.keys(cumulativeSnapshot).length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
                  <div style={{ fontSize: 18, color: "#8aabcc", marginBottom: 8, fontFamily: "Space Grotesk, sans-serif" }}>No bloodwork data yet</div>
                  <div style={{ fontSize: 13, color: "#3a5a7a", marginBottom: 24 }}>Import a PDF or add manual entries to start tracking biomarkers</div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button className="btn btn-primary" onClick={() => { setImportTargetPersonId(selectedPerson); setShowImportModal(true); }}>📄 Import LAB results</button>
                    <button className="btn btn-secondary" onClick={() => setShowManualEntry(true)}>+ Manual Entry</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status Summary — clickable */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: isMobile ? 8 : 12, marginBottom: 20 }}>
                    {[
                      { label: "Optimal", key: "optimal", count: counts.optimal, color: RANGE_COLORS.optimal, icon: "✓" },
                      { label: "Sufficient", key: "sufficient", count: counts.sufficient, color: RANGE_COLORS.sufficient, icon: "~" },
                      { label: "Elite", key: "elite", count: counts.elite, color: RANGE_COLORS.elite, icon: "★" },
                      { label: "High", key: "high", count: counts.high, color: RANGE_COLORS.high, icon: "↑" },
                      { label: "Low", key: "low", count: counts.low, color: RANGE_COLORS.low, icon: "↓" },
                    ].map(item => (
                      <div
                        key={item.label}
                        className="card"
                        onClick={() => setStatusFilter(statusFilter === item.key ? null : item.key)}
                        style={{ textAlign: "center", border: `1px solid ${statusFilter === item.key ? item.color : item.color + "22"}`, cursor: "pointer", background: statusFilter === item.key ? `${item.color}18` : undefined, transition: "all 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      >
                        <div style={{ fontSize: 26, fontWeight: 700, color: item.color, fontFamily: "Space Grotesk, sans-serif" }}>{item.count}</div>
                        <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1 }}>{item.label.toUpperCase()}</div>
                        {statusFilter === item.key && <div style={{ fontSize: 9, color: item.color, marginTop: 4, letterSpacing: 1 }}>CLICK TO CLEAR</div>}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 0, border: `1px solid ${themeColors.border}`, borderRadius: 8, overflow: "hidden" }}>
                      <button type="button" onClick={() => setBiomarkersViewMode("cards")} style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "cards" ? themeColors.accent : "transparent", color: biomarkersViewMode === "cards" ? "#fff" : themeColors.textMuted }}>Cards</button>
                      <button type="button" onClick={() => setBiomarkersViewMode("table")} style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "table" ? themeColors.accent : "transparent", color: biomarkersViewMode === "table" ? "#fff" : themeColors.textMuted }}>Table</button>
                    </div>
                  </div>

                  {/* Filtered biomarker subset when a status card is clicked */}
                  {statusFilter && (
                    biomarkersViewMode === "cards" ? (
                    <div className="card" style={{ marginBottom: 16, border: `1px solid ${statusFilter ? RANGE_COLORS[statusFilter] + "22" : "transparent"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, fontWeight: 600 }}>
                          {statusFilter.toUpperCase()} BIOMARKERS
                          <span style={{ marginLeft: 10, color: "#3a5a7a", fontSize: 10, letterSpacing: 0, fontWeight: 400, textTransform: "none" }}>— most recent measurement per marker</span>
                        </div>
                        <button onClick={() => setStatusFilter(null)} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
{Object.entries(cumulativeSnapshot).filter(([name, { val }]) => {
                            if (!allBiomarkers.includes(name)) return false;
                            const s = getStatus(name, val);
                            return statusFilter === "high" ? (s === "high" || s === "out-of-range") : s === statusFilter;
                          }).map(([name, { val, date }]) => {
                          const status = getStatus(name, val);
                          const trend = getTrend(name);
                          const isOld = latestEntry && date !== latestEntry.date;
                          return (
                            <div key={name} onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }} style={{ padding: "12px 14px", borderRadius: 10, background: statusBg(status), border: `1px solid ${statusColor(status)}33`, cursor: "pointer", transition: "transform 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, color: "#5a7a9a" }}>{name}</span>
                                <span style={{ fontSize: 14 }}>{trend === "up" ? "↗" : trend === "down" ? "↘" : trend === "stable" ? "→" : ""}</span>
                              </div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif", lineHeight: 1.2, marginTop: 4 }}>{parseLabValue(val).display}</div>
                              <div style={{ fontSize: 10, color: "#4a6a8a" }}>{BIOMARKER_DB[name]?.unit}</div>
                              {isOld && <div style={{ fontSize: 9, color: "#3a5a7a", marginTop: 4 }}>as of {new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    ) : (
                    <div className="card" style={{ marginBottom: 16, overflowX: "auto" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, fontWeight: 600 }}>{statusFilter.toUpperCase()} BIOMARKERS</div>
                        <button onClick={() => setStatusFilter(null)} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                          {(["Biomarker", "Value", "Range", "Category"]).map(col => {
                            const key = col.toLowerCase().replace(/\s+/g, ""); const k = key === "biomarker" ? "name" : key === "value" ? "value" : key === "range" ? "range" : "category";
                            return (
                              <th key={col} style={{ textAlign: k === "value" ? "right" : "left", padding: "10px 12px", color: themeColors.textDim, fontWeight: 600, minWidth: k === "range" ? (isMobile ? 100 : 180) : undefined, cursor: "pointer", userSelect: "none" }} onClick={() => setOverviewTableSort(prev => ({ by: k, dir: prev.by === k && prev.dir === "asc" ? "desc" : "asc" }))} title={`Sort by ${col}`}>
                                {col} {overviewTableSort.by === k ? (overviewTableSort.dir === "asc" ? " ↑" : " ↓") : ""}
                              </th>
                            );
                          })}
                        </tr></thead>
                        <tbody>
                          {(() => {
                            const STATUS_ORD = { optimal: 0, elite: 1, sufficient: 2, low: 3, high: 4, "out-of-range": 5, unknown: 6 };
                            const filtered = Object.entries(cumulativeSnapshot).filter(([name, { val }]) => {
                              const s = getStatus(name, val);
                              return statusFilter === "high" ? (s === "high" || s === "out-of-range") : s === statusFilter;
                            });
                            const dir = overviewTableSort.dir === "asc" ? 1 : -1;
                            const sorted = [...filtered].sort(([aName, aSnap], [bName, bSnap]) => {
                              if (overviewTableSort.by === "name") return dir * aName.localeCompare(bName, undefined, { sensitivity: "base" });
                              if (overviewTableSort.by === "value") return dir * ((parseLabValue(aSnap.val).numeric ?? 0) - (parseLabValue(bSnap.val).numeric ?? 0)) || dir * aName.localeCompare(bName);
                              if (overviewTableSort.by === "range") return dir * ((STATUS_ORD[getStatus(aName, aSnap.val)] ?? 6) - (STATUS_ORD[getStatus(bName, bSnap.val)] ?? 6)) || dir * aName.localeCompare(bName);
                              if (overviewTableSort.by === "category") return dir * ((BIOMARKER_DB[aName]?.category ?? "").localeCompare(BIOMARKER_DB[bName]?.category ?? "")) || dir * aName.localeCompare(bName);
                              return 0;
                            });
                            return sorted.map(([name, { val }]) => {
                            const b = BIOMARKER_DB[name];
                            const status = getStatus(name, val);
                            const { display: displayVal, numeric: numVal } = parseLabValue(val);
                            const bar = buildRangeBar(b, numVal);
                            return (
                              <tr key={name} onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }} style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}>
                                <td style={{ padding: "10px 12px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.icon} {name} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
                                  {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 10, color: themeColors.textDim, marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                                </td>
                                <td
                                style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: statusColor(status) }}
                                title={val === undefined && DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, cumulativeSnapshot); return m.length ? `Not calculated: missing ${m.join(", ")}` : undefined; })() : undefined}
                              >{displayVal} {b.unit}</td>
                                <td style={{ padding: "8px 12px" }}><RangeBarSegments segments={bar.segments} valuePos={bar.valuePos} height={24} /></td>
                                <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{b.category}</td>
                              </tr>
                            );
                          });
                          })()}
                        </tbody>
                      </table>
                    </div>
                    )
                  )}

                  {/* Latest Values by Category — uses cumulative snapshot */}
                  {!statusFilter && (biomarkersViewMode === "cards" ? CATEGORIES.map(cat => {
                    const catMarkers = allBiomarkers.filter(b => BIOMARKER_DB[b].category === cat && cumulativeSnapshot[b]);
                    if (catMarkers.length === 0) return null;
                    return (
                      <div key={cat} className="card" style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 14, fontWeight: 600 }}>{cat.toUpperCase()}</div>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                          {catMarkers.map(name => {
                            const { val, date } = cumulativeSnapshot[name];
                            const status = getStatus(name, val);
                            const trend = getTrend(name);
                            const isOld = latestEntry && date !== latestEntry.date;
                            return (
                              <div key={name} onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }} style={{ padding: "12px 14px", borderRadius: 10, background: statusBg(status), border: `1px solid ${statusColor(status)}33`, cursor: "pointer", transition: "transform 0.15s", userSelect: "none" }}
                                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <span style={{ fontSize: 11, color: "#5a7a9a" }}>{name}</span>
                                  <span style={{ fontSize: 14 }}>{trend === "up" ? "↗" : trend === "down" ? "↘" : trend === "stable" ? "→" : ""}</span>
                                </div>
                                {BIOMARKER_DB[name]?.monitorFrequency && <div style={{ marginTop: 4 }}><MonitorFrequencyBadge frequency={BIOMARKER_DB[name].monitorFrequency} themeColors={themeColors} /></div>}
                                {BIOMARKER_DB[name]?.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 9, color: "#4a6a8a", marginTop: 2 }}>Calculated from: {getCalculatedFrom(name).join(", ")}</div>}
                                <div style={{ fontSize: 22, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif", marginTop: 4 }}>{parseLabValue(val).display}</div>
                                <div style={{ fontSize: 10, color: "#3a5a7a" }}>{BIOMARKER_DB[name]?.unit}</div>
                                {isOld && <div style={{ fontSize: 9, color: "#3a5a7a", marginTop: 3 }}>as of {new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>}
                                <div className="stat-pill" style={{ marginTop: 6, background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9 }}>
                                  {status.toUpperCase()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }) : (
                  <div className="card" style={{ marginBottom: 16, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                        {(["Biomarker", "Value", "Range", "Category"]).map(col => {
                          const key = col.toLowerCase().replace(/\s+/g, ""); const k = key === "biomarker" ? "name" : key === "value" ? "value" : key === "range" ? "range" : "category";
                          return (
                            <th key={col} style={{ textAlign: k === "value" ? "right" : "left", padding: "10px 12px", color: themeColors.textDim, fontWeight: 600, minWidth: k === "range" ? (isMobile ? 100 : 180) : undefined, cursor: "pointer", userSelect: "none" }} onClick={() => setOverviewTableSort(prev => ({ by: k, dir: prev.by === k && prev.dir === "asc" ? "desc" : "asc" }))} title={`Sort by ${col}`}>
                              {col} {overviewTableSort.by === k ? (overviewTableSort.dir === "asc" ? " ↑" : " ↓") : ""}
                            </th>
                          );
                        })}
                      </tr></thead>
                      <tbody>
                        {(() => {
                          const STATUS_ORD = { optimal: 0, elite: 1, sufficient: 2, low: 3, high: 4, "out-of-range": 5, unknown: 6 };
                          const filtered = Object.entries(cumulativeSnapshot).filter(([name]) => allBiomarkers.includes(name));
                          const dir = overviewTableSort.dir === "asc" ? 1 : -1;
                          const sorted = [...filtered].sort(([aName, aSnap], [bName, bSnap]) => {
                            if (overviewTableSort.by === "name") return dir * aName.localeCompare(bName, undefined, { sensitivity: "base" });
                            if (overviewTableSort.by === "value") return dir * ((parseLabValue(aSnap.val).numeric ?? 0) - (parseLabValue(bSnap.val).numeric ?? 0)) || dir * aName.localeCompare(bName);
                            if (overviewTableSort.by === "range") return dir * ((STATUS_ORD[getStatus(aName, aSnap.val)] ?? 6) - (STATUS_ORD[getStatus(bName, bSnap.val)] ?? 6)) || dir * aName.localeCompare(bName);
                            if (overviewTableSort.by === "category") return dir * ((BIOMARKER_DB[aName]?.category ?? "").localeCompare(BIOMARKER_DB[bName]?.category ?? "")) || dir * aName.localeCompare(bName);
                            return 0;
                          });
                          return sorted.map(([name, { val }]) => {
                            const b = BIOMARKER_DB[name];
                            const status = getStatus(name, val);
                            const { display: displayVal, numeric: numVal } = parseLabValue(val);
                            const bar = buildRangeBar(b, numVal);
                            return (
                              <tr key={name} onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }} style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}>
                                <td style={{ padding: "10px 12px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.icon} {name} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
                                  {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 10, color: themeColors.textDim, marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                                </td>
                                <td
                                style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: statusColor(status) }}
                                title={val === undefined && DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, cumulativeSnapshot); return m.length ? `Not calculated: missing ${m.join(", ")}` : undefined; })() : undefined}
                              >{displayVal} {b.unit}</td>
                                <td style={{ padding: "8px 12px" }}><RangeBarSegments segments={bar.segments} valuePos={bar.valuePos} height={24} /></td>
                                <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{b.category}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── BIOMARKERS VIEW ── */}
          {currentPerson && view === "biomarkers" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <input placeholder="Search biomarkers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 260 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["All", ...CATEGORIES].map(cat => (
                    <button key={cat} className={`tab-btn ${filterCat === cat ? "active" : ""}`} onClick={() => setFilterCat(cat)} style={{ fontSize: 11 }}>{cat}</button>
                  ))}
                  <button
                    className={`tab-btn ${filterRecord === "noRecord" ? "active" : ""}`}
                    onClick={() => setFilterRecord(filterRecord === "noRecord" ? "all" : "noRecord")}
                    style={{ fontSize: 11 }}
                  >
                    No record
                  </button>
                </div>
                <div style={{ marginLeft: isMobile ? 0 : "auto", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: themeColors.textDim }}>{totalBiomarkersCount} biomarkers · {noRecordCount} with no record</span>
                  <div style={{ display: "flex", gap: 0, border: `1px solid ${themeColors.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <button
                      type="button"
                      onClick={() => setBiomarkersViewMode("cards")}
                      style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "cards" ? themeColors.accent : "transparent", color: biomarkersViewMode === "cards" ? "#fff" : themeColors.textMuted }}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setBiomarkersViewMode("table")}
                      style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "table" ? themeColors.accent : "transparent", color: biomarkersViewMode === "table" ? "#fff" : themeColors.textMuted }}
                    >
                      Table
                    </button>
                  </div>
                </div>
              </div>

              {biomarkersViewMode === "cards" && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {filteredBiomarkers.map(name => {
                  const b = BIOMARKER_DB[name];
                  const snap = cumulativeSnapshot[name];
                  const snapVal = snap?.val;
                  const snapDate = snap?.date;
                  const status = snapVal !== undefined ? getStatus(name, snapVal) : "unknown";
                  const isOld = latestEntry && snapDate && snapDate !== latestEntry.date;
                  return (
                    <div key={name} className="card" style={{ cursor: "pointer", borderLeft: `3px solid ${statusColor(status)}` }}
                      onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#c8d8f0", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
                          <div style={{ fontSize: 10, color: "#3a5a7a", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.category} · {b.unit} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
                          {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 9, color: "#4a6a8a", marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); setShowInfoModal(name); }} style={{ background: "none", border: "none", color: "#3a5a7a", cursor: "pointer", fontSize: 16, padding: 4 }}>ⓘ</button>
                      </div>
                      {snapVal !== undefined ? (
                        <>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                            <span style={{ fontSize: 26, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{parseLabValue(snapVal).display}</span>
                            <span style={{ fontSize: 11, color: "#4a6a8a" }}>{b.unit}</span>
                            <div className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9, marginLeft: "auto" }}>{status.toUpperCase()}</div>
                          </div>
                          {isOld && (
                            <div style={{ fontSize: 9, color: "#3a5a7a", marginTop: 4 }}>
                              as of {new Date(snapDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          style={{ marginTop: 12, fontSize: 12, color: "#3a5a7a" }}
                          title={DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, cumulativeSnapshot); return m.length ? `Not calculated: missing ${m.join(", ")}` : "No data recorded"; })() : "No data recorded"}
                        >
                          No data recorded
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 10 }}>
                        <span style={{ color: RANGE_COLORS.optimal + "44", borderBottom: `1px solid ${RANGE_COLORS.optimal}44`, padding: "1px 0" }}>Optimal: {b.optimal[0]}–{b.optimal[1] > 999 ? "∞" : b.optimal[1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {biomarkersViewMode === "table" && (() => {
                const STATUS_SORT_ORDER = { optimal: 0, elite: 1, sufficient: 2, low: 3, high: 4, "out-of-range": 5, unknown: 6 };
                const trendRank = (name) => {
                  const trend = getTrend(name);
                  if (!trend) return 3;
                  const hib = higherIsBetter(name);
                  const improving = (trend === "up" && hib) || (trend === "down" && !hib);
                  const worsening = (trend === "up" && !hib) || (trend === "down" && hib);
                  if (improving) return 0;
                  if (trend === "stable") return 1;
                  if (worsening) return 2;
                  return 3;
                };
                const sortedForTable = [...filteredBiomarkers].sort((a, b) => {
                  const dir = biomarkersTableSort.dir === "asc" ? 1 : -1;
                  if (biomarkersTableSort.by === "name") {
                    return dir * a.localeCompare(b, undefined, { sensitivity: "base" });
                  }
                  if (biomarkersTableSort.by === "status") {
                    const statusA = cumulativeSnapshot[a]?.val !== undefined ? getStatus(a, cumulativeSnapshot[a].val) : "unknown";
                    const statusB = cumulativeSnapshot[b]?.val !== undefined ? getStatus(b, cumulativeSnapshot[b].val) : "unknown";
                    const rankA = STATUS_SORT_ORDER[statusA] ?? 6;
                    const rankB = STATUS_SORT_ORDER[statusB] ?? 6;
                    return dir * (rankA - rankB || a.localeCompare(b));
                  }
                  if (biomarkersTableSort.by === "category") {
                    const catA = BIOMARKER_DB[a]?.category ?? "";
                    const catB = BIOMARKER_DB[b]?.category ?? "";
                    return dir * (catA.localeCompare(catB) || a.localeCompare(b));
                  }
                  if (biomarkersTableSort.by === "trend") {
                    const rA = trendRank(a);
                    const rB = trendRank(b);
                    return dir * (rA - rB || a.localeCompare(b));
                  }
                  if (biomarkersTableSort.by === "value") {
                    const numA = cumulativeSnapshot[a]?.val !== undefined ? parseLabValue(cumulativeSnapshot[a].val).numeric : NaN;
                    const numB = cumulativeSnapshot[b]?.val !== undefined ? parseLabValue(cumulativeSnapshot[b].val).numeric : NaN;
                    return dir * ((Number.isFinite(numA) ? numA : -Infinity) - (Number.isFinite(numB) ? numB : -Infinity)) || dir * a.localeCompare(b);
                  }
                  if (biomarkersTableSort.by === "range") {
                    const statusA = cumulativeSnapshot[a]?.val !== undefined ? getStatus(a, cumulativeSnapshot[a].val) : "unknown";
                    const statusB = cumulativeSnapshot[b]?.val !== undefined ? getStatus(b, cumulativeSnapshot[b].val) : "unknown";
                    const rankA = STATUS_SORT_ORDER[statusA] ?? 6;
                    const rankB = STATUS_SORT_ORDER[statusB] ?? 6;
                    return dir * (rankA - rankB || a.localeCompare(b));
                  }
                  return 0;
                });
                const toggleSort = (by) => {
                  setBiomarkersTableSort(prev => ({ by, dir: prev.by === by && prev.dir === "asc" ? "desc" : "asc" }));
                };
                const thSortable = (label, sortKey, align = "left", extraStyle = {}) => (
                  <th
                    style={{ textAlign: align, padding: "10px 12px", color: themeColors.textDim, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", ...extraStyle }}
                    onClick={() => toggleSort(sortKey)}
                    title={`Sort by ${label}`}
                  >
                    {label} {biomarkersTableSort.by === sortKey ? (biomarkersTableSort.dir === "asc" ? "↑" : "↓") : ""}
                  </th>
                );
                return (
                  <div className="card" style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                          {thSortable("Biomarker", "name")}
                          {thSortable("Value", "value", "right")}
                          {thSortable("Range", "range", "left", { minWidth: isMobile ? 120 : 200 })}
                          {thSortable("Status", "status")}
                          {thSortable("Trend", "trend", "center")}
                          {thSortable("Category", "category")}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedForTable.map(name => {
                          const b = BIOMARKER_DB[name];
                          const snap = cumulativeSnapshot[name];
                          const val = snap?.val;
                          const status = val !== undefined ? getStatus(name, val) : "unknown";
                          const trend = getTrend(name);
                          const valueGoingUp = trend === "up";
                          const valueGoingDown = trend === "down";
                          const hib = higherIsBetter(name);
                          const improving = (valueGoingUp && hib) || (valueGoingDown && !hib);
                          const worsening = (valueGoingUp && !hib) || (valueGoingDown && hib);
                          const trendColor = improving ? RANGE_COLORS.optimal : worsening ? RANGE_COLORS.high : themeColors.textDim;
                          const { display: displayVal, numeric: numVal } = val !== undefined ? parseLabValue(val) : { display: "—", numeric: NaN };
                          const bar = buildRangeBar(b, numVal);
                          const trendTitle = trend ? (improving ? "Improving" : worsening ? "Worsening" : "Stable") : "Need 2+ readings";
                          return (
                            <tr
                              key={name}
                              onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }}
                              style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}
                            >
                              <td style={{ padding: "10px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.icon} {name} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}
                                <button type="button" onClick={e => { e.stopPropagation(); setShowInfoModal(name); }} style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", fontSize: 12, padding: "0 2px" }} title="Info">ⓘ</button></div>
                                {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 10, color: themeColors.textDim, marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                              </td>
                              <td
                                style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: val !== undefined ? statusColor(status) : themeColors.textDim, whiteSpace: "nowrap" }}
                                title={val === undefined && DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, cumulativeSnapshot); return m.length ? `Not calculated: missing ${m.join(", ")}` : undefined; })() : undefined}
                              >
                                {displayVal} {b.unit}
                              </td>
                              <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                                <RangeBarSegments segments={bar.segments} valuePos={bar.valuePos} height={24} />
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 10 }}>{status.replace(/-/g, " ")}</span>
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, color: trendColor }} title={trendTitle}>
                                {valueGoingUp ? "↗" : valueGoingDown ? "↘" : trend === "stable" ? "→" : "—"}
                              </td>
                              <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{b.category}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── TRENDS VIEW ── */}
          {currentPerson && view === "trends" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {selectedBiomarker ? (
                <TrendDetail name={selectedBiomarker} personEntries={personEntries} onBack={() => { setView(viewBeforeTrendDetail ?? "trends"); setSelectedBiomarker(null); setViewBeforeTrendDetail(null); }} themeColors={themeColors} />
              ) : (
                <>
                  <div style={{ marginBottom: 20, color: "#5a7a9a", fontSize: 13 }}>Click on any biomarker to view its trend over time</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {allBiomarkers.filter(name => {
                      const vals = personEntries.map(e => e.biomarkers?.[name]).filter(v => v !== undefined);
                      return vals.length > 0;
                    }).map(name => {
                      const vals = personEntries
                        .filter(e => e.biomarkers?.[name] !== undefined)
                        .map(e => {
                          const p = parseLabValue(e.biomarkers[name]);
                          return { date: e.date, value: p.numeric, displayValue: p.display };
                        })
                        .filter(p => !Number.isNaN(p.value));
                      const status = getStatus(name, vals[vals.length - 1]?.value);
                      return (
                        <div key={name} className="card" style={{ cursor: "pointer" }} onClick={() => setSelectedBiomarker(name)}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: "#c8d8f0", fontFamily: "Space Grotesk, sans-serif", fontWeight: 500 }}>{BIOMARKER_DB[name].icon} {name}</span>
                            <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9 }}>{status.toUpperCase()}</span>
                          </div>
                          <div style={{ height: 60 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={vals} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                <defs>
                                  <linearGradient id={`g-${name}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={statusColor(status)} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={statusColor(status)} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="value" stroke={statusColor(status)} strokeWidth={2} fill={`url(#g-${name})`} dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
                            <span style={{ color: "#3a5a7a" }}>{vals.length} data points</span>
                            <span style={{ color: statusColor(status), fontWeight: 600 }}>{vals[vals.length - 1]?.displayValue ?? vals[vals.length - 1]?.value} {BIOMARKER_DB[name].unit}</span>
                          </div>
                        </div>
                      );
                    })}
                    {personEntries.length === 0 && (
                      <div className="card" style={{ gridColumn: "1/-1", textAlign: "center", padding: 60 }}>
                        <div style={{ fontSize: 13, color: "#3a5a7a" }}>No biomarker data recorded yet. Import a PDF or add a manual entry.</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── HISTORY VIEW ── */}
          {currentPerson && view === "history" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {personEntries.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 13, color: "#3a5a7a" }}>No test history recorded yet.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 0, border: `1px solid ${themeColors.border}`, borderRadius: 8, overflow: "hidden" }}>
                      <button type="button" onClick={() => setBiomarkersViewMode("cards")} style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "cards" ? themeColors.accent : "transparent", color: biomarkersViewMode === "cards" ? "#fff" : themeColors.textMuted }}>Cards</button>
                      <button type="button" onClick={() => setBiomarkersViewMode("table")} style={{ padding: "6px 12px", fontSize: 11, border: "none", cursor: "pointer", background: biomarkersViewMode === "table" ? themeColors.accent : "transparent", color: biomarkersViewMode === "table" ? "#fff" : themeColors.textMuted }}>Table</button>
                    </div>
                  </div>
                  {[...personEntries].reverse().map(entry => {
                    const entryBiomarkers = computeDerivedBiomarkers(entry.biomarkers || {});
                    const markerCount = Object.keys(entryBiomarkers).length;
                    const optCount = Object.entries(entryBiomarkers).filter(([k, v]) => getStatus(k, v) === "optimal").length;
                    const isPendingDelete = confirmDeleteId === entry.id;
                    const profileName = currentPerson?.name || "";
                    const extractedName = entry.extractedName;
                    const extractedNameEnglish = entry.extractedNameEnglish;
                    const nameMismatch = extractedName && !nameAndSurnameMatch(profileName, extractedNameEnglish, extractedName);
                    return (
                      <div key={entry.id} className="card" style={{ marginBottom: 12, border: isPendingDelete ? "1px solid rgba(255,94,94,0.5)" : nameMismatch ? "1px solid rgba(255,180,80,0.7)" : undefined }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isPendingDelete ? 10 : 14 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#c8d8f0", fontFamily: "Space Grotesk, sans-serif" }}>
                              {new Date(entry.date + "T12:00:00").toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                            </div>
                            {extractedName != null && extractedName !== "" && (
                              <div style={{ fontSize: 12, color: nameMismatch ? "#e8a84a" : "#5a8ab0", marginTop: 4 }}>
                                {nameMismatch ? "⚠ " : ""}Patient on document: {extractedName}
                                {nameMismatch && <span style={{ marginLeft: 6, fontSize: 11, color: "#e8a84a" }}>(differs from profile)</span>}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: "#3a5a7a", marginTop: extractedName ? 2 : 0 }}>{markerCount} markers tracked · {optCount} optimal · <span style={{ color: "#3a6a9a" }}>click any marker to view trend</span></div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: RANGE_COLORS.optimal, fontFamily: "Space Grotesk, sans-serif" }}>
                              {markerCount > 0 ? Math.round(optCount / markerCount * 100) : 0}%
                            </div>
                            {!isPendingDelete ? (
                              <button
                                className="btn btn-danger"
                                style={{ padding: "6px 12px", fontSize: 11 }}
                                onClick={() => setConfirmDeleteId(entry.id)}
                              >🗑 Delete</button>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "#ff8888" }}>Delete this entry?</span>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
                                  onClick={() => { deleteEntry(selectedPerson, entry.id); setConfirmDeleteId(null); }}
                                >Yes, delete</button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: "6px 12px", fontSize: 12 }}
                                  onClick={() => setConfirmDeleteId(null)}
                                >Cancel</button>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isPendingDelete && (
                          biomarkersViewMode === "cards" ? (
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                            {Object.entries(entryBiomarkers).filter(([name]) => allBiomarkers.includes(name)).map(([name, val]) => {
                              if (!BIOMARKER_DB[name]) return null;
                              const status = getStatus(name, val);
                              return (
                                <div
                                  key={name}
                                  onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }}
                                  style={{ padding: "8px 12px", borderRadius: 8, background: statusBg(status), border: `1px solid ${statusColor(status)}22`, cursor: "pointer", transition: "transform 0.15s" }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.borderColor = statusColor(status) + "66"; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = statusColor(status) + "22"; }}
                                  title={`Click to view ${name} trend`}
                                >
                                  <div style={{ fontSize: 10, color: "#5a7a9a" }}>{name}</div>
                                  {BIOMARKER_DB[name]?.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 8, color: "#4a6a8a" }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                                  <div style={{ fontSize: 16, fontWeight: 600, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{parseLabValue(val).display}</div>
                                  <div style={{ fontSize: 9, color: "#3a5a7a" }}>{BIOMARKER_DB[name]?.unit}</div>
                                </div>
                              );
                            })}
                          </div>
                          ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead><tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                                {(["Biomarker", "Value", "Range", "Category"]).map(col => {
                                  const key = col.toLowerCase().replace(/\s+/g, ""); const k = key === "biomarker" ? "name" : key === "value" ? "value" : key === "range" ? "range" : "category";
                                  return (
                                    <th key={col} style={{ textAlign: k === "value" ? "right" : "left", padding: "10px 12px", color: themeColors.textDim, fontWeight: 600, minWidth: k === "range" ? (isMobile ? 100 : 180) : undefined, cursor: "pointer", userSelect: "none" }} onClick={() => setHistoryTableSort(prev => ({ by: k, dir: prev.by === k && prev.dir === "asc" ? "desc" : "asc" }))} title={`Sort by ${col}`}>
                                      {col} {historyTableSort.by === k ? (historyTableSort.dir === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                  );
                                })}
                              </tr></thead>
                              <tbody>
                                {(() => {
                                  const STATUS_ORD = { optimal: 0, elite: 1, sufficient: 2, low: 3, high: 4, "out-of-range": 5, unknown: 6 };
                                  const filtered = Object.entries(entryBiomarkers).filter(([name]) => allBiomarkers.includes(name));
                                  const dir = historyTableSort.dir === "asc" ? 1 : -1;
                                  const sorted = [...filtered].sort(([aName, aVal], [bName, bVal]) => {
                                    if (historyTableSort.by === "name") return dir * aName.localeCompare(bName, undefined, { sensitivity: "base" });
                                    if (historyTableSort.by === "value") return dir * ((parseLabValue(aVal).numeric ?? 0) - (parseLabValue(bVal).numeric ?? 0)) || dir * aName.localeCompare(bName);
                                    if (historyTableSort.by === "range") return dir * ((STATUS_ORD[getStatus(aName, aVal)] ?? 6) - (STATUS_ORD[getStatus(bName, bVal)] ?? 6)) || dir * aName.localeCompare(bName);
                                    if (historyTableSort.by === "category") return dir * ((BIOMARKER_DB[aName]?.category ?? "").localeCompare(BIOMARKER_DB[bName]?.category ?? "")) || dir * aName.localeCompare(bName);
                                    return 0;
                                  });
                                  return sorted.map(([name, val]) => {
                                    const b = BIOMARKER_DB[name];
                                    if (!b) return null;
                                    const status = getStatus(name, val);
                                    const { display: displayVal, numeric: numVal } = parseLabValue(val);
                                    const bar = buildRangeBar(b, numVal);
                                    return (
                                      <tr key={name} onClick={() => { setViewBeforeTrendDetail(view); setSelectedBiomarker(name); setView("trends"); }} style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}>
                                        <td style={{ padding: "10px 12px" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.icon} {name} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
                                          {b.calculated && getCalculatedFrom(name).length > 0 && <div style={{ fontSize: 10, color: themeColors.textDim, marginTop: 2 }}>From: {getCalculatedFrom(name).join(", ")}</div>}
                                        </td>
                                        <td
                                          style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: statusColor(status) }}
                                          title={val === undefined && DERIVED_BIOMARKERS[name] ? (() => { const m = getMissingDerivedSources(name, entry.biomarkers || {}); return m.length ? `Not calculated: missing ${m.join(", ")}` : undefined; })() : undefined}
                                        >{displayVal} {b.unit}</td>
                                        <td style={{ padding: "8px 12px" }}><RangeBarSegments segments={bar.segments} valuePos={bar.valuePos} height={24} /></td>
                                        <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{b.category}</td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS ── */}
      {showImportModal && importTargetPersonId != null && <ImportModal onClose={() => { setShowImportModal(false); setImportTargetPersonId(null); }} onImport={(date, biomarkers, extractedName, extractedNameEnglish) => { addEntry(importTargetPersonId, date, biomarkers, extractedName, extractedNameEnglish); setShowImportModal(false); setImportTargetPersonId(null); }} personName={people.find(p => p.id === importTargetPersonId)?.name} />}
      {showManualEntry && <ManualEntryModal onClose={() => setShowManualEntry(false)} onSave={(date, biomarkers) => { addEntry(selectedPerson, date, biomarkers); setShowManualEntry(false); }} person={currentPerson} />}
      {showAddPersonModal && <AddPersonModal onClose={() => setShowAddPersonModal(false)} onAdd={addPerson} />}
      {showEditPersonModal && currentPerson && (
        <EditPersonModal
          person={currentPerson}
          onClose={() => setShowEditPersonModal(false)}
          onSave={(updates) => { updatePerson(currentPerson.id, updates); setShowEditPersonModal(false); }}
        />
      )}
      {showInfoModal && <InfoModal name={showInfoModal} onClose={() => setShowInfoModal(null)} latestEntry={latestEntry} themeColors={themeColors} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} person={currentPerson} personEntries={personEntries} cumulativeSnapshot={cumulativeSnapshot} getBirthdayDisplay={getBirthdayDisplay} getAge={getAge} />}
    </div>
  );
}

// ─── TREND DETAIL ─────────────────────────────────────────────────────────────
function TrendDetail({ name, personEntries, onBack, themeColors }) {
  const b = BIOMARKER_DB[name];
  const data = personEntries
    .filter(e => e.biomarkers?.[name] !== undefined)
    .map(e => {
      const parsed = parseLabValue(e.biomarkers[name]);
      return {
        date: e.date,
        value: parsed.numeric,
        displayValue: parsed.display,
        status: getStatus(name, parsed.numeric),
        label: new Date(e.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        year: new Date(e.date + "T12:00:00").getFullYear(),
      };
    });

  const latestVal = data[data.length - 1]?.value;
  const latestDisplay = data[data.length - 1]?.displayValue;
  const status = getStatus(name, latestVal);

  // ── Compute WHOOP-style colored bands ──────────────────────────────────────
  const computeBands = () => {
    if (data.length === 0) return { bands: [], yDomain: [0, 100], ticks: [] };

    const dataVals = data.map(d => d.value);
    const lowEnabled = b.low && !(b.low[0] === 0 && b.low[1] === 0);
    const sufEnabled = b.sufficient && !(b.sufficient[0] === 0 && b.sufficient[1] === 0);
    const highEnabled = b.high && b.high[0] < 9000;
    const optHigh = b.optimal[1] > 900 ? null : b.optimal[1];

    // Collect meaningful boundary values for domain calculation
    const boundaries = [b.optimal[0]];
    if (optHigh) boundaries.push(optHigh);
    if (lowEnabled) boundaries.push(b.low[1]);
    if (sufEnabled && b.sufficient[1] < 9000) boundaries.push(b.sufficient[0], b.sufficient[1]);
    if (highEnabled) boundaries.push(b.high[0]);

    const allVals = [...dataVals, ...boundaries.filter(v => v != null)];
    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const span = rawMax - rawMin || rawMax * 0.4 || 10;

    // Y domain with padding
    const yMin = rawMin - span * 0.35;
    const yMax = rawMax + span * 0.35;
    const clamp = v => Math.max(yMin, Math.min(yMax, v));

    const bands = [];

    // Low / out-of-range band (below sufficient/optimal)
    const lowCeil = lowEnabled ? clamp(b.low[1]) : (sufEnabled && b.sufficient[0] < b.optimal[0] ? clamp(b.sufficient[0]) : clamp(b.optimal[0]));
    bands.push({ y1: yMin, y2: lowCeil, fill: RANGE_BAND_FILL.low, id: "low" });

    // Sufficient below optimal
    if (sufEnabled && b.sufficient[0] < b.optimal[0]) {
      const sufStart = lowEnabled ? clamp(b.low[1]) : yMin;
      const sufEnd = clamp(b.optimal[0]);
      if (sufEnd > sufStart) {
        bands.push({ y1: sufStart, y2: sufEnd, fill: RANGE_BAND_FILL.sufficient, id: "suf-low" });
      }
    }

    // Optimal band
    const optStart = clamp(b.optimal[0]);
    const optEnd = optHigh ? clamp(optHigh) : yMax;
    bands.push({ y1: optStart, y2: optEnd, fill: RANGE_BAND_FILL.optimal, id: "optimal" });

    // Sufficient above optimal
    if (sufEnabled && optHigh) {
      const sufAboveEnd = (highEnabled && b.high[0] < b.sufficient[1]) ? clamp(b.high[0]) : (b.sufficient[1] < 9000 ? clamp(b.sufficient[1]) : yMax);
      if (sufAboveEnd > optEnd) {
        bands.push({ y1: optEnd, y2: sufAboveEnd, fill: RANGE_BAND_FILL.sufficient, id: "suf-high" });
      }
    }

    // High / out-of-range band (above)
    const highStart = highEnabled ? clamp(b.high[0]) : (sufEnabled && b.sufficient[1] < 9000 ? clamp(b.sufficient[1]) : (optHigh ? clamp(optHigh) : yMax));
    if (highStart < yMax) {
      const highFill = b.eliteZone ? RANGE_BAND_FILL.elite : RANGE_BAND_FILL.high;
      bands.push({ y1: highStart, y2: yMax, fill: highFill, id: "high" });
    }

    // Y-axis ticks at boundary values
    const tickSet = new Set(
      boundaries
        .filter(v => v != null && v >= yMin && v <= yMax)
        .map(v => parseFloat(v.toFixed(2)))
    );
    const ticks = [...tickSet].sort((a, c) => a - c);

    return { bands, yDomain: [yMin, yMax], ticks };
  };

  const { bands, yDomain, ticks } = computeBands();

  // Custom X-axis tick: two lines (date + year)
  const CustomXTick = ({ x, y, payload }) => {
    const entry = data.find(d => d.label === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={14} textAnchor="middle" fill="#6a8aaa" fontSize={11} fontFamily="DM Mono, monospace">{payload.value}</text>
        {entry && <text x={0} y={0} dy={27} textAnchor="middle" fill="#4a6a8a" fontSize={10} fontFamily="DM Mono, monospace">{entry.year}</text>}
      </g>
    );
  };

  // Custom dot: colored ring + filled center + value label above
  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const col = statusColor(payload.status);
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill="#050a14" stroke={col} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={5} fill={col} />
        <text x={cx} y={cy - 18} textAnchor="middle" fill={col} fontSize={12} fontWeight="700" fontFamily="Space Grotesk, sans-serif">
          {payload.displayValue ?? payload.value}
        </text>
      </g>
    );
  };

  const CustomActiveDot = (props) => {
    const { cx, cy, payload } = props;
    const col = statusColor(payload.status);
    return (
      <g>
        <circle cx={cx} cy={cy} r={14} fill={col} fillOpacity={0.15} />
        <circle cx={cx} cy={cy} r={10} fill="#050a14" stroke={col} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={5} fill={col} />
      </g>
    );
  };

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 20 }}>← Back</button>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${statusColor(status)}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
            <div style={{ fontSize: 12, color: "#4a6a8a", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.category} · {b.unit} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && getCalculatedFrom(name).length > 0 && <span style={{ fontSize: 11, color: "#0ef" }}>Calculated from: {getCalculatedFrom(name).join(", ")}</span>}</div>
          </div>
          {(latestVal !== undefined || latestDisplay) && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1, marginBottom: 2 }}>LATEST</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>{latestDisplay ?? latestVal}</div>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 6 }}>{b.unit}</div>
              <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status) }}>{status.toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { label: "Out of Range / Low", color: RANGE_COLORS.low },
            { label: "Sufficient", color: RANGE_COLORS.sufficient },
            { label: "Optimal", color: RANGE_COLORS.optimal },
            ...(b.eliteZone
              ? [{ label: "Elite", color: RANGE_COLORS.elite }]
              : [{ label: "High", color: RANGE_COLORS.high }]
            ),
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 32, height: 12, borderRadius: 6, background: color, opacity: 0.85 }} />
              <span style={{ fontSize: 11, color: "#8aabcc", fontFamily: "DM Mono, monospace" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* WHOOP-style chart */}
        {data.length > 0 ? (
          <div style={{ height: 300, marginBottom: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 36, right: 30, bottom: 40, left: 24 }}>
                {/* Colored range bands — drawn first so they sit behind everything */}
                {bands.map((band, i) => (
                  <ReferenceArea key={i} y1={band.y1} y2={band.y2} fill={band.fill} fillOpacity={1} strokeWidth={0} ifOverflow="visible" />
                ))}

                <CartesianGrid strokeDasharray="0" stroke="rgba(26,48,80,0.4)" vertical={false} />

                <XAxis
                  dataKey="label"
                  stroke="transparent"
                  tick={<CustomXTick />}
                  tickLine={false}
                  axisLine={{ stroke: "#1a3050" }}
                  height={44}
                />
                <YAxis
                  domain={yDomain}
                  ticks={ticks}
                  stroke="transparent"
                  tick={{ fill: "#6a8aaa", fontSize: 11, fontFamily: "DM Mono, monospace" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => {
                    const n = parseFloat(v);
                    return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
                  }}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ background: "#0a1628", border: "1px solid #1a3050", borderRadius: 10, color: "#c8d8f0", fontFamily: "DM Mono, monospace", fontSize: 12 }}
                  formatter={(val, _, props) => [
                    <span style={{ color: statusColor(props.payload.status), fontWeight: 700 }}>{(props.payload.displayValue ?? val)} {b.unit}</span>,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (!payload?.[0]) return label;
                    const entry = data.find(d => d.label === label);
                    return entry ? `${label} ${entry.year}` : label;
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="rgba(180,210,240,0.5)"
                  strokeWidth={1.5}
                  dot={<CustomDot />}
                  activeDot={<CustomActiveDot />}
                  isAnimationActive={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a5a7a", fontSize: 13 }}>No data yet — add entries to see your trend</div>
        )}
      </div>

      {/* Range reference pills */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>REFERENCE RANGES</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {b.low && !(b.low[0] === 0 && b.low[1] === 0) && (
            <div className="stat-pill" style={{ background: RANGE_BG.low, color: RANGE_COLORS.low, border: `1px solid ${RANGE_COLORS.low}4D` }}>↓ Low: &lt;{b.low[1]} {b.unit}</div>
          )}
          {b.sufficient && !(b.sufficient[0] === 0 && b.sufficient[1] === 0) && (
            <div className="stat-pill" style={{ background: RANGE_BG.sufficient, color: RANGE_COLORS.sufficient, border: `1px solid ${RANGE_COLORS.sufficient}4D` }}>~ Sufficient: {b.sufficient[0]}–{b.sufficient[1] > 900 ? "∞" : b.sufficient[1]} {b.unit}</div>
          )}
          {b.optimal && (
            <div className="stat-pill" style={{ background: RANGE_BG.optimal, color: RANGE_COLORS.optimal, border: `1px solid ${RANGE_COLORS.optimal}4D` }}>✓ Optimal: {b.optimal[0]}–{b.optimal[1] > 900 ? "∞" : b.optimal[1]} {b.unit}</div>
          )}
          {b.high && b.high[0] < 9999 && (
            <div className="stat-pill" style={{ background: b.eliteZone ? RANGE_BG.elite : RANGE_BG.high, color: b.eliteZone ? RANGE_COLORS.elite : RANGE_COLORS.high, border: `1px solid ${(b.eliteZone ? RANGE_COLORS.elite : RANGE_COLORS.high)}4D` }}>
              {b.eliteZone ? "★ Elite: " : "↑ High: "}≥{b.high[0]} {b.unit}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>ABOUT THIS MARKER</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.description}</p>
        </div>
        <div className="card" style={{ borderLeft: `3px solid ${RANGE_COLORS.optimal}` }}>
          <div style={{ fontSize: 11, color: RANGE_COLORS.optimal, letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>HOW TO IMPROVE</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.improve}</p>
        </div>
      </div>
    </div>
  );
}

// ─── IMPORT MODAL ─────────────────────────────────────────────────────────────
const AI_PROVIDERS = { gemini: "Gemini", anthropic: "Claude", openai: "OpenAI", groq: "Groq" };
const AI_PROVIDER_FREE_TIER = { gemini: true, anthropic: true, openai: false, groq: true };

/** Compare profile name with document name: use English name (name+surname only) when present, set equality so order doesn't matter. */
function nameAndSurnameMatch(profileName, documentNameEnglish, documentNameAsOnDocument) {
  const profile = (profileName || "").trim();
  const docEn = (documentNameEnglish || "").trim();
  const docAs = (documentNameAsOnDocument || "").trim();
  if (docEn && profile) {
    const words = (s) => (s || "").toLowerCase().split(/\s+/).filter(Boolean);
    const set = (s) => new Set(words(s));
    const a = set(profile);
    const b = set(docEn);
    return a.size === b.size && [...a].every((w) => b.has(w));
  }
  if (docAs && profile) {
    const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
    return norm(profile) === norm(docAs);
  }
  return true;
}

/** Convert PDF base64 to an array of image data URLs (JPEG) for OpenAI. Max 15 pages. */
async function pdfToImages(pdfBase64, maxPages = 15) {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  GlobalWorkerOptions.workerSrc = workerMod.default;
  const binary = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const doc = await getDocument({ data: binary }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const urls = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    urls.push(canvas.toDataURL("image/jpeg", 0.92));
  }
  return urls;
}

// personName is used ONLY for UI (e.g. "Differs from profile (Zoya)"). It must NEVER be sent to the AI — extraction is from the document only.
function ImportModal({ onClose, onImport, personName }) {
  const [stage, setStage] = useState("upload");
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importStatus, setImportStatus] = useState("");
  const [importElapsed, setImportElapsed] = useState(0);
  const [editedBiomarkers, setEditedBiomarkers] = useState({});
  const [aiProvider, setAiProvider] = useState("gemini"); // "gemini" | "anthropic" | "openai" | "groq"
  const fileRef = useRef();

  useEffect(() => {
    if (!loading) return;
    setImportElapsed(0);
    const t = setInterval(() => setImportElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const toBase64 = (f) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  // Mime type for Gemini: PDF or supported image (jpeg, png, webp)
  const getGeminiMimeType = (f) => {
    const t = (f?.type || "").toLowerCase();
    if (t === "application/pdf") return "application/pdf";
    if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
    if (t === "image/png") return "image/png";
    if (t === "image/webp") return "image/webp";
    const name = (f?.name || "").toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    return "application/pdf";
  };

  const isAcceptedFile = (f) => {
    const t = (f?.type || "").toLowerCase();
    const name = (f?.name || "").toLowerCase();
    return t === "application/pdf" || name.endsWith(".pdf") ||
      t === "image/jpeg" || t === "image/jpg" || t === "image/png" || t === "image/webp" ||
      name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp");
  };

  // Auto-process as soon as a file is chosen
  const handleFileChange = (e) => {
    const chosen = e.target.files[0];
    if (chosen) {
      setFile(chosen);
      processFile(chosen);
    }
  };

  const processFile = async (chosenFile) => {
    const f = chosenFile || file;
    if (!f) return;
    const isDev = import.meta.env.DEV;
    const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
    const anthropicKey = (import.meta.env.VITE_ANTHROPIC_API_KEY || "").trim();
    const openaiKey = (import.meta.env.VITE_OPENAI_API_KEY || "").trim();
    const groqKey = (import.meta.env.VITE_GROQ_API_KEY || "").trim();
    if (aiProvider === "gemini" && !isDev && !geminiKey) {
      setError("API key not set. Set VITE_GEMINI_API_KEY in .env for production builds.");
      return;
    }
    if (aiProvider === "anthropic" && !anthropicKey) {
      const checklist = isDev
        ? " In dev: add to .env one line: VITE_ANTHROPIC_API_KEY=sk-ant-api03-... (no quotes, no space after =). Or set ANTHROPIC_API_KEY in your shell so the proxy can use it. Restart the dev server after changing .env."
        : " Set VITE_ANTHROPIC_API_KEY in .env for production builds.";
      setError("Anthropic API key not set or not visible to the app. " + checklist);
      return;
    }
    if (aiProvider === "openai" && !openaiKey) {
      const checklist = isDev
        ? " In dev: add VITE_OPENAI_API_KEY=sk-... to .env in the project root and restart the dev server."
        : " Set VITE_OPENAI_API_KEY in .env for production builds.";
      setError("OpenAI API key not set or not visible to the app. " + checklist);
      return;
    }
    if (aiProvider === "groq" && !groqKey) {
      const checklist = isDev
        ? " In dev: add VITE_GROQ_API_KEY=gsk_... to .env (get one at console.groq.com) and restart the dev server."
        : " Set VITE_GROQ_API_KEY in .env for production builds.";
      setError("Groq API key not set or not visible to the app. " + checklist);
      return;
    }
    const isPdf = (file) => (file?.type === "application/pdf") || (file?.name && file.name.toLowerCase().endsWith(".pdf"));
    setLoading(true);
    setError(null);
    setImportStatus("Reading file…");
    setImportElapsed(0);
    const IMPORT_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes
    const aborter = new AbortController();
    const timeoutId = setTimeout(() => aborter.abort(), IMPORT_TIMEOUT_MS);
    try {
      const b64 = await toBase64(f);
      const providerName = aiProvider === "anthropic" ? "Claude" : aiProvider === "openai" ? "OpenAI" : aiProvider === "groq" ? "Groq" : "Gemini";
      setImportStatus(`Sending document to ${providerName}…`);
      const targetUnits = Object.fromEntries(Object.entries(BIOMARKER_DB).map(([k, v]) => [k, v.unit]));

      // IMPORTANT: Do not pass the selected person's name or any profile data into the prompt. The AI must extract only from the document.
      const prompt = `You are a precision medical document parser specializing in international laboratory reports.
The input is a document (PDF or image such as a photo/scan of a lab report). Extract every biomarker you can find from the text or visible content.
The report may be in Norwegian, Russian, Armenian, or English.

PATIENT NAME — the ONLY valid source is the field labeled "Patient" or "Բուժառու" or "Name":
- Locate the line where one of these words appears as a label (usually near the top, before date of birth).
- extractedPersonName = the exact text that comes AFTER that label on the same line (or the next line). Copy character-for-character. Same order, same case.
- extractedPersonNameEnglish = that same name in English: format is usually SURNAME GivenName Patronymic → output "GivenName Surname" (word2 + word1; word3 is patronymic, do not use as first name).
- INVALID sources — do NOT use: signature line, "Signed by", "Ordered by", doctor name, clinic/lab name, license, address, footer, stamp, or any name that is not immediately after the "Patient"/"Բուժառու"/"Name" label. If the only names you see are in those places, set extractedPersonName and extractedPersonNameEnglish to null.

URINE TESTS — CRITICAL: If the document is a URINE test (e.g. "General Urine Test", "մեզ", "Urine", "biosample: urine", "Urisys", "urine analysis", "ՄԵԶԻ ՀԵՏԱԶՈՏՈՒԹՅՈՒՆ"), then:
- Do NOT put qualitative urine results into blood/serum biomarkers. Urine "glucose negative" / "նորմա" / "բացասական" is a presence check, NOT Fasting Glucose (blood). Urine "protein negative" is NOT Total Protein (serum) — use "Urine Protein" only if you have a numeric value or use 0 with a note. Urine "creatinine" in a dipstick context is NOT serum Creatinine.
- Only extract from urine reports: Specific Gravity (Urine), pH (Urine), Urine Protein (when numeric or negative→0), Urine Albumin, Urine Creatinine — when the report gives a numeric or clearly quantitative value. For qualitative results (negative, normal, positive) you may summarize in "notes" (e.g. "Urine: glucose neg, protein neg") but do NOT add Fasting Glucose, Creatinine, Total Protein, Bilirubin, etc. to "extracted" from those.
- Blood/serum panels: extract as usual.

ALSO extract:
1) The test/collection date from the document (look for date of collection, sample date, report date, etc.).
2) Patient name: use the PATIENT NAME rules above (extractedPersonName = text after "Patient"/"Բուժառու"; extractedPersonNameEnglish = GivenName Surname from that, second word = given name).

TARGET UNITS — you MUST convert every value to these exact units before returning:
${JSON.stringify(targetUnits, null, 2)}

GENERAL RULE FOR ALL BIOMARKERS: For every value you extract, identify the UNIT as stated on the lab report (e.g. g/L, mmol/L, mg/dL, nmol/L). Then convert to the target unit above before putting it in "extracted". Never assume the report uses the target unit — many labs use g/L for Hemoglobin, mmol/L for lipids/glucose, etc. If you output a value without converting from the report's unit, the result will be wrong (e.g. 144 g/L Hemoglobin must become 14.4 g/dL, not 144).

MANDATORY UNIT CONVERSION REFERENCE (apply these to every value):
Lipids / Cholesterol (Total Cholesterol, LDL Cholesterol, HDL Cholesterol):
  - mmol/L → mg/dL: multiply by 38.67
  - If already mg/dL: no change
Triglycerides:
  - mmol/L → mg/dL: multiply by 88.57
  - If already mg/dL: no change
ApoB: mg/dL target; g/L → mg/dL: × 100
Lp(a): nmol/L target; mg/dL → nmol/L: × 2.5; mg/L → nmol/L: × 0.25
Fasting Glucose: mg/dL target; mmol/L → mg/dL: × 18.016
HbA1c: % (NGSP) target; mmol/mol (IFCC) → %: (mmol/mol / 10.929) + 2.15
Fasting Insulin: μIU/mL target; pmol/L → μIU/mL: ÷ 6.945; mU/L = μIU/mL (no change)
Hemoglobin: g/dL target; g/L → g/dL: ÷ 10 (e.g. 144 g/L → 14.4 g/dL; do not output 144 if lab unit is g/L)
hs-CRP: mg/L target; mg/dL → mg/L: × 10
Homocysteine: μmol/L target (usually already correct)
ALT, AST, GGT: U/L target; nkat/L → U/L: × 0.0167
Creatinine: mg/dL target; μmol/L → mg/dL: ÷ 88.4; mmol/L → mg/dL: ÷ 0.0884
BUN: mg/dL target; urea mmol/L → BUN mg/dL: × 2.8
Uric Acid: mg/dL target; μmol/L → mg/dL: ÷ 59.48
TSH: mIU/L target (usually already correct)
Free T3: pg/mL target; pmol/L → pg/mL: × 0.651; ng/dL → pg/mL: × 10
Free T4: ng/dL target; pmol/L → ng/dL: × 0.0777
Total Testosterone: ng/dL target; nmol/L → ng/dL: × 28.84
Free Testosterone: pg/mL target; pmol/L → pg/mL: × 0.288; ng/dL → pg/mL: × 100
DHEA-S: μg/dL target; μmol/L → μg/dL: × 36.81
IGF-1: ng/mL target; nmol/L → ng/mL: × 7.649
Estradiol: pg/mL target; if already pg/mL use as-is; pmol/L → pg/mL: × 0.2724; nmol/L → pg/mL: × 272.4 (Norwegian labs often use nmol/L). Recognise as Estradiol: E2, Oestradiol, 17-beta estradiol, 17β-estradiol, S-Østradiol-17beta, S-Oestradiol-17beta — output key must be exactly "Estradiol".
Cortisol: μg/dL target; nmol/L → μg/dL: ÷ 27.59; ng/mL → μg/dL: ÷ 10
Vitamin D: ng/mL target; nmol/L → ng/mL: ÷ 2.496
Vitamin B12 (Total B12 only): pg/mL target; pmol/L → pg/mL: × 1.355. Do NOT apply this to Active B12.
Active B12: pmol/L target. If the lab result is already in pmol/L, use the value as-is — do NOT convert. Active B12 is different from Total B12.
Folate: ng/mL target; nmol/L → ng/mL: ÷ 2.266
Iron: μg/dL target; μmol/L → μg/dL: × 5.585
Magnesium: mg/dL target; mmol/L → mg/dL: × 2.432
Zinc: μg/dL target; μmol/L → μg/dL: × 6.54
Hemoglobin: g/dL target. Many labs report in g/L (e.g. 140–180 g/L for adults). You MUST convert: g/L → g/dL: ÷ 10. Example: 144 g/L = 14.4 g/dL (not 144). If already in g/dL, use as-is.
SHBG: nmol/L target (usually already correct)

Additional biomarkers (use EXACT name from target list; convert to target unit):
Cystatin C: mg/L target; μmol/L → mg/L: ÷ 8.92
Urine Albumin: mg/L target (urine); if reported as mg/dL multiply by 10 for mg/L
Urine Creatinine: mg/dL target (urine; same as serum unit)
Albumin-to-Creatinine Ratio: mg/g target (urine ACR); if reported as mg/mmol multiply by 0.113 for mg/g. Can be computed from Urine Albumin and Urine Creatinine when both from same test.
BUN/Creatinine Ratio: ratio (dimensionless); compute as BUN ÷ Creatinine if reported separately
RDW: % target (usually already correct); Red Cell Distribution Width = RDW
MCV: fL target; Mean Corpuscular Volume (usually already correct)
MCH: pg target; Mean Corpuscular Hemoglobin (usually already correct)
MCHC: g/dL target (usually already correct)
MPV: fL target; Mean Platelet Volume (usually already correct)
Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils: % target (CBC differential; usually already correct)
Total Protein: g/dL target; g/L → g/dL: ÷ 10
Albumin: g/dL target; g/L → g/dL: ÷ 10
Globulin: g/dL target; often computed as Total Protein − Albumin
Alkaline Phosphatase: U/L target (usually already correct); ALP = Alkaline Phosphatase
Bilirubin, Total: mg/dL target; μmol/L → mg/dL: ÷ 17.1
TPO Antibodies: IU/mL target; Thyroid peroxidase antibody, anti-TPO (usually already correct)
Thyroglobulin Antibodies: IU/mL target (usually already correct)
Prolactin: ng/mL target; μg/L = ng/mL (no change)
FSH, LH: mIU/mL target (usually already correct)
Vitamin A: μg/dL target; μmol/L → μg/dL: × 28.6
Calcium: mg/dL target; mmol/L → mg/dL: × 4
Sodium, Potassium, Chloride: mEq/L or mmol/L (usually same numeric)
Carbon Dioxide: mEq/L (bicarbonate; usually already correct)
Phosphate: mg/dL target; mmol/L → mg/dL: × 3.1
Selenium: μg/L target (usually already correct)
Copper: μg/dL target; μmol/L → μg/dL: × 6.35
Iodine: μg/L target (urine or serum; usually already correct)
CoQ10: μg/mL target (usually already correct)
Glutathione: μmol/L target (whole blood or RBC; lab-dependent)
PIVKA-II: mAU/mL target; DCP, des-gamma-carboxy prothrombin (usually already correct)
Non-HDL Cholesterol: mg/dL target; compute as Total Cholesterol − HDL Cholesterol if not reported
LDL Particle Number: nmol/L target (Ldl Particle Number, LDL-P; usually already correct)
Lipase, Amylase: U/L target (usually already correct)
Urine Protein: mg/dL target (Protein (Urine), urine protein; distinct from serum Total Protein)
Specific Gravity (Urine): ratio (e.g. 1.010–1.025; usually already correct)
pH (Urine): pH units (usually already correct)
TIBC: μg/dL target (Iron Binding Capacity, total iron-binding capacity; usually already correct)
Methylmalonic Acid: nmol/L target (MMA; usually already correct)
Leptin: ng/mL target (usually already correct)
Omega-3 Total, Omega-6 Total, EPA+DPA+DHA: % target when reported as % of fatty acids (Omega-3 index style); otherwise use lab unit
Omega-6/Omega-3 Ratio: ratio (dimensionless)
Lead: μg/dL target (blood lead; usually already correct)
Mercury: μg/L target (Mercury Blood; usually already correct)
Rheumatoid Factor: IU/mL target (usually already correct)
ANA Screen: titer or positive/negative (Antinuclear Antibodies Screen; output numeric if titer e.g. 1:40 as 40, or 0 if negative)
Band Neutrophils: % target (CBC; usually already correct)
Cholesterol/HDL Ratio: ratio; compute as Total Cholesterol ÷ HDL Cholesterol if not reported
Albumin/Globulin Ratio: ratio; compute as Albumin ÷ Globulin if not reported
Iron Saturation: % target; compute as (Iron ÷ TIBC)×100 if not reported (Iron % Saturation)
Recognise aliases: Holotranscobalamin = Active B12, holoTC = Active B12, Vitamin B12 (total) = Total B12, Glucose (fasting) = Fasting Glucose, CRP (hs) = hs-CRP, GGT = Gamma Glutamyl Transferase, eGFR = eGFR (estimated GFR). Blueprint names: Non Hdl Cholesterol = Non-HDL Cholesterol, Protein (Urine) = Urine Protein, White Blood Cell Count = WBC, Red Blood Cell Count = RBC, Platelet Count = Platelets, Triiodothyronine (T3 Free) = Free T3, Thyroxine (T4 Free) = Free T4, Thyroid Stimulating Hormone = TSH, Testosterone Total = Total Testosterone, Testosterone Free = Free Testosterone, Urea Nitrogen (Bun) = BUN, Estimated Glomerular Filtration Rate = eGFR, Hemoglobin A1C = HbA1c, High-Sensitivity C-Reactive Protein = hs-CRP, Sex Hormone Binding Globulin = SHBG, Dhea Sulfate = DHEA-S, Iron Binding Capacity = TIBC, Iron % Saturation = Iron Saturation, Ldl Particle Number = LDL Particle Number, Chol/Hdlc Ratio = Cholesterol/HDL Ratio, Albumin/Globulin Ratio = Albumin/Globulin Ratio.

LANGUAGE MAPPING (use EXACT English key in extracted output):
Norwegian: Kreatinin=Creatinine, Glukose=Fasting Glucose, Kolesterol=Total Cholesterol, Triglyserider=Triglycerides, Tyreoideastimulerende hormon/TSH=TSH, Urinsyre=Uric Acid, Homocystein=Homocysteine, Oestradiol=Estradiol, E2=Estradiol, S-Østradiol-17beta=Estradiol, S-Oestradiol-17beta=Estradiol
Russian: Креатинин=Creatinine, Глюкоза=Fasting Glucose, Холестерин=Total Cholesterol, Триглицериды=Triglycerides, ТТГ=TSH, Мочевая кислота=Uric Acid, Гомоцистеин=Homocysteine, ЛПНП=LDL Cholesterol, ЛПВП=HDL Cholesterol, Гемоглобин=Hemoglobin, Ферритин=Ferritin, Эстрадиол=Estradiol
Armenian: Կրեատինին=Creatinine, Գլյուկոզ=Fasting Glucose, Խոլեստerոլ=Total Cholesterol, Հեմoglobin=Hemoglobin
English: E2=Estradiol, Oestradiol=Estradiol, 17-beta estradiol=Estradiol

Return ONLY valid JSON. No markdown, no explanation, no newlines inside any string. Keep "notes" and "conversions" very short (one short phrase each). Format:
{"extracted":{"Exact Biomarker Name":"number_as_string",...},"conversions":{},"testDate":"YYYY-MM-DD or null","extractedPersonName":"Name exactly as on document or null","extractedPersonNameEnglish":"Same name in English, given name and family name only (no patronymic), or null","language":"en","notes":""}

Critical rules:
- Patient name: extractedPersonName must be the exact text that follows the label "Patient" or "Բուժառու" or "Name" on the document. Do not use a name from a signature, stamp, "Signed by", doctor, clinic, or any other field — only the line that is explicitly the patient field. If unsure, use null.
- URINE reports: Do not add Fasting Glucose, Creatinine (serum), Total Protein, Bilirubin, etc. from qualitative urine results (negative/normal/բացասական/նորմա). Only add urine-specific biomarkers (Specific Gravity (Urine), pH (Urine), Urine Protein, Urine Albumin, Urine Creatinine) when the report gives a numeric value.
- For every biomarker: detect the unit as stated on the report (g/L, mmol/L, mg/dL, etc.) and convert to the target unit before adding to "extracted". Never assume the lab uses the target unit — e.g. Hemoglobin 144 g/L → 14.4 g/dL; glucose 5.5 mmol/L → 99 mg/dL.
- Values in "extracted" MUST already be in the target units after conversion
- Use EXACT biomarker names from the target units object (e.g. "Estradiol" not "E2", "Active B12" not "B12 active").
- Estradiol: if pg/mL keep value; if pmol/L × 0.2724 → pg/mL; if nmol/L × 272.4 → pg/mL (e.g. Norwegian S-Østradiol-17beta in nmol/L).
- Active B12 and Total B12 (Vitamin B12) are different: Active B12 target unit is pmol/L — when the lab reports Active B12 in pmol/L, do NOT convert (no × 1.355). Only Total B12 / Vitamin B12 uses pg/mL and that conversion.
- Round sensibly: creatinine 2dp, glucose 1dp, lipids 0dp, hormones 1dp
- Only include biomarkers you are confident about` + (aiProvider === "groq" ? `

REMINDER — Patient name: Only the text that follows "Patient" or "Բուժառու" or "Name" is valid. Do NOT use a name from signature, "Signed by", doctor, clinic, stamp, or footer.` : "");

      const repairJsonString = (str) => {
        let out = "";
        let inString = false;
        let escape = false;
        const quote = '"';
        for (let i = 0; i < str.length; i++) {
          const c = str[i];
          if (escape) {
            out += c;
            escape = false;
            continue;
          }
          if (c === "\\") {
            out += c;
            escape = true;
            continue;
          }
          if (c === quote) {
            inString = !inString;
            out += c;
            continue;
          }
          if (inString && (c === "\n" || c === "\r")) {
            out += " ";
            continue;
          }
          out += c;
        }
        return out;
      };

      const tryRepairTruncated = (str) => {
        let s = str.trim();
        let inString = false;
        let escape = false;
        let depth = 0;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (c === "\\" && inString) {
            escape = true;
            continue;
          }
          if ((c === '"') && (i === 0 || s[i - 1] !== "\\")) inString = !inString;
          if (!inString) {
            if (c === "{") depth++;
            else if (c === "}") depth--;
          }
        }
        if (inString) s += '"';
        while (depth > 0) {
          s += "}";
          depth--;
        }
        return s;
      };

      const parseGeminiJson = (rawText) => {
        const cleaned = repairJsonString(rawText);
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        const slice = firstBrace !== -1 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
        const candidates = [slice, cleaned, tryRepairTruncated(slice), tryRepairTruncated(cleaned)];
        for (const candidate of candidates) {
          try {
            const p = JSON.parse(candidate);
            if (p && typeof p.extracted === "object") return p;
          } catch (_) {}
        }
        return null;
      };

      let parsed = null;

      if (aiProvider === "anthropic") {
        const apiUrl = isDev ? "/api/anthropic" : "https://api.anthropic.com/v1/messages";
        const headers = { "Content-Type": "application/json", "anthropic-version": "2023-06-01" };
        if (anthropicKey) headers["x-api-key"] = anthropicKey;
        const mimeType = f.type || (f.name && f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
        const mediaType = mimeType === "application/pdf" ? "application/pdf" : (mimeType === "image/png" ? "image/png" : mimeType === "image/webp" ? "image/webp" : "image/jpeg");
        if (mediaType === "application/pdf") headers["anthropic-beta"] = "pdfs-2024-09-25";
        const contentBlocks = [];
        if (mediaType === "application/pdf") {
          contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
        } else {
          contentBlocks.push({ type: "image", source: { type: "base64", media_type, data: b64 } });
        }
        contentBlocks.push({ type: "text", text: prompt });
        const requestBody = { model: "claude-3-5-sonnet-20241022", max_tokens: 2000, messages: [{ role: "user", content: contentBlocks }] };
        const bodyString = JSON.stringify(requestBody);
        const requestSizeBytes = new TextEncoder().encode(bodyString).length;
        const requestSizeMB = (requestSizeBytes / (1024 * 1024)).toFixed(2);
        setImportStatus("Waiting for Claude response…");
        for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
          const response = await fetch(apiUrl, { method: "POST", headers, body: bodyString, signal: aborter.signal });
          if (!response.ok) {
            const errBody = await response.text();
            if (response.status === 401 || response.status === 403) {
              const hint = isDev
                ? " In .env use exactly one line: VITE_ANTHROPIC_API_KEY=sk-ant-api03-... (no quotes, no space after =). Or set ANTHROPIC_API_KEY for the dev proxy. Restart the dev server after any change. If the key looks correct, create a new key at console.anthropic.com and replace it."
                : " Set VITE_ANTHROPIC_API_KEY in your build env. Create or rotate the key at console.anthropic.com if needed.";
              throw new Error("Anthropic rejected the API key (invalid or missing). " + hint);
            }
            if (response.status === 429) throw new Error("Anthropic rate limit exceeded. Wait a minute and retry.");
            const shortBody = errBody.length > 300 ? errBody.slice(0, 300) + "…" : errBody;
            const plain = shortBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || String(response.status);
            const gatewayErr = response.status === 502 || response.status === 503 || response.status === 504;
            if (gatewayErr && attempt === 0) {
              await new Promise(r => setTimeout(r, 2500));
              continue;
            }
            let diag = "";
            if (gatewayErr) {
              const cfRay = response.headers.get("cf-ray");
              const sizeHint = requestSizeBytes > 5 * 1024 * 1024 ? ` Request body is ${requestSizeMB} MB (Anthropic limit 32 MB); large payloads can trigger 502 — try a smaller file or an image instead of PDF.` : ` Request body ${requestSizeMB} MB.`;
              diag = sizeHint + (cfRay ? ` Cloudflare request ID: ${cfRay}.` : "") + " Often temporary — retry later or use Gemini.";
            }
            throw new Error(`Anthropic API error ${response.status}: ${plain}${diag}`);
          }
          const data = await response.json();
          const text = (data.content || []).map((i) => (i && i.text) || "").join("");
          if (!text.trim()) throw new Error("Claude returned no text; try another file.");
          setImportStatus("Parsing results…");
          const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
          parsed = parseGeminiJson(clean);
        }
      } else if (aiProvider === "openai") {
        const openaiKey = (import.meta.env.VITE_OPENAI_API_KEY || "").trim();
        const openaiBase = isDev ? "/api/openai" : "https://api.openai.com";
        let imageUrls;
        if (isPdf(f)) {
          setImportStatus("Converting PDF to images…");
          try {
            imageUrls = await pdfToImages(b64);
          } catch (e) {
            throw new Error("Failed to convert PDF to images: " + (e?.message || String(e)));
          }
          if (!imageUrls?.length) throw new Error("PDF had no renderable pages.");
        } else {
          const imageMime = f.type || (f.name && f.name.toLowerCase().endsWith(".webp") ? "image/webp" : f.name && f.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
          imageUrls = [`data:${imageMime};base64,${b64}`];
        }
        const contentParts = imageUrls.map((url) => ({ type: "image_url", image_url: { url } }));
        contentParts.push({ type: "text", text: prompt });
        const openaiBody = {
          model: "gpt-4o",
          messages: [{ role: "user", content: contentParts }],
          max_tokens: 2000,
        };
        setImportStatus("Waiting for OpenAI response…");
        const openaiRes = await fetch(`${openaiBase}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(openaiKey ? { Authorization: `Bearer ${openaiKey}` } : {}) },
          body: JSON.stringify(openaiBody),
          signal: aborter.signal,
        });
        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          if (openaiRes.status === 401 || openaiRes.status === 403) {
            const hint = isDev ? " Check VITE_OPENAI_API_KEY in .env and restart the dev server." : " Check VITE_OPENAI_API_KEY in your build env.";
            throw new Error("OpenAI rejected the API key (invalid or missing). " + hint);
          }
          if (openaiRes.status === 429) {
            throw new Error("OpenAI quota exceeded (billing required). Switch to Gemini or Claude (free tier) above and try again.");
          }
          throw new Error(`OpenAI API error ${openaiRes.status}: ${(errText || String(openaiRes.status)).slice(0, 300)}`);
        }
        const openaiData = await openaiRes.json();
        const openaiText = openaiData?.choices?.[0]?.message?.content ?? "";
        if (!openaiText.trim()) throw new Error("OpenAI returned no text; try another image.");
        setImportStatus("Parsing results…");
        const clean = openaiText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        parsed = parseGeminiJson(clean);
      } else if (aiProvider === "groq") {
        const groqKey = (import.meta.env.VITE_GROQ_API_KEY || "").trim();
        const groqBase = isDev ? "/api/groq" : "https://api.groq.com";
        let imageUrls;
        if (isPdf(f)) {
          setImportStatus("Converting PDF to images…");
          try {
            imageUrls = (await pdfToImages(b64, 5)).slice(0, 5);
          } catch (e) {
            throw new Error("Failed to convert PDF to images: " + (e?.message || String(e)));
          }
          if (!imageUrls?.length) throw new Error("PDF had no renderable pages.");
        } else {
          const imageMime = f.type || (f.name && f.name.toLowerCase().endsWith(".webp") ? "image/webp" : f.name && f.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
          imageUrls = [`data:${imageMime};base64,${b64}`];
        }
        const contentParts = imageUrls.map((url) => ({ type: "image_url", image_url: { url } }));
        contentParts.push({ type: "text", text: prompt });
        const groqBody = {
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: contentParts }],
          max_tokens: 2000,
        };
        setImportStatus("Waiting for Groq response…");
        const groqRes = await fetch(`${groqBase}/openai/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(groqKey ? { Authorization: `Bearer ${groqKey}` } : {}) },
          body: JSON.stringify(groqBody),
          signal: aborter.signal,
        });
        if (!groqRes.ok) {
          const errText = await groqRes.text();
          if (groqRes.status === 401 || groqRes.status === 403) {
            const hint = isDev ? " Check VITE_GROQ_API_KEY in .env and restart the dev server." : " Check VITE_GROQ_API_KEY in your build env.";
            throw new Error("Groq rejected the API key (invalid or missing). Get a key at console.groq.com. " + hint);
          }
          if (groqRes.status === 429) throw new Error("Groq rate limit exceeded. Wait a minute and retry.");
          throw new Error(`Groq API error ${groqRes.status}: ${(errText || String(groqRes.status)).slice(0, 300)}`);
        }
        const groqData = await groqRes.json();
        const groqText = groqData?.choices?.[0]?.message?.content ?? "";
        if (!groqText.trim()) throw new Error("Groq returned no text; try another file.");
        setImportStatus("Parsing results…");
        const clean = groqText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        parsed = parseGeminiJson(clean);
      } else {
        const geminiModel = "gemini-2.5-flash";
        const apiBase = isDev ? "/api/gemini" : "https://generativelanguage.googleapis.com";
        const apiUrl = `${apiBase}/v1beta/models/${geminiModel}:generateContent`;
        const headers = { "Content-Type": "application/json" };
        if (!isDev && geminiKey) headers["x-goog-api-key"] = geminiKey;
        const mimeType = getGeminiMimeType(f);
        const requestBody = {
          contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: b64 } }, { text: prompt }] }],
          generationConfig: { maxOutputTokens: 16384, temperature: 0.1 },
        };
        setImportStatus("Waiting for Gemini response…");
        for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
          const response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(requestBody), signal: aborter.signal });
          if (!response.ok) {
            const errBody = await response.text();
            if (response.status === 401 || response.status === 403) {
              throw new Error(
                "Invalid or missing Gemini API key. Set VITE_GEMINI_API_KEY in .env or GEMINI_API_KEY in your environment. Get a key at aistudio.google.com/app/apikey"
              );
            }
            if (response.status === 429) {
              throw new Error(
                "Gemini quota exceeded (rate limit or daily free tier). Wait a minute and retry, or check usage at ai.dev/rate-limit. Paid plans get higher limits."
              );
            }
            throw new Error(`API error ${response.status}: ${errBody}`);
          }
          const data = await response.json();
          const candidate = data.candidates?.[0];
          const parts = candidate?.content?.parts;
          if (!Array.isArray(parts)) {
            const blockReason = data.promptFeedback?.blockReason;
            if (blockReason) throw new Error(`Content blocked: ${blockReason}. Try a different file.`);
            throw new Error("Unexpected Gemini response: no text in candidates.");
          }
          const text = parts.map((p) => (p && p.text) || "").join("");
          if (!text.trim()) throw new Error("Gemini returned no text; try another file.");
          setImportStatus("Parsing results…");
          const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
          parsed = parseGeminiJson(clean);
        }
      }

      if (!parsed) {
        throw new Error(
          (aiProvider === "anthropic" ? "Claude" : aiProvider === "openai" ? "OpenAI" : aiProvider === "groq" ? "Groq" : "Gemini") + " returned invalid or truncated JSON. Try again or use a shorter/simpler document."
        );
      }
      setResult(parsed);
      setEditedBiomarkers(parsed.extracted || {});
      // Auto-fill detected test date
      if (parsed.testDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.testDate)) {
        setDate(parsed.testDate);
      }
      setStage("review");
    } catch (e) {
      if (e.name === "AbortError") {
        setError("Request timed out after 8 minutes. Try a smaller file or switch to Gemini.");
      } else {
        setError("Failed to process file: " + e.message);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setImportStatus("");
    }
  };

  const handleConfirm = () => {
    const filtered = Object.fromEntries(Object.entries(editedBiomarkers).filter(([k, v]) => v !== "" && v !== undefined));
    const withDerived = computeDerivedBiomarkers(filtered);
    const extractedName = result?.extractedPersonName != null && String(result.extractedPersonName).trim() !== "" ? String(result.extractedPersonName).trim() : null;
    const extractedNameEnglish = result?.extractedPersonNameEnglish != null && String(result.extractedPersonNameEnglish).trim() !== "" ? String(result.extractedPersonNameEnglish).trim() : null;
    onImport(date, withDerived, extractedName, extractedNameEnglish);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>📄 Import Bloodwork (PDF or Image)</div>
            <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 8 }}>Gemini · Claude · Groq free tier; OpenAI requires billing. · EN / NO / RU / HY</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(Object.keys(AI_PROVIDERS)).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAiProvider(key)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid " + (aiProvider === key ? "#5a9" : "#2a4a6a"),
                    borderRadius: 8,
                    background: aiProvider === key ? "rgba(85,170,153,0.25)" : "transparent",
                    color: aiProvider === key ? "#8cf" : "#6a8",
                    cursor: "pointer",
                  }}
                >
                  {AI_PROVIDERS[key]}
                  {AI_PROVIDER_FREE_TIER[key] && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.9 }}>(Free)</span>}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {stage === "upload" && (
          <>
            {/* Drop zone — clicking opens file picker which auto-triggers extraction */}
            <div
              onClick={() => !loading && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped && isAcceptedFile(dropped)) {
                  setFile(dropped);
                  processFile(dropped);
                }
              }}
              style={{
                border: `2px dashed ${loading ? "#0ef" : file ? "#0ef" : "#1a3050"}`,
                borderRadius: 12, padding: 48, textAlign: "center",
                cursor: loading ? "default" : "pointer",
                marginBottom: 16, transition: "all 0.2s",
                background: loading ? "rgba(0,238,255,0.06)" : file ? "rgba(0,238,255,0.04)" : "transparent",
              }}>
              <input ref={fileRef} type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFileChange} />
              {loading ? (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(0,238,255,0.3)", borderTopColor: "#0ef", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
                  <div style={{ color: "#0ef", fontSize: 14, fontWeight: 600 }}>{importStatus || "Analysing document…"}</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 6 }}>
                    {importElapsed > 0 ? `${Math.floor(importElapsed / 60)}m ${importElapsed % 60}s elapsed` : "Detecting language, extracting & converting units"}
                    {importStatus && importStatus.includes("Waiting") ? " · timeout after 8 min" : ""}
                  </div>
                </>
              ) : file ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ color: "#0ef", fontSize: 14, fontWeight: 600 }}>{file.name}</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 4 }}>Processing automatically…</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                  <div style={{ color: "#8aabcc", fontSize: 14, fontWeight: 500 }}>Click or drag & drop your bloodwork (PDF or image)</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 6 }}>PDF, JPEG, PNG, WebP · Norwegian · Russian · Armenian · English · Auto-detects date & units</div>
                </>
              )}
            </div>

            {error && (
              <div style={{ background: "rgba(255,94,94,0.1)", border: "1px solid rgba(255,94,94,0.3)", borderRadius: 8, padding: 14, fontSize: 12, color: "#ff8888", marginBottom: 16, lineHeight: 1.6 }}>
                <strong style={{ color: "#ff5e5e" }}>⚠ Import failed</strong><br />{error}
                <div style={{ marginTop: 10 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => { setError(null); setFile(null); }}>Try again</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {stage === "review" && result && (
          <>
            <div style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: RANGE_COLORS.optimal }}>✓ Language: {result.language}</span>
                <span style={{ color: "#4a6a8a" }}>· {Object.keys(editedBiomarkers).length} markers extracted</span>
                {result.conversions && Object.keys(result.conversions).length > 0 && (
                  <span style={{ color: RANGE_COLORS.sufficient }}>· {Object.keys(result.conversions).length} units converted</span>
                )}
                {result.testDate && <span style={{ color: "#0ef" }}>· Date auto-detected</span>}
              </div>
              {result.extractedPersonName != null && String(result.extractedPersonName).trim() !== "" && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,229,160,0.15)" }}>
                  <span style={{ color: "#5a8ab0" }}>Patient on document: </span>
                  <span style={{ color: "#8aabcc" }}>{result.extractedPersonName}</span>
                  {(personName || "").trim() && !nameAndSurnameMatch(personName, result.extractedPersonNameEnglish, result.extractedPersonName) && (
                    <span style={{ color: "#e8a84a", marginLeft: 8 }}>⚠ Differs from selected profile ({personName})</span>
                  )}
                </div>
              )}
              {result.notes && <div style={{ color: "#4a6a8a", marginTop: 4, fontSize: 11 }}>{result.notes}</div>}
            </div>

            {/* Editable test date */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>TEST DATE {result.testDate ? <span style={{ color: "#0ef", textTransform: "none", letterSpacing: 0 }}>(auto-detected)</span> : <span style={{ color: RANGE_COLORS.sufficient, textTransform: "none", letterSpacing: 0 }}>(not found in document — please set manually)</span>}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ marginTop: 6, maxWidth: 200 }} />
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 16 }}>
              {Object.entries(editedBiomarkers).map(([name, val]) => {
                const status = val ? getStatus(name, val) : null;
                const convNote = result.conversions?.[name];
                return (
                  <div key={name} style={{ padding: "10px 0", borderBottom: "1px solid #0d1c30" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#8aabcc" }}>{BIOMARKER_DB[name]?.icon} {name}</div>
                        {convNote && <div style={{ fontSize: 10, color: RANGE_COLORS.sufficient, marginTop: 2 }}>🔄 {convNote}</div>}
                      </div>
                      <div style={{ fontSize: 10, color: "#3a5a7a", width: 80, textAlign: "right", flexShrink: 0 }}>{BIOMARKER_DB[name]?.unit}</div>
                      <input
                        value={val}
                        onChange={e => setEditedBiomarkers(prev => ({ ...prev, [name]: e.target.value }))}
                        style={{ width: 90, textAlign: "right", flexShrink: 0, borderColor: status ? statusColor(status) + "88" : undefined }}
                      />
                      {status && (
                        <div className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9, flexShrink: 0, width: 70, justifyContent: "center" }}>
                          {status.toUpperCase()}
                        </div>
                      )}
                      <button onClick={() => setEditedBiomarkers(prev => { const n = { ...prev }; delete n[name]; return n; })} style={{ background: "none", border: "none", color: "#3a5a7a", cursor: "pointer", flexShrink: 0, fontSize: 14 }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => { setStage("upload"); setFile(null); setResult(null); setError(null); }}>← Re-upload</button>
              <button className="btn btn-primary" onClick={handleConfirm}>✓ Save {Object.keys(editedBiomarkers).length} Markers</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── MANUAL ENTRY MODAL ───────────────────────────────────────────────────────
function ManualEntryModal({ onClose, onSave, person }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [values, setValues] = useState({});
  const [catFilter, setCatFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSave = () => {
    const nonEmpty = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
    if (Object.keys(nonEmpty).length === 0) { alert("Please enter at least one value."); return; }
    onSave(date, nonEmpty);
  };

  const filtered = getBiomarkersForPerson(person || null).filter(b => {
    const cat = BIOMARKER_DB[b].category;
    return (catFilter === "All" || cat === catFilter) && (!searchTerm || b.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>+ Manual Entry</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>TEST DATE</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ marginTop: 6, maxWidth: 200 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 180, fontSize: 12 }} />
          {["All", ...CATEGORIES].map(c => (
            <button key={c} className={`tab-btn ${catFilter === c ? "active" : ""}`} onClick={() => setCatFilter(c)} style={{ fontSize: 10 }}>{c}</button>
          ))}
        </div>
        <div className="modal-grid-2" style={{ maxHeight: 380, overflowY: "auto", marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {filtered.map(name => {
            const b = BIOMARKER_DB[name];
            const status = values[name] ? getStatus(name, values[name]) : null;
            return (
              <div key={name} style={{ padding: "10px 12px", borderRadius: 8, background: "#060d1e", border: `1px solid ${status ? statusColor(status) + "44" : "#1a3050"}` }}>
                <div style={{ fontSize: 11, color: "#5a7a9a", marginBottom: 6 }}>{b.icon} {name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" placeholder="—" value={values[name] || ""} onChange={e => setValues(prev => ({ ...prev, [name]: e.target.value }))} style={{ textAlign: "right", flex: 1 }} />
                  <span style={{ fontSize: 10, color: "#3a5a7a", whiteSpace: "nowrap" }}>{b.unit}</span>
                </div>
                {values[name] && (
                  <div style={{ marginTop: 4 }}>
                    <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), fontSize: 9 }}>{status?.toUpperCase()}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#3a5a7a" }}>{Object.values(values).filter(v => v).length} values entered</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Entry</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADD PERSON MODAL ─────────────────────────────────────────────────────────
function AddPersonModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", birthday: "", gender: "Male" });
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>Add Person</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>FULL NAME</label>
          <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ marginTop: 6 }} placeholder="e.g. Alex Johnson" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>DATE OF BIRTH</label>
          <input type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} style={{ marginTop: 6 }} />
          {form.birthday && (
            <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 6 }}>
              {new Date(form.birthday + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>GENDER</label>
          <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={{ marginTop: 6 }}>
            {["Male", "Female", "Other"].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => form.name && onAdd(form)}>Add Person</button>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT PERSON MODAL ────────────────────────────────────────────────────────
function EditPersonModal({ person, onClose, onSave }) {
  const [form, setForm] = useState({
    name: person.name ?? "",
    birthday: person.birthday ?? "",
    gender: person.gender ?? "Male",
  });

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) return;
    onSave({ name, birthday: form.birthday || undefined, gender: form.gender });
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>Edit Person</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>FULL NAME</label>
          <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ marginTop: 6 }} placeholder="e.g. Alex Johnson" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>DATE OF BIRTH</label>
          <input type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} style={{ marginTop: 6 }} />
          {form.birthday && (
            <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 6 }}>
              {new Date(form.birthday + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>GENDER</label>
          <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={{ marginTop: 6 }}>
            {["Male", "Female", "Other"].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── INFO MODAL ───────────────────────────────────────────────────────────────
function InfoModal({ name, onClose, latestEntry, themeColors }) {
  const b = BIOMARKER_DB[name];
  const val = latestEntry?.biomarkers?.[name];
  const status = val !== undefined ? getStatus(name, val) : null;
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
            <div style={{ fontSize: 11, color: "#3a5a7a", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.category} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && <span className="stat-pill" style={{ fontSize: 9, background: "rgba(0,229,160,0.15)", color: "#0ef" }}>Calculated</span>}</div>
            {b.calculated && getCalculatedFrom(name).length > 0 && (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.25)" }}>
                <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 6, fontWeight: 600 }}>CALCULATED FROM</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#8aabcc" }}>This value is computed from the same test using: <strong>{getCalculatedFrom(name).join(", ")}</strong>.</p>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {val !== undefined && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: statusBg(status), border: `1px solid ${statusColor(status)}33`, marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{parseLabValue(val).display} {b.unit}</div>
            <div className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), marginTop: 4 }}>{status?.toUpperCase()}</div>
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>REFERENCE RANGES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {b.optimal && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)" }}>
              <span style={{ color: RANGE_COLORS.optimal, fontSize: 13 }}>✓ Optimal</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>{b.optimal[0]} – {b.optimal[1] > 999 ? "∞" : b.optimal[1]} {b.unit}</span>
            </div>}
            {b.sufficient && b.sufficient[0] > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)" }}>
              <span style={{ color: RANGE_COLORS.sufficient, fontSize: 13 }}>~ Sufficient</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>{b.sufficient[0]} – {b.sufficient[1]} {b.unit}</span>
            </div>}
            {b.high && b.high[0] < 9999 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,94,94,0.08)", border: "1px solid rgba(255,94,94,0.2)" }}>
              <span style={{ color: "#ff5e5e", fontSize: 13 }}>↑ High Risk</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>≥{b.high[0]} {b.unit}</span>
            </div>}
            {b.low && b.low[1] > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,140,66,0.08)", border: "1px solid rgba(255,140,66,0.2)" }}>
              <span style={{ color: "#ff8c42", fontSize: 13 }}>↓ Low Risk</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>≤{b.low[1]} {b.unit}</span>
            </div>}
          </div>
        </div>
        {b.monitorFrequency && MONITOR_FREQUENCY_LABELS[b.monitorFrequency] && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>MONITORING (Blueprint Biomarkers)</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>Suggested retest: <strong>{MONITOR_FREQUENCY_LABELS[b.monitorFrequency]}</strong>. Based on <a href="https://blueprintbiomarkers.com" target="_blank" rel="noopener noreferrer" style={{ color: "#0ef" }}>blueprintbiomarkers.com</a> (2×/year panels).</p>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>ABOUT</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.description}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: RANGE_COLORS.optimal, letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>HOW TO IMPROVE</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.improve}</p>
        </div>
        <button className="btn btn-secondary" onClick={onClose} style={{ width: "100%" }}>Close</button>
      </div>
    </div>
  );
}

// ─── EXPORT PDF MODAL ────────────────────────────────────────────────────────
function ExportModal({ onClose, person, personEntries, cumulativeSnapshot, getBirthdayDisplay, getAge }) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const reportRef = useRef();

  const statusLabel = (s) => ({ optimal: "Optimal", sufficient: "Sufficient", elite: "Elite", high: "High", low: "Low", "out-of-range": "Out of Range", unknown: "–" }[s] || "–");
  const statusHex  = (s) => RANGE_COLORS[s] || RANGE_COLORS.unknown;

  // Build sorted list of all measured biomarkers from cumulative snapshot
  const categories = [...new Set(Object.values(BIOMARKER_DB).map(b => b.category))];
  const rows = [];
  categories.forEach(cat => {
    Object.entries(BIOMARKER_DB).forEach(([name, b]) => {
      if (b.category !== cat) return;
      const snap = cumulativeSnapshot[name];
      if (!snap) return;
      const allPoints = personEntries
        .filter(e => e.biomarkers?.[name] !== undefined)
        .map(e => {
          const p = parseLabValue(e.biomarkers[name]);
          return { date: e.date, val: p.numeric };
        })
        .filter(p => !Number.isNaN(p.val));
      const status = getStatus(name, snap.val);
      rows.push({ cat, name, b, snap, status, allPoints });
    });
  });

  // Group by category for the PDF table
  const grouped = {};
  rows.forEach(r => { (grouped[r.cat] = grouped[r.cat] || []).push(r); });

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Dynamically load jsPDF from CDN
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const PAGE_W = 210, PAGE_H = 297, M = 14;
      const CONTENT_W = PAGE_W - M * 2;
      const COL = { name: 58, val: 22, unit: 22, status: 24, optimal: 40, trend: CONTENT_W - 58 - 22 - 22 - 24 - 40 };

      const drawHeader = (pageNum) => {
        // Background header bar
        doc.setFillColor(5, 10, 20);
        doc.rect(0, 0, PAGE_W, 22, "F");
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 238, 255);
        doc.text("BIOTRACKER BIOMARKER REPORT", M, 13);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.setTextColor(90, 120, 150);
        const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
        doc.text(`Generated ${dateStr}  ·  Page ${pageNum}`, PAGE_W - M, 13, { align: "right" });
      };

      // ── Page 1: Cover + Summary ─────────────────────────────────────────────
      drawHeader(1);
      let y = 32;

      // Person info block
      doc.setFillColor(10, 22, 40);
      doc.roundedRect(M, y, CONTENT_W, 26, 3, 3, "F");
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(200, 216, 240);
      doc.text(person?.name || "Unknown", M + 6, y + 10);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(90, 120, 150);
      const bio = [
        getBirthdayDisplay(person) ? `Born ${getBirthdayDisplay(person)}${getAge(person) ? ` · Age ${getAge(person)}` : ""}` : null,
        person?.gender,
        `${personEntries.length} test entries`
      ].filter(Boolean).join("  ·  ");
      doc.text(bio, M + 6, y + 18);
      y += 34;

      // Status summary boxes
      const statusSummary = { optimal: 0, sufficient: 0, elite: 0, high: 0, low: 0, total: 0 };
      rows.forEach(r => {
        const s = r.status;
        if (s === "optimal") statusSummary.optimal++;
        else if (s === "sufficient") statusSummary.sufficient++;
        else if (s === "elite") statusSummary.elite++;
        else if (s === "high" || s === "out-of-range") statusSummary.high++;
        else if (s === "low") statusSummary.low++;
        statusSummary.total++;
      });

      const boxes = [
        { label: "Optimal", count: statusSummary.optimal, color: RANGE_RGB.optimal },
        { label: "Sufficient", count: statusSummary.sufficient, color: RANGE_RGB.sufficient },
        { label: "Elite", count: statusSummary.elite, color: RANGE_RGB.elite },
        { label: "High", count: statusSummary.high, color: RANGE_RGB.high },
        { label: "Low", count: statusSummary.low, color: RANGE_RGB.low },
      ];
      const bw = CONTENT_W / boxes.length - 3;
      boxes.forEach((box, i) => {
        const bx = M + i * (bw + 3.75);
        doc.setFillColor(10, 22, 40); doc.roundedRect(bx, y, bw, 20, 2, 2, "F");
        doc.setDrawColor(...box.color); doc.setLineWidth(0.4);
        doc.roundedRect(bx, y, bw, 20, 2, 2, "S");
        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(...box.color);
        doc.text(String(box.count), bx + bw / 2, y + 12, { align: "center" });
        doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(74, 106, 138);
        doc.text(box.label.toUpperCase(), bx + bw / 2, y + 18, { align: "center" });
      });
      y += 28;

      // ── Table ───────────────────────────────────────────────────────────────
      // Column header row
      const drawTableHeader = (yy) => {
        doc.setFillColor(15, 30, 55); doc.rect(M, yy, CONTENT_W, 7, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(74, 106, 138);
        let cx = M + 2;
        [["BIOMARKER", COL.name], ["VALUE", COL.val], ["UNIT", COL.unit], ["STATUS", COL.status], ["OPTIMAL RANGE", COL.optimal], ["TREND", COL.trend]].forEach(([label, w]) => {
          doc.text(label, cx, yy + 5); cx += w;
        });
        return yy + 7;
      };

      y = drawTableHeader(y);

      let pageNum = 1;
      const newPage = () => {
        doc.addPage();
        pageNum++;
        drawHeader(pageNum);
        y = 28;
        y = drawTableHeader(y);
      };

      let lastCat = null;
      rows.forEach((row) => {
        const ROW_H = 8;
        const CAT_H = 9;

        if (y + ROW_H + (row.cat !== lastCat ? CAT_H : 0) > PAGE_H - 16) newPage();

        // Category section header
        if (row.cat !== lastCat) {
          lastCat = row.cat;
          doc.setFillColor(8, 18, 35); doc.rect(M, y, CONTENT_W, CAT_H - 1, "F");
          doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 180, 200);
          doc.text(row.cat.toUpperCase(), M + 3, y + 5.5);
          y += CAT_H;
        }

        // Row background (alternating)
        const rowIdx = rows.indexOf(row);
        doc.setFillColor(rowIdx % 2 === 0 ? 10 : 13, rowIdx % 2 === 0 ? 22 : 26, rowIdx % 2 === 0 ? 40 : 48);
        doc.rect(M, y, CONTENT_W, ROW_H, "F");

        // Status left accent bar
        const [sr, sg, sb] = (() => {
          const hex = statusHex(row.status);
          const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b_ = parseInt(hex.slice(5, 7), 16);
          return [r, g, b_];
        })();
        doc.setFillColor(sr, sg, sb); doc.rect(M, y, 1.5, ROW_H, "F");

        const textY = y + 5.5;
        let cx = M + 3;

        // Biomarker name
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 200, 220);
        doc.text(row.name, cx, textY, { maxWidth: COL.name - 3 }); cx += COL.name;

        // Value (colored) — use display form for < / > results
        doc.setFont("helvetica", "bold"); doc.setTextColor(sr, sg, sb);
        doc.text(parseLabValue(row.snap.val).display, cx, textY, { maxWidth: COL.val - 2 }); cx += COL.val;

        // Unit
        doc.setFont("helvetica", "normal"); doc.setTextColor(74, 106, 138);
        doc.text(row.b.unit, cx, textY, { maxWidth: COL.unit - 2 }); cx += COL.unit;

        // Status pill text
        doc.setFont("helvetica", "bold"); doc.setTextColor(sr, sg, sb);
        doc.text(statusLabel(row.status), cx, textY, { maxWidth: COL.status - 2 }); cx += COL.status;

        // Optimal range
        doc.setFont("helvetica", "normal"); doc.setTextColor(0, 180, 130);
        const optStr = `${row.b.optimal[0]}–${row.b.optimal[1] > 900 ? "∞" : row.b.optimal[1]}`;
        doc.text(optStr, cx, textY, { maxWidth: COL.optimal - 2 }); cx += COL.optimal;

        // Inline sparkline trend from allPoints
        if (row.allPoints.length >= 2) {
          const pts = row.allPoints;
          const vals = pts.map(p => p.val);
          const minV = Math.min(...vals), maxV = Math.max(...vals);
          const span = maxV - minV || 1;
          const sw = COL.trend - 6, sh = 5;
          const sx = cx + 1, sy = y + 1.5;
          // draw sparkline path
          doc.setDrawColor(sr, sg, sb); doc.setLineWidth(0.5);
          for (let i = 0; i < pts.length - 1; i++) {
            const x1 = sx + (i / (pts.length - 1)) * sw;
            const x2 = sx + ((i + 1) / (pts.length - 1)) * sw;
            const y1 = sy + sh - ((vals[i] - minV) / span) * sh;
            const y2 = sy + sh - ((vals[i + 1] - minV) / span) * sh;
            doc.line(x1, y1, x2, y2);
          }
          // endpoint dot
          const lastX = sx + sw, lastY = sy + sh - ((vals[vals.length - 1] - minV) / span) * sh;
          doc.setFillColor(sr, sg, sb); doc.circle(lastX, lastY, 0.8, "F");
          // trend arrow
          const arrow = vals[vals.length - 1] > vals[vals.length - 2] ? "↗" : vals[vals.length - 1] < vals[vals.length - 2] ? "↘" : "→";
          doc.setFontSize(7); doc.text(arrow, cx + COL.trend - 5, textY);
        } else if (row.allPoints.length === 1) {
          doc.setFontSize(7); doc.setTextColor(74, 106, 138);
          doc.text("1 point", cx + 1, textY);
        }

        y += ROW_H;
      });

      // Footer on last page
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 65, 90);
      doc.text("Biotracker  ·  Reference ranges based on ACSM, Endocrine Society, ACC/AHA, and WHOOP guidelines.", M, PAGE_H - 8);

      doc.save(`Biotracker_${(person?.name || "Report").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
      setDone(true);
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>⬇ Export PDF Report</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {/* Preview summary */}
        <div style={{ padding: "16px 20px", borderRadius: 10, background: "#060d1e", border: "1px solid #1a3050", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c8d8f0", marginBottom: 6, fontFamily: "Space Grotesk, sans-serif" }}>{person?.name}</div>
          <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 12 }}>
            {getBirthdayDisplay(person) && <span>Born {getBirthdayDisplay(person)} · </span>}
            {personEntries.length} test entries · {rows.length} biomarkers tracked
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="stat-pill" style={{ background: "#0a1628", border: "1px solid #1a3050", color: "#6a8aaa", fontSize: 10 }}>
                {cat} ({items.length})
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 20, lineHeight: 1.7 }}>
          The PDF will include:<br />
          • Cover page with your personal stats summary<br />
          • Full biomarker table sorted by category<br />
          • Latest value, unit, status, and optimal range for each marker<br />
          • Inline sparkline trend for each biomarker with multiple readings<br />
          • Color-coded status indicators (Optimal, Sufficient, Elite, High, Low)
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, color: RANGE_COLORS.optimal }}>PDF downloaded successfully!</div>
            <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 16 }}>Close</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={generatePDF}
              disabled={generating || rows.length === 0}
              style={{ opacity: generating || rows.length === 0 ? 0.6 : 1 }}
            >
              {generating ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #050a14", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                  Generating…
                </>
              ) : `⬇ Download PDF (${rows.length} markers)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
