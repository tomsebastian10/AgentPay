// AgentPay Client Application
let currentProposal = null;
let currentSpendToken = null;
let systemStatus = null;

// DOM Elements
const chatHistory = document.getElementById('chatHistory');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const emptyState = document.getElementById('emptyState');
const activeProposalCard = document.getElementById('activeProposalCard');
const comparisonContainer = document.getElementById('comparisonContainer');
const comparisonGrid = document.getElementById('comparisonGrid');
const proposalStatusBadge = document.getElementById('proposalStatusBadge');
const auditLogStream = document.getElementById('auditLogStream');
const logCountBadge = document.getElementById('logCountBadge');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const runBenchmarksBtn = document.getElementById('runBenchmarksBtn');
const benchmarkModal = document.getElementById('benchmarkModal');
const closeBenchmarkModalBtn = document.getElementById('closeBenchmarkModalBtn');
const authorizeAndPayBtn = document.getElementById('authorizeAndPayBtn');
const rejectPurchaseBtn = document.getElementById('rejectPurchaseBtn');
const triggerPriceSurgeDemoBtn = document.getElementById('triggerPriceSurgeDemoBtn');
const gatewayStatusBadge = document.getElementById('gatewayStatusBadge');

// 1. Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await fetchSystemStatus();
  await fetchAuditLogs();
  
  // Setup preset chips
  document.querySelectorAll('.preset-chip[data-query]').forEach(chip => {
    chip.addEventListener('click', () => {
      userInput.value = chip.getAttribute('data-query');
      chatForm.dispatchEvent(new Event('submit'));
    });
  });

  // Setup price surge simulation trigger
  if (triggerPriceSurgeDemoBtn) {
    triggerPriceSurgeDemoBtn.addEventListener('click', runPriceSurgeDemo);
  }

  // Setup forged signature simulation trigger
  const triggerForgedSigDemoBtn = document.getElementById('triggerForgedSigDemoBtn');
  if (triggerForgedSigDemoBtn) {
    triggerForgedSigDemoBtn.addEventListener('click', runForgedSigDemo);
  }

  // Refresh logs button
  refreshLogsBtn.addEventListener('click', fetchAuditLogs);

  // Benchmarks Modal
  runBenchmarksBtn.addEventListener('click', runBenchmarks);
  closeBenchmarkModalBtn.addEventListener('click', () => benchmarkModal.classList.add('hidden'));

  // Authorization actions
  authorizeAndPayBtn.addEventListener('click', handleAuthorizeAndPay);
  rejectPurchaseBtn.addEventListener('click', handleRejectPurchase);
});

// 2. Fetch System Status
async function fetchSystemStatus() {
  try {
    const res = await fetch('/api/system/status');
    systemStatus = await res.json();
    if (systemStatus?.gateway) {
      gatewayStatusBadge.textContent = `Gateway: ${systemStatus.gateway.mode.toUpperCase()} MODE`;
    }
  } catch (err) {
    console.error('Failed to fetch system status:', err);
  }
}

// 3. Handle Chat Form Submit
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = userInput.value.trim();
  if (!query) return;

  // Append User message to stream
  appendChatMessage(query, 'user');
  userInput.value = '';
  userInput.disabled = true;

  // Add loading message
  const loadingId = appendChatMessage('Reasoning over verified merchant catalogs & checking constraints...', 'system', true);

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query })
    });

    const data = await res.json();
    removeChatMessage(loadingId);

    if (data.isAdversarialBlocked) {
      appendChatMessage(`🚨 ${data.message}`, 'system', false, true);
      renderEmptyState('Security Directive Blocked Transaction');
      proposalStatusBadge.textContent = 'ADVERSARIAL BLOCKED';
      proposalStatusBadge.className = 'badge-status danger';
    } else if (!data.success) {
      appendChatMessage(`⚠️ ${data.message}`, 'system');
      renderEmptyState('No Matching Options In-Budget');
      proposalStatusBadge.textContent = 'NO MATCH';
      proposalStatusBadge.className = 'badge-status danger';
    } else {
      currentProposal = data.proposal;
      appendChatMessage(`Found optimal selection: <strong>${data.proposal.productTitle}</strong> for ₹${data.proposal.priceINR.toLocaleString('en-IN')}. Review proposal and grant spend authorization.`, 'system');
      renderProposal(data.proposal, data.comparisonCandidates);
      proposalStatusBadge.textContent = 'PROPOSAL READY';
      proposalStatusBadge.className = 'badge-status active';
    }

    await fetchAuditLogs();
  } catch (err) {
    removeChatMessage(loadingId);
    appendChatMessage(`Error processing request: ${err.message}`, 'system');
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
});

