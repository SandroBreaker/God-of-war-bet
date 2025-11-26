document.addEventListener('DOMContentLoaded', () => {

  // ------------------- CONFIG GOD OF WAR -------------------
  // Símbolos Atualizados:
  // fa-snowflake (Gelo/Machado) - Low
  // fa-shield-halved (Escudo Espartano) - Mid
  // fa-fire (Lâminas do Caos) - High
  // fa-omega (Símbolo da Guerra) - Jackpot
  
  const SYMBOLS = [
    { cls: 'fa-snowflake', weight: 75, color: '#74b9ff', mult3: 0.75, mult4: 1 }, // Azul Gelo
    { cls: 'fa-shield-halved', weight: 40, color: '#cd6133', mult3: 1.5, mult4: 2 }, // Bronze
    { cls: 'fa-fire', weight: 25, color: '#e17055', mult3: 2.5, mult4: 5 }, // Laranja Fogo
    { cls: 'fa-bolt', weight: 5, color: '#ff3f34', mult3: 50, mult4: 100 }    // Vermelho Sangue
  ];

  const COLORS_BY_CLS = Object.fromEntries(SYMBOLS.map(s => [s.cls, s.color]));
  const WEIGHT_BY_CLS = Object.fromEntries(SYMBOLS.map(s => [s.cls, s.weight]));
  const PAYOUT_BY_CLS = Object.fromEntries(SYMBOLS.map(s => [s.cls, { mult3: s.mult3, mult4: s.mult4 }]));
  const CLS_LIST = SYMBOLS.map(s => s.cls);

  // Sons (mesma estrutura, pode trocar os arquivos mp3 depois por sons de machado/espada)
  const sounds = {
    sound0: new Audio('assets/myinstants.mp3'),
    // ... manter os outros se existirem ou remover se não tiver arquivos
  };

  // ------------------- STATE -------------------
  let balance = 50.0;
  let bet = 5.0;
  let totalWinAccum = 0;
  let totalBetAccum = 0;
  let audioCtxStarted = false;
  let spinning = false;

  // ------------------- DOM -------------------
  const balanceEl = document.getElementById('balance');
  const betDisplayEl = document.getElementById('betDisplay');
  const betValueEl = document.getElementById('betValue');
  const lastResultEl = document.getElementById('lastResult');
  let personaAdviceEl = document.getElementById('personaAdvice');
  const rtpEl = document.getElementById('rtp');
  const spinBtn = document.getElementById('spinBtn');
  const reelsEls = [...document.querySelectorAll('.reel')];
  const decBetBtn = document.getElementById('decBet');
  const incBetBtn = document.getElementById('incBet');
  const payoutsEl = document.getElementById('payouts');
  const totalWinEl = document.getElementById('totalWin');
  const totalBetEl = document.getElementById('totalBet');
  const balanceScaleGreen = document.getElementById('balanceScaleGreen');
  const balanceScaleRed = document.getElementById('balanceScaleRed');
  const balanceScaleText = document.getElementById('balanceScaleText');

  if(!spinBtn || reelsEls.length === 0) return;

  const reelCells = reelsEls.map(reel => [...reel.querySelectorAll('.cell i')]);

  // ------------------- UTILITÁRIOS -------------------
  function formatMoney(val){ return `R$ ${Number(val || 0).toFixed(1)}`; }

  const weightedSymbols = [];
  (function buildInitialWeightedSymbols(){
    CLS_LIST.forEach(cls => {
      const w = Math.max(0, Number(WEIGHT_BY_CLS[cls] || 0));
      for(let i=0;i<w;i++) weightedSymbols.push(cls);
    });
  })();
  
  const winSound = new Audio('sounds/bigwin.mp3'); 
  winSound.volume = 0.55;

  function getRandomSymbol(){
    if(weightedSymbols.length === 0) return CLS_LIST[0];
    return weightedSymbols[Math.floor(Math.random()*weightedSymbols.length)];
  }

  function startAudioContext(){
    if(!audioCtxStarted){
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        new AudioContext();
        audioCtxStarted = true;
      } catch(e) { console.warn(e); }
    }
  }

  // ------------------- DISPLAY -------------------
  function renderPayoutCards(){
    payoutsEl.innerHTML = '';
    SYMBOLS.forEach(s => {
      const mult3 = PAYOUT_BY_CLS[s.cls].mult3;
      
      const card = document.createElement('div');
      card.className = 'payout-card';
      
      card.innerHTML = `
        <i class="fa-solid ${s.cls}" style="color:${s.color};"></i>
        <div class="mult" style="margin-top:4px;">
          3x = ${mult3}
        </div>
        <div class="value" style="margin-top:2px;">
          ${formatMoney(bet * mult3)}
        </div>
      `;
      payoutsEl.appendChild(card);
    });
  }

  function updateBalanceScale(){
    const lucroLiquido = totalWinAccum - totalBetAccum;
    const pct = totalBetAccum ? (lucroLiquido / totalBetAccum) * 100 : 0;
    
    // Texto temático
    balanceScaleText.textContent = pct >= 0 
      ? `Favor dos Deuses: ${Math.round(pct)}%` 
      : `Dívida de Sangue: ${Math.round(pct)}%`;

    let greenWidth = 50;
    let redWidth = 50;

    if (pct >= 0) {
      greenWidth = 50 + (pct / 2);
    } else {
      redWidth = 50 + (Math.abs(pct) / 2);
    }
    const maxWidth = window.innerWidth < 480 ? 120 : 180;
    balanceScaleGreen.style.width = `${Math.min(greenWidth, maxWidth)}%`;
    balanceScaleRed.style.width = `${Math.min(redWidth, maxWidth)}%`;
  }

  function canSpin(){
    return !spinning && Number.isFinite(bet) && bet > 0 && bet <= balance;
  }

  function updateDisplay(){
    if(!Number.isFinite(balance)) balance = 0;
    if(!Number.isFinite(bet)) bet = 1;

    balanceEl.textContent = formatMoney(balance);
    betValueEl.textContent = formatMoney(bet);
    betDisplayEl.value = Number.isInteger(bet) ? bet.toFixed(0) : bet.toFixed(2);

    renderPayoutCards();
    totalWinEl.textContent = `Saque: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Oferenda Total: ${formatMoney(totalBetAccum)}`;
    updateBalanceScale();
    updatePersonaAdvice();

    spinBtn.disabled = !canSpin();
    decBetBtn.disabled = bet <= 0.1 || spinning;
    incBetBtn.disabled = bet >= balance || spinning;
  }

  // ------------------- PERSONA (MIMIR / KRATOS) -------------------
  function personaAdviceString(){
    let recommended = Math.min(balance * 0.1, 5);
    recommended = Math.max(recommended, 0.5);
    recommended = parseFloat(recommended.toFixed(2));

    // Frases do Mimir/Kratos
    const phrases = [
      `Mimir: "Irmão, concentre-se. Tente R$${recommended}."`,
      `Kratos: "Não aposte o que não pode perder, garoto. R$${recommended}."`,
      `Mimir: "As Nornas sussurram sorte com R$${recommended}."`,
      `Kratos: "Mantenha a guarda alta. Use R$${recommended}."`
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  function calculateTreasureChance(forBet){
    let chance = 0;
    CLS_LIST.forEach(cls => {
      const weight = WEIGHT_BY_CLS[cls] || 0;
      const probSymbol = weight / weightedSymbols.length;
      const prob3 = probSymbol ** 3;
      const mult = PAYOUT_BY_CLS[cls]?.mult3 || 1;
      if(forBet * mult > 0) chance += prob3;
    });
    return Math.min(Math.max(chance * 100,0),100).toFixed(1);
  }

  function updateRTPDisplay(){
    if(!rtpEl) return;
    const personaBetMatch = personaAdviceString().match(/R\$(\d+(\.\d+)?)/);
    const personaBet = personaBetMatch ? parseFloat(personaBetMatch[1]) : 0.5;
    const chance = calculateTreasureChance(personaBet);
    rtpEl.textContent = `Visão das Nornas (Chance): ${chance}%`;
  }

  function updatePersonaAdvice(){
    if(!personaAdviceEl){
      const meta = document.querySelector('.meta-card');
      if(meta){
        personaAdviceEl = document.createElement('div');
        personaAdviceEl.id = 'personaAdvice';
        personaAdviceEl.style.color = '#c0a062'; // Ouro
        personaAdviceEl.style.fontWeight = 'bold';
        personaAdviceEl.style.fontSize = '0.9rem';
        personaAdviceEl.style.fontStyle = 'italic';
        personaAdviceEl.style.marginTop = '6px';
        meta.insertBefore(personaAdviceEl, meta.firstChild);
      }
    }
    if(personaAdviceEl) {
      personaAdviceEl.textContent = personaAdviceString();
      updateRTPDisplay();
    }
  }

  // ------------------- POPUP VITÓRIA -------------------
  function showCentralWin(amount){
    const phrases = [
      `PELO FANTASMA DE SPARTA!<br><br>💰 ${formatMoney(amount)}`,
      `RAGNARÖK CHEGOU!<br><br>💰 ${formatMoney(amount)}`,
      `UM BOM SAQUE, GAROTO!<br><br>💰 ${formatMoney(amount)}`,
      `A FÚRIA DOS DEUSES!<br><br>💰 ${formatMoney(amount)}`
    ];

    const popup = document.createElement('div');
    popup.className = 'win-popup';
    popup.innerHTML = phrases[Math.floor(Math.random()*phrases.length)];
    document.body.appendChild(popup);

    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%,-50%) scale(0.8)';
    
    requestAnimationFrame(()=> {
      popup.style.transition = 'all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      popup.style.opacity = '1';
      popup.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    setTimeout(()=>{
      popup.style.opacity = '0';
      popup.style.transform = 'translate(-50%,-50%) scale(0.8)';
      setTimeout(()=> popup.remove(), 350);
    }, 2500);
  }

  let activeWinLines = [];
  let winLineAnimationId = null;

  function clearWinLines() {
    const canvas = document.getElementById("hlCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    activeWinLines = [];
    if (winLineAnimationId) cancelAnimationFrame(winLineAnimationId);
    winLineAnimationId = null;
  }

  // ------------------- CORE LOGIC (3 REELS) -------------------
  function computeWin(results, highlight = true) {
    let win = 0;
    const linesWon = [];
    const matchedPositions = [];
    const rows = results[0].length;
    const cols = results.length; // Agora é 3

    // 1. Horizontais
    for (let row = 0; row < rows; row++) {
      const first = results[0][row];
      const matchedPayout = PAYOUT_BY_CLS[first] || null;
      if (!matchedPayout) continue;

      let count = 1;
      for (let col = 1; col < cols; col++) {
        if (results[col][row] === first) count++;
        else break;
      }
      
      // Só ganhamos se count == 3 (pois só tem 3 rolos)
      if (count >= 3) {
        const mult = matchedPayout.mult3; 
        win += bet * mult;
        linesWon.push({ row, count, symbol: first, mult });
        
        const pos = [];
        for (let c = 0; c < count; c++) pos.push({ col: c, row });
        matchedPositions.push(pos);
      }
    }

    // 2. Diagonais (3x3)
    const diagonalPatterns = [
      [{col:0, row:0}, {col:1, row:1}, {col:2, row:2}], // ↘
      [{col:0, row:2}, {col:1, row:1}, {col:2, row:0}]  // ↗
    ];

    diagonalPatterns.forEach(pattern => {
      const first = results[pattern[0].col][pattern[0].row];
      const payout = PAYOUT_BY_CLS[first];
      if (!payout) return;

      let ok = true;
      for (const p of pattern) {
        if (!results[p.col] || results[p.col][p.row] !== first) {
          ok = false;
          break;
        }
      }
      if (ok) {
        win += bet * payout.mult3;
        matchedPositions.push(pattern);
      }
    });

    if (win > 0) {
      balance += win;
      totalWinAccum += win;
      const container = document.querySelector(".machine");
      if (container) {
        container.style.animation = 'none';
        container.offsetHeight; /* trigger reflow */
        container.style.animation = 'godPulse 0.2s 2 alternate';
      }
      if(navigator.vibrate) navigator.vibrate([100,50,100]);
    }

    if (highlight && win > 0) showCentralWin(win);

    // Escurece não ganhadores
    reelCells.forEach(cells => {
      cells.forEach(c => (c.style.opacity = "0.3"));
    });

    // Animação de linha (Canvas)
    if (matchedPositions.length) {
      activeWinLines.push(...matchedPositions);
      startWinLineAnimation();
    }

    // Ilumina ganhadores
    if(matchedPositions.length > 0){
        matchedPositions.forEach(line => {
            line.forEach(pos => {
                const c = reelCells[pos.col][pos.row];
                c.style.opacity = "1";
                const cls = CLS_LIST.find(k => c.classList.contains(k));
                c.style.color = COLORS_BY_CLS[cls];
                c.classList.add('win-anim');
            });
        });
    }

    setTimeout(() => {
      reelCells.forEach(cells => {
        cells.forEach(c => {
            c.style.opacity = "1";
            c.classList.remove('win-anim');
            // Restaura cor original
            const cls = CLS_LIST.find(k => c.classList.contains(k));
            if(cls) c.style.color = COLORS_BY_CLS[cls];
        });
      });
    }, 2500);

    if (lastResultEl && win > 0) {
      lastResultEl.textContent = `Última Conquista: ${formatMoney(win)}`;
    }
    
    updateDisplay();
    return { win, matchedPositions };
  }

  // Canvas Drawing (Raios/Energia ao invés de linha simples)
  function startWinLineAnimation() {
    const canvas = document.getElementById("hlCanvas");
    if (!canvas || activeWinLines.length === 0) return;
    const ctx = canvas.getContext("2d");
    const reelsEl = document.getElementById("reels");
    const rect = reelsEl.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    if (winLineAnimationId) cancelAnimationFrame(winLineAnimationId);
    let t = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      activeWinLines.forEach((line) => {
        if (!line.length) return;
        
        const points = line.map(p => {
          const cell = reelCells[p.col][p.row];
          if (!cell) return null;
          const r = cell.getBoundingClientRect();
          return { x: r.left - rect.left + r.width/2, y: r.top - rect.top + r.height/2 };
        }).filter(Boolean);

        if (points.length < 2) return;

        // Efeito de Raio/Energia
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#c0392b"; // Brilho vermelho
        ctx.strokeStyle = "#fff"; 
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i=1;i<points.length;i++) {
            // Pequena variação aleatória para parecer eletricidade/fúria
            const midX = (points[i-1].x + points[i].x)/2 + (Math.random()*10 - 5);
            const midY = (points[i-1].y + points[i].y)/2 + (Math.random()*10 - 5);
            ctx.quadraticCurveTo(midX, midY, points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      t++;
      if(t < 120) winLineAnimationId = requestAnimationFrame(draw); // Para após 2s
      else clearWinLines();
    }
    draw();
  }

  // ------------------- SPIN ANIMATION -------------------
  function spinReels(results) {
    spinning = true;
    const baseDuration = 2000;
    const now = performance.now();

    reelsEls.forEach((reelEl, colIdx) => {
      const cells = reelCells[colIdx];
      const startTime = now + colIdx * 400; // Delay cascata
      let lastUpdate = startTime;

      function frame(t) {
        if (t < startTime) {
          requestAnimationFrame(frame);
          return;
        }
        const elapsed = t - startTime;
        
        // Simples troca de símbolos rápida
        if (t - lastUpdate >= 50 && elapsed < baseDuration) {
           const tempSet = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
           cells.forEach((c, i) => {
             c.className = 'fa-solid ' + tempSet[i];
             c.style.color = '#555'; // Cor neutra girando
           });
           lastUpdate = t;
           reelEl.style.transform = `translateY(${Math.random()*4}px)`; // Shake
        }

        if (elapsed < baseDuration) {
          requestAnimationFrame(frame);
        } else {
          // Parar
          reelEl.style.transform = 'translateY(0)';
          cells.forEach((c, i) => {
            const finalCls = results[colIdx][i];
            c.className = 'fa-solid ' + finalCls;
            c.style.color = COLORS_BY_CLS[finalCls];
          });
          
          // Efeito de impacto "Thud"
          reelEl.animate([
            { transform: 'translateY(-20px)' },
            { transform: 'translateY(0)' }
          ], { duration: 200, easing: 'ease-out' });

          if (colIdx === reelsEls.length - 1) {
            const resultObj = computeWin(results, true);
            spinning = false;
            updateDisplay();
          }
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // ------------------- INPUT HANDLERS -------------------
  decBetBtn.addEventListener('click', () => {
    bet = parseFloat(Math.max(0.1, (bet - 0.1)).toFixed(2));
    if(bet > balance) bet = balance;
    updateDisplay();
  });
  incBetBtn.addEventListener('click', () => {
    bet = parseFloat(Math.min(balance, (bet + 0.1)).toFixed(2));
    updateDisplay();
  });
  
  betDisplayEl.addEventListener('change', () => {
    let v = parseFloat(betDisplayEl.value);
    if (!Number.isFinite(v) || v < 0.1) v = 1;
    if (v > balance) v = balance;
    bet = v;
    updateDisplay();
  });
  
  spinBtn.addEventListener('click', () => {
    if (!canSpin()) return;
    startAudioContext();
    balance -= bet;
    totalBetAccum += bet;
    updateDisplay();

    const results = [];
    for (let col = 0; col < 3; col++) {
      results[col] = [];
      for (let row = 0; row < 3; row++) {
        results[col][row] = getRandomSymbol();
      }
    }
    clearWinLines();
    spinReels(results);
  });

  // Init
  renderPayoutCards();
  updateDisplay();
});
