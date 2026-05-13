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
const I = ({ n, s = 20, style }) => h('span', { className: 'mi', style: { fontSize: s, ...style } }, n);
const ci = { '식비': '🍽️', '교통': '🚕', '숙박': '🏨', '쇼핑': '🛍️', '기타': '📦' };
const cc = { '식비': 'orange', '교통': 'blue', '숙박': 'green', '쇼핑': 'purple', '기타': 'gray' };
const covers = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)'
];

function EI({ val, onSave, className, style, placeholder, tag, ...rest }) {
  const [v, setV] = useState(val || '');
  const r = useRef();
  useEffect(() => { setV(val || '') }, [val]);
  const props = {
    ref: r, className, style, placeholder, value: v,
    onChange: e => setV(e.target.value),
    onBlur: () => { if (v !== val) onSave(v) },
    onKeyDown: e => { if (e.key === 'Enter') r.current.blur() },
    ...rest
  };
  return h(tag || 'input', props);
}

const InfoBar = ({ dest }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, []);
  return h('div', { className: 'info-bar' }, [
    h('div', { className: 'info-item' }, [h(I, { n: 'schedule', s: 14 }), h('span', null, time.toLocaleTimeString('ko-KR', { hour12: false }))]),
    dest && h('div', { className: 'info-item' }, [h(I, { n: 'place', s: 14 }), h('span', null, dest)])
  ]);
};

const MapView = ({ trip }) => {
  const r = useRef();
  useEffect(() => {
    if (!r.current || !trip) return;
    const m = L.map(r.current, { zoomControl: false }).setView([35.6812, 139.7671], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(m);
    
    const itin = trip.itinerary || [];
    const sortedItin = [...itin].sort((a,b) => (a.day||1) - (b.day||1) || a.time.localeCompare(b.time));
    const pts = sortedItin.filter(x => x.lat && x.lng).map(x => [x.lat, x.lng]);

    if (pts.length > 1) {
      L.polyline(pts, { color: 'var(--blue)', weight: 4, opacity: 0.6, dashArray: '10, 10' }).addTo(m);
    }
    sortedItin.forEach((it, idx) => {
      if (it.lat && it.lng) {
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="map-marker-label">${idx + 1}. ${it.title}</div>`,
          iconSize: [0, 0]
        });
        L.marker([it.lat, it.lng], { icon }).addTo(m).bindPopup(`<b>Day ${it.day} | ${it.time}</b><br>${it.title}`);
      }
    });

    if (pts.length > 0) m.fitBounds(pts, { padding: [50, 50] });
    return () => m.remove();
  }, [trip]);

  return h('div', { className: 'ios-card', style: { margin: '0 20px', height: 400, overflow: 'hidden', position: 'relative' } }, [
    h('div', { ref: r, style: { width: '100%', height: '100%' } })
  ]);
};

const TRoute = ({ trip, sync, show }) => {
  const [itin, setItin] = useState(trip.itinerary || []);
  useEffect(() => { setItin(trip.itinerary || []) }, [trip.itinerary]);

  const addStop = (d) => {
    const n = [...itin, { idx: itin.length, day: d, time: '12:00', title: '', desc: '', cat: '관광', emoji: '📍' }];
    sync('itinerary', n);
  };

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
        h('div', null, [
          h('span', { className: 'day-num' }, `Day ${d}`),
          h('span', { className: 'day-date', style: { marginLeft: 8, fontSize: 13, color: 'var(--sub)' } }, getD(d))
        ]),
        h('div', { style: { display: 'flex', gap: 6 } }, [
          h('button', { className: 'btn btn-gray btn-sm', onClick: () => addStop(d) }, '+ 일정 추가'),
          h('button', { className: 'icon-btn', onClick: () => { if (confirm('Day ' + d + ' 삭제?')) sync('itinerary', itin.filter(x => x.day !== d)) } }, h(I, { n: 'close', s: 14 }))
        ])
      ]),
      itin.filter(x => x.day === d).sort((a,b)=>a.time.localeCompare(b.time)).map((it, si) => h('div', { key: it.idx, className: 'stop-card glass' }, [
        h('div', { style: { display: 'flex', gap: 12, alignItems: 'flex-start' } }, [
          h('div', { style: { textAlign: 'center', minWidth: 50 } }, [
            h(EI, { val: it.time, onSave: v => { const n = [...itin]; const idx = n.findIndex(x=>x.idx===it.idx); n[idx].time = v; sync('itinerary', n) }, style: { fontSize: 15, fontWeight: 900, textAlign: 'center', background: 'var(--card2)', borderRadius: 6, padding: '4px 0' } }),
            h('span', { style: { fontSize: 24, cursor: 'pointer', display: 'block', marginTop: 4 }, onClick: () => {
              const e = prompt('이모지 입력', it.emoji || '📍'); if(e) { const n = [...itin]; const idx = n.findIndex(x=>x.idx===it.idx); n[idx].emoji = e; sync('itinerary', n) }
            } }, it.emoji || '📍')
          ]),
          h('div', { style: { flex: 1 } }, [
            h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
              h(EI, { val: it.title, onSave: v => { const n = [...itin]; const idx = n.findIndex(x=>x.idx===it.idx); n[idx].title = v; sync('itinerary', n) }, placeholder: '활동명', style: { fontSize: 17, fontWeight: 800, width: '100%', marginBottom: 4 } }),
              h('div', { style: { display: 'flex', gap: 4 } }, [
                h('button', { className: 'icon-btn', onClick: () => {
                  if (!it.title) return;
                  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${it.title}`).then(r => r.json()).then(d => {
                    if (d[0]) { const n = [...itin]; const idx = n.findIndex(x=>x.idx===it.idx); n[idx].lat = d[0].lat; n[idx].lng = d[0].lon; sync('itinerary', n); show('위치 성공!'); }
                  });
                } }, h(I, { n: 'explore', s: 13 })),
                h('button', { className: 'icon-btn', onClick: () => sync('itinerary', itin.filter(x => x.idx !== it.idx)) }, h(I, { n: 'close', s: 13 }))
              ])
            ]),
            h(EI, { val: it.desc, onSave: v => { const n = [...itin]; const idx = n.findIndex(x=>x.idx===it.idx); n[idx].desc = v; sync('itinerary', n) }, placeholder: '메모 입력...', style: { fontSize: 13, color: 'var(--sub)', width: '100%' } })
          ])
        ])
      ]))
    ])),
    h('button', { className: 'btn btn-gray btn-full', style: { marginTop: 20 }, onClick: () => {
      const nextDay = Math.max(1, ...itin.map(x => x.day)) + 1;
      const n = [...itin, { idx: itin.length, day: nextDay, time: '09:00', title: '새로운 날', desc: '', cat: '기타', emoji: '☀️' }];
      sync('itinerary', n);
    } }, '+ 일수 늘리기')
  ]);
};

