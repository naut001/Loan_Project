/* Tính toán khoản vay: trả góp đều, dư nợ giảm dần. */
function pmt(P, r, n){ if(n<=0) return P; if(r===0) return P/n; return P*r/(1-Math.pow(1+r,-n)); }
function nper(P, r, A){ if(A<=0) return Infinity; if(r===0) return Math.ceil(P/A - 0.001); if(A <= P*r) return Infinity; return Math.ceil(-Math.log(1-P*r/A)/Math.log(1+r) - 0.01); }
function rateFor(P, A, n){ // monthly rate so that pmt(P,r,n)=A
  if(A*n <= P) return 0;
  let lo=0, hi=0.3;
  for(let i=0;i<100;i++){ const mid=(lo+hi)/2; if(pmt(P,mid,n) > A) hi=mid; else lo=mid; }
  return (lo+hi)/2;
}
function schedule(P, r, A, maxN=600){
  const rows=[]; let bal=P, totI=0;
  for(let k=1; k<=maxN && bal>0.5; k++){
    const i = Math.round(bal*r);
    let pay = A, prin = pay - i;
    if(prin >= bal - 100 || k===maxN){ prin = bal; pay = bal + i; }
    if(prin<=0) return {rows, totalInterest: Infinity, months: Infinity, stuck:true};
    bal = bal - prin; totI += i;
    rows.push({k, pay, prin, i, bal: Math.max(0,bal)});
  }
  return {rows, totalInterest: totI, months: rows.length};
}

