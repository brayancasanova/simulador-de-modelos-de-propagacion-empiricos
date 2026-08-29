const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- MODELOS CLÁSICOS PREVIOS ---
function calculateOkumuraHataPr(f, ht, hm, d_km, environment, citySize, Pt_dBm, Gt, Gr) {
  let a_hm = 0;
  if (citySize === 'small_medium') {
    a_hm = (1.1 * Math.log10(f) - 0.7) * hm - (1.56 * Math.log10(f) - 0.8);
  } else if (citySize === 'large') {
    if (f <= 200) {
      a_hm = 8.29 * Math.pow(Math.log10(1.54 * hm), 2) - 1.1;
    } else {
      a_hm = 3.2 * Math.pow(Math.log10(11.75 * hm), 2) - 4.97;
    }
  }
  const Lb_urban = 69.55 + 26.26 * Math.log10(f) - 13.82 * Math.log10(ht) - a_hm + (44.9 - 6.55 * Math.log10(ht)) * Math.log10(d_km);
  let Lb = Lb_urban;
  if (environment === 'suburban') {
    Lb = Lb_urban - 2 * Math.pow(Math.log10(f / 28), 2) - 5.4;
  } else if (environment === 'rural') {
    Lb = Lb_urban - 4.78 * Math.pow(Math.log10(f), 2) + 18.33 * Math.log10(f) - 40.94;
  }
  return Pt_dBm + Gt + Gr - Lb;
}

function calculateCost231HataPr(f, ht, hm, d_km, citySize, Pt_dBm, Gt, Gr) {
  let a_hm = 0;
  if (citySize === 'small_medium') {
    a_hm = (1.1 * Math.log10(f) - 0.7) * hm - (1.56 * Math.log10(f) - 0.8);
  } else if (citySize === 'large') {
    a_hm = 3.2 * Math.pow(Math.log10(11.75 * hm), 2) - 4.97;
  }
  const cm = (citySize === 'large') ? 3 : 0;
  const Lb = 46.3 + 33.9 * Math.log10(f) - 13.82 * Math.log10(ht) - a_hm + (44.9 - 6.55 * Math.log10(ht)) * Math.log10(d_km) + cm;
  return Pt_dBm + Gt + Gr - Lb;
}

function calculateECC33Pr(f, hb, hr, d_km, citySize, Pt_dBm, Gt_ant, Gr_ant) {
  const f_GHz = f / 1000;
  const Afs = 92.45 + 20 * Math.log10(d_km) + 20 * Math.log10(f_GHz);
  const Abm = 20.41 + 9.83 * Math.log10(d_km) + 7.894 * Math.log10(f_GHz) + 9.56 * Math.pow(Math.log10(f_GHz), 2);
  const Gb = Math.log10(hb / 200) * (13.958 + 5.8 * Math.pow(Math.log10(d_km), 2));
  let Gr_ecc = 0;
  if (citySize === 'small_medium') {
    Gr_ecc = (42.57 + 13.7 * Math.log10(f_GHz)) * (Math.log10(hr) - 0.6);
  } else if (citySize === 'large') {
    Gr_ecc = 0.759 * hr - 1.862;
  }
  const Lb = Afs + Abm - Gb - Gr_ecc;
  return Pt_dBm + Gt_ant + Gr_ant - Lb;
}

function calculateIkegamiPr(f, d_km, hr, W, H, lr, phi_deg, Pt_dBm, Gt, Gr) {
  const deltaH = Math.max(H - hr, 0.1);
  const phi_rad = phi_deg * (Math.PI / 180);
  const senPhi = Math.max(Math.sin(phi_rad), 0.0001);
  const Lb = 26.25 + 30 * Math.log10(f) + 20 * Math.log10(d_km)
             - 10 * Math.log10(1 + (3 / Math.pow(lr, 2)))
             - 10 * Math.log10(W)
             + 20 * Math.log10(deltaH)
             + 10 * Math.log10(senPhi);
  return Pt_dBm + Gt + Gr - Lb;
}

