import { useState, useEffect, useCallback, useRef } from "react";
import { ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Area, AreaChart } from "recharts";

// ─── BIOMARKER DATABASE ───────────────────────────────────────────────────────
// Ranges based on Bryan Johnson Blueprint protocol + peer-reviewed clinical thresholds.
// optimal  = Blueprint target zone
// sufficient = acceptable but not optimal (standard "normal" lab range)
// high     = elevated / concerning
// low      = below normal / deficient
const BIOMARKER_DB = {
  // ── LIPIDS ────────────────────────────────────────────────────────────────
  "Total Cholesterol": {
    category: "Lipids",
    unit: "mg/dL",
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

  // ── METABOLIC ─────────────────────────────────────────────────────────────
  "Fasting Glucose": {
    category: "Metabolic",
    unit: "mg/dL",
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
  "Homocysteine": {
    category: "Inflammation",
    unit: "μmol/L",
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

  // ── KIDNEY ────────────────────────────────────────────────────────────────
  "Creatinine": {
    category: "Kidney",
    unit: "mg/dL",
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
  "Uric Acid": {
    category: "Kidney",
    unit: "mg/dL",
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
    // Standard normal: 0.8–1.8 ng/dL (lab-dependent). Blueprint targets 1.0–1.8 ng/dL.
    optimal: [1.0, 1.8],    // Blueprint optimal range
    sufficient: [0.8, 1.0], // Adequate but lower end — may indicate hypothyroid tendency
    high: [1.8, 9999],      // Elevated — possible hyperthyroidism
    low: [0, 0.8],          // Low — hypothyroid (primary or secondary)
    description: "Free T4 is the primary thyroid hormone produced by the thyroid gland, stored and converted to active T3 in peripheral tissues. Blueprint monitors both T4 and T3 since poor T4→T3 conversion is common and missed by TSH testing alone.",
    improve: "Adequate dietary iodine (seaweed, iodized salt) for T4 production. Selenium 200 mcg/day. Tyrosine 500 mg/day (T4 = iodinated tyrosine). Avoid excessive goitrogens (raw cruciferous vegetables in large amounts if hypothyroid).",
    icon: "🧬",
  },

  // ── HORMONES ──────────────────────────────────────────────────────────────
  "Total Testosterone": {
    category: "Hormones",
    unit: "ng/dL",
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
    // Standard normal (men 20–50): ~5–21 pg/mL depending on lab. Blueprint targets
    // the upper third: ~15–25 pg/mL. (Note: pg/mL = ng/dL × 10 for direct assay)
    optimal: [15, 25],      // Blueprint target — upper reference range
    sufficient: [9, 15],    // Adequate — lower end of normal
    high: [25, 9999],       // Supraphysiological
    low: [0, 9],            // Low free testosterone — often caused by high SHBG
    description: "Free testosterone is the biologically active fraction unbound to SHBG or albumin. Often more clinically relevant than total testosterone. Two men can have the same total testosterone but vastly different free testosterone if SHBG differs.",
    improve: "Reduce SHBG to liberate more free testosterone: resistance training, adequate dietary fat, moderate carbohydrate intake. Boron 6–10 mg/day demonstrably reduces SHBG. Address insulin resistance.",
    icon: "⚡",
  },
  "DHEA-S": {
    category: "Hormones",
    unit: "μg/dL",
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
  "Cortisol": {
    category: "Hormones",
    unit: "μg/dL",
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

  // ── COMPLETE BLOOD COUNT ──────────────────────────────────────────────────
  "WBC": {
    category: "Complete Blood Count",
    unit: "×10³/μL",
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
    // Standard normal: 150–400 ×10³/μL. Blueprint optimal: 175–350 ×10³/μL.
    optimal: [175, 350],    // Optimal clotting function without thrombocytosis
    sufficient: [150, 400], // Standard lab reference range
    high: [400, 9999],      // Thrombocytosis — reactive or clonal cause
    low: [0, 150],          // Thrombocytopenia — bleeding risk
    description: "Platelets are small cell fragments essential for blood clotting. Blueprint monitors platelet count as part of comprehensive hematological assessment. Low platelets (<150) increase bleeding risk; high platelets (>400) increase thrombosis risk and often indicate underlying inflammation.",
    improve: "Low platelets: rule out autoimmune causes, optimize B12, folate, and iron. High platelets: identify and treat underlying inflammation or iron deficiency. Omega-3 supplementation has mild anti-platelet aggregation effects.",
    icon: "🩺",
  },

  // ── VITAMINS & MINERALS ───────────────────────────────────────────────────
  "Vitamin D": {
    category: "Vitamins & Minerals",
    unit: "ng/mL",
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
  "Ferritin": {
    category: "Vitamins & Minerals",
    unit: "ng/mL",
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

  // ── CARDIOVASCULAR ────────────────────────────────────────────────────────
  "Blood Pressure Systolic": {
    category: "Cardiovascular",
    unit: "mmHg",
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getStatus(name, value) {
  const b = BIOMARKER_DB[name];
  if (!b) return "unknown";
  const v = parseFloat(value);
  if (isNaN(v)) return "unknown";
  // optimal first
  if (b.optimal && v >= b.optimal[0] && v <= b.optimal[1]) return "optimal";
  // elite zone (repurposed "high" field for metrics where more = better)
  const highEnabled = b.high && b.high[0] > 0 && b.high[0] < 9999;
  if (b.eliteZone && highEnabled && v >= b.high[0]) return "elite";
  // low: skip when sentinel [0,0]
  const lowEnabled = b.low && !(b.low[0] === 0 && b.low[1] === 0);
  if (lowEnabled && v < b.low[1]) return "low";
  // high (only for non-elite zones)
  if (!b.eliteZone && highEnabled && v >= b.high[0]) return "high";
  // sufficient falls through
  if (b.sufficient && v >= b.sufficient[0] && v <= b.sufficient[1]) return "sufficient";
  return "out-of-range";
}

function statusColor(status) {
  return {
    optimal: "#00e5a0",
    sufficient: "#f5c842",
    high: "#ff5e5e",
    low: "#ff8c42",
    elite: "#b48fff",       // Purple for elite performance
    "out-of-range": "#ff5e5e",
    unknown: "#555",
  }[status] || "#555";
}

function statusBg(status) {
  return {
    optimal: "rgba(0,229,160,0.12)",
    sufficient: "rgba(245,200,66,0.12)",
    high: "rgba(255,94,94,0.12)",
    low: "rgba(255,140,66,0.12)",
    elite: "rgba(180,143,255,0.12)",
    "out-of-range": "rgba(255,94,94,0.12)",
    unknown: "rgba(80,80,80,0.1)",
  }[status] || "rgba(80,80,80,0.1)";
}

const INIT_PEOPLE = [
  { id: "1", name: "Alex Johnson", birthday: "1990-03-15", gender: "Male", avatar: "AJ" },
  { id: "2", name: "Maria Santos", birthday: "1997-07-22", gender: "Female", avatar: "MS" },
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [people, setPeople] = useState(INIT_PEOPLE);
  const [selectedPerson, setSelectedPerson] = useState("1");
  const [entries, setEntries] = useState({});
  const [view, setView] = useState("dashboard");
  const [selectedBiomarker, setSelectedBiomarker] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState(null);
  const [driveStatus, setDriveStatus] = useState("disconnected");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(null); // person id pending deletion
  const [showExportModal, setShowExportModal] = useState(false);

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

  // Load from storage
  useEffect(() => {
    const init = async () => {
      try {
        const pr = await window.storage.get("bloodwork-people");
        const en = await window.storage.get("bloodwork-entries");
        if (pr) setPeople(JSON.parse(pr.value));
        if (en) setEntries(JSON.parse(en.value));
      } catch (e) {}
      setLoading(false);
    };
    init();
  }, []);

  const save = async (newPeople, newEntries) => {
    try {
      await window.storage.set("bloodwork-people", JSON.stringify(newPeople));
      await window.storage.set("bloodwork-entries", JSON.stringify(newEntries));
    } catch (e) {}
  };

  const addEntry = (personId, date, biomarkers) => {
    const newEntries = {
      ...entries,
      [personId]: [...(entries[personId] || []), { date, biomarkers, id: Date.now() }]
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
    save(newPeople, entries);
    setShowAddPersonModal(false);
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

  const allBiomarkers = Object.keys(BIOMARKER_DB);
  const filteredBiomarkers = allBiomarkers.filter(b => {
    const cat = BIOMARKER_DB[b].category;
    const matchCat = filterCat === "All" || cat === filterCat;
    const matchSearch = !searchTerm || b.toLowerCase().includes(searchTerm.toLowerCase()) || cat.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const getTrend = (name) => {
    const vals = personEntries.map(e => e.biomarkers?.[name]).filter(v => v !== undefined);
    if (vals.length < 2) return null;
    const last = parseFloat(vals[vals.length - 1]);
    const prev = parseFloat(vals[vals.length - 2]);
    if (isNaN(last) || isNaN(prev)) return null;
    if (last > prev * 1.02) return "up";
    if (last < prev * 0.98) return "down";
    return "stable";
  };

  // Cumulative snapshot: for each biomarker, the most recent measured value across ALL entries
  const getCumulativeSnapshot = () => {
    const snapshot = {}; // { biomarkerName: { val, date } }
    // personEntries are sorted oldest→newest, so later entries overwrite earlier ones
    personEntries.forEach(entry => {
      Object.entries(entry.biomarkers || {}).forEach(([name, val]) => {
        snapshot[name] = { val, date: entry.date };
      });
    });
    return snapshot;
  };

  const cumulativeSnapshot = getCumulativeSnapshot();

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
    <div style={{ background: "#050a14", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", border: "3px solid #0ef", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ color: "#0ef", fontFamily: "'Courier New', monospace", fontSize: 14, letterSpacing: 2 }}>LOADING PROTOCOL</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#050a14", minHeight: "100vh", fontFamily: "'DM Mono', 'Courier New', monospace", color: "#c8d8f0", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a1628; }
        ::-webkit-scrollbar-thumb { background: #1a3050; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideIn { from { transform: translateY(-10px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 10px rgba(0,238,255,0.2); } 50% { box-shadow: 0 0 20px rgba(0,238,255,0.4); } }
        .card { background: linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%); border: 1px solid #1a3050; border-radius: 12px; padding: 20px; transition: border-color 0.2s; }
        .card:hover { border-color: #2a4060; }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: linear-gradient(135deg, #0ef, #0090a8); color: #050a14; font-weight: 600; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-secondary { background: #0a1628; border: 1px solid #1a3050; color: #8aabcc; }
        .btn-secondary:hover { border-color: #0ef; color: #0ef; }
        .btn-danger { background: rgba(255,94,94,0.1); border: 1px solid rgba(255,94,94,0.3); color: #ff5e5e; }
        .stat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        input, select, textarea { background: #0a1628; border: 1px solid #1a3050; color: #c8d8f0; font-family: inherit; font-size: 13px; border-radius: 8px; padding: 8px 12px; width: 100%; outline: none; transition: border-color 0.2s; }
        input:focus, select:focus, textarea:focus { border-color: #0ef; }
        select option { background: #0a1628; }
        .modal-bg { position: fixed; inset: 0; background: rgba(5,10,20,0.85); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: #0a1628; border: 1px solid #1a3050; border-radius: 16px; padding: 28px; width: 100%; animation: slideIn 0.2s ease; overflow-y: auto; max-height: 90vh; }
        .tab-btn { padding: 8px 16px; border-radius: 8px; font-family: inherit; font-size: 12px; cursor: pointer; border: none; transition: all 0.2s; background: transparent; color: #5a7a9a; }
        .tab-btn.active { background: #0a1628; color: #0ef; border: 1px solid #1a3050; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 768px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
      `}</style>

      {/* TOP NAV */}
      <nav style={{ padding: "12px 24px", borderBottom: "1px solid #1a3050", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "rgba(5,10,20,0.95)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0ef, #0050a8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧬</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0ef", letterSpacing: 1, fontFamily: "Space Grotesk, sans-serif" }}>BLUEPRINT</div>
            <div style={{ fontSize: 9, color: "#4a6a8a", letterSpacing: 2 }}>BIOMARKER TRACKER</div>
          </div>
        </div>

        {/* Person Switcher */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {people.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {confirmDeletePerson === p.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,94,94,0.5)", background: "rgba(255,94,94,0.08)" }}>
                  <span style={{ fontSize: 11, color: "#ff8888" }}>Delete {p.name.split(" ")[0]}?</span>
                  <button className="btn btn-danger" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => deletePerson(p.id)}>Yes</button>
                  <button className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => setConfirmDeletePerson(null)}>No</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <button onClick={() => setSelectedPerson(p.id)} className="btn" style={{ background: selectedPerson === p.id ? "rgba(0,238,255,0.1)" : "transparent", border: `1px solid ${selectedPerson === p.id ? "#0ef" : "#1a3050"}`, borderRight: "none", borderRadius: "8px 0 0 8px", color: selectedPerson === p.id ? "#0ef" : "#8aabcc", padding: "6px 12px" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg, #0050a8, #003070)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0ef" }}>{p.avatar}</div>
                    <span style={{ fontSize: 12 }}>{p.name}</span>
                  </button>
                  <button
                    onClick={() => setConfirmDeletePerson(p.id)}
                    style={{ background: selectedPerson === p.id ? "rgba(0,238,255,0.05)" : "transparent", border: `1px solid ${selectedPerson === p.id ? "#0ef" : "#1a3050"}`, borderRadius: "0 8px 8px 0", color: "#3a5a7a", cursor: "pointer", padding: "6px 8px", fontSize: 12, lineHeight: 1, transition: "all 0.2s" }}
                    title={`Delete ${p.name}`}
                    onMouseEnter={e => { e.currentTarget.style.color = "#ff5e5e"; e.currentTarget.style.borderColor = "rgba(255,94,94,0.4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#3a5a7a"; e.currentTarget.style.borderColor = selectedPerson === p.id ? "#0ef" : "#1a3050"; }}
                  >✕</button>
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => setShowAddPersonModal(true)}>+ Add Person</button>
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button className="btn btn-secondary" onClick={() => { setImportStatus(null); setShowImportModal(true); }} style={{ fontSize: 11 }}>📄 Import PDF</button>
          <button className="btn btn-secondary" onClick={() => setShowManualEntry(true)} style={{ fontSize: 11 }}>+ Manual Entry</button>
          <button className="btn btn-secondary" onClick={() => setShowExportModal(true)} style={{ fontSize: 11 }}>⬇ Export PDF</button>
          <button
            className="btn"
            style={{ fontSize: 11, background: driveStatus === "connected" ? "rgba(0,229,160,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${driveStatus === "connected" ? "#00e5a0" : "#1a3050"}`, color: driveStatus === "connected" ? "#00e5a0" : "#5a7a9a" }}
            onClick={() => {
              if (driveStatus === "connected") { setDriveStatus("disconnected"); } else {
                alert("Google Drive Sync\n\nTo enable Google Drive sync:\n1. This app exports JSON data\n2. Connect your Google account via the Google Drive API\n3. Your data will auto-sync every 24h\n\nNote: Full OAuth requires deployment. Use Export below to save data manually.");
              }
            }}
          >
            ☁️ {driveStatus === "connected" ? "Drive: Synced" : "Drive: Connect"}
          </button>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1 }}>
        {/* SIDEBAR */}
        <aside style={{ width: 200, borderRight: "1px solid #1a3050", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {[
            { id: "dashboard", icon: "◈", label: "Overview" },
            { id: "biomarkers", icon: "⬡", label: "All Markers" },
            { id: "trends", icon: "◫", label: "Trends" },
            { id: "history", icon: "◧", label: "History" },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: view === item.id ? "rgba(0,238,255,0.08)" : "transparent", color: view === item.id ? "#0ef" : "#5a7a9a", transition: "all 0.2s", textAlign: "left", fontSize: 13, fontFamily: "inherit" }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #1a3050", marginTop: 8, paddingTop: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { setFilterCat(cat); setView("biomarkers"); }} style={{ display: "block", width: "100%", padding: "7px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: filterCat === cat && view === "biomarkers" ? "rgba(0,238,255,0.05)" : "transparent", color: filterCat === cat && view === "biomarkers" ? "#8aabcc" : "#3a5a7a", transition: "all 0.2s", textAlign: "left", fontSize: 11, fontFamily: "inherit" }}>
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, padding: 24, overflow: "auto" }}>
          {/* Person Header */}
          {currentPerson && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #0050a8, #003070)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#0ef", border: "2px solid #1a3050" }}>{currentPerson.avatar}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{currentPerson.name}</div>
                <div style={{ fontSize: 12, color: "#4a6a8a" }}>
                  {getBirthdayDisplay(currentPerson) && (
                    <span>Born {getBirthdayDisplay(currentPerson)}{getAge(currentPerson) ? ` · Age ${getAge(currentPerson)}` : ""}</span>
                  )}
                  {!getBirthdayDisplay(currentPerson) && getAge(currentPerson) && <span>Age {getAge(currentPerson)}</span>}
                  {currentPerson.gender && <span> · {currentPerson.gender}</span>}
                  <span> · {personEntries.length} tests recorded</span>
                </div>
              </div>
              {healthScore !== null && (
                <div style={{ marginLeft: "auto", textAlign: "center" }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: healthScore > 70 ? "#00e5a0" : healthScore > 40 ? "#f5c842" : "#ff5e5e", fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>{healthScore}</div>
                  <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1 }}>HEALTH SCORE</div>
                </div>
              )}
            </div>
          )}

          {/* ── DASHBOARD VIEW ── */}
          {view === "dashboard" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {Object.keys(cumulativeSnapshot).length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
                  <div style={{ fontSize: 18, color: "#8aabcc", marginBottom: 8, fontFamily: "Space Grotesk, sans-serif" }}>No bloodwork data yet</div>
                  <div style={{ fontSize: 13, color: "#3a5a7a", marginBottom: 24 }}>Import a PDF or add manual entries to start tracking biomarkers</div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>📄 Import PDF</button>
                    <button className="btn btn-secondary" onClick={() => setShowManualEntry(true)}>+ Manual Entry</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status Summary — clickable */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "Optimal", key: "optimal", count: counts.optimal, color: "#00e5a0", icon: "✓" },
                      { label: "Sufficient", key: "sufficient", count: counts.sufficient, color: "#f5c842", icon: "~" },
                      { label: "Elite", key: "elite", count: counts.elite, color: "#b48fff", icon: "★" },
                      { label: "High", key: "high", count: counts.high, color: "#ff5e5e", icon: "↑" },
                      { label: "Low", key: "low", count: counts.low, color: "#ff8c42", icon: "↓" },
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

                  {/* Filtered biomarker subset when a status card is clicked */}
                  {statusFilter && (
                    <div className="card" style={{ marginBottom: 16, border: `1px solid ${statusFilter === "optimal" ? "#00e5a022" : statusFilter === "sufficient" ? "#f5c84222" : statusFilter === "elite" ? "#b48fff22" : statusFilter === "high" ? "#ff5e5e22" : "#ff8c4222"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, fontWeight: 600 }}>
                          {statusFilter.toUpperCase()} BIOMARKERS
                          <span style={{ marginLeft: 10, color: "#3a5a7a", fontSize: 10, letterSpacing: 0, fontWeight: 400, textTransform: "none" }}>— most recent measurement per marker</span>
                        </div>
                        <button onClick={() => setStatusFilter(null)} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                        {Object.entries(cumulativeSnapshot).filter(([name, { val }]) => {
                          const s = getStatus(name, val);
                          return statusFilter === "high" ? (s === "high" || s === "out-of-range") : s === statusFilter;
                        }).map(([name, { val, date }]) => {
                          const status = getStatus(name, val);
                          const trend = getTrend(name);
                          const isOld = latestEntry && date !== latestEntry.date;
                          return (
                            <div key={name} onClick={() => { setSelectedBiomarker(name); setView("trends"); }} style={{ padding: "12px 14px", borderRadius: 10, background: statusBg(status), border: `1px solid ${statusColor(status)}33`, cursor: "pointer", transition: "transform 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, color: "#5a7a9a" }}>{name}</span>
                                <span style={{ fontSize: 14 }}>{trend === "up" ? "↗" : trend === "down" ? "↘" : trend === "stable" ? "→" : ""}</span>
                              </div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif", lineHeight: 1.2, marginTop: 4 }}>{val}</div>
                              <div style={{ fontSize: 10, color: "#4a6a8a" }}>{BIOMARKER_DB[name]?.unit}</div>
                              {isOld && <div style={{ fontSize: 9, color: "#3a5a7a", marginTop: 4 }}>as of {new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Latest Values by Category — uses cumulative snapshot */}
                  {!statusFilter && CATEGORIES.map(cat => {
                    const catMarkers = Object.keys(BIOMARKER_DB).filter(b => BIOMARKER_DB[b].category === cat && cumulativeSnapshot[b]);
                    if (catMarkers.length === 0) return null;
                    return (
                      <div key={cat} className="card" style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 14, fontWeight: 600 }}>{cat.toUpperCase()}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                          {catMarkers.map(name => {
                            const { val, date } = cumulativeSnapshot[name];
                            const status = getStatus(name, val);
                            const trend = getTrend(name);
                            const isOld = latestEntry && date !== latestEntry.date;
                            return (
                              <div key={name} onClick={() => { setSelectedBiomarker(name); setView("trends"); }} style={{ padding: "12px 14px", borderRadius: 10, background: statusBg(status), border: `1px solid ${statusColor(status)}33`, cursor: "pointer", transition: "transform 0.15s", userSelect: "none" }}
                                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <span style={{ fontSize: 11, color: "#5a7a9a" }}>{name}</span>
                                  <span style={{ fontSize: 14 }}>{trend === "up" ? "↗" : trend === "down" ? "↘" : trend === "stable" ? "→" : ""}</span>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif", marginTop: 4 }}>{val}</div>
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
                  })}
                </>
              )}
            </div>
          )}

          {/* ── BIOMARKERS VIEW ── */}
          {view === "biomarkers" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <input placeholder="Search biomarkers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 260 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["All", ...CATEGORIES].map(cat => (
                    <button key={cat} className={`tab-btn ${filterCat === cat ? "active" : ""}`} onClick={() => setFilterCat(cat)} style={{ fontSize: 11 }}>{cat}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {filteredBiomarkers.map(name => {
                  const b = BIOMARKER_DB[name];
                  const snap = cumulativeSnapshot[name];
                  const snapVal = snap?.val;
                  const snapDate = snap?.date;
                  const status = snapVal !== undefined ? getStatus(name, snapVal) : "unknown";
                  const isOld = latestEntry && snapDate && snapDate !== latestEntry.date;
                  return (
                    <div key={name} className="card" style={{ cursor: "pointer", borderLeft: `3px solid ${statusColor(status)}` }}
                      onClick={() => { setSelectedBiomarker(name); setView("trends"); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#c8d8f0", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
                          <div style={{ fontSize: 10, color: "#3a5a7a", marginTop: 2 }}>{b.category} · {b.unit}</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setShowInfoModal(name); }} style={{ background: "none", border: "none", color: "#3a5a7a", cursor: "pointer", fontSize: 16, padding: 4 }}>ⓘ</button>
                      </div>
                      {snapVal !== undefined ? (
                        <>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                            <span style={{ fontSize: 26, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{snapVal}</span>
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
                        <div style={{ marginTop: 12, fontSize: 12, color: "#3a5a7a" }}>No data recorded</div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 10 }}>
                        <span style={{ color: "#00e5a044", borderBottom: "1px solid #00e5a044", padding: "1px 0" }}>Optimal: {b.optimal[0]}–{b.optimal[1] > 999 ? "∞" : b.optimal[1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TRENDS VIEW ── */}
          {view === "trends" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {selectedBiomarker ? (
                <TrendDetail name={selectedBiomarker} personEntries={personEntries} onBack={() => setSelectedBiomarker(null)} />
              ) : (
                <>
                  <div style={{ marginBottom: 20, color: "#5a7a9a", fontSize: 13 }}>Click on any biomarker to view its trend over time</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {Object.keys(BIOMARKER_DB).filter(name => {
                      const vals = personEntries.map(e => e.biomarkers?.[name]).filter(v => v !== undefined);
                      return vals.length > 0;
                    }).map(name => {
                      const vals = personEntries.filter(e => e.biomarkers?.[name] !== undefined).map(e => ({ date: e.date, value: parseFloat(e.biomarkers[name]) }));
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
                            <span style={{ color: statusColor(status), fontWeight: 600 }}>{vals[vals.length - 1]?.value} {BIOMARKER_DB[name].unit}</span>
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
          {view === "history" && (
            <div style={{ animation: "slideIn 0.3s ease" }}>
              {personEntries.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 13, color: "#3a5a7a" }}>No test history recorded yet.</div>
                </div>
              ) : (
                [...personEntries].reverse().map(entry => {
                  const markerCount = Object.keys(entry.biomarkers || {}).length;
                  const optCount = Object.entries(entry.biomarkers || {}).filter(([k, v]) => getStatus(k, v) === "optimal").length;
                  const isPendingDelete = confirmDeleteId === entry.id;
                  return (
                    <div key={entry.id} className="card" style={{ marginBottom: 12, border: isPendingDelete ? "1px solid rgba(255,94,94,0.5)" : undefined }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isPendingDelete ? 10 : 14 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "#c8d8f0", fontFamily: "Space Grotesk, sans-serif" }}>
                            {new Date(entry.date + "T12:00:00").toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                          </div>
                          <div style={{ fontSize: 11, color: "#3a5a7a" }}>{markerCount} markers tracked · {optCount} optimal · <span style={{ color: "#3a6a9a" }}>click any marker to view trend</span></div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "#00e5a0", fontFamily: "Space Grotesk, sans-serif" }}>
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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                          {Object.entries(entry.biomarkers || {}).map(([name, val]) => {
                            const status = getStatus(name, val);
                            return (
                              <div
                                key={name}
                                onClick={() => { setSelectedBiomarker(name); setView("trends"); }}
                                style={{ padding: "8px 12px", borderRadius: 8, background: statusBg(status), border: `1px solid ${statusColor(status)}22`, cursor: "pointer", transition: "transform 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.borderColor = statusColor(status) + "66"; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = statusColor(status) + "22"; }}
                                title={`Click to view ${name} trend`}
                              >
                                <div style={{ fontSize: 10, color: "#5a7a9a" }}>{name}</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{val}</div>
                                <div style={{ fontSize: 9, color: "#3a5a7a" }}>{BIOMARKER_DB[name]?.unit}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS ── */}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} onImport={(date, biomarkers) => { addEntry(selectedPerson, date, biomarkers); setShowImportModal(false); }} personName={currentPerson?.name} />}
      {showManualEntry && <ManualEntryModal onClose={() => setShowManualEntry(false)} onSave={(date, biomarkers) => { addEntry(selectedPerson, date, biomarkers); setShowManualEntry(false); }} />}
      {showAddPersonModal && <AddPersonModal onClose={() => setShowAddPersonModal(false)} onAdd={addPerson} />}
      {showInfoModal && <InfoModal name={showInfoModal} onClose={() => setShowInfoModal(null)} latestEntry={latestEntry} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} person={currentPerson} personEntries={personEntries} cumulativeSnapshot={cumulativeSnapshot} getBirthdayDisplay={getBirthdayDisplay} getAge={getAge} />}
    </div>
  );
}

// ─── TREND DETAIL ─────────────────────────────────────────────────────────────
function TrendDetail({ name, personEntries, onBack }) {
  const b = BIOMARKER_DB[name];
  const data = personEntries
    .filter(e => e.biomarkers?.[name] !== undefined)
    .map(e => {
      const v = parseFloat(e.biomarkers[name]);
      return {
        date: e.date,
        value: v,
        status: getStatus(name, v),
        label: new Date(e.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        year: new Date(e.date + "T12:00:00").getFullYear(),
      };
    });

  const latestVal = data[data.length - 1]?.value;
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
    bands.push({ y1: yMin, y2: lowCeil, fill: "rgba(255,140,66,0.18)", id: "low" });

    // Sufficient below optimal
    if (sufEnabled && b.sufficient[0] < b.optimal[0]) {
      const sufStart = lowEnabled ? clamp(b.low[1]) : yMin;
      const sufEnd = clamp(b.optimal[0]);
      if (sufEnd > sufStart) {
        bands.push({ y1: sufStart, y2: sufEnd, fill: "rgba(100,220,200,0.18)", id: "suf-low" });
      }
    }

    // Optimal band
    const optStart = clamp(b.optimal[0]);
    const optEnd = optHigh ? clamp(optHigh) : yMax;
    bands.push({ y1: optStart, y2: optEnd, fill: "rgba(0,229,160,0.20)", id: "optimal" });

    // Sufficient above optimal
    if (sufEnabled && optHigh) {
      const sufAboveEnd = (highEnabled && b.high[0] < b.sufficient[1]) ? clamp(b.high[0]) : (b.sufficient[1] < 9000 ? clamp(b.sufficient[1]) : yMax);
      if (sufAboveEnd > optEnd) {
        bands.push({ y1: optEnd, y2: sufAboveEnd, fill: "rgba(100,220,200,0.18)", id: "suf-high" });
      }
    }

    // High / out-of-range band (above)
    const highStart = highEnabled ? clamp(b.high[0]) : (sufEnabled && b.sufficient[1] < 9000 ? clamp(b.sufficient[1]) : (optHigh ? clamp(optHigh) : yMax));
    if (highStart < yMax) {
      const highFill = b.eliteZone ? "rgba(180,143,255,0.20)" : "rgba(255,94,94,0.18)";
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
          {payload.value}
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
            <div style={{ fontSize: 12, color: "#4a6a8a" }}>{b.category} · {b.unit}</div>
          </div>
          {latestVal !== undefined && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1, marginBottom: 2 }}>LATEST</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>{latestVal}</div>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 6 }}>{b.unit}</div>
              <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status) }}>{status.toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { label: "Out of Range / Low", color: "#ff8c42" },
            { label: "Sufficient", color: "#50ddc8" },
            { label: "Optimal", color: "#00e5a0" },
            ...(b.eliteZone
              ? [{ label: "Elite", color: "#b48fff" }]
              : [{ label: "High", color: "#ff5e5e" }]
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
                    <span style={{ color: statusColor(props.payload.status), fontWeight: 700 }}>{val} {b.unit}</span>,
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
            <div className="stat-pill" style={{ background: "rgba(255,140,66,0.12)", color: "#ff8c42", border: "1px solid rgba(255,140,66,0.3)" }}>↓ Low: &lt;{b.low[1]} {b.unit}</div>
          )}
          {b.sufficient && !(b.sufficient[0] === 0 && b.sufficient[1] === 0) && (
            <div className="stat-pill" style={{ background: "rgba(80,220,200,0.12)", color: "#50ddc8", border: "1px solid rgba(80,220,200,0.3)" }}>~ Sufficient: {b.sufficient[0]}–{b.sufficient[1] > 900 ? "∞" : b.sufficient[1]} {b.unit}</div>
          )}
          {b.optimal && (
            <div className="stat-pill" style={{ background: "rgba(0,229,160,0.12)", color: "#00e5a0", border: "1px solid rgba(0,229,160,0.3)" }}>✓ Optimal: {b.optimal[0]}–{b.optimal[1] > 900 ? "∞" : b.optimal[1]} {b.unit}</div>
          )}
          {b.high && b.high[0] < 9999 && (
            <div className="stat-pill" style={{ background: b.eliteZone ? "rgba(180,143,255,0.12)" : "rgba(255,94,94,0.12)", color: b.eliteZone ? "#b48fff" : "#ff5e5e", border: `1px solid ${b.eliteZone ? "rgba(180,143,255,0.3)" : "rgba(255,94,94,0.3)"}` }}>
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
        <div className="card" style={{ borderLeft: "3px solid #00e5a0" }}>
          <div style={{ fontSize: 11, color: "#00e5a0", letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>HOW TO IMPROVE</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.improve}</p>
        </div>
      </div>
    </div>
  );
}

// ─── IMPORT MODAL ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport, personName }) {
  const [stage, setStage] = useState("upload");
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editedBiomarkers, setEditedBiomarkers] = useState({});
  const fileRef = useRef();

  const toBase64 = (f) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

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
    setLoading(true);
    setError(null);
    try {
      const b64 = await toBase64(f);
      const targetUnits = Object.fromEntries(Object.entries(BIOMARKER_DB).map(([k, v]) => [k, v.unit]));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "pdfs-2024-09-25",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
              {
                type: "text",
                text: `You are a precision medical document parser specializing in international laboratory reports.
This report may be in Norwegian, Russian, Armenian, or English. Extract every biomarker you can find.

ALSO extract the test/collection date from the document (look for date of collection, sample date, report date, etc.).

TARGET UNITS — you MUST convert every value to these exact units before returning:
${JSON.stringify(targetUnits, null, 2)}

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
Estradiol: pg/mL target; pmol/L → pg/mL: × 0.2724
Cortisol: μg/dL target; nmol/L → μg/dL: ÷ 27.59; ng/mL → μg/dL: ÷ 10
Vitamin D: ng/mL target; nmol/L → ng/mL: ÷ 2.496
Vitamin B12: pg/mL target; pmol/L → pg/mL: × 1.355
Folate: ng/mL target; nmol/L → ng/mL: ÷ 2.266
Iron: μg/dL target; μmol/L → μg/dL: × 5.585
Magnesium: mg/dL target; mmol/L → mg/dL: × 2.432
Zinc: μg/dL target; μmol/L → μg/dL: × 6.54
Hemoglobin: g/dL target; g/L → g/dL: ÷ 10
SHBG: nmol/L target (usually already correct)

LANGUAGE MAPPING:
Norwegian: Kreatinin=Creatinine, Glukose=Fasting Glucose, Kolesterol=Total Cholesterol, Triglyserider=Triglycerides, Tyreoideastimulerende hormon/TSH=TSH, Urinsyre=Uric Acid, Homocystein=Homocysteine
Russian: Креатинин=Creatinine, Глюкоза=Fasting Glucose, Холестерин=Total Cholesterol, Триглицериды=Triglycerides, ТТГ=TSH, Мочевая кислота=Uric Acid, Гомоцистеин=Homocysteine, ЛПНП=LDL Cholesterol, ЛПВП=HDL Cholesterol, Гемоглобин=Hemoglobin, Ферритин=Ferritin
Armenian: Կրեատինին=Creatinine, Գլյուկոզ=Fasting Glucose, Խոլեստerол=Total Cholesterol, Հեմoglobin=Hemoglobin

Return ONLY valid JSON with no markdown fences or explanation:
{
  "extracted": { "Biomarker Name": "numeric_value_as_string", ... },
  "conversions": { "Biomarker Name": "original: X unit → converted: Y mg/dL", ... },
  "testDate": "YYYY-MM-DD or null if not found",
  "language": "detected language",
  "notes": "brief notes"
}

Critical rules:
- Values in "extracted" MUST already be in the target units after conversion
- Round sensibly: creatinine 2dp, glucose 1dp, lipids 0dp, hormones 1dp
- Only include biomarkers you are confident about
- Use EXACT biomarker names from the target units object above`
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const text = data.content.map(i => i.text || "").join("");
      // Strip any possible markdown fences the model may still emit
      const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setEditedBiomarkers(parsed.extracted || {});
      // Auto-fill detected test date
      if (parsed.testDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.testDate)) {
        setDate(parsed.testDate);
      }
      setStage("review");
    } catch (e) {
      setError("Failed to process PDF: " + e.message);
    }
    setLoading(false);
  };

  const handleConfirm = () => {
    const filtered = Object.fromEntries(Object.entries(editedBiomarkers).filter(([k, v]) => v !== "" && v !== undefined));
    onImport(date, filtered);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>📄 Import Bloodwork PDF</div>
            <div style={{ fontSize: 12, color: "#4a6a8a" }}>AI-powered extraction · EN / NO / RU / HY supported</div>
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
                if (dropped?.type === "application/pdf") {
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
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileChange} />
              {loading ? (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(0,238,255,0.3)", borderTopColor: "#0ef", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
                  <div style={{ color: "#0ef", fontSize: 14, fontWeight: 600 }}>Analysing PDF…</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 6 }}>Detecting language, extracting & converting units</div>
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
                  <div style={{ color: "#8aabcc", fontSize: 14, fontWeight: 500 }}>Click or drag & drop your bloodwork PDF</div>
                  <div style={{ color: "#3a5a7a", fontSize: 12, marginTop: 6 }}>Norwegian · Russian · Armenian · English · Auto-detects date & units</div>
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
                <span style={{ color: "#00e5a0" }}>✓ Language: {result.language}</span>
                <span style={{ color: "#4a6a8a" }}>· {Object.keys(editedBiomarkers).length} markers extracted</span>
                {result.conversions && Object.keys(result.conversions).length > 0 && (
                  <span style={{ color: "#f5c842" }}>· {Object.keys(result.conversions).length} units converted</span>
                )}
                {result.testDate && <span style={{ color: "#0ef" }}>· Date auto-detected</span>}
              </div>
              {result.notes && <div style={{ color: "#4a6a8a", marginTop: 4, fontSize: 11 }}>{result.notes}</div>}
            </div>

            {/* Editable test date */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>TEST DATE {result.testDate ? <span style={{ color: "#0ef", textTransform: "none", letterSpacing: 0 }}>(auto-detected)</span> : <span style={{ color: "#f5c842", textTransform: "none", letterSpacing: 0 }}>(not found in PDF — please set manually)</span>}</label>
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
                        {convNote && <div style={{ fontSize: 10, color: "#f5c842", marginTop: 2 }}>🔄 {convNote}</div>}
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
function ManualEntryModal({ onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [values, setValues] = useState({});
  const [catFilter, setCatFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSave = () => {
    const nonEmpty = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
    if (Object.keys(nonEmpty).length === 0) { alert("Please enter at least one value."); return; }
    onSave(date, nonEmpty);
  };

  const filtered = Object.keys(BIOMARKER_DB).filter(b => {
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
        <div style={{ maxHeight: 380, overflowY: "auto", marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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

// ─── INFO MODAL ───────────────────────────────────────────────────────────────
function InfoModal({ name, onClose, latestEntry }) {
  const b = BIOMARKER_DB[name];
  const val = latestEntry?.biomarkers?.[name];
  const status = val !== undefined ? getStatus(name, val) : null;
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
            <div style={{ fontSize: 11, color: "#3a5a7a" }}>{b.category}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {val !== undefined && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: statusBg(status), border: `1px solid ${statusColor(status)}33`, marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif" }}>{val} {b.unit}</div>
            <div className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status), marginTop: 4 }}>{status?.toUpperCase()}</div>
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>REFERENCE RANGES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {b.optimal && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)" }}>
              <span style={{ color: "#00e5a0", fontSize: 13 }}>✓ Optimal</span>
              <span style={{ color: "#c8d8f0", fontSize: 13, fontFamily: "Space Grotesk, sans-serif" }}>{b.optimal[0]} – {b.optimal[1] > 999 ? "∞" : b.optimal[1]} {b.unit}</span>
            </div>}
            {b.sufficient && b.sufficient[0] > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)" }}>
              <span style={{ color: "#f5c842", fontSize: 13 }}>~ Sufficient</span>
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>ABOUT</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.description}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#00e5a0", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>HOW TO IMPROVE</div>
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
  const statusHex  = (s) => ({ optimal: "#00e5a0", sufficient: "#f5c842", elite: "#b48fff", high: "#ff5e5e", low: "#ff8c42", "out-of-range": "#ff5e5e", unknown: "#555" }[s] || "#555");

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
        .map(e => ({ date: e.date, val: parseFloat(e.biomarkers[name]) }));
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
        doc.text("BLUEPRINT BIOMARKER REPORT", M, 13);
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
        { label: "Optimal", count: statusSummary.optimal, color: [0, 229, 160] },
        { label: "Sufficient", count: statusSummary.sufficient, color: [245, 200, 66] },
        { label: "Elite", count: statusSummary.elite, color: [180, 143, 255] },
        { label: "High", count: statusSummary.high, color: [255, 94, 94] },
        { label: "Low", count: statusSummary.low, color: [255, 140, 66] },
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

        // Value (colored)
        doc.setFont("helvetica", "bold"); doc.setTextColor(sr, sg, sb);
        doc.text(String(row.snap.val), cx, textY, { maxWidth: COL.val - 2 }); cx += COL.val;

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
      doc.text("Blueprint Biomarker Tracker  ·  Reference ranges based on Blueprint Protocol, ACSM, Endocrine Society, ACC/AHA, and WHOOP guidelines.", M, PAGE_H - 8);

      doc.save(`Blueprint_${(person?.name || "Report").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
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
            <div style={{ fontSize: 14, color: "#00e5a0" }}>PDF downloaded successfully!</div>
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