const TSummary = ({ trip, setSubTab }) => {
  const itin = trip.itinerary || [];
  const hours = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);
  const days = Array.from({ length: Math.max(1, ...itin.map(x => x.day)) }, (_, i) => i + 1);
  return h('div', { style: { overflowX: 'auto', padding: '10px' } }, [
    h('table', { className: 'summary-table' }, [
      h('thead', null, h('tr', null, [h('th', null, '시간'), ...days.map(d => h('th', { key: d }, `${d}일차`))])),
      h('tbody', null, hours.map(h_str => h('tr', { key: h_str }, [
        h('td', null, h_str),
        ...days.map(d => {
          const it = itin.find(x => x.day === d && x.time.startsWith(h_str.split(':')[0]));
          return h('td', { key: d, onClick: () => it && setSubTab('route'), style: { background: it ? 'rgba(0,122,255,.05)' : 'none' } }, it ? it.title : '');
        })
      ])))
    ])
  ]);
};

const TFlight = ({ trip, sync }) => {
  const f = trip.flight || { bus: '', busTime: '', flightNo: '', gate: '', seat: '', depTime: '' };
  const update = (k, v) => sync('flight', { ...f, [k]: v });
  return h('div', { style: { padding: '20px' } }, [
    h('div', { className: 'ios-card', style: { padding: '16px', marginBottom: 16 } }, [
      h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '🚌 공항 이동'),
      h('div', { style: { display: 'flex', gap: 10 } }, [
        h('input', { className: 'ios-input', placeholder: '버스/노선', value: f.bus, onChange: e => update('bus', e.target.value), style: { flex: 1 } }),
        h('input', { className: 'ios-input', type: 'time', value: f.busTime, onChange: e => update('busTime', e.target.value), style: { width: 120 } })
      ])
    ]),
    h('div', { className: 'ios-card', style: { padding: '16px' } }, [
      h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '🛫 항공편'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } }, [
        h('div', null, [h('label', { style: { fontSize: 11 } }, '편명'), h('input', { className: 'ios-input', value: f.flightNo, onChange: e => update('flightNo', e.target.value) })]),
        h('div', null, [h('label', { style: { fontSize: 11 } }, '출발'), h('input', { className: 'ios-input', type: 'time', value: f.depTime, onChange: e => update('depTime', e.target.value) })]),
        h('div', null, [h('label', { style: { fontSize: 11 } }, '게이트'), h('input', { className: 'ios-input', value: f.gate, onChange: e => update('gate', e.target.value) })]),
        h('div', null, [h('label', { style: { fontSize: 11 } }, '좌석'), h('input', { className: 'ios-input', value: f.seat, onChange: e => update('seat', e.target.value) })])
      ])
    ])
  ]);
};