// 4. Render Active Proposal & Comparison Matrix
function renderProposal(proposal, candidates = []) {
  emptyState.classList.add('hidden');
  activeProposalCard.classList.remove('hidden');

  document.getElementById('propTitle').textContent = proposal.productTitle;
  document.getElementById('propMerchant').textContent = `Sold by ${proposal.merchantName} (Verified Merchant)`;
  document.getElementById('propPrice').textContent = `₹${proposal.priceINR.toLocaleString('en-IN')}`;
  document.getElementById('propPaise').textContent = `${proposal.pricePaise} paise`;
  document.getElementById('propReasoning').textContent = proposal.reasoning;

  // Set Score bars
  const b = proposal.scoreBreakdown || { featureScore: 100, ratingScore: 96, merchantTrustScore: 98, budgetScore: 94 };
  document.getElementById('featScoreBar').style.width = `${b.featureScore}%`;
  document.getElementById('featScoreVal').textContent = `${b.featureScore}%`;
  document.getElementById('ratingScoreBar').style.width = `${b.ratingScore}%`;
  document.getElementById('ratingScoreVal').textContent = `${b.ratingScore}%`;
  document.getElementById('trustScoreBar').style.width = `${b.merchantTrustScore}%`;
  document.getElementById('trustScoreVal').textContent = `${b.merchantTrustScore}%`;
  document.getElementById('budgetScoreBar').style.width = `${b.budgetScore}%`;
  document.getElementById('budgetScoreVal').textContent = `${b.budgetScore}%`;

  document.getElementById('invBudgetDetail').textContent = `₹${proposal.priceINR.toLocaleString('en-IN')} ≤ ₹${proposal.userBudgetINR.toLocaleString('en-IN')}`;

  // Reset Policy Invariant Visuals
  document.querySelectorAll('.inv-item').forEach(el => {
    el.className = 'inv-item pass';
    el.querySelector('.inv-icon').textContent = '✓';
  });

  // Render comparison matrix
  if (candidates && candidates.length > 0) {
    comparisonContainer.classList.remove('hidden');
    comparisonGrid.innerHTML = candidates.map(c => `
      <div class="candidate-card ${c.isSelected ? 'selected' : ''}">
        <div class="cand-title">${c.title}</div>
        <div class="cand-meta">
          <span>${c.merchantName}</span>
          <span class="cand-price">₹${c.priceINR.toLocaleString('en-IN')}</span>
        </div>
        <div class="cand-meta">
          <span>Rating: ${c.rating}★</span>
          <span style="font-family: var(--font-mono); font-size: 0.7rem;">Score: ${Math.round(c.totalScore * 100)}/100</span>
        </div>
      </div>
    `).join('');
  }
}

function renderEmptyState(reason) {
  activeProposalCard.classList.add('hidden');
  comparisonContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
  if (reason) {
    emptyState.querySelector('h3').textContent = reason;
  }
}

