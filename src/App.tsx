import { useMemo, useState } from 'react';

type GoalType = 'QUIT' | 'REDUCE';
type GoalUnit = 'SMOKING_DAYS_PER_MONTH' | 'CIGARETTES_PER_DAY' | 'CIGARETTES_PER_WEEK' | 'CIGARETTES_PER_MONTH';
type Intensity = 'GENTLE' | 'BALANCED' | 'INTENSIVE';

type Profile = {
  averageCigarettesPerDay: number;
  smokingDaysPerWeek: number;
  cigarettesPerWeek: number;
  consumptionIsRegular: boolean;
  contexts: string[];
  firstCigarette: string;
  triggers: string[];
  goalType: GoalType;
  goalUnit: GoalUnit;
  goalAmount: number;
  durationMonths: number;
  intensity: Intensity;
  packPrice: number;
};

type DailyEntry = { date: string; cigarettes: number; exposures?: string[] };

type PlanMonth = {
  month: number;
  reference: number;
  pointsTarget: number;
  smokeFreeDaysTarget: number;
};

const initialProfile: Profile = {
  averageCigarettesPerDay: 10,
  smokingDaysPerWeek: 7,
  cigarettesPerWeek: 70,
  consumptionIsRegular: true,
  contexts: [],
  firstCigarette: '30_TO_60_MIN',
  triggers: [],
  goalType: 'QUIT',
  goalUnit: 'SMOKING_DAYS_PER_MONTH',
  goalAmount: 0,
  durationMonths: 5,
  intensity: 'BALANCED',
  packPrice: 5.5,
};

const onboardingSteps = [
  'Bienvenida',
  'Consumo',
  'Frecuencia',
  'Semana',
  'Patrón',
  'Primer cigarrillo',
  'Momentos',
  'Objetivo',
  'Meta',
  'Duración',
  'Ritmo',
  'Resumen',
];

const contextOptions = ['Fines de semana', 'Fiesta', 'Alcohol', 'Trabajo', 'Estrés', 'Otro'];
const triggerOptions = ['Café', 'Después de comer', 'Trabajo', 'Descansos', 'Alcohol', 'Fiesta', 'Con amigos', 'Estrés', 'Aburrimiento', 'Conduciendo', 'Antes de dormir'];

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseLocalDate(dateKey));
}

function getLastSevenDays() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return localDateKey(date);
  });
}

