/**
 * Analysis Engine for Midnight Money Coach
 * Pure functions - no side effects, easy to test.
 *
 * All amounts are in Indian Rupees (₹).
 * Reference benchmarks are tuned for Indian urban/semi-urban earners.
 */

'use strict';

/**
 * Healthy spending ratios as a fraction of monthly income.
 * Source: blended of 50/30/20 rule + Indian urban cost-of-living norms.
 * If a user's category share exceeds these, we flag overspending.
 */
const HEALTHY_RATIOS = {
  rent:          0.30, // shelter
  food:          0.15, // groceries + eating out
  travel:        0.10, // transport / commute / fuel
  utilities:     0.08, // electricity, water, internet, mobile
  entertainment: 0.07, // OTT, movies, going out
  shopping:      0.07, // clothes, gadgets, lifestyle
  emi:           0.20, // EMIs / loans (RBI suggested cap ~40% combined, we flag >20% per category)
  other:         0.10,
};

/**
 * Human-readable labels and emoji for each category.
 */
const CATEGORY_META = {
  rent:          { label: 'Rent & Housing',   icon: '🏠' },
  food:          { label: 'Food & Groceries', icon: '🍔' },
  travel:        { label: 'Travel & Commute', icon: '🚇' },
  utilities:     { label: 'Bills & Utilities',icon: '💡' },
  entertainment: { label: 'Entertainment',    icon: '🎬' },
  shopping:      { label: 'Shopping',         icon: '🛍️' },
  emi:           { label: 'EMIs & Loans',     icon: '💳' },
  other:         { label: 'Other',            icon: '📦' },
};

const VALID_CATEGORIES = Object.keys(HEALTHY_RATIOS);

/**
 * Validate and normalise raw user input.
 * Returns { ok: true, data } or { ok: false, error }.
 */
function validateInput(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid payload.' };
  }

  const income = Number(payload.income);
  if (!Number.isFinite(income) || income <= 0 || income > 1e9) {
    return { ok: false, error: 'Income must be a positive number under 1,000,000,000.' };
  }

  const rawExpenses = payload.expenses || {};
  if (typeof rawExpenses !== 'object') {
    return { ok: false, error: 'Expenses must be an object.' };
  }

  const expenses = {};
  for (const key of VALID_CATEGORIES) {
    const v = Number(rawExpenses[key] ?? 0);
    if (!Number.isFinite(v) || v < 0 || v > 1e9) {
      return { ok: false, error: `Invalid amount for category "${key}".` };
    }
    expenses[key] = Math.round(v);
  }

  return { ok: true, data: { income: Math.round(income), expenses } };
}

/**
 * Run the full analysis on validated input.
 * Returns a structured object with free and premium insights separated.
 */
function analyze({ income, expenses }) {
  const breakdown = VALID_CATEGORIES.map((key) => {
    const amount = expenses[key] || 0;
    const ratio = income > 0 ? amount / income : 0;
    const healthy = HEALTHY_RATIOS[key];
    const overspent = ratio > healthy && amount > 0;
    const overspentBy = overspent ? Math.round(amount - healthy * income) : 0;
    return {
      key,
      label: CATEGORY_META[key].label,
      icon: CATEGORY_META[key].icon,
      amount,
      ratio: Math.round(ratio * 10000) / 100, // percentage with 2 decimals
      healthyRatio: Math.round(healthy * 100),
      overspent,
      overspentBy,
    };
  });

  const totalExpenses = breakdown.reduce((sum, c) => sum + c.amount, 0);
  const savings = income - totalExpenses;
  const savingsRate = income > 0 ? savings / income : 0;
  const expenseRate = income > 0 ? totalExpenses / income : 0;

  // Health score: 0-100. Combines savings rate, overspend count, and balance.
  const overspendCount = breakdown.filter((c) => c.overspent).length;
  let healthScore = 50;
  if (savingsRate >= 0.30) healthScore += 30;
  else if (savingsRate >= 0.20) healthScore += 20;
  else if (savingsRate >= 0.10) healthScore += 10;
  else if (savingsRate < 0) healthScore -= 30;
  else if (savingsRate < 0.05) healthScore -= 10;
  healthScore -= overspendCount * 5;
  healthScore = Math.max(0, Math.min(100, healthScore));

  let healthGrade;
  if (healthScore >= 85) healthGrade = 'Elite';
  else if (healthScore >= 70) healthGrade = 'Strong';
  else if (healthScore >= 50) healthGrade = 'Okay';
  else if (healthScore >= 30) healthGrade = 'Risky';
  else healthGrade = 'Critical';

  // ---------- FREE INSIGHTS ----------
  const freeInsights = buildFreeInsights({
    income,
    totalExpenses,
    savings,
    savingsRate,
    breakdown,
  });

  // ---------- PREMIUM INSIGHTS ----------
  const premiumInsights = buildPremiumInsights({
    income,
    totalExpenses,
    savings,
    savingsRate,
    breakdown,
  });

  return {
    summary: {
      income,
      totalExpenses,
      savings,
      savingsRate: Math.round(savingsRate * 10000) / 100,
      expenseRate: Math.round(expenseRate * 10000) / 100,
      healthScore,
      healthGrade,
      overspendCount,
    },
    breakdown,
    freeInsights,
    premiumInsights,
  };
}

