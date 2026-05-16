/**
 * Midnight Money Coach — frontend logic
 * Pure vanilla JS, no frameworks.
 */
(function () {
  'use strict';

  // ---------- State ----------
  const state = {
    income: 0,
    expenses: {},
    analysis: null,    // last free analysis from server
    unlocked: false,   // true after server-verified payment
    fullReport: null,  // analysis+premium after unlock
  };

  // ---------- DOM helpers ----------
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const fmtINR = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
  const fmtINRsigned = (n) => (n < 0 ? '-' : '') + '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');

  // ---------- Demo data ----------
  const DEMO = {
    income: 30000,
    expenses: {
      rent:          8000,
      food:          6500,
      travel:        2500,
      utilities:     1800,
      entertainment: 2200,
      shopping:      3000,
      emi:           4500,
      other:         1000,
    },
  };

  // ---------- Form handling ----------
  const form = $('#budget-form');

  function readForm() {
    const fd = new FormData(form);
    const income = Number(fd.get('income') || 0);
    const expenses = {};
    ['rent','food','travel','utilities','entertainment','shopping','emi','other'].forEach((k) => {
      expenses[k] = Number(fd.get(k) || 0);
    });
    return { income, expenses };
  }

  function writeForm({ income, expenses }) {
    form.income.value = income || '';
    Object.entries(expenses || {}).forEach(([k, v]) => {
      if (form[k]) form[k].value = v || '';
    });
  }

  function clearForm() {
    form.reset();
    $('#form-error').classList.add('hidden');
    $('#results').classList.add('hidden');
    state.unlocked = false;
    state.analysis = null;
    state.fullReport = null;
    resetPremiumUI();
  }

  function fillDemo() {
    writeForm(DEMO);
    window.scrollTo({ top: $('#input').offsetTop - 20, behavior: 'smooth' });
    // Slight delay so user sees the values populate first
    setTimeout(() => submitAnalyze(), 400);
  }

  $('#demo-btn').addEventListener('click', fillDemo);
  $('#demo-btn-2').addEventListener('click', fillDemo);
  $('#reset-btn').addEventListener('click', clearForm);
  $('#edit-btn').addEventListener('click', () => {
    $('#results').classList.add('hidden');
    window.scrollTo({ top: $('#input').offsetTop - 20, behavior: 'smooth' });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitAnalyze();
  });

  // ---------- API ----------
  async function submitAnalyze() {
    const errBox = $('#form-error');
    errBox.classList.add('hidden');

    const { income, expenses } = readForm();
    if (!income || income <= 0) {
      errBox.textContent = 'Please enter your monthly income to continue.';
      errBox.classList.remove('hidden');
      return;
    }

    const totalExp = Object.values(expenses).reduce((s, v) => s + v, 0);
    if (totalExp === 0) {
      errBox.textContent = 'Add at least one expense so we have something to analyze.';
      errBox.classList.remove('hidden');
      return;
    }

    const btn = $('#analyze-btn');
    btn.disabled = true;
    btn.innerHTML = '<span>Analyzing...</span>';

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income, expenses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      state.income = income;
      state.expenses = expenses;
      state.analysis = data;
      state.unlocked = false;
      state.fullReport = null;

      renderResults(data);
      resetPremiumUI();
      $('#results').classList.remove('hidden');
      window.scrollTo({ top: $('#results').offsetTop - 20, behavior: 'smooth' });
    } catch (err) {
      errBox.textContent = err.message || 'Something went wrong. Please try again.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Analyze my money</span><span>→</span>';
    }
  }

  // ---------- Rendering ----------
  function renderResults(data) {
    const { summary, breakdown, freeInsights } = data;
    renderKPIs(summary);
    renderHealth(summary);
    renderDonut(summary, breakdown);
    renderBreakdown(breakdown);
    renderFreeInsights(freeInsights);
  }

  function renderKPIs(s) {
    const savingsClass = s.savings < 0 ? 'text-danger' : 'text-gradient';
    const savingsLabel = s.savings < 0 ? 'IN THE RED' : 'SAVED';
    const kpis = [
      { label: 'Income',         value: fmtINR(s.income),         hint: 'monthly take-home',         klass: '' },
      { label: 'Total spent',    value: fmtINR(s.totalExpenses),  hint: `${s.expenseRate}% of income`, klass: '' },
      { label: savingsLabel,     value: fmtINRsigned(s.savings),  hint: `${s.savingsRate}% savings rate`, klass: savingsClass },
      { label: 'Red flags',      value: String(s.overspendCount), hint: 'overspent categories',      klass: s.overspendCount > 0 ? 'text-warn' : 'text-good' },
    ];
    $('#kpi-row').innerHTML = kpis.map((k) => `
      <div class="card p-5">
        <div class="text-[10px] text-mute font-mono tracking-widest uppercase mb-2">${k.label}</div>
        <div class="num-large text-3xl sm:text-4xl ${k.klass}">${k.value}</div>
        <div class="text-xs text-mute mt-1">${k.hint}</div>
      </div>
    `).join('');
  }

  function renderHealth(s) {
    $('#health-score').textContent = s.healthScore;
    $('#health-grade').textContent = s.healthGrade;

    const bar = $('#health-bar');
    bar.classList.remove('danger','warn','good');
    if (s.healthScore < 30) bar.classList.add('danger');
    else if (s.healthScore < 60) bar.classList.add('warn');
    else if (s.healthScore >= 80) bar.classList.add('good');
    requestAnimationFrame(() => { bar.style.width = s.healthScore + '%'; });

    const messages = {
      Elite:    'Top tier. You are operating like a CFO. Now make sure your money is invested, not just stockpiled.',
      Strong:   'Solid foundation. A small tune-up on overspending categories and you are unstoppable.',
      Okay:     'You are surviving but not building wealth yet. The premium plan shows exactly how to close that gap.',
      Risky:    'Warning signs. Your savings rate is too thin for emergencies. Time to plug the leaks.',
      Critical: 'Red alert. You are spending more than you make. Premium plan would give you a recovery roadmap.',
    };
    $('#health-msg').textContent = messages[s.healthGrade] || '';
  }

  function renderDonut(summary, breakdown) {
    const total = summary.income; // donut covers full income (expenses + savings)
    const radius = 50;
    const circumference = 2 * Math.PI * radius;

    // Color palette for segments
    const palette = ['#a78bfa','#22d3ee','#f472b6','#fbbf24','#34d399','#60a5fa','#f87171','#c084fc'];
    const items = breakdown.filter((c) => c.amount > 0).map((c, i) => ({
      ...c,
      color: palette[i % palette.length],
    }));

    const savings = Math.max(0, summary.savings);
    if (savings > 0) {
      items.push({
        key: '_savings', label: 'Savings', icon: '🌱',
        amount: savings, ratio: summary.savingsRate, color: '#ffffff',
      });
    }

    let offset = 0;
    const seg = items.map((it) => {
      const frac = it.amount / total;
      const length = circumference * frac;
      const dashArray = `${length} ${circumference - length}`;
      const dashOffset = -offset;
      offset += length;
      return `<circle cx="60" cy="60" r="${radius}" class="donut-fill" stroke="${it.color}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}"></circle>`;
    }).join('');

    $('#donut-segments').innerHTML = seg;

    const savingsAmount = summary.savings;
    $('#donut-center').innerHTML = savingsAmount < 0
      ? `<span class="text-danger text-base">${fmtINRsigned(savingsAmount)}</span>`
      : fmtINR(savingsAmount);

    $('#donut-legend').innerHTML = items.map((it) => `
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-3 h-3 rounded-full shrink-0" style="background:${it.color}"></span>
        <span class="truncate">${it.icon || ''} ${it.label}</span>
        <span class="ml-auto text-mute font-mono text-xs">${(it.amount/total*100).toFixed(0)}%</span>
      </div>
    `).join('');
  }

  function renderBreakdown(breakdown) {
    const visible = breakdown.filter((c) => c.amount > 0);
    if (visible.length === 0) {
      $('#breakdown-list').innerHTML = '<div class="text-mute text-sm">No expenses entered.</div>';
      return;
    }
    const maxRatio = Math.max(...visible.map((c) => Math.max(c.ratio, c.healthyRatio)));

    $('#breakdown-list').innerHTML = visible.map((c) => {
      const yourPct = (c.ratio / maxRatio) * 100;
      const healthyPct = (c.healthyRatio / maxRatio) * 100;
      const fillClass = c.overspent ? 'danger' : 'good';
      return `
        <div>
          <div class="flex items-center justify-between mb-2 gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <span>${c.icon}</span>
              <span class="font-semibold truncate">${c.label}</span>
              ${c.overspent ? '<span class="pill pill-danger">over by ' + fmtINR(c.overspentBy) + '</span>' : ''}
            </div>
            <div class="font-mono text-sm text-mute shrink-0">
              <span class="text-white font-semibold">${fmtINR(c.amount)}</span>
              <span class="mx-1">·</span>
              <span>${c.ratio}%</span>
            </div>
          </div>
          <div class="relative">
            <div class="bar-bg">
              <div class="bar-fill ${fillClass}" style="width: ${yourPct}%"></div>
            </div>
            <!-- Healthy marker -->
            <div class="absolute top-1/2 -translate-y-1/2" style="left: ${healthyPct}%">
              <div class="w-0.5 h-4 bg-white/40 rounded-full" title="Healthy: ${c.healthyRatio}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFreeInsights(insights) {
    const toneMap = {
      danger:  { pill: 'pill-danger', emoji: '🚨' },
      warn:    { pill: 'pill-warn',   emoji: '⚠️' },
      good:    { pill: 'pill-good',   emoji: '🔥' },
      neutral: { pill: 'pill-neon',   emoji: '💡' },
    };
    $('#free-insights').innerHTML = insights.map((tip) => {
      const t = toneMap[tip.tone] || toneMap.neutral;
      return `
        <div class="card p-5">
          <div class="pill ${t.pill} mb-3"><span>${t.emoji}</span><span>${tip.tone.toUpperCase()}</span></div>
          <div class="font-display font-bold text-lg mb-2 leading-tight">${tip.title}</div>
          <div class="text-sm text-mute leading-relaxed">${tip.body}</div>
        </div>
      `;
    }).join('');
  }

  // ---------- Premium / Razorpay flow ----------
  function resetPremiumUI() {
    $('#premium-locked').classList.remove('hidden');
    $('#premium-unlocked').classList.add('hidden');
    $('#premium-unlocked').innerHTML = '';
  }

  async function unlockPremium() {
    if (!state.analysis) return;

    openModal({ emoji: '⏳', title: 'Setting up payment...', body: 'Creating a secure order. One sec.' });

    let order;
    try {
      const res = await fetch('/api/create-order', { method: 'POST' });
      order = await res.json();
      if (!res.ok) throw new Error(order.error || 'Could not create order');
    } catch (err) {
      openModal({
        emoji: '⚠️',
        title: 'Could not start payment',
        body: err.message || 'Please try again in a moment.',
        showClose: true,
      });
      return;
    }

    if (!order.razorpayKeyId || order.razorpayKeyId.includes('xxxxxx')) {
      openModal({
        emoji: '🔧',
        title: 'Payments not configured',
        body: 'The site admin has not added Razorpay keys yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.',
        showClose: true,
      });
      return;
    }

    closeModal();

    const options = {
      key: order.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Midnight Money Coach',
      description: 'Premium Insights — Full Report',
      order_id: order.orderId,
      theme: { color: '#a78bfa' },
      modal: {
        ondismiss: () => {
          openModal({
            emoji: '👋',
            title: 'Payment cancelled',
            body: 'No charge was made. You can try again anytime.',
            showClose: true,
          });
        },
      },
      handler: async function (response) {
        // Send to backend for MANDATORY verification
        openModal({ emoji: '🔍', title: 'Verifying payment...', body: 'Checking the signature with our server.' });
        try {
          const vres = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              income: state.income,
              expenses: state.expenses,
            }),
          });
          const vdata = await vres.json();
          if (!vres.ok || !vdata.verified) {
            throw new Error(vdata.error || 'Verification failed');
          }
          state.unlocked = true;
          state.fullReport = vdata;
          renderPremium(vdata);
          openModal({
            emoji: '✅',
            title: 'Payment verified!',
            body: 'Your full report is now unlocked below.',
            showClose: true,
          });
        } catch (err) {
          openModal({
            emoji: '⚠️',
            title: 'Verification failed',
            body: err.message + '. If you were charged, please contact support with payment ID ' + response.razorpay_payment_id,
            showClose: true,
          });
        }
      },
      prefill: {},
      notes: { product: 'Midnight Money Coach Premium' },
    };

    try {
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        openModal({
          emoji: '❌',
          title: 'Payment failed',
          body: (resp && resp.error && resp.error.description) || 'Please try a different payment method.',
          showClose: true,
        });
      });
      rzp.open();
    } catch (err) {
      openModal({ emoji: '⚠️', title: 'Cannot open checkout', body: err.message, showClose: true });
    }
  }

  function renderPremium(data) {
    const { premiumInsights } = data;
    const { optimizationPlan, totals, savingsPlan, actionTips } = premiumInsights;

    $('#premium-locked').classList.add('hidden');
    $('#premium-unlocked').classList.remove('hidden');

    const planRows = optimizationPlan.map((p) => {
      const goodColor = p.monthlySaving > 0 ? 'text-good' : 'text-mute';
      return `
        <div class="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-line last:border-0">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-xl">${p.icon}</span>
            <div class="min-w-0">
              <div class="font-semibold truncate">${p.category}</div>
              <div class="text-xs text-mute">Now: ${fmtINR(p.currentAmount)} → Target: ${fmtINR(p.recommendedAmount)}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="num-large text-lg ${goodColor}">${p.monthlySaving > 0 ? '+' : ''}${fmtINR(p.annualSaving)}</div>
            <div class="text-xs text-mute">${p.monthlySaving > 0 ? 'per year' : 'already healthy'}</div>
          </div>
        </div>
      `;
    }).join('');

    const sipRows = savingsPlan.investmentSplit.map((b) => `
      <div class="flex items-center justify-between gap-3 py-3 border-b border-line last:border-0">
        <div class="min-w-0">
          <div class="font-semibold">${b.bucket}</div>
          <div class="text-xs text-mute">${b.vehicle}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="num-large text-lg">${fmtINR(b.amount)}</div>
          <div class="text-xs text-mute">${b.percentage}% of savings</div>
        </div>
      </div>
    `).join('');

    const tipsList = actionTips.map((t, i) => `
      <div class="flex gap-3 p-4 rounded-2xl bg-white/[0.02] border border-line">
        <div class="num-large text-neon text-xl shrink-0">${String(i+1).padStart(2,'0')}</div>
        <div class="text-sm leading-relaxed">${t}</div>
      </div>
    `).join('');

    const monthsText = savingsPlan.monthsToEmergencyFund
      ? `${savingsPlan.monthsToEmergencyFund} months at your target savings rate`
      : 'Once you start saving regularly';

    $('#premium-unlocked').innerHTML = `
      <!-- Banner -->
      <div class="card p-6 sm:p-8 rise-in" style="background: linear-gradient(135deg, rgba(167,139,250,0.08), rgba(34,211,238,0.05));">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="pill pill-good mb-3"><span>✓</span><span>Premium unlocked</span></div>
            <div class="font-display font-bold text-3xl sm:text-4xl tracking-tight">Your full money playbook</div>
            <div class="text-mute mt-2">Built for your exact numbers. Save this page or screenshot it.</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-mute font-mono">POTENTIAL ANNUAL SAVINGS</div>
            <div class="num-large text-4xl sm:text-5xl text-gradient">${fmtINR(totals.potentialAnnualSavings)}</div>
          </div>
        </div>
      </div>

      <!-- Optimization plan -->
      <div class="card p-6 sm:p-8 rise-in" style="animation-delay: 0.1s">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <div class="text-xs text-mute font-mono tracking-wider">OPTIMIZATION PLAN</div>
            <div class="font-display font-bold text-2xl mt-1">Per-category targets</div>
          </div>
          <div class="pill pill-neon">Monthly recoverable: ${fmtINR(totals.potentialMonthlySavings)}</div>
        </div>
        <div class="mt-4">${planRows}</div>
      </div>

      <!-- Savings plan -->
      <div class="grid lg:grid-cols-5 gap-5">
        <div class="card p-6 sm:p-7 lg:col-span-2 rise-in" style="animation-delay: 0.15s">
          <div class="text-xs text-mute font-mono tracking-wider mb-1">EMERGENCY FUND</div>
          <div class="font-display font-bold text-2xl mb-4">${fmtINR(savingsPlan.emergencyFundTarget)}</div>
          <p class="text-sm text-mute leading-relaxed mb-4">6 months of expenses kept in a separate liquid account.</p>
          <div class="text-xs text-mute font-mono tracking-wider mb-1">TIME TO REACH IT</div>
          <div class="text-lg font-semibold mb-1">${monthsText}</div>
          <div class="text-xs text-mute">at ₹${savingsPlan.targetMonthlySavings.toLocaleString('en-IN')}/month</div>

          <div class="border-t border-line my-5"></div>

          <div class="text-xs text-mute font-mono tracking-wider mb-1">10-YEAR PROJECTION</div>
          <div class="num-large text-3xl text-gradient mb-1">${fmtINR(totals.tenYearWealthAt12pct)}</div>
          <div class="text-xs text-mute">If you save &amp; invest at 12% p.a. equity return</div>
        </div>

        <div class="card p-6 sm:p-7 lg:col-span-3 rise-in" style="animation-delay: 0.2s">
          <div class="text-xs text-mute font-mono tracking-wider">SIP SPLIT (per month)</div>
          <div class="font-display font-bold text-2xl mt-1 mb-4">Where to park ${fmtINR(savingsPlan.targetMonthlySavings)}</div>
          ${sipRows}
        </div>
      </div>

      <!-- Action tips -->
      <div class="card p-6 sm:p-8 rise-in" style="animation-delay: 0.25s">
        <div class="text-xs text-mute font-mono tracking-wider">DO THIS THIS WEEK</div>
        <div class="font-display font-bold text-2xl mt-1 mb-5">8 actions, in order of impact</div>
        <div class="grid sm:grid-cols-2 gap-3">${tipsList}</div>
      </div>
    `;

    // Scroll to unlocked content
    setTimeout(() => {
      $('#premium-unlocked').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
  }

  $('#unlock-btn').addEventListener('click', unlockPremium);

  // ---------- Modal ----------
  function openModal({ emoji, title, body, showClose }) {
    $('#status-emoji').textContent = emoji || '⏳';
    $('#status-title').textContent = title || '';
    $('#status-body').textContent = body || '';
    $('#status-close').classList.toggle('hidden', !showClose);
    $('#modal-backdrop').classList.add('open');
    $('#status-modal').classList.add('open');
  }
  function closeModal() {
    $('#modal-backdrop').classList.remove('open');
    $('#status-modal').classList.remove('open');
  }
  $('#status-close').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', closeModal);

})();
