import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import Studio from '../../studio/app/studio';
import {connectSession} from '../../studio/app/transport';

function Admin() {
  const [connected,setConnected]=useState(false);
  const [opened,setOpened]=useState(false);
  const [message,setMessage]=useState('');
  const [he,setHe]=useState(false);
  useEffect(()=>{
    setHe(navigator.language.startsWith('he'));
    const status=(event:Event)=>{const detail=(event as CustomEvent).detail;setConnected(detail.connected);setMessage(detail.message);if(detail.connected)setOpened(true);};
    window.addEventListener('datta-session',status);
    return()=>window.removeEventListener('datta-session',status);
  },[]);
  const L=(en:string,hebrew:string)=>he?hebrew:en;
  if(opened)return <><div className={'session-strip '+(connected?'connected':'')}><span role="status">{connected?L('● Private session connected','● החיבור הפרטי פעיל'):message}</span>{!connected&&<button onClick={connectSession}>{L('Reconnect private session','חיבור מחדש')}</button>}<a href={`/datta/${he?'he':'en'}/`}>{L('← Back to DATTA','חזרה ל-DATTA →')}</a></div><Studio/></>;
  return <div className="admin-entry" dir={he?'rtl':'ltr'}><header className="studio-header"><a className="wordmark" href={`/datta/${he?'he':'en'}/`}>DATTA <span lang="he">דאטא</span></a><button onClick={()=>setHe(!he)}>{he?'English':'עברית'}</button></header><main className="admin-welcome"><p className="eyebrow">{L('YOUR PRIVATE NOTEBOOK','המחברת הפרטית שלך')}</p><h1>{L('A little room for a big thought.','מקום קטן למחשבה גדולה.')}</h1><p className="welcome-copy">{L('Write, research, and publish. Right here in DATTA.','לכתוב, לחקור ולפרסם. כאן ב-DATTA.')}</p><div className="welcome-actions"><button className="primary" onClick={connectSession}>{L('Connect private session ↗','חיבור לסביבה הפרטית ↗')}</button><a href={`/datta/${he?'he':'en'}/`}>{L('Back to the site','חזרה לאתר')}</a></div><p className="session-help">{L('Sign in with ChatGPT in the window that opens. Keep it open while you write; your editor stays here.','יש להתחבר עם ChatGPT בחלון שייפתח ולהשאיר אותו פתוח בזמן העבודה. העורך נשאר כאן.')}</p><p className="session-status" role="status">{message}</p><div className="welcome-notes"><div><span>01</span><h2>{L('Follow an idea','ללכת בעקבות רעיון')}</h2><p>{L('Private drafts, diagrams, equations, and a second mind in the margins.','טיוטות פרטיות, תרשימים, משוואות ושותף למחשבה בשולי הדף.')}</p></div><div><span>02</span><h2>{L('Keep both voices','לשמור על שני הקולות')}</h2><p>{L('English and Hebrew, side by side. Your original design and words.','עברית ואנגלית, זו לצד זו. העיצוב והמילים שלך.')}</p></div><div><span>03</span><h2>{L('Publish with care','לפרסם בביטחון')}</h2><p>{L('Preview, review changes, and release after the checks pass.','תצוגה מקדימה, סקירת שינויים ופרסום אחרי הבדיקות.')}</p></div></div></main></div>;
}
createRoot(document.getElementById('studio-root')!).render(<Admin/>);
