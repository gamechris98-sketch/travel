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

// AI Sync Engine
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

// UI Components & Setup
const I = ({ n, s = 20, style }) => h('span', { className: 'mi', style: { fontSize: s, ...style } }, n);
const ci = { '식비': '🍽️', '교통': '🚕', '숙박': '🏨', '쇼핑': '🛍️', '기타': '📦' };
const cc = { '식비': '#ff9500', '교통': '#007aff', '숙박': '#34c759', '쇼핑': '#af52de', '기타': '#8e8e93' };
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

// Weather Widget
const WeatherWidget = ({ city }) => {
  const [w, setW] = useState(null);
  useEffect(() => {
    if (!city) return;
    const clean = city.split(',')[0].trim();
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${clean}&units=metric&appid=${W_KEY}`)
      .then(r => r.json()).then(d => d.main && setW(d)).catch(() => {});
  }, [city]);
  if (!w) return null;
  return h('div', { className: 'info-item weather-chip', style: { display: 'flex', alignItems: 'center', gap: 4 } }, [
    h(I, { n: 'wb_cloudy', s: 14 }),
    h('span', null, `${Math.round(w.main.temp)}°C (${city.split(',')[0]})`)
  ]);
};

// Top Info Bar
const InfoBar = ({ trip }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (d) => d ? d.split('-').slice(1).join('/') : '00/00';
  return h('div', { className: 'info-bar' }, [
    h('div', { className: 'info-item' }, [h(I, { n: 'schedule', s: 14 }), h('span', null, time.toLocaleTimeString('ko-KR', { hour12: false }))]),
    h('div', { className: 'info-item' }, [h(I, { n: 'calendar_today', s: 14 }), h('span', null, `${fmt(trip?.startDate)} ~ ${fmt(trip?.endDate)}`)]),
    h(WeatherWidget, { city: trip?.destination }),
    h('div', { className: 'info-item', style: { marginLeft: 'auto', color: 'var(--blue)' } }, [h('span', { style: { fontWeight: 900 } }, getDDay(trip?.startDate))])
  ]);
};

// Leaflet Route Map Component
const RouteMap = ({ trip }) => {
  const r = useRef();
  useEffect(() => {
    if (!r.current || !trip) return;
    const m = L.map(r.current, { zoomControl: false }).setView([35.68, 139.76], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(m);
    const itin = (trip.itinerary || []).filter(x => x.lat && x.lng).sort((a,b)=>a.day-b.day || a.time.localeCompare(b.time));
    if (itin.length > 0) {
      const pts = itin.map(x => [Number(x.lat), Number(x.lng)]);
      L.polyline(pts, { color: 'var(--blue)', weight: 3, opacity: 0.5, dashArray: '5, 10' }).addTo(m);
      itin.forEach((it, i) => {
        L.marker([it.lat, it.lng], {
          icon: L.divIcon({ className: 'map-dot', html: `<span>${i+1}</span>` })
        }).addTo(m).bindPopup(`<b>Day ${it.day} | ${it.time}</b><br>${it.title}`);
      });
      m.fitBounds(pts, { padding: [40, 40] });
    }
    return () => m.remove();
  }, [trip]);
  return h('div', { className: 'ios-card', style: { margin: '0 0 16px', height: 220, overflow: 'hidden' } }, [h('div', { ref: r, style: { width: '100%', height: '100%' } })]);
};

// Route Tab Component
const TRoute = ({ trip, sync, show, prof }) => {
  const [itin, setItin] = useState(trip.itinerary || []);
  const [editIdx, setEditIdx] = useState(null);
  const [editData, setEditData] = useState({});
  useEffect(() => { setItin(trip.itinerary || []) }, [trip.itinerary]);

  const addStop = (d) => {
    const newItem = { idx: itin.length, day: d, time: '12:00', title: '', desc: '', cat: '관광', emoji: '📍', comments: [], transport: 'walk' };
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

  const optimizeDay = (d) => {
    const dayStops = itin.map((x, i) => ({ ...x, idx: i })).filter(x => x.day === d && x.lat && x.lng);
    if (dayStops.length < 2) return show('최적화할 장소가 부족합니다 (위치 설정 필요)', false);

    show('AI 동선 최적화 진행 중...');
    const optimized = [];
    const pool = [...dayStops];
    let cur = pool.shift();
    optimized.push(cur);

    while (pool.length > 0) {
      pool.sort((a, b) => {
        const d1 = Math.sqrt(Math.pow(cur.lat - a.lat, 2) + Math.pow(cur.lng - a.lng, 2));
        const d2 = Math.sqrt(Math.pow(cur.lat - b.lat, 2) + Math.pow(cur.lng - b.lng, 2));
        return d1 - d2;
      });
      cur = pool.shift();
      optimized.push(cur);
    }

    const otherDays = itin.map((x, i) => ({ ...x, idx: i })).filter(x => x.day !== d || !x.lat || !x.lng);
    const result = [...otherDays, ...optimized].sort((a,b)=>a.day-b.day || a.time.localeCompare(b.time));
    sync('itinerary', result.map((x, i) => ({ ...x, idx: i })));
    show('동선 최적화 완료!');
  };

  const days = Array.from({ length: Math.max(1, ...itin.map(x => x.day)) }, (_, i) => i + 1);
  const getD = (d) => {
    if (!trip.startDate) return '';
    const date = new Date(trip.startDate);
    date.setDate(date.getDate() + (d - 1));
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const cats = ['관광', '식당', '숙소', '쇼핑', '기타'];
  const catClr = { '관광': 'var(--blue)', '식당': 'var(--orange)', '숙소': 'var(--green)', '쇼핑': 'var(--purple)', '기타': 'var(--sub)' };
  const catIco = { '관광': '📍', '식당': '🍽️', '숙소': '🏨', '쇼핑': '🛍️', '기타': '📦' };

  return h('div', { style: { padding: '0 20px 100px' } }, [
    h(RouteMap, { trip }),
    days.map(d => h('div', { key: d, className: 'day-section' }, [
      h('div', { className: 'day-header' }, [
        h('div', null, [h('span', { className: 'day-num' }, `Day ${d}`), h('span', { className: 'day-date' }, getD(d))]),
        h('div', { style: { display: 'flex', gap: 6 } }, [
          h('button', { className: 'btn btn-blue btn-sm btn-pill', onClick: () => addStop(d) }, '+ 일정 등록'),
          h('button', { className: 'btn btn-gray btn-sm btn-pill', onClick: () => optimizeDay(d) }, [h(I, { n: 'auto_fix_high', s: 12 }), 'AI 최적화']),
          h('button', { className: 'icon-btn', onClick: () => { if (confirm(`Day ${d} 일정을 모두 삭제하시겠습니까?`)) sync('itinerary', itin.filter(x => x.day !== d)) } }, h(I, { n: 'close', s: 14 }))
        ])
      ]),
      itin.map((x, i) => ({ ...x, idx: i })).filter(x => x.day === d).sort((a,b)=>a.time.localeCompare(b.time)).map((it, si, arr) => h('div', { key: it.idx, className: 'stop-card glass' + (editIdx === it.idx ? ' editing' : '') }, [
        editIdx === it.idx ? h('div', null, [
          h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [
            h('input', { type: 'time', className: 'ios-input', value: editData.time, onChange: e => setEditData({...editData, time: e.target.value}), style: { flex: 1, padding: '14px 8px' } }),
            h('input', { className: 'ios-input', value: editData.emoji, onChange: e => setEditData({...editData, emoji: e.target.value}), style: { width: 60, textAlign: 'center' } })
          ]),
          h('input', { className: 'ios-input', value: editData.title, onChange: e => setEditData({...editData, title: e.target.value}), placeholder: '장소 또는 활동명', style: { marginBottom: 10, fontWeight: 800 } }),
          h('textarea', { className: 'ios-input', value: editData.desc, onChange: e => setEditData({...editData, desc: e.target.value}), placeholder: '상세 설명 및 정보...', style: { marginBottom: 10, height: 60 } }),
          h('div', { style: { display: 'flex', gap: 4, marginBottom: 10 } }, cats.map(c => h('button', {
            key: c,
            style: { padding: '4px 10px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, background: editData.cat === c ? catClr[c] : 'rgba(120,120,128,.08)', color: editData.cat === c ? '#fff' : 'var(--sub)', cursor: 'pointer' },
            onClick: () => setEditData({...editData, cat: c, emoji: catIco[c]})
          }, c))),
          h('div', { style: { display: 'flex', gap: 8 } }, [
            h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: saveItem }, '등록/저장'),
            h('button', { className: 'btn btn-gray btn-pill', onClick: () => { setEditIdx(null); setItin(trip.itinerary || []) } }, '취소')
          ])
        ]) : h('div', { style: { display: 'flex', gap: 12, alignItems: 'flex-start' }, onClick: () => { setEditIdx(it.idx); setEditData(it); } }, [
          h('div', { style: { textAlign: 'center', minWidth: 50 } }, [
            h('div', { style: { fontSize: 14, fontWeight: 900, color: catClr[it.cat] || 'var(--blue)' } }, it.time),
            h('div', { style: { fontSize: 24, marginTop: 4 } }, it.emoji || '📍')
          ]),
          h('div', { style: { flex: 1 } }, [
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
              h('div', { style: { fontSize: 17, fontWeight: 800 } }, it.title || '새 일정'),
              h('button', { className: 'icon-btn', style: { width: 22, height: 22 }, onClick: (e) => { e.stopPropagation(); if(confirm('이 일정을 삭제할까요?')) sync('itinerary', itin.filter((_, j) => j !== it.idx)) } }, h(I, { n: 'close', s: 13 }))
            ]),
            h('div', { style: { fontSize: 13, color: 'var(--sub)', marginTop: 2 } }, it.desc || '설명 추가'),
            
            // Map Search & Location Tools
            h('div', { style: { display: 'flex', gap: 6, marginTop: 8 } }, [
              h('button', { className: 'btn btn-gray btn-sm btn-pill', style: { padding: '4px 10px', fontSize: 10, background: it.lat ? 'rgba(52,199,89,0.15)' : 'rgba(120,120,128,0.08)', color: it.lat ? 'var(--green)' : 'var(--sub)' }, onClick: (e) => {
                e.stopPropagation();
                if (!it.title) return;
                show('위치 검색 중...');
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(it.title)}`)
                  .then(r => r.json()).then(d => {
                    if (d && d[0]) {
                      const n = [...itin];
                      n[it.idx].lat = parseFloat(d[0].lat);
                      n[it.idx].lng = parseFloat(d[0].lon);
                      sync('itinerary', n);
                      show('위치 획득 성공!');
                    } else show('위치를 찾을 수 없습니다.', false);
                  }).catch(() => show('네트워크 오류', false));
              } }, [h(I, { n: 'explore', s: 11 }), it.lat ? '위치 등록됨' : '위치 검색']),
              h('button', { className: 'btn btn-gray btn-sm btn-pill', style: { padding: '4px 10px', fontSize: 10 }, onClick: (e) => {
                e.stopPropagation();
                if (it.title) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.title)}`);
              } }, [h(I, { n: 'map', s: 11 }), '구글 지도'])
            ]),

            // Comments
            h('div', { style: { marginTop: 12, borderTop: '1px solid var(--sep)', paddingTop: 8 } }, [
              (it.comments || []).map((c, ci) => h('div', { key: ci, style: { fontSize: 11, marginBottom: 4, color: 'var(--text)' } }, [
                h('span', { style: { fontWeight: 800, color: 'var(--blue)', marginRight: 6 } }, c.user),
                h('span', null, c.text)
              ])),
              h('input', {
                className: 'ios-input',
                style: { height: 32, padding: '4px 10px', fontSize: 11, marginTop: 6, background: 'rgba(0,0,0,0.03)' },
                placeholder: '댓글 추가...',
                onClick: (e) => e.stopPropagation(),
                onKeyDown: e => {
                  if (e.key === 'Enter' && e.target.value) {
                    e.stopPropagation();
                    const n = [...itin];
                    if (!n[it.idx].comments) n[it.idx].comments = [];
                    n[it.idx].comments.push({ user: prof.nickname || '여행자', text: e.target.value, time: Date.now() });
                    sync('itinerary', n);
                    e.target.value = '';
                  }
                }
              })
            ])
          ]),
          
          // Transport Badge
          si < arr.length - 1 && h('button', {
            className: 'transport-badge',
            style: { position: 'absolute', bottom: -12, left: 36, zIndex: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: '1px solid var(--sep)', padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer' },
            onClick: (e) => {
              e.stopPropagation();
              const modes = ['walk', 'car', 'bus'];
              const nextMode = modes[(modes.indexOf(it.transport || 'walk') + 1) % modes.length];
              const n = [...itin];
              n[it.idx].transport = nextMode;
              sync('itinerary', n);
            }
          }, [
            h(I, { n: it.transport === 'car' ? 'directions_car' : it.transport === 'bus' ? 'directions_bus' : 'directions_walk', s: 11 }),
            h('span', null, it.transport === 'car' ? '차량' : it.transport === 'bus' ? '대중교통' : '도보')
          ])
        ])
      ]))
    ])),
    h('button', { className: 'btn btn-gray btn-full btn-pill', style: { marginTop: 20 }, onClick: () => { const nextDay = Math.max(1, ...itin.map(x => x.day)) + 1; sync('itinerary', [...itin, { idx: itin.length, day: nextDay, time: '09:00', title: '새로운 일차', desc: '', cat: '기타', emoji: '☀️', comments: [], transport: 'walk' }]); } }, '+ 다음 일차 추가')
  ]);
};

// Summary Table Component
const TSummary = ({ trip, setSubTab }) => {
  const itin = trip.itinerary || [];
  const hours = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);
  const days = Array.from({ length: Math.max(1, ...itin.map(x => x.day)) }, (_, i) => i + 1);
  return h('div', { style: { overflowX: 'auto', padding: '20px 20px 100px' } }, [
    h('table', { className: 'summary-table' }, [
      h('thead', null, h('tr', null, [h('th', null, '시간'), ...days.map(d => h('th', { key: d }, `${d}일차`))])),
      h('tbody', null, hours.map(h_str => h('tr', { key: h_str }, [
        h('td', { style: { fontWeight: 800, color: 'var(--sub)' } }, h_str),
        ...days.map(d => {
          const it = itin.find(x => x.day === d && x.time.startsWith(h_str.split(':')[0]));
          return h('td', { key: d, onClick: () => it && setSubTab('route'), style: { background: it ? 'rgba(0,122,255,.05)' : 'none', fontSize: 11, cursor: 'pointer', fontWeight: it ? 700 : 400, color: it ? 'var(--blue)' : 'inherit' } }, it ? it.title : '');
        })
      ])))
    ])
  ]);
};

// Flight & Transport Info Component
const TFlight = ({ trip, sync }) => {
  const f = trip.flight || { bus: '', busTime: '', flightNo: '', depTime: '', rBus: '', rBusTime: '', rFlightNo: '', rDepTime: '' };
  const update = (k, v) => sync('flight', { ...f, [k]: v });
  return h('div', { style: { padding: '20px 20px 100px' } }, [
    h('div', { className: 'ios-card', style: { padding: '16px', marginBottom: 16 } }, [
      h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '🛫 가는 편 (Departure)'),
      h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [
        h('input', { className: 'ios-input', placeholder: '공항 버스/교통편', value: f.bus, onChange: e => update('bus', e.target.value), style: { flex: 1 } }),
        h('input', { className: 'ios-input', type: 'time', value: f.busTime, onChange: e => update('busTime', e.target.value), style: { width: 125 } })
      ]),
      h('div', { style: { display: 'flex', gap: 10 } }, [
        h('input', { className: 'ios-input', placeholder: '항공편명/열차번호', value: f.flightNo, onChange: e => update('flightNo', e.target.value), style: { flex: 1 } }),
        h('input', { className: 'ios-input', type: 'time', value: f.depTime, onChange: e => update('depTime', e.target.value), style: { width: 125 } })
      ])
    ]),
    h('div', { className: 'ios-card', style: { padding: '16px' } }, [
      h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '🛬 오는 편 (Return)'),
      h('div', { style: { display: 'flex', gap: 10, marginBottom: 10 } }, [
        h('input', { className: 'ios-input', placeholder: '귀국 공항 버스/교통편', value: f.rBus, onChange: e => update('rBus', e.target.value), style: { flex: 1 } }),
        h('input', { className: 'ios-input', type: 'time', value: f.rBusTime, onChange: e => update('rBusTime', e.target.value), style: { width: 125 } })
      ]),
      h('div', { style: { display: 'flex', gap: 10 } }, [
        h('input', { className: 'ios-input', placeholder: '귀국 항공편명/열차번호', value: f.rFlightNo, onChange: e => update('rFlightNo', e.target.value), style: { flex: 1 } }),
        h('input', { className: 'ios-input', type: 'time', value: f.rDepTime, onChange: e => update('rDepTime', e.target.value), style: { width: 125 } })
      ])
    ])
  ]);
};

// Checklist Component
const TCheck = ({ trip, sync }) => {
  const templates = {
    '해외': ['여권', '심카드/eSIM', '환전', '어댑터', '보조배터리', '캐리어 벨트', '세면도구', '상비약'],
    '국내': ['신분증', '충전기', '우산/우비', '간식', '물티슈', '여벌 옷'],
    '호캉스': ['수영복', '수영모', '마스크팩', '기초화장품', '충전기']
  };
  const list = trip.checklist || [];
  const done = list.filter(x => x.done).length, all = list.length;
  const pct = all > 0 ? Math.round((done / all) * 100) : 0;
  return h('div', { style: { padding: '20px 20px 100px' } }, [
    h('div', { style: { display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' } }, Object.keys(templates).map(t => h('button', { key: t, className: 'btn btn-gray btn-sm btn-pill', onClick: () => { const n = [...(trip.checklist || []), ...templates[t].map(x => ({ item: x, done: false }))]; sync('checklist', n) } }, t + ' 추천 목록 추가'))),
    all > 0 && h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 } }, [
      h('div', { style: { flex: 1, height: 8, background: 'var(--sep)', borderRadius: 4, overflow: 'hidden' } }, h('div', { style: { width: pct + '%', height: '100%', background: 'var(--blue)', transition: 'width 0.3s' } })),
      h('span', { style: { fontSize: 13, fontWeight: 900, color: 'var(--sub)' } }, `${done}/${all} (${pct}%)`)
    ]),
    h('div', { className: 'ios-card', style: { padding: 16 } }, [
      h('h3', { style: { fontSize: 16, fontWeight: 800, marginBottom: 12 } }, '✅ 체크리스트'),
      list.map((x, i) => h('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--sep)' } }, [
        h('input', { type: 'checkbox', checked: x.done, onChange: () => { const n = [...list]; n[i].done = !n[i].done; sync('checklist', n) } }),
        h('span', { style: { flex: 1, textDecoration: x.done ? 'line-through' : 'none', opacity: x.done ? 0.5 : 1, fontWeight: 600 } }, x.item),
        h('button', { className: 'icon-btn', onClick: () => sync('checklist', list.filter((_, j) => i !== j)) }, h(I, { n: 'close', s: 14 }))
      ])),
      h('input', { className: 'ios-input', style: { marginTop: 12 }, placeholder: '새 준비물 항목 입력...', onKeyDown: e => { if(e.key === 'Enter' && e.target.value) { sync('checklist', [...list, { item: e.target.value, done: false }]); e.target.value = '' } } })
    ]),
    all > 0 && h('button', { className: 'btn btn-red btn-full btn-pill', style: { marginTop: 16 }, onClick: () => { if(confirm('모든 체크리스트를 초기화하시겠습니까?')) sync('checklist', []) } }, '전체 초기화')
  ]);
};

// Expense/Money Component
const TMoney = ({ trip, sync, total, open, prof, user, show }) => {
  const [cur, setCur] = useState('KRW');
  const [rates, setRates] = useState({ USD: 1, JPY: 1, EUR: 1 });
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/KRW')
      .then(r => r.json()).then(d => d.rates && setRates({ USD: d.rates.USD, JPY: d.rates.JPY, EUR: d.rates.EUR })).catch(() => {});
  }, []);

  const budget = Number(trip?.budget || 0);
  const remain = budget - total;
  const pct = budget > 0 ? Math.min(Math.round((total / budget) * 100), 100) : 0;

  const cats = (trip.expenses || []).reduce((a, x) => { const c = x.category || '기타'; a[c] = (a[c] || 0) + Number(x.amount); return a }, {});
  const dates = [...new Set(trip.expenses?.map(x => x.date) || [])].reverse();

  return h('div', { style: { padding: '20px 20px 100px' } }, [
    // Realtime Exchange Rate info
    h('div', { className: 'ios-card', style: { padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 900, color: 'var(--blue)', background: 'rgba(0,122,255,0.06)' } }, [
      h('span', null, `🇺🇸 1$ ≈ ${Math.round(1/rates.USD)}원`),
      h('span', null, `🇯🇵 100¥ ≈ ${Math.round(1/rates.JPY*100)}원`),
      h('span', null, `🇪🇺 1€ ≈ ${Math.round(1/rates.EUR)}원`)
    ]),

    // Budget Progress Tracker
    h('div', { className: 'ios-card', style: { padding: 20, marginBottom: 16 } }, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } }, [
        h('span', { style: { fontSize: 14, fontWeight: 800, color: 'var(--sub)' } }, '목표 예산 사용현황'),
        h('span', { style: { fontSize: 14, fontWeight: 900, color: pct >= 90 ? 'var(--red)' : 'var(--blue)' } }, `${pct}%`)
      ]),
      h('div', { style: { height: 10, background: 'var(--sep)', borderRadius: 5, overflow: 'hidden', marginBottom: 10 } }, h('div', { style: { width: pct + '%', height: '100%', background: pct >= 90 ? 'var(--red)' : 'linear-gradient(90deg, var(--blue), #34c759)', transition: 'width 0.3s' } })),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 } }, [
        h('span', null, budget > 0 ? `예산: ${budget.toLocaleString()}원` : '목표 예산을 입력하세요'),
        h('span', { style: { color: remain < 0 ? 'var(--red)' : 'var(--sub)' } }, remain >= 0 ? `잔액: ${remain.toLocaleString()}원` : `초과: ${Math.abs(remain).toLocaleString()}원`)
      ]),
      h('div', { style: { display: 'flex', gap: 10, marginTop: 12 } }, [
        h('input', { type: 'number', className: 'ios-input', placeholder: '목표 예산 설정', id: 'budget-input', defaultValue: trip.budget || '', style: { height: 38, padding: '8px 12px', fontSize: 13, flex: 1 } }),
        h('button', { className: 'btn btn-blue btn-pill btn-sm', onClick: () => {
          const val = document.getElementById('budget-input').value;
          sync('budget', Number(val));
          show('예산이 변경되었습니다.');
        } }, '설정')
      ])
    ]),

    // Category Breakdown Widget
    h('div', { className: 'ios-card', style: { padding: 16, marginBottom: 16 } }, [
      h('h3', { style: { fontSize: 14, fontWeight: 800, marginBottom: 12 } }, '📊 카테고리별 누적'),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } }, Object.entries(cats).map(([k,v]) => h('div', { key: k, style: { padding: '6px 12px', background: cc[k] || '#8e8e93', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 900 } }, `${k}: ${v.toLocaleString()}원`)))
    ]),

    // Total Summary card & Add button
    h('div', { className: 'ios-card', style: { padding: 24, textAlign: 'center', background: 'var(--blue)', color: '#fff', marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [
      h('p', { style: { fontSize: 13, opacity: 0.8, margin: 0 } }, '총 지출'),
      h('h2', { style: { fontSize: 36, fontWeight: 900, margin: '6px 0 12px' } }, total.toLocaleString() + '원'),
      h('div', { style: { display: 'flex', gap: 10, width: '100%' } }, [
        h('button', { className: 'btn btn-pill btn-sm btn-full', style: { background: 'rgba(255,255,255,0.2)', color: '#fff' }, onClick: () => open('settle') }, [h(I, { n: 'calculate', s: 14 }), '정산 계산']),
        h('button', { className: 'btn btn-pill btn-sm btn-full', style: { background: '#fff', color: 'var(--blue)' }, onClick: () => open('expense') }, '+ 지출 등록')
      ])
    ]),

    // Date-grouped Expense Rows
    dates.map(d => {
      const dayExps = trip.expenses.filter(x => x.date === d);
      const dayTotal = dayExps.reduce((a, x) => a + Number(x.amount), 0);
      return h('div', { key: d, style: { marginBottom: 14 } }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 12, fontWeight: 900, color: 'var(--sub)' } }, [
          h('span', null, d),
          h('span', null, `${dayTotal.toLocaleString()}원`)
        ]),
        h('div', { className: 'ios-card' }, dayExps.reverse().map((x, i) => {
          const idx = trip.expenses.findIndex(y => y.id === x.id);
          return h('div', { key: x.id, style: { padding: 14, borderBottom: i < dayExps.length - 1 ? '1px solid var(--sep)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', null, [
              h(EI, { val: x.title, onSave: v => { const n = [...trip.expenses]; n[idx].title = v; sync('expenses', n) }, style: { fontWeight: 800, fontSize: 15, border: 'none', background: 'none', padding: 0, outline: 'none' } }),
              h('p', { style: { fontSize: 11, color: 'var(--sub)', margin: '4px 0 0' } }, `${x.category} | Payer: ${x.payer} | ${x.time || ''}`)
            ]),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
              h(EI, { val: String(x.amount), onSave: v => { const n = [...trip.expenses]; n[idx].amount = Number(v); sync('expenses', n) }, style: { fontWeight: 900, color: 'var(--red)', fontSize: 16, border: 'none', background: 'none', padding: 0, textAlign: 'right', outline: 'none', width: 80 } }),
              h('span', { style: { fontSize: 14, fontWeight: 900, color: 'var(--red)' } }, '원'),
              h('button', { className: 'icon-btn', style: { width: 22, height: 22 }, onClick: () => { if(confirm('이 지출 항목을 삭제하시겠습니까?')) sync('expenses', trip.expenses.filter(y => y.id !== x.id)) } }, h(I, { n: 'close', s: 13 }))
            ])
          ]);
        }))
      ]);
    })
  ]);
};

// Notepad Component
const TMemo = ({ trip, sync }) => h('div', { style: { padding: '0 20px 100px' } }, [
  h('div', { className: 'ios-card', style: { padding: 8 } }, [
    h(EI, { val: trip?.memo || '', onSave: v => sync('memo', v), className: 'ios-input', tag: 'textarea', style: { minHeight: 400, padding: 12, border: 'none', background: 'none', resize: 'vertical' }, placeholder: '메모를 자유롭게 작성하세요 (예산, 맛집 정보, 예약 번호 등)...' })
  ])
]);

// Photo Board Component (Swift image compression + Mock AI analysis)
const TPhoto = ({ trip, sid, show, sync, setSubTab }) => {
  const [photos, setPhotos] = useState([]);
  const fref = useRef();

  useEffect(() => {
    if (!sid) return;
    const q = db.collection('photos').where('sid', '==', sid);
    return q.onSnapshot(sn => {
      const data = sn.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPhotos(data.sort((a, b) => b.time - a.time));
    });
  }, [sid]);

  const upload = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    show('사진 업로드 준비 중 (최적화 중)...');
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
          show('업로드 성공!');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(f);
    } catch (err) {
      console.error(err);
      show('업로드 실패: ' + err.message, false);
    }
  };

  const runAI = (p) => {
    show('AI 영수증 인식 및 소비 패턴 자동 등록 중...');
    setTimeout(() => {
      const mockItems = [
        { name: '편의점 간식', amount: 1200, cat: '식비' },
        { name: '스타벅스 아메리카노', amount: 4500, cat: '식비' },
        { name: '대중교통 티켓', amount: 3200, cat: '교통' },
        { name: '드럭스토어 화장품', amount: 24000, cat: '쇼핑' }
      ];
      const item = mockItems[Math.floor(Math.random() * mockItems.length)];
      sync('expenses', [...(trip.expenses || []), {
        id: Date.now(), name: item.name + ' (AI)', amount: item.amount, category: item.cat,
        payer: 'AI Receipt Analyser', date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      show(`인식 완료: ${item.name} (${item.amount.toLocaleString()}원)이 가계부에 등록되었습니다.`);
      setSubTab('money');
    }, 1500);
  };

  return h('div', { className: 'photo-view', style: { padding: '20px 20px 100px' } }, [
    h('div', { className: 'photo-grid' }, [
      h('button', { className: 'photo-add', onClick: () => fref.current.click() }, [
        h(I, { n: 'add_a_photo', s: 24 }), h('span', null, '사진 추가')
      ]),
      photos.map(p => h('div', { key: p.id, className: 'photo-item', style: { position: 'relative' } }, [
        h('img', { src: p.data, onClick: () => window.open(p.data), style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' } }),
        h('button', { className: 'photo-del', style: { position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }, onClick: () => { if(confirm('이 사진을 정말 삭제할까요?')) db.collection('photos').doc(p.id).delete(); } }, h(I, { n: 'close', s: 12 })),
        h('button', {
          className: 'btn btn-pill',
          style: { position: 'absolute', bottom: 4, left: 4, right: 4, padding: '4px 0', fontSize: 10, background: 'rgba(255,255,255,0.95)', color: 'var(--blue)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
          onClick: (e) => { e.stopPropagation(); runAI(p); }
        }, [h(I, { n: 'psychology', s: 12 }), ' AI 영수증 분석'])
      ]))
    ]),
    h('input', { type: 'file', ref: fref, style: { display: 'none' }, accept: 'image/*', onChange: upload })
  ]);
};

// Home/Trips Listing View
const TripsView = ({ trips, user, open, setSid, setView, setSubTab, show, prof }) => {
  const [aiVal, setAiVal] = useState('');
  const del = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Delete Clicked:', t.id);
    if (confirm(`[${t.name}] 여행을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 멤버의 리스트에서 삭제됩니다.`)) {
      db.collection('trips').doc(t.id).delete().then(() => show('삭제되었습니다.')).catch(err => console.error(err));
    }
  };

  return h('div', { className: 'home-pad' }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 } }, [
      h('div', null, [
        h('h1', { className: 'home-title' }, '내 여행'),
        h('p', { className: 'home-sub', style: { cursor: 'pointer' }, onClick: () => { const el = document.getElementById('ai-console'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; } }, [h(I, { n: 'bolt', s: 14 }), ' AI 주입 콘솔'])
      ]),
      h('div', { style: { display: 'flex', gap: 8 } }, [
        h('button', { className: 'btn btn-gray btn-pill btn-sm', onClick: () => open('join') }, '합류'),
        h('button', { className: 'btn btn-blue btn-pill btn-sm', onClick: () => open('add') }, '추가')
      ])
    ]),
    h('div', { id: 'ai-console', style: { display: 'none', marginBottom: 20 } }, [
      h('textarea', { className: 'ios-input', style: { height: 100, fontSize: 11, fontFamily: 'monospace' }, placeholder: 'JSON 붙여넣기...', value: aiVal, onChange: e => setAiVal(e.target.value) }),
      h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 10 }, onClick: () => { try { const d = JSON.parse(aiVal); window.AI_SYNC(d.sid || Math.random().toString(36).substr(2,8), d.data || d, user, prof); } catch(e) { alert('실패'); } } }, '데이터 주입 실행')
    ]),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, [
      trips.map(t => {
        const totalExp = t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0;
        const checkDone = t.checklist?.filter(x => x.done).length || 0;
        const checkAll = t.checklist?.length || 0;
        return h('div', { key: t.id, className: 'trip-card', style: { position: 'relative' }, onClick: () => { setSid(t.id); setView('detail'); setSubTab('route') } }, [
          h('div', { className: 'trip-cover', style: { background: covers[trips.indexOf(t) % covers.length] } }, [
            h('span', { className: 'trip-cover-emoji' }, t.emoji || '✈️')
          ]),
          h('div', { className: 'trip-body' }, [
            h('h3', null, t.name),
            h('div', { className: 'trip-dest', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
              h('span', null, '📍 ' + (t.destination || '미정')),
              h('span', { style: { color: 'var(--blue)', fontWeight: 900 } }, getDDay(t.startDate))
            ]),
            // Quick status badges
            h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 } }, [
              h('span', { style: { fontSize: 10, background: 'rgba(0,122,255,0.08)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 8, fontWeight: 900 } }, `일정: ${t.itinerary?.length || 0}개`),
              h('span', { style: { fontSize: 10, background: 'rgba(255,59,48,0.08)', color: 'var(--red)', padding: '2px 8px', borderRadius: 8, fontWeight: 900 } }, `지출: ${totalExp.toLocaleString()}원`),
              h('span', { style: { fontSize: 10, background: 'rgba(52,199,89,0.08)', color: 'var(--green)', padding: '2px 8px', borderRadius: 8, fontWeight: 900 } }, `체크: ${checkDone}/${checkAll}`)
            ])
          ]),
          h('button', { className: 'icon-btn del-trigger', style: { position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.9)', borderRadius: '12px', padding: '8px', zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'flex' }, onClick: (e) => del(e, t) }, h(I, { n: 'delete', s: 22, style: { color: 'var(--red)' } }))
        ]);
      }),
      trips.length === 0 && h('div', { className: 'ios-card', style: { padding: 40, textAlign: 'center' } }, [
        h('div', { style: { fontSize: 48, marginBottom: 12 } }, '✈️'),
        h('h3', null, '아직 등록된 여행 일정이 없습니다'),
        h('p', { className: 'home-sub' }, '오른쪽 위의 추가 버튼을 통해 새로운 여정을 생성하거나,\n합류 버튼을 통해 기존 여행코드(예: 1DBMOR)로 참여해보세요!')
      ])
    ])
  ]);
};

// D-Day View Component
const DDayView = ({ trips, setSid, setView }) => {
  const upcoming = trips.filter(t => t.startDate && new Date(t.startDate) > new Date().setHours(0,0,0,0)).sort((a,b)=>new Date(a.startDate) - new Date(b.startDate));
  const past = trips.filter(t => t.startDate && new Date(t.startDate) <= new Date().setHours(0,0,0,0)).sort((a,b)=>new Date(b.startDate) - new Date(a.startDate));
  return h('div', { style: { padding: '52px 20px 100px' } }, [
    h('h1', { className: 'home-title' }, 'D-Day 카운트다운'),
    h('p', { className: 'home-sub', style: { marginBottom: 20 } }, '소중한 여행일정의 카운트다운을 모아봅니다'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, [
      upcoming.map(t => h('div', { key: t.id, className: 'ios-card', style: { padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }, onClick: () => { setSid(t.id); setView('detail') } }, [
        h('div', null, [
          h('h3', { style: { fontWeight: 800, margin: 0 } }, `${t.emoji || '✈️'} ${t.name}`),
          h('p', { style: { fontSize: 12, color: 'var(--sub)', margin: '4px 0 0' } }, `${t.startDate} ~ ${t.endDate || '미정'}`)
        ]),
        h('div', { style: { fontSize: 24, fontWeight: 900, color: 'var(--blue)' } }, getDDay(t.startDate))
      ])),
      past.map(t => h('div', { key: t.id, className: 'ios-card', style: { padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.6, cursor: 'pointer' }, onClick: () => { setSid(t.id); setView('detail') } }, [
        h('div', null, [
          h('h3', { style: { fontWeight: 800, margin: 0 } }, `${t.emoji || '✈️'} ${t.name}`),
          h('p', { style: { fontSize: 12, color: 'var(--sub)', margin: '4px 0 0' } }, `${t.startDate} ~ ${t.endDate || '미정'}`)
        ]),
        h('div', { style: { fontSize: 18, fontWeight: 900, color: 'var(--sub)' } }, getDDay(t.startDate))
      ]))
    ])
  ]);
};

// Statistics Report View
const StatsView = ({ trips }) => {
  const [selId, setSelId] = useState(null);
  const totalExp = trips.reduce((a, t) => a + (t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0), 0);
  const cats = trips.reduce((a, t) => { t.expenses?.forEach(x => a[x.category] = (a[x.category] || 0) + Number(x.amount)); return a }, {});
  
  const selTrip = trips.find(t => t.id === selId);
  const selExp = selTrip?.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0;
  const selCats = selTrip?.expenses?.reduce((a, x) => { const c = x.category || '기타'; a[c] = (a[c] || 0) + Number(x.amount); return a }, {}) || {};

  return h('div', { style: { padding: '52px 20px 100px' } }, [
    h('h1', { className: 'home-title' }, '통계 리포트'),
    h('div', { className: 'ios-card', style: { padding: 24, textAlign: 'center', marginTop: 20, background: 'var(--blue)', color: '#fff' } }, [
      h('p', { style: { margin: 0, fontSize: 13, opacity: 0.8 } }, '누적 총 여행 지출'),
      h('h2', { style: { fontSize: 32, fontWeight: 900, margin: '6px 0 0' } }, totalExp.toLocaleString() + '원')
    ]),
    
    h('h3', { style: { marginTop: 24, marginBottom: 12, fontWeight: 800 } }, '🏨 여행별 지출 비중'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, trips.map(t => {
      const exp = t.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0;
      const pct = totalExp ? Math.round((exp/totalExp)*100) : 0;
      return h('div', { key: t.id }, [
        h('button', {
          className: 'ios-card stats-btn',
          style: { width: '100%', padding: 16, display: 'flex', justifyContent: 'space-between', border: selId === t.id ? '2px solid var(--blue)' : 'none', background: '#fff', fontSize: 15, cursor: 'pointer', outline: 'none', textAlign: 'left' },
          onClick: () => { console.log('Stats Clicked:', t.id); setSelId(selId === t.id ? null : t.id); }
        }, [
          h('span', { style: { fontWeight: 700 } }, t.name),
          h('span', { style: { fontWeight: 800, color: 'var(--blue)' } }, `${exp.toLocaleString()}원 (${pct}%)`)
        ]),
        selId === t.id && h('div', { style: { padding: '12px 16px', background: 'rgba(0,0,0,0.03)', borderRadius: 12, marginTop: -12, marginBottom: 16 } }, Object.entries(selCats).map(([k,v]) => {
          const sPct = selExp ? Math.round((v/selExp)*100) : 0;
          return h('div', { key: k, style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' } }, [
            h('span', null, k),
            h('span', { style: { fontWeight: 700 } }, `${v.toLocaleString()}원 (${sPct}%)`)
          ]);
        }))
      ]);
    })),
    
    h('h3', { style: { marginTop: 24, marginBottom: 12, fontWeight: 800 } }, '🍽️ 전체 카테고리별 비중'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } }, Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v]) => {
      const pct = totalExp ? Math.round((v/totalExp)*100) : 0;
      return h('div', { key: k, className: 'ios-card', style: { padding: 16, display: 'flex', justifyContent: 'space-between' } }, [
        h('span', { style: { fontWeight: 700 } }, k),
        h('span', { style: { fontWeight: 800, color: 'var(--red)' } }, `${v.toLocaleString()}원 (${pct}%)`)
      ]);
    }))
  ]);
};

// Settings Screen View
const SettingsView = ({ prof, user, open }) => {
  const applyTheme = (c) => { localStorage.setItem('theme-color', c); document.documentElement.style.setProperty('--blue', c); };
  const applyFont = (f) => { localStorage.setItem('font-family', f); document.documentElement.style.setProperty('--font', f); };
  return h('div', { style: { padding: '52px 20px 100px' } }, [
    h('h1', { className: 'home-title' }, '설정'),
    h('div', { className: 'ios-card', style: { marginTop: 20, padding: 16 } }, [
      h('h3', { style: { fontSize: 14, fontWeight: 800, marginBottom: 12 } }, '🎨 포인트 컬러'),
      h('div', { style: { display: 'flex', gap: 10 } }, ['#007aff', '#ff2d55', '#34c759', '#5856d6', '#ff9500'].map(c => h('div', { key: c, onClick: () => applyTheme(c), style: { width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer' } }))),
      h('h3', { style: { fontSize: 14, fontWeight: 800, marginTop: 20, marginBottom: 12 } }, '🔤 글꼴'),
      h('div', { style: { display: 'flex', gap: 8 } }, ['Outfit', 'Inter', 'Noto Sans KR'].map(f => h('button', { key: f, className: 'btn btn-gray btn-sm btn-pill', onClick: () => applyFont(f) }, f))),
      h('div', { className: 'set-item', onClick: () => open('profile'), style: { marginTop: 20, padding: '16px 0', borderTop: '1px solid var(--sep)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' } }, [h('span', { style: { fontWeight: 600 } }, '👤 프로필 닉네임 수정'), h(I, { n: 'chevron_right', s: 20 })]),
      h('div', { className: 'set-item', onClick: () => { if(confirm('로그아웃 하시겠습니까?')) au.signOut().then(() => location.reload()) }, style: { padding: '16px 0', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' } }, [h('span', { style: { fontWeight: 600, color: 'var(--red)' } }, '🚪 로그아웃 및 세션 리셋'), h(I, { n: 'logout', s: 20 })])
    ])
  ]);
};

// Global Popup Sheet Manager (Unified Modal)
const M = ({ mod, toast, user, prof, trip, settle, open, close, show, form, setForm }) => {
  const modalContents = [];

  if (toast) {
    modalContents.push(h('div', { key: 't', className: 'toast' }, toast));
  }

  // Profile Change Modal
  if (mod.profile) {
    modalContents.push(h('div', { key: 'pbg', className: 'modal-bg', onClick: () => close('profile') }));
    modalContents.push(h('div', { key: 'pc', className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('div', { className: 'modal-handle' }),
      h('h2', { className: 'modal-title', style: { textAlign: 'center' } }, '프로필 설정'),
      h('p', { style: { textAlign: 'center', fontSize: 13, color: 'var(--sub)', marginBottom: 20 } }, '사용할 닉네임을 설정해주세요.'),
      h('input', { id: 'nickname-edit', className: 'ios-input', defaultValue: prof.nickname, style: { textAlign: 'center', fontSize: 18, fontWeight: 700, marginBottom: 20 } }),
      h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: () => {
        const val = document.getElementById('nickname-edit').value;
        if(val) {
          db.collection('users').doc(user.uid).set({ nickname: val }).then(() => {
            close('profile');
            show('닉네임 변경 완료!');
          });
        }
      } }, '변경 완료')
    ]));
  }

  // Add Trip Modal
  if (mod.add) {
    modalContents.push(h('div', { key: 'abg', className: 'modal-bg', onClick: () => close('add') }));
    modalContents.push(h('div', { key: 'as', className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('div', { className: 'modal-handle' }),
      h('h2', { className: 'modal-title' }, '새로운 여행 만들기'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, [
        h('div', { style: { display: 'flex', gap: 10 } }, [
          h('input', { className: 'ios-input', style: { width: 60, textAlign: 'center', fontSize: 22 }, value: form.emoji, onChange: e => setForm({ ...form, emoji: e.target.value }) }),
          h('input', { className: 'ios-input', style: { flex: 1 }, value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: '여행 제목 (예: 도쿄 쇼핑 여행)' })
        ]),
        h('input', { className: 'ios-input', value: form.dest, onChange: e => setForm({ ...form, dest: e.target.value }), placeholder: '목적지 도시 (예: Tokyo, Japan)' }),
        h('div', { style: { display: 'flex', gap: 10 } }, [
          h('div', { style: { flex: 1 } }, [
            h('label', { style: { fontSize: 11, fontWeight: 800, color: 'var(--sub)' } }, '출발일'),
            h('input', { className: 'ios-input', type: 'date', value: form.start, onChange: e => setForm({ ...form, start: e.target.value }) })
          ]),
          h('div', { style: { flex: 1 } }, [
            h('label', { style: { fontSize: 11, fontWeight: 800, color: 'var(--sub)' } }, '귀국일'),
            h('input', { className: 'ios-input', type: 'date', value: form.end, onChange: e => setForm({ ...form, end: e.target.value }) })
          ])
        ])
      ]),
      h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 24 }, onClick: () => {
        if (!form.name) return show('여행 제목을 입력하세요.');
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        db.collection('trips').doc(code).set({
          name: form.name,
          destination: form.dest,
          emoji: form.emoji,
          startDate: form.start,
          endDate: form.end,
          owner: user.uid,
          members: [user.uid],
          memberNames: { [user.uid]: prof.nickname },
          checklist: [],
          expenses: [],
          itinerary: [],
          memo: '',
          createdAt: Date.now()
        }).then(() => {
          close('add');
          setForm({ name: '', dest: '', emoji: '✈️', start: new Date().toISOString().split('T')[0], end: '' });
          show('여행이 새롭게 생성되었습니다!');
        });
      } }, '여행 시작하기')
    ]));
  }

  // Join Modal (To rejoin / restore existing Italy & Japan trip codes)
  if (mod.join) {
    modalContents.push(h('div', { key: 'jbg', className: 'modal-bg', onClick: () => close('join') }));
    modalContents.push(h('div', { key: 'js', className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('div', { className: 'modal-handle' }),
      h('h2', { className: 'modal-title' }, '기존 여행 참여 / 복구'),
      h('p', { style: { fontSize: 13, color: 'var(--sub)', marginBottom: 16 } }, '참여할 여행의 코드(예: 1DBMOR 또는 기존 이탈리아/일본 여행코드)를 입력해 합류하세요.'),
      h('input', { id: 'join-code-input', className: 'ios-input', style: { textAlign: 'center', fontSize: 24, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 20 }, placeholder: 'TRAVEL CODE', onChange: e => { e.target.value = e.target.value.toUpperCase() } }),
      h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: () => {
        const val = document.getElementById('join-code-input').value.trim();
        if(!val) return show('코드를 입력하세요.');
        show('코드를 찾는 중...');
        db.collection('trips').doc(val).get().then(d => {
          if (d.exists) {
            db.collection('trips').doc(val).update({
              members: firebase.firestore.FieldValue.arrayUnion(user.uid),
              [`memberNames.${user.uid}`]: prof.nickname
            }).then(() => {
              close('join');
              show('여행 그룹 합류에 성공하였습니다!');
            });
          } else show('존재하지 않는 여행코드입니다.', false);
        }).catch(() => show('데이터베이스 연결 실패', false));
      } }, '합류하기')
    ]));
  }

  // Settle Computation modal
  if (mod.settle && trip) {
    const totalExp = trip.expenses?.reduce((s, x) => s + Number(x.amount), 0) || 0;
    const membersCount = trip.members?.length || 1;
    const shareAmt = Math.round(totalExp / membersCount);
    
    // Calculate balances
    const payments = {};
    trip.members.forEach(m => payments[m] = 0);
    trip.expenses?.forEach(x => {
      if (x.payerId && payments[x.payerId] !== undefined) {
        payments[x.payerId] += Number(x.amount);
      }
    });

    const balances = {};
    trip.members.forEach(m => {
      balances[m] = payments[m] - shareAmt;
    });

    modalContents.push(h('div', { key: 'sbg', className: 'modal-bg', onClick: () => close('settle') }));
    modalContents.push(h('div', { key: 'sc', className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('div', { className: 'modal-handle' }),
      h('h2', { className: 'modal-title' }, '정산 내역 계산기'),
      h('div', { style: { background: 'var(--card2)', padding: 16, borderRadius: 16, marginBottom: 16 } }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, fontWeight: 800 } }, [h('span', null, '총 지출'), h('span', { style: { color: 'var(--red)' } }, `${totalExp.toLocaleString()}원`)]),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800 } }, [h('span', null, '1인당 정산액'), h('span', { style: { color: 'var(--blue)' } }, `${shareAmt.toLocaleString()}원`)])
      ]),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 200, overflowY: 'auto', marginBottom: 20 } }, Object.entries(balances).map(([uid, bal]) => h('div', { key: uid, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 700 } }, [
        h('span', null, trip.memberNames?.[uid] || '참여자'),
        h('span', { style: { color: bal >= 0 ? 'var(--green)' : 'var(--red)' } }, bal >= 0 ? `+${bal.toLocaleString()}원 받기` : `${bal.toLocaleString()}원 보내기`)
      ]))),
      h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: () => close('settle') }, '확인')
    ]));
  }

  // Edit Trip Modal
  if (mod.editTrip && trip) {
    modalContents.push(h('div', { key: 'etbg', className: 'modal-bg', onClick: () => close('editTrip') }));
    modalContents.push(h('div', { key: 'ets', className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('div', { className: 'modal-handle' }),
      h('h2', { className: 'modal-title' }, '여행 정보 편집'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, [
        h('label', { style: { fontSize: 11, fontWeight: 800 } }, '여행지 제목'),
        h('input', { className: 'ios-input', defaultValue: trip.name, id: 'edit-trip-name' }),
        h('label', { style: { fontSize: 11, fontWeight: 800 } }, '목적지 도시'),
        h('input', { className: 'ios-input', defaultValue: trip.destination, id: 'edit-trip-dest' }),
        h('div', { style: { display: 'flex', gap: 10 } }, [
          h('div', { style: { flex: 1 } }, [
            h('label', { style: { fontSize: 11 } }, '출발일'),
            h('input', { className: 'ios-input', type: 'date', defaultValue: trip.startDate, id: 'edit-trip-start' })
          ]),
          h('div', { style: { flex: 1 } }, [
            h('label', { style: { fontSize: 11 } }, '귀국일'),
            h('input', { className: 'ios-input', type: 'date', defaultValue: trip.endDate, id: 'edit-trip-end' })
          ])
        ])
      ]),
      h('div', { style: { display: 'flex', gap: 10, marginTop: 24 } }, [
        h('button', { className: 'btn btn-blue btn-full btn-pill', onClick: () => {
          const n = document.getElementById('edit-trip-name').value, d = document.getElementById('edit-trip-dest').value, s = document.getElementById('edit-trip-start').value, e = document.getElementById('edit-trip-end').value;
          db.collection('trips').doc(trip.id).update({ name: n, destination: d, startDate: s, endDate: e }).then(() => {
            close('editTrip');
            show('수정 내용 저장 완료!');
          });
        } }, '저장 완료'),
        h('button', { className: 'btn btn-red btn-pill', onClick: () => {
          if(confirm('이 여행을 정말 폭파(삭제)하시겠습니까?\n이 작업은 모든 멤버 리스트에서도 삭제되며 절대 되돌릴 수 없습니다.')) {
            db.collection('trips').doc(trip.id).delete().then(() => {
              close('editTrip');
              setView('home');
              setSid(null);
              show('여행이 폭파되었습니다.');
            });
          }
        } }, '삭제')
      ])
    ]));
  }

  // Register Expense Modal (With Korean category icons and Date Picker default to today)
  if (mod.expense && trip) {
    modalContents.push(h('div', { key: 'exbg', className: 'modal-bg', onClick: () => close('expense') }));
    modalContents.push(h('div', { key: 'exs', className: 'modal-sheet', onClick: e => e.stopPropagation() }, [
      h('div', { className: 'modal-handle' }),
      h('h2', { className: 'modal-title' }, '새로운 지출 내역 등록'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, [
        h('input', { className: 'ios-input', placeholder: '지출 항목 내용 (예: 야끼소바와 하이볼)', id: 'add-ex-name' }),
        h('div', { style: { display: 'flex', gap: 10 } }, [
          h('input', { className: 'ios-input', type: 'number', placeholder: '금액 입력', id: 'add-ex-amt', style: { flex: 1 } }),
          h('select', { className: 'ios-input', id: 'add-ex-cat', style: { width: 100 } }, Object.keys(ci).map(k => h('option', { key: k }, `${ci[k]} ${k}`)))
        ]),
        h('div', { style: { display: 'flex', gap: 10 } }, [
          h('div', { style: { flex: 1 } }, [
            h('label', { style: { fontSize: 11, fontWeight: 800, color: 'var(--sub)' } }, '결제 일자'),
            h('input', { className: 'ios-input', type: 'date', id: 'add-ex-date', defaultValue: new Date().toISOString().split('T')[0] })
          ]),
          h('div', { style: { flex: 1 } }, [
            h('label', { style: { fontSize: 11, fontWeight: 800, color: 'var(--sub)' } }, '결제자'),
            h('select', { className: 'ios-input', id: 'add-ex-payer' }, trip.members.map(m => h('option', { key: m, value: m }, trip.memberNames?.[m] || '참여자')))
          ])
        ])
      ]),
      h('button', { className: 'btn btn-blue btn-full btn-pill', style: { marginTop: 24 }, onClick: () => {
        const n = document.getElementById('add-ex-name').value.trim(), a = document.getElementById('add-ex-amt').value, c = document.getElementById('add-ex-cat').value, d = document.getElementById('add-ex-date').value, pUid = document.getElementById('add-ex-payer').value;
        if (!n || !a) return show('내용과 금액을 바르게 입력하세요.', false);
        
        const newExpense = {
          id: Date.now(),
          title: n,
          amount: Number(a),
          category: c.split(' ').slice(1).join(' ') || c, // extract plain Korean text
          payer: trip.memberNames?.[pUid] || '여행자',
          payerId: pUid,
          date: d ? new Date(d).toLocaleDateString() : new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        db.collection('trips').doc(trip.id).update({
          expenses: [...(trip.expenses || []), newExpense]
        }).then(() => {
          close('expense');
          show('지출 등록 완료!');
        });
      } }, '등록하기')
    ]));
  }

  return h(React.Fragment, null, modalContents);
};

// Main Entry Application Shell
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
  const [form, setForm] = useState({ name: '', dest: '', emoji: '✈️', start: new Date().toISOString().split('T')[0], end: '' });

  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const open = (m) => setMod(prev => ({ ...prev, [m]: true }));
  const close = (m) => setMod(prev => ({ ...prev, [m]: false }));

  useEffect(() => {
    const tc = localStorage.getItem('theme-color'); if(tc) document.documentElement.style.setProperty('--blue', tc);
    const ff = localStorage.getItem('font-family'); if(ff) document.documentElement.style.setProperty('--font', ff);
    
    return au.onAuthStateChanged(u => {
      if (u) {
        setUser(u);
        // Realtime user Profile Nickname sync
        db.collection('users').doc(u.uid).onSnapshot(d => {
          if (d.exists) {
            setProf(d.data());
          } else {
            // Setup default profile
            db.collection('users').doc(u.uid).set({ nickname: '여행자' });
          }
        });

        // Realtime User Trips sync
        db.collection('trips')
          .where('members', 'array-contains', u.uid)
          .onSnapshot(sn => {
            setTrips(sn.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b)=>b.createdAt - a.createdAt));
          });
      } else {
        au.signInAnonymously().catch(err => console.error('Auth Error:', err));
      }
    });
  }, []);

  const trip = trips.find(t => t.id === sid);
  const sync = (f, v) => db.collection('trips').doc(sid).update({ [f]: v });
  const total = trip?.expenses?.reduce((a, c) => a + Number(c.amount), 0) || 0;
  
  const commonProps = {
    trip,
    sync,
    prof,
    user,
    show,
    open,
    close,
    sid,
    setView,
    setSid,
    setSubTab,
    total
  };

  // 1. Detailed Screen
  if (view === 'detail' && trip) {
    return h('div', { className: 'app' }, [
      // Hero Header
      h('div', { className: 'detail-hero', style: { background: covers[trips.indexOf(trip) % covers.length], padding: '40px 20px 20px', position: 'relative' } }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
          h('button', { className: 'btn btn-pill btn-sm', style: { background: 'rgba(255,255,255,0.2)', color: '#fff' }, onClick: () => { setView('home'); setSid(null) } }, '← 홈'),
          h('div', { style: { display: 'flex', gap: 10 } }, [
            h('button', { className: 'icon-btn', style: { background: 'rgba(255,255,255,0.2)', color: '#fff' }, onClick: () => open('editTrip') }, h(I, { n: 'edit', s: 18 })),
            h('button', { className: 'icon-btn', style: { background: 'rgba(255,255,255,0.2)', color: '#fff' }, onClick: () => {
              // Export full schedule table to Image
              html2canvas(document.querySelector('.tab-view')).then(canvas => {
                const link = document.createElement('a');
                const safeName = (trip.name || 'trip').replace(/[/\\?%*:|"<>]/g, '-');
                link.download = `${safeName}_전체일정.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                show('일정이미지 저장 완료!');
              }).catch(() => show('이미지 변환 실패', false));
            } }, h(I, { n: 'download', s: 18 }))
          ])
        ]),
        h('h2', { style: { color: '#fff', fontSize: 26, fontWeight: 900, marginTop: 14 } }, `${trip.emoji || '✈️'} ${trip.name}`),
        h('p', { style: { color: '#fff', fontSize: 13, opacity: 0.8, margin: '4px 0 0' } }, `코드: ${trip.id} | 목적지: ${trip.destination || '미정'}`)
      ]),

      // Info Bar (Weather & D-Day status)
      h(InfoBar, { trip }),

      // Premium Sub Tabs list
      h('div', { className: 'sub-tabs-container', style: { width: '100%', overflowX: 'auto', background: '#fff', borderBottom: '1px solid var(--sep)' } }, [
        h('div', { className: 'sub-tabs', style: { display: 'flex', gap: 8, padding: '12px 20px', minWidth: 'max-content' } }, [
          { id: 'route', l: '🗓️ 일정' },
          { id: 'summary', l: '📊 요약' },
          { id: 'flight', l: '🛫 출발/귀국' },
          { id: 'money', l: '💰 가계부' },
          { id: 'check', l: '✅ 체크' },
          { id: 'memo', l: '📝 메모' },
          { id: 'photo', l: '📷 사진' }
        ].map(t => h('button', { key: t.id, className: 'sub-tab' + (subTab === t.id ? ' on' : ''), onClick: () => setSubTab(t.id) }, t.l)))
      ]),

      // Active Sub-Tab View Pane
      h('div', { className: 'tab-view' }, [
        subTab === 'route' && h(TRoute, commonProps),
        subTab === 'summary' && h(TSummary, commonProps),
        subTab === 'flight' && h(TFlight, commonProps),
        subTab === 'money' && h(TMoney, commonProps),
        subTab === 'check' && h(TCheck, commonProps),
        subTab === 'memo' && h(TMemo, commonProps),
        subTab === 'photo' && h(TPhoto, commonProps)
      ]),

      // Modals Manager
      h(M, { ...commonProps, mod, toast, form, setForm })
    ]);
  }

  // 2. Home Navigation Views
  return h('div', { className: 'app' }, [
    mainTab === 'trips' && h(TripsView, { trips, user, open, setSid, setView, setSubTab, show, prof }),
    mainTab === 'dday' && h(DDayView, { trips, setSid, setView }),
    mainTab === 'stats' && h(StatsView, { trips }),
    mainTab === 'settings' && h(SettingsView, { prof, user, open }),
    h(M, { mod, toast, user, prof, open, close, show, form, setForm, trip }),
    h('div', { className: 'bottom-bar' }, [
      { id: 'trips', l: '여행', i: 'flight' },
      { id: 'dday', l: 'D-Day', i: 'event' },
      { id: 'stats', l: '통계', i: 'bar_chart' },
      { id: 'settings', l: '설정', i: 'settings' }
    ].map(t => h('button', { key: t.id, className: 'bb-item' + (mainTab === t.id ? ' on' : ''), onClick: () => setMainTab(t.id) }, [
      h(I, { n: t.i, s: 24 }),
      h('span', null, t.l)
    ])))
  ]);
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