// 5. Spend Authorization & Payment Execution
async function handleAuthorizeAndPay() {
  if (!currentProposal) return;

  authorizeAndPayBtn.disabled = true;
  authorizeAndPayBtn.innerHTML = `<span>Validating Policy & Signing Token...</span>`;

  try {
    // Step 1: Issue AP2 SpendAuthorizationToken
    const authRes = await fetch('/api/agent/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId: currentProposal.intentId,
        productId: currentProposal.productId,
        merchantId: currentProposal.merchantId,
        priceINR: currentProposal.priceINR,
        pricePaise: currentProposal.pricePaise,
        maxBudgetINR: currentProposal.userBudgetINR
      })
    });

    const authData = await authRes.json();
    if (!authData.success) throw new Error(authData.error || 'Failed to issue spend token');
    currentSpendToken = authData.spendToken;

    appendChatMessage(`🔑 <strong>AP2 Spend Authorization Token Issued:</strong> Nonce: <code>${currentSpendToken.nonce.slice(0, 16)}...</code> | Cap: ₹${currentSpendToken.authorizedAmountINR}`, 'system');

    // Step 2: Execute Purchase through Policy Engine Gatekeeper
    const execRes = await fetch('/api/agent/execute-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spendToken: currentSpendToken,
        productId: currentProposal.productId,
        merchantId: currentProposal.merchantId,
        amountPaise: currentProposal.pricePaise
      })
    });

    const execData = await execRes.json();

    if (!execData.success) {
      // Policy Violation Blocked!
      const violations = execData.violations?.map(v => v.message).join('; ') || execData.error;
      appendChatMessage(`🚫 <strong>Deterministic Policy Blocked:</strong> ${violations}`, 'system', false, true);
      proposalStatusBadge.textContent = 'POLICY REJECTED';
      proposalStatusBadge.className = 'badge-status danger';
      await fetchAuditLogs();
      return;
    }

    appendChatMessage(`⚡ <strong>Policy Engine Approved!</strong> Razorpay Order Created: <code>${execData.orderId}</code>`, 'system');

    // Step 3: Complete Payment (Razorpay Checkout Modal or Test Simulation)
    if (window.Razorpay && systemStatus?.gateway?.isRealTestMode) {
      // Launch official Razorpay Checkout in browser
      const rzp = new window.Razorpay({
        key: execData.gatewayInfo?.keyId || 'rzp_test_placeholder',
        amount: execData.amountPaise,
        currency: execData.currency,
        name: currentProposal.merchantName,
        description: `AgentPay Authorized: ${currentProposal.productTitle}`,
        order_id: execData.orderId,
        handler: async function (response) {
          await verifyAndFinalizePayment({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            intentId: currentProposal.intentId
          });
        },
        theme: { color: '#6366f1' }
      });
      rzp.open();
    } else {
      // Automated Test / Mock Capture Simulation
      appendChatMessage(`💳 Simulating Razorpay Test Mode Payment Capture...`, 'system');
      const simRes = await fetch('/api/agent/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: execData.orderId,
          shouldFail: false,
          intentId: currentProposal.intentId
        })
      });
      const simData = await simRes.json();

      await verifyAndFinalizePayment({
        orderId: execData.orderId,
        paymentId: simData.id,
        signature: simData.razorpay_signature,
        intentId: currentProposal.intentId
      });
    }

  } catch (err) {
    appendChatMessage(`Purchase execution error: ${err.message}`, 'system');
  } finally {
    authorizeAndPayBtn.disabled = false;
    authorizeAndPayBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      Authorize & Pay (Razorpay)
    `;
    await fetchAuditLogs();
  }
}

// 6. Verify Payment Signature & Complete
async function verifyAndFinalizePayment({ orderId, paymentId, signature, intentId }) {
  const verifyRes = await fetch('/api/agent/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, paymentId, signature, intentId })
  });

  const verifyData = await verifyRes.json();

  if (verifyData.success) {
    appendChatMessage(`🎉 <strong>PAYMENT VERIFIED & SETTLED!</strong><br/>Payment ID: <code>${paymentId}</code><br/>Order ID: <code>${orderId}</code><br/>HMAC Signature: Validated ✓`, 'system');
    proposalStatusBadge.textContent = 'TRANSACTION COMPLETED';
    proposalStatusBadge.className = 'badge-status success';
  } else {
    appendChatMessage(`❌ <strong>Payment Verification Failed:</strong> ${verifyData.error}`, 'system', false, true);
    proposalStatusBadge.textContent = 'PAYMENT UNVERIFIED';
    proposalStatusBadge.className = 'badge-status danger';
  }

  await fetchAuditLogs();
}

// 7. Human Rejection
function handleRejectPurchase() {
  if (!currentProposal) return;
  appendChatMessage(`🛑 <strong>User rejected purchase proposal.</strong> No funds moved, authorization token discarded.`, 'user');
  proposalStatusBadge.textContent = 'USER REJECTED';
  proposalStatusBadge.className = 'badge-status danger';
  renderEmptyState('Transaction Aborted by User');
  currentProposal = null;
  currentSpendToken = null;
}

// 8. Price Surge Failure Scenario Demo
async function runPriceSurgeDemo() {
  userInput.value = 'Find me a wireless mechanical keyboard under ₹8,000';
  appendChatMessage('⚡ <em>DEMO: Initiating Price Surge Simulation...</em>', 'system');
  
  // Submit chat
  await chatForm.dispatchEvent(new Event('submit'));

  setTimeout(async () => {
    if (!currentProposal) return;
    
    // Simulate price surge in catalog
    await fetch('/api/commerce/price-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: currentProposal.productId, newPriceINR: 8999 })
    });

    appendChatMessage('📈 <strong>Merchant unexpectedly surges price to ₹8,999 before checkout!</strong> Attempting purchase to test Policy Drift Guard...', 'system');

    // Mark price drift invariant visually as failed
    const invPrice = document.getElementById('invPriceDrift');
    invPrice.className = 'inv-item fail';
    invPrice.querySelector('.inv-icon').textContent = '✗';

    // Click Authorize & Pay
    await handleAuthorizeAndPay();

    // Clear override after demo
    await fetch('/api/commerce/clear-price-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: currentProposal.productId })
    });
  }, 1000);
}

// 8b. Forged Signature Failure Scenario Demo
async function runForgedSigDemo() {
  userInput.value = 'Find me a wireless mechanical keyboard under ₹8,000';
  appendChatMessage('⚡ <em>DEMO: Initiating Forged Payment Signature Attack Simulation...</em>', 'system');
  
  // Submit chat
  await chatForm.dispatchEvent(new Event('submit'));

  setTimeout(async () => {
    if (!currentProposal) return;
    
    // Issue Spend Token
    const authRes = await fetch('/api/agent/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId: currentProposal.intentId,
        productId: currentProposal.productId,
        merchantId: currentProposal.merchantId,
        priceINR: currentProposal.priceINR,
        pricePaise: currentProposal.pricePaise,
        maxBudgetINR: currentProposal.userBudgetINR
      })
    });
    const authData = await authRes.json();
    
    // Execute purchase
    const execRes = await fetch('/api/agent/execute-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spendToken: authData.spendToken,
        productId: currentProposal.productId,
        merchantId: currentProposal.merchantId,
        amountPaise: currentProposal.pricePaise
      })
    });
    const execData = await execRes.json();
    
    if (execData.success) {
      appendChatMessage(`Order <code>${execData.orderId}</code> created. Submitting FORGED signature payload to payment verification gateway...`, 'system');
      
      const forgedSignature = 'forged_fake_signature_hash_00000000000000000000000000000000';
      await verifyAndFinalizePayment({
        orderId: execData.orderId,
        paymentId: 'pay_unauthorized_attacker',
        signature: forgedSignature,
        intentId: currentProposal.intentId
      });
    }
  }, 1000);
}

// 9. Fetch Audit Logs
async function fetchAuditLogs() {
  try {
    const res = await fetch('/api/audit/logs?limit=50');
    const data = await res.json();
    const logs = data.logs || [];
    logCountBadge.textContent = logs.length;

    auditLogStream.innerHTML = logs.map(l => `
      <div class="audit-event-card status-${l.status}">
        <div class="event-header-row">
          <span class="event-type-tag">${l.eventType}</span>
          <span class="event-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="event-details-preview">${JSON.stringify(l.details, null, 2)}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load audit logs:', err);
  }
}

