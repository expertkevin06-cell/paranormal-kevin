export const DEFAULTS = {
  mode:'camthlidar',
  layers:{ rgb:true, th:true, depth:true },
  fusionMode:'msx',
  palette:'ironbow', unit:'C', emissivity:0.95,
  agc:'auto', level:25, span:20, Tmin:-20, Tmax:550,
  hud:true, legend:true, hist:true, crosshair:true, hotspot:true, coldspot:true,
  isoOn:false, isoStep:5, isoAbove:60,
  meshOn:true, dotStep:14, meshAlpha:0.6, pointSize:1.6,
  night:false,
  ai:{ detect:true },
  depth:{ connected:true, fps:8, hd:false },
  anomaly:{ enabled:true, thSd:3.5, magSd:3.5, audioSd:3, motion:12, prox:0.35,
            autoSnap:false, vibrate:true },
  evp:{ enabled:false },
  expert:{ stack:4, denoise:0.35, sharpen:0.6, clahe:0.4, sat:1.05, vibrance:0.25,
           contrast:1.06, gamma:1.0, wb:'auto', kelvin:5500, vignette:0.15,
           detailTransfer:0.55, grid:true, zebra:false, peaking:false, horizon:true },
  cam:{ torch:false, zoom:1, exposure:0, kelvinCam:0, focus:0 },
  photo:{ format:'png', scale:2 },
  video:{ fps:30, bitrate:8, mime:'auto', mic:false },
  net:{ autoQuality:true, cloudReport:false, prefetchHD:true, sync:true },
  llm:{ provider:'none', key:'' },
  align:{ sx:1, sy:1, ox:0, oy:0, mirror:false },
  usb:{ vid:'', pid:'', iface:0, epIn:130, fmt:'u16temp', w:256, h:192, hdr:0,
        magic:'', endian:'le', scale:0.01, offset:0, pkt:16384 }
};
export const S = (()=>{ try{ return Object.assign(structuredClone(DEFAULTS), JSON.parse(localStorage.getItem('pk.s')||'{}')); }
  catch{ return structuredClone(DEFAULTS); } })();
export const save = ()=> localStorage.setItem('pk.s', JSON.stringify(S));
export const view = { z:1, x:0, y:0 };
export const runtime = { online:navigator.onLine, net:'—', tier:'medium', rgb:null, depth:null,
  boxes:[], temps:null, hist:null, tilt:{beta:0,gamma:0}, gps:null, fx:{zebra:null,peak:null},
  processing:false, flash:0, motion:0, near:0, mag:0, para:0 };
