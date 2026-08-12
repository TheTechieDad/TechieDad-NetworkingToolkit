import React, { useState } from 'react';
import './App.css';

// ── theme ─────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem('nettoolkit-theme') || 'dark';
  });

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem('nettoolkit-theme', theme);
  }, [theme]);

  return [theme, setTheme];
}

// ── helpers ──────────────────────────────────────────────────────────
function ipToLong(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
}
function longToIP(n) {
  return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
}
function parseIP(ip) {
  const p = ip.trim().split('.');
  if (p.length !== 4) return null;
  if (p.some(x => isNaN(x) || +x < 0 || +x > 255)) return null;
  return p.map(Number);
}
function classifyIP(num) {
  const b = (num >>> 24) & 255;
  if (b < 128) return 'Class A';
  if (b < 192) return 'Class B';
  if (b < 224) return 'Class C';
  if (b < 240) return 'Class D (Multicast)';
  return 'Class E (Reserved)';
}
function getScope(num) {
  const a=(num>>>24)&255, b=(num>>>16)&255;
  if (a===10) return 'Private (RFC1918)';
  if (a===172&&b>=16&&b<=31) return 'Private (RFC1918)';
  if (a===192&&b===168) return 'Private (RFC1918)';
  if (a===127) return 'Loopback';
  if (a===169&&b===254) return 'APIPA';
  return 'Public';
}
function expandIPv6(addr) {
  let [left, right] = addr.split('::');
  if (right === undefined) right = null;
  const parse = s => s ? s.split(':') : [];
  const l = parse(left), r = right !== null ? parse(right) : [];
  const missing = 8 - l.length - r.length;
  return [...l, ...Array(missing).fill('0000'), ...r].map(g => g.padStart(4,'0')).join(':');
}

// ── sub-components ────────────────────────────────────────────────────
function ResultGrid({ items }) {
  return (
    <div className="result-grid">
      {items.map(([k, v, cls]) => (
        <div className="result-item" key={k}>
          <div className="rkey">{k}</div>
          <div className={`rval ${cls || ''}`}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function ResultCard({ title, children }) {
  return (
    <div className="results">
      <div className="results-header">{title}</div>
      {children}
    </div>
  );
}

// ── panels ────────────────────────────────────────────────────────────
function IPv4Panel() {
  const [ip, setIp] = useState('192.168.1.0');
  const [cidr, setCidr] = useState('24');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const calculate = async () => {
    setError(''); setResult(null);
    try {
      const res = await fetch(`/api/subnet/v4?ip=${ip}&cidr=${cidr}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setResult(data);
    } catch {
      // fallback: calculate client-side if API unavailable
      if (!parseIP(ip)) { setError('Invalid IP address'); return; }
      const c = parseInt(cidr);
      if (isNaN(c)||c<0||c>32) { setError('Invalid CIDR (0-32)'); return; }
      const ipL = ipToLong(ip);
      const mask = c===0?0:(~0<<(32-c))>>>0;
      const net = (ipL&mask)>>>0;
      const bc  = (net|(~mask>>>0))>>>0;
      setResult({
        network:    longToIP(net),
        broadcast:  longToIP(bc),
        mask:       longToIP(mask),
        wildcard:   longToIP(~mask>>>0),
        firstHost:  longToIP(net+1),
        lastHost:   longToIP(bc-1),
        usableHosts: c>=31 ? Math.pow(2,32-c) : Math.pow(2,32-c)-2,
        cidr:       c,
        ipClass:    classifyIP(net),
        scope:      getScope(net),
      });
    }
  };

  const pct = result ? ((result.cidr/32)*100).toFixed(0) : 0;

  return (
    <div>
      <div className="row">
        <div className="field">
          <label>IP Address</label>
          <input value={ip} onChange={e=>setIp(e.target.value)} onKeyDown={e => e.key === 'Enter' && calculate()} placeholder="192.168.1.0"/>
        </div>
        <div className="field">
          <label>CIDR / Prefix</label>
          <input value={cidr} onChange={e=>setCidr(e.target.value)} onKeyDown={e => e.key === 'Enter' && calculate()} placeholder="24"/>
        </div>
      </div>
      <button className="btn" onClick={calculate}>Calculate Subnet</button>
      {error && <div className="error-msg">{error}</div>}
      {result && (
        <ResultCard title={`IPv4 /${result.cidr} — ${result.network} — ${Number(result.usableHosts).toLocaleString()} usable hosts`}>
          <div className="cidr-bar-wrap">
            <div className="cidr-label">Bit allocation — {result.cidr} network + {32-result.cidr} host</div>
            <div className="cidr-bar">
              <div className="cidr-net" style={{width:`${pct}%`}}>{result.cidr > 4 ? `${result.cidr} net` : ''}</div>
              <div className="cidr-host">{32-result.cidr > 4 ? `${32-result.cidr} host` : ''}</div>
            </div>
          </div>
          <ResultGrid items={[
            ['Network address',  result.network],
            ['Broadcast',        result.broadcast, 'blue'],
            ['Subnet mask',      result.mask],
            ['Wildcard mask',    result.wildcard, 'amber'],
            ['First usable host',result.firstHost],
            ['Last usable host', result.lastHost],
            ['Usable hosts',     Number(result.usableHosts).toLocaleString(), 'amber'],
            ['IP class',         result.ipClass],
            ['Address scope',    result.scope],
            ['CIDR notation',    `${result.network}/${result.cidr}`],
          ]}/>
        </ResultCard>
      )}
    </div>
  );
}

function IPv6Panel() {
  const [addr, setAddr] = useState('2001:db8::/32');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const calculate = async () => {
    setError(''); setResult(null);
    try {
      const [a, p] = addr.split('/');
      const prefix = parseInt(p||'64');
      const res = await fetch(`/api/subnet/v6?address=${encodeURIComponent(a)}&prefix=${prefix}`);
      if (!res.ok) throw new Error('API error');
      setResult(await res.json());
    } catch {
      // client-side fallback
      try {
        const [a, p] = addr.split('/');
        const prefix = parseInt(p||'64');
        const full = expandIPv6(a);
        const groups = full.split(':');
        setResult({
          prefix, hostBits: 128-prefix,
          addressType: addr.includes('2001:db8') ? 'Documentation' :
                       addr.startsWith('fe80') ? 'Link-local' :
                       addr.startsWith('fc')||addr.startsWith('fd') ? 'Unique Local' :
                       addr.startsWith('ff') ? 'Multicast' : 'Global Unicast',
          expanded: full,
          compressed: addr.split('/')[0],
          interfaceId: groups.slice(4).join(':'),
          networkPrefix: groups.slice(0,4).join(':') + '::/64',
        });
      } catch { setError('Invalid IPv6 address'); }
    }
  };

  return (
    <div>
      <div className="field">
        <label>IPv6 Address / Prefix</label>
        <input value={addr} onChange={e=>setAddr(e.target.value)} onKeyDown={e => e.key === 'Enter' && calculate()} placeholder="2001:db8::/32"/>
      </div>
      <button className="btn" onClick={calculate}>Analyze IPv6</button>
      {error && <div className="error-msg">{error}</div>}
      {result && (
        <ResultCard title={`IPv6 /${result.prefix} — ${result.addressType}`}>
          <ResultGrid items={[
            ['Address type',      result.addressType, 'amber'],
            ['Prefix length',     '/'+result.prefix],
            ['Host bits',         result.hostBits],
            ['Expanded form',     result.expanded||addr.split('/')[0], 'blue'],
            ['Network prefix',    result.networkPrefix||''],
            ['Interface ID',      result.interfaceId||''],
          ]}/>
        </ResultCard>
      )}
    </div>
  );
}

function VLSMPanel() {
  const [network, setNetwork] = useState('10.0.0.0');
  const [prefix, setPrefix] = useState('16');
  const [subnets, setSubnets] = useState([]);
  const [name, setName] = useState('');
  const [hosts, setHosts] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const addSubnet = () => {
    if (!name || !hosts || isNaN(parseInt(hosts))) return;
    setSubnets(prev => [...prev, { name, hosts: parseInt(hosts) }]);
    setName(''); setHosts('');
  };

  const removeSubnet = (i) => setSubnets(prev => prev.filter((_,idx)=>idx!==i));

  const calculate = async () => {
    setError(''); setResult(null);
    if (!subnets.length) { setError('Add at least one subnet'); return; }
    try {
      const res = await fetch('/api/subnet/vlsm', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ network, prefix: parseInt(prefix), subnets }),
      });
      if (!res.ok) throw new Error('API error');
      setResult(await res.json());
    } catch {
      // client-side fallback
      if (!parseIP(network)) { setError('Invalid network address'); return; }
      const sorted = [...subnets].sort((a,b)=>b.hosts-a.hosts);
      let current = ipToLong(network);
      const rows = sorted.map(s => {
        const bits = Math.max(2, Math.ceil(Math.log2(s.hosts+2)));
        const newPfx = 32-bits;
        const block = Math.pow(2,bits);
        const aligned = Math.ceil(current/block)*block;
        const bc = aligned+block-1;
        current = bc+1;
        return { name:s.name, network:`${longToIP(aligned)}/${newPfx}`,
                 firstHost:longToIP(aligned+1), lastHost:longToIP(bc-1),
                 broadcast:longToIP(bc), hosts:block-2 };
      });
      setResult(rows);
    }
  };

  return (
    <div>
      <div className="row">
        <div className="field"><label>Network Address</label>
          <input value={network} onChange={e=>setNetwork(e.target.value)} onKeyDown={e => e.key === 'Enter' && calculate()} placeholder="10.0.0.0"/>
        </div>
        <div className="field"><label>Prefix Length</label>
          <input value={prefix} onChange={e=>setPrefix(e.target.value)} onKeyDown={e => e.key === 'Enter' && calculate()} placeholder="16"/>
        </div>
      </div>
      <div className="add-row">
        <div className="field"><label>Subnet name</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubnet()} placeholder="LAN A"/>
        </div>
        <div className="field"><label>Hosts needed</label>
          <input type="number" value={hosts} onChange={e=>setHosts(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubnet()} placeholder="50"/>
        </div>
        <button className="btn sec" onClick={addSubnet}>+ Add</button>
      </div>
      {subnets.map((s,i)=>(
        <div className="subnet-entry" key={i}>
          <span className="sname">{s.name}</span>
          <span className="shosts">{s.hosts} hosts</span>
          <span className="sdel" onClick={()=>removeSubnet(i)}>×</span>
        </div>
      ))}
      <button className="btn" onClick={calculate} style={{marginTop:12}}>Plan Subnets</button>
      {error && <div className="error-msg">{error}</div>}
      {result && (
        <ResultCard title={`VLSM allocation — ${result.length} subnets`}>
          <div style={{overflowX:'auto'}}>
            <table className="vlsm-table">
              <thead><tr><th>Name</th><th>Network/CIDR</th><th>Host range</th><th>Broadcast</th><th>Hosts</th></tr></thead>
              <tbody>{result.map((r,i)=>(
                <tr key={i}>
                  <td>{r.name}</td>
                  <td className="net">{r.network}</td>
                  <td>{r.firstHost} – {r.lastHost}</td>
                  <td className="bc">{r.broadcast}</td>
                  <td>{Number(r.hosts).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </ResultCard>
      )}
    </div>
  );
}

function ConvertPanel() {
  const [input, setInput] = useState('192.168.1.1');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const convert = () => {
    setError(''); setResult(null);
    let long;
    const raw = input.trim();
    if (/^\d+$/.test(raw))               long = parseInt(raw) >>> 0;
    else if (/^0x[0-9a-fA-F]+$/i.test(raw)) long = parseInt(raw,16) >>> 0;
    else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
      if (!parseIP(raw)) { setError('Invalid IP'); return; }
      long = ipToLong(raw);
    } else { setError('Use dotted decimal, decimal integer, or 0x hex'); return; }

    const bytes = [(long>>>24)&255,(long>>>16)&255,(long>>>8)&255,long&255];
    setResult([
      ['Dotted decimal',   longToIP(long)],
      ['32-bit integer',   long.toLocaleString(), 'amber'],
      ['Hexadecimal',      '0x'+long.toString(16).toUpperCase().padStart(8,'0'), 'blue'],
      ['Binary (octets)',  long.toString(2).padStart(32,'0').match(/.{8}/g).join('.')],
      ['Octal',            '0'+long.toString(8)],
      ['IP class',         classifyIP(long)],
      ['Address scope',    getScope(long)],
      ['Reverse PTR',      bytes.slice().reverse().join('.')+'.in-addr.arpa'],
      ['IPv4-mapped IPv6', '::ffff:'+longToIP(long)],
      ['Byte values',      bytes.join(', ')],
    ]);
  };

  return (
    <div>
      <div className="field">
        <label>Input (dotted decimal, integer, or 0x hex)</label>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && convert()} placeholder="192.168.1.1"/>
      </div>
      <button className="btn" onClick={convert}>Convert All Formats</button>
      {error && <div className="error-msg">{error}</div>}
      {result && <ResultCard title={`Conversions — ${input}`}><ResultGrid items={result}/></ResultCard>}
    </div>
  );
}

function CIDRCheckPanel() {
  const [network, setNetwork] = useState('10.0.0.0/8');
  const [ip, setIp] = useState('10.5.20.1');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const check = () => {
    setError(''); setResult(null);
    const [netAddr, cidrStr] = network.split('/');
    const cidr = parseInt(cidrStr);
    if (!parseIP(netAddr)||!parseIP(ip)||isNaN(cidr)||cidr<0||cidr>32) {
      setError('Enter valid network (e.g. 10.0.0.0/8) and IP'); return;
    }
    const mask  = cidr===0?0:(~0<<(32-cidr))>>>0;
    const netL  = (ipToLong(netAddr)&mask)>>>0;
    const ipL   = ipToLong(ip);
    const bc    = (netL|(~mask>>>0))>>>0;
    const inNet = ((ipL&mask)>>>0)===netL;
    const isNet = ipL===netL, isBc = ipL===bc;
    const role  = isNet?'Network address':isBc?'Broadcast address':inNet?'Host address':'Outside network';
    setResult({ inNet, network:longToIP(netL)+'/'+cidr, mask:longToIP(mask),
                broadcast:longToIP(bc), role, offset:inNet?ipL-netL:null,
                hosts: Math.pow(2,32-cidr)-2 });
  };

  return (
    <div>
      <div className="field"><label>Network (CIDR notation)</label>
        <input value={network} onChange={e=>setNetwork(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} placeholder="10.0.0.0/8"/>
      </div>
      <div className="field"><label>IP address to check</label>
        <input value={ip} onChange={e=>setIp(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} placeholder="10.5.20.1"/>
      </div>
      <button className="btn" onClick={check}>Check Membership</button>
      {error && <div className="error-msg">{error}</div>}
      {result && (
        <ResultCard title={
          <span>Membership check &nbsp;
            <span className={`badge ${result.inNet?'':'red'}`}>
              {result.inNet?'IN NETWORK':'NOT IN NETWORK'}
            </span>
          </span>
        }>
          <ResultGrid items={[
            ['Result',       result.inNet?'Member':'Not a member', result.inNet?'':'red'],
            ['Role',         result.role, 'amber'],
            ['Network',      result.network, 'blue'],
            ['Subnet mask',  result.mask],
            ['Broadcast',    result.broadcast],
            ['Usable hosts', Number(result.hosts).toLocaleString()],
            ...(result.inNet ? [['Offset in subnet', '+'+result.offset]] : []),
          ]}/>
        </ResultCard>
      )}
    </div>
  );
}

// ── main app ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'ipv4',      label: 'IPv4 Subnet Calc',  Panel: IPv4Panel },
  { id: 'ipv6',      label: 'IPv6 Subnet Calc',  Panel: IPv6Panel },
  { id: 'vlsm',      label: 'VLSM Planner', Panel: VLSMPanel },
  { id: 'convert',   label: 'IP Converting',   Panel: ConvertPanel },
  { id: 'cidrcheck', label: 'CIDR Check',   Panel: CIDRCheckPanel },
];

export default function App() {
  const [active, setActive] = useState('ipv4');
  const [theme, setTheme] = useTheme();
  const { Panel } = TABS.find(t => t.id === active);

  const nextTheme  = theme === 'dark' ? 'light' : 'dark';
  const themeIcon  = theme === 'dark' ? '☀️' : '🌙';
  const themeLabel = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

  return (
    <div className="wrap">
      <div className="header">
        <img src="/brand/mark-white.png" alt="Logo" className="logo"/>
        <h1>Networking Toolkit</h1>
        <span className="version">v1.0</span>
        <button
          className="theme-toggle"
          onClick={() => setTheme(nextTheme)}
          title="Toggle theme">
          {themeIcon} {themeLabel}
        </button>
      </div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id}
            className={`tab ${active===t.id?'active':''}`}
            onClick={()=>setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="panel">
        <Panel/>
      </div>
    </div>
  );
}
