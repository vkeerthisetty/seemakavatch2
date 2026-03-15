import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

declare global { interface Window { L: any; } }

const LAND_ICPS = [
  { id:'wagah',     name:'Wagah–Attari ICP',     lat:31.6047, lng:74.5742, country:'Pakistan',   alert:'HIGH',     travellers:8240,  cargo_cr:42,  personnel:340, detail:'Largest road ICP. BSF ceremonial retreat parade daily. Only road crossing between India and Pakistan.' },
  { id:'nathu',     name:'Nathu La Pass ICP',     lat:27.3905, lng:88.8301, country:'China',      alert:'ELEVATED', travellers:412,   cargo_cr:8,   personnel:120, detail:'High-altitude pass at 14,140 ft in Sikkim. Seasonal closure Nov–May. ITBP deployed.' },
  { id:'petrapole', name:'Petrapole ICP',          lat:23.0081, lng:88.8881, country:'Bangladesh', alert:'NORMAL',   travellers:5621,  cargo_cr:31,  personnel:280, detail:'Busiest land ICP in India. ₹180 Cr weekly trade with Bangladesh.' },
  { id:'moreh',     name:'Moreh ICP',              lat:24.2595, lng:94.2700, country:'Myanmar',    alert:'HIGH',     travellers:904,   cargo_cr:4,   personnel:160, detail:'Gateway to Southeast Asia. High infiltration risk from insurgent groups.' },
  { id:'raxaul',    name:'Raxaul–Birgunj ICP',     lat:26.9918, lng:84.8417, country:'Nepal',      alert:'NORMAL',   travellers:3102,  cargo_cr:18,  personnel:190, detail:'Busiest Nepal ICP. Open treaty border — no visa required for Nepali nationals.' },
  { id:'dawki',     name:'Dawki ICP',               lat:25.1929, lng:92.0261, country:'Bangladesh', alert:'NORMAL',   travellers:1200,  cargo_cr:6,   personnel:140, detail:'Key trade route in Meghalaya. Crystal-clear Umngot river crossing.' },
  { id:'attari',    name:'Attari Rail ICP',          lat:31.7213, lng:74.6015, country:'Pakistan',   alert:'ELEVATED', travellers:2400,  cargo_cr:22,  personnel:180, detail:'Samjhauta Express rail crossing. Cargo freight active. BSF & Railway protection.' },
];

const AIRPORTS = [
  { id:'igi',   name:'Indira Gandhi Intl.',        lat:28.5562, lng:77.1000, city:'New Delhi',   travellers:9842, cargo_cr:284, detail:'Largest international airport. 3 terminals, 60+ international airlines. CISF round the clock.' },
  { id:'csia',  name:'Chhatrapati Shivaji Intl.',  lat:19.0896, lng:72.8656, city:'Mumbai',      travellers:8210, cargo_cr:412, detail:'Second largest. Major cargo hub. Handles 40% of India\'s air cargo.' },
  { id:'mae',   name:'Chennai International',      lat:12.9941, lng:80.1709, city:'Chennai',     travellers:3420, cargo_cr:98,  detail:'Major Southeast Asia hub. Heavy SriLankan and Malaysian Air traffic.' },
  { id:'kia',   name:'Kempegowda International',   lat:13.1986, lng:77.7066, city:'Bengaluru',   travellers:3180, cargo_cr:86,  detail:'Fastest growing airport. IT hub gateway.' },
  { id:'hyd',   name:'Rajiv Gandhi International', lat:17.2403, lng:78.4294, city:'Hyderabad',   travellers:2940, cargo_cr:72,  detail:'Modern airport with pharma export hub.' },
  { id:'ccj',   name:'Calicut International',      lat:11.1368, lng:75.9553, city:'Kozhikode',   travellers:1820, cargo_cr:42,  detail:'Major NRI gateway. High Gulf air traffic.' },
  { id:'cok',   name:'Cochin International',       lat:10.1520, lng:76.4019, city:'Kochi',       travellers:2100, cargo_cr:58,  detail:'First PPP airport in India. Major Gulf corridor.' },
  { id:'gau',   name:'Lokpriya Gopinath Intl.',    lat:26.1061, lng:91.5859, city:'Guwahati',    travellers:1240, cargo_cr:32,  detail:'Gateway to Northeast India. Near China & Bangladesh borders.' },
  { id:'ixr',   name:'Birsa Munda Airport',        lat:23.3143, lng:85.3217, city:'Ranchi',      travellers:680,  cargo_cr:18,  detail:'Regional hub for Jharkhand. Mineral cargo movement.' },
  { id:'amd',   name:'Sardar Vallabhbhai Intl.',   lat:23.0771, lng:72.6347, city:'Ahmedabad',   travellers:2400, cargo_cr:54,  detail:'Major Western India hub. Diamond and textile exports.' },
  { id:'blr2',  name:'Chandigarh Airport',         lat:30.6735, lng:76.7885, city:'Chandigarh',  travellers:980,  cargo_cr:22,  detail:'Joint civil-military airport. Gateway to Himachal & Punjab.' },
];

