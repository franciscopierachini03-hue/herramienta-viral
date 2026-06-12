'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import './landing.css';

const ADN_FEATURES = [
  { strong: 'Búsqueda viral', rest: ' en YouTube + TikTok + Instagram' },
  { strong: 'Chat de ideas:', rest: ' 3 preguntas → 15 palabras para buscar' },
  { strong: 'Filtro IA multilingüe', rest: ' (ES/EN/PT)' },
  { strong: 'Analizador de perfiles', rest: ' con engagement' },
  { strong: 'Transcripción', rest: ' con Whisper Large V3' },
  { strong: 'Traducción automática', rest: ' a 4 idiomas' },
  { strong: 'Biblioteca de guiones', rest: ' ilimitada' },
];

const CUT_FEATURES = [
  { strong: 'Subes tu video', rest: ' y se edita solo con IA' },
  { strong: 'Recorte por trozos:', rest: ' errores del medio, inicio o final' },
  { strong: 'Subtítulos animados', rest: ' — gancho + palabra por palabra' },
  { strong: 'B-roll automático', rest: ' que acompaña lo que dices' },
  { strong: 'Música de fondo', rest: ' elegida por IA' },
  { strong: 'Historial por 30 días', rest: ' · hasta 40 videos/mes' },
];

const AI_STEPS = [
  { icon: '🧠', label: 'Analizando el video' },
  { icon: '✂️', label: 'Recortando errores y silencios' },
  { icon: '💬', label: 'Subtítulos animados palabra por palabra' },
  { icon: '🎬', label: 'B-roll que acompaña lo que dices' },
  { icon: '🎵', label: 'Música elegida por IA' },
  { icon: '🚀', label: 'Listo para publicar' },
];

const PHASE_NAMES = [
  'Analizando tu video',
  'Recortando errores',
  'Subtítulos animados',
  'Agregando B-roll',
  'Música por IA',
  'Listo para publicar',
];
const PHASE_DURS = [2800, 2300, 2800, 2500, 2500, 3400];

const WAVE_HEIGHTS = [
  0.35, 0.6, 0.85, 0.5, 0.95, 0.65, 0.9, 0.45, 0.7, 1, 0.55, 0.9, 0.4, 0.75, 0.6, 0.95,
  0.45, 0.85, 0.65, 1, 0.5, 0.8, 0.35, 0.7, 0.9, 0.55, 0.95, 0.6, 0.45, 0.8, 0.65, 0.9,
];

const TESTIMONIALS = [
  {
    name: 'Mateo Carrizo', handle: '@mateo.creator', avatar: 'MC', color: '#7c3aed',
    niche: 'Negocios · 87K seguidores',
    text: 'En 3 semanas pasé de 12K a 87K en TikTok. Lo que más me sirvió fue ver QUÉ formato funcionaba en mi nicho sin mirar mil videos a mano. La transcripción me ahorra horas todas las semanas.',
  },
  {
    name: 'Camila Restrepo', handle: '@cami.fitcoach', avatar: 'CR', color: '#c13584',
    niche: 'Fitness · 154K seguidores',
    text: 'Probé Submagic, ChatGPT y mil herramientas. ViralADN es la única que me trae virales del nicho exacto que trabajo. Mis últimos 4 reels arriba de 500K vistas salieron de aquí.',
  },
  {
    name: 'Diego Fernández', handle: '@diego.mindset', avatar: 'DF', color: '#b45309',
    niche: 'Mindset · 42K seguidores',
    text: 'Antes pasaba 2 horas por día scrolleando para "investigar". Ahora busco mi tema, transcribo los 3 mejores y tengo guión para el video del día en 15 minutos.',
  },
  {
    name: 'Sofía Aguirre', handle: '@sofi.marketea', avatar: 'SA', color: '#059669',
    niche: 'Marketing · 28K seguidores',
    text: 'Lo que me voló la cabeza es que filtra POR IDIOMA. Trabajo con clientes en LATAM y España: pongo el tema y me trae lo viral de cada lado.',
  },
  {
    name: 'Bruno Salgado', handle: '@bruno.dinerojoven', avatar: 'BS', color: '#2563eb',
    niche: 'Finanzas · 213K seguidores',
    text: 'Vale 10 veces lo que cobra. La biblioteca de guiones que armé en un mes me sirvió para 3 lanzamientos distintos. Sigue pareciéndome una ganga.',
  },
  {
    name: 'Lucía Beltrán', handle: '@lucia.beautyhacks', avatar: 'LB', color: '#9333ea',
    niche: 'Belleza · 96K seguidores',
    text: 'La opción de analizar perfiles es oro. Entré al perfil de mi competencia más grande, ordené por engagement y encontré los 5 videos que la hicieron explotar.',
  },
];

