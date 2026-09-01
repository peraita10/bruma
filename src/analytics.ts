declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, string | number | boolean>) => void;
    };
  }
}

const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
const UMAMI_SCRIPT = 'https://cloud.umami.is/script.js';

export function initAnalytics() {
  if (!WEBSITE_ID || document.querySelector('script[data-bruma-analytics]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = UMAMI_SCRIPT;
  script.dataset.websiteId = WEBSITE_ID;
  script.dataset.brumaAnalytics = 'true';
  document.head.appendChild(script);

  document.addEventListener('click', handleAnalyticsClick, true);
}

function track(eventName: string) {
  window.umami?.track(eventName);
}

function handleAnalyticsClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest('button');
  if (!button) return;

  const label = (button.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Solo medimos acciones genéricas. Nunca enviamos cigarrillos,
  // objetivos, respuestas del onboarding ni ningún dato de salud/hábito.
  if (label.includes('empezar mi plan')) {
    track('onboarding_completed');
    return;
  }

  if (label.includes('actualizar día')) {
    track('daily_entry_updated');
    return;
  }

  if (label.includes('guardar día')) {
    track('daily_entry_saved');
    return;
  }

  if (label === 'plan' || label.includes('ver plan')) {
    track('plan_viewed');
  }
}

export {};