function buildFreeInsights({ income, totalExpenses, savings, savingsRate, breakdown }) {
  const tips = [];

  if (savings < 0) {
    tips.push({
      tone: 'danger',
      title: 'You are spending more than you earn',
      body: `You are over budget by ₹${Math.abs(savings).toLocaleString('en-IN')} this month. The number one priority is to cut your biggest expense category before debt starts piling up.`,
    });
  } else if (savingsRate < 0.10) {
    tips.push({
      tone: 'warn',
      title: 'Your savings cushion is thin',
      body: `You are saving only ${(savingsRate * 100).toFixed(1)}% of your income. Aim for at least 20% — that's the difference between living paycheck-to-paycheck and building real wealth.`,
    });
  } else if (savingsRate >= 0.20) {
    tips.push({
      tone: 'good',
      title: 'You are saving like a pro',
      body: `Saving ${(savingsRate * 100).toFixed(1)}% of your income puts you ahead of most Indians your age. Next step: make sure that money is invested, not just sitting in a savings account losing to inflation.`,
    });
  } else {
    tips.push({
      tone: 'neutral',
      title: 'You are on the right track',
      body: `Saving ${(savingsRate * 100).toFixed(1)}% is decent. A small push to 20%+ unlocks serious long-term growth thanks to compounding.`,
    });
  }

  // Top overspent category
  const overspent = breakdown.filter((c) => c.overspent).sort((a, b) => b.overspentBy - a.overspentBy);
  if (overspent.length > 0) {
    const worst = overspent[0];
    tips.push({
      tone: 'warn',
      title: `${worst.label} is eating your budget`,
      body: `You are spending ${worst.ratio}% of your income on ${worst.label.toLowerCase()} — the healthy range is around ${worst.healthyRatio}%. That's ₹${worst.overspentBy.toLocaleString('en-IN')} more than you should each month.`,
    });
  }

  // Largest category insight
  const sorted = [...breakdown].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  if (sorted.length > 0) {
    const top = sorted[0];
    tips.push({
      tone: 'neutral',
      title: `${top.label} is your biggest spend`,
      body: `₹${top.amount.toLocaleString('en-IN')} every month goes to ${top.label.toLowerCase()}. Even a 10% trim here would save you ₹${Math.round(top.amount * 0.1 * 12).toLocaleString('en-IN')} a year.`,
    });
  }

  return tips.slice(0, 3); // free tier: max 3 tips
}