function calculateWalfishBertoniPr(f, d_km, H, hR, hm, b, Pt_dBm, Gt, Gr) {
  const argTan = (2 * (hR - hm)) / b;
  const termTan = Math.atan(argTan);
  const A = 5 * Math.log10(Math.pow(b / 2, 2) + Math.pow(hR - hm, 2))
            - 9 * Math.log10(b)
            + 20 * Math.log10(termTan !== 0 ? Math.abs(termTan) : 0.0001);
  const curvatureTerm = 1 - (Math.pow(d_km, 2) / (17 * H));
  const safeCurvature = Math.max(curvatureTerm, 0.0001);
  const L = 89.55 + A + 21 * Math.log10(f) + 38 * Math.log10(d_km) - 18 * Math.log10(H) - 18 * Math.log10(safeCurvature);
  return Pt_dBm + Gt + Gr - L;
}

function calculateCost231CompletePr(f, d_km, hB, hR, hm, W, b, phi, citySize, Pt_dBm, Gt, Gr) {
  const L0 = 32.4 + 20 * Math.log10(d_km) + 20 * Math.log10(f);
  const delta_hR = Math.max(hR - hm, 0.1);
  let Lori = 0;
  if (phi >= 0 && phi < 35) Lori = -10 + 0.3571 * phi;
  else if (phi >= 35 && phi <= 55) Lori = 2.5 + 0.075 * (phi - 35);
  else Lori = 4 + 0.114 * (phi - 55);

  let Lrts = -16.9 - 10 * Math.log10(W) + 10 * Math.log10(f) + 20 * Math.log10(delta_hR) + Lori;
  if (Lrts < 0) Lrts = 0;

  const delta_hB = hB - hR;
  let Lbsh = -18 * Math.log10(1 + delta_hB);
  if (delta_hB < 0) Lbsh = 0;

  let Ka = 54;
  if (delta_hB < 0) Ka = (d_km >= 0.5) ? (54 - 0.8 * delta_hB) : (54 - 1.6 * delta_hB * d_km);

  let Kd = 18;
  if (delta_hB < 0) Kd = 18 - 15 * (delta_hB / hR);

  let Kf = -4 + 0.7 * ((f / 925) - 1);
  if (citySize === 'large') Kf = -4 + 1.5 * ((f / 925) - 1);

  const Lmsd = Lbsh + Ka + Kd * Math.log10(d_km) + Kf * Math.log10(f) + 9 * Math.log10(b);
  const Lb = L0 + Lrts + Lmsd;
  return Pt_dBm + Gt + Gr - Lb;
}

function calculateEricssonPr(f, ht, hr, d_km, environment, Pt_dBm, Gt, Gr) {
  let a0 = 36.2, a1 = 30.2, a2 = -12, a3 = 0.1;
  if (environment === 'suburban') { a0 = 43.2; a1 = 68.93; }
  else if (environment === 'rural') { a0 = 45.96; a1 = 100.6; }
  const g_f = 44.49 * Math.log10(f) - 4.78 * Math.pow(Math.log10(f), 2);
  const Lb = a0 + a1 * Math.log10(d_km) + a2 * Math.log10(ht) + a3 * Math.log10(ht) * Math.log10(d_km) - 3.2 * Math.pow(Math.log10(11.75 * hr), 2) + g_f;
  return Pt_dBm + Gt + Gr - Lb;
}

function calculateTenLogAlpha0(hte, hre, Pt, Gt, Gr) {
  const dAlpha1 = 20 * Math.log10(hte / 30.48);
  const exponenteHr = hre > 3 ? 2 : 1;
  const dAlpha2 = 10 * exponenteHr * Math.log10(hre / 3);
  const dAlpha3 = 10 * Math.log10(Pt / 10);
  return dAlpha1 + dAlpha2 + dAlpha3 + (Gt - 6) + Gr;
}