const SEAPORTS = [
  { id:'mbpt',  name:'Mumbai Port',             lat:18.9500, lng:72.8431, type:'Major',     cargo_cr:1840, ships:380, detail:'Largest seaport. 65% of container imports. Major crude oil terminal.' },
  { id:'jnpt',  name:'JNPT (Nhava Sheva)',      lat:18.9488, lng:72.9355, type:'Container', cargo_cr:2240, ships:620, detail:'Busiest container port — 4.5M TEUs/year. High surveillance for contraband.' },
  { id:'chpt',  name:'Chennai Port',            lat:13.0827, lng:80.2921, type:'Container', cargo_cr:920,  ships:280, detail:'Second largest container port. Auto exports hub.' },
  { id:'coch',  name:'Cochin Port',             lat:9.9312,  lng:76.2673, type:'Container', cargo_cr:680,  ships:210, detail:'International transshipment terminal. Spice trade heritage port.' },
  { id:'kopt',  name:'Kolkata Port (Haldia)',   lat:22.0667, lng:88.0667, type:'Major',     cargo_cr:480,  ships:190, detail:'Oldest major port. Gateway to Northeast India.' },
  { id:'vizag', name:'Visakhapatnam Port',      lat:17.6868, lng:83.2185, type:'Major',     cargo_cr:560,  ships:240, detail:'Major eastern port. Naval base adjacent. Iron ore and coal hub.' },
  { id:'kand',  name:'Kandla Port (Deendayal)', lat:23.0333, lng:70.2167, type:'Major',     cargo_cr:780,  ships:190, detail:'Largest port by cargo volume. Petroleum and fertilizer hub.' },
  { id:'morm',  name:'Mormugao Port (Goa)',     lat:15.4200, lng:73.8000, type:'Major',     cargo_cr:320,  ships:120, detail:'Largest iron ore exporting port. Cruise terminal active.' },
  { id:'pard',  name:'Paradip Port',            lat:20.3167, lng:86.6167, type:'Major',     cargo_cr:440,  ships:160, detail:'Major east coast port. Coal and fertilizer hub.' },
  { id:'toot',  name:'V.O.C. Port (Tuticorin)', lat:8.7642,  lng:78.1348, type:'Container', cargo_cr:360,  ships:140, detail:'Southernmost major port. Salt export hub. Gateway to Sri Lanka.' },
  { id:'mang',  name:'New Mangalore Port',      lat:12.9240, lng:74.8220, type:'Major',     cargo_cr:290,  ships:110, detail:'Important petroleum products port. Cashew and coffee exports.' },
];

const DRONE_ZONES = [
  { lat:32.0, lng:74.8, r_km:80, name:'Punjab–J&K Drone Grid',  units:4, status:'ACTIVE'  },
  { lat:27.0, lng:71.0, r_km:70, name:'Rajasthan Aerial Watch', units:3, status:'ACTIVE'  },
  { lat:23.5, lng:89.0, r_km:75, name:'WB–BGD Corridor',        units:3, status:'ACTIVE'  },
  { lat:24.5, lng:94.5, r_km:65, name:'Manipur High-Risk',      units:2, status:'ACTIVE'  },
  { lat:27.5, lng:88.8, r_km:55, name:'Sikkim–China Watch',     units:2, status:'STANDBY' },
  { lat:34.0, lng:74.5, r_km:60, name:'J&K Northern Grid',      units:5, status:'ACTIVE'  },
];

