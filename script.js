document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const val = (id) => $(id)?.value || '';
    const isChecked = (id) => $(id)?.checked;
    
    // --- State ---
    let sedationInterval = null;
    let secondsElapsed = 0;
    
    // --- Persistence (Auto-Save) Logic ---
    function saveState() {
        const data = {};
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') {
                if (el.checked) data[el.id || el.name + ':' + el.value] = true;
            } else if (el.id) {
                data[el.id] = el.value;
            }
        });
        data['drug-table-html'] = $('drug-table-body').innerHTML;
        data['obs-table-html'] = $('monitoring-log-body').innerHTML;
        data['dose-output-html'] = $('dose-output').innerHTML;
        data['dose-output-visible'] = !$('dose-output').classList.contains('hidden');
        
        data['timer-display'] = $('timer-display').textContent;
        data['seconds-elapsed'] = secondsElapsed;
        data['timer-running'] = !!sedationInterval;
        data['btn-start-text'] = $('procedure-start-output').textContent;
        data['btn-end-text'] = $('procedure-end-output').textContent;
        data['btn-awake-text'] = $('patient-awake-output').textContent;
        
        localStorage.setItem('sedation_record_data', JSON.stringify(data));
        generateEPRLog();
    }

    function loadState() {
        const saved = localStorage.getItem('sedation_record_data');
        if (!saved) { generateEPRLog(); return; } 
        
        try {
            const data = JSON.parse(saved);
            document.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.type === 'checkbox') {
                    if (data[el.id]) el.checked = true;
                } else if (el.type === 'radio') {
                    if (data[el.name + ':' + el.value]) el.checked = true;
                } else if (el.id && data[el.id] !== undefined) {
                    el.value = data[el.id];
                }
            });

            if(data['drug-table-html']) $('drug-table-body').innerHTML = data['drug-table-html'];
            if(data['obs-table-html']) $('monitoring-log-body').innerHTML = data['obs-table-html'];
            if(data['dose-output-html']) $('dose-output').innerHTML = data['dose-output-html'];
            if(data['dose-output-visible']) $('dose-output').classList.remove('hidden');

            if(data['timer-display']) $('timer-display').textContent = data['timer-display'];
            if(data['seconds-elapsed']) secondsElapsed = parseInt(data['seconds-elapsed']);
            
            if(data['btn-start-text']) {
                $('procedure-start-output').textContent = data['btn-start-text'];
                $('procedure-start-button').classList.add('opacity-50', 'cursor-not-allowed');
                $('procedure-start-button').disabled = true;
            }
            if(data['btn-end-text']) {
                $('procedure-end-output').textContent = data['btn-end-text'];
                $('procedure-end-button').classList.add('opacity-50', 'cursor-not-allowed');
                $('procedure-end-button').disabled = true;
            }
            if(data['btn-awake-text']) {
                $('patient-awake-output').textContent = data['btn-awake-text'];
                $('patient-awake-button').classList.add('opacity-50', 'cursor-not-allowed');
                $('patient-awake-button').disabled = true;
            }

            toggleCapacity();
            checkAsaAlert(); // Check on load
            generateEPRLog();
        } catch (e) { console.error("Load Error", e); }
    }

    // --- Utility Functions ---
    function findCheckedRadio(name) {
        const radios = document.getElementsByName(name);
        for (let i = 0; i < radios.length; i++) {
            if (radios[i].checked) return radios[i].value;
        }
        return '';
    }

    const toggleCapacity = () => {
        const cap = findCheckedRadio('capacity');
        const yesDiv = $('capacity-yes-options');
        const noDiv = $('capacity-no-options');
        
        if(cap === 'No') {
            yesDiv.classList.add('hidden');
            noDiv.classList.remove('hidden');
        } else {
            yesDiv.classList.remove('hidden');
            noDiv.classList.add('hidden');
        }
        generateEPRLog();
    };
    document.getElementsByName('capacity').forEach(r => r.addEventListener('change', () => { toggleCapacity(); saveState(); }));

    // --- ASA Alert Logic ---
    function checkAsaAlert() {
        const grade = findCheckedRadio('asa-grade');
        const alertBox = $('asa-high-alert');
        
        if(grade === 'III' || grade === 'IV' || grade === 'V') {
            alertBox.classList.remove('hidden');
        } else {
            alertBox.classList.add('hidden');
        }
        generateEPRLog();
    }
    document.getElementsByName('asa-grade').forEach(r => r.addEventListener('change', () => { checkAsaAlert(); saveState(); }));
    $('asa-emergency').addEventListener('change', () => { generateEPRLog(); saveState(); });


    // --- EPR LOG GENERATOR (UPDATED FOR RICH TEXT & SUMMARY) ---
    function generateEPRLog() {
        if (!$('epr-log-output')) return; 

        try {
            let log = '';
            const date = new Date().toLocaleDateString('en-GB', {year:'numeric', month:'short', day:'2-digit'});
            
            // --- 1. SHORT SUMMARY HEADER ---
            // Calculate totals
            let drugTotals = {};
            const drugRows = $('drug-table-body').querySelectorAll('tr');
            drugRows.forEach(row => {
                 const cells = row.querySelectorAll('td');
                 const name = cells[1].textContent.trim();
                 const dose = parseFloat(cells[2].textContent) || 0;
                 if(!drugTotals[name]) drugTotals[name] = 0;
                 drugTotals[name] += dose;
            });
            
            let drugsSummary = Object.entries(drugTotals).map(([name, total]) => {
                 let unit = (name.toLowerCase().includes('fentanyl')) ? 'mcg' : 'mg';
                 return `${name} ${total}${unit}`;
            }).join(', ');
            
            if(!drugsSummary) drugsSummary = "None Recorded";

            log += `<span style="font-weight:bold; font-size:1.1em; color:#1e293b;">SUMMARY:</span> `;
            log += `${val('procedure') || 'Procedure'} for ${val('indication') || '...'}. `;
            log += `<span style="font-weight:bold">${findCheckedRadio('outcome-proc') || 'Outcome Pending'}</span>. `;
            log += `Total Drugs: <span style="font-weight:bold">${drugsSummary}</span><br><br>`;
            
            log += `<span style="font-weight:bold">PROCEDURAL SEDATION RECORD (${date})</span><br>`;
            log += `----------------------------------------------------------<br>`;
            
            log += `<span style="font-weight:bold">1. Staff & Patient</span><br>`;
            // Removed Patient Name from here as per sticker request, or keep generic placeholder if needed
            log += `Procedure: <span style="font-weight:bold">${val('procedure') || 'Not specified'}</span><br>`;
            log += `Indication: ${val('indication') || 'Not specified'}<br>`;
            
            if(isChecked('senior-aware')) log += `<span style="font-weight:bold; color:#166534;">✓ Senior in Department Aware</span><br>`;
            
            log += `Sedationist: ${val('sedationist') || '...'} (${val('sedationist-grade') || 'Grade'})<br>`;
            log += `Proc. Dr: ${val('procedure-doctor') || '...'} | Nurse: ${val('nurse') || '...'}<br>`;
            
            const weightEst = isChecked('weight-estimated') ? '(Est)' : '';
            log += `Weight: ${val('weight') || '--'} kg ${weightEst} | Age: ${val('age') || '--'} yrs<br>`;
            
            if(isChecked('frail-elderly')) log += `<span style="font-style:italic">Patient flagged as Frail / >65</span><br>`;

            log += `Allergies: <span style="font-weight:bold; color:#b91c1c;">${val('allergies') || 'None Known'}</span><br>`;
            log += `Pre-Analgesia: ${val('pre-analgesia') || 'None'}<br>`;
            log += `Fasting: Food (${val('last-food') || '--:--'}) | Fluid (${val('last-fluid') || '--:--'})<br><br>`;

            log += `<span style="font-weight:bold">2. Assessment & Consent</span><br>`;
            
            const mallampati = findCheckedRadio('airway-mallampati');
            const ulbt = findCheckedRadio('airway-ulbt');
            let airwayFlags = [];
            if(isChecked('airway-mouth')) airwayFlags.push('Mouth Opening <3cm');
            if(isChecked('airway-tmd')) airwayFlags.push('TMD <6cm');
            if(isChecked('airway-neck')) airwayFlags.push('Neck Mobility Reduced');
            if(isChecked('airway-bmi')) airwayFlags.push('High BMI');

            if(mallampati || ulbt || airwayFlags.length > 0) {
                log += `Airway: Mallampati ${mallampati || '-'} | ULBT ${ulbt || '-'} | Flags: ${airwayFlags.length ? airwayFlags.join(', ') : 'None'}<br>`;
            }

            // -- ASA Grade with Emergency Modifier --
            let asa = findCheckedRadio('asa-grade') || '-';
            if (isChecked('asa-emergency') && asa !== '-') {
                asa += 'E'; // Append E
            }
            log += `ASA Grade: <span style="font-weight:bold">${asa}</span><br>`;
            
            let ci = [];
            if(isChecked('ci-allergy')) ci.push('Allergy');
            if(isChecked('ci-hemo')) ci.push('Haemodynamic Instability');
            if(isChecked('ci-gcs')) ci.push('Compromised Airway/GCS');
            if(ci.length > 0) log += `<span style="font-weight:bold; color:#b91c1c;">CONTRAINDICATIONS NOTED: ${ci.join(', ')}</span><br>`;

            log += `Capacity: ${findCheckedRadio('capacity') || 'Yes'}<br>`;
            
            let risks = [];
            if(isChecked('risk-nausea')) risks.push('Nausea');
            if(isChecked('risk-drowsy')) risks.push('Drowsiness');
            if(isChecked('risk-hypotension')) risks.push('Hypotension');
            if(isChecked('risk-resp-depress')) risks.push('Hypoxia');
            if(isChecked('risk-laryngospasm')) risks.push('Laryngospasm');
            if(isChecked('risk-aspiration')) risks.push('Aspiration');
            if(isChecked('risk-allergy')) risks.push('Anaphylaxis');
            if(isChecked('risk-failure')) risks.push('Proc Failure');
            if(isChecked('risk-treatment')) risks.push('Further Tx/Admission');
            if(isChecked('risk-emergence')) risks.push('Emergence Reaction');

            if(risks.length === 0) risks.push('None documented');
            log += `Risks Discussed: ${risks.join(', ')}<br>`;
            log += `Consent: ${findCheckedRadio('consent-type') || '...'}<br>`;
            
            let consentExtras = [];
            if(isChecked('consent-leaflet')) consentExtras.push('Leaflet Given');
            if(isChecked('consent-questions')) consentExtras.push('Questions Answered');
            if(consentExtras.length > 0) log += `Consent Notes: ${consentExtras.join(', ')}<br>`;

            log += `<br><span style="font-weight:bold">3. Plan & Safety</span><br>`;
            log += `Target: ${val('plan-target') || '...'} | Agent: ${val('plan-agent') || '...'}<br>`;
            
            log += `Pre-Vitals: HR ${val('pre-vital-hr') || '-'} | BP ${val('pre-vital-bp') || '-'} | SpO2 ${val('pre-vital-spo2') || '-'}% | RR ${val('pre-vital-rr') || '-'} <br>`;
            
            let soap = [];
            if(isChecked('soap-s')) soap.push('Suction');
            if(isChecked('soap-o')) soap.push('Oxygen/BVM');
            if(isChecked('soap-a')) soap.push('Airway Equipment');
            if(isChecked('soap-m')) soap.push('Monitoring');
            if(isChecked('soap-e')) soap.push('Environment/IV');
            if(soap.length > 0) log += `Checklist (SOAP-ME): ${soap.join(', ')}<br>`;

            if(isChecked('plan-aagbi')) log += `Monitoring: AAGBI Standards + Waveform Capnography Confirmed<br>`;

            let timeOut = [];
            if(isChecked('to-identity')) timeOut.push('Patient ID');
            if(isChecked('to-role')) timeOut.push('Roles Assigned');
            if(isChecked('to-site')) timeOut.push('Site/Side');
            if(isChecked('to-monitoring')) timeOut.push('Monitoring Active');
            log += `Safety Time Out: ${timeOut.length ? timeOut.join(', ') : 'None Recorded'}<br>`;
            
            log += `<br><span style="font-weight:bold">4. Intra-Procedure Log</span><br>`;
            log += `Proc Start: ${$('procedure-start-output')?.textContent || '--:--'} | End: ${$('procedure-end-output')?.textContent || '--:--'} | Awake: ${$('patient-awake-output')?.textContent || '--:--'}<br>`;
            
            if (drugRows.length > 0) {
                log += `<span style="text-decoration:underline">Drugs Given:</span><br>`;
                drugRows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    const inputVal = cells[0].querySelector('input').value;
                    const dTime = inputVal.match(/\((.*?)\)/)?.[1]?.trim() || inputVal.trim();
                    const drugName = cells[1].textContent;
                    const drugDose = cells[2].textContent;
                    log += `- ${dTime}: ${drugName} ${drugDose} mg<br>`;
                });
            } else {
                log += `<span style="font-style:italic">No drugs recorded yet.</span><br>`;
            }

            const obsRows = $('monitoring-log-body').querySelectorAll('tr');
            if (obsRows.length > 0) {
                log += `<span style="text-decoration:underline">Observations:</span><br>`;
                obsRows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    const oTime = cells[0].querySelector('input').value;
                    const hr = cells[1].querySelector('input').value;
                    const bp = cells[2].querySelector('input').value;
                    const spo2 = cells[3].querySelector('input').value;
                    const rr = cells[4].querySelector('input').value;
                    if(hr || bp || spo2 || rr) {
                        log += `- ${oTime}: HR ${hr}, BP ${bp}, SpO2 ${spo2}%, RR ${rr}<br>`;
                    }
                });
            }
            
            // Complications Section
            if(val('complications-notes')) {
                log += `<br><span style="font-weight:bold; color:#b91c1c;">COMPLICATIONS & INTERVENTION:</span><br>${val('complications-notes')}<br>`;
            }

            if(val('general-notes')) log += `<br><span style="font-weight:bold">Notes:</span> ${val('general-notes')}<br>`;
            log += `<br>`;

            log += `<span style="font-weight:bold">5. Outcome & Discharge</span><br>`;
            log += `Outcome: ${findCheckedRadio('outcome-proc') || '...'}<br>`;
            log += `Disposal: ${findCheckedRadio('disposal') || '...'}<br>`;
            
            let dc = [];
            if(isChecked('dc-vitals')) dc.push('Vitals Baseline');
            if(isChecked('dc-aao')) dc.push('Alert/Orientated');
            if(isChecked('dc-oral')) dc.push('Tol. Fluids');
            if(isChecked('dc-pain')) dc.push('Pain Managed');
            if(isChecked('dc-home')) dc.push('Home Care');
            if(isChecked('dc-reversal-time')) dc.push('Reversal Wait OK');
            log += `Discharge Checks: ${dc.length ? dc.join(', ') : 'None Checked'}<br>`;

            let di = [];
            if(isChecked('di-drive')) di.push('No Driving');
            if(isChecked('di-adult')) di.push('Accompanied');
            if(isChecked('di-alcohol')) di.push('No Alcohol');
            if(isChecked('di-decisions')) di.push('No Legal Decisions');
            if(di.length > 0) log += `Instructions Given: ${di.join(', ')}<br>`;
            
            if(val('signoff-name') || val('signoff-gmc')) {
                log += `<br><span style="font-weight:bold">Signed Off By:</span> ${val('signoff-name')} (GMC: ${val('signoff-gmc')}) @ ${val('signoff-time')}`;
            }
            
            $('epr-log-output').innerHTML = log;
        } catch (e) {
            console.error("Log generation error:", e);
        }
    }

    // --- DISCHARGE LETTER LOGIC ---
    const showDischargeLetter = () => {
        const now = new Date();
        const nowStr = now.toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'});
        $('letter-date').textContent = nowStr;
        $('letter-patient-name').textContent = val('patient-name') || '______________________'; // Keeps blank line if no input
        $('letter-procedure').textContent = val('procedure') || 'Procedure';

        const drugRows = document.querySelectorAll('#drug-table-body tr td:nth-child(2)');
        let drugsSet = new Set();
        drugRows.forEach(td => drugsSet.add(td.textContent.trim()));
        
        const drugsArray = Array.from(drugsSet);
        const drugsString = drugsArray.length > 0 ? drugsArray.join(' & ') : "Sedation";
        $('letter-drugs-given').textContent = drugsString;

        const sideEffectsList = $('letter-side-effects-list');
        sideEffectsList.innerHTML = ''; 

        const addEffect = (text) => {
            const li = document.createElement('li');
            li.textContent = text;
            sideEffectsList.appendChild(li);
        };

        addEffect("You may feel tired, dizzy, or unsteady on your feet. Take it easy and rest.");
        addEffect("You may not remember much about the procedure (Amnesia). This is normal.");

        const hasKetamine = drugsArray.some(d => d.toLowerCase().includes('ketamine'));
        const hasOpioid = drugsArray.some(d => d.toLowerCase().includes('fentanyl') || d.toLowerCase().includes('morphine'));
        
        if (hasKetamine) {
            addEffect("Ketamine can cause vivid dreams or 'daydreams' as it wears off. A quiet, calm environment helps this pass naturally.");
        }
        if (hasOpioid) {
            addEffect("You may feel a little nauseous or itchy. This usually settles quickly.");
        } else {
            addEffect("You may feel a little nauseous. Eat light meals and drink plenty of water.");
        }
        
        addEffect("If your cannula site (where the needle was) becomes red, hot, or swollen, please seek medical advice.");

        let sedTimeStr = $('procedure-end-output').textContent;
        if (!sedTimeStr || sedTimeStr.trim() === '') sedTimeStr = val('signoff-time');
        if (!sedTimeStr || sedTimeStr.trim() === '') sedTimeStr = now.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});

        let baseDate = new Date();
        const parts = sedTimeStr.split(':');
        if (parts.length === 2) {
            baseDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
        }

        const expiryDate = new Date(baseDate.getTime() + (24 * 60 * 60 * 1000));
        const timeOpts = {hour:'2-digit', minute:'2-digit'};
        const dateOpts = {day:'numeric', month:'short'};
        
        $('letter-time-start').textContent = baseDate.toLocaleTimeString('en-GB', timeOpts);
        $('letter-date-start').textContent = baseDate.toLocaleDateString('en-GB', dateOpts);
        $('letter-time-end').textContent = expiryDate.toLocaleTimeString('en-GB', timeOpts);
        $('letter-date-end').textContent = expiryDate.toLocaleDateString('en-GB', dateOpts);
        
        $('main-app-container').classList.add('hidden');
        $('discharge-letter-view').classList.remove('hidden');
        window.scrollTo(0, 0);
    };

    $('create-discharge-letter-btn').onclick = showDischargeLetter;
    $('header-print-letter-btn').onclick = showDischargeLetter;

    $('close-letter-btn').onclick = () => {
        $('discharge-letter-view').classList.add('hidden');
        $('main-app-container').classList.remove('hidden');
    };

    $('print-letter-btn').onclick = () => {
        document.body.classList.add('printing-letter');
        window.print();
        document.body.classList.remove('printing-letter');
    };

    $('print-button').onclick = () => window.print();
    $('header-print-btn').onclick = () => window.print();
    
    // Updated CLEAR FORM Button Logic
    $('clear-form-button').onclick = () => {
        if(confirm("⚠️ ARE YOU SURE?\n\nThis will permanently delete all entered data and reset the form.")) {
            localStorage.removeItem('sedation_record_data');
            location.reload();
        }
    };
    
    $('calculate-doses-button').onclick = () => {
        const w = parseFloat(val('weight'));
        if(!w) return alert("Enter weight first");
        const frail = isChecked('frail-elderly');
        
        const p_std_low = (0.5 * w).toFixed(0);
        const p_std_high = (1.0 * w).toFixed(0);
        const p_frail_low = (0.25 * w).toFixed(0); 
        const p_frail_high = (0.5 * w).toFixed(0);
        
        const k_diss_low = (1.0 * w).toFixed(0);
        const k_diss_high = (2.0 * w).toFixed(0); 
        const k_analgesia_low = (0.3 * w).toFixed(1); 
        const k_analgesia_high = (0.5 * w).toFixed(1); 
        
        const m_initial_low = 1; 
        const m_initial_high = Math.min(2.0, 0.05 * w).toFixed(1); 
        
        const f_initial_max_mcg = (0.5 * w).toFixed(0); 
        
        let p_output = frail 
            ? `<strong>Propofol (Frail/Elderly):</strong> ${p_frail_low}-${p_frail_high} mg (0.25-0.5 mg/kg IV)`
            : `<strong>Propofol (Adult):</strong> ${p_std_low}-${p_std_high} mg (0.5-1.0 mg/kg IV)`;
        
        $('dose-output').innerHTML = `
            <p class="mb-1">${p_output}</p>
            <p class="mb-1"><strong>Ketamine (Dissociative):</strong> ${k_diss_low}-${k_diss_high} mg (1-2 mg/kg IV)</p>
            <p class="mb-1"><strong>Ketamine (Analgesia):</strong> ${k_analgesia_low}-${k_analgesia_high} mg (0.3-0.5 mg/kg IV)</p>
            <p class="mb-1"><strong>Midazolam (Adjunct):</strong> ${m_initial_low}-${m_initial_high} mg (Initial 1-2 mg; max 2.5 mg single dose)</p>
            <p class="mb-1"><strong>Fentanyl (Adjunct):</strong> Up to ${f_initial_max_mcg} mcg (Up to 0.5 mcg/kg IV with sedatives)</p>
            <hr class="my-2 border-blue-200">
            <span class="text-xs text-slate-600">All doses are initial bolus ranges. Titrate slowly to effect.</span>
        `;
        $('dose-output').classList.remove('hidden');
        saveState();
    };

    const toggle = (btnId, contentId) => {
        const btn = $(btnId);
        if(btn) btn.onclick = () => $(contentId).classList.toggle('hidden');
    };
    toggle('asa-guide-button', 'asa-guide-content');
    toggle('complications-guide-button', 'complications-guide-content');

    // --- Timer Logic ---
    const timerBtn = $('sedation-timer-button');
    timerBtn.onclick = () => {
        if(sedationInterval) stopTimer();
        else {
            const safetyChecks = isChecked('to-identity') && isChecked('to-role') && isChecked('to-site') && isChecked('to-monitoring');
            if(!safetyChecks) {
                if(!confirm("⚠️ SAFETY WARNING: 'Time Out' checks are not fully completed.\n\nAre you sure you want to start sedation?")) return;
            }
            startTimer();
        }
    };

    function startTimer() {
        timerBtn.textContent = "STOP TIMER";
        timerBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'border-green-700');
        timerBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'border-red-700');
        
        if(secondsElapsed === 0) addObsRow(); 
        saveState();
        
        sedationInterval = setInterval(() => {
            secondsElapsed++;
            const h = new Date(secondsElapsed * 1000).toISOString().substr(11, 8);
            $('timer-display').textContent = h;
            if(secondsElapsed % 300 === 0) $('obs-toast').classList.remove('hidden');
        }, 1000);
    }

    function stopTimer() {
        clearInterval(sedationInterval);
        sedationInterval = null;
        timerBtn.textContent = "START TIMER";
        timerBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'border-green-700');
        timerBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'border-red-700');
        $('obs-toast').classList.add('hidden');
        saveState();
    }
    
    $('dismiss-toast-button').onclick = () => $('obs-toast').classList.add('hidden');

    ['procedure-start', 'procedure-end', 'patient-awake'].forEach(key => {
        $(`${key}-button`).onclick = function() {
            const time = new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
            $(`${key}-output`).textContent = time;
            this.disabled = true;
            this.classList.add('opacity-50', 'cursor-not-allowed');
            saveState();
        }
    });

    $('add-obs-button').onclick = addObsRow;
    
    function addObsRow() {
        const tr = document.createElement('tr');
        const t = secondsElapsed > 0 ? `T+${Math.floor(secondsElapsed/60)}m` : 'Pre';
        const time = new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
        tr.innerHTML = `
            <td class="p-1"><input type="text" value="${t} (${time})" readonly class="text-xs bg-slate-50 border-none px-1 rounded"></td>
            <td class="p-1"><input type="text" class="text-center font-bold border-slate-300 rounded" oninput="saveState()"></td>
            <td class="p-1"><input type="text" class="text-center font-bold border-slate-300 rounded" oninput="saveState()"></td>
            <td class="p-1"><input type="text" class="text-center font-bold border-slate-300 rounded" oninput="saveState()"></td>
            <td class="p-1"><input type="text" class="text-center font-bold border-slate-300 rounded" oninput="saveState()"></td>
            <td class="p-1"><input type="text" class="text-center font-bold border-slate-300 rounded" oninput="saveState()"></td>
            <td class="p-1 border border-slate-300 rounded" onchange="saveState()">${$('obs-score-template').innerHTML}</td>
            <td class="p-1 text-center"><button class="text-red-500 font-bold hover:bg-red-50 rounded px-2" onclick="this.closest('tr').remove(); saveState()">x</button></td>
        `;
        $('monitoring-log-body').appendChild(tr);
        saveState();
    }

    $('drug-admin-container').onclick = async (e) => {
        if(e.target.tagName !== 'BUTTON') return;
        let drug = e.target.dataset.drug;
        if(drug === 'Other') drug = await promptModal("Drug Name:");
        if(!drug) return;
        const dose = await promptModal(`Dose for ${drug} (mg):`);
        if(!dose) return;
        
        const tr = document.createElement('tr');
        const time = new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
        tr.innerHTML = `
            <td class="p-2"><input type="text" value="${time}" readonly class="text-xs bg-transparent border-none"></td>
            <td class="p-2 font-bold text-slate-700">${drug}</td>
            <td class="p-2 font-bold">${dose}</td>
            <td class="p-2 text-xs">${val('sedationist')}</td>
            <td class="p-2 text-center"><button class="text-red-500 font-bold hover:bg-red-50 rounded px-2" onclick="this.closest('tr').remove(); saveState()">x</button></td>
        `;
        $('drug-table-body').appendChild(tr);
        saveState();
    };

    // --- Modal Logic ---
    const modal = $('custom-modal-backdrop');
    const modalContent = $('custom-modal');
    let modalResolve = null;

    window.promptModal = (label) => {
        return new Promise(resolve => {
            $('custom-modal-label').textContent = label;
            $('custom-modal-input').value = '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                modalContent.classList.remove('scale-95', 'opacity-0');
                modalContent.classList.add('scale-100', 'opacity-100');
                $('custom-modal-input').focus();
            }, 10);
            modalResolve = resolve;
        });
    };

    const closeModal = (val) => {
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if(modalResolve) modalResolve(val);
            modalResolve = null;
        }, 200);
    };

    $('custom-modal-ok').onclick = () => closeModal($('custom-modal-input').value);
    $('custom-modal-cancel').onclick = () => closeModal(null);
    $('custom-modal-input').onkeydown = (e) => { if(e.key === 'Enter') $('custom-modal-ok').click(); };

    const form = $('sedation-form');
    form.addEventListener('input', saveState);
    form.addEventListener('change', saveState);
    
    if ($('epr-log-output')) {
        loadState();
        $('copy-log-button').onclick = async () => {
            try {
                const el = $('epr-log-output');
                const htmlBlob = new Blob([el.innerHTML], { type: 'text/html' });
                const textBlob = new Blob([el.innerText], { type: 'text/plain' });
                await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
                const btn = $('copy-log-button');
                const orig = btn.innerText;
                btn.innerText = '✅ Copied!';
                btn.classList.add('bg-green-600', 'hover:bg-green-700');
                btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                setTimeout(() => {
                    btn.innerText = orig;
                    btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                    btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                }, 2000);
            } catch (err) { alert("Copy failed. Please manually select and copy."); }
        };
    }
});