// --- 3GPP TR 38.901 (5G / 6G) ---
function calculate3GPPPr(subModel, lineOfSight, f_MHz, h_BS, h_UT, d_2D_km, W_m, h_bldg_m, Pt_dBm, Gt, Gr) {
  const f_c = f_MHz / 1000; // GHz
  const d_2D = d_2D_km * 1000; // metros
  const h_E = 1.0;
  const c = 3e8;

  let PL = 0;
  const d_3D = Math.sqrt(Math.pow(d_2D, 2) + Math.pow(h_BS - h_UT, 2));

  if (subModel === 'rma') {
    const dBP = (2 * Math.PI * h_BS * h_UT * (f_c * 1e9)) / c;
    const min1 = Math.min(0.03 * Math.pow(h_bldg_m, 1.72), 10);
    const min2 = Math.min(0.044 * Math.pow(h_bldg_m, 1.72), 14.77);
    const PL1 = 20 * Math.log10((40 * Math.PI * d_3D * f_c) / 3) + min1 * Math.log10(d_3D) - min2 + 0.002 * h_bldg_m * d_3D;
    const PL_los = (d_2D <= dBP) ? PL1 : PL1 + 40 * Math.log10(d_3D / dBP);

    if (lineOfSight === 'los') {
      PL = PL_los;
    } else {
      const PL_nlos_prime = 161.04 - 7.1 * Math.log10(W_m) + 7.5 * Math.log10(h_bldg_m)
                            - (24.37 - 3.7 * Math.pow(h_bldg_m / h_BS, 2)) * Math.log10(h_BS)
                            + (43.42 - 3.1 * Math.log10(h_BS)) * (Math.log10(d_3D) - 3)
                            + 20 * Math.log10(f_c) - Math.pow(3.2 * Math.log10(11.75 * h_UT), 2) - 4.97;
      PL = Math.max(PL_los, PL_nlos_prime);
    }

  } else if (subModel === 'uma') {
    const h_prime_BS = h_BS - h_E;
    const h_prime_UT = h_UT - h_E;
    const d_BP_prime = (4 * h_prime_BS * h_prime_UT * (f_c * 1e9)) / c;
    const PL1 = 28.0 + 22 * Math.log10(d_3D) + 20 * Math.log10(f_c);
    const PL2 = 28.0 + 40 * Math.log10(d_3D) + 20 * Math.log10(f_c) - 9 * Math.log10(Math.pow(d_BP_prime, 2) + Math.pow(h_BS - h_UT, 2));
    const PL_los = (d_2D <= d_BP_prime) ? PL1 : PL2;

    if (lineOfSight === 'los') {
      PL = PL_los;
    } else {
      const PL_nlos_prime = 13.54 + 39.08 * Math.log10(d_3D) + 20 * Math.log10(f_c) - 0.6 * (h_UT - 1.5);
      PL = Math.max(PL_los, PL_nlos_prime);
    }

  } else if (subModel === 'umi') {
    const h_prime_BS = h_BS - h_E;
    const h_prime_UT = h_UT - h_E;
    const d_BP_prime = (4 * h_prime_BS * h_prime_UT * (f_c * 1e9)) / c;
    const PL1 = 32.4 + 21 * Math.log10(d_3D) + 20 * Math.log10(f_c);
    const PL2 = 32.4 + 40 * Math.log10(d_3D) + 20 * Math.log10(f_c) - 9.5 * Math.log10(Math.pow(d_BP_prime, 2) + Math.pow(h_BS - h_UT, 2));
    const PL_los = (d_2D <= d_BP_prime) ? PL1 : PL2;

    if (lineOfSight === 'los') {
      PL = PL_los;
    } else {
      const PL_nlos_prime = 35.3 * Math.log10(d_3D) + 22.4 + 21.3 * Math.log10(f_c) - 0.3 * (h_UT - 1.5);
      PL = Math.max(PL_los, PL_nlos_prime);
    }

  } else if (subModel === 'inh') {
    const PL_los = 32.4 + 17.3 * Math.log10(d_3D) + 20 * Math.log10(f_c);
    if (lineOfSight === 'los') {
      PL = PL_los;
    } else {
      const PL_nlos_prime = 38.3 * Math.log10(d_3D) + 17.30 + 24.9 * Math.log10(f_c);
      PL = Math.max(PL_los, PL_nlos_prime);
    }

  } else if (subModel === 'inf') {
    const PL_los = 31.84 + 21.50 * Math.log10(d_3D) + 19.00 * Math.log10(f_c);
    if (lineOfSight === 'los') {
      PL = PL_los;
    } else {
      const PL_base = 33 + 25.5 * Math.log10(d_3D) + 20 * Math.log10(f_c);
      PL = Math.max(PL_base, PL_los);
    }

  } else if (subModel === 'sma') {
    const d_BP = (2 * Math.PI * h_BS * h_UT * (f_c * 1e9)) / c;
    const min1 = Math.min(0.03 * Math.pow(h_bldg_m, 1.72), 10);
    const min2 = Math.min(0.044 * Math.pow(h_bldg_m, 1.72), 14.77);
    const PL1 = 20 * Math.log10((40 * Math.PI * d_3D * f_c) / 3) + min1 * Math.log10(d_3D) - min2 + 0.002 * h_bldg_m * d_3D;
    const PL_los = (d_2D <= d_BP) ? PL1 : PL1 + 40 * Math.log10(d_3D / d_BP);

    if (lineOfSight === 'los') {
      PL = PL_los;
    } else {
      const PL_nlos_prime = 161.04 - 7.1 * Math.log10(W_m) + 7.5 * Math.log10(h_bldg_m)
                            - (24.37 - 3.7 * Math.pow(h_bldg_m / h_BS, 2)) * Math.log10(h_BS)
                            + (43.42 - 3.1 * Math.log10(h_BS)) * (Math.log10(d_3D) - 3)
                            + 20 * Math.log10(f_c) - Math.pow(3.2 * Math.log10(11.75 * h_UT), 2) - 4.97;
      PL = Math.max(PL_los, PL_nlos_prime);
    }
  }

  return Pt_dBm + Gt + Gr - PL;
}