const FENCING = [
  { name:'India–Pakistan (J&K)',      coords:[[34.5,73.9],[33.5,73.8],[32.5,74.0],[31.8,74.4],[31.2,74.5],[30.6,74.4],[30.0,73.5]], color:'#f59e0b', status:'Fully Fenced', km:553 },
  { name:'India–Pakistan (Rajasthan)',coords:[[30.0,73.5],[29.4,72.8],[28.7,71.9],[28.0,71.2],[27.3,70.5],[26.6,70.2]], color:'#f59e0b', status:'Fully Fenced', km:1037 },
  { name:'India–Bangladesh (WB)',     coords:[[24.5,88.5],[23.8,88.7],[23.2,88.9],[22.7,89.1],[22.2,89.3],[21.9,89.6]], color:'#22c55e', status:'Partially Fenced', km:2216 },
  { name:'India–Bangladesh (Assam)', coords:[[24.5,88.5],[25.0,89.5],[25.5,90.5],[26.0,91.5],[26.3,92.0]], color:'#22c55e', status:'Under Construction', km:925 },
];

const IR_CAMS = [
  {lat:32.5,lng:74.9},{lat:31.8,lng:74.6},{lat:31.1,lng:74.5},{lat:30.4,lng:74.4},
  {lat:29.7,lng:73.9},{lat:29.0,lng:72.5},{lat:23.2,lng:88.9},{lat:23.5,lng:89.2},
  {lat:24.0,lng:89.0},{lat:24.2,lng:94.1},{lat:27.1,lng:88.5},{lat:33.5,lng:74.2},
];

const ALERT_COLOR: Record<string,string> = { HIGH:'#ef4444', ELEVATED:'#f59e0b', NORMAL:'#22c55e' };

