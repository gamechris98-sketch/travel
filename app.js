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
window.AI_SYNC = (sid, data, user, prof) => {
  if (!sid || !data) return;
  const docRef = db.collection('trips').doc(sid);
  const updateData = { ...data };
  if (user) {
    updateData.members = firebase.firestore.FieldValue.arrayUnion(user.uid);
    updateData[`memberNames.${user.uid}`] = prof?.nickname || '여행자';
    if (!updateData.owner) updateData.owner = user.uid;
  }
  return docRef.set(updateData, { merge: true }).then(() => {
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
    onBlur: () => { if (v !== val && !rest.manual) onSave(v) },
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
    const pts = (trip.itinerary || []).filter(x => x.lat && x.lng).sort((a,b)=>(a.day||1)-(b.day||1) || a.time.localeCompare(b.time)).map(x => [x.lat, x.lng]);
    if (pts.length > 1) L.polyline(pts, { color: 'var(--blue)', weight: 4, opacity: 0.6, dashArray: '10, 10' }).addTo(m);
    (trip.itinerary || []).forEach((it, idx) => {
      if (it.lat && it.lng) {
        const icon = L.divIcon({ className: 'custom-div-icon', html: `<div class="map-marker-label">${idx + 1}. ${it.title}</div>`, iconSize: [0, 0] });
        L.marker([it.lat, it.lng], { icon }).addTo(m).bindPopup(`<b>Day ${it.day} | ${it.time}</b><br>${it.title}`);
      }
    });
    if (pts.length > 0) m.fitBounds(pts, { padding: [50, 50] });
    return () => m.remove();
  }, [trip]);
  return h('div', { className: 'ios-card', style: { margin: '0 20px', height: 400, overflow: 'hidden' } }, [h('div', { ref: r, style: { width: '100%', height: '100%' } })]);
};