const TCheck = ({ trip, sync }) => h('div', { style: { padding: 20 } }, [
  h('div', { className: 'ios-card', style: { padding: 16 } }, [
    h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '✅ 준비물 체크'),
    (trip.checklist || []).map((x, i) => h('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--sep)' } }, [
      h('input', { type: 'checkbox', checked: x.done, onChange: () => { const n = [...trip.checklist]; n[i].done = !n[i].done; sync('checklist', n) } }),
      h('span', { style: { flex: 1, textDecoration: x.done ? 'line-through' : 'none' } }, x.item),
      h('button', { className: 'icon-btn', onClick: () => sync('checklist', trip.checklist.filter((_, j) => i !== j)) }, h(I, { n: 'close', s: 14 }))
    ])),
    h('input', { className: 'ios-input', style: { marginTop: 12 }, placeholder: '새 항목 추가...', onKeyDown: e => {
      if(e.key === 'Enter' && e.target.value) { sync('checklist', [...(trip.checklist || []), { item: e.target.value, done: false }]); e.target.value = '' }
    } })
  ])
]);

const TMemo = ({ trip, sync }) => h('div', { style: { padding: 20 } }, [
  h('textarea', { className: 'ios-input', style: { height: 400, fontSize: 15 }, placeholder: '메모...', value: trip.memo || '', onChange: e => sync('memo', e.target.value) })
]);

const TMoney = ({ trip, sync, total, open }) => h('div', { style: { padding: 20 } }, [
  h('div', { className: 'ios-card', style: { padding: 20, textAlign: 'center', background: 'var(--blue)', color: '#fff', marginBottom: 16 } }, [
    h('p', null, '총 지출'), h('h2', { style: { fontSize: 32, fontWeight: 900 } }, total.toLocaleString() + '원')
  ]),
  h('div', { className: 'ios-card' }, (trip.expenses || []).map((x, i) => h('div', { key: i, style: { padding: 12, borderBottom: '1px solid var(--sep)', display: 'flex', justifyContent: 'space-between' } }, [
    h('div', null, [h('p', { style: { fontWeight: 700 } }, x.title), h('p', { style: { fontSize: 11, color: 'var(--sub)' } }, x.category)]),
    h('p', { style: { fontWeight: 800, color: 'var(--red)' } }, Number(x.amount).toLocaleString() + '원')
  ])))
]);