// 10. Run Benchmarks Modal
async function runBenchmarks() {
  benchmarkModal.classList.remove('hidden');
  const listEl = document.getElementById('benchmarkScenariosList');
  listEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Running 10 synthetic commerce scenarios...</div>';

  try {
    const res = await fetch('/api/eval/run', { method: 'POST' });
    const data = await res.json();

    document.getElementById('benchPassRate').textContent = `${data.passRate}%`;
    document.getElementById('benchPassCount').textContent = `${data.passed} / ${data.total}`;
    document.getElementById('benchTotalTime').textContent = `${data.durationMs}ms`;

    listEl.innerHTML = data.results.map(r => `
      <div class="bench-item">
        <div>
          <strong>${r.name}</strong>
          <div style="font-size: 0.72rem; color: var(--text-dim);">${r.id} (${r.durationMs}ms)</div>
        </div>
        <span class="bench-badge ${r.status === 'PASSED' ? 'pass' : 'fail'}">${r.status}</span>
      </div>
    `).join('');

    await fetchAuditLogs();
  } catch (err) {
    listEl.innerHTML = `<div style="color: var(--danger); padding: 1rem;">Benchmark error: ${err.message}</div>`;
  }
}

// Helper: Chat Messages
function appendChatMessage(text, sender = 'system', isLoading = false, isAdversarial = false) {
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const div = document.createElement('div');
  div.id = msgId;
  div.className = `chat-msg ${sender}-msg ${isAdversarial ? 'adversarial-block' : ''}`;
  
  const avatar = sender === 'user' ? '👤' : '🤖';
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body">
      <p>${isLoading ? '<span class="loading-pulse">⏳ ' + text + '</span>' : text}</p>
    </div>
  `;

  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return msgId;
}

function removeChatMessage(msgId) {
  const el = document.getElementById(msgId);
  if (el) el.remove();
}