const TRoute = ({ trip, sync, show }) => {
  const [itin, setItin] = useState(trip.itinerary || []);
  const [editIdx, setEditIdx] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => { setItin(trip.itinerary || []) }, [trip.itinerary]);

  const addStop = (d) => {
    const newItem = { idx: itin.length, day: d, time: '12:00', title: '', desc: '', cat: '관광', emoji: '📍' };
    setEditIdx(newItem.idx);
    setEditData(newItem);
    setItin([...itin, newItem]);
  };

  const saveItem = () => {
    const n = [...itin];
    const targetIdx = n.findIndex(x => x.idx === editIdx);
    if (targetIdx > -1) n[targetIdx] = editData;
    sync('itinerary', n.sort((a,b)=>a.day-b.day || a.time.localeCompare(b.time)));
    setEditIdx(null);
    show('저장 완료!');
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
        h('div', null, [h('span', { className: 'day-num' }, `Day ${d}`), h('span', { className: 'day-date' }, getD(d))]),
        h('div', { style: { display: 'flex', gap: 6 } }, [
          h('button', { className: 'btn btn-blue btn-sm btn-pill', onClick: () => addStop(d) }, '+ 일정 등록'),
          h('button', { className: 'icon-btn', onClick: () => { if (confirm('Day ' + d + ' 삭제?')) sync('itinerary', itin.filter(x => x.day !== d)) } }, h(I, { n: 'close', s: 14 }))
        ])
      ]),
      itin.filter(x => x.day === d).sort((a,b)=>a.time.localeCompare(b.time)).map((it, si) => h('div', { key: it.idx, className: 'stop-card glass' + (editIdx === it.idx ? ' editing' : '') }, [
        editIdx === it.idx ? h('div', null, [
          h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [
            h('input', { type: 'time', className: 'ios-input', value: editData.time, onChange: e => setEditData({...editData, time: e.target.value}), style: { flex: 1 } }),
            h('input', { className: 'ios-input', value: editData.emoji, onChange: e => setEditData({...editData, emoji: e.target.value}), style: { width: 60, textAlign: 'center' } })
          ]),
          h('input', { className: 'ios-input', value: editData.title, onChange: e => setEditData({...editData, title: e.target.value}), placeholder: '장소 또는 활동명', style: { marginBottom: 10, fontWeight: 800 } }),
          h('textarea', { className: 'ios-input', value: editData.desc, onChange: e => setEditData({...editData, desc: e.target.value}), placeholder: '상세 메모...', style: { marginBottom: 10, height: 60 } }),
          h('div', { style: { display: 'flex', gap: 8 } }, [
            h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: saveItem }, '등록/저장'),
            h('button', { className: 'btn btn-gray btn-pill', onClick: () => { setEditIdx(null); setItin(trip.itinerary || []) } }, '취소')
          ])
        ]) : h('div', { style: { display: 'flex', gap: 12, alignItems: 'flex-start' }, onClick: () => { setEditIdx(it.idx); setEditData(it); } }, [
          h('div', { style: { textAlign: 'center', minWidth: 50 } }, [
            h('div', { style: { fontSize: 15, fontWeight: 900, color: 'var(--blue)' } }, it.time),
            h('div', { style: { fontSize: 24, marginTop: 4 } }, it.emoji || '📍')
          ]),
          h('div', { style: { flex: 1 } }, [
            h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
              h('div', { style: { fontSize: 17, fontWeight: 800 } }, it.title || '새 일정'),
              h('button', { className: 'icon-btn', onClick: (e) => { e.stopPropagation(); if(confirm('삭제?')) sync('itinerary', itin.filter(x => x.idx !== it.idx)) } }, h(I, { n: 'close', s: 13 }))
            ]),
            h('div', { style: { fontSize: 13, color: 'var(--sub)' } }, it.desc || '클릭하여 내용을 입력하세요')
          ])
        ])
      ]))
    ])),
    h('button', { className: 'btn btn-gray btn-full btn-pill', style: { marginTop: 20 }, onClick: () => {
      const nextDay = Math.max(1, ...itin.map(x => x.day)) + 1;
      sync('itinerary', [...itin, { idx: itin.length, day: nextDay, time: '09:00', title: '새로운 날', desc: '', cat: '기타', emoji: '☀️' }]);
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
          return h('td', { key: d, onClick: () => it && setSubTab('route'), style: { background: it ? 'rgba(0,122,255,.05)' : 'none', fontSize: 11 } }, it ? it.title : '');
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

const TMemo = ({ trip, sync }) => h('div', { style: { padding: 20 } }, [h('textarea', { className: 'ios-input', style: { height: 400, fontSize: 15 }, placeholder: '메모...', value: trip.memo || '', onChange: e => sync('memo', e.target.value) })]);

const TMoney = ({ trip, sync, total }) => h('div', { style: { padding: 20 } }, [
  h('div', { className: 'ios-card', style: { padding: 20, textAlign: 'center', background: 'var(--blue)', color: '#fff', marginBottom: 16 } }, [h('p', null, '총 지출'), h('h2', { style: { fontSize: 32, fontWeight: 900 } }, total.toLocaleString() + '원')]),
  h('div', { className: 'ios-card' }, (trip.expenses || []).map((x, i) => h('div', { key: i, style: { padding: 12, borderBottom: '1px solid var(--sep)', display: 'flex', justifyContent: 'space-between' } }, [
    h('div', null, [h('p', { style: { fontWeight: 700 } }, x.title), h('p', { style: { fontSize: 11, color: 'var(--sub)' } }, x.category)]),
    h('p', { style: { fontWeight: 800, color: 'var(--red)' } }, Number(x.amount).toLocaleString() + '원')
  ])))
]);

const TPhoto = ({ trip, sid, show }) => {
  const [photos, setPhotos] = useState([]);
  const fref = useRef();
  useEffect(() => { if (!sid) return; return db.collection('photos').where('sid', '==', sid).onSnapshot(sn => setPhotos(sn.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [sid]);
  return h('div', { className: 'photo-grid', style: { padding: 20 } }, [
    h('button', { className: 'photo-add', onClick: () => fref.current.click() }, [h(I, { n: 'add_a_photo', s: 24 }), h('span', null, '사진 추가')]),
    photos.map(p => h('div', { key: p.id, className: 'photo-item' }, [h('img', { src: p.data, onClick: () => window.open(p.data) })])),
    h('input', { type: 'file', ref: fref, style: { display: 'none' }, accept: 'image/*', onChange: e => { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = ev => db.collection('photos').add({ sid, data: ev.target.result, time: Date.now() }); r.readAsDataURL(f); } })
  ]);
};

const TripsView = ({ trips, user, open, setSid, setView, setSubTab, show, prof }) => {
  const [aiVal, setAiVal] = useState('');
  
  const handleAI = () => {
    try {
      const raw = JSON.parse(aiVal);
      let data = raw.data || raw;
      if (Array.isArray(data)) data = { itinerary: data };
      if (data.itinerary && !data.name) data.name = 'AI 생성 여행';
      
      if (raw.sid) {
        window.AI_SYNC(raw.sid, data, user, prof).then(() => show('동기화 성공!'));
      } else if (data.itinerary) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        db.collection('trips').doc(code).set({
          name: data.name || 'AI 추천 여행',
          startDate: data.startDate || new Date().toISOString().split('T')[0],
          owner: user.uid, members: [user.uid], memberNames: { [user.uid]: prof.nickname },
          itinerary: data.itinerary || [], expenses: [], checklist: [], memo: '', createdAt: Date.now()
        }).then(() => { show('새 여행 생성 완료!'); setTimeout(() => location.reload(), 1000); });
      } else {
        show('데이터 형식이 올바르지 않습니다.', false);
      }
    } catch(err) {
      show('JSON 파싱 오류: 내용을 확인해 주세요.', false);
    }
  };

  return h('div', { className: 'home-pad' }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 } }, [
      h('div', null, [
        h('h1', { className: 'home-title' }, '내 여행'),
        h('p', { className: 'home-sub', style: { cursor: 'pointer', color: 'var(--blue)', fontWeight: 800, textDecoration: 'underline' }, onClick: () => { const el = document.getElementById('ai-console-box'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; } }, [h(I, { n: 'bolt', s: 14 }), ' AI 데이터 주입 콘솔'])
      ]),
      h('div', { style: { display: 'flex', gap: 8 } }, [h('button', { className: 'btn btn-gray btn-pill btn-sm', onClick: () => open('join') }, '합류'), h('button', { className: 'btn btn-blue btn-pill btn-sm', onClick: () => open('add') }, '추가')])
    ]),
    h('div', { id: 'ai-console-box', style: { display: 'none', marginBottom: 20 } }, [
      h('textarea', { className: 'ios-input', style: { height: 120, fontSize: 11, fontFamily: 'monospace', marginBottom: 10 }, placeholder: 'AI 데이터를 여기에 붙여넣으세요...', value: aiVal, onChange: e => setAiVal(e.target.value) }),
      h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: handleAI }, [h(I, { n: 'done_all', s: 16 }), '데이터 주입 완료 및 실행'])
    ]),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, [
      ...trips.map(t => h('div', { key: t.id, className: 'trip-card', onClick: () => { setSid(t.id); setView('detail'); setSubTab('route') } }, [
        h('div', { className: 'trip-cover', style: { background: covers[trips.indexOf(t) % covers.length] } }, [h('span', { className: 'trip-cover-emoji' }, t.emoji)]),
        h('div', { className: 'trip-body', style: { position: 'relative' } }, [
          h('h3', null, t.name), h('div', { className: 'trip-dest' }, '📍 ' + (t.destination || '미정')),
          h('button', { className: 'icon-btn', style: { position: 'absolute', top: 0, right: 0, color: 'var(--red)' }, onClick: (e) => { e.stopPropagation(); if(confirm('삭제?')) db.collection('trips').doc(t.id).delete() } }, h(I, { n: 'delete', s: 18 }))
        ])
      ])),
      trips.length === 0 && h('div', { className: 'ios-card', style: { padding: 40, textAlign: 'center', background: 'rgba(120,120,128,.04)' } }, [h('div', { style: { fontSize: 48, marginBottom: 12 } }, '✈️'), h('h4', { style: { margin: 0, fontWeight: 800 } }, '여행을 시작해보세요'), h('p', { className: 'home-sub' }, '새로운 일정을 추가하거나 초대 코드로 참여하세요.')]),
      h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 10 }, onClick: () => open('add') }, [h(I, { n: 'add', s: 16 }), '새 여행 만들기'])
    ])
  ]);
};

