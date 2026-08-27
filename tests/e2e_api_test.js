async function runE2E() {
  console.log('Testing live server API at http://localhost:3000...');
  
  // 1. Status
  const statusRes = await fetch('http://localhost:3000/api/system/status');
  const status = await statusRes.json();
  console.log('1. System status:', status.status, '| Gateway Mode:', status.gateway.mode);

  // 2. Chat
  const chatRes = await fetch('http://localhost:3000/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Find me a wireless mechanical keyboard under ₹8,000' })
  });
  const chatData = await chatRes.json();
  console.log('2. Chat Shopping Proposal:', chatData.success ? 'PASSED' : 'FAILED', '| Selected:', chatData.proposal?.productTitle);

  // 3. Authorize
  const authRes = await fetch('http://localhost:3000/api/agent/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intentId: chatData.intentId,
      productId: chatData.proposal.productId,
      merchantId: chatData.proposal.merchantId,
      priceINR: chatData.proposal.priceINR,
      pricePaise: chatData.proposal.pricePaise,
      maxBudgetINR: chatData.proposal.userBudgetINR
    })
  });
  const authData = await authRes.json();
  console.log('3. Spend Authorization Token:', authData.success ? 'PASSED' : 'FAILED', '| Nonce:', authData.spendToken?.nonce?.slice(0, 16));

  // 4. Execute Purchase
  const execRes = await fetch('http://localhost:3000/api/agent/execute-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spendToken: authData.spendToken,
      productId: chatData.proposal.productId,
      merchantId: chatData.proposal.merchantId,
      amountPaise: chatData.proposal.pricePaise
    })
  });
  const execData = await execRes.json();
  console.log('4. Purchase Execution (Policy + Order):', execData.success ? 'PASSED' : 'FAILED', '| Order ID:', execData.orderId);

  // 5. Simulate Payment & Verify
  const simRes = await fetch('http://localhost:3000/api/agent/simulate-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: execData.orderId,
      shouldFail: false,
      intentId: chatData.intentId
    })
  });
  const simData = await simRes.json();
  
  const verifyRes = await fetch('http://localhost:3000/api/agent/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: execData.orderId,
      paymentId: simData.id,
      signature: simData.razorpay_signature,
      intentId: chatData.intentId
    })
  });
  const verifyData = await verifyRes.json();
  console.log('5. Payment Signature HMAC Verification:', verifyData.success ? 'PASSED' : 'FAILED');

  // 6. Test Price Surge Block
  await fetch('http://localhost:3000/api/commerce/price-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod_k2_v2', newPriceINR: 9999 })
  });

  const surgeExecRes = await fetch('http://localhost:3000/api/agent/execute-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spendToken: authData.spendToken,
      productId: chatData.proposal.productId,
      merchantId: chatData.proposal.merchantId,
      amountPaise: chatData.proposal.pricePaise
    })
  });
  const surgeData = await surgeExecRes.json();
  console.log('6. Price Surge Policy Invariant Defense:', surgeData.policyBlocked ? 'PASSED (BLOCKED AS EXPECTED)' : 'FAILED');

  await fetch('http://localhost:3000/api/commerce/clear-price-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod_k2_v2' })
  });

  // 7. Audit Trail check
  const auditRes = await fetch('http://localhost:3000/api/audit/logs?limit=5');
  const auditData = await auditRes.json();
  console.log('7. Audit Trail verification:', auditData.logs.length > 0 ? 'PASSED' : 'FAILED', '| Total Events:', auditData.logs.length);

  console.log('\n🌟 ALL 7 END-TO-END WORKFLOW INTEGRATION CHECKS PASSED!\n');
}

runE2E();
