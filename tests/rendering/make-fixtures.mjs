// Writes the synthetic gate fixtures (ADR-010 §6): `node tests/rendering/make-fixtures.mjs`. The output is committed.
// All names and contacts are invented. IDs are fixed so that the fixtures, and so the hashes, are stable.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(import.meta.dirname, '../fixtures/resumes');
let next = 0;
const id = () => `01934f6e-7a2b-7c3d-8e4f-${String(++next).padStart(12, '0')}`;
const run = (value, marks = {}) => ({ kind: 'text', value, bold: false, italic: false, underline: false, ...marks });
const link = (url, value) => ({ kind: 'link', url, children: [run(value)] });
const para = (...inlines) => ({ kind: 'paragraph', inlines });
const bullets = (...items) => ({ kind: 'bulletList', items });
const shell = { hidden: false, listColumns: null, placement: null };
const date = (year, month = null) => ({ kind: 'date', year, month });

const PARAS = [
  'Ingeniera de software con experiencia en servicios distribuidos, migración de monolitos y mejora continua; también colabora con equipos de diseño, datos y atención al cliente en proyectos de larga duración.',
  'Інженерка програмного забезпечення з досвідом розробки розподілених сервісів, міграції застарілих систем та налагодження процесів безперервної доставки для команд у різних часових поясах.',
  'Worked on a payments platform for small merchants, moving reporting into a separate service and reducing the nightly batch window from six hours to forty minutes without changing the published schedule.',
];
const BULLETS = [
  [run('Rendimiento: ', { bold: true }), run('redujo la latencia p95 del servicio de facturación de 900 ms a 180 ms mediante caché y consultas nuevas.')],
  [run('Відмовостійкість: ', { bold: true }), run('запровадила автоматичне відновлення черг і скоротила кількість нічних інцидентів удвічі протягом року.')],
  [run('Observability: ', { italic: true }), run('introduced structured logs and tracing across fourteen services, and retired two legacy dashboards.')],
  [run('Published the '), link('https://example.invalid/runbook', 'on-call runbook'), run(' and trained three teams to use it during incidents.')],
  [run('Mentored four engineers; two now lead their own teams on separate product lines.')],
  [run('Automated release notes and reduced the time from merge to production to under an hour.')],
];

function entry(n, bulletCount) {
  return {
    id: id(),
    title: ['Ingeniera de plataforma', 'Backend Engineer', 'Розробниця програмного забезпечення', 'Site Reliability Engineer'][n % 4],
    organization: ['Ñandú Sistemas', 'Example Payments', 'Приклад Софт', 'Žilina Cloud s.r.o.'][n % 4],
    location: ['València, España (Remoto)', 'Windsor, Canada (Freelance, Remote)', 'Київ, Україна', 'Žilina, Slovensko (On-Site)'][n % 4],
    start: date(2023 - n * 2, 1 + (n * 3) % 12), end: n === 0 ? { kind: 'present' } : date(2025 - n * 2, 1 + (n * 5) % 12), dateText: '',
    description: [para(run(PARAS[n % 3])), bullets(...Array.from({ length: bulletCount }, (_, index) => BULLETS[(n + index) % BULLETS.length]))],
    pageBreakBefore: false,
  };
}

