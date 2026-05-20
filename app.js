const { useState, useEffect, useMemo, useRef } = React;
const h = React.createElement;

// Configs
const cfg = {
  apiKey: "AIzaSyCS_AKLu7A0v-KwW-mZQyTjBTqnVe6vdks",
  authDomain: "travel-app-2758e.firebaseapp.com",
  projectId: "travel-app-2758e",
  storageBucket: "travel-app-2758e.firebasestorage.app",
  messagingSenderId: "418586873034",
  appId: "1:418586873034:web:c6ea8b1236c2a5b2d0b833"
};
const W_KEY = "8f0376374092b3c2e1762c2f6d0f590b";

if (!firebase.apps.length) firebase.initializeApp(cfg);
const db = firebase.firestore(), au = firebase.auth();

// Utils
const getDDay = (d) => {
  if (!d) return '';
  const diff = new Date(d) - new Date().setHours(0,0,0,0);
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days === 0 ? 'D-Day' : (days > 0 ? `D-${days}` : `D+${Math.abs(days)}`);
};

window.AI_SYNC = (sid, data, user, prof) => {
  console.log('AI Syncing:', sid);
  if (!sid || !data) return;
  const docRef = db.collection('trips').doc(sid);
  const updateData = { ...data };
  if (user) {
    updateData.members = firebase.firestore.FieldValue.arrayUnion(user.uid);
    updateData[`memberNames.${user.uid}`] = prof?.nickname || '여행자';
    if (!updateData.owner) updateData.owner = user.uid;
  }
  return docRef.set(updateData, { merge: true }).then(() => location.reload());
};

// UI Elements
const I = ({ n, s = 20, style }) => h('span', { className: 'mi', style: { fontSize: s, ...style } }, n);
const ci = { '식비': '🍽️', '교통': '🚕', '숙박': '🏨', '쇼핑': '🛍️', '기타': '📦' };
const cc = { '식비': '#ff9500', '교통': '#007aff', '숙박': '#34c759', '쇼핑': '#af52de', '기타': '#8e8e93' };
const covers = ['linear-gradient(135deg,#667eea,#764ba2)','linear-gradient(135deg,#f093fb,#f5576c)','linear-gradient(135deg,#4facfe,#00f2fe)','linear-gradient(135deg,#43e97b,#38f9d7)','linear-gradient(135deg,#fa709a,#fee140)'];