const DDayView = ({ trips, setSid, setView }) => h('div', null, [
  h('div', { style: { padding: '52px 20px 8px' } }, [h('h1', { className: 'home-title' }, 'D-Day')]),
  h('div', { style: { padding: '0 20px' } }, trips.map(t => h('div', { key: t.id, className: 'ios-card', style: { padding: 16, marginBottom: 10 }, onClick: () => { setSid(t.id); setView('detail') } }, [h('h3', null, t.name), h('p', { style: { color: 'var(--blue)', fontWeight: 800 } }, t.startDate)])))
]);

const StatsView = ({ trips }) => {
  const ec = trips.reduce((a, t) => a + (t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0), 0);
  return h('div', { style: { padding: '52px 20px' } }, [h('h1', { className: 'home-title' }, '통계'), h('div', { className: 'ios-card', style: { padding: 20, textAlign: 'center' } }, [h('p', null, '총 지출'), h('h2', null, ec.toLocaleString() + '원')])]);
};

const SettingsView = ({ prof, user, show, open }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };
  return h('div', { style: { padding: '52px 20px' } }, [
    h('h1', { className: 'home-title' }, '설정'),
    h('div', { className: 'ios-card', style: { marginTop: 20, padding: 4 } }, [
      h('div', { className: 'set-item', onClick: () => open('profile'), style: { padding: '16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--sep)', cursor: 'pointer' } }, [h('span', { style: { fontWeight: 600 } }, '👤 프로필 닉네임 수정'), h(I, { n: 'chevron_right', s: 20 })]),
      h('div', { className: 'set-item', onClick: toggleTheme, style: { padding: '16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--sep)', cursor: 'pointer' } }, [h('span', { style: { fontWeight: 600 } }, '🌓 다크 모드 전환'), h('span', { className: 'pill' }, theme === 'light' ? 'OFF' : 'ON')]),
      h('div', { className: 'set-item', style: { padding: '16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--sep)' } }, [h('span', { style: { fontWeight: 600 } }, '📏 폰트 크기 (준비중)'), h('span', { style: { color: 'var(--sub)' } }, '기본')]),
      h('div', { className: 'set-item', onClick: () => { if(confirm('로그아웃 하시겠습니까?')) au.signOut().then(() => location.reload()) }, style: { padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' } }, [h('span', { style: { fontWeight: 600, color: 'var(--red)' } }, '🚪 로그아웃'), h(I, { n: 'logout', s: 20 })])
    ]),
    h('div', { style: { marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--sub)' } }, [h('p', null, 'Premium Travel Manager v1.2'), h('p', null, 'User ID: ' + user?.uid.substring(0, 8) + '...')])
  ]);
};

const BottomBar = ({ cur, set }) => h('div', { className: 'bottom-bar' }, [
  { id: 'trips', l: '여행', i: 'flight' }, { id: 'dday', l: 'D-Day', i: 'event' }, { id: 'stats', l: '통계', i: 'bar_chart' }, { id: 'settings', l: '설정', i: 'settings' }
].map(t => h('button', { key: t.id, className: 'bb-item' + (cur === t.id ? ' on' : ''), onClick: () => set(t.id) }, [h(I, { n: t.i, s: 24 }), h('span', null, t.l)])));

const M = ({ mod, toast, close, form, setForm, db, user, prof, show }) => {
  if (toast) return h('div', { className: 'toast' + (toast.ok ? '' : ' toast-err') }, toast.m);
  if (mod.add) return h('div', { className: 'modal-bg', onClick: () => close('add') }, [
    h('div', { className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('h2', { className: 'modal-title' }, '새 여행'),
      h('input', { className: 'ios-input', value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: '제목' }),
      h('input', { className: 'ios-input', type: 'date', value: form.start, onChange: e => setForm({ ...form, start: e.target.value }), style: { marginTop: 10 } }),
      h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 20 }, onClick: () => {
        const c = Math.random().toString(36).substring(2, 8).toUpperCase();
        db.collection('trips').doc(c).set({ name: form.name, startDate: form.start, owner: user.uid, members: [user.uid], memberNames: { [user.uid]: prof.nickname }, itinerary: [], expenses: [], checklist: [], memo: '', createdAt: Date.now() });
        close('add'); show('여행 생성 완료!');
      } }, '여행 저장 및 등록')
    ])
  ]);
  if (mod.profile) return h('div', { className: 'modal-bg', onClick: () => close('profile') }, [
    h('div', { className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('h2', { className: 'modal-title' }, '닉네임 변경'),
      h('input', { id: 'nn', className: 'ios-input', defaultValue: prof.nickname, placeholder: '닉네임 입력' }),
      h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 20 }, onClick: () => {
        const n = document.getElementById('nn').value;
        if(n) { db.collection('users').doc(user.uid).set({ nickname: n }); close('profile'); show('변경되었습니다!'); }
      } }, '변경 완료')
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

  const show = (m, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 2500) };
  const open = m => setMod({ ...mod, [m]: true });
  const close = m => setMod({ ...mod, [m]: false });

  const trip = trips.find(t => t.id === sid);
  const sync = (f, v) => db.collection('trips').doc(sid).update({ [f]: v });
  const total = trip?.expenses?.reduce((a, c) => a + Number(c.amount), 0) || 0;
  const commonProps = { trip, sync, prof, user, show, open, close, sid, setView, setSid, setSubTab };

  if (view === 'detail') return h('div', { className: 'app' }, [
    h('div', { className: 'detail-hero', style: { background: covers[trips.indexOf(trip) % covers.length], padding: '40px 20px 20px' } }, [
      h('button', { className: 'btn btn-pill', style: { background: 'rgba(255,255,255,0.2)', color: '#fff' }, onClick: () => { setView('home'); setSid(null) } }, '← 홈으로'),
      h('h2', { style: { color: '#fff', fontSize: 24, fontWeight: 900, marginTop: 10 } }, trip?.name)
    ]),
    h(InfoBar, { dest: trip?.destination }),
    h('div', { className: 'sub-tabs' }, [
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
    mainTab === 'trips' && h(TripsView, { trips, user, open, setSid, setView, setSubTab, show, prof }),
    mainTab === 'dday' && h(DDayView, { trips, setSid, setView }),
    mainTab === 'stats' && h(StatsView, { trips }),
    mainTab === 'settings' && h(SettingsView, { prof, user, show, open }),
    h(BottomBar, { cur: mainTab, set: setMainTab }),
    h(M, { mod, toast, close, form, setForm, db, user, prof, show })
  ]);
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