function resume(title, entryCount, bulletCount, extraEntries, summaryParagraphs = 2, lastEntryBullets = bulletCount) {
  next = 0;
  return {
    title, templateId: 'T1', accentPreset: 0, language: 'es', dateFormat: 'MonthYearLong',
    layout: { fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
    header: {
      fullName: 'Lucía Ñáñez-Šťastná | Інженерка', headline: 'Go • PostgreSQL • Kubernetes • Azure', showPhoto: true,
      contacts: [
        { id: id(), text: 'lucia@example.invalid', url: null, kind: 'email' },
        { id: id(), text: '+34 600 000 000 • València, España • Residencia permanente', url: null, kind: 'other' },
        { id: id(), text: 'example.invalid/in/lucia', url: 'https://example.invalid/in/lucia', kind: 'link' },
      ],
    },
    sections: [
      { ...shell, id: id(), type: 'text', title: 'Resumen profesional', content: { body: [para(run(PARAS[0])), para(run(PARAS[1]))].slice(0, summaryParagraphs) } },
      { ...shell, id: id(), type: 'list', title: 'Що я вмію', content: { items: ['Backend en Go y C#, servicios escalables', 'REST y gRPC, integración con terceros', 'Міграція монолітів на сервіси', 'PostgreSQL, Entity Framework, índices', 'Kubernetes, Helm, Terraform', 'CI/CD, Azure DevOps, GitHub Actions'].map(text => ({ id: id(), text: [run(text)] })) } },
      { ...shell, id: id(), type: 'entries', title: 'Experiencia profesional', content: { labels: null, entries: Array.from({ length: entryCount }, (_, n) => entry(n, n === entryCount - 1 ? lastEntryBullets : bulletCount)) } },
      { ...shell, id: id(), type: 'entries', title: 'Освіта', content: { labels: { title: 'Degree', organization: 'Institution', location: null }, entries: [{ id: id(), title: 'Máster en Ingeniería Informática', organization: 'Universidad de València', location: 'València, España', start: date(2010), end: date(2012), dateText: '', description: [], pageBreakBefore: false }] } },
      ...Array.from({ length: extraEntries }, (_, n) => ({ ...shell, id: id(), type: 'text', title: `Proyecto ${n + 1}`, content: { body: [para(run(PARAS[n % 3])), bullets(BULLETS[n % 6], BULLETS[(n + 1) % 6])] } })),
      { ...shell, listColumns: 1, id: id(), type: 'list', title: 'Technical skills', content: { items: [[run('Bases de datos: ', { bold: true }), run('PostgreSQL, SQL Server, Redis')], [run('Хмара: ', { bold: true }), run('Azure, Kubernetes, Docker')]].map(text => ({ id: id(), text })) } },
      { ...shell, id: id(), type: 'inline', title: 'Languages', content: { body: [para(run('Español', { bold: true }), run(' - nativo | '), run('Українська', { bold: true }), run(' - рідна | '), run('English', { bold: true }), run(' - B2 | '), run('Slovenčina', { bold: true }), run(' - pokročilá'))] } },
    ],
  };
}

const write = (name, value) => writeFileSync(resolve(out, `${name}.json`), `${JSON.stringify(value, null, 1)}\n`);
write('one-page', resume('One page', 2, 2, 0, 1));
write('two-pages', resume('Two pages', 2, 4, 0, 1, 14)); // The long last entry crosses the page boundary on A4 and on Letter.
write('four-pages', resume('Four pages', 10, 6, 2));

// P11: boundary fixtures (FR-PRV-02, NFR-04). Each runs on T1, T2 and T3, so the breaks fall differently on each.
const LONG = 'Migración de servicios, міграція застарілих систем and steady work on the release process with several teams across time zones';
const lineBreak = { kind: 'lineBreak' };
const base = (title, sections, header = {}) => { const shape = resume(title, 1, 1, 0); return { ...shape, header: { ...shape.header, ...header }, sections }; };
const text = (title, ...body) => ({ ...shell, id: id(), type: 'text', title, content: { body } });
const items = (title, columns, values) => ({ ...shell, listColumns: columns, id: id(), type: 'list', title, content: { items: values.map(value => ({ id: id(), text: [run(value)] })) } });
const job = (title, description, pageBreakBefore = false) => ({ id: id(), title, organization: 'Example Payments', location: 'València', start: date(2020, 1), end: { kind: 'present' }, dateText: '', description, pageBreakBefore });
const entries = (title, list, columns = null) => ({ ...shell, listColumns: columns, id: id(), type: 'entries', title, content: { labels: null, entries: list } });

write('minimal', base('Minimal', [text('Resumen', para(run('Una línea.')))], { headline: null, contacts: [], showPhoto: false }));
write('title-at-bottom', base('Title at bottom', Array.from({ length: 40 }, (_, n) => text(`Bloque ${n + 1}`, para(run(PARAS[n % 3]))))));
write('long-paragraph', base('Long paragraph', Array.from({ length: 3 }, (_, n) => text(`Parte ${n + 1}`, ...Array.from({ length: 3 }, () => para(run(Array.from({ length: 16 }, () => PARAS[n % 3]).join(' '))))))));
write('long-bullet', base('Long bullet', [text('Resumen', para(run(PARAS[0]))), items('Logros', 1, Array.from({ length: 14 }, () => Array.from({ length: 5 }, () => LONG).join(' ')))]));
write('many-rows', base('Many rows', [items('Habilidades', 2, Array.from({ length: 150 }, (_, n) => n % 5 === 0 ? `${LONG} ${n}` : `Skill number ${n}`))]));
write('manual-break', base('Manual break', [text('Resumen', para(run(PARAS[0]))), entries('Experiencia', [job('Primero', [para(run(PARAS[2]))], true), job('Segundo', [para(run(PARAS[1]))]), job('Tercero', [para(run(PARAS[2]))], true)]), items('Skills', null, ['Go', 'SQL', 'Kubernetes'])]));
write('oversized', base('Oversized', [text('Resumen', para(run(PARAS[0]))), entries('Experiencia', [job('Larga', [bullets([run(Array.from({ length: 70 }, () => LONG).join(' '))], [run('Short cell')])])], 2)]));
write('rich-marks', base('Rich marks', [text('Marcas', para(run('negrita ', { bold: true }), run('cursiva ', { italic: true }), run('ambas ', { bold: true, italic: true }), run('subrayado ', { underline: true }), link('https://example.invalid/a', 'enlace'), run(' fin.')), para(run('Primera línea'), lineBreak, run('Друга лінія'), lineBreak, run('Third line')), bullets([run('Bold start', { bold: true }), run(' then plain')], [link('mailto:a@example.invalid', 'correo')])), items('Skills', null, ['Go', 'PostgreSQL', 'Terraform', 'Azure DevOps'])]));
write('contacts-heavy', base('Contacts heavy', [text('Resumen', para(run(PARAS[0])))], { fullName: 'Lucía Ñáñez-Šťastná de la Fuente y Montenegro | Ingeniera de plataformas e Інженерка', headline: 'Go • PostgreSQL • Kubernetes • Azure • Terraform • Observability • Migraciones • Міграції', contacts: ['email', 'phone', 'location', 'link', 'other'].flatMap((kind, n) => [0, 1, 2].map(k => ({ id: id(), text: kind === 'email' ? `person${n}${k}@example.invalid` : kind === 'phone' ? `+34 600 000 0${n}${k}` : kind === 'link' ? `example.invalid/in/person${n}${k}` : `València, España ${n}${k}`, url: null, kind }))) }));

// TPL-01: a synthetic mirror of the structure of the owner's reference CV (ADR-054, DD-TPL-12). Invented person,
// companies and links; the same shapes: an untitled summary, eight entries with bullets and three product links,
// sidebar label/value pairs as `entries` (O-4), and a sidebar text block with a link. `panel-mirror-long` runs to
// two pages on T4 with the sidebar continuing on page 2.
function mirror(title, long) {
  let n = 0;
  const mid = () => `01934f6e-7a2b-7c3d-8e4f-7${String(++n).padStart(11, '0')}`;
  const side = { hidden: false, listColumns: null, placement: 'sidebar' };
  const main = { hidden: false, listColumns: null, placement: null };
  const pair = (label, value, start = null, end = null) => ({ id: mid(), title: label, organization: value, location: '', start, end, dateText: '', description: [], pageBreakBefore: false });
  const job = (jobTitle, organization, location, start, end, items) => ({ id: mid(), title: jobTitle, organization, location, start, end, dateText: '', description: [bullets(...items)], pageBreakBefore: false });
  const jobs = [
    job('Platform Engineer & Founder', 'Self-employed', 'Lausanne, Switzerland', date(2024), { kind: 'present' }, [
      [run('Build and run three small AI products on two clouds: '), link('https://example.invalid/aurora', 'Aurora.example'), run(', '), link('https://example.invalid/brightnote', 'BrightNote.example'), run(', '), link('https://example.invalid/kestrel', 'Kestrel.example'), run('; own architecture, Kubernetes, Helm, Terraform and CI/CD.')],
      [run('Supply-chain security in CI/CD: static analysis, image scanning, signed images and SBOM attestation.')],
      [run('Full-stack development (TypeScript, Python, PostgreSQL) with AI-assisted engineering.')],
      [run('Sole author of a patent application on trust verification across cloud and on-premises environments.')],
    ]),
    job('DevOps Engineer', 'Northwind Analytics', 'Lausanne, Switzerland', date(2026, 1), date(2026, 5), [
      [run('Delivered an internal LLM platform from concept to production, deployable as SaaS or on-premises.')],
      [run('Built CI/CD pipelines for build, test, registry, Helm deployment and static analysis; infrastructure in Terraform.')],
      [run('Hardened security with RBAC, mTLS, domain allow-listing and Kubernetes Secrets.')],
    ]),
    job('Senior DevOps Engineer', 'Contoso Consulting', 'Client: a large retailer', date(2020, 11), date(2024, 6), [
      [run('Ran Kubernetes clusters for more than 100 microservices under heavy production traffic, with reusable Terraform modules.')],
      [run('Operated CI/CD at scale across several environments with canary releases, approvals and safe rollbacks.')],
      [run('Reduced load balancer costs by more than 60% with a shared ingress and consolidated routing.')],
      [run('Defined monitoring as code and wrote the runbooks the on-call rota used.')],
      [run('Mentored a junior engineer and turned recurring escalations into documented, automated fixes.')],
    ]),
    job('Application Engineer / DevOps', 'Fabrikam Hospitality', 'Hospitality SaaS', date(2019, 8), date(2020, 10), [
      [run('Incident response and root cause analysis for services on a public cloud; Python and SQL data pipelines.')],
    ]),
    job('Observability Platform Engineer', 'Tailspin Metrics', 'Observability and FinOps platform', date(2018, 10), date(2019, 7), [
      [run('Escalation point for customer teams: troubleshooting and root cause analysis across cloud services.')],
      [run('Built agent features, plugins and scripts; rolled out agent deployments with configuration management.')],
    ]),
    job('IT Engineer', 'Litware Video', 'Video analytics, Zurich', date(2017), date(2018), [
      [run('Video services: integrations, troubleshooting and Python automation for a global SaaS platform.')],
    ]),
    job('Senior IT Specialist / Systems Engineer', 'Adatum Audit', 'Big Four', date(2006), date(2017), [
      [run('Ran enterprise infrastructure across a region and built a new office from scratch; cut malware incidents by 90%.')],
    ]),
    job('Systems Administrator / Programmer', 'Woodgrove Institute', 'Applied research', date(2001), date(2006), [
      [run('Linux, BSD and Windows servers, SQL databases and backups; C++ and database tools.')],
    ]),
  ];
  const skills = [
    ['Cloud & messaging', 'Kubernetes, object storage, IAM, queues; Kafka (service integration)'],
    ['IaC & config management', 'Terraform, Ansible, Puppet; reusable IaC modules and automation'],
    ['CI/CD & GitOps', 'GitLab CI/CD, GitHub Actions, Argo CD, Helm, reusable pipeline templates'],
    ['Containers', 'Kubernetes (managed and on-premises), Docker, Docker Compose'],
    ['Programming', 'Python, Bash, TypeScript, SQL, C++; Java/Spring support'],
    ['DevSecOps & supply chain', 'Static and dynamic analysis, image signing and SBOM, RBAC, mTLS'],
    ['Observability', 'Prometheus, Grafana, OpenTelemetry, log and trace platforms'],
    ['Systems & networking', 'Linux, Windows, DNS, TCP/IP, HTTP/TLS, SMTP'],
    ['AI engineering', 'Coding assistants, local LLM serving'],
  ];
  const extra = long ? Array.from({ length: 4 }, (_, k) => job(`Contract Engineer ${k + 1}`, 'Proseware Labs', 'Remote', date(1999 - k), date(2000 - k), [[run(PARAS[k % 3])], [run(PARAS[(k + 1) % 3])], [run(PARAS[(k + 2) % 3])]])) : [];
  const moreSkills = long ? Array.from({ length: 14 }, (_, k) => [`Extra area ${k + 1}`, 'Several tools and practices, listed here to make the sidebar run to a second page']) : [];
  return {
    title, templateId: 'T4', accentPreset: 0, language: 'en', dateFormat: 'MonthYearShort',
    layout: { fontPreset: 'M', sectionSpacing: 4, entrySpacing: 6, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
    header: {
      fullName: 'Jonas EKWALL', headline: 'DevOps / Platform Engineer', showPhoto: true,
      contacts: [
        { id: mid(), text: 'jonas.ekwall@example.invalid', url: null, kind: 'email' },
        { id: mid(), text: '+41 70 000 00 00', url: null, kind: 'phone' },
        { id: mid(), text: 'Lausanne, Switzerland', url: null, kind: 'location' },
        { id: mid(), text: 'example.invalid/in/jekwall', url: 'https://example.invalid/in/jekwall', kind: 'link' },
        { id: mid(), text: 'Work permit B · available immediately', url: null, kind: 'other' },
      ],
    },
    sections: [
      { ...main, id: mid(), type: 'text', title: '', content: { body: [para(run('DevOps / Platform Engineer with 8+ years building and scaling CI/CD and Kubernetes platforms on two public clouds and on-premises. Designs CI/CD with security built in (static and dynamic analysis, image signing, SBOM), GitOps with Argo CD, and reusable Terraform and Ansible modules. Strong Java/Spring, Python and event-driven troubleshooting; 11 years at a Big Four firm, 20 years in IT infrastructure.'))] } },
      { ...main, id: mid(), type: 'entries', title: 'Work Experience', content: { labels: null, entries: [...jobs, ...extra] } },
      { ...side, id: mid(), type: 'entries', title: 'Languages', content: { labels: { title: 'Language', organization: 'Level', location: null }, entries: [pair('English', 'Fluent'), pair('French', 'Intermediate, actively improving'), pair('Ukrainian, Polish', 'Native')] } },
      { ...side, id: mid(), type: 'entries', title: 'Technical Skills', content: { labels: { title: 'Area', organization: 'Skills', location: null }, entries: [...skills, ...moreSkills].map(([label, value]) => pair(label, value)) } },
      { ...side, id: mid(), type: 'entries', title: 'Certifications & Education', content: { labels: null, entries: [pair('Cloud Solutions Architect', 'Associate, 2026'), pair('Terraform Associate', 'Associate, 2026'), pair('Woodgrove Polytechnic', 'B.Sc., Information Systems', date(1999), date(2003))] } },
      { ...side, id: mid(), type: 'text', title: 'Mentoring Programme (Lyon)', content: { body: [para(run('40% of gross salary covered', { bold: true })), para(run('Regional subsidy for 6 months ('), link('https://example.invalid/programme', 'learn more'), run(').'))] } },
    ],
  };
}
write('panel-mirror', mirror('Panel mirror', false));
write('panel-mirror-long', mirror('Panel mirror long', true));