const FAQ = [
  {
    q: '¿Qué diferencia hay entre ViralADN y TOPCUT?',
    a: 'ViralADN encuentra y transcribe el contenido que está funcionando en tu nicho (búsqueda viral, analizador de perfiles, guiones). TOPCUT edita tus videos solo con IA: recortes, subtítulos animados, B-roll y música. Juntas cubren todo el flujo: encontrar → grabar → editar → publicar.',
  },
  {
    q: '¿Qué incluye el combo de $67?',
    a: 'Todo ViralADN (búsqueda viral + guiones + ideas) y todo TOPCUT (editor con IA, hasta 40 videos por mes). Más barato que pagar las dos por separado ($84) y con acceso a todo lo nuevo de ambas plataformas.',
  },
  {
    q: '¿Cuántos videos puedo editar en TOPCUT?',
    a: 'Hasta 40 videos por mes, con historial de tus videos por 30 días.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí. La suscripción es mensual (o anual con −20%), pagas seguro con Stripe y cancelas cuando quieras, sin penalidades.',
  },
  {
    q: '¿Y si ya pagaba el plan de $47?',
    a: 'Eres miembro fundador: mantienes el acceso a las dos plataformas sin pagar de más.',
  },
];

const NICHES = 'fitness · dinero · mindset · negocios · marketing · belleza · finanzas · productividad · viajes · gaming · comida · moda';

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const cleanups: Array<() => void> = [];
    let alive = true;
    cleanups.push(() => { alive = false; });

    /* ---- barra de progreso de scroll ---- */
    const bar = root.querySelector<HTMLElement>('#lpProgress');
    if (bar) {
      const onScroll = () => {
        const h = document.documentElement;
        const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
        bar.style.width = `${p * 100}%`;
      };
      document.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      cleanups.push(() => document.removeEventListener('scroll', onScroll));
    }

    /* ---- reveals ---- */
    const toReveal = root.querySelectorAll('.reveal, [data-stagger], .flow');
    if (!reduced && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
      );
      toReveal.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    } else {
      toReveal.forEach((el) => el.classList.add('in'));
    }

    /* ---- contadores ---- */
    const counters = root.querySelectorAll<HTMLElement>('.count');
    const runCounter = (el: HTMLElement) => {
      const to = parseFloat(el.dataset.to || '0');
      const dec = parseInt(el.dataset.dec || '0', 10);
      if (reduced) { el.textContent = to.toFixed(dec); return; }
      let t0: number | null = null;
      const dur = 1300;
      const step = (t: number) => {
        if (!alive) return;
        if (!t0) t0 = t;
        let k = Math.min((t - t0) / dur, 1);
        k = 1 - Math.pow(1 - k, 3);
        el.textContent = (to * k).toFixed(dec);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!reduced && 'IntersectionObserver' in window) {
      const cio = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              runCounter(e.target as HTMLElement);
              cio.unobserve(e.target);
            }
          });
        },
        { threshold: 0.6 },
      );
      counters.forEach((el) => cio.observe(el));
      cleanups.push(() => cio.disconnect());
    } else {
      counters.forEach(runCounter);
    }

    /* ---- demo de búsqueda con tipeo ---- */
    const typeEl = root.querySelector<HTMLElement>('#lpType');
    const rows = root.querySelectorAll<HTMLElement>('#lpRes .row');
    const timeouts: number[] = [];
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { if (alive) fn(); }, ms);
      timeouts.push(id);
    };
    cleanups.push(() => timeouts.forEach((id) => clearTimeout(id)));
    if (typeEl) {
      if (reduced) {
        typeEl.textContent = 'fitness';
        rows.forEach((r) => r.classList.add('on'));
      } else {
        const queries = ['fitness', 'dinero', 'mindset', 'negocios'];
        let qi = 0;
        const clearRows = () => rows.forEach((r) => r.classList.remove('on'));
        const showRows = () => rows.forEach((r, i) => later(() => r.classList.add('on'), 160 + i * 200));
        const typeWord = (word: string, done: () => void) => {
          let i = 0;
          typeEl.textContent = '';
          const tick = () => {
            if (i <= word.length) {
              typeEl.textContent = word.slice(0, i);
              i++;
              later(tick, 95);
            } else done();
          };
          tick();
        };
        const eraseWord = (done: () => void) => {
          const tick = () => {
            const cur = typeEl.textContent || '';
            if (cur.length) {
              typeEl.textContent = cur.slice(0, -1);
              later(tick, 40);
            } else done();
          };
          tick();
        };
        const loop = () => {
          typeWord(queries[qi], () => {
            showRows();
            later(() => {
              clearRows();
              later(() => {
                eraseWord(() => {
                  qi = (qi + 1) % queries.length;
                  later(loop, 350);
                });
              }, 250);
            }, 3400);
          });
        };
        loop();
      }
    }

    /* ---- editor TOPCUT: fases ---- */
    const ed = root.querySelector<HTMLElement>('#tcEd');
    if (ed) {
      const pill = ed.querySelector<HTMLElement>('#lpPhaseTxt');
      const items = ed.querySelectorAll<HTMLElement>('.ai-list li');
      const setPhase = (p: number) => {
        ed.setAttribute('data-ph', String(p));
        if (pill) pill.textContent = PHASE_NAMES[p];
        items.forEach((li, i) => {
          li.classList.toggle('active', i === p);
          li.classList.toggle('done', i < p);
        });
      };
      const ws = ed.querySelectorAll<HTMLElement>('.ph-cap .w');
      if (!reduced) {
        let wi = 0;
        const karaoke = window.setInterval(() => {
          ws.forEach((w, i) => w.classList.toggle('on', i === wi));
          wi = (wi + 1) % ws.length;
        }, 430);
        cleanups.push(() => clearInterval(karaoke));
      }
      if (reduced) {
        setPhase(5);
        items.forEach((li) => { li.classList.add('done'); li.classList.remove('active'); });
      } else {
        let p = 0;
        setPhase(0);
        const resetEd = () => {
          ed.classList.add('noanim');
          ed.setAttribute('data-ph', 'reset');
          void ed.offsetWidth;
          ed.classList.remove('noanim');
        };
        const tick = () => {
          later(() => {
            p = (p + 1) % 6;
            if (p === 0) resetEd();
            setPhase(p);
            tick();
          }, PHASE_DURS[p]);
        };
        tick();
      }
    }

    /* ---- partículas constelación ---- */
    const cv = root.querySelector<HTMLCanvasElement>('#lpStars');
    if (cv && !reduced) {
      const ctx = cv.getContext('2d');
      if (ctx) {
        let W = 0; let H = 0;
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const COLS = ['167,139,250', '103,232,249', '232,90,171'];
        type P = { x: number; y: number; vx: number; vy: number; r: number; c: string };
        let parts: P[] = [];
        let running = true;
        const sizeCv = () => {
          const r = cv.parentElement!.getBoundingClientRect();
          W = r.width; H = r.height;
          cv.width = W * DPR; cv.height = H * DPR;
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          const N = W < 700 ? 30 : 60;
          parts = [];
          for (let i = 0; i < N; i++) {
            parts.push({
              x: Math.random() * W, y: Math.random() * H,
              vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.28,
              r: Math.random() * 1.5 + 0.6, c: COLS[i % 3],
            });
          }
        };
        sizeCv();
        window.addEventListener('resize', sizeCv);
        cleanups.push(() => window.removeEventListener('resize', sizeCv));
        const vio = new IntersectionObserver((es) => { running = es[0].isIntersecting; }, { threshold: 0 });
        vio.observe(cv.parentElement!);
        cleanups.push(() => vio.disconnect());
        let raf = 0;
        const draw = () => {
          raf = requestAnimationFrame(draw);
          if (!running || document.hidden) return;
          ctx.clearRect(0, 0, W, H);
          for (let i = 0; i < parts.length; i++) {
            const a = parts[i];
            a.x += a.vx; a.y += a.vy;
            if (a.x < -10) a.x = W + 10; if (a.x > W + 10) a.x = -10;
            if (a.y < -10) a.y = H + 10; if (a.y > H + 10) a.y = -10;
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.r, 0, 6.2832);
            ctx.fillStyle = `rgba(${a.c},.55)`;
            ctx.fill();
            for (let j = i + 1; j < parts.length; j++) {
              const b = parts[j];
              const dx = a.x - b.x; const dy = a.y - b.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 12100) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(${a.c},${0.32 * (1 - d2 / 12100)})`;
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            }
          }
        };
        draw();
        cleanups.push(() => cancelAnimationFrame(raf));
      }
    }

    /* ---- spotlight + tilt + magnético ---- */
    if (fine && !reduced) {
      root.querySelectorAll<HTMLElement>('.spot').forEach((el) => {
        const onMove = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${e.clientX - r.left}px`);
          el.style.setProperty('--my', `${e.clientY - r.top}px`);
        };
        el.addEventListener('mousemove', onMove);
        cleanups.push(() => el.removeEventListener('mousemove', onMove));
      });
      root.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
        const onMove = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateY(-2px)`;
        };
        const onLeave = () => { el.style.transform = ''; };
        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
        cleanups.push(() => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); });
      });
      root.querySelectorAll<HTMLElement>('.mag').forEach((el) => {
        const onMove = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          el.style.transform = `translate(${(dx * 0.14).toFixed(1)}px,${(dy * 0.22).toFixed(1)}px)`;
        };
        const onLeave = () => { el.style.transform = ''; };
        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
        cleanups.push(() => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); });
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div className="lp" ref={rootRef}>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <div id="lpProgress" aria-hidden="true" />

      <header>
        <nav className="nav" aria-label="Principal">
          <Link className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" width={34} height={34} style={{ filter: 'drop-shadow(0 0 14px #7c3aed55)' }} />
            ViralADN<span className="x">✕</span><span className="cut">TOPCUT</span>
          </Link>
          <ul className="nav-links">
            <li className="hide-m"><a href="#flujo">Cómo funciona</a></li>
            <li className="hide-m"><a href="#viraladn">ViralADN</a></li>
            <li className="hide-m"><a href="#topcut">TOPCUT</a></li>
            <li className="hide-m"><a href="#precios">Precios</a></li>
            <li><Link href="/login">Entrar</Link></li>
            <li><a className="btn btn-adn btn-sm" href="#precios">Empezar <span className="arr">→</span></a></li>
          </ul>
        </nav>
      </header>

      <main id="main">
        {/* ============ HERO ============ */}
        <section className="hero">
          <div className="orb orb-v" aria-hidden="true" />
          <div className="orb orb-p" aria-hidden="true" />
          <div className="orb orb-c" aria-hidden="true" />
          <canvas id="lpStars" aria-hidden="true" />
          <svg className="helix" viewBox="0 0 100 220" aria-hidden="true" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round">
            <path d="M25 5 C25 45 75 45 75 85 C75 125 25 125 25 165 C25 205 75 205 75 245" />
            <path d="M75 5 C75 45 25 45 25 85 C25 125 75 125 75 165 C75 205 25 205 25 245" />
            <line x1="32" y1="28" x2="68" y2="28" /><line x1="35" y1="62" x2="65" y2="62" />
            <line x1="32" y1="108" x2="68" y2="108" /><line x1="35" y1="142" x2="65" y2="142" />
            <line x1="32" y1="188" x2="68" y2="188" />
          </svg>

          <div className="wrap hero-grid">
            <div>
              <p className="badge lf" style={{ animationDelay: '.1s' }}>Suite completa: búsqueda viral + edición con IA</p>
              <h1>
                <span className="line"><span className="li" style={{ animationDelay: '.18s' }}>Encuentra lo viral.</span></span>
                <span className="line"><span className="li grad-cut-text" style={{ animationDelay: '.32s' }}>Edítalo con IA.</span></span>
                <span className="line"><span className="li grad-adn-text" style={{ animationDelay: '.46s' }}>Publica contenido que explota.</span></span>
              </h1>
              <p className="sub lf" style={{ animationDelay: '.6s' }}>
                <strong>ViralADN</strong> encuentra y transcribe los videos que están funcionando en tu nicho. <strong>TOPCUT</strong> edita los tuyos solo: subtítulos, B-roll y música. Tú solo grabas — el resto es automático.
              </p>
              <div className="hero-ctas lf" style={{ animationDelay: '.74s' }}>
                <a className="btn btn-mix mag" href="#precios">Empezar · desde $27/mes <span className="arr">→</span></a>
                <a className="btn btn-ghost mag" href="#flujo">Ver el flujo completo</a>
              </div>
              <p className="microcopy lf" style={{ animationDelay: '.86s' }}>Acceso inmediato · Pago seguro con Stripe · Cancela cuando quieras</p>
              <div className="stats" data-stagger>
                <div className="stat"><strong><span className="count" data-to="200">0</span>+</strong><span>creadores activos</span></div>
                <div className="stat"><strong><span className="count" data-to="4.9" data-dec="1">0</span>★</strong><span>valoración promedio</span></div>
                <div className="stat"><strong><span className="count" data-to="3">0</span></strong><span>plataformas</span></div>
                <div className="stat"><strong><span className="count" data-to="40">0</span></strong><span>videos editados/mes</span></div>
              </div>
            </div>

            <div
              className="pipeline lf"
              style={{ animationDelay: '.5s' }}
              role="img"
              aria-label="Demostración: ViralADN busca un tema y muestra los videos más virales con su engagement; el guión pasa a TOPCUT, que edita tu video solo: corta errores, agrega subtítulos animados, B-roll y música."
            >
              <div aria-hidden="true">
                <div className="app adn spot" data-tilt>
                  <div className="app-bar"><div className="dots"><i /><i /><i /></div><span className="app-name">ViralADN · buscar</span></div>
                  <div className="srch">
                    <div className="field"><span id="lpType" /><span className="caret" /></div>
                    <div className="go">🔍 Buscar</div>
                  </div>
                  <div className="res" id="lpRes">
                    <div className="row"><span className="rk">1</span><div><div className="ti">Esto cambia todo el gym</div><div className="mt">@coachfit · YT · 👁 4.2M</div></div><span className="eng">⚡ 6.3%</span></div>
                    <div className="row"><span className="rk">2</span><div><div className="ti">3 reglas para tu primer $10K</div><div className="mt">@dinerorapido · TT · 👁 3.8M</div></div><span className="eng">⚡ 4.1%</span></div>
                    <div className="row"><span className="rk">3</span><div><div className="ti">El error que mata tu mindset</div><div className="mt">@mentalidadpro · IG · 👁 2.1M</div></div><span className="eng">⚡ 5.8%</span></div>
                  </div>
                </div>

                <div className="conn">
                  <svg width="26" height="40" viewBox="0 0 26 40"><line className="dash" x1="13" y1="0" x2="13" y2="32" stroke="#a78bfa" strokeWidth="2" /><path d="M6 30l7 8 7-8" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="lbl">guión listo → a edición</span>
                </div>

                <div className="app cut spot" data-tilt>
                  <div className="app-bar"><div className="dots"><i /><i /><i /></div><span className="app-name">TOPCUT · editando</span></div>
                  <div className="frame">
                    <span className="brollchip">🎵 música elegida por IA</span>
                    <div className="person" />
                    <p className="cap play"><span className="w hl">Subes</span><span className="w">tu</span><span className="w">video</span><span className="w">y</span><span className="w hl">listo</span></p>
                  </div>
                  <div className="tl">
                    <div className="clip" />
                    <div className="clip bad">✂ error</div>
                    <div className="clip" />
                    <div className="clip bad" style={{ animationDelay: '1.2s' }}>✂ muletilla</div>
                    <div className="clip" style={{ flex: 0.7 }} />
                  </div>
                  <div className="prog"><div className="fill" /><p className="ptxt">✂️ Recorte automático + subtítulos palabra por palabra</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ MARQUEE ============ */}
        <div className="marquee" aria-hidden="true">
          <div className="track">
            <span>{NICHES} · </span>
            <span>{NICHES} · </span>
          </div>
        </div>

        {/* ============ FLUJO ============ */}
        <section id="flujo">
          <div className="wrap">
            <div className="sec-head reveal">
              <h2>Tu nuevo flujo de trabajo</h2>
              <p>De cero a video publicado — las dos herramientas, un solo camino</p>
            </div>
            <div className="flow reveal">
              <svg className="flow-line" width="100%" height="2" aria-hidden="true">
                <defs>
                  <linearGradient id="lpFlowGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#7c3aed" /><stop offset=".45" stopColor="#c13584" /><stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="1" x2="100%" y2="1" pathLength={1} />
              </svg>
              <div className="flow-grid" data-stagger>
                <div className="fstep">
                  <div className="fnode adn"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg></div>
                  <span className="chip c-adn">ViralADN</span>
                  <h3>Busca tu tema</h3>
                  <p>La IA trae los 100 videos más virales de tu nicho en YouTube, TikTok e Instagram.</p>
                </div>
                <div className="fstep">
                  <div className="fnode adn"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg></div>
                  <span className="chip c-adn">ViralADN</span>
                  <h3>Transcribe y adapta</h3>
                  <p>Cualquier video se vuelve guión con Whisper Large V3. Lo traduces y lo haces tuyo.</p>
                </div>
                <div className="fstep">
                  <div className="fnode cut"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg></div>
                  <span className="chip c-cut">TOPCUT</span>
                  <h3>Graba y sube</h3>
                  <p>TOPCUT lo edita solo: corta errores, suma subtítulos animados, B-roll y música.</p>
                </div>
                <div className="fstep">
                  <div className="fnode"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg></div>
                  <span className="chip c-mix">Publica</span>
                  <h3>Publica y crece</h3>
                  <p>Contenido con ADN viral, editado como los grandes, listo para subir todos los días.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ VIRALADN ============ */}
        <section id="viraladn" style={{ background: 'var(--bg-2)', borderBlock: '1px solid var(--border)' }}>
          <div className="wrap prod">
            <div className="reveal">
              <span className="ptag chip c-adn">🧬 ViralADN — encuentra el ADN</span>
              <h2>Deja de adivinar <span className="grad-adn-text">qué publicar</span></h2>
              <p className="lead">Encuentra el contenido que explota en tu nicho y conviértelo en guiones listos para grabar.</p>
              <ul className="feats" data-stagger>
                {ADN_FEATURES.map((f, i) => (
                  <li key={i}><span className="ck adn">✓</span><span><strong>{f.strong}</strong>{f.rest}</span></li>
                ))}
              </ul>
              <a className="btn btn-adn mag" href="#precios">Empezar con ViralADN · $27/mes <span className="arr">→</span></a>
            </div>
            <div className="pvisual reveal">
              <div className="glow-bg" style={{ background: 'radial-gradient(circle, rgba(124,58,237,.55), transparent 70%)' }} />
              <div className="inner app adn spot" data-tilt aria-hidden="true">
                <div className="app-bar"><div className="dots"><i /><i /><i /></div><span className="app-name">ViralADN · perfil analizado</span></div>
                <div className="res">
                  <div className="row on" style={{ animationDelay: '.1s' }}><span className="rk">🔥</span><div><div className="ti">Los 5 videos que la hicieron explotar</div><div className="mt">@competencia · ordenado por engagement</div></div><span className="eng">⚡ 8.2%</span></div>
                  <div className="row on" style={{ animationDelay: '.25s' }}><span className="rk">📈</span><div><div className="ti">De 12K a 87K en 3 semanas</div><div className="mt">patrón detectado: formato lista</div></div><span className="eng">⚡ 6.7%</span></div>
                  <div className="row on" style={{ animationDelay: '.4s' }}><span className="rk">🌍</span><div><div className="ti">Lo viral en ES · EN · PT</div><div className="mt">balanceado por idioma</div></div><span className="eng">⚡ 5.9%</span></div>
                  <div className="row on" style={{ animationDelay: '.55s' }}><span className="rk">📚</span><div><div className="ti">Guión guardado en tu biblioteca</div><div className="mt">listo para adaptar a tu voz</div></div><span className="eng">✓</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ TOPCUT ============ */}
        <section id="topcut">
          <div className="orb orb-c" style={{ top: '5%', right: '-180px', left: 'auto' }} aria-hidden="true" />
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="ptag chip c-cut">✂️ TOPCUT — edita sin editar</span>
              <h2>Subes tu video. <span className="grad-cut-text">Se edita solo.</span></h2>
              <p>Esto es lo que hace la IA con tu clip crudo — mira el proceso completo:</p>
            </div>

            <div
              className="reveal"
              role="img"
              aria-label="Demostración del editor TOPCUT: la IA analiza tu video, detecta silencios y muletillas, recorta los errores de la línea de tiempo, agrega subtítulos animados palabra por palabra, inserta B-roll automático, elige música de fondo y deja el video listo para exportar. Un video de 4 minutos 12 segundos queda en 58 segundos."
            >
              <div className="ed spot" id="tcEd" data-ph="0" aria-hidden="true">
                <div className="ed-glow" />
                <div className="ed-bar">
                  <div className="dots"><i /><i /><i /></div>
                  <span className="ed-file">TOPCUT · reel_final.mp4</span>
                  <span className="phase-pill"><span className="pdot" /><span id="lpPhaseTxt">Analizando tu video</span></span>
                </div>

                <div className="ed-main">
                  <div className="phone" data-tilt>
                    <div className="ph-screen">
                      <span className="ph-notch" />
                      <div className="scene scene-a"><div className="ph-person" /></div>
                      <div className="scene scene-b"><span className="bchip">🎬 B-roll automático</span></div>
                      <div className="scanline" />
                      <p className="ph-cap"><span className="w">Esto</span><span className="w">cambia</span><span className="w">todo</span><span className="w">tu</span><span className="w">contenido</span></p>
                      <span className="ph-handle">@tu.cuenta</span>
                    </div>
                  </div>

                  <div className="panel">
                    <ul className="ai-list">
                      {AI_STEPS.map((s, i) => (
                        <li key={i}><span className="ic">{s.icon}</span>{s.label}<span className="st"><span className="spin" /><span className="ok">✓</span></span></li>
                      ))}
                    </ul>
                    <div className="tagsrow">
                      <span className="atag">🔇 silencio 0:12–0:15</span>
                      <span className="atag">🗣 muletilla: &ldquo;eeeh&rdquo;</span>
                      <span className="atag good">🔥 gancho detectado 0:03</span>
                    </div>
                    <div className="rstats">
                      <div className="rs hero-rs">duración<b>4:12 → 0:58</b></div>
                      <div className="rs">cortes IA<b>−3</b></div>
                      <div className="rs">subtítulos<b>4 bloques</b></div>
                      <div className="rs">B-roll<b>2 clips</b></div>
                    </div>
                  </div>
                </div>

                <div className="ed-tl">
                  <span className="tlab">Video</span>
                  <div className="trk">
                    <div className="c" />
                    <div className="c bad b1">✂ silencio</div>
                    <div className="c" />
                    <div className="c bad b2">✂ &ldquo;eeeh&rdquo;</div>
                    <div className="c" />
                    <div className="c bad b3">✂</div>
                    <div className="c" style={{ flex: 0.7 }} />
                    <div className="phd" />
                  </div>
                  <span className="tlab">Subt.</span>
                  <div className="trk">
                    <div className="blk blk1" /><div className="blk blk2" /><div className="blk blk3" /><div className="blk blk4" />
                  </div>
                  <span className="tlab">B-roll</span>
                  <div className="trk">
                    <div className="brc br1">GYM</div><div className="brc br2">CIUDAD</div>
                  </div>
                  <span className="tlab">Música</span>
                  <div className="trk">
                    <div className="wv">
                      {WAVE_HEIGHTS.map((h, i) => (
                        <i key={i} style={{ '--h': h, transitionDelay: `${i * 26}ms` } as React.CSSProperties} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="ed-foot">
                  <div className="bigprog">
                    <div className="bfill" />
                    <div className="btxt"><span className="b1">✨ La IA está editando tu video…</span><span className="b2">✓ Render completo — listo para publicar</span></div>
                  </div>
                  <span className="export">Exportar ▸</span>
                </div>
                <span className="spk spk1">✨</span><span className="spk spk2">✨</span><span className="spk spk3">✨</span><span className="spk spk4">✨</span>
              </div>
            </div>

            <div className="feats-grid" data-stagger>
              {CUT_FEATURES.map((f, i) => (
                <div className="fcard spot" key={i}><span className="ck cut">✓</span><span><strong>{f.strong}</strong>{f.rest}</span></div>
              ))}
            </div>
            <p className="center reveal"><a className="btn btn-cut mag" href="#precios">Empezar con TOPCUT · $57/mes <span className="arr">→</span></a></p>
          </div>
        </section>

        {/* ============ TESTIMONIOS ============ */}
        <section style={{ background: 'var(--bg-2)', borderBlock: '1px solid var(--border)' }}>
          <div className="wrap">
            <div className="sec-head reveal">
              <p className="rating-line"><span className="stars" role="img" aria-label="4.9 de 5 estrellas">★★★★★</span><strong>4.9</strong> · según 200+ creadores</p>
              <h2>Lo que están diciendo</h2>
              <p>Creadores que ya están creciendo todos los días con la suite</p>
            </div>
          </div>
          <div className="t-marquee reveal">
            {[TESTIMONIALS.slice(0, 3), TESTIMONIALS.slice(3, 6)].map((group, gi) => (
              <div className={gi === 0 ? 't-track' : 't-track rev'} key={gi}>
                {[...group, ...group].map((t, i) => (
                  <article className="tcard" key={i}>
                    <span className="stars" role="img" aria-label="5 de 5 estrellas">★★★★★</span>
                    <blockquote>&ldquo;{t.text}&rdquo;</blockquote>
                    <footer>
                      <span className="avatar" style={{ background: t.color }} aria-hidden="true">{t.avatar}</span>
                      <div><strong>{t.name}</strong><span>{t.handle} · {t.niche}</span></div>
                    </footer>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ============ PRICING ============ */}
        <section id="precios">
          <div className="orb orb-c" style={{ top: '10%', left: '-160px' }} aria-hidden="true" />
          <div className="wrap">
            <div className="sec-head reveal">
              <h2>Elige tu herramienta</h2>
              <p>Busca lo viral, edita con IA, o llévate las dos · −20% pagando anual</p>
            </div>
            <div className="plans reveal" data-stagger>
              <div className="plan spot">
                <span className="picon adn" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M7 3c0 6 10 6 10 9s-10 3-10 9" /><path d="M17 3c0 6-10 6-10 9s10 3 10 9" /></svg></span>
                <h3>ViralADN</h3>
                <p className="pdesc">Encuentra el contenido que explota.</p>
                <p className="price">$27 <small>/mes</small></p>
                <ul>
                  <li><span className="ck adn">✓</span>Búsqueda viral en 3 plataformas</li>
                  <li><span className="ck adn">✓</span>Transcripción Whisper Large V3</li>
                  <li><span className="ck adn">✓</span>Analizador de perfiles</li>
                  <li><span className="ck adn">✓</span>Biblioteca ilimitada</li>
                </ul>
                <Link className="btn btn-ghost" href="/precios">Empezar · $27/mes</Link>
                <p className="stripe-note">Pago seguro con Stripe</p>
              </div>

              <div className="plan featured spot">
                <span className="tag">✨ Mejor valor — ahorras $17/mes</span>
                <span className="picon mix" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></span>
                <h3>ViralADN ✕ TOPCUT</h3>
                <p className="pdesc">Las dos plataformas, un solo plan.</p>
                <p className="price">$67 <small>/mes</small></p>
                <p className="annual">$84 por separado → $67 en pack</p>
                <ul>
                  <li><span className="ck adn">✓</span>TODO ViralADN: búsqueda + guiones + ideas</li>
                  <li><span className="ck cut">✓</span>TODO TOPCUT: editor IA, 40 videos/mes</li>
                  <li><span className="ck adn">✓</span>Encuentra y edita en un solo lugar</li>
                  <li><span className="ck cut">✓</span>Acceso a todo lo nuevo de las dos</li>
                </ul>
                <Link className="btn btn-mix mag" href="/precios">Empezar con el pack · $67/mes <span className="arr">→</span></Link>
                <p className="stripe-note">Pago seguro con Stripe</p>
              </div>

              <div className="plan spot">
                <span className="picon cut" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg></span>
                <h3>TOPCUT</h3>
                <p className="pdesc">Tus videos se editan solos con IA.</p>
                <p className="price">$57 <small>/mes</small></p>
                <ul>
                  <li><span className="ck cut">✓</span>Edición automática completa</li>
                  <li><span className="ck cut">✓</span>Subtítulos animados + B-roll</li>
                  <li><span className="ck cut">✓</span>Música elegida por IA</li>
                  <li><span className="ck cut">✓</span>Hasta 40 videos por mes</li>
                </ul>
                <Link className="btn btn-ghost" href="/precios">Empezar · $57/mes</Link>
                <p className="stripe-note">Pago seguro con Stripe</p>
              </div>
            </div>
            <p className="founder reveal">¿Ya pagabas el plan de $47? <strong>Eres miembro fundador</strong> — mantienes acceso a las dos plataformas sin pagar de más.</p>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section style={{ paddingTop: 20 }}>
          <div className="wrap">
            <div className="sec-head reveal"><h2>Preguntas frecuentes</h2></div>
            <div className="faq reveal">
              {FAQ.map((f, i) => (
                <details key={i}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============ CTA FINAL ============ */}
        <section style={{ paddingTop: 20 }}>
          <div className="wrap">
            <div className="cta-final reveal">
              <div className="orb orb-v" style={{ top: '-120px', left: '-80px', opacity: 0.35 }} aria-hidden="true" />
              <div className="orb orb-c" style={{ bottom: '-160px', right: '-100px', left: 'auto', opacity: 0.3 }} aria-hidden="true" />
              <h2>¿Listo para crear contenido<br /><span className="grad-adn-text">que explota</span>?</h2>
              <p>Súmate a los 200+ creadores que encuentran, editan y publican con la suite completa.</p>
              <div className="hero-ctas">
                <a className="btn btn-mix mag" href="#precios">Empezar ahora · desde $27/mes <span className="arr">→</span></a>
              </div>
              <p className="microcopy">Acceso inmediato · Pago seguro con Stripe · Cancela cuando quieras</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <p className="copyright">© 2026 ViralADN ✕ TOPCUT · Hecho para creadores que toman en serio su crecimiento</p>
          <ul className="footer-links">
            <li><a href="#">Términos</a></li>
            <li><a href="#">Privacidad</a></li>
            <li><a href="#">Contacto</a></li>
            <li><a href="#">Instagram</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