// --- ENDPOINT DE SIMULACIÓN ---
app.post('/api/simulate', (req, res) => {
  try {
    const {
      model = '3gpp',
      subModel = 'uma',
      lineOfSight = 'los',
      f = 2000,
      Pt = 10,
      Gt = 6,
      Gr = 0,
      hte = 25,
      hre = 1.5,
      environment = 'urban',
      citySize = 'small_medium',
      W = 20,
      H = 5,
      lr = 10,
      phi = 90,
      hR = 15,
      b = 20,
      dMax = 5
    } = req.body;

    const distances = [];
    const prValues = [];
    const step = 0.1;
    const Pt_dBm = 10 * Math.log10(Pt * 1000);

    let n = 20;
    if (f > 900) n = 30;
    const tenLogAlpha0 = calculateTenLogAlpha0(hte, hre, Pt, Gt, Gr);
    let P_ref = -53.9, gamma = 38.4;
    if (environment === 'urban') { P_ref = -62.5; gamma = 36.8; }
    else if (environment === 'newark') { P_ref = -55.2; gamma = 43.1; }
    else if (environment === 'tokyo') { P_ref = -77.8; gamma = 30.5; }
    const freqTerm = n * Math.log10(f / 900);

    for (let d = step; d <= dMax; d = parseFloat((d + step).toFixed(2))) {
      let Pr = 0;

      if (model === '3gpp') {
        Pr = calculate3GPPPr(subModel, lineOfSight, f, hte, hre, d, W, H, Pt_dBm, Gt, Gr);
      } else if (model === 'okumura-hata') {
        Pr = calculateOkumuraHataPr(f, hte, hre, d, environment, citySize, Pt_dBm, Gt, Gr);
      } else if (model === 'cost231-hata') {
        Pr = calculateCost231HataPr(f, hte, hre, d, citySize, Pt_dBm, Gt, Gr);
      } else if (model === 'cost231-complete') {
        Pr = calculateCost231CompletePr(f, d, hte, hR, hre, W, b, phi, citySize, Pt_dBm, Gt, Gr);
      } else if (model === 'ecc-33') {
        Pr = calculateECC33Pr(f, hte, hre, d, citySize, Pt_dBm, Gt, Gr);
      } else if (model === 'ikegami') {
        Pr = calculateIkegamiPr(f, d, hre, W, H, lr, phi, Pt_dBm, Gt, Gr);
      } else if (model === 'walfish-bertoni') {
        Pr = calculateWalfishBertoniPr(f, d, H, hR, hre, b, Pt_dBm, Gt, Gr);
      } else if (model === 'ericsson') {
        Pr = calculateEricssonPr(f, hte, hre, d, environment, Pt_dBm, Gt, Gr);
      } else {
        // lee
        Pr = P_ref - (gamma * Math.log10(d)) - freqTerm + tenLogAlpha0;
      }

      distances.push(d);
      prValues.push(parseFloat(Pr.toFixed(2)));
    }

    res.json({
      success: true,
      summary: {
        model_used: `${model}${subModel && model === '3gpp' ? ' · ' + subModel.toUpperCase() + ' · ' + lineOfSight.toUpperCase() : ''}`,
        frequency: f,
        tenLogAlpha0: parseFloat(tenLogAlpha0.toFixed(2)),
        n_used: n
      },
      data: { distances, prValues }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});