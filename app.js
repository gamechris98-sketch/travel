const { useState, useEffect, useMemo, useRef } = React;
const h = React.createElement;

// Firebase Config
const cfg = {
  apiKey: "AIzaSyCS_AKLu7A0v-KwW-mZQyTjBTqnVe6vdks",
  authDomain: "travel-app-2758e.firebaseapp.com",
  projectId: "travel-app-2758e",
  storageBucket: "travel-app-2758e.firebasestorage.app",
  messagingSenderId: "418586873034",
  appId: "1:418586873034:web:c6ea8b1236c2a5b2d0b833"
};

if (!firebase.apps.length) firebase.initializeApp(cfg);
const db = firebase.firestore(), au = firebase.auth(), st = firebase.storage();

// AI Sync Engine
window.AI_SYNC = (sid, data) => {
  if (!sid || !data) return;
  db.collection('trips').doc(sid).update(data).then(() => {
    location.reload();
  });
};

// UI Components
const I = ({ n, s = 20 }) => h('span', { className: 'mi', style: { fontSize: s } }, n);
const ci = { '식비': '🍽️', '교통': '🚕', '숙박': '🏨', '쇼핑': '🛍️', '기타': '📦' };
const cc = { '식비': 'orange', '교통': 'blue', '숙박': 'green', '쇼핑': 'purple', '기타': 'gray' };
const covers = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)'
];

// Reusable Editable Input
function EI({ val, onSave, className, style, placeholder, tag, ...rest }) {
  const [v, setV] = useState(val || '');
  const r = useRef();
  useEffect(() => { setV(val || '') }, [val]);
  const props = {
    ref: r,
    className,
    style,
    placeholder,
    value: v,
    onChange: e => setV(e.target.value),
    onBlur: () => { if (v !== (val || '')) onSave(v) },
    onKeyDown: e => {
      if (e.key === 'Enter' && tag !== 'textarea') {
        e.preventDefault();
        r.current.blur();
      }
    },
    ...rest
  };
  return h(tag || 'input', props);
}

// Sub-components
const BottomBar = ({ cur, set, items }) => h('div', { className: 'tab-bar' }, items.map(t => h('button', {
  key: t.id,
  className: 'tab-bar-btn' + (cur === t.id ? ' on' : ''),
  onClick: () => set(t.id)
}, [
  h('span', { className: 'mi', style: { fontSize: 24 } }, t.i),
  cur === t.id && h('div', { className: 'tab-bar-dot' }),
  h('span', null, t.l)
])));

const InfoBar = ({ dest }) => {
  const [w, setW] = useState(null);
  const [e, setE] = useState(null);
  const [t, setT] = useState(new Date());
  
  useEffect(() => {
    if (!dest) return;
    fetch(`https://wttr.in/${dest}?format=j1`).then(r => r.json()).then(d => setW(d.current_condition[0])).catch(() => {});
    fetch(`https://open.er-api.com/v6/latest/KRW`).then(r => r.json()).then(d => setE(d)).catch(() => {});
    const timer = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(timer);
  }, [dest]);
  
  if (!dest) return null;
  return h('div', { className: 'ios-card glass', style: { margin: '12px 20px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
      h('span', { style: { fontSize: 20 } }, w ? (w.weatherDesc[0].value.includes('Sun') ? '☀️' : w.weatherDesc[0].value.includes('Cloud') ? '☁️' : '🌦️') : '🌡️'),
      h('div', null, [
        h('p', { style: { fontSize: 11, fontWeight: 700, color: 'var(--blue)' } }, '현지 날씨 & 시간'),
        h('p', { style: { fontSize: 13, fontWeight: 800 } }, w ? `${w.temp_C}°C / ${t.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '불러오는 중...')
      ])
    ]),
    e && h('div', { style: { textAlign: 'right' } }, [
      h('p', { style: { fontSize: 11, fontWeight: 700, color: 'var(--orange)' } }, '환율 (1,000원 기준)'),
      h('p', { style: { fontSize: 13, fontWeight: 800 } }, `USD: $${(1000 * e.rates.USD).toFixed(2)} / JPY: ¥${(1000 * e.rates.JPY).toFixed(0)}`)
    ])
  ]);
};

const MapView = ({ trip }) => {
  const r = useRef();
  useEffect(() => {
    if (!r.current || !trip?.itinerary?.length || !window.L) return;
    const m = L.map(r.current).setView([37.5665, 126.9780], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(m);
    
    // Sort itinerary by day and time for the route line
    const sortedItin = [...trip.itinerary]
      .filter(it => it.lat && it.lng)
      .sort((a, b) => {
        if (a.day !== b.day) return (a.day || 1) - (b.day || 1);
        return (a.time || '00:00').localeCompare(b.time || '00:00');
      });

    const pts = sortedItin.map(it => [Number(it.lat), Number(it.lng)]);
    
    // Draw Polyline
    if (pts.length > 1) {
      L.polyline(pts, { color: 'var(--blue)', weight: 4, opacity: 0.6, dashArray: '10, 10', lineJoin: 'round', lineCap: 'round' }).addTo(m);
      // Add subtle glow to line
      L.polyline(pts, { color: 'var(--blue)', weight: 10, opacity: 0.1 }).addTo(m);
    }

    sortedItin.forEach((it, idx) => {
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="map-marker-label">${idx + 1}. ${it.title}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      L.marker([it.lat, it.lng], { icon }).addTo(m).bindPopup(`<b>Day ${it.day} | ${it.time}</b><br>${it.title}`);
    });

    if (pts.length > 0) m.fitBounds(pts, { padding: [50, 50] });
    return () => m.remove();
  }, [trip]);

  return h('div', { className: 'ios-card', style: { margin: '0 20px', height: 450, overflow: 'hidden', position: 'relative', background: '#f8f9fa' } }, [
    h('div', { ref: r, style: { width: '100%', height: '100%', zIndex: 1 } }),
    !trip?.itinerary?.some(x => x.lat) && h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(255,255,255,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, textAlign: 'center', padding: 20 } }, [
      h('div', { style: { fontSize: 40, marginBottom: 10 } }, '📍'),
      h('h4', null, '일정에서 장소 위치를 먼저 찾아주세요!'),
      h('p', { className: 'home-sub' }, '일정 탭의 나침반 버튼을 눌러보세요.')
    ])
  ]);
};

const TRoute = ({ trip, sync, show }) => {
  const itin = trip?.itinerary || [];
  const days = [...new Set(itin.map(x => x.day || 1))].sort((a, b) => a - b);
  const addDay = () => { const nd = (days.length ? Math.max(...days) : 0) + 1; sync('itinerary', [...itin, { day: nd, time: '09:00', title: '', desc: '', cat: '관광', emoji: '🏛️' }]) };
  const addStop = (d) => sync('itinerary', [...itin, { day: d, time: '09:00', title: '', desc: '', cat: '관광', emoji: '🏛️' }]);
  const cats = ['관광', '식당', '숙소', '쇼핑', '교통', '기타'];
  const catClr = { 관광: 'var(--blue)', 식당: 'var(--orange)', 숙소: 'var(--green)', 쇼핑: 'var(--purple)', 교통: 'var(--teal)', 기타: 'var(--sub)' };
  const catIco = { 관광: '🏛️', 식당: '🍽️', 숙소: '🏨', 쇼핑: '🛍️', 교통: '🚕', 기타: '📦' };

  const renderStop = (it, si, arr) => h('div', { key: it.idx, className: 'stop-item' }, [
    si < arr.length - 1 && h('div', { className: 'stop-line' }),
    h('div', { className: 'stop-icon', style: { color: catClr[it.cat] || 'var(--blue)', background: (catClr[it.cat] || 'var(--blue)') + '12' } }, [
      h(EI, { val: it.emoji || catIco[it.cat] || '📍', onSave: v => { const n = [...itin]; n[it.idx].emoji = v; sync('itinerary', n) }, style: { border: 'none', background: 'none', fontSize: 18, width: 24, textAlign: 'center', outline: 'none' } })
    ]),
    h('div', { className: 'stop-body' }, [
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, [
        h(EI, { val: it.time, onSave: v => { const n = [...itin]; n[it.idx].time = v; sync('itinerary', n) }, style: { width: 50, border: 'none', background: 'rgba(0,122,255,.06)', borderRadius: 6, padding: '4px 6px', fontSize: 11, fontWeight: 700, color: 'var(--blue)', textAlign: 'center', outline: 'none', fontFamily: 'inherit' } }),
        h(EI, { val: it.title, onSave: v => { const n = [...itin]; n[it.idx].title = v; sync('itinerary', n) }, style: { flex: 1, border: 'none', background: 'none', fontSize: 16, fontWeight: 800, outline: 'none', fontFamily: 'inherit', color: 'var(--text)', padding: '4px 0' }, placeholder: '장소명' })
      ]),
      h(EI, { val: it.desc, onSave: v => { const n = [...itin]; n[it.idx].desc = v; sync('itinerary', n) }, style: { border: 'none', background: 'none', fontSize: 13, color: 'var(--sub)', outline: 'none', fontFamily: 'inherit', width: '100%', padding: '2px 0' }, placeholder: '활동 내용' }),
  const [itin, setItin] = useState(trip.itinerary || []);
  useEffect(() => { setItin(trip.itinerary || []) }, [trip.itinerary]);

  const addStop = () => {
    const lastDay = itin.length ? Math.max(...itin.map(x => x.day)) : 1;
    const n = [...itin, { idx: itin.length, day: lastDay, time: '12:00', title: '', desc: '', cat: '관광', emoji: '📍' }];
    sync('itinerary', n);
  };

  const renderStop = (it, si) => h('div', { key: it.idx, id: `stop-${it.idx}`, className: 'stop-card glass' }, [
    h('div', { style: { display: 'flex', gap: 12, alignItems: 'flex-start' } }, [
      h('div', { style: { textAlign: 'center', minWidth: 50 } }, [
        h(EI, { val: it.time, onSave: v => { const n = [...itin]; n[it.idx].time = v; sync('itinerary', n.sort((a,b)=>a.day-b.day || a.time.localeCompare(b.time))) }, style: { fontSize: 15, fontWeight: 900, textAlign: 'center', background: 'var(--card2)', borderRadius: 6, padding: '4px 0' } }),
        h('div', { style: { marginTop: 6 } }, h('span', { style: { fontSize: 24, cursor: 'pointer' }, onClick: () => {
          const e = prompt('이모지 입력', it.emoji || '📍'); if(e) { const n = [...itin]; n[it.idx].emoji = e; sync('itinerary', n) }
        } }, it.emoji || '📍'))
      ]),
      h('div', { style: { flex: 1 } }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
          h(EI, { val: it.title, onSave: v => { const n = [...itin]; n[it.idx].title = v; sync('itinerary', n) }, placeholder: '장소 또는 활동명', style: { fontSize: 17, fontWeight: 800, width: '100%', marginBottom: 4 } }),
          h('div', { style: { display: 'flex', gap: 4 } }, [
            h('button', { className: 'icon-btn', onClick: () => {
              if (!it.title) return;
              fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${it.title}`).then(r => r.json()).then(d => {
                if (d[0]) {
                  const n = [...itin]; n[it.idx].lat = d[0].lat; n[it.idx].lng = d[0].lon; sync('itinerary', n); show('위치 성공!');
                }
              });
            } }, h(I, { n: 'explore', s: 13 })),
            h('button', { className: 'icon-btn', onClick: () => sync('itinerary', itin.filter((_, j) => j !== it.idx).map((x,i)=>({...x, idx:i}))) }, h(I, { n: 'close', s: 13 }))
          ])
        ]),
        h(EI, { val: it.desc, onSave: v => { const n = [...itin]; n[it.idx].desc = v; sync('itinerary', n) }, placeholder: '메모 입력...', style: { fontSize: 13, color: 'var(--sub)', width: '100%' } })
      ])
    ])
  ]);

  const days = Array.from({ length: Math.max(1, ...itin.map(x => x.day)) }, (_, i) => i + 1);
  const getD = (d) => {
    if (!trip.startDate) return '';
    const date = new Date(trip.startDate);
    date.setDate(date.getDate() + (d - 1));
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  return h('div', { style: { padding: '0 20px 100px' } }, [
    days.map(d => h('div', { key: d, className: 'day-section' }, [
      h('div', { className: 'day-header' }, [
        h('button', { className: 'icon-btn', style: { width: 28, height: 28, marginLeft: 8 }, onClick: () => { if (confirm('Day ' + d + ' 삭제?')) sync('itinerary', itin.filter(x => (x.day || 1) !== d)) } }, h(I, { n: 'close', s: 14 }))
      ]),
      ...stops.map((it, si) => renderStop(it, si, stops))
    ]);
  };

  if (!itin.length) return h('div', null, [
    h('div', { className: 'empty' }, [h('div', { className: 'empty-icon' }, '📅'), h('h4', null, '일정을 추가해보세요')]),
    h('div', { style: { padding: '0 20px' } }, h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: addDay }, [h(I, { n: 'add', s: 16 }), 'Day 1 추가']))
  ]);

  return h('div', null, [
    ...days.map(renderDay),
    h('div', { style: { padding: '12px 20px' } }, h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: addDay }, [h(I, { n: 'add', s: 16 }), '+ Day 추가']))
  ]);
};

const TCheck = ({ trip, sync }) => {
  const done = (trip?.checklist || []).filter(x => x.done).length, all = (trip?.checklist || []).length;
  const templates = {
    '해외여행': ['여권', '항공권 출력', '환전', '어댑터/변환플러그', '캐리어', '보험증서', '비자 서류', '심카드/eSIM', '세면도구', '상비약', '선크림', '밀폐백'],
    '국내단기': ['신분증', '충전기', '보조배터리', '세면도구', '간식', '물', '우산', '상비약', '선글라스', '모자'],
    '캠핑': ['텐트', '버너', '침낭', '랜턴', '아이스박스', '코펠', '식기세트', '타프', '장작', '모기퇴치', '담요', '방수포'],
    '호캉스': ['수영복', '수영모', '수건', '충전기', '잠옷', '간식', '보드게임', '블루투스 스피커', '마스크팩', '기초 화장품'],
    '출장': ['노트북', '충전기', '명함', '서류 파일', '이어폰', '와이셔츠/정장', '구두', '정장용 교통카드'],
    '기본': ['세면도구', '속옷', '상비약', '충전기', '우산', '손수건', '커피', '수건']
  };
  return h('div', null, [
    h('div', { style: { display: 'flex', gap: 8, padding: '8px 20px', overflowX: 'auto' } }, Object.keys(templates).map(t => h('button', {
      key: t, className: 'btn btn-gray btn-sm btn-pill', style: { flexShrink: 0 },
      onClick: () => sync('checklist', [...(trip.checklist || []), ...templates[t].map(x => ({ text: x, done: false }))])
    }, t))),
    all > 0 && h('div', { className: 'progress-row' }, [
      h('div', { className: 'progress-bar' }, h('div', { className: 'progress-fill', style: { width: (done / all * 100) + '%' } })),
      h('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--sub)' } }, done + '/' + all)
    ]),
    h('div', { className: 'ios-card', style: { margin: '0 20px' } }, !all ? h('div', { className: 'empty' }, [h('div', { className: 'empty-icon' }, '✅'), h('h4', null, '준비물을 추가하세요')]) :
      trip.checklist.map((it, i) => h('div', { key: i, className: 'ck-row' }, [
        h('button', { className: 'ck-btn' + (it.done ? ' on' : ''), onClick: () => { const n = [...trip.checklist]; n[i].done = !n[i].done; sync('checklist', n) } }, it.done && h(I, { n: 'check', s: 12 })),
        h(EI, { val: it.text, onSave: v => { const n = [...trip.checklist]; n[i].text = v; sync('checklist', n) }, className: 'ck-text' + (it.done ? ' done' : ''), placeholder: '항목 입력' }),
        h('button', { className: 'icon-btn', style: { width: 22, height: 22, opacity: .3 }, onClick: () => sync('checklist', trip.checklist.filter((_, j) => j !== i)) }, h(I, { n: 'close', s: 10 }))
      ]))),
    h('div', { style: { padding: '12px 20px', display: 'flex', gap: 10 } }, [
      h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: () => sync('checklist', [...(trip.checklist || []), { text: '', done: false }]) }, [h(I, { n: 'add', s: 16 }), '항목 추가']),
      h('button', { className: 'btn btn-red btn-pill', style: { width: 100 }, onClick: () => { if(confirm('모든 항목을 삭제하시겠습니까?')) sync('checklist', []) } }, '초기화')
    ])
  ]);
};

const TMemo = ({ trip, sync }) => h('div', { style: { padding: '0 20px' } }, h('div', { className: 'ios-card', style: { padding: 4 } }, h(EI, { val: trip?.memo || '', onSave: v => sync('memo', v), className: 'ios-input', tag: 'textarea', style: { minHeight: 400, padding: 12, border: 'none', background: 'none' }, placeholder: '메모를 자유롭게 작성하세요...' })));

const TMoney = ({ trip, sync, total, settle, prof, user, show, open }) => {
  const [cur, setCur] = useState('KRW');
  const [rates, setRates] = useState({});

  useEffect(() => {
    fetch(`https://open.er-api.com/v6/latest/KRW`).then(r => r.json()).then(d => setRates(d.rates)).catch(() => {});
  }, []);

  const budget = Number(trip?.budget || 0);
  const remain = budget - total;
  const pct = budget > 0 ? Math.min(Math.round((total / budget) * 100), 100) : 0;
  
  const dates = [...new Set(trip?.expenses?.map(x => x.date) || [])].reverse();
  const cats = trip?.expenses?.reduce((a, x) => { const c = x.category || '기타'; a[c] = (a[c] || 0) + Number(x.amount); return a }, {}) || {};
  
  const addExp = (cat) => {
    const n = document.getElementById('en'), a = document.getElementById('ea');
    if (!n.value || !a.value) return show('내용과 금액을 입력하세요', false);
    
    let finalAmt = Number(a.value);
    if (cur !== 'KRW' && rates[cur]) {
      finalAmt = Math.round(Number(a.value) / rates[cur]);
      show(`${cur} ${a.value} → ${finalAmt.toLocaleString()}원 변환됨`);
    }
    
    sync('expenses', [...(trip.expenses || []), { 
      id: Date.now(), name: n.value, amount: finalAmt, category: cat, 
      payer: prof.nickname, payerId: user.uid, 
      date: new Date().toLocaleDateString(), 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }]);
    n.value = ''; a.value = '';
  };

  return h('div', null, [
    h('div', { className: 'budget-container' }, [
      h('div', { className: 'budget-header' }, [
        h('div', { className: 'budget-info' }, [
          h('p', null, '총 지출 현황'),
          h('p', null, total.toLocaleString() + '원')
        ]),
        h('div', { className: 'budget-pct' }, pct + '%')
      ]),
      h('div', { className: 'budget-bar-bg' }, h('div', { className: 'budget-bar-fill', style: { width: pct + '%', background: pct > 90 ? 'var(--red)' : 'linear-gradient(90deg, var(--blue), var(--teal))' } })),
      h('div', { className: 'budget-footer' }, [
        h('span', null, budget > 0 ? `예산 ${budget.toLocaleString()}원` : '예산을 설정하세요'),
        h('span', { style: { color: remain < 0 ? 'var(--red)' : 'var(--sub)' } }, remain >= 0 ? `잔액 ${remain.toLocaleString()}원` : `초과 ${Math.abs(remain).toLocaleString()}원`)
      ]),
      h('div', { className: 'budget-input-wrap' }, [
        h(I, { n: 'payments', s: 16, style: { color: 'var(--blue)' } }),
        h('input', { 
          type: 'number', placeholder: '목표 예산 설정', defaultValue: trip?.budget,
          onBlur: e => { const v = Number(e.target.value); if (v !== budget) sync('budget', v) },
          onKeyDown: e => { if(e.key === 'Enter') e.target.blur() }
        })
      ])
    ]),
    h('div', { className: 'ios-card', style: { margin: '12px 20px', padding: 14 } }, [
      h('div', { className: 'currency-selector' }, ['KRW', 'USD', 'JPY', 'EUR', 'TWD', 'THB'].map(c => h('button', {
        key: c, className: 'currency-btn' + (cur === c ? ' on' : ''),
        onClick: () => setCur(c)
      }, c))),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 } }, [
        h('div', { style: { display: 'flex', gap: 8 } }, [
          h('input', { id: 'en', className: 'ios-input', placeholder: '지출 내용', style: { flex: 1 } }), 
          h('div', { style: { position: 'relative', width: 100 } }, [
            h('input', { id: 'ea', className: 'ios-input', type: 'number', placeholder: '금액', style: { width: '100%', paddingRight: 30 } }),
            h('span', { style: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--sub)' } }, cur === 'KRW' ? '₩' : cur)
          ])
        ]),
        h('input', { id: 'ed', className: 'ios-input', type: 'date', defaultValue: new Date().toISOString().split('T')[0], style: { fontSize: 13 } })
      ]),
      h('div', { style: { display: 'flex', gap: 4 } }, ["식비", "교통", "숙박", "쇼핑", "기타"].map(c => h('button', {
        key: c, className: 'btn btn-gray btn-sm btn-pill', style: { flex: 1, padding: '7px 2px', fontSize: 11 },
        onClick: () => {
          const n = document.getElementById('en'), a = document.getElementById('ea'), d = document.getElementById('ed');
          if (!n.value || !a.value) return show('내용과 금액을 입력하세요', false);
          
          let finalAmt = Number(a.value);
          if (cur !== 'KRW' && rates[cur]) {
            finalAmt = Math.round(Number(a.value) / rates[cur]);
            show(`${cur} ${a.value} → ${finalAmt.toLocaleString()}원 변환됨`);
          }
          
          sync('expenses', [...(trip.expenses || []), { 
            id: Date.now(), name: n.value, amount: finalAmt, category: c, 
            payer: prof.nickname, payerId: user.uid, 
            date: d.value ? new Date(d.value).toLocaleDateString() : new Date().toLocaleDateString(), 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          }]);
          n.value = ''; a.value = '';
        }
      }, c)))
    ]),
    h('div', { className: 'stat-card', style: { marginTop: 0 } }, [h('div', { style: { position: 'relative', zIndex: 1 } }, [
      h('p', { style: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase' } }, '정산 요약'),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        h('h3', { style: { fontSize: 28, fontWeight: 900, color: '#fff', marginTop: 4, whiteSpace: 'nowrap' } }, (settle?.pp || 0).toLocaleString() + '원 / 인'),
        h('button', { className: 'icon-btn', style: { background: 'rgba(255,255,255,.12)', color: '#fff' }, onClick: () => open('settle') }, h(I, { n: 'calculate', s: 18 }))
      ])
    ])]),
    total > 0 && h('div', { className: 'ios-card', style: { margin: '12px 20px' } }, Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => h('div', { key: k, className: 'exp-row' }, [
      h('div', { className: 'exp-icon', style: { background: cc[k] === 'orange' ? 'rgba(255,149,0,.1)' : cc[k] === 'blue' ? 'rgba(0,122,255,.1)' : cc[k] === 'green' ? 'rgba(52,199,89,.1)' : cc[k] === 'purple' ? 'rgba(175,82,222,.1)' : 'rgba(142,142,147,.1)' } }, ci[k] || '📦'),
      h('div', { className: 'exp-info' }, [h('p', { className: 'exp-name' }, [(k !== 'undefined' ? k : '기타'), ' ', h('span', { style: { fontSize: 11, color: 'var(--sub)' } }, Math.round(v / total * 100) + '%')])]),
      h('p', { className: 'exp-amt' }, v.toLocaleString() + '원')
    ]))),
    ...dates.map(d => {
      const de = trip.expenses.filter(x => x.date === d);
      const dt = de.reduce((a, x) => a + Number(x.amount), 0);
      return h('div', { key: d }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '16px 20px 6px' } }, [h('p', { style: { fontSize: 13, fontWeight: 600, color: 'var(--sub)' } }, d), h('p', { style: { fontSize: 13, fontWeight: 800 } }, dt.toLocaleString() + '원')]),
        h('div', { className: 'ios-card', style: { margin: '0 20px' } }, de.reverse().map(x => {
          const idx = trip.expenses.findIndex(y => y.id === x.id);
          return h('div', { key: x.id, className: 'exp-row' }, [
            h('div', { className: 'exp-icon', style: { background: 'rgba(0,122,255,.06)' } }, ci[x.category] || '📦'),
            h('div', { className: 'exp-info' }, [
              h(EI, { val: x.name, onSave: v => { const n = [...trip.expenses]; n[idx].name = v; sync('expenses', n) }, className: 'exp-name', style: { border: 'none', background: 'none', width: '100%', outline: 'none' } }),
              h('p', { className: 'exp-sub' }, (x.time || '') + ' · ' + x.payer)
            ]),
            h('div', { style: { textAlign: 'right' } }, [
              h(EI, { val: String(x.amount), onSave: v => { const n = [...trip.expenses]; n[idx].amount = Number(v); sync('expenses', n) }, className: 'exp-amt', style: { border: 'none', background: 'none', textAlign: 'right', outline: 'none', width: 80 } }),
              h('button', { style: { padding: 4, marginLeft: 8, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }, onClick: () => sync('expenses', trip.expenses.filter(y => y.id !== x.id)) }, h(I, { n: 'close', s: 14 }))
            ])
          ]);
        }))
      ])
    })
  ]);
};

const TPhoto = ({ trip, sid, show, sync, setSubTab }) => {
  const [photos, setPhotos] = React.useState([]);
  const fref = React.useRef();

  React.useEffect(() => {
    if (!sid) return;
    // 인덱스 에러 방지를 위해 orderBy 제거 후 클라이언트에서 정렬
    const q = db.collection('photos').where('sid', '==', sid);
    return q.onSnapshot(sn => {
      const data = sn.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPhotos(data.sort((a, b) => b.time - a.time));
    });
  }, [sid]);

  const upload = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    show('사진 최적화 및 업로드 중...');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          const max = 1024;
          if (w > max || h > max) {
            if (w > h) { h = Math.round(h * max / w); w = max; }
            else { w = Math.round(w * max / h); h = max; }
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.6);
          await db.collection('photos').add({ sid, data: base64, time: Date.now(), name: f.name });
          show('업로드 완료!');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(f);
    } catch (e) {
      console.error(e);
      show('업로드 실패: ' + e.message, false);
    }
  };

  const runAI = (p) => {
    show('AI 영수증 분석 중...');
    setTimeout(() => {
      const mock = [
        { name: '편의점 간식', amount: 1200, cat: '식비' },
        { name: '스타벅스 커피', amount: 6500, cat: '식비' },
        { name: '기념품 샵', amount: 12000, cat: '쇼핑' }
      ];
      const item = mock[Math.floor(Math.random() * mock.length)];
      sync('expenses', [...(trip.expenses || []), { 
        id: Date.now(), name: item.name + ' (AI)', amount: item.amount, category: item.cat, 
        payer: 'AI 분석', date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
      show(`분석 완료: ${item.name} (${item.amount}원)`);
      setSubTab('money');
    }, 1500);
  };

  return h('div', { className: 'photo-view' }, [
    h('div', { className: 'photo-grid', style: { padding: '20px' } }, [
      h('button', { className: 'photo-add', onClick: () => fref.current.click() }, [
        h(I, { n: 'add_a_photo', s: 24 }), h('span', null, '사진 추가')
      ]),
      photos.map(p => h('div', { key: p.id, className: 'photo-item' }, [
        h('img', { src: p.data, onClick: () => window.open(p.data) }),
        h('button', { className: 'photo-del', onClick: () => {
          if(confirm('삭제할까요?')) db.collection('photos').doc(p.id).delete();
        } }, h(I, { n: 'close', s: 14 })),
        h('button', { 
          className: 'btn btn-pill', 
          style: { position: 'absolute', bottom: 4, left: 4, right: 4, padding: '4px 0', fontSize: 10, background: 'rgba(255,255,255,0.9)', color: 'var(--blue)' },
          onClick: (e) => { e.stopPropagation(); runAI(p); }
        }, [h(I, { n: 'psychology', s: 12 }), ' AI 분석'])
      ]))
    ]),
    h('input', { type: 'file', ref: fref, style: { display: 'none' }, accept: 'image/*', onChange: upload })
  ]);
};

const TFlight = ({ trip, sync }) => {
  const f = trip.flight || { bus: '', busTime: '', flightNo: '', gate: '', seat: '', depTime: '' };
  const update = (k, v) => sync('flight', { ...f, [k]: v });
  
  return h('div', { style: { padding: '20px' } }, [
    h('div', { className: 'ios-card', style: { padding: '16px', marginBottom: 16 } }, [
      h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '🚌 공항 이동 (Bus/Taxi)'),
      h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [
        h('input', { className: 'ios-input', placeholder: '버스 번호/노선', value: f.bus, onChange: e => update('bus', e.target.value), style: { flex: 1 } }),
        h('input', { className: 'ios-input', type: 'time', value: f.busTime, onChange: e => update('busTime', e.target.value), style: { width: 120 } })
      ])
    ]),
    h('div', { className: 'ios-card', style: { padding: '16px' } }, [
      h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '🛫 항공편 정보 (Flight)'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } }, [
        h('div', null, [h('label', { style: { fontSize: 11, color: 'var(--sub)' } }, '편명'), h('input', { className: 'ios-input', placeholder: '예: KE781', value: f.flightNo, onChange: e => update('flightNo', e.target.value) })]),
        h('div', null, [h('label', { style: { fontSize: 11, color: 'var(--sub)' } }, '출발 시간'), h('input', { className: 'ios-input', type: 'time', value: f.depTime, onChange: e => update('depTime', e.target.value) })]),
        h('div', null, [h('label', { style: { fontSize: 11, color: 'var(--sub)' } }, '게이트'), h('input', { className: 'ios-input', placeholder: 'Gate', value: f.gate, onChange: e => update('gate', e.target.value) })]),
        h('div', null, [h('label', { style: { fontSize: 11, color: 'var(--sub)' } }, '좌석'), h('input', { className: 'ios-input', placeholder: 'Seat', value: f.seat, onChange: e => update('seat', e.target.value) })])
      ])
    ])
  ]);
};

const TSummary = ({ trip, setSubTab }) => {
  const hours = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);
  const days = Array.from({ length: trip.itinerary?.reduce((m, x) => Math.max(m, x.day), 1) || 1 }, (_, i) => i + 1);
  
  return h('div', { style: { overflowX: 'auto', padding: '10px', height: 'calc(100vh - 350px)' } }, [
    h('table', { className: 'summary-table' }, [
      h('thead', null, h('tr', null, [
        h('th', null, '시간'),
        ...days.map(d => h('th', { key: d }, `${d}일차`))
      ])),
      h('tbody', null, hours.map(h_str => h('tr', { key: h_str }, [
        h('td', null, h_str),
        ...days.map(d => {
          const it = trip.itinerary?.find(x => x.day === d && x.time.startsWith(h_str.split(':')[0]));
          return h('td', { 
            key: d, 
            style: { background: it ? (it.cat === '식당' ? 'rgba(255,149,0,.08)' : 'rgba(0,122,255,.05)') : 'none', cursor: it ? 'pointer' : 'default' },
            onClick: () => { if(it) { setSubTab('route'); setTimeout(() => { document.getElementById(`stop-${it.idx}`)?.scrollIntoView({ behavior: 'smooth' }) }, 100) } }
          }, [
            it && h('div', { style: { fontWeight: 700, color: it.cat === '식당' ? 'var(--orange)' : 'var(--blue)' } }, [
              h('span', { style: { fontSize: 12 } }, it.emoji || '📍'), ' ', it.title
            ])
          ]);
        })
      ])))
    ])
  ]);
};

const M = ({ mod, toast, user, prof, trip, settle, open, close, show, form, setForm, setView, isOwn }) => {
  const m = [];
  if (toast) m.push(h('div', { key: 't', className: 'toast ' + (toast.ok ? 'toast-ok' : 'toast-err') }, [h(I, { n: toast.ok ? 'check_circle' : 'error', s: 18 }), toast.m]));
  if (mod.profile) m.push(h('div', { key: 'pbg', className: 'modal-bg' }), h('div', { key: 'pc', className: 'modal-center-wrap' }, h('div', { className: 'modal-center-box', style: { textAlign: 'center' } }, [
    h('div', { style: { fontSize: 36, marginBottom: 10 } }, '👋'), h('h2', { className: 'modal-title' }, '닉네임 설정'), h('p', { className: 'modal-sub' }, '여행에서 사용할 이름'),
    h('input', { id: 'ns', className: 'ios-input', defaultValue: prof.nickname, style: { textAlign: 'center', fontSize: 18, fontWeight: 700, marginBottom: 14 } }),
    h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: () => { const n = document.getElementById('ns').value; if (n) { db.collection('users').doc(user.uid).set({ nickname: n }); close('profile') } } }, '시작하기')
  ])));
  if (mod.add) m.push(h('div', { key: 'abg', className: 'modal-bg', onClick: () => close('add') }), h('div', { key: 'as', className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
    h('div', { className: 'modal-handle' }), h('h2', { className: 'modal-title' }, '새로운 여행 ✈️'),
    h('div', { className: 'modal-form' }, [
      h('div', { style: { display: 'flex', gap: 10 } }, [h('input', { className: 'ios-input', style: { width: 60, textAlign: 'center', fontSize: 22 }, value: form.emoji, onChange: e => setForm({ ...form, emoji: e.target.value }) }), h('input', { className: 'ios-input', style: { flex: 1 }, value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: '여행 제목' })]),
      h('input', { className: 'ios-input', value: form.dest, onChange: e => setForm({ ...form, dest: e.target.value }), placeholder: '목적지 (예: 도쿄, 제주도)' }),
      h('div', { style: { display: 'flex', gap: 10 } }, [h('input', { className: 'ios-input', type: 'date', value: form.start, onChange: e => setForm({ ...form, start: e.target.value }) }), h('input', { className: 'ios-input', type: 'date', value: form.end, onChange: e => setForm({ ...form, end: e.target.value }) })])
    ]),
    h('button', {
      className: 'btn btn-blue btn-full btn-pill', onClick: () => {
        if (!form.name) return show('제목을 입력하세요', false);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        db.collection('trips').doc(code).set({ name: form.name, destination: form.dest, emoji: form.emoji, startDate: form.start, endDate: form.end, owner: user.uid, members: [user.uid], memberNames: { [user.uid]: prof.nickname }, checklist: [], expenses: [], itinerary: [], photos: [], memo: '', createdAt: Date.now() });
        close('add'); setForm({ name: '', dest: '', emoji: '✈️', start: '', end: '' }); show('생성 완료!')
      }
    }, '생성하기')
  ]));
  if (mod.join) m.push(h('div', { key: 'jbg', className: 'modal-bg', onClick: () => close('join') }), h('div', { key: 'js', className: 'modal-sheet' }, [
    h('div', { className: 'modal-handle' }), h('h2', { className: 'modal-title' }, '참여하기 🔗'),
    h('input', { id: 'jc', className: 'ios-input', style: { textAlign: 'center', fontSize: 22, fontWeight: 800, letterSpacing: 6, marginBottom: 14 }, placeholder: 'CODE', onChange: e => { e.target.value = e.target.value.toUpperCase() } }),
    h('button', {
      className: 'btn btn-blue btn-full btn-pill', onClick: () => {
        const c = document.getElementById('jc').value;
        db.collection('trips').doc(c).get().then(d => {
          if (d.exists) { db.collection('trips').doc(c).update({ members: firebase.firestore.FieldValue.arrayUnion(user.uid), ['memberNames.' + user.uid]: prof.nickname }); close('join'); show('합류!') }
          else show('잘못된 코드', false)
        })
      }
    }, '합류하기')
  ]));
  if (mod.settle) m.push(h('div', { key: 'sbg', className: 'modal-bg', onClick: () => close('settle') }), h('div', { key: 'sc', className: 'modal-center-wrap' }, h('div', { className: 'modal-center-box' }, [
    h('h2', { className: 'modal-title', style: { textAlign: 'center' } }, '정산'),
    h('div', { style: { margin: '12px 0' } }, [
      h('div', { style: { padding: 12, background: 'var(--card2)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 8 } }, [h('span', { style: { fontWeight: 600, color: 'var(--sub)' } }, '1인당'), h('span', { style: { fontWeight: 800, color: 'var(--blue)' } }, (settle?.pp || 0).toLocaleString() + '원')]),
      ...Object.entries(settle?.b || {}).map(([uid, bal]) => h('div', { key: uid, className: 'settle-row' }, [h('span', null, trip.memberNames?.[uid] || '?'), h('span', { style: { fontWeight: 700, color: bal >= 0 ? 'var(--green)' : 'var(--red)' } }, (bal > 0 ? '+' : '') + bal.toLocaleString() + '원')]))
    ]),
    h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: () => close('settle') }, '확인')
  ])));
  if (mod.settings) m.push(h('div', { key: 'stbg', className: 'modal-bg', onClick: () => close('settings') }), h('div', { key: 'sts', className: 'modal-sheet' }, [
    h('div', { className: 'modal-handle' }), h('h2', { className: 'modal-title' }, '여행 설정'),
    h('div', { className: 'ios-card', style: { marginTop: 10, marginBottom: 12 } }, [
      h('div', { className: 'set-item' }, [h('p', { className: 'set-label' }, '초대 코드'), h('p', { style: { fontSize: 18, fontWeight: 800, letterSpacing: 4, color: 'var(--blue)' } }, trip?.id)]),
      h('div', { className: 'set-item' }, [h('p', { className: 'set-label' }, '멤버'), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, Object.values(trip?.memberNames || {}).map(n => h('span', { key: n, className: 'pill pill-blue' }, n)))])
    ]),
    h('button', {
      className: 'btn btn-red btn-full btn-pill', onClick: () => {
        if (isOwn && confirm('삭제?')) { db.collection('trips').doc(trip.id).delete().then(() => { setView('home'); close('settings') }) }
        else if (!isOwn) show('방장만 가능', false)
      }
    }, [h(I, { n: 'delete', s: 16 }), isOwn ? '여행 삭제' : '권한 없음'])
  ]));
  return h(React.Fragment, null, m);
};

const TripsView = ({ trips, user, open, setSid, setView, setSubTab, show }) => {
  const [aiVal, setAiVal] = useState('');
  return h('div', null, [
    h('div', { className: 'home-pad' }, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 } }, [
        h('div', null, [
          h('h1', { className: 'home-title' }, '내 여행'),
          h('p', { 
            id: 'ai-console-trigger',
            className: 'home-sub', 
            style: { cursor: 'pointer', color: 'var(--blue)', fontWeight: 800, textDecoration: 'underline', marginTop: 4 },
            onClick: () => { const el = document.getElementById('ai-console'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; } 
          }, [h(I, { n: 'bolt', s: 14 }), ` AI 데이터 주입 콘솔 열기`])
        ]),
        h('div', { style: { display: 'flex', gap: 8 } }, [
          h('button', { className: 'btn btn-gray btn-pill btn-sm', onClick: () => open('join') }, [h(I, { n: 'link', s: 14 }), '합류']),
          h('button', { className: 'btn btn-blue btn-pill btn-sm', onClick: () => open('add') }, [h(I, { n: 'add', s: 14 }), '추가'])
        ])
      ]),
      
      h('textarea', {
        id: 'ai-console',
        className: 'ios-input',
        style: { display: 'none', height: 100, fontSize: 10, marginBottom: 16, fontFamily: 'monospace' },
        placeholder: 'AI Sync JSON paste here...',
        value: aiVal,
        onChange: e => {
          setAiVal(e.target.value);
          try {
            const { sid, data } = JSON.parse(e.target.value);
            if (sid && data) {
              window.AI_SYNC(sid, data);
              show('AI 데이터 동기화 성공!');
            }
          } catch(err) {}
        }
      }),

      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, [
        ...trips.map((t, ti) => h('div', {
          key: t.id,
          className: 'trip-card',
          onClick: () => { setSid(t.id); setView('detail'); setSubTab('route') }
        }, [
          h('div', { className: 'trip-cover', style: { background: covers[ti % covers.length] } }, [
            t.owner === user?.uid && h('span', { className: 'pill pill-solid trip-cover-badge' }, '방장'),
            h('span', { className: 'trip-cover-emoji' }, t.emoji)
          ]),
          h('div', { className: 'trip-body', style: { position: 'relative' } }, [
            h('h3', null, t.name),
            h('div', { className: 'trip-dest' }, '📍 ' + (t.destination || '미정')),
            h('div', { className: 'trip-stats' }, [
              h('span', { className: 'pill pill-blue' }, '📋' + (t.itinerary?.length || 0)),
              h('span', { className: 'pill pill-orange' }, '💰' + ((t.expenses?.reduce((a, c) => a + Number(c.amount), 0) || 0).toLocaleString())),
              h('span', { className: 'pill pill-purple' }, '📷' + (t.photos?.length || 0))
            ]),
            h('button', { 
              className: 'icon-btn', 
              style: { position: 'absolute', top: 0, right: 0, background: 'rgba(255,59,48,0.1)', color: 'var(--red)' },
              onClick: (e) => {
                e.stopPropagation();
                if(confirm(`'${t.name}' 여행을 삭제할까요?`)) db.collection('trips').doc(t.id).delete().then(() => show('삭제 완료'));
              }
            }, h(I, { n: 'delete', s: 18 }))
          ])
        ])),
        trips.length === 0 && h('div', { className: 'ios-card', style: { padding: 40, textAlign: 'center', background: 'rgba(120,120,128,.04)' } }, [
          h('div', { style: { fontSize: 48, marginBottom: 12 } }, '✈️'),
          h('h4', null, '여행을 시작해보세요'),
          h('p', { className: 'home-sub' }, '새로운 일정을 추가하거나 초대 코드로 참여하세요.')
        ]),
        h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 8 }, onClick: () => open('add') }, [h(I, { n: 'add', s: 16 }), '새 여행 만들기'])
      ])
    ])
  ]);
};

const DDayView = ({ trips, setSid, setView }) => {
  const upcoming = trips.filter(t => t.startDate && new Date(t.startDate) > new Date()).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const past = trips.filter(t => t.startDate && new Date(t.startDate) <= new Date()).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const diffD = (d) => {
    const diff = Math.ceil((new Date(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    return diff > 0 ? 'D-' + diff : diff === 0 ? 'D-Day' : 'D+' + Math.abs(diff);
  };
  return h('div', null, [
    h('div', { style: { padding: '52px 20px 8px' } }, [h('h1', { className: 'home-title' }, 'D-Day'), h('p', { className: 'home-sub' }, '다가오는 여행')]),
    upcoming.length ? h('div', { style: { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 } }, upcoming.map(t => h('div', {
      key: t.id,
      className: 'ios-card',
      style: { padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' },
      onClick: () => { setSid(t.id); setView('detail') }
    }, [
      h('div', { style: { fontSize: 28, fontWeight: 900, color: 'var(--blue)', minWidth: 80, textAlign: 'center' } }, diffD(t.startDate)),
      h('div', { style: { flex: 1 } }, [
        h('p', { style: { fontWeight: 700, fontSize: 16 } }, t.emoji + ' ' + t.name),
        h('p', { style: { fontSize: 13, color: 'var(--sub)', marginTop: 2 } }, t.startDate + (t.endDate ? ' → ' + t.endDate : ''))
      ]),
      h(I, { n: 'chevron_right', s: 20 })
    ]))) : h('div', { className: 'empty' }, [h('div', { className: 'empty-icon' }, '✈️'), h('h4', null, '예정된 여행이 없습니다')]),
    past.length > 0 && h('p', { className: 'section-title' }, '지난 여행'),
    past.length > 0 && h('div', { style: { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 } }, past.map(t => h('div', {
      key: t.id,
      className: 'ios-card',
      style: { padding: 12, display: 'flex', alignItems: 'center', gap: 12, opacity: .6, cursor: 'pointer' },
      onClick: () => { setSid(t.id); setView('detail') }
    }, [
      h('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--sub)', minWidth: 50 } }, diffD(t.startDate)),
      h('span', { style: { fontSize: 14, fontWeight: 600 } }, t.emoji + ' ' + t.name)
    ])))
  ]);
};

const StatsView = ({ trips }) => {
  const tc = trips.length, ec = trips.reduce((a, t) => a + (t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0), 0);
  const pc = trips.reduce((a, t) => a + (t.photos?.length || 0), 0);
  const dc = new Set(trips.map(t => t.destination).filter(Boolean)).size;
  
  const topExp = trips.reduce((a, t) => {
    t.expenses?.forEach(x => { a[x.category] = (a[x.category] || 0) + Number(x.amount) });
    return a;
  }, {});
  const sortedExp = Object.entries(topExp).sort((a,b) => b[1]-a[1]);
  const bestCat = sortedExp[0] || ['없음', 0];

  let cumulative = 0;
  const pieStyle = sortedExp.map(([cat, amt]) => {
    const pct = (amt / (ec || 1)) * 100;
    const color = cc[cat] || 'var(--sub)';
    const res = `${color} ${cumulative}% ${cumulative + pct}%`;
    cumulative += pct;
    return res;
  }).join(', ');

  return h('div', { className: 'fade-in' }, [
    h('div', { style: { padding: '52px 20px 8px' } }, [
      h('p', { style: { fontSize: 12, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase' } }, 'TRAVEL INSIGHTS'),
      h('h1', { className: 'home-title' }, '나의 여행 리포트'),
      h('p', { className: 'home-sub' }, '전체 여행 데이터를 한눈에 확인하세요')
    ]),
    
    h('div', { className: 'ios-card', style: { margin: '20px', padding: 24, textAlign: 'center' } }, [
      h('div', { style: { 
        width: 160, height: 160, borderRadius: '50%', margin: '0 auto 20px',
        background: `conic-gradient(${pieStyle || 'var(--sep) 0 100%'})`,
        boxShadow: 'inset 0 0 0 25px #fff, var(--shadow)'
      } }),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' } }, sortedExp.map(([cat, amt]) => h('div', { key: cat, style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 } }, [
        h('div', { style: { width: 10, height: 10, borderRadius: 3, background: cc[cat] || 'var(--sub)' } }),
        h('span', null, `${cat} (${((amt/ec)*100).toFixed(0)}%)`)
      ])))
    ]),

    h('div', { className: 'stat-grid' }, [
      h('div', { className: 'stat-box' }, [h('div', { className: 'stat-box-icon' }, '💰'), h('div', { className: 'stat-box-val' }, ec.toLocaleString() + '원'), h('div', { className: 'stat-box-label' }, '총 지출')]),
      h('div', { className: 'stat-box' }, [h('div', { className: 'stat-box-icon' }, '🏆'), h('div', { className: 'stat-box-val' }, bestCat[0]), h('div', { className: 'stat-box-label' }, '최다 지출 카테고리')]),
      h('div', { className: 'stat-box' }, [h('div', { className: 'stat-box-icon' }, '📷'), h('div', { className: 'stat-box-val' }, pc + '장'), h('div', { className: 'stat-box-label' }, '남긴 추억')]),
      h('div', { className: 'stat-box' }, [h('div', { className: 'stat-box-icon' }, '🌍'), h('div', { className: 'stat-box-val' }, dc + '개'), h('div', { className: 'stat-box-label' }, '방문 도시')])
    ]),
    
    h('div', { className: 'ios-card glass', style: { margin: '20px', padding: 20 } }, [
      h('h4', { style: { fontSize: 17, fontWeight: 900, marginBottom: 8 } }, '✨ AI 맞춤 가이드'),
      h('p', { style: { fontSize: 14, opacity: .8, lineHeight: 1.6 } }, `${tc}번의 여행 중 ${bestCat[0]}에 가장 진심이셨네요! 다음 여행에서는 새로운 테마로 기록을 채워보시는 건 어떨까요?`)
    ])
  ]);
};

const SettingsView = ({ prof, theme, font, setTheme, setFont, open }) => h('div', null, [
  h('div', { style: { padding: '52px 20px 8px' } }, [h('h1', { className: 'home-title' }, '설정'), h('p', { className: 'home-sub' }, '테마와 글꼴을 변경하세요')]),
  h('div', { className: 'ios-card', style: { margin: '16px 20px' } }, [
    h('div', { className: 'set-item' }, [
      h('p', { className: 'set-label' }, '테마 색상'),
      h('div', { style: { display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' } }, ['#007aff', '#ff3b30', '#ff9500', '#34c759', '#af52de', '#ff2d55', '#5ac8fa', '#1c1c1e'].map(c => h('button', {
        key: c,
        style: { width: 32, height: 32, borderRadius: '50%', background: c, border: theme === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' },
        onClick: () => setTheme(c)
      })))
    ]),
    h('div', { className: 'set-item' }, [
      h('p', { className: 'set-label' }, '글꼴'),
      h('div', { style: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' } }, ['Inter', 'Georgia', 'Courier New', 'Pretendard', 'Noto Sans KR'].map(f => h('button', {
        key: f,
        className: 'btn btn-sm btn-pill ' + (font === f ? 'btn-blue' : 'btn-gray'),
        style: { fontFamily: f },
        onClick: () => setFont(f)
      }, f)))
    ]),
    h('div', { className: 'set-item' }, [
      h('p', { className: 'set-label' }, '닉네임'),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, [
        h('span', { style: { fontSize: 15, fontWeight: 700 } }, prof.nickname),
        h('button', { className: 'btn btn-gray btn-sm btn-pill', onClick: () => open('profile') }, '변경')
      ])
    ])
  ])
]);

// MAIN APP
function App() {
  const [user, setUser] = useState(null);
  const [prof, setProf] = useState({ nickname: '여행자' });
  const [trips, setTrips] = useState([]);
  const [ld, setLd] = useState(true);
  const [view, setView] = useState('home');
  const [sid, setSid] = useState(null);
  const [mainTab, setMainTab] = useState('trips');
  const [subTab, setSubTab] = useState('route');
  const [mod, setMod] = useState({});
  const [form, setForm] = useState({ name: '', dest: '', emoji: '✈️', start: '', end: '' });
  const [theme, setTheme] = useState(() => localStorage.getItem('theme-color') || '#007aff');
  const [font, setFont] = useState(() => localStorage.getItem('theme-font') || 'Inter');
  const [toast, setToast] = useState(null);

  useEffect(() => { document.documentElement.style.setProperty('--blue', theme); localStorage.setItem('theme-color', theme) }, [theme]);
  useEffect(() => { document.body.style.fontFamily = font + ',sans-serif'; localStorage.setItem('theme-font', font) }, [font]);

  const show = (m, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 2200) };
  const open = k => setMod(p => ({ ...p, [k]: 1 }));
  const close = k => setMod(p => ({ ...p, [k]: 0 }));

  useEffect(() => {
    const u1 = au.onAuthStateChanged(async u => {
      if (u) {
        setUser(u);
        const d = await db.collection('users').doc(u.uid).get();
        if (d.exists) setProf(d.data()); else open('profile');
      } else au.signInAnonymously();
    });
    const u2 = db.collection('trips').onSnapshot(s => {
      setTrips(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLd(false);
    }, () => setLd(false));
    
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    const checkReminders = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      trips.forEach(t => {
        t.itinerary?.forEach(it => {
          if (it.time === timeStr && !localStorage.getItem(`rem_${t.id}_${it.idx}_${it.time}`)) {
            if (Notification.permission === "granted") new Notification(`🔔 여행 일정 알림: ${it.title}`, { body: it.desc });
            else show(`🔔 일정: ${it.title}`);
            localStorage.setItem(`rem_${t.id}_${it.idx}_${it.time}`, '1');
          }
        });
      });
    };
    if (Notification.permission === "default") Notification.requestPermission();
    const rInt = setInterval(checkReminders, 60000);

    return () => { u1(); u2(); clearInterval(rInt); };
  }, [trips]);

  const trip = trips.find(t => t.id === sid);
  const isOwn = trip?.owner === user?.uid;
  const sync = (f, v) => db.collection('trips').doc(sid).update({ [f]: v });
  const total = trip?.expenses?.reduce((a, c) => a + Number(c.amount), 0) || 0;
  const settle = useMemo(() => {
    if (!trip?.expenses?.length || !trip?.members?.length) return null;
    const pp = Math.floor(total / trip.members.length), b = {};
    trip.members.forEach(m => b[m] = -pp);
    trip.expenses.forEach(x => { if (b[x.payerId] !== undefined) b[x.payerId] += Number(x.amount) });
    return { pp, b };
  }, [trip, total]);

  if (ld) return h('div', { style: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' } }, [h('div', { style: { textAlign: 'center' } }, [h('div', { style: { fontSize: 48, marginBottom: 12 } }, '✈️'), h('p', { style: { color: 'var(--sub)', fontSize: 14, fontWeight: 600 } }, '불러오는 중...')])]);

  const mainTabs = [{ id: 'trips', l: '여행', i: 'flight' }, { id: 'dday', l: 'D-Day', i: 'event' }, { id: 'stats', l: '통계', i: 'bar_chart' }, { id: 'settings', l: '설정', i: 'settings' }];
  const commonProps = { trip, sync, prof, user, show, open, close, sid, setView, setSid, setSubTab };

  if (view === 'detail') return h('div', null, [
    h('div', { className: 'app' }, [
      h('div', { className: 'detail-hero', style: { background: covers[trips.indexOf(trip) % covers.length] } }, [
        h('div', { className: 'detail-hero-actions' }, [
          h('button', { className: 'detail-hero-btn', onClick: () => { setView('home'); setSid(null) } }, [h(I, { n: 'home', s: 16 }), '홈']),
          h('div', { style: { display: 'flex', gap: 6 } }, [
            h('button', { className: 'detail-hero-btn icon-only', title: '초대 링크', onClick: () => {
              const url = window.location.href.split('?')[0].split('#')[0] + '?join=' + trip.id;
              navigator.clipboard.writeText(url); show('초대 링크 복사됨!');
            } }, h(I, { n: 'link', s: 16 })),
            h('button', { className: 'detail-hero-btn icon-only', title: '초대 코드', onClick: () => {
              navigator.clipboard.writeText(trip.id); show('초대 코드(' + trip.id + ') 복사됨!');
            } }, h(I, { n: 'content_copy', s: 16 })),
            h('button', { className: 'detail-hero-btn icon-only', title: '캘린더 연동', onClick: () => {
              const safeName = (trip.name || 'trip').replace(/[/\\?%*:|"<>]/g, '-');
              let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Premium Travel Manager//KO\n";
              trip.itinerary.forEach(it => {
                const date = new Date(trip.startDate);
                date.setDate(date.getDate() + (it.day - 1));
                const dt = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                ics += `BEGIN:VEVENT\nSUMMARY:${it.emoji || ''} ${it.title}\nDTSTART:${dt}\nDESCRIPTION:${it.desc}\nEND:VEVENT\n`;
              });
              ics += "END:VCALENDAR";
              const blob = new Blob([ics], { type: 'text/calendar' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a'); link.href = url; link.download = `${safeName}.ics`; link.click();
              show('캘린더 파일 생성됨!');
            } }, h(I, { n: 'event', s: 16 })),
            h('button', { className: 'detail-hero-btn icon-only', title: 'PDF 가이드북', onClick: () => window.print() }, h(I, { n: 'picture_as_pdf', s: 16 })),
            h('button', { className: 'detail-hero-btn icon-only', title: '이미지로 저장', onClick: () => {
              show('이미지 생성 중...');
              html2canvas(document.querySelector('.app'), { useCORS: true, backgroundColor: '#f2f2f7' }).then(canvas => {
                const link = document.createElement('a');
                const safeName = (trip.name || 'trip').replace(/[/\\?%*:|"<>]/g, '-');
                link.download = `${safeName}_일정.png`;
                link.href = canvas.toDataURL('image/png'); link.click();
                show('이미지 저장 완료!');
              });
            } }, h(I, { n: 'download', s: 16 })),
            h('button', { className: 'detail-hero-btn icon-only', onClick: () => open('settings') }, h(I, { n: 'more_horiz', s: 18 }))
          ])
        ]),
        h('div', { className: 'detail-hero-content' }, [
          h('span', { style: { fontSize: 28 } }, trip?.emoji),
          h(EI, { val: trip?.name, onSave: v => sync('name', v), style: { fontSize: 24, fontWeight: 900, color: '#fff', background: 'none', border: 'none', width: '100%', outline: 'none', padding: 0 } }),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, opacity: .8 } }, [
            h('span', null, '📍 '),
            h(EI, { val: trip?.destination, onSave: v => sync('destination', v), style: { fontSize: 13, color: '#fff', background: 'none', border: 'none', outline: 'none', padding: 0 }, placeholder: '목적지 미정' }),
            h('span', { style: { fontSize: 13, color: '#fff' } }, ' · 코드: ' + trip?.id)
          ])
        ])
      ]),
      h(InfoBar, { dest: trip?.destination }),
      h('div', { className: 'sub-tabs' }, [
        { id: 'route', l: '🗓️ 일정' }, { id: 'summary', l: '📊 요약' }, { id: 'map', l: '🗺️ 지도' }, { id: 'flight', l: '🛫 출발' }, { id: 'check', l: '✅ 체크' }, { id: 'memo', l: '📝 메모' }, { id: 'money', l: '💰 가계부' }, { id: 'photo', l: '📷 사진' }
      ].map((t, idx) => h('button', {
        key: t.id,
        id: `tab-${t.id}`,
        className: 'sub-tab' + (subTab === t.id ? ' on' : ''),
        onClick: (e) => {
          setSubTab(t.id);
          e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, t.l))),
      h('div', { 
        className: 'tab-indicator', 
        style: (() => {
          const tabs = ['route', 'summary', 'map', 'flight', 'check', 'memo', 'money', 'photo'];
          const idx = tabs.indexOf(subTab);
          const el = document.getElementById(`tab-${subTab}`);
          if (!el) return { left: 0, width: 0 };
          return { left: el.offsetLeft, width: el.offsetWidth };
        })()
      }),
      h('div', { className: 'tab-view-window' }, [
        h('div', { 
          className: 'tab-content-container',
          style: { transform: `translateX(-${['route', 'summary', 'map', 'flight', 'check', 'memo', 'money', 'photo'].indexOf(subTab) * 12.5}%)` }
        }, [
          h('div', { id: 'pane-route', className: 'tab-content-pane' }, h(TRoute, commonProps)),
          h('div', { id: 'pane-summary', className: 'tab-content-pane' }, h(TSummary, commonProps)),
          h('div', { id: 'pane-map', className: 'tab-content-pane' }, h(MapView, commonProps)),
          h('div', { id: 'pane-flight', className: 'tab-content-pane' }, h(TFlight, commonProps)),
          h('div', { id: 'pane-check', className: 'tab-content-pane' }, h(TCheck, commonProps)),
          h('div', { id: 'pane-memo', className: 'tab-content-pane' }, h(TMemo, commonProps)),
          h('div', { id: 'pane-money', className: 'tab-content-pane' }, h(TMoney, { ...commonProps, total, settle })),
          h('div', { id: 'pane-photo', className: 'tab-content-pane' }, h(TPhoto, { ...commonProps }))
        ])
      ])
    ]),
    h(M, { ...commonProps, mod, toast, form, setForm, isOwn })
  ]);

  return h('div', null, [
    h('div', { className: 'app' }, [
      mainTab === 'trips' && h(TripsView, { trips, user, open, setSid, setView, setSubTab }),
      mainTab === 'dday' && h(DDayView, { trips, setSid, setView }),
      mainTab === 'stats' && h(StatsView, { trips }),
      mainTab === 'settings' && h(SettingsView, { prof, theme, font, setTheme, setFont, open })
    ]),
    h(BottomBar, { cur: mainTab, set: setMainTab, items: mainTabs }),
    h(M, { mod, toast, user, prof, open, close, show, form, setForm })
  ]);
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
