# Bruma — prototipo mobile-first

Primera versión funcional del concepto de reducción progresiva del tabaco.

## Qué incluye
- Onboarding de 12 pasos.
- Objetivo: dejar de fumar o reducir.
- Metas en días de consumo/mes o cigarrillos por día/semana/mes.
- Intensidad suave, equilibrada o intensa.
- Generación local de un plan mensual.
- Registro diario de cigarrillos.
- Sistema de puntuación: 0 cigarrillos = 1 punto; <=30% = 0.40; <=50% = 0.25; <100% = 0.10; >=100% = 0.
- Dashboard con días sin fumar, puntos, cigarrillos evitados y ahorro estimado.
- Datos persistidos en localStorage.

## Ejecutar en el ordenador
Necesitas Node.js 20 o superior.

```bash
npm install
npm run dev -- --host
```

Vite mostrará una URL local y una URL de red, por ejemplo:

```text
http://192.168.1.20:5173
```

## Probarlo en iPhone
1. Conecta el iPhone y el ordenador a la misma Wi-Fi.
2. Ejecuta `npm run dev -- --host`.
3. Abre en Safari del iPhone la URL `Network` que muestra Vite.
4. Prueba el flujo completo.
5. Para tener un icono permanente tipo app, la versión debe publicarse en HTTPS. Puedes desplegar la carpeta en cualquier hosting estático compatible con Vite y usar Safari > Compartir > Añadir a pantalla de inicio.

## Construir para producción
```bash
npm run build
```

Los archivos finales aparecerán en `dist/`.

## Nota
Este prototipo no sustituye consejo médico ni pretende diagnosticar dependencia. El motor de plan es todavía una primera hipótesis de producto para probar la experiencia y ajustar el algoritmo con casos reales.