function addDays(dateKey: string, days: number) {
  const date = parseLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function getPlanMonthDates(startDateKey: string, monthIndex: number) {
  const firstDayOffset = monthIndex * 30;
  return Array.from({ length: 30 }, (_, index) => addDays(startDateKey, firstDayOffset + index));
}

function getPlanPosition(dateKey: string, startDateKey: string, totalMonths: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.max(
    0,
    Math.floor((parseLocalDate(dateKey).getTime() - parseLocalDate(startDateKey).getTime()) / dayMs)
  );
  const maxPlanDay = Math.max(0, totalMonths * 30 - 1);
  const boundedDays = Math.min(elapsedDays, maxPlanDay);

  return {
    monthIndex: clamp(Math.floor(boundedDays / 30), 0, Math.max(0, totalMonths - 1)),
    dayInMonth: (boundedDays % 30) + 1,
  };
}

function smokeFreeScoringReference(profile: Profile, plan: PlanMonth[], monthIndex: number) {
  return monthIndex === 0
    ? profile.averageCigarettesPerDay
    : plan[monthIndex - 1].reference;
}

function isQuantityGoal(profile: Profile) {
  return profile.goalType === 'REDUCE' && profile.goalUnit !== 'SMOKING_DAYS_PER_MONTH';
}

function finalDailyQuantityTarget(profile: Profile) {
  if (profile.goalUnit === 'CIGARETTES_PER_DAY') return Math.max(0, profile.goalAmount);
  if (profile.goalUnit === 'CIGARETTES_PER_WEEK') return Math.max(0, profile.goalAmount / 7);
  if (profile.goalUnit === 'CIGARETTES_PER_MONTH') return Math.max(0, profile.goalAmount / 30);
  return 0;
}

function generatePlan(profile: Profile): PlanMonth[] {
  const months = profile.durationMonths;
  const startRef = Math.max(1, profile.averageCigarettesPerDay);
  const intensityFactor = profile.intensity === 'GENTLE' ? 0.85 : profile.intensity === 'INTENSIVE' ? 1.15 : 1;
  const quantityGoal = isQuantityGoal(profile);

  let finalRef = 0;
  let finalSmokeFreeDays = 30;

  if (profile.goalType === 'REDUCE') {
    if (quantityGoal) {
      finalRef = finalDailyQuantityTarget(profile);
      finalSmokeFreeDays = 0;
    } else {
      finalRef = Math.max(1, startRef * 0.25);
      finalSmokeFreeDays = clamp(30 - profile.goalAmount, 0, 30);
    }
  }

  return Array.from({ length: months }, (_, i) => {
    const progress = (i + 1) / months;
    const curved = Math.pow(progress, profile.intensity === 'GENTLE' ? 1.25 : profile.intensity === 'INTENSIVE' ? 0.8 : 1);
    const reference = Math.max(finalRef, startRef - (startRef - finalRef) * curved);

    if (quantityGoal) {
      return {
        month: i + 1,
        reference: Math.round(reference * 10) / 10,
        pointsTarget: 30,
        smokeFreeDaysTarget: 0,
      };
    }

    const smokeFreeDaysTarget = Math.round(finalSmokeFreeDays * curved);
    const basePoints = smokeFreeDaysTarget + (30 - smokeFreeDaysTarget) * 0.16;
    const pointsTarget = Math.round(basePoints * intensityFactor * 10) / 10;
    return {
      month: i + 1,
      reference: Math.round(reference * 10) / 10,
      pointsTarget: clamp(pointsTarget, 2, 30),
      smokeFreeDaysTarget: clamp(smokeFreeDaysTarget, 1, 30),
    };
  });
}

function scoreSmokeFreeGoalDay(cigarettes: number, reference: number) {
  if (cigarettes === 0) return 1;

  const safeReference = Math.max(reference, 1);
  const ratio = cigarettes / safeReference;

  // En los planes orientados a conseguir días sin fumar, el 0 sigue siendo
  // claramente el mejor resultado (1 punto). Pero cada cigarrillo evitado
  // debe notarse: los días con consumo reducido puntúan de forma continua,
  // hasta un máximo inferior a 0,7 para no equipararlos a un día a cero.
  if (ratio >= 1) return 0;

  const score = 0.7 * (1 - ratio);
  return Math.round(clamp(score, 0, 0.7) * 100) / 100;
}

function scoreQuantityGoalDay(cigarettes: number, target: number, baseline: number) {
  if (target <= 0) return cigarettes === 0 ? 1 : 0;
  if (cigarettes <= target) {
    const bonus = ((target - cigarettes) / target) * 0.25;
    return Math.round((1 + bonus) * 100) / 100;
  }

  const distance = Math.max(1, baseline - target);
  const score = 1 - (cigarettes - target) / distance;
  return Math.round(clamp(score, 0, 1) * 100) / 100;
}

function scoringReference(profile: Profile, month: PlanMonth, smokeFreeReference: number) {
  return isQuantityGoal(profile) ? month.reference : smokeFreeReference;
}

function scoreDay(
  cigarettes: number,
  profile: Profile,
  month: PlanMonth,
  smokeFreeReference: number,
  exposures: string[] = []
) {
  const baseScore = isQuantityGoal(profile)
    ? scoreQuantityGoalDay(cigarettes, month.reference, profile.averageCigarettesPerDay)
    : scoreSmokeFreeGoalDay(cigarettes, smokeFreeReference);

  const reference = scoringReference(profile, month, smokeFreeReference);
  const eligibleExposures = cigarettes < reference ? Math.min(exposures.length, 2) : 0;

  if (eligibleExposures === 0 || baseScore <= 0) return baseScore;

  const multiplier = 1 + eligibleExposures * 0.1;
  const boostedScore = baseScore * multiplier;

  // El bonus de exposición puede elevar un día hasta 1,20 puntos.
  // Si otro sistema de puntuación ya daba más de 1,20, no lo rebajamos.
  const cap = Math.max(baseScore, 1.2);
  return Math.round(Math.min(boostedScore, cap) * 100) / 100;
}

function Choice({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`choice ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
}

function Stepper({ value, onChange, min = 0, max = 100, suffix = '' }: { value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="stepper">
      <button aria-label="Restar" onClick={() => onChange(clamp(value - 1, min, max))}>−</button>
      <div><strong>{value}</strong><span>{suffix}</span></div>
      <button aria-label="Sumar" onClick={() => onChange(clamp(value + 1, min, max))}>+</button>
    </div>
  );
}

function App() {
  const storedProfile = localStorage.getItem('bruma-profile');
  const storedEntries = localStorage.getItem('bruma-entries');
  const [profile, setProfile] = useState<Profile>(storedProfile ? JSON.parse(storedProfile) : initialProfile);
  const [entries, setEntries] = useState<DailyEntry[]>(storedEntries ? JSON.parse(storedEntries) : []);
  const [step, setStep] = useState(storedProfile ? 12 : 0);
  const [tab, setTab] = useState<'home' | 'today' | 'stats' | 'plan'>('home');
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [todayCigs, setTodayCigs] = useState(0);
  const [todayExposures, setTodayExposures] = useState<string[]>([]);
  const [planStartDate, setPlanStartDate] = useState(() => {
    const storedStartDate = localStorage.getItem('bruma-plan-start-date');
    if (storedStartDate) return storedStartDate;

    const parsedEntries: DailyEntry[] = storedEntries ? JSON.parse(storedEntries) : [];
    const firstEntry = [...parsedEntries].sort((a, b) => a.date.localeCompare(b.date))[0];
    return firstEntry?.date ?? localDateKey();
  });
  const [dismissedMonthRecap, setDismissedMonthRecap] = useState(() =>
    Number(localStorage.getItem('bruma-dismissed-month-recap') ?? '-1')
  );

  const plan = useMemo(() => generatePlan(profile), [profile]);
  const todayKey = localDateKey();
  const currentPosition = getPlanPosition(todayKey, planStartDate, plan.length);
  const currentMonthIndex = currentPosition.monthIndex;
  const currentMonth = plan[currentMonthIndex];
  const quantityGoal = isQuantityGoal(profile);
  const currentMonthEntries = entries.filter(
    e => getPlanPosition(e.date, planStartDate, plan.length).monthIndex === currentMonthIndex
  );
  const currentSmokeFreeReference = smokeFreeScoringReference(profile, plan, currentMonthIndex);
  const currentPoints = currentMonthEntries.reduce(
    (sum, e) => sum + scoreDay(e.cigarettes, profile, currentMonth, currentSmokeFreeReference, e.exposures ?? []),
    0
  );
  const smokeFreeDays = currentMonthEntries.filter(e => e.cigarettes === 0).length;
  const daysMeetingTarget = currentMonthEntries.filter(e => e.cigarettes <= currentMonth.reference).length;
  const totalCigs = entries.reduce((sum, e) => sum + e.cigarettes, 0);
  const baselineForLoggedDays = entries.length * profile.averageCigarettesPerDay;
  const avoided = Math.max(0, Math.round(baselineForLoggedDays - totalCigs));
  const moneySaved = Math.round((avoided / 20) * profile.packPrice * 100) / 100;
  const recentDays = getLastSevenDays();
  const selectedEntry = entries.find(e => e.date === selectedDate);
  const selectedMonthIndex = getPlanPosition(selectedDate, planStartDate, plan.length).monthIndex;
  const selectedMonth = plan[selectedMonthIndex];
  const selectedSmokeFreeReference = smokeFreeScoringReference(profile, plan, selectedMonthIndex);
  const currentMonthDates = getPlanMonthDates(planStartDate, currentMonthIndex);
  const currentMonthTotalCigs = currentMonthEntries.reduce((sum, e) => sum + e.cigarettes, 0);
  const currentMonthAverage = currentMonthEntries.length
    ? currentMonthTotalCigs / currentMonthEntries.length
    : 0;
  const currentMonthSpend = (currentMonthTotalCigs / 20) * profile.packPrice;
  const currentMonthBaselineCigs = currentMonthEntries.length * currentSmokeFreeReference;
  const currentMonthAvoided = Math.max(0, Math.round(currentMonthBaselineCigs - currentMonthTotalCigs));
  const currentMonthSaved = (currentMonthAvoided / 20) * profile.packPrice;
  const chartMax = Math.max(
    currentSmokeFreeReference,
    currentMonth.reference,
    ...currentMonthEntries.map(e => e.cigarettes),
    1
  );

  const previousMonthIndex = currentMonthIndex - 1;
  const previousMonth = previousMonthIndex >= 0 ? plan[previousMonthIndex] : null;
  const previousMonthEntries = previousMonthIndex >= 0
    ? entries.filter(e => getPlanPosition(e.date, planStartDate, plan.length).monthIndex === previousMonthIndex)
    : [];
  const previousSmokeFreeReference = previousMonthIndex >= 0
    ? smokeFreeScoringReference(profile, plan, previousMonthIndex)
    : profile.averageCigarettesPerDay;
  const previousMonthPoints = previousMonth
    ? previousMonthEntries.reduce(
        (sum, e) => sum + scoreDay(e.cigarettes, profile, previousMonth, previousSmokeFreeReference, e.exposures ?? []),
        0
      )
    : 0;
  const previousMonthSmokeFreeDays = previousMonthEntries.filter(e => e.cigarettes === 0).length;
  const previousMonthDaysMeetingTarget = previousMonth
    ? previousMonthEntries.filter(e => e.cigarettes <= previousMonth.reference).length
    : 0;
  const previousMonthTotalCigs = previousMonthEntries.reduce((sum, e) => sum + e.cigarettes, 0);
  const previousMonthAverage = previousMonthEntries.length
    ? previousMonthTotalCigs / previousMonthEntries.length
    : 0;
  const previousMonthAvoided = Math.max(
    0,
    Math.round(previousMonthEntries.length * previousSmokeFreeReference - previousMonthTotalCigs)
  );
  const previousMonthSaved = (previousMonthAvoided / 20) * profile.packPrice;
  const previousMonthGoalMet = previousMonth
    ? quantityGoal
      ? previousMonthPoints >= previousMonth.pointsTarget
      : previousMonthPoints >= previousMonth.pointsTarget &&
        previousMonthSmokeFreeDays >= previousMonth.smokeFreeDaysTarget
    : false;
  const showMonthRecap =
    currentPosition.dayInMonth === 1 &&
    currentMonthIndex > 0 &&
    dismissedMonthRecap !== currentMonthIndex;

  function dismissMonthRecap() {
    localStorage.setItem('bruma-dismissed-month-recap', String(currentMonthIndex));
    setDismissedMonthRecap(currentMonthIndex);
  }

  const update = (patch: Partial<Profile>) => setProfile(p => ({ ...p, ...patch }));

  function next() {
    setStep(s => Math.min(s + 1, onboardingSteps.length - 1));
  }

  function savePlan() {
    const startDate = localDateKey();
    localStorage.setItem('bruma-profile', JSON.stringify(profile));
    localStorage.setItem('bruma-plan-start-date', startDate);
    setPlanStartDate(startDate);
    setStep(12);
    setTab('home');
  }

  function openDay(date: string) {
    const entry = entries.find(e => e.date === date);
    setSelectedDate(date);
    setTodayCigs(entry?.cigarettes ?? 0);
    setTodayExposures(entry?.exposures ?? []);
    setTab('today');
  }

  function saveDay() {
    const nextEntries = [
      ...entries.filter(e => e.date !== selectedDate),
      { date: selectedDate, cigarettes: todayCigs, exposures: todayExposures }
    ].sort((a, b) => a.date.localeCompare(b.date));
    setEntries(nextEntries);
    localStorage.setItem('bruma-entries', JSON.stringify(nextEntries));
    if (!localStorage.getItem('bruma-plan-start-date')) {
      localStorage.setItem('bruma-plan-start-date', planStartDate);
    }
    setTab('home');
  }

  function reset() {
    const confirmed = window.confirm(
      '¿Seguro que deseas reiniciar tu plan?\n\nSe borrarán tu perfil, todos tus registros y tu progreso guardado en este dispositivo. Esta acción no se puede deshacer.'
    );

    if (!confirmed) return;

    localStorage.removeItem('bruma-profile');
    localStorage.removeItem('bruma-entries');
    localStorage.removeItem('bruma-plan-start-date');
    localStorage.removeItem('bruma-dismissed-month-recap');
    setDismissedMonthRecap(-1);
    setProfile(initialProfile);
    setPlanStartDate(localDateKey());
    setEntries([]);
    setStep(0);
  }

  if (step < 12) {
    const progress = ((step + 1) / onboardingSteps.length) * 100;
    return (
      <main className="shell onboarding-shell">
        <div className="topbar">
          {step > 0 ? <button className="icon-button" onClick={() => setStep(s => s - 1)}>←</button> : <span />}
          <span className="brand">bruma</span>
          <span className="step-count">{step + 1}/{onboardingSteps.length}</span>
        </div>
        <div className="progress"><span style={{ width: `${progress}%` }} /></div>

        <section className="screen">
          {step === 0 && <>
            <div className="hero-mark">○</div>
            <p className="eyebrow">TU PLAN, TU RITMO</p>
            <h1>Reduce el tabaco<br />sin vivir contando fallos.</h1>
            <p className="lead">Vamos a conocer cómo fumas ahora y construir un plan que se adapte a tu objetivo real: reducir cantidad, reducir días de consumo o dejarlo por completo.</p>
            <div className="info-card"><b>2 minutos</b><span>Una pregunta cada vez. Sin registros ni contraseñas.</span></div>
            <button className="primary" onClick={next}>Crear mi plan</button>
          </>}

          {step === 1 && <>
            <p className="eyebrow">TU PUNTO DE PARTIDA</p>
            <h2>¿Cuántos cigarrillos fumas en un día normal?</h2>
            <p className="muted">No pienses en tu peor día. Queremos una cifra que te represente.</p>
            <Stepper value={profile.averageCigarettesPerDay} min={1} max={80} onChange={n => update({ averageCigarettesPerDay: n, cigarettesPerWeek: n * profile.smokingDaysPerWeek })} suffix="cigarrillos" />
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 2 && <>
            <p className="eyebrow">FRECUENCIA</p>
            <h2>¿Cuántos días a la semana sueles fumar?</h2>
            <div className="number-grid">
              {[1,2,3,4,5,6,7].map(n => <Choice key={n} active={profile.smokingDaysPerWeek === n} onClick={() => update({ smokingDaysPerWeek: n, cigarettesPerWeek: profile.averageCigarettesPerDay * n })}>{n}</Choice>)}
            </div>
            <p className="callout">{profile.smokingDaysPerWeek === 7 ? 'Ahora mismo fumas todos los días.' : `Ya tienes aproximadamente ${7-profile.smokingDaysPerWeek} día(s) libre(s) por semana.`}</p>
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 3 && <>
            <p className="eyebrow">UNA COMPROBACIÓN</p>
            <h2>Estimamos unos {profile.averageCigarettesPerDay * profile.smokingDaysPerWeek} cigarrillos por semana.</h2>
            <p className="muted">¿Se parece a tu consumo real?</p>
            <Stepper value={profile.cigarettesPerWeek} min={1} max={400} onChange={n => update({ cigarettesPerWeek: n })} suffix="por semana" />
            <p className="tiny">≈ {(profile.cigarettesPerWeek/20).toFixed(1)} paquetes de 20</p>
            <label className="price-field"><span>Precio aproximado de un paquete de 20</span><div><input type="number" min="0" step="0.10" value={profile.packPrice} onChange={e => update({ packPrice: Number(e.target.value) || 0 })} /><b>€</b></div></label>
            <button className="primary bottom" onClick={next}>Sí, continuar</button>
          </>}

          {step === 4 && <>
            <p className="eyebrow">TU PATRÓN</p>
            <h2>¿Fumas aproximadamente lo mismo todos los días?</h2>
            <div className="stack">
              <Choice active={profile.consumptionIsRegular} onClick={() => update({ consumptionIsRegular: true, contexts: [] })}><b>Sí, bastante parecido</b><small>Mi consumo es más o menos estable.</small></Choice>
              <Choice active={!profile.consumptionIsRegular} onClick={() => update({ consumptionIsRegular: false })}><b>No, algunos días fumo mucho más</b><small>Hay situaciones que disparan mi consumo.</small></Choice>
            </div>
            {!profile.consumptionIsRegular && <div className="chips">{contextOptions.map(x => <button key={x} className={profile.contexts.includes(x) ? 'chip active' : 'chip'} onClick={() => update({ contexts: toggle(profile.contexts, x) })}>{x}</button>)}</div>}
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 5 && <>
            <p className="eyebrow">DEPENDENCIA COTIDIANA</p>
            <h2>¿Cuánto tardas en fumar después de despertarte?</h2>
            <div className="stack">
              {[['UNDER_5_MIN','Menos de 5 minutos'],['5_TO_30_MIN','Entre 5 y 30 minutos'],['30_TO_60_MIN','Entre 30 y 60 minutos'],['OVER_60_MIN','Más de una hora'],['VARIABLE','Depende mucho del día']].map(([v,l]) => <Choice key={v} active={profile.firstCigarette===v} onClick={() => update({ firstCigarette:v })}>{l}</Choice>)}
            </div>
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 6 && <>
            <p className="eyebrow">TUS DISPARADORES</p>
            <h2>¿Cuándo te cuesta más no fumar?</h2>
            <p className="muted">Puedes elegir varios.</p>
            <div className="chips">{triggerOptions.map(x => <button key={x} className={profile.triggers.includes(x) ? 'chip active' : 'chip'} onClick={() => update({ triggers: toggle(profile.triggers, x) })}>{x}</button>)}</div>
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 7 && <>
            <p className="eyebrow">TU DESTINO</p>
            <h2>¿Dónde quieres llegar?</h2>
            <div className="stack">
              <Choice active={profile.goalType==='QUIT'} onClick={() => update({ goalType:'QUIT', goalAmount:0, goalUnit:'SMOKING_DAYS_PER_MONTH' })}><b>🚭 Dejarlo por completo</b><small>Mi objetivo final es no fumar.</small></Choice>
              <Choice active={profile.goalType==='REDUCE'} onClick={() => update({ goalType:'REDUCE', goalAmount:4, goalUnit:'SMOKING_DAYS_PER_MONTH' })}><b>📉 Reducir mucho mi consumo</b><small>Quiero seguir fumando, pero con límites claros.</small></Choice>
            </div>
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 8 && profile.goalType === 'QUIT' && <>
            <p className="eyebrow">OBJETIVO FINAL</p>
            <h2>Tu meta serán 30 días al mes sin fumar.</h2>
            <div className="big-stat"><strong>30</strong><span>días libres de tabaco</span></div>
            <p className="muted">No tendrás que conseguirlo mañana. El plan irá aumentando progresivamente los días sin fumar.</p>
            <button className="primary bottom" onClick={next}>Eso es lo que quiero</button>
          </>}

          {step === 8 && profile.goalType === 'REDUCE' && <>
            <p className="eyebrow">TU META</p>
            <h2>¿Cómo quieres expresar tu objetivo?</h2>
            <select value={profile.goalUnit} onChange={e => update({ goalUnit:e.target.value as GoalUnit })}>
              <option value="SMOKING_DAYS_PER_MONTH">Días que quiero fumar al mes</option>
              <option value="CIGARETTES_PER_DAY">Máximo de cigarrillos al día</option>
              <option value="CIGARETTES_PER_WEEK">Máximo de cigarrillos a la semana</option>
              <option value="CIGARETTES_PER_MONTH">Máximo de cigarrillos al mes</option>
            </select>
            <Stepper value={profile.goalAmount} min={profile.goalUnit==='SMOKING_DAYS_PER_MONTH' ? 1 : 0} max={profile.goalUnit==='SMOKING_DAYS_PER_MONTH' ? 29 : 200} onChange={n => update({ goalAmount:n })} suffix={profile.goalUnit==='SMOKING_DAYS_PER_MONTH' ? 'días con tabaco / mes' : 'cigarrillos'} />
            {profile.goalUnit==='SMOKING_DAYS_PER_MONTH' && <p className="callout">Tu objetivo real será conseguir <b>{30-profile.goalAmount} días sin fumar</b> cada mes.</p>}
            {profile.goalUnit!=='SMOKING_DAYS_PER_MONTH' && <p className="callout">Cumplir la cantidad objetivo de cada etapa contará como <b>objetivo diario cumplido</b>. Los días sin fumar serán un extra, no una obligación.</p>}
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 9 && <>
            <p className="eyebrow">EL PLAZO</p>
            <h2>¿Cuánto tiempo quieres darte?</h2>
            <div className="duration-grid">{[1,2,3,4,5,6,9,12].map(n => <Choice key={n} active={profile.durationMonths===n} onClick={() => update({ durationMonths:n })}><b>{n}</b><small>{n===1?'mes':'meses'}</small></Choice>)}</div>
            <button className="primary bottom" onClick={next}>Continuar</button>
          </>}

          {step === 10 && <>
            <p className="eyebrow">RITMO</p>
            <h2>¿Cómo quieres que sea el proceso?</h2>
            <div className="stack">
              <Choice active={profile.intensity==='GENTLE'} onClick={() => update({ intensity:'GENTLE' })}><b>Suave</b><small>Cambios pequeños y progresivos.</small></Choice>
              <Choice active={profile.intensity==='BALANCED'} onClick={() => update({ intensity:'BALANCED' })}><b>Equilibrado · recomendado</b><small>Un ritmo constante y asumible.</small></Choice>
              <Choice active={profile.intensity==='INTENSIVE'} onClick={() => update({ intensity:'INTENSIVE' })}><b>Intenso</b><small>Quiero objetivos exigentes desde pronto.</small></Choice>
            </div>
            <button className="primary bottom" onClick={next}>Ver mi plan</button>
          </>}

          {step === 11 && <>
            <p className="eyebrow">TODO LISTO</p>
            <h2>Este es tu punto de partida.</h2>
            <div className="summary-grid">
              <div><span>Ahora</span><strong>{profile.averageCigarettesPerDay}</strong><small>cigarrillos/día</small></div>
              <div><span>Frecuencia</span><strong>{profile.smokingDaysPerWeek}</strong><small>días/semana</small></div>
              <div><span>Plazo</span><strong>{profile.durationMonths}</strong><small>meses</small></div>
            </div>
            <div className="plan-preview">
              <p>Primer mes</p>
              <div><span>{isQuantityGoal(profile) ? 'Objetivo diario equivalente' : 'Referencia'}</span><b>{plan[0].reference} cig/día</b></div>
              <div><span>Objetivo de puntos</span><b>{plan[0].pointsTarget}</b></div>
              {isQuantityGoal(profile)
                ? <div><span>Cumplir la meta diaria</span><b>1 punto</b></div>
                : <div><span>Días sin fumar</span><b>{plan[0].smokeFreeDaysTarget}</b></div>}
            </div>
            <p className="muted">{isQuantityGoal(profile) ? 'Cumplir la cantidad marcada cada día vale 1 punto. Hacerlo mejor puede sumar un pequeño extra.' : 'Reducir te hará avanzar. Un día completo sin fumar siempre valdrá mucho más.'}</p>
            <button className="primary" onClick={savePlan}>Empezar mi plan</button>
          </>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell app-shell">
      <header className="app-header"><span className="brand">bruma</span><button className="avatar" onClick={reset}>↺</button></header>

      {tab === 'home' && <section className="dashboard">
        {showMonthRecap && previousMonth && <div className={`month-recap ${previousMonthGoalMet ? 'success' : ''}`}>
          <div className="month-recap-top">
            <div>
              <p className="eyebrow">MES {previousMonthIndex + 1} COMPLETADO</p>
              <h2>{previousMonthGoalMet ? 'Lo has conseguido.' : 'Mes cerrado. Seguimos.'}</h2>
            </div>
            <button onClick={dismissMonthRecap} aria-label="Cerrar resumen">×</button>
          </div>

          <p className="month-recap-message">
            {previousMonthGoalMet
              ? 'Has cumplido el objetivo que te marcaste para este mes. No ha hecho falta hacerlo perfecto: has acumulado días y decisiones que te acercan a donde quieres estar.'
              : 'No has llegado a todos los objetivos del mes, pero el progreso que has hecho cuenta. El siguiente mes parte de una referencia nueva y de todo lo que ya has aprendido.'}
          </p>

          <div className="month-recap-grid">
            <div><span>Puntos</span><strong>{previousMonthPoints.toFixed(1)}</strong><small>de {previousMonth.pointsTarget}</small></div>
            {quantityGoal
              ? <div><span>Días cumpliendo</span><strong>{previousMonthDaysMeetingTarget}</strong><small>de {previousMonthEntries.length} registrados</small></div>
              : <div><span>Días sin fumar</span><strong>{previousMonthSmokeFreeDays}</strong><small>objetivo {previousMonth.smokeFreeDaysTarget}</small></div>}
            <div><span>Media</span><strong>{previousMonthAverage.toFixed(1)}</strong><small>cig/día registrado</small></div>
            <div><span>Ahorro</span><strong>{previousMonthSaved.toFixed(2)} €</strong><small>{previousMonthAvoided} cig. evitados</small></div>
          </div>

          <div className="next-month-card">
            <span>Ahora empieza el mes {currentMonthIndex + 1}</span>
            <strong>{quantityGoal
              ? `Tu nuevo objetivo es ≤ ${currentMonth.reference} cig/día.`
              : `Tu nueva referencia es ${currentMonth.reference} cig/día y buscas ${currentMonth.smokeFreeDaysTarget} días sin fumar.`}</strong>
            <small>La referencia para valorar tus reducciones parte del nivel del mes anterior. Un día cada vez.</small>
          </div>

          <button className="primary month-recap-cta" onClick={dismissMonthRecap}>Empezar el nuevo mes</button>
        </div>}

        <p className="eyebrow">MES {currentMonthIndex + 1} · DÍA {currentPosition.dayInMonth}</p>
        <h1>Hoy cuenta.<br />No tiene que ser perfecto.</h1>

        <button className="today-card" onClick={() => openDay(todayKey)}>
          <span>Registrar hoy</span>
          <strong>¿Cuántos has fumado?</strong>
          <i>→</i>
        </button>

        <div className="score-card">
          <div className="score-ring"><strong>{currentPoints.toFixed(1)}</strong><span>de {currentMonth.pointsTarget}</span></div>
          <div><p>Puntos este mes</p><h3>{Math.max(0, currentMonth.pointsTarget-currentPoints).toFixed(1)} para el objetivo</h3><small>{quantityGoal ? `Cumplir ≤ ${currentMonth.reference} cig/día vale 1 punto.` : 'Los días a 0 valen 1 punto completo.'}</small></div>
        </div>

        <div className="metric-grid">
          {quantityGoal
            ? <div><span>Días cumpliendo</span><strong>{daysMeetingTarget}</strong><small>de {currentMonthEntries.length} registrados</small></div>
            : <div><span>Días sin fumar</span><strong>{smokeFreeDays}</strong><small>objetivo {currentMonth.smokeFreeDaysTarget}</small></div>}
          <div><span>Cigarrillos evitados</span><strong>{avoided}</strong><small>frente a tu inicio</small></div>
          <div><span>Ahorro estimado</span><strong>{moneySaved.toFixed(2)} €</strong><small>aproximado</small></div>
          <div><span>{quantityGoal ? 'Objetivo actual' : 'Referencia actual'}</span><strong>{currentMonth.reference}</strong><small>cig/día</small></div>
        </div>

        <div className="month-strip">
          <div className="section-title"><h3>Tus últimos días</h3><button onClick={() => setTab('stats')}>Ver mes</button></div>
          <div className="days">{recentDays.map(dateKey => {
            const entry = entries.find(e => e.date === dateKey);
            const date = parseLocalDate(dateKey);
            const weekday = ['D','L','M','X','J','V','S'][date.getDay()];
            const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date).replace('.', '').toUpperCase();
            const className = `day ${entry?.cigarettes === 0 ? 'zero ' : ''}${!entry ? 'empty ' : ''}${dateKey === todayKey ? 'current' : ''}`.trim();
            return <button key={dateKey} className={className} onClick={() => openDay(dateKey)}>
              <small>{weekday}</small>
              <strong>{date.getDate()}</strong>
              <span>{month}</span>
              <em>{entry ? (entry.cigarettes === 0 ? '✓' : entry.cigarettes) : '·'}</em>
            </button>
          })}</div>
        </div>
      </section>}

      {tab === 'stats' && <section className="stats-screen">
        <div className="stats-heading">
          <div>
            <p className="eyebrow">MES {currentMonthIndex + 1} DEL PLAN</p>
            <h1>Tu mes,<br />de un vistazo.</h1>
          </div>
          <button className="stats-close" onClick={() => setTab('home')} aria-label="Volver">×</button>
        </div>

        <div className="month-kpis">
          <div>
            <span>Media diaria</span>
            <strong>{currentMonthAverage.toFixed(1)}</strong>
            <small>cig/día registrado</small>
          </div>
          <div>
            <span>Total fumado</span>
            <strong>{currentMonthTotalCigs}</strong>
            <small>cigarrillos</small>
          </div>
          <div>
            <span>Gasto estimado</span>
            <strong>{currentMonthSpend.toFixed(2)} €</strong>
            <small>este mes</small>
          </div>
          <div>
            <span>Ahorro estimado</span>
            <strong>{currentMonthSaved.toFixed(2)} €</strong>
            <small>{currentMonthAvoided} cig. evitados</small>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-title">
            <div><span>Consumo diario</span><small>Referencia anterior: {currentSmokeFreeReference} cig/día</small></div>
            <b>{currentMonthEntries.length}/30 días</b>
          </div>
          <div className="consumption-chart" aria-label="Gráfica de consumo diario">
            {currentMonthDates.map((dateKey, index) => {
              const entry = entries.find(e => e.date === dateKey);
              const isFuture = dateKey > todayKey;
              const height = entry ? Math.max(5, (entry.cigarettes / chartMax) * 100) : 0;
              return <div className="chart-day" key={dateKey}>
                <div className="chart-track">
                  {entry && <span
                    className={entry.cigarettes === 0 ? 'chart-bar zero' : 'chart-bar'}
                    style={{ height: entry.cigarettes === 0 ? '5px' : `${height}%` }}
                    title={`${entry.cigarettes} cigarrillos`}
                  />}
                </div>
                {(index + 1) % 5 === 0 && <small>{index + 1}</small>}
                {isFuture && <i />}
              </div>;
            })}
          </div>
          <div className="chart-legend"><span><i className="legend-reference" /> referencia previa</span><span>Días 1–30</span></div>
        </div>

        <div className="stats-card">
          <div className="stats-card-title">
            <div><span>Todo el mes</span><small>Toca un día para verlo o editarlo.</small></div>
            <b>{smokeFreeDays} 🚭</b>
          </div>
          <div className="month-calendar">
            {currentMonthDates.map((dateKey, index) => {
              const entry = entries.find(e => e.date === dateKey);
              const date = parseLocalDate(dateKey);
              const isFuture = dateKey > todayKey;
              const className = `month-day ${entry?.cigarettes === 0 ? 'zero ' : ''}${!entry ? 'empty ' : ''}${dateKey === todayKey ? 'current ' : ''}${isFuture ? 'future' : ''}`.trim();
              return <button
                key={dateKey}
                className={className}
                disabled={isFuture}
                onClick={() => openDay(dateKey)}
              >
                <small>D{index + 1}</small>
                <strong>{entry ? (entry.cigarettes === 0 ? '✓' : entry.cigarettes) : '·'}</strong>
                <span>{date.getDate()}/{date.getMonth() + 1}</span>
              </button>;
            })}
          </div>
        </div>

        <div className="stats-insight">
          <span>Tu tendencia</span>
          <strong>{currentMonthEntries.length === 0
            ? 'Registra algunos días para empezar a ver tu evolución.'
            : currentMonthAverage < currentSmokeFreeReference
              ? `Estás ${(currentSmokeFreeReference - currentMonthAverage).toFixed(1)} cig/día por debajo de tu referencia anterior.`
              : currentMonthAverage === currentSmokeFreeReference
                ? 'Tu media está justo en tu referencia anterior.'
                : `Tu media está ${(currentMonthAverage - currentSmokeFreeReference).toFixed(1)} cig/día por encima de tu referencia anterior.`}</strong>
        </div>

        <button className="secondary stats-plan-button" onClick={() => setTab('plan')}>Ver mi plan completo</button>
      </section>}

      {tab === 'today' && <section className="screen today-screen">
        <p className="eyebrow">REGISTRO DIARIO</p>
        <label className="date-field">
          <span>Fecha</span>
          <input
            type="date"
            value={selectedDate}
            max={todayKey}
            onChange={e => e.target.value && openDay(e.target.value)}
          />
        </label>
        <h1>{selectedDate === todayKey ? '¿Cuántos cigarrillos has fumado hoy?' : `¿Cuántos cigarrillos fumaste el ${formatLongDate(selectedDate)}?`}</h1>
        <Stepper value={todayCigs} min={0} max={80} onChange={setTodayCigs} suffix="cigarrillos" />

        {profile.triggers.length > 0 && <div className="exposure-card">
          <div className="exposure-heading">
            <div>
              <span>Situaciones difíciles</span>
              <strong>¿Te has expuesto hoy a alguno de tus disparadores?</strong>
            </div>
            <small>+10% c/u · máx. +20%</small>
          </div>
          <div className="chips exposure-chips">
            {profile.triggers.map(trigger => <button
              type="button"
              key={trigger}
              className={todayExposures.includes(trigger) ? 'chip active' : 'chip'}
              onClick={() => setTodayExposures(current => toggle(current, trigger))}
            >{trigger}</button>)}
          </div>
          <p>El bonus solo se aplica si ese día has fumado menos que tu referencia.</p>
        </div>}

        <div className={`daily-score ${todayCigs===0 ? 'celebrate' : ''}`}>
          <span>Puntuación {selectedDate === todayKey ? 'de hoy' : 'de ese día'}</span>
          <strong>+{scoreDay(todayCigs, profile, selectedMonth, selectedSmokeFreeReference, todayExposures).toFixed(2)}</strong>
          {todayExposures.length > 0 && todayCigs < scoringReference(profile, selectedMonth, selectedSmokeFreeReference) &&
            <b className="exposure-bonus">+{Math.min(todayExposures.length, 2) * 10}% por exposición</b>}
          <small>{quantityGoal
            ? todayCigs <= selectedMonth.reference
              ? todayCigs === 0
                ? 'Has superado ampliamente tu objetivo de cantidad.'
                : 'Has cumplido tu objetivo de cantidad para esta etapa.'
              : 'Te has acercado a tu objetivo. Cuanto más cerca estés, más puntuación sumas.'
            : todayCigs===0
              ? 'Día completamente libre de tabaco.'
              : todayCigs < selectedSmokeFreeReference
                ? `Has reducido respecto a tu referencia anterior de ${selectedSmokeFreeReference} cig/día.`
                : 'Este día no suma puntos, pero sigue formando parte del proceso.'}</small>
        </div>
        <button className="primary bottom" onClick={saveDay}>{selectedEntry ? 'Actualizar día' : 'Guardar día'}</button>
      </section>}

      {tab === 'plan' && <section className="plan-screen">
        <p className="eyebrow">TU CAMINO</p>
        <h1>{profile.durationMonths} meses.<br />Un objetivo claro.</h1>
        <div className="timeline">{plan.map(m => <div className="month-row" key={m.month}><span>{String(m.month).padStart(2,'0')}</span><div><b>Mes {m.month}</b><small>{quantityGoal ? `Objetivo ≤ ${m.reference} cig/día` : `Referencia ${m.reference} cig/día`}</small></div><div className="month-goals"><b>{quantityGoal ? `≤${m.reference} 🚬` : `${m.smokeFreeDaysTarget} 🚭`}</b><small>{m.pointsTarget} pts</small></div></div>)}</div>
      </section>}

      <nav className="bottom-nav">
        <button className={tab==='home'?'active':''} onClick={() => setTab('home')}><span>⌂</span>Inicio</button>
        <button className={tab==='today'?'active':''} onClick={() => openDay(todayKey)}><span>＋</span>Hoy</button>
        <button className={tab==='plan'?'active':''} onClick={() => setTab('plan')}><span>↗</span>Plan</button>
      </nav>
    </main>
  );
}

export default App;