const TPhoto = ({ trip, sid, show }) => {
  const [photos, setPhotos] = useState([]);
  const fref = useRef();
  useEffect(() => {
    if (!sid) return;
    return db.collection('photos').where('sid', '==', sid).onSnapshot(sn => setPhotos(sn.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [sid]);
  return h('div', { className: 'photo-grid', style: { padding: 20 } }, [
    h('button', { className: 'photo-add', onClick: () => fref.current.click() }, [h(I, { n: 'add_a_photo', s: 24 }), h('span', null, '사진 추가')]),
    photos.map(p => h('div', { key: p.id, className: 'photo-item' }, [h('img', { src: p.data, onClick: () => window.open(p.data) })])),
    h('input', { type: 'file', ref: fref, style: { display: 'none' }, accept: 'image/*', onChange: e => {
      const f = e.target.files[0]; if(!f) return;
      const r = new FileReader(); r.onload = ev => db.collection('photos').add({ sid, data: ev.target.result, time: Date.now() }); r.readAsDataURL(f);
    } })
  ]);
};

const TripsView = ({ trips, user, open, setSid, setView, setSubTab, show }) => {
  const [aiVal, setAiVal] = useState('');
  return h('div', { className: 'home-pad' }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 } }, [
      h('div', null, [
        h('h1', { className: 'home-title' }, '내 여행'),
        h('p', { 
          className: 'home-sub', 
          style: { cursor: 'pointer', color: 'var(--blue)', fontWeight: 800, textDecoration: 'underline' },
          onClick: () => { const el = document.getElementById('ai-console'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; } 
        }, [h(I, { n: 'bolt', s: 14 }), ' AI 데이터 주입 콘솔'])
      ]),
      h('div', { style: { display: 'flex', gap: 8 } }, [
        h('button', { className: 'btn btn-gray btn-pill btn-sm', onClick: () => open('join') }, '합류'),
        h('button', { className: 'btn btn-blue btn-pill btn-sm', onClick: () => open('add') }, '추가')
      ])
    ]),
    h('textarea', {
      id: 'ai-console', className: 'ios-input', style: { display: 'none', height: 100, marginBottom: 16 },
      placeholder: 'AI Sync JSON paste here...', value: aiVal, onChange: e => {
        setAiVal(e.target.value);
        try { const { sid, data } = JSON.parse(e.target.value); if(sid && data) { window.AI_SYNC(sid, data); show('성공!') } } catch(err) {}
      }
    }),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, trips.map(t => h('div', { key: t.id, className: 'trip-card', onClick: () => { setSid(t.id); setView('detail'); setSubTab('route') } }, [
      h('div', { className: 'trip-cover', style: { background: covers[trips.indexOf(t) % covers.length] } }, [h('span', { className: 'trip-cover-emoji' }, t.emoji)]),
      h('div', { className: 'trip-body', style: { position: 'relative' } }, [
        h('h3', null, t.name), h('div', { className: 'trip-dest' }, '📍 ' + (t.destination || '미정')),
        h('button', { className: 'icon-btn', style: { position: 'absolute', top: 0, right: 0, color: 'var(--red)' }, onClick: (e) => { e.stopPropagation(); if(confirm('삭제?')) db.collection('trips').doc(t.id).delete() } }, h(I, { n: 'delete', s: 18 }))
      ])
    ])))
  ]);
};

const DDayView = ({ trips, setSid, setView }) => h('div', null, [
  h('div', { style: { padding: '52px 20px 8px' } }, [h('h1', { className: 'home-title' }, 'D-Day')]),
  h('div', { style: { padding: '0 20px' } }, trips.map(t => h('div', { key: t.id, className: 'ios-card', style: { padding: 16, marginBottom: 10 }, onClick: () => { setSid(t.id); setView('detail') } }, [
    h('h3', null, t.name), h('p', { style: { color: 'var(--blue)', fontWeight: 800 } }, t.startDate)
  ])))
]);

const StatsView = ({ trips }) => {
  const ec = trips.reduce((a, t) => a + (t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0), 0);
  return h('div', { style: { padding: '52px 20px' } }, [h('h1', { className: 'home-title' }, '통계'), h('div', { className: 'ios-card', style: { padding: 20, textAlign: 'center' } }, [h('p', null, '총 지출'), h('h2', null, ec.toLocaleString() + '원')])]);
};

const SettingsView = ({ prof, theme, setTheme, open }) => h('div', { style: { padding: '52px 20px' } }, [h('h1', { className: 'home-title' }, '설정'), h('button', { className: 'btn btn-gray btn-full', onClick: () => open('profile') }, '프로필 수정')]);

const BottomBar = ({ cur, set }) => h('div', { className: 'bottom-bar' }, [
  { id: 'trips', l: '여행', i: 'flight' }, { id: 'dday', l: 'D-Day', i: 'event' }, { id: 'stats', l: '통계', i: 'bar_chart' }, { id: 'settings', l: '설정', i: 'settings' }
].map(t => h('button', { key: t.id, className: 'bb-item' + (cur === t.id ? ' on' : ''), onClick: () => set(t.id) }, [h(I, { n: t.i, s: 24 }), h('span', null, t.l)])));

