import {usePage} from '../context.tsx';
export function PlayPage(){
 const {locale,asset}=usePage();const L=(en:string,he:string)=>locale==='he'?he:en;
 return <div className="partimento-page"><header className="partimento-intro"><div><p className="eyebrow">{L('THE ART OF FINISHING A THOUGHT','האמנות של השלמת מחשבה')}</p><h1>{L('Partimento','פרטימנטו')}</h1></div><p>{L('A bass line, a blank stave, and a patient companion. Learn to give each voice something worth saying.','קו בס, חמשה ריקה ושותף סבלני. ללמוד לתת לכל קול משהו שכדאי לומר.')}</p></header><section className="partimento-app" data-partimento aria-label={L('Partimento composition game','משחק הלחנה בפרטימנטו')} tabIndex={-1}><p>{L('Opening your score…','פותחים את הפרטיטורה…')}</p></section><noscript>{L('Enable JavaScript to write and hear your composition.','יש להפעיל JavaScript כדי לכתוב ולשמוע את היצירה.')}</noscript><script type="module" src={asset('/assets/partimento.js')}/></div>;
}