export default function BorderMap() {
  const { user } = useAuth();
  if (user?.role !== 'officer') return <Navigate to="/dashboard" replace />;

  const mapRef   = useRef<HTMLDivElement>(null);
  const lRef     = useRef<any>(null);
  const grpRef   = useRef<Record<string,any>>({});
  const [sel,    setSel]   = useState<any>(null);
  const [layers, setLayers]= useState({ fencing:true,icps:true,airports:true,seaports:true,drones:false,ir:false });
  const [time,   setTime]  = useState(new Date());

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); },[]);

  useEffect(()=>{
    if(lRef.current) return;
    // Load Leaflet CSS
    const css=document.createElement('link');
    css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    // Load Leaflet JS
    const js=document.createElement('script');
    js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload=()=>init();
    document.head.appendChild(js);
    return()=>{ if(lRef.current){ lRef.current.remove(); lRef.current=null; } };
  },[]);

  function mkIcon(emoji:string, bg:string, size=28, pulse=false) {
    const shadow = pulse ? `box-shadow:0 0 0 0 ${bg}99;animation:ibms-pulse 1.8s infinite;` : `box-shadow:0 2px 6px rgba(0,0,0,0.35);`;
    return window.L.divIcon({
      html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;font-size:${size*0.52}px;${shadow}cursor:pointer;">${emoji}</div>`,
      className:'', iconSize:[size,size], iconAnchor:[size/2,size/2]
    });
  }

  function init() {
    if(!mapRef.current||lRef.current) return;
    const L=window.L;

    const map=L.map(mapRef.current,{
      center:[22.5,80.0], zoom:5,
      zoomControl:false,
      // India-focused bounds
      maxBounds:[[4,60],[40,102]],
      maxBoundsViscosity:0.8,
    });
    lRef.current=map;

    // OpenStreetMap Carto tiles — same as Google Maps quality
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom:18, minZoom:4,
    }).addTo(map);

    L.control.zoom({position:'topright'}).addTo(map);

    // Layer groups
    const g:Record<string,any>={};
    ['fencing','icps','airports','seaports','drones','ir'].forEach(k=>{ g[k]=L.layerGroup().addTo(map); });
    grpRef.current=g;

    // Inject animations
    const style=document.createElement('style');
    style.textContent=`
      @keyframes ibms-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.8)}70%{box-shadow:0 0 0 10px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
      .leaflet-tooltip{font-family:system-ui,sans-serif;font-size:12px;padding:4px 8px;}
      .leaflet-container{font-family:system-ui,sans-serif;}
    `;
    document.head.appendChild(style);

    // Fencing
    FENCING.forEach(seg=>{
      const line=L.polyline(seg.coords,{color:seg.color,weight:5,opacity:0.9,dashArray:seg.status==='Under Construction'?'12 8':undefined});
      line.addTo(g.fencing);
      line.on('click',()=>setSel({kind:'fence',data:seg}));
      line.bindTooltip(`<b>${seg.name}</b><br>${seg.km} km · ${seg.status}`,{sticky:true});
    });

    // Land ICPs
    LAND_ICPS.forEach(cp=>{
      const m=L.marker([cp.lat,cp.lng],{icon:mkIcon('🛂',ALERT_COLOR[cp.alert],30,cp.alert==='HIGH')});
      m.addTo(g.icps);
      m.on('click',()=>setSel({kind:'icp',data:cp}));
      m.bindTooltip(`<b>${cp.name}</b><br><span style="color:${ALERT_COLOR[cp.alert]};font-weight:700">${cp.alert}</span> · ${cp.travellers.toLocaleString('en-IN')}/day`,{sticky:true});
    });

    // Airports
    AIRPORTS.forEach(ap=>{
      const m=L.marker([ap.lat,ap.lng],{icon:mkIcon('✈',`#1d4ed8`,26)});
      m.addTo(g.airports);
      m.on('click',()=>setSel({kind:'airport',data:ap}));
      m.bindTooltip(`<b>${ap.name}</b><br>${ap.city} · ${ap.travellers.toLocaleString('en-IN')} pax/day`,{sticky:true});
    });

    // Seaports
    SEAPORTS.forEach(sp=>{
      const m=L.marker([sp.lat,sp.lng],{icon:mkIcon('⚓','#0e7490',26)});
      m.addTo(g.seaports);
      m.on('click',()=>setSel({kind:'seaport',data:sp}));
      m.bindTooltip(`<b>${sp.name}</b><br>₹${sp.cargo_cr} Cr/day · ${sp.ships} ships/month`,{sticky:true});
    });

    // Drone zones
    DRONE_ZONES.forEach(dz=>{
      const c=L.circle([dz.lat,dz.lng],{radius:dz.r_km*1000,color:'#7c3aed',fillColor:'#7c3aed',fillOpacity:0.06,weight:1.5,dashArray:'8 5'});
      c.addTo(g.drones);
      c.bindTooltip(`<b>${dz.name}</b><br>${dz.units} UAVs · ${dz.status}`,{sticky:true});
      L.marker([dz.lat,dz.lng],{icon:L.divIcon({html:`<div style="font-size:18px;color:#7c3aed;text-shadow:0 0 4px #7c3aed88;">🚁</div>`,className:'',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(g.drones);
    });

    // IR cameras
    IR_CAMS.forEach(cam=>{
      L.marker([cam.lat,cam.lng],{icon:L.divIcon({html:`<div style="width:10px;height:10px;border-radius:50%;background:#ea580c;border:1.5px solid rgba(255,255,255,0.7);box-shadow:0 0 6px #ea580c;"></div>`,className:'',iconSize:[10,10],iconAnchor:[5,5]})}).addTo(g.ir);
    });
  }

  // Sync layers
  useEffect(()=>{
    const L=window.L; if(!L||!lRef.current) return;
    Object.entries(layers).forEach(([k,v])=>{
      const grp=grpRef.current[k]; if(!grp) return;
      v ? grp.addTo(lRef.current) : lRef.current.removeLayer(grp);
    });
  },[layers]);

  const toggle=(k:keyof typeof layers)=>setLayers(l=>({...l,[k]:!l[k]}));

  const BTNS=[
    {key:'fencing'  as const,label:'Border Fencing',color:'#f59e0b',icon:'⚡'},
    {key:'icps'     as const,label:'Land ICPs',      color:'#ef4444',icon:'🛂'},
    {key:'airports' as const,label:'Airports',       color:'#1d4ed8',icon:'✈️'},
    {key:'seaports' as const,label:'Seaports',       color:'#0e7490',icon:'⚓'},
    {key:'drones'   as const,label:'Drone Zones',    color:'#7c3aed',icon:'🚁'},
    {key:'ir'       as const,label:'IR Cameras',     color:'#ea580c',icon:'📡'},
  ];

  const S: React.CSSProperties = {
    panelBg:   '#040c16' as any,
    cardBg:    'rgba(255,255,255,0.05)' as any,
    border:    '1px solid rgba(255,255,255,0.08)' as any,
  };

  function InfoCard({icon,label,val,color}:{icon:string;label:string;val:string|number;color:string}){
    return(
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:7,padding:'9px 11px',border:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{fontSize:15,marginBottom:3}}>{icon}</div>
        <div style={{color,fontWeight:800,fontSize:15}}>{val}</div>
        <div style={{color:'rgba(255,255,255,0.35)',fontSize:9,marginTop:2}}>{label}</div>
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 60px)',fontFamily:'system-ui,sans-serif',overflow:'hidden'}}>

      {/* TOP BAR */}
      <div style={{background:'#040c16',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'0 18px',flexShrink:0,display:'flex',alignItems:'center',height:48}}>
        <div style={{marginRight:20}}>
          <div style={{color:'#fff',fontWeight:800,fontSize:12,letterSpacing:0.5}}>INDIA STRATEGIC BORDER INTELLIGENCE MAP</div>
          <div style={{color:'rgba(255,200,60,0.7)',fontSize:8,letterSpacing:1.5}}>MINISTRY OF HOME AFFAIRS · CLASSIFIED · EXTERNAL AFFAIRS MINISTER VIEW</div>
        </div>
        <div style={{width:1,height:28,background:'rgba(255,255,255,0.1)',marginRight:18}}/>
        {[
          {val:'12.84L',     label:'TRAVELLERS/MO', color:'#4ade80'},
          {val:'1,247',      label:'FLAGGED',        color:'#f87171'},
          {val:'₹98,400 Cr', label:'MONTHLY TRADE',  color:'#fbbf24'},
          {val:'19',         label:'DRONE UNITS',    color:'#c084fc'},
          {val:'12',         label:'IR CAMERAS',     color:'#fb923c'},
        ].map((s,i)=>(
          <div key={i} style={{marginRight:18,textAlign:'center'}}>
            <div style={{color:s.color,fontWeight:800,fontSize:14,lineHeight:1.1}}>{s.val}</div>
            <div style={{color:'rgba(255,255,255,0.3)',fontSize:7,letterSpacing:0.8,marginTop:1}}>{s.label}</div>
          </div>
        ))}
        <div style={{marginLeft:'auto',padding:'3px 10px',background:'rgba(255,255,255,0.05)',borderRadius:4,border:'1px solid rgba(255,255,255,0.1)',textAlign:'center'}}>
          <div style={{color:'#4ade80',fontSize:8,fontWeight:800,letterSpacing:1}}>● LIVE</div>
          <div style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>{time.toLocaleTimeString('en-IN')}</div>
        </div>
      </div>

      {/* LAYER CONTROLS */}
      <div style={{background:'#060e18',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'5px 18px',flexShrink:0,display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
        <span style={{color:'rgba(255,255,255,0.3)',fontSize:9,fontWeight:700,letterSpacing:1,marginRight:4}}>LAYERS:</span>
        {BTNS.map(b=>(
          <button key={b.key} onClick={()=>toggle(b.key)} style={{
            padding:'4px 11px',borderRadius:4,fontSize:10,fontWeight:700,cursor:'pointer',letterSpacing:0.5,transition:'all 0.15s',
            background:layers[b.key]?b.color:'rgba(255,255,255,0.06)',
            color:layers[b.key]?'#fff':'rgba(255,255,255,0.45)',
            border:`1.5px solid ${layers[b.key]?b.color:'rgba(255,255,255,0.12)'}`,
            boxShadow:layers[b.key]?`0 0 10px ${b.color}55`:'none',
          }}>{b.icon} {b.label}</button>
        ))}
        <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.2)',fontSize:9}}>Scroll=zoom · Drag=pan · Click any marker for details</span>
      </div>

      {/* MAP + PANEL */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 340px',overflow:'hidden'}}>

        {/* Leaflet map */}
        <div ref={mapRef} style={{width:'100%',height:'100%'}}/>

        {/* RIGHT PANEL */}
        <div style={{background:'#040c16',borderLeft:'1px solid rgba(255,255,255,0.08)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flex:1,overflow:'auto',padding:'0 0 12px'}}>

            {!sel && (
              <div>
                <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                  <div style={{fontSize:8,color:'rgba(255,200,60,0.7)',fontWeight:800,letterSpacing:2,marginBottom:10}}>
                    NATIONAL OVERVIEW · {new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                    <InfoCard icon="👥" label="Travellers/month" val="12.84 Lakh" color="#4ade80"/>
                    <InfoCard icon="🏳️" label="Immigrants registered" val="2,840" color="#c084fc"/>
                    <InfoCard icon="🚨" label="Flagged entries" val="1,247" color="#f87171"/>
                    <InfoCard icon="💰" label="Monthly trade" val="₹98K Cr" color="#fbbf24"/>
                    <InfoCard icon="🚁" label="Drone units active" val="19" color="#a855f7"/>
                    <InfoCard icon="📡" label="IR camera posts" val="12" color="#fb923c"/>
                  </div>
                </div>
                <div style={{padding:'12px 16px'}}>
                  <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontWeight:800,letterSpacing:2,marginBottom:9}}>LAND ICPs — QUICK ACCESS</div>
                  {LAND_ICPS.map(cp=>(
                    <button key={cp.id} onClick={()=>setSel({kind:'icp',data:cp})} style={{
                      display:'flex',alignItems:'center',justifyContent:'space-between',
                      width:'100%',padding:'8px 10px',marginBottom:5,
                      background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',
                      borderLeft:`3px solid ${ALERT_COLOR[cp.alert]}`,borderRadius:0,
                      cursor:'pointer',color:'#fff',textAlign:'left'
                    }}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600}}>{cp.name}</div>
                        <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',marginTop:1}}>{cp.country}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:10,color:ALERT_COLOR[cp.alert],fontWeight:800}}>{cp.alert}</div>
                        <div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>{cp.travellers.toLocaleString('en-IN')}/day</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sel?.kind==='icp' && (()=>{
              const cp=sel.data; const ac=ALERT_COLOR[cp.alert];
              return(
                <div style={{padding:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:8,color:ac,fontWeight:800,letterSpacing:2,marginBottom:4}}>INTEGRATED CHECK POST</div>
                      <h3 style={{fontWeight:800,fontSize:14,color:'#fff',marginBottom:2}}>{cp.name}</h3>
                      <p style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>🌏 Border with {cp.country}</p>
                    </div>
                    <button onClick={()=>setSel(null)} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:5,width:26,height:26,color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:15}}>×</button>
                  </div>
                  <div style={{padding:'9px 12px',borderRadius:6,marginBottom:12,background:`${ac}18`,border:`1.5px solid ${ac}50`,color:ac,fontWeight:800,fontSize:12,textAlign:'center'}}>
                    {cp.alert==='HIGH'?'🚨':cp.alert==='ELEVATED'?'⚠️':'✅'} THREAT: {cp.alert}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:12}}>
                    <InfoCard icon="👥" label="Crossings/day"  val={cp.travellers.toLocaleString('en-IN')} color="#fff"/>
                    <InfoCard icon="👮" label="Personnel"       val={cp.personnel} color="#fff"/>
                    <InfoCard icon="💰" label="Trade (₹Cr/day)" val={cp.cargo_cr}  color="#fbbf24"/>
                    <InfoCard icon="📍" label="GPS"             val={`${cp.lat}°N`} color="#60a5fa"/>
                  </div>
                  <div style={{background:'rgba(255,255,255,0.03)',borderRadius:7,padding:'10px 12px',marginBottom:12,border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontWeight:800,letterSpacing:1.5,marginBottom:7}}>THIS MONTH</div>
                    {[{l:'Travellers',v:(cp.travellers*28).toLocaleString('en-IN'),c:'#4ade80'},{l:'Cargo Trade',v:`₹${(cp.cargo_cr*28).toLocaleString('en-IN')} Cr`,c:'#fbbf24'}].map(r=>(
                      <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',fontSize:11}}>
                        <span style={{color:'rgba(255,255,255,0.4)'}}>{r.l}</span>
                        <span style={{color:r.c,fontWeight:700}}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.7,background:'rgba(255,255,255,0.03)',padding:'10px 12px',borderRadius:7,border:'1px solid rgba(255,255,255,0.06)'}}>ℹ️ {cp.detail}</div>
                </div>
              );
            })()}

            {sel?.kind==='airport' && (()=>{
              const ap=sel.data;
              return(
                <div style={{padding:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:8,color:'#3b82f6',fontWeight:800,letterSpacing:2,marginBottom:4}}>INTERNATIONAL AIRPORT</div>
                      <h3 style={{fontWeight:800,fontSize:14,color:'#fff',marginBottom:2}}>{ap.name}</h3>
                      <p style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>✈️ {ap.city}</p>
                    </div>
                    <button onClick={()=>setSel(null)} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:5,width:26,height:26,color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:15}}>×</button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:12}}>
                    <InfoCard icon="👥" label="Pax/day"        val={ap.travellers.toLocaleString('en-IN')} color="#4ade80"/>
                    <InfoCard icon="💰" label="Cargo (₹Cr/day)" val={ap.cargo_cr} color="#fbbf24"/>
                    <InfoCard icon="📅" label="Monthly pax"    val={(ap.travellers*28).toLocaleString('en-IN')} color="#60a5fa"/>
                    <InfoCard icon="📍" label="Coordinates"     val={`${ap.lat}°N`} color="#94a3b8"/>
                  </div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.7,background:'rgba(255,255,255,0.03)',padding:'10px 12px',borderRadius:7,border:'1px solid rgba(255,255,255,0.06)'}}>ℹ️ {ap.detail}</div>
                </div>
              );
            })()}

            {sel?.kind==='seaport' && (()=>{
              const sp=sel.data;
              return(
                <div style={{padding:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:8,color:'#06b6d4',fontWeight:800,letterSpacing:2,marginBottom:4}}>MAJOR SEAPORT · {sp.type}</div>
                      <h3 style={{fontWeight:800,fontSize:14,color:'#fff',marginBottom:2}}>{sp.name}</h3>
                    </div>
                    <button onClick={()=>setSel(null)} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:5,width:26,height:26,color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:15}}>×</button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:12}}>
                    <InfoCard icon="💰" label="Cargo (₹Cr/day)"  val={sp.cargo_cr} color="#fbbf24"/>
                    <InfoCard icon="🚢" label="Ships/month"        val={sp.ships}    color="#60a5fa"/>
                    <InfoCard icon="📅" label="Monthly trade"     val={`₹${(sp.cargo_cr*28).toLocaleString('en-IN')} Cr`} color="#4ade80"/>
                    <InfoCard icon="🌊" label="Port type"          val={sp.type}     color="#94a3b8"/>
                  </div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.7,background:'rgba(255,255,255,0.03)',padding:'10px 12px',borderRadius:7,border:'1px solid rgba(255,255,255,0.06)'}}>ℹ️ {sp.detail}</div>
                </div>
              );
            })()}

            {sel?.kind==='fence' && (()=>{
              const seg=sel.data;
              return(
                <div style={{padding:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:8,color:seg.color,fontWeight:800,letterSpacing:2,marginBottom:4}}>BORDER FENCING</div>
                      <h3 style={{fontWeight:800,fontSize:14,color:'#fff',marginBottom:2}}>{seg.name}</h3>
                    </div>
                    <button onClick={()=>setSel(null)} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:5,width:26,height:26,color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:15}}>×</button>
                  </div>
                  <div style={{padding:'9px',borderRadius:6,marginBottom:12,textAlign:'center',background:`${seg.color}18`,border:`1.5px solid ${seg.color}50`,color:seg.color,fontWeight:800,fontSize:12}}>
                    {seg.status==='Fully Fenced'?'✅':seg.status==='Partially Fenced'?'⚠️':'🚧'} {seg.status.toUpperCase()}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                    <InfoCard icon="📏" label="Total length" val={`${seg.km} km`} color="#fff"/>
                    <InfoCard icon="🌍" label="Border" val={seg.name.includes('Pakistan')?'Pakistan':'Bangladesh'} color="#fbbf24"/>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Footer */}
          <div style={{padding:'10px 16px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',fontWeight:800,letterSpacing:2,marginBottom:7}}>INDIA BORDER FACTS</div>
            {[
              {l:'Total Land Border',val:'15,106 km'},
              {l:'Total Coastline',  val:'7,516 km'},
              {l:'Bordering Nations',val:'7 countries'},
              {l:'Fenced (Pakistan)',val:'2,289 km'},
              {l:'Fenced (BGD)',      val:'3,141 km'},
              {l:'Notified ICPs',    val:'14 active'},
            ].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',fontSize:10}}>
                <span style={{color:'rgba(255,255,255,0.3)'}}>{r.l}</span>
                <span style={{color:'rgba(255,255,255,0.65)',fontWeight:700}}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