const M = ({ mod, toast, close, form, setForm, db, user, prof, show }) => {
  if (toast) return h('div', { className: 'toast' }, toast.m);
  if (mod.add) return h('div', { className: 'modal-bg', onClick: () => close('add') }, [
    h('div', { className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('h2', { className: 'modal-title' }, '새 여행'),
      h('input', { className: 'ios-input', value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: '제목' }),
      h('input', { className: 'ios-input', type: 'date', value: form.start, onChange: e => setForm({ ...form, start: e.target.value }) }),
      h('button', { className: 'btn btn-blue btn-full', onClick: () => {
        const c = Math.random().toString(36).substring(2, 8).toUpperCase();
        db.collection('trips').doc(c).set({ name: form.name, startDate: form.start, owner: user.uid, members: [user.uid], memberNames: { [user.uid]: prof.nickname }, itinerary: [], expenses: [], checklist: [], memo: '', createdAt: Date.now() });
        close('add');
      } }, '생성')
    ])
  ]);
  return null;
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
  const [form, setForm] = useState({ name: '', start: '', emoji: '✈️' });

  useEffect(() => {
    return au.onAuthStateChanged(u => {
      if (u) {
        setUser(u);
        db.collection('users').doc(u.uid).onSnapshot(d => d.exists && setProf(d.data()));
        db.collection('trips').where('members', 'array-contains', u.uid).onSnapshot(sn => setTrips(sn.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
      } else au.signInAnonymously();
    });
  }, []);

  const show = (m, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 2000) };
  const open = m => setMod({ ...mod, [m]: true });
  const close = m => setMod({ ...mod, [m]: false });

  const trip = trips.find(t => t.id === sid);
  const sync = (f, v) => db.collection('trips').doc(sid).update({ [f]: v });
  const total = trip?.expenses?.reduce((a, c) => a + Number(c.amount), 0) || 0;
  const commonProps = { trip, sync, prof, user, show, open, close, sid, setView, setSid, setSubTab };

  if (view === 'detail') return h('div', { className: 'app' }, [
    h('div', { className: 'detail-hero', style: { background: covers[trips.indexOf(trip) % covers.length], padding: '40px 20px 20px' } }, [
      h('button', { className: 'btn btn-pill', onClick: () => { setView('home'); setSid(null) } }, '← 홈'),
      h('h2', { style: { color: '#fff', fontSize: 24, fontWeight: 900, marginTop: 10 } }, trip?.name)
    ]),
    h(InfoBar, { dest: trip?.destination }),
    h('div', { className: 'sub-tabs', style: { overflowX: 'auto', display: 'flex', gap: 10, padding: '10px 20px' } }, [
      { id: 'route', l: '🗓️ 일정' }, { id: 'summary', l: '📊 요약' }, { id: 'flight', l: '🛫 출발' }, { id: 'money', l: '💰 가계부' }, { id: 'check', l: '✅ 체크' }, { id: 'memo', l: '📝 메모' }, { id: 'photo', l: '📷 사진' }
    ].map(t => h('button', { key: t.id, className: 'sub-tab' + (subTab === t.id ? ' on' : ''), onClick: () => setSubTab(t.id) }, t.l))),
    h('div', { className: 'tab-view' }, [
      subTab === 'route' && h(TRoute, commonProps),
      subTab === 'summary' && h(TSummary, commonProps),
      subTab === 'flight' && h(TFlight, commonProps),
      subTab === 'money' && h(TMoney, { ...commonProps, total }),
      subTab === 'check' && h(TCheck, commonProps),
      subTab === 'memo' && h(TMemo, commonProps),
      subTab === 'photo' && h(TPhoto, commonProps)
    ]),
    h(M, { mod, toast, close, form, setForm, db, user, prof, show })
  ]);

  return h('div', { className: 'app' }, [
    mainTab === 'trips' && h(TripsView, { trips, user, open, setSid, setView, setSubTab, show }),
    mainTab === 'dday' && h(DDayView, { trips, setSid, setView }),
    mainTab === 'stats' && h(StatsView, { trips }),
    mainTab === 'settings' && h(SettingsView, { prof, open }),
    h(BottomBar, { cur: mainTab, set: setMainTab }),
    h(M, { mod, toast, close, form, setForm, db, user, prof, show })
  ]);
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