function buildPremiumInsights({ income, totalExpenses, savings, savingsRate, breakdown }) {
  // 1. Optimization Plan: per-category target spend + projected annual savings
  const optimizationPlan = breakdown
    .filter((c) => c.amount > 0)
    .map((c) => {
      const healthyAmount = Math.round(HEALTHY_RATIOS[c.key] * income);
      const recommendedAmount = c.overspent
        ? Math.round((c.amount + healthyAmount) / 2) // ease into it
        : c.amount;
      const monthlySaving = c.amount - recommendedAmount;
      const annualSaving = monthlySaving * 12;
      return {
        category: c.label,
        icon: c.icon,
        currentAmount: c.amount,
        recommendedAmount,
        monthlySaving,
        annualSaving,
        actionable: monthlySaving > 0
          ? `Reduce ${c.label.toLowerCase()} spending by ₹${monthlySaving.toLocaleString('en-IN')} → save ₹${annualSaving.toLocaleString('en-IN')}/year`
          : `Your ${c.label.toLowerCase()} spending is healthy. Maintain it.`,
      };
    })
    .sort((a, b) => b.monthlySaving - a.monthlySaving);

  const totalPotentialMonthly = optimizationPlan.reduce((s, p) => s + Math.max(0, p.monthlySaving), 0);
  const totalPotentialAnnual = totalPotentialMonthly * 12;

  // 2. Detailed savings plan: emergency fund, investing split, milestones
  const targetMonthlySavings = Math.max(0, Math.round(income * 0.20));
  const emergencyFundTarget = totalExpenses * 6;
  const monthsToEmergencyFund = targetMonthlySavings > 0
    ? Math.ceil(emergencyFundTarget / targetMonthlySavings)
    : null;

  const savingsPlan = {
    targetSavingsRate: 20,
    targetMonthlySavings,
    currentMonthlySavings: Math.max(0, savings),
    emergencyFundTarget: Math.round(emergencyFundTarget),
    monthsToEmergencyFund,
    investmentSplit: [
      {
        bucket: 'Emergency Fund (Liquid)',
        percentage: 30,
        amount: Math.round(targetMonthlySavings * 0.30),
        vehicle: 'High-yield savings or liquid mutual fund',
      },
      {
        bucket: 'Long-Term Wealth (Equity)',
        percentage: 50,
        amount: Math.round(targetMonthlySavings * 0.50),
        vehicle: 'Index funds (Nifty 50/Nifty Next 50) via SIP',
      },
      {
        bucket: 'Stable Income (Debt)',
        percentage: 15,
        amount: Math.round(targetMonthlySavings * 0.15),
        vehicle: 'PPF, EPF top-up, or short-term debt funds',
      },
      {
        bucket: 'Fun & Experiments',
        percentage: 5,
        amount: Math.round(targetMonthlySavings * 0.05),
        vehicle: 'Stocks, crypto, or learning a skill',
      },
    ],
  };

  // 3. Actionable monthly tips - context aware
  const actionTips = [];

  if (savings < 0) {
    actionTips.push('Pause every non-essential subscription this week (OTT, gym, premium apps) — you can resubscribe one at a time once you are positive.');
  }

  const food = breakdown.find((c) => c.key === 'food');
  if (food && food.overspent) {
    actionTips.push(`Switch 8 food-delivery orders to home cooking this month. At an average ₹350 saved per meal, that is ₹${(8 * 350).toLocaleString('en-IN')} back in your pocket.`);
  }

  const entertainment = breakdown.find((c) => c.key === 'entertainment');
  if (entertainment && entertainment.overspent) {
    actionTips.push('Audit your OTT subscriptions. Most people pay for 4+ services and actively watch 1–2. Cancel the rest and save ₹400–800/month.');
  }

  const shopping = breakdown.find((c) => c.key === 'shopping');
  if (shopping && shopping.overspent) {
    actionTips.push('Use a 48-hour rule for any online purchase over ₹2,000. Add to cart, wait 2 days — most impulse buys die in the cart.');
  }

  const travel = breakdown.find((c) => c.key === 'travel');
  if (travel && travel.overspent) {
    actionTips.push('Try mixing metro/bus for 2 days a week instead of cabs. Even ₹200/day saved becomes ₹4,800/month.');
  }

  const emi = breakdown.find((c) => c.key === 'emi');
  if (emi && emi.overspent) {
    actionTips.push('Your EMI load is high. List every loan with its interest rate and aggressively prepay the highest-rate one first (avalanche method).');
  }

  // Always-on universal tips to ensure a rich premium experience
  actionTips.push('Automate your investments: set up a SIP that auto-debits on the 2nd of every month, right after salary. You cannot spend what you cannot see.');
  actionTips.push('Open a separate "no-touch" savings account — different bank from your salary account — for your emergency fund. Friction is your friend.');
  actionTips.push('Increase your SIP by 10% every time you get a salary hike. Future-you will fund itself without lifestyle inflation.');

  // 4. Yearly projection - what changes if user follows the plan
  const projectedAnnualSavings = (Math.max(0, savings) + totalPotentialMonthly) * 12;
  const tenYearAt12pct = projectFutureValue(Math.max(0, savings) + totalPotentialMonthly, 12, 10);

  return {
    optimizationPlan,
    totals: {
      potentialMonthlySavings: totalPotentialMonthly,
      potentialAnnualSavings: totalPotentialAnnual,
      projectedAnnualSavingsIfFollowed: projectedAnnualSavings,
      tenYearWealthAt12pct: tenYearAt12pct,
    },
    savingsPlan,
    actionTips: actionTips.slice(0, 8),
  };
}

/**
 * Future value of a monthly SIP.
 * P = monthly contribution, r = annual return %, t = years
 */
function projectFutureValue(monthlyAmount, annualRatePct, years) {
  if (monthlyAmount <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const fv = monthlyAmount * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  return Math.round(fv);
}

module.exports = {
  validateInput,
  analyze,
  HEALTHY_RATIOS,
  CATEGORY_META,
  VALID_CATEGORIES,
};