const WeatherWidget = ({ city }) => {
  const [w, setW] = useState(null);
  useEffect(() => {
    if (!city) return;
    const clean = city.split(',')[0].trim();
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${clean}&units=metric&appid=${W_KEY}`)
      .then(r => r.json()).then(d => d.main && setW(d)).catch(() => {});
  }, [city]);
  if (!w) return null;
  return h('div', { className: 'info-item weather-chip' }, [h(I, { n: 'wb_cloudy', s: 14 }), h('span', null, `${Math.round(w.temp)}°C (${city.split(',')[0]})`)]);
};

const InfoBar = ({ trip }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, []);
  return h('div', { className: 'info-bar' }, [
    h('div', { className: 'info-item' }, [h(I, { n: 'schedule', s: 14 }), h('span', null, time.toLocaleTimeString('ko-KR', { hour12: false }))]),
    h(WeatherWidget, { city: trip?.destination }),
    h('div', { className: 'info-item', style: { marginLeft: 'auto', color: 'var(--blue)' } }, [h('span', { style: { fontWeight: 900 } }, getDDay(trip?.startDate))])
  ]);
};

const RouteMap = ({ trip }) => {
  const r = useRef();
  useEffect(() => {
    if (!r.current || !trip) return;
    const m = L.map(r.current, { zoomControl: false }).setView([35.68, 139.76], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(m);
    const itin = (trip.itinerary || []).filter(x => x.lat && x.lng).sort((a,b)=>a.day-b.day || a.time.localeCompare(b.time));
    if (itin.length > 0) {
      const pts = itin.map(x => [x.lat, x.lng]);
      L.polyline(pts, { color: 'var(--blue)', weight: 3, opacity: 0.5, dashArray: '5, 10' }).addTo(m);
      itin.forEach((it, i) => L.marker([it.lat, it.lng], { icon: L.divIcon({ className: 'map-dot', html: `<span>${i+1}</span>` }) }).addTo(m));
      m.fitBounds(pts, { padding: [40, 40] });
    }
    return () => m.remove();
  }, [trip]);
  return h('div', { className: 'ios-card', style: { margin: '0 20px 16px', height: 220, overflow: 'hidden' } }, [h('div', { ref: r, style: { width: '100%', height: '100%' } })]);
};

const TRoute = ({ trip, sync, show }) => {
  const [itin, setItin] = useState(trip.itinerary || []);
  const [editIdx, setEditIdx] = useState(null);
  const [editData, setEditData] = useState({});
  useEffect(() => { setItin(trip.itinerary || []) }, [trip.itinerary]);
  const addStop = (d) => { const newItem = { idx: itin.length, day: d, time: '12:00', title: '', desc: '', emoji: '📍' }; setEditIdx(newItem.idx); setEditData(newItem); setItin([...itin, newItem]); };
  const saveItem = () => { const n = [...itin]; const targetIdx = n.findIndex(x => x.idx === editIdx); if (targetIdx > -1) n[targetIdx] = editData; sync('itinerary', n.sort((a,b)=>a.day-b.day || a.time.localeCompare(b.time))); setEditIdx(null); show('저장 완료!'); };
  const days = Array.from({ length: Math.max(1, ...itin.map(x => x.day)) }, (_, i) => i + 1);
  return h('div', { style: { padding: '0 20px 100px' } }, [
    h(RouteMap, { trip }),
    days.map(d => h('div', { key: d, className: 'day-section' }, [
      h('div', { className: 'day-header' }, [h('span', { className: 'day-num' }, `Day ${d}`), h('button', { className: 'btn btn-blue btn-sm btn-pill', onClick: () => addStop(d) }, '+ 일정 등록')]),
      itin.filter(x => x.day === d).sort((a,b)=>a.time.localeCompare(b.time)).map(it => h('div', { key: it.idx, className: 'stop-card glass' + (editIdx === it.idx ? ' editing' : '') }, [
        editIdx === it.idx ? h('div', null, [
          h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [h('input', { type: 'time', className: 'ios-input', value: editData.time, onChange: e => setEditData({...editData, time: e.target.value}), style: { flex: 1, padding: '14px 8px' } }), h('input', { className: 'ios-input', value: editData.emoji, onChange: e => setEditData({...editData, emoji: e.target.value}), style: { width: 60, textAlign: 'center' } })]),
          h('input', { className: 'ios-input', value: editData.title, onChange: e => setEditData({...editData, title: e.target.value}), placeholder: '장소 또는 활동명', style: { marginBottom: 10, fontWeight: 800 } }),
          h('div', { style: { display: 'flex', gap: 8 } }, [h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: saveItem }, '등록/저장'), h('button', { className: 'btn btn-gray btn-pill', onClick: () => { setEditIdx(null); setItin(trip.itinerary || []) } }, '취소')])
        ]) : h('div', { style: { display: 'flex', gap: 12 }, onClick: () => { setEditIdx(it.idx); setEditData(it); } }, [
          h('div', { style: { textAlign: 'center', minWidth: 50 } }, [h('div', { style: { fontSize: 14, fontWeight: 900, color: 'var(--blue)' } }, it.time), h('div', { style: { fontSize: 22, marginTop: 4 } }, it.emoji || '📍')]),
          h('div', { style: { flex: 1 } }, [h('div', { style: { fontSize: 17, fontWeight: 800 } }, it.title || '새 일정'), h('div', { style: { fontSize: 12, color: 'var(--sub)' } }, it.desc || '내용 입력')])
        ])
      ]))
    ]))
  ]);
};

const TFlight = ({ trip, sync, show }) => {
  const [f, setF] = useState(trip.flight || { bus: '', busTime: '', flightNo: '', depTime: '', rBus: '', rBusTime: '', rFlightNo: '', rDepTime: '' });
  useEffect(() => { setF(trip.flight || { bus: '', busTime: '', flightNo: '', depTime: '', rBus: '', rBusTime: '', rFlightNo: '', rDepTime: '' }) }, [trip.flight]);
  const save = () => { sync('flight', f); show('교통 정보 저장 완료!'); };
  const tStyle = { width: 145, padding: '14px 10px', fontSize: 15, fontWeight: 800 };
  return h('div', { style: { padding: '20px 20px 100px' } }, [
    h('div', { className: 'ios-card', style: { padding: '16px', marginBottom: 16 } }, [
      h('h3', { style: { fontSize: 15, fontWeight: 800, marginBottom: 12 } }, '🛫 가는 편 (Departure)'),
      h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [h('input', { className: 'ios-input', placeholder: '공항 버스', value: f.bus, onChange: e => setF({...f, bus: e.target.value}), style: { flex: 1 } }), h('input', { className: 'ios-input', type: 'time', value: f.busTime, onChange: e => setF({...f, busTime: e.target.value}), style: tStyle })]),
      h('div', { style: { display: 'flex', gap: 10 } }, [h('input', { className: 'ios-input', placeholder: '항공편명', value: f.flightNo, onChange: e => setF({...f, flightNo: e.target.value}), style: { flex: 1 } }), h('input', { className: 'ios-input', type: 'time', value: f.depTime, onChange: e => setF({...f, depTime: e.target.value}), style: tStyle })])
    ]),
    h('div', { className: 'ios-card', style: { padding: '16px', marginBottom: 16 } }, [
      h('h3', { style: { fontSize: 15, fontWeight: 800, marginBottom: 12 } }, '🛬 오는 편 (Return)'),
      h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [h('input', { className: 'ios-input', placeholder: '공항 버스', value: f.rBus, onChange: e => setF({...f, rBus: e.target.value}), style: { flex: 1 } }), h('input', { className: 'ios-input', type: 'time', value: f.rBusTime, onChange: e => setF({...f, rBusTime: e.target.value}), style: tStyle })]),
      h('div', { style: { display: 'flex', gap: 10 } }, [h('input', { className: 'ios-input', placeholder: '항공편명', value: f.rFlightNo, onChange: e => setF({...f, rFlightNo: e.target.value}), style: { flex: 1 } }), h('input', { className: 'ios-input', type: 'time', value: f.rDepTime, onChange: e => setF({...f, rDepTime: e.target.value}), style: tStyle })])
    ]),
    h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: save }, '✈️ 항공 및 교통 정보 저장하기')
  ]);
};

const TMoney = ({ trip, sync, total, open }) => {
  const [rates, setRates] = useState({ JPY: 0, EUR: 0, USD: 0 });
  useEffect(() => { fetch('https://open.er-api.com/v6/latest/KRW').then(r => r.json()).then(d => d.rates && setRates({ JPY: 1/d.rates.JPY*100, EUR: 1/d.rates.EUR, USD: 1/d.rates.USD })); }, []);
  const cats = (trip.expenses || []).reduce((a, x) => { a[x.category] = (a[x.category] || 0) + Number(x.amount); return a }, {});
  return h('div', { style: { padding: 20 } }, [
    h('div', { className: 'ios-card', style: { padding: 16, marginBottom: 16, display: 'flex', gap: 15, fontSize: 11, fontWeight: 800, color: 'var(--blue)' } }, [h('span', null, `🇯🇵 100¥ ≈ ${Math.round(rates.JPY)}원`), h('span', null, `🇪🇺 1€ ≈ ${Math.round(rates.EUR)}원`), h('span', null, `🇺🇸 1$ ≈ ${Math.round(rates.USD)}원`)]),
    h('div', { className: 'ios-card', style: { padding: 24, textAlign: 'center', background: 'var(--blue)', color: '#fff', marginBottom: 16 } }, [h('p', { style: { fontSize: 13, opacity: 0.8 } }, '총 지출'), h('h2', { style: { fontSize: 36, fontWeight: 900 } }, total.toLocaleString() + '원')]),
    h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginBottom: 20 }, onClick: () => open('expense') }, '+ 지출 추가 등록'),
    h('div', { className: 'ios-card' }, (trip.expenses || []).reverse().map((x, i) => h('div', { key: i, style: { padding: 14, borderBottom: '1px solid var(--sep)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
      h('div', null, [h('p', { style: { fontWeight: 800, fontSize: 15 } }, x.title), h('p', { style: { fontSize: 11, color: 'var(--sub)' } }, `${x.category} | ${x.date || ''}`)]),
      h('p', { style: { fontWeight: 900, color: 'var(--red)', fontSize: 16 } }, Number(x.amount).toLocaleString() + '원')
    ])))
  ]);
};

const TCheck = ({ trip, sync }) => {
  const getAIItems = () => {
    const d = trip.destination || '';
    const base = ['보조배터리', '상비약', '충전기'];
    if (d.includes('일본')) return [...base, '110V 어댑터', '동전지갑', '심카드/eSIM'];
    if (d.includes('유럽') || d.includes('이태리')) return [...base, '소매치기 방지끈', '유로 환전', '편한 운동화'];
    return [...base, '우산', '간식'];
  };
  return h('div', { style: { padding: 20 } }, [
    h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginBottom: 16 }, onClick: () => sync('checklist', [...(trip.checklist || []), ...getAIItems().map(x => ({ item: x, done: false }))]) }, [h(I, { n: 'auto_awesome', s: 16 }), ' AI 여행지 맞춤 준비물 추천']),
    h('div', { className: 'ios-card', style: { padding: 16 } }, [
      (trip.checklist || []).map((x, i) => h('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--sep)' } }, [
        h('input', { type: 'checkbox', checked: x.done, onChange: () => { const n = [...trip.checklist]; n[i].done = !n[i].done; sync('checklist', n) } }),
        h('span', { style: { flex: 1, textDecoration: x.done ? 'line-through' : 'none', opacity: x.done ? 0.5 : 1 } }, x.item)
      ])),
      h('input', { className: 'ios-input', style: { marginTop: 12 }, placeholder: '새 항목 추가...', onKeyDown: e => { if(e.key === 'Enter' && e.target.value) { sync('checklist', [...(trip.checklist || []), { item: e.target.value, done: false }]); e.target.value = '' } } })
    ])
  ]);
};

const TripsView = ({ trips, user, open, setSid, setView, setSubTab, show, prof }) => {
  const [aiVal, setAiVal] = useState('');
  const del = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Delete Clicked:', t.id);
    if (confirm(`[${t.name}] 여행을 정말 삭제하시겠습니까?`)) {
      db.collection('trips').doc(t.id).delete().then(() => show('삭제되었습니다.')).catch(err => console.error(err));
    }
  };
  return h('div', { className: 'home-pad' }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 20 } }, [
      h('div', null, [h('h1', { className: 'home-title' }, '내 여행'), h('p', { className: 'home-sub', onClick: () => { const el = document.getElementById('ai-box'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; } }, [h(I, { n: 'bolt', s: 14 }), ' AI 주입 콘솔'])]),
      h('button', { className: 'btn btn-blue btn-pill btn-sm', onClick: () => open('add') }, '추가')
    ]),
    h('div', { id: 'ai-box', style: { display: 'none', marginBottom: 20 } }, [
      h('textarea', { className: 'ios-input', style: { height: 100, fontSize: 11 }, placeholder: 'JSON 붙여넣기...', value: aiVal, onChange: e => setAiVal(e.target.value) }),
      h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 10 }, onClick: () => { try { const d = JSON.parse(aiVal); window.AI_SYNC(d.sid || Math.random().toString(36).substr(2,8), d.data || d, user, prof); } catch(e) { alert('실패'); } } }, '데이터 주입 실행')
    ]),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, trips.map(t => h('div', { key: t.id, className: 'trip-card', style: { position: 'relative' }, onClick: () => { setSid(t.id); setView('detail'); setSubTab('route') } }, [
      h('div', { className: 'trip-cover', style: { background: covers[trips.indexOf(t) % covers.length] } }, [h('span', { className: 'trip-cover-emoji' }, t.emoji || '✈️')]),
      h('div', { className: 'trip-body' }, [
        h('h3', null, t.name),
        h('div', { className: 'trip-dest', style: { display: 'flex', justifyContent: 'space-between' } }, [h('span', null, '📍 ' + (t.destination || '미정')), h('span', { style: { color: 'var(--blue)', fontWeight: 800 } }, getDDay(t.startDate))])
      ]),
      h('button', { className: 'icon-btn del-trigger', style: { position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.9)', borderRadius: '12px', padding: '8px', zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'flex' }, onClick: (e) => del(e, t) }, h(I, { n: 'delete', s: 22, style: { color: 'var(--red)' } }))
    ])))
  ]);
};

const StatsView = ({ trips }) => {
  const [selId, setSelId] = useState(null);
  const totalExp = trips.reduce((a, t) => a + (t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0), 0);
  const cats = trips.reduce((a, t) => { t.expenses?.forEach(x => a[x.category] = (a[x.category] || 0) + Number(x.amount)); return a }, {});
  const selTrip = trips.find(t => t.id === selId);
  const selExp = selTrip?.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0;
  const selCats = selTrip?.expenses?.reduce((a, x) => { a[x.category] = (a[x.category] || 0) + Number(x.amount); return a }, {}) || {};
  return h('div', { style: { padding: '52px 20px 100px' } }, [
    h('h1', { className: 'home-title' }, '통계 리포트'),
    h('div', { className: 'ios-card', style: { padding: 24, textAlign: 'center', marginTop: 20, background: 'var(--blue)', color: '#fff' } }, [h('p', null, '누적 총 지출'), h('h2', { style: { fontSize: 32, fontWeight: 900 } }, totalExp.toLocaleString() + '원')]),
    h('h3', { style: { marginTop: 24, marginBottom: 12, fontWeight: 800 } }, '🏨 여행별 지출 비중'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, trips.map(t => {
      const exp = t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0;
      const pct = totalExp ? Math.round((exp/totalExp)*100) : 0;
      return h('div', { key: t.id }, [
        h('button', { className: 'ios-card stats-btn', style: { width: '100%', padding: 16, display: 'flex', justifyContent: 'space-between', border: selId === t.id ? '2px solid var(--blue)' : 'none', background: '#fff', fontSize: 16 }, onClick: () => { console.log('Stats Clicked:', t.id); setSelId(selId === t.id ? null : t.id); } }, [h('span', { style: { fontWeight: 700 } }, t.name), h('span', { style: { fontWeight: 800, color: 'var(--blue)' } }, `${exp.toLocaleString()}원 (${pct}%)`)]),
        selId === t.id && h('div', { style: { padding: '12px 16px', background: 'rgba(0,0,0,0.03)', borderRadius: 12, marginTop: 4 } }, Object.entries(selCats).map(([k,v]) => {
          const sPct = selExp ? Math.round((v/selExp)*100) : 0;
          return h('div', { key: k, style: { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' } }, [h('span', null, k), h('span', { style: { fontWeight: 700 } }, `${v.toLocaleString()}원 (${sPct}%)`)]);
        }))
      ]);
    })),
    h('h3', { style: { marginTop: 24, marginBottom: 12, fontWeight: 800 } }, '🍽️ 전체 카테고리별 비중'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } }, Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v]) => {
      const pct = totalExp ? Math.round((v/totalExp)*100) : 0;
      return h('div', { key: k, className: 'ios-card', style: { padding: 16, display: 'flex', justifyContent: 'space-between' } }, [h('span', { style: { fontWeight: 700 } }, k), h('span', { style: { fontWeight: 800, color: 'var(--red)' } }, `${v.toLocaleString()}원 (${pct}%)`)]);
    }))
  ]);
};

const SettingsView = ({ prof, user, open }) => {
  const applyTheme = (c) => { localStorage.setItem('theme-color', c); document.documentElement.style.setProperty('--blue', c); };
  const applyFont = (f) => { localStorage.setItem('font-family', f); document.documentElement.style.setProperty('--font', f); };
  return h('div', { style: { padding: '52px 20px' } }, [
    h('h1', { className: 'home-title' }, '설정'),
    h('div', { className: 'ios-card', style: { marginTop: 20, padding: 16 } }, [
      h('h3', { style: { fontSize: 14, fontWeight: 800, marginBottom: 12 } }, '🎨 포인트 컬러'),
      h('div', { style: { display: 'flex', gap: 10 } }, ['#007aff', '#ff2d55', '#34c759', '#5856d6'].map(c => h('div', { key: c, onClick: () => applyTheme(c), style: { width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer' } }))),
      h('h3', { style: { fontSize: 14, fontWeight: 800, marginTop: 20, marginBottom: 12 } }, '🔤 글꼴'),
      h('div', { style: { display: 'flex', gap: 8 } }, ['Outfit', 'Inter'].map(f => h('button', { key: f, className: 'btn btn-gray btn-sm btn-pill', onClick: () => applyFont(f) }, f))),
      h('div', { className: 'set-item', onClick: () => open('profile'), style: { marginTop: 20, padding: '16px 0', borderTop: '1px solid var(--sep)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' } }, [h('span', null, '👤 프로필 수정'), h(I, { n: 'chevron_right', s: 20 })])
    ])
  ]);
};

function App() {
  const [user, setUser] = useState(null);
  const [prof, setProf] = useState({ nickname: '여행자' });
  const [trips, setTrips] = useState([]);
  const [sid, setSid] = useState(null);
  const [view, setView] = useState('home');
  const [mainTab, setMainTab] = useState('trips');
  const [subTab, setSubTab] = useState('route');
  const [mod, setMod] = useState({});
  const [toast, setToast] = useState(null);
  const trip = trips.find(t => t.id === sid);
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    const tc = localStorage.getItem('theme-color'); if(tc) document.documentElement.style.setProperty('--blue', tc);
    const ff = localStorage.getItem('font-family'); if(ff) document.documentElement.style.setProperty('--font', ff);
    return au.onAuthStateChanged(u => {
      if (u) {
        setUser(u);
        db.collection('users').doc(u.uid).onSnapshot(d => d.exists && setProf(d.data()));
        db.collection('trips').where('members', 'array-contains', u.uid).onSnapshot(sn => setTrips(sn.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
      } else au.signInAnonymously();
    });
  }, []);

  const common = { trip, sync: (f, v) => db.collection('trips').doc(sid).update({ [f]: v }), show, open: (m) => setMod({...mod, [m]: true}), close: (m) => setMod({...mod, [m]: false}), setView, setSid, setSubTab };

  if (view === 'detail') return h('div', { className: 'app' }, [
    h('div', { className: 'detail-hero', style: { background: covers[trips.indexOf(trip)%covers.length], padding: '40px 20px 20px' } }, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
        h('button', { className: 'btn btn-pill btn-sm', style: { background: 'rgba(255,255,255,0.2)', color: '#fff' }, onClick: () => { setView('home'); setSid(null) } }, '← 홈'),
        h('button', { className: 'icon-btn', style: { color: '#fff' }, onClick: () => window.print() }, h(I, { n: 'ios_share', s: 20 }))
      ]),
      h('h2', { style: { color: '#fff', fontSize: 26, fontWeight: 900, marginTop: 14 } }, trip?.name)
    ]),
    h(InfoBar, { trip }),
    h('div', { className: 'sub-tabs-container', style: { overflowX: 'auto' } }, [
      h('div', { className: 'sub-tabs', style: { minWidth: 'max-content', padding: '12px 20px' } }, [
        {id:'route',l:'🗓️ 일정'}, {id:'flight',l:'🛫 출발/귀국'}, {id:'money',l:'💰 가계부'}, {id:'check',l:'✅ 체크'}
      ].map(t => h('button', { key: t.id, className: 'sub-tab' + (subTab === t.id ? ' on' : ''), onClick: () => setSubTab(t.id) }, t.l)))
    ]),
    h('div', { className: 'tab-view' }, [
      subTab === 'route' && h(TRoute, common),
      subTab === 'flight' && h(TFlight, common),
      subTab === 'money' && h(TMoney, { ...common, total: trip?.expenses?.reduce((a,c)=>a+Number(c.amount),0)||0 }),
      subTab === 'check' && h(TCheck, common)
    ]),
    toast && h('div', { className: 'toast' }, toast),
    mod.expense && h('div', { className: 'modal-bg', onClick: () => common.close('expense') }, [
      h('div', { className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
        h('h2', { className: 'modal-title' }, '지출 추가'),
        h('input', { className: 'ios-input', placeholder: '항목', id: 'ex-n' }),
        h('div', { style: { display: 'flex', gap: 10, marginTop: 10 } }, [h('input', { className: 'ios-input', type: 'number', placeholder: '금액', id: 'ex-a', style: { flex: 1 } }), h('select', { className: 'ios-input', id: 'ex-c', style: { width: 100 } }, Object.keys(ci).map(k => h('option', { key: k }, k)))]),
        h('input', { className: 'ios-input', type: 'date', id: 'ex-d', defaultValue: new Date().toISOString().split('T')[0], style: { marginTop: 10, display: 'block', width: '100%' } }),
        h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 20 }, onClick: () => {
          const n = document.getElementById('ex-n').value, a = document.getElementById('ex-a').value, c = document.getElementById('ex-c').value, d = document.getElementById('ex-d').value;
          if(!n || !a) return show('내용과 금액을 입력하세요');
          common.sync('expenses', [...(trip.expenses || []), { title: n, amount: Number(a), category: c, date: d }]);
          common.close('expense');
          show('추가 완료!');
        } }, '등록')
      ])
    ])
  ]);

  return h('div', { className: 'app' }, [
    mainTab === 'trips' && h(TripsView, { trips, user, ...common, prof }),
    mainTab === 'stats' && h(StatsView, { trips }),
    mainTab === 'settings' && h(SettingsView, { prof, user, ...common }),
    toast && h('div', { className: 'toast' }, toast),
    h('div', { className: 'bottom-bar' }, [
      {id:'trips',l:'여행',i:'flight'}, {id:'stats',l:'통계',i:'bar_chart'}, {id:'settings',l:'설정',i:'settings'}
    ].map(t => h('button', { key: t.id, className: 'bb-item' + (mainTab === t.id ? ' on' : ''), onClick: () => setMainTab(t.id) }, [h(I, { n: t.i, s: 24 }), h('span', null, t.l)])))
  ]);
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
