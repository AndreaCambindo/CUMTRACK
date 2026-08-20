const API_URL = 'https://script.google.com/macros/s/AKfycby-yE_l9CX8gw5PaoX_cIJbw6BXK1Tp_rt1BuqQoBlFdpRiHcf8NB09VQDhfL4S5s6smw/exec';

const LOCAL_KEY = 'cumtrack_local_backup_v2';
const CONFIG_KEY = 'cumtrack_config_backup_v2';
const PAGARES_KEY = 'cumtrack_pagares_local_backup_v2';
const BUDGETS_KEY = 'cumtrack_budgets_local_backup_v1';
const DECLINADOS_KEY = 'cumtrack_declinados_local_backup_v1';

let quotes = [];
let pagares = [];
let budgets = [];
let declinados = [];

let lastFilteredQuotes = [];
let lastFilteredPagares = [];
let lastFilteredDeclinados = [];
let lastBudgetContext = null;

let config = {
    commercials: [],
    intermediaries: []
};

let statusId = null;
let pagareStatusId = null;
let editingQuoteId = null;
let editingPagareId = null;
let editingDeclinadoId = null;
let manualWhatsappQuoteId = null;
let localMode = false;
let localFileName = '';


/* =========================================================
   UTILIDADES
   ========================================================= */

const $ = id => document.getElementById(id);

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
}[char]));

const today = () => new Date().toISOString().slice(0, 10);

const money = value => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
}).format(Number(value) || 0);

const cls = status => String(status || '')
    .toLowerCase()
    .replace(/ /g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/*
 * Suma la Prima CUM + Prima RCE de una cotización.
 * La Prima RCE solo aplica cuando la póliza la incluye,
 * así que si está vacía simplemente no suma nada.
 */
const quotePrimaTotal = q =>
    (Number(q.primaCum) || 0) +
    (Number(q.primaRce) || 0);

/*
 * Cuenta "negocios" en vez de simples filas: una
 * cotización con solo CUM cuenta 1, pero si además
 * tiene Prima RCE diligenciada, cuenta 2 (son dos
 * pólizas dentro del mismo registro).
 */
const quoteBusinessCount = q =>
    1 + (Number(q.primaRce) > 0 ? 1 : 0);


/*
 * Ajusta automáticamente el tamaño de letra de los
 * números en las tarjetas de resumen, para que nunca
 * se salgan de la tarjeta sin importar cuántos dígitos
 * tengan (millones, miles de millones, etc).
 */

const STAT_MIN_FONT = 14;

function fitStatNumbers() {

    document
        .querySelectorAll('.stats strong')
        .forEach(el => {

            if (!el.offsetParent) return;

            /*
             * Reiniciamos el estilo en línea para leer
             * el tamaño base que corresponde según el
             * CSS activo (varía según el ancho de pantalla).
             */

            el.style.fontSize = '';

            const baseFontSize =
                parseFloat(
                    getComputedStyle(el).fontSize
                ) || 30;

            let fontSize = baseFontSize;

            el.style.fontSize = fontSize + 'px';

            while (
                el.scrollWidth > el.clientWidth &&
                fontSize > STAT_MIN_FONT
            ) {

                fontSize -= 1;

                el.style.fontSize = fontSize + 'px';
            }

        });
}


let statFitTimer = null;

window.addEventListener('resize', () => {

    clearTimeout(statFitTimer);

    statFitTimer = setTimeout(
        fitStatNumbers,
        150
    );

});

function formatDate(value) {
    if (!value) return '—';

    const parts = String(value).split('-');

    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return String(value);
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {

    const t = $('toast');

    if (!t) return;

    t.textContent = message;
    t.classList.add('show');

    setTimeout(() => {
        t.classList.remove('show');
    }, 2200);
}


/* =========================================================
   RESPALDO LOCAL
   ========================================================= */

function saveBackup() {

    localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify(quotes)
    );

    localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify(config)
    );

    localStorage.setItem(
        PAGARES_KEY,
        JSON.stringify(pagares)
    );

    localStorage.setItem(
        BUDGETS_KEY,
        JSON.stringify(budgets)
    );

    localStorage.setItem(
        DECLINADOS_KEY,
        JSON.stringify(declinados)
    );
}


/* =========================================================
   GOOGLE APPS SCRIPT - JSONP
   ========================================================= */

function jsonp(action, params = {}) {

    return new Promise((resolve, reject) => {

        const callbackName =
            'cumtrack_cb_' +
            Date.now() +
            '_' +
            Math.random().toString(36).slice(2);

        const script = document.createElement('script');

        const query = new URLSearchParams({
            action,
            callback: callbackName,
            ...params
        });

        const timer = setTimeout(() => {

            cleanup();

            reject(
                new Error('Tiempo de espera agotado')
            );

        }, 12000);


        function cleanup() {

            clearTimeout(timer);

            delete window[callbackName];

            script.remove();
        }


        window[callbackName] = data => {

            cleanup();

            resolve(data);
        };


        script.onerror = () => {

            cleanup();

            reject(
                new Error(
                    'No fue posible conectar con Google Apps Script'
                )
            );
        };


        script.src =
            API_URL +
            '?' +
            query.toString();

        document.body.appendChild(script);
    });
}


/* =========================================================
   SINCRONIZACIÓN
   ========================================================= */

async function syncAll() {

    try {

        const [
            quotesResponse,
            commercialsResponse,
            intermediariesResponse,
            pagaresResponse,
            budgetsResponse,
            declinadosResponse
        ] = await Promise.all([

            jsonp('getQuotes'),

            jsonp('getCommercials'),

            jsonp('getIntermediaries'),

            jsonp('getPagares'),

            jsonp('getBudgets'),

            jsonp('getDeclinados')
        ]);


        if (quotesResponse.success) {

            quotes =
                quotesResponse.data || [];
        }


        if (commercialsResponse.success) {

            config.commercials =
                commercialsResponse.data || [];
        }


        if (intermediariesResponse.success) {

            config.intermediaries =
                intermediariesResponse.data || [];
        }


        if (pagaresResponse.success) {

            pagares =
                pagaresResponse.data || [];
        }


        if (budgetsResponse.success) {

            budgets =
                budgetsResponse.data || [];
        }


        if (declinadosResponse.success) {

            declinados =
                declinadosResponse.data || [];
        }


        saveBackup();

        fillForm();

        fillPagareForm();

        fillDeclinadoForm();

        render();

        return true;


    } catch (error) {

        try {

            quotes = JSON.parse(
                localStorage.getItem(LOCAL_KEY) || '[]'
            );

        } catch {

            quotes = [];
        }


        try {

            config = JSON.parse(
                localStorage.getItem(CONFIG_KEY) ||
                '{"commercials":[],"intermediaries":[]}'
            );

        } catch {

            config = {
                commercials: [],
                intermediaries: []
            };
        }


        try {

            pagares = JSON.parse(
                localStorage.getItem(PAGARES_KEY) || '[]'
            );

        } catch {

            pagares = [];
        }


        try {

            budgets = JSON.parse(
                localStorage.getItem(BUDGETS_KEY) || '[]'
            );

        } catch {

            budgets = [];
        }


        try {

            declinados = JSON.parse(
                localStorage.getItem(DECLINADOS_KEY) || '[]'
            );

        } catch {

            declinados = [];
        }


        fillForm();

        fillPagareForm();

        fillDeclinadoForm();

        render();

        toast(
            'Sin conexión: mostrando copia local'
        );

        return false;
    }
}


/* =========================================================
   ESCRITURA API
   ========================================================= */

async function apiWrite(action, data) {

    if (localMode) {

        return {

            success: false,

            error:
                'Estás en modo local (archivo cargado, sin conexión). Conéctate a internet y recarga la app para poder guardar cambios.'

        };
    }

    return jsonp(action, data);
}


/* =========================================================
   MODO LOCAL (ARCHIVO EXCEL SIN CONEXIÓN)
   ========================================================= */

function excelDateStr(value, withTime) {

    if (value === null || value === undefined || value === '') {

        return '';
    }

    if (value instanceof Date) {

        const pad = n => String(n).padStart(2, '0');

        const y = value.getFullYear();
        const m = pad(value.getMonth() + 1);
        const d = pad(value.getDate());

        if (!withTime) {

            return `${y}-${m}-${d}`;
        }

        const hh = pad(value.getHours());
        const mm = pad(value.getMinutes());
        const ss = pad(value.getSeconds());

        return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }

    return String(value);
}

function excelMonthStr(value) {

    if (!value) return '';

    if (value instanceof Date) {

        const pad = n => String(n).padStart(2, '0');

        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
    }

    return String(value);
}

function excelRowsToQuotes(rows) {

    return rows
        .map(r => ({

            id: r['ID'] || '',

            fecha: excelDateStr(r['Fecha de solicitud']),

            tomador: r['Tomador'] || '',

            nit: r['NIT'] || '',

            entidad: r['Entidad contratante'] || '',

            comercial: r['Comercial'] || '',

            tipo: r['Tipo de póliza'] || '',

            /*
             * Aceptamos tanto los encabezados nuevos como
             * los antiguos, por si el archivo se exportó
             * antes de renombrar las columnas en Sheets.
             */

            valor:
                r['Valor contrato'] ||
                r['Valor asegurado'] || '',

            primaCum:
                r['Prima CUM'] ||
                r['Prima sin IVA'] || '',

            primaRce:
                r['Prima RCE'] || '',

            tasa: r['Tasa CUM - RCE'] || '',

            intermediario: r['Intermediario'] || '',

            estado: r['Estado'] || '',

            observaciones: r['Observaciones'] || '',

            fechaCreacion: excelDateStr(r['Fecha de creación'], true),

            ultimaActualizacion: excelDateStr(r['Última actualización'], true)

        }))
        .filter(q => q.tomador || q.nit);
}

function excelRowsToCommercials(rows) {

    return rows
        .map(r => ({

            name: r['Comercial'] || '',

            phone: r['WhatsApp'] || ''

        }))
        .filter(c => c.name);
}

function excelRowsToIntermediaries(rows) {

    return rows
        .map(r => r['Intermediario'] || '')
        .filter(Boolean);
}

function excelRowsToPagares(rows) {

    return rows
        .map(r => ({

            id: r['ID'] || '',

            fechaEmision: excelDateStr(r['Fecha emisión']),

            poliza: r['# Póliza'] || '',

            tomador: r['Tomador'] || '',

            nit: r['NIT'] || '',

            tipo: r['Tipo'] || '',

            estado: r['Estado'] || '',

            fecha: excelDateStr(r['Fecha']),

            comercial: r['Comercial'] || '',

            fechaCreacion: excelDateStr(r['Fecha de creación'], true),

            ultimaActualizacion: excelDateStr(r['Última actualización'], true)

        }))
        .filter(p => p.tomador || p.poliza);
}

function excelRowsToBudgets(rows) {

    return rows
        .map(r => ({

            mes: excelMonthStr(r['Mes']),

            presupuesto: r['Presupuesto'] || 0,

            fechaCreacion: excelDateStr(r['Fecha de creación'], true),

            ultimaActualizacion: excelDateStr(r['Última actualización'], true)

        }))
        .filter(b => b.mes);
}

function excelRowsToDeclinados(rows) {

    return rows
        .map(r => ({

            id: r['ID'] || '',

            fecha: excelDateStr(r['Fecha de solicitud']),

            tomador: r['Tomador'] || '',

            nit: r['NIT'] || '',

            comercial: r['Comercial'] || '',

            intermediario: r['Intermediario'] || '',

            observaciones: r['Observaciones'] || '',

            fechaCreacion: excelDateStr(r['Fecha de creación'], true),

            ultimaActualizacion: excelDateStr(r['Última actualización'], true)

        }))
        .filter(d => d.tomador || d.nit);
}


function updateModeIndicator() {

    if (!$('modeIndicator')) return;


    if (localMode) {

        $('modeIndicator').innerHTML = `
            MODO LOCAL (SIN CONEXIÓN)
            <br>
            <small>
                Archivo: ${esc(localFileName)}. Solo lectura.
            </small>
        `;

    } else {

        $('modeIndicator').innerHTML = `
            MODO CONECTADO
            <br>
            <small>
                Google Sheets como base de datos.
            </small>
        `;
    }
}


async function loadLocalWorkbook(file) {

    if (typeof XLSX === 'undefined') {

        toast(
            'No se pudo cargar el motor de Excel incluido en la app.'
        );

        return;
    }


    try {

        const buffer =
            await file.arrayBuffer();

        const workbook =
            XLSX.read(
                buffer,
                {
                    type: 'array',
                    cellDates: true
                }
            );


        const getSheetRows = name => {

            const ws =
                workbook.Sheets[name];

            if (!ws) return [];

            return XLSX.utils.sheet_to_json(
                ws,
                { defval: '' }
            );
        };


        quotes =
            excelRowsToQuotes(
                getSheetRows('Cotizaciones')
            );

        config.commercials =
            excelRowsToCommercials(
                getSheetRows('Comerciales')
            );

        config.intermediaries =
            excelRowsToIntermediaries(
                getSheetRows('Intermediarios')
            );

        pagares =
            excelRowsToPagares(
                getSheetRows('Pagares')
            );

        budgets =
            excelRowsToBudgets(
                getSheetRows('Presupuestos')
            );

        declinados =
            excelRowsToDeclinados(
                getSheetRows('Declinados')
            );


        localMode = true;

        localFileName = file.name;


        saveBackup();

        clearEditState();

        clearPagareEditState();

        clearDeclinadoEditState();

        fillForm();

        fillPagareForm();

        fillDeclinadoForm();

        render();

        updateModeIndicator();


        toast(
            `Datos cargados desde "${file.name}" (modo local, sin conexión).`
        );


    } catch (error) {

        console.error(
            'Error leyendo el archivo local:',
            error
        );

        toast(
            'No se pudo leer el archivo. Verifica que sea el Excel exportado desde Google Sheets (Archivo → Descargar → Microsoft Excel).'
        );
    }
}


if ($('loadLocalBtn')) {

    $('loadLocalBtn').addEventListener(
        'click',
        () => {

            if ($('localFileInput')) {

                $('localFileInput').click();
            }
        }
    );
}


if ($('localFileInput')) {

    $('localFileInput').addEventListener(
        'change',
        event => {

            const file =
                event.target.files[0];

            if (file) {

                loadLocalWorkbook(file);
            }

            event.target.value = '';
        }
    );
}


/* =========================================================
   MENÚ LATERAL DESPLEGABLE
   ========================================================= */

function openSidebar() {

    if ($('sidebar')) {

        $('sidebar').classList.add('open');
    }

    if ($('sidebarBackdrop')) {

        $('sidebarBackdrop').classList.add('visible');
    }

        // Ocultar el botón cuando el menú está abierto
    if ($('sidebarToggle')) {
        $('sidebarToggle').style.display = 'none';
    }
}


function closeSidebar() {

    if ($('sidebar')) {

        $('sidebar').classList.remove('open');
    }

    if ($('sidebarBackdrop')) {

        $('sidebarBackdrop').classList.remove('visible');
    }
    
        // Mostrar nuevamente el botón cuando el menú está cerrado
    if ($('sidebarToggle')) {
        $('sidebarToggle').style.display = '';
    }
}


function toggleSidebar() {

    if ($('sidebar') && $('sidebar').classList.contains('open')) {

        closeSidebar();

    } else {

        openSidebar();
    }
}


if ($('sidebarToggle')) {

    $('sidebarToggle').addEventListener(
        'click',
        toggleSidebar
    );
}


if ($('sidebarBackdrop')) {

    $('sidebarBackdrop').addEventListener(
        'click',
        closeSidebar
    );
}


document.addEventListener(
    'keydown',
    event => {

        if (event.key === 'Escape') {

            closeSidebar();
        }
    }
);


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

function go(page) {

    closeSidebar();

    if (page !== 'new' && editingQuoteId) {

        clearEditState();
    }

    if (page !== 'pagares' && editingPagareId) {

        clearPagareEditState();
    }

    if (page !== 'declinados' && editingDeclinadoId) {

        clearDeclinadoEditState();
    }

    document
        .querySelectorAll('.page')
        .forEach(section => {

            section.classList.remove('active');

        });


    const target = $(page);

    if (target) {

        target.classList.add('active');
    }


    document
        .querySelectorAll('.nav-btn')
        .forEach(button => {

            button.classList.toggle(
                'active',
                button.dataset.page === page
            );

        });


    if (page === 'new') {

        fillForm();
    }


    if (page === 'pagares') {

        if (!editingPagareId) {

            clearPagareEditState();
        }

        fillPagareForm();
    }


    if (page === 'declinados') {

        if (!editingDeclinadoId) {

            clearDeclinadoEditState();
        }

        fillDeclinadoForm();
    }


    if (page === 'budget') {

        fillBudgetForm();
    }


    render();
}


/* =========================================================
   ESTADO DE EDICIÓN DE COTIZACIÓN
   ========================================================= */

function clearEditState() {

    editingQuoteId = null;

    if ($('quoteEditId')) {

        $('quoteEditId').value = '';
    }

    if ($('quoteFormTitle')) {

        $('quoteFormTitle').textContent =
            'Nueva cotización';
    }

    if ($('quoteFormSubtitle')) {

        $('quoteFormSubtitle').textContent =
            'Registra únicamente la información necesaria.';
    }

    if ($('quoteSubmitBtn')) {

        $('quoteSubmitBtn').textContent =
            'Guardar cotización';
    }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function render() {

    /*
     * =====================================================
     * COTIZACIONES
     * =====================================================
     */

    if ($('sQuoted')) {

        $('sQuoted').textContent =
            quotes.reduce(
                (sum, q) => sum + quoteBusinessCount(q),
                0
            );
    }


    if ($('sWon')) {

        $('sWon').textContent =
            quotes
                .filter(q => q.estado === 'Ganada')
                .reduce(
                    (sum, q) => sum + quoteBusinessCount(q),
                    0
                );
    }


    if ($('sLost')) {

        $('sLost').textContent =
            quotes
                .filter(q => q.estado === 'Perdida')
                .reduce(
                    (sum, q) => sum + quoteBusinessCount(q),
                    0
                );
    }


    if ($('sNegotiation')) {

        $('sNegotiation').textContent =
            quotes
                .filter(q => q.estado === 'En negociación')
                .reduce(
                    (sum, q) => sum + quoteBusinessCount(q),
                    0
                );
    }


    /* =====================================================
       VALORES EN PRIMA
       ===================================================== */

    if ($('sPrimaTotal')) {

        const totalPrima =
            quotes.reduce(
                (sum, q) => sum + quotePrimaTotal(q),
                0
            );

        $('sPrimaTotal').textContent =
            money(totalPrima);
    }


    if ($('sPrimaWon')) {

        const wonPrima =
            quotes
                .filter(q => q.estado === 'Ganada')
                .reduce(
                    (sum, q) => sum + quotePrimaTotal(q),
                    0
                );

        $('sPrimaWon').textContent =
            money(wonPrima);
    }


    if ($('sPrimaLost')) {

        const lostPrima =
            quotes
                .filter(q => q.estado === 'Perdida')
                .reduce(
                    (sum, q) => sum + quotePrimaTotal(q),
                    0
                );

        $('sPrimaLost').textContent =
            money(lostPrima);
    }


    if ($('sPrimaNegotiation')) {

        const negotiationPrima =
            quotes
                .filter(q => q.estado === 'En negociación')
                .reduce(
                    (sum, q) => sum + quotePrimaTotal(q),
                    0
                );

        $('sPrimaNegotiation').textContent =
            money(negotiationPrima);
    }


    /* =====================================================
   RESUMEN DE PAGARÉS
   ===================================================== */

    if ($('sPagareTotal')) {
        $('sPagareTotal').textContent = pagares.length;
    }

    if ($('sPagareDelivered')) {
        $('sPagareDelivered').textContent =
            pagares.filter(
                p => String(p.estado || '').trim().toLowerCase() === 'entregado'
            ).length;
    }

    if ($('sPagarePending')) {
        $('sPagarePending').textContent =
            pagares.filter(
                p => String(p.estado || '').trim().toLowerCase() === 'pendiente'
            ).length;
    }

    if ($('sPagareLegalized')) {
        $('sPagareLegalized').textContent =
            pagares.filter(
                p => String(p.estado || '').trim().toLowerCase() === 'legalizado'
            ).length;
    }


    /* =====================================================
       BÚSQUEDA COTIZACIONES
       ===================================================== */

    const search =
        ($('search')?.value || '')
            .toLowerCase()
            .trim();

    const filter =
        $('filter')?.value || '';

    const listMonth =
        $('listMonth')?.value || '';


    const filteredQuotes =
        quotes
            .filter(q => {

                const text = `
                    ${q.tomador || ''}
                    ${q.nit || ''}
                    ${q.entidad || ''}
                    ${q.comercial || ''}
                `.toLowerCase();


                const matchesSearch =
                    !search ||
                    text.includes(search);


                const matchesFilter =
                    !filter ||
                    q.estado === filter;


                const matchesMonth =
                    !listMonth ||
                    String(q.fecha || '').slice(0, 7) === listMonth;


                return (
                    matchesSearch &&
                    matchesFilter &&
                    matchesMonth
                );

            })
            .sort((a, b) => {

                const dateA = new Date(
                    a.fechaCreacion ||
                    a.fecha ||
                    '1970-01-01'
                );


                const dateB = new Date(
                    b.fechaCreacion ||
                    b.fecha ||
                    '1970-01-01'
                );


                return dateB - dateA;
            });


    if ($('all')) {

        $('all').innerHTML =
            table(filteredQuotes);
    }

    lastFilteredQuotes = filteredQuotes;


    renderConfig();

    renderPagares();

    renderDeclinados();

    renderBudget();

    fitStatNumbers();
}


/* =========================================================
   TABLA COTIZACIONES
   ========================================================= */

function table(rows) {

    if (!rows.length) {

        return `
            <div class="empty">
                No hay cotizaciones para mostrar.
            </div>
        `;
    }


    return `
        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>Fecha</th>

                        <th>
                            Tomador / Contratante
                        </th>

                        <th>
                            Comercial
                        </th>

                        <th>
                            Tipo de póliza / Tasas
                        </th>

                        <th>
                            Valores
                        </th>

                        <th>
                            Intermediario
                        </th>

                        <th>
                            Estado
                        </th>

                        <th>
                            Acciones
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${rows.map(x => `

                        <tr class="clickable-row" onclick="showQuoteDetail('${x.id}')" title="Ver detalle">

                            <td data-label="Fecha">

                                <strong>
                                    ${esc(
                                        formatDate(x.fecha)
                                    )}
                                </strong>

                            </td>


                            <td data-label="Tomador / Contratante">

                                <strong>
                                    ${esc(x.tomador)}
                                </strong>

                                <span class="sub">
                                    NIT: ${esc(x.nit)}
                                </span>

                                <span class="sub">
                                    ${esc(x.entidad)}
                                </span>

                            </td>


                            <td data-label="Comercial">

                                <strong>
                                    ${esc(x.comercial)}
                                </strong>

                            </td>


                            <td data-label="Tipo de póliza / Tasas">

                                <strong>
                                    ${esc(x.tipo)}
                                </strong>

                                <span class="sub">

                                    CUM:
                                    ${x.tasa
                                        ? esc(x.tasa)
                                        : '—'}

                                </span>

                            </td>


                            <td data-label="Valores">

                                <strong>
                                    ${money(x.valor)}
                                </strong>

                                <span class="sub">

                                    Prima:
                                    ${money(quotePrimaTotal(x))}

                                </span>

                                ${Number(x.primaRce) > 0 ? `
                                    <span class="sub">
                                        CUM: ${money(x.primaCum)} · RCE: ${money(x.primaRce)}
                                    </span>
                                ` : ''}

                            </td>


                            <td data-label="Intermediario">

                                ${esc(
                                    x.intermediario || '—'
                                )}

                            </td>


                            <td data-label="Estado">

                                <span
                                    class="status ${cls(x.estado)}"
                                >

                                    ${esc(x.estado)}

                                </span>

                            </td>


                            <td data-label="Acciones">

                                <div class="actions">

                                    <button
                                        class="icon"
                                        title="Editar cotización"
                                        onclick="event.stopPropagation(); editQuote('${x.id}')"
                                    >
                                        ✎
                                    </button>


                                    <button
                                        class="icon"
                                        title="Enviar recordatorio por WhatsApp"
                                        onclick="event.stopPropagation(); whatsapp('${x.id}')"
                                    >
                                        💬
                                    </button>


                                    <button
                                        class="icon"
                                        title="Enviar a otro comercial"
                                        onclick="event.stopPropagation(); openManualWhatsapp('${x.id}')"
                                    >
                                        📨
                                    </button>


                                    <button
                                        class="icon"
                                        title="Cambiar estado"
                                        onclick="event.stopPropagation(); openStatus('${x.id}')"
                                    >
                                        ↻
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `).join('')}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   FORMULARIO COTIZACIONES
   ========================================================= */

function fillForm() {

    if ($('fecha') && !editingQuoteId) {

        $('fecha').value = today();
    }


    if ($('comercial')) {

        let html =
            '<option value="">Seleccionar...</option>';


        config.commercials.forEach(c => {

            html += `
                <option value="${esc(c.name)}">
                    ${esc(c.name)}
                </option>
            `;

        });


        $('comercial').innerHTML = html;
    }


    if ($('intermediario')) {

        let html =
            '<option value="">Seleccionar...</option>';


        config.intermediaries.forEach(i => {

            html += `
                <option value="${esc(i)}">
                    ${esc(i)}
                </option>
            `;

        });


        $('intermediario').innerHTML = html;
    }
}


/* =========================================================
   DETALLE DE COTIZACIÓN (TARJETA FLOTANTE)
   ========================================================= */

let quoteDetailId = null;

function showQuoteDetail(id) {

    const quote =
        quotes.find(
            q => q.id === id
        );


    if (!quote) return;


    quoteDetailId = id;


    const detailRows = [

        ['Tomador', quote.tomador || '—'],

        ['NIT', quote.nit || '—'],

        ['Entidad contratante', quote.entidad || '—'],

        ['Comercial', quote.comercial || '—'],

        ['Tipo de póliza', quote.tipo || '—'],

        ['Fecha de solicitud', formatDate(quote.fecha)],

        ['Valor contrato', money(quote.valor)],

        ['Prima CUM', money(quote.primaCum)],

        ['Prima RCE', money(quote.primaRce)],

        ['Prima total', money(quotePrimaTotal(quote))],

        ['Tasa CUM - RCE', quote.tasa || 'No registrada'],

        ['Intermediario', quote.intermediario || 'No registrado'],

        ['Estado', quote.estado || '—'],

        ['Observaciones', quote.observaciones || 'Sin observaciones'],

        ['Fecha de creación', quote.fechaCreacion || '—'],

        ['Última actualización', quote.ultimaActualizacion || '—']

    ];


    if ($('quoteDetailBody')) {

        $('quoteDetailBody').innerHTML =
            detailRows
                .map(([label, value]) => `

                    <div class="detail-row">

                        <span class="detail-label">
                            ${esc(label)}
                        </span>

                        <span class="detail-value">
                            ${esc(value)}
                        </span>

                    </div>

                `)
                .join('');
    }


    if ($('quoteDetailModal')) {

        $('quoteDetailModal')
            .classList
            .remove('hidden');
    }
}


function closeQuoteDetail() {

    if ($('quoteDetailModal')) {

        $('quoteDetailModal')
            .classList
            .add('hidden');
    }

    quoteDetailId = null;
}


if ($('closeQuoteDetailModal')) {

    $('closeQuoteDetailModal').onclick =
        closeQuoteDetail;
}


if ($('closeQuoteDetailBtn')) {

    $('closeQuoteDetailBtn').onclick =
        closeQuoteDetail;
}


if ($('editFromDetailBtn')) {

    $('editFromDetailBtn').onclick = () => {

        const id = quoteDetailId;

        closeQuoteDetail();

        if (id) {

            editQuote(id);
        }
    };
}


/* =========================================================
   EDITAR COTIZACIÓN
   ========================================================= */

function editQuote(id) {

    const quote =
        quotes.find(
            q => q.id === id
        );


    if (!quote) return;


    editingQuoteId = id;

    go('new');

    applyQuoteToForm(quote);


    if ($('quoteFormTitle')) {

        $('quoteFormTitle').textContent =
            'Editar cotización';
    }

    if ($('quoteFormSubtitle')) {

        $('quoteFormSubtitle').textContent =
            `Modificando cotización de ${quote.tomador || ''}.`;
    }

    if ($('quoteSubmitBtn')) {

        $('quoteSubmitBtn').textContent =
            'Actualizar cotización';
    }

    if ($('quoteEditId')) {

        $('quoteEditId').value = id;
    }
}


function applyQuoteToForm(quote) {

    if ($('fecha')) $('fecha').value = quote.fecha || today();
    if ($('tomador')) $('tomador').value = quote.tomador || '';
    if ($('nit')) $('nit').value = quote.nit || '';
    if ($('entidad')) $('entidad').value = quote.entidad || '';
    if ($('comercial')) $('comercial').value = quote.comercial || '';
    if ($('tipo')) $('tipo').value = quote.tipo || '';
    if ($('valor')) $('valor').value = quote.valor || '';
    if ($('primaCum')) $('primaCum').value = quote.primaCum || '';
    if ($('primaRce')) $('primaRce').value = quote.primaRce || '';
    if ($('tasa')) $('tasa').value = quote.tasa || '';
    if ($('intermediario')) $('intermediario').value = quote.intermediario || '';
    if ($('estado')) $('estado').value = quote.estado || 'Cotizada';
    if ($('observaciones')) $('observaciones').value = quote.observaciones || '';
}

/* =========================================================
   GUARDAR COTIZACIÓN
========================================================= */

if ($('quoteForm')) {

    $('quoteForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();

            const isEditing =
                !!editingQuoteId;

            const quote = {

                id:
                    isEditing
                        ? editingQuoteId
                        : (
                            window.crypto &&
                            typeof crypto.randomUUID === 'function'

                                ? crypto.randomUUID()

                                : String(Date.now())
                          ),

                fecha:
                    $('fecha').value,

                tomador:
                    $('tomador').value.trim(),

                nit:
                    $('nit').value.trim(),

                entidad:
                    $('entidad').value.trim(),

                comercial:
                    $('comercial').value,

                tipo:
                    $('tipo').value,

                valor:
                    $('valor').value,

                primaCum:
                    $('primaCum').value,

                primaRce:
                    $('primaRce').value,

                tasa:
                    $('tasa').value.trim(),

                intermediario:
                    $('intermediario').value,

                estado:
                    $('estado').value,

                observaciones:
                    $('observaciones').value.trim()
            };


            const button =
                event.submitter;

            const originalLabel =
                button ? button.textContent : '';


            if (button) {

                button.disabled = true;

                button.textContent =
                    isEditing
                        ? 'Actualizando...'
                        : 'Guardando...';
            }


            try {

                const response =
                    await apiWrite(
                        isEditing
                            ? 'updateQuote'
                            : 'saveQuote',
                        quote
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        (isEditing
                            ? 'No se pudo actualizar la cotización'
                            : 'No se pudo guardar la cotización')
                    );
                }


                /*
                 * Limpiar formulario
                 */

                $('quoteForm').reset();

                clearEditState();


                /*
                 * Volver a colocar
                 * la fecha actual
                 */

                if ($('fecha')) {

                    $('fecha').value =
                        today();
                }


                /*
                 * Recargar información
                 * desde Google Sheets
                 */

                await syncAll();


                toast(
                    isEditing
                        ? 'Cotización actualizada en Google Sheets'
                        : 'Cotización guardada en Google Sheets'
                );


                /*
                 * Ir al listado
                 */

                go('list');


            } catch (error) {

                console.error(
                    'Error guardando cotización:',
                    error
                );


                toast(
                    (isEditing
                        ? 'No se pudo actualizar la cotización: '
                        : 'No se pudo guardar la cotización: ') +
                    error.message
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        originalLabel;
                }
            }
        }
    );
}

/* =========================================================
   WHATSAPP COTIZACIONES
   ========================================================= */

function buildQuoteMessage(quote, greetingName, includeOwnerLine) {

    const lines = [

        `Hola ${greetingName}`,

        '',

        'Comparto información de cotización realizada:',

        ''
    ];


    if (includeOwnerLine) {

        lines.push(
            `• Comercial asignado: ${
                quote.comercial || 'No asignado'
            }`
        );
    }


    lines.push(

        `• Tomador: ${quote.tomador}`,

        `• NIT: ${quote.nit}`,

        `• Entidad contratante: ${quote.entidad}`,

        `• Tipo de póliza: ${quote.tipo}`,

        `• Valor contrato: ${money(quote.valor)}`,

        `• Prima CUM: ${money(quote.primaCum)}`
    );


    if (Number(quote.primaRce) > 0) {

        lines.push(
            `• Prima RCE: ${money(quote.primaRce)}`
        );
    }


    lines.push(

        `• Prima total: ${money(quotePrimaTotal(quote))}`,

        `• Tasa CUM - RCE: ${
            quote.tasa || 'No registrada'
        }`,

        `• Intermediario: ${
            quote.intermediario || 'No registrado'
        }`,

        `• Estado: ${quote.estado}`,

        `• Observaciones: ${
            quote.observaciones || 'Sin observaciones'
        }`,

        '',

        'Por favor realizar seguimiento. Llamar al intermediario para saber si esta de acuerdo o que se necesita de nuestra parte para cerrar el negocio. ¡Gracias!'
    );


    return lines.join('\n');
}


function whatsapp(id) {

    const quote =
        quotes.find(
            q => q.id === id
        );


    if (!quote) return;


    const commercial =
        config.commercials.find(
            c => c.name === quote.comercial
        );


    if (!commercial?.phone) {

        alert(
            'Primero agrega el número de WhatsApp de este comercial en Configuración.'
        );

        return;
    }


    const message =
        buildQuoteMessage(
            quote,
            quote.comercial,
            false
        );


    const phone =
        String(commercial.phone)
            .replace(/\D/g, '');


    const url =
        'https://wa.me/' +
        phone +
        '?text=' +
        encodeURIComponent(message);


    window.open(
        url,
        '_blank'
    );
}


/* =========================================================
   WHATSAPP MANUAL A CUALQUIER COMERCIAL
   ========================================================= */

function openManualWhatsapp(id) {

    const quote =
        quotes.find(
            q => q.id === id
        );


    if (!quote) return;


    manualWhatsappQuoteId = id;


    if ($('manualWhatsappInfo')) {

        $('manualWhatsappInfo').textContent =
            `${quote.tomador} · ${quote.nit} — Comercial asignado: ${
                quote.comercial || 'No asignado'
            }`;
    }


    if ($('manualWhatsappCommercial')) {

        let html =
            '<option value="">Seleccionar...</option>';


        config.commercials.forEach(c => {

            html += `
                <option value="${esc(c.name)}">
                    ${esc(c.name)}
                </option>
            `;

        });


        $('manualWhatsappCommercial').innerHTML = html;
    }


    if ($('manualWhatsappModal')) {

        $('manualWhatsappModal')
            .classList
            .remove('hidden');
    }
}


function closeManualWhatsapp() {

    if ($('manualWhatsappModal')) {

        $('manualWhatsappModal')
            .classList
            .add('hidden');
    }


    manualWhatsappQuoteId = null;
}


if ($('closeManualWhatsappModal')) {

    $('closeManualWhatsappModal').onclick =
        closeManualWhatsapp;
}


if ($('cancelManualWhatsapp')) {

    $('cancelManualWhatsapp').onclick =
        closeManualWhatsapp;
}


if ($('sendManualWhatsapp')) {

    $('sendManualWhatsapp').onclick = () => {

        const quote =
            quotes.find(
                q => q.id === manualWhatsappQuoteId
            );


        if (!quote) return;


        const selectedName =
            $('manualWhatsappCommercial')?.value || '';


        if (!selectedName) {

            toast(
                'Selecciona un comercial'
            );

            return;
        }


        const commercial =
            config.commercials.find(
                c => c.name === selectedName
            );


        if (!commercial?.phone) {

            alert(
                'Este comercial no tiene número de WhatsApp registrado en Configuración.'
            );

            return;
        }


        const message =
            buildQuoteMessage(
                quote,
                selectedName,
                true
            );


        const phone =
            String(commercial.phone)
                .replace(/\D/g, '');


        const url =
            'https://wa.me/' +
            phone +
            '?text=' +
            encodeURIComponent(message);


        window.open(
            url,
            '_blank'
        );


        closeManualWhatsapp();
    };
}

    /* =========================================================
    ESTADO COTIZACIÓN
    ========================================================= */

    function openStatus(id) {

        const quote =
            quotes.find(
                q => q.id === id
            );


        if (!quote) return;


        statusId = id;


        if ($('modalInfo')) {

            $('modalInfo').textContent =
                `${quote.tomador} · ${quote.nit}`;
        }


        if ($('newStatus')) {

            $('newStatus').value =
                quote.estado;
        }


        if ($('modal')) {

            $('modal')
                .classList
                .remove('hidden');
        }
    }


    function closeStatus() {

        if ($('modal')) {

            $('modal')
                .classList
                .add('hidden');
        }


        statusId = null;
    }


    if ($('saveStatus')) {

        $('saveStatus').onclick =
            async () => {

                const quote =
                    quotes.find(
                        q => q.id === statusId
                    );


                if (!quote) return;


                const estado =
                    $('newStatus').value;


                try {

                    const response =
                        await apiWrite(
                            'updateStatus',
                            {
                                id: quote.id,
                                estado: estado
                            }
                        );


                    if (!response.success) {

                        throw new Error(
                            response.error ||
                            'No se pudo actualizar la cotización'
                        );
                    }


                    await syncAll();


                    toast(
                        'Estado de cotización actualizado'
                    );


                } catch (error) {

                    console.error(
                        'Error actualizando estado:',
                        error
                    );


                    toast(
                        'No se pudo actualizar: ' +
                        error.message
                    );
                }


                closeStatus();
            };
    }


    if ($('closeModal')) {

        $('closeModal').onclick =
            closeStatus;
    }


    if ($('cancelStatus')) {

        $('cancelStatus').onclick =
            closeStatus;
    }


/* =========================================================
   FORMULARIO DE PAGARÉS
   ========================================================= */

function fillPagareForm() {

    if ($('pagareFechaEmision')) {

        $('pagareFechaEmision').value =
            $('pagareFechaEmision').value ||
            today();
    }


    if ($('pagareComercial')) {

        let html =
            '<option value="">Seleccionar...</option>';


        config.commercials.forEach(commercial => {

            html += `
                <option value="${esc(commercial.name)}">
                    ${esc(commercial.name)}
                </option>
            `;

        });


        $('pagareComercial').innerHTML =
            html;
    }
}


/* =========================================================
   ESTADO DE EDICIÓN DE PAGARÉ
   ========================================================= */

function clearPagareEditState() {

    editingPagareId = null;

    if ($('pagareEditId')) {

        $('pagareEditId').value = '';
    }

    if ($('pagareFormTitle')) {

        $('pagareFormTitle').textContent =
            'Registrar pagaré';
    }

    if ($('pagareSubmitBtn')) {

        $('pagareSubmitBtn').textContent =
            'Guardar pagaré';
    }
}


/* =========================================================
   EDITAR PAGARÉ
   ========================================================= */

function editPagare(id) {

    const pagare =
        pagares.find(
            p => p.id === id
        );


    if (!pagare) return;


    editingPagareId = id;

    go('pagares');

    applyPagareToForm(pagare);


    if ($('pagareFormTitle')) {

        $('pagareFormTitle').textContent =
            `Editar pagaré — ${pagare.poliza || ''}`;
    }

    if ($('pagareSubmitBtn')) {

        $('pagareSubmitBtn').textContent =
            'Actualizar pagaré';
    }

    if ($('pagareEditId')) {

        $('pagareEditId').value = id;
    }


    if ($('pagareFormTitle')) {

        $('pagareFormTitle')
            .scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
    }
}


function applyPagareToForm(pagare) {

    if ($('pagareFechaEmision')) {
        $('pagareFechaEmision').value =
            pagare.fechaEmision || today();
    }

    if ($('pagarePoliza')) {
        $('pagarePoliza').value =
            pagare.poliza || '';
    }

    if ($('pagareTomador')) {
        $('pagareTomador').value =
            pagare.tomador || '';
    }

    if ($('pagareNit')) {
        $('pagareNit').value =
            pagare.nit || '';
    }

    if ($('pagareTipo')) {
        $('pagareTipo').value =
            pagare.tipo || '';
    }

    if ($('pagareEstado')) {
        $('pagareEstado').value =
            pagare.estado || 'Pendiente';
    }

    if ($('pagareFecha')) {
        $('pagareFecha').value =
            pagare.fecha || '';
    }

    if ($('pagareComercial')) {
        $('pagareComercial').value =
            pagare.comercial || '';
    }
}


/* =========================================================
   GUARDAR PAGARÉ
   ========================================================= */

if ($('newPagareBtn')) {

    $('newPagareBtn').addEventListener(
        'click',
        () => {

            clearPagareEditState();

            if ($('pagareForm')) {

                $('pagareForm').reset();
            }

            go('pagares');

            if ($('pagareFormTitle')) {

                $('pagareFormTitle')
                    .scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
            }
        }
    );
}


if ($('pagareForm')) {

    $('pagareForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const isEditing =
                !!editingPagareId;


            const pagare = {

                id:
                    isEditing
                        ? editingPagareId
                        : (
                            window.crypto &&
                            typeof crypto.randomUUID ===
                            'function'

                                ? crypto.randomUUID()

                                : String(Date.now())
                          ),


                fechaEmision:
                    $('pagareFechaEmision').value,


                poliza:
                    $('pagarePoliza').value.trim(),


                tomador:
                    $('pagareTomador').value.trim(),


                nit:
                    $('pagareNit').value.trim(),


                tipo:
                    $('pagareTipo').value,


                estado:
                    $('pagareEstado').value,


                fecha:
                    $('pagareFecha').value,


                comercial:
                    $('pagareComercial').value
            };


            const button =
                event.submitter;

            const originalLabel =
                button ? button.textContent : '';


            if (button) {

                button.disabled = true;

                button.textContent =
                    isEditing
                        ? 'Actualizando...'
                        : 'Guardando...';
            }


            try {

                const response =
                    await apiWrite(
                        isEditing
                            ? 'updatePagare'
                            : 'savePagare',
                        pagare
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        (isEditing
                            ? 'No se pudo actualizar el pagaré'
                            : 'No se pudo guardar el pagaré')
                    );
                }


                if ($('pagareForm')) {

                    $('pagareForm').reset();
                }


                clearPagareEditState();


                if ($('pagareFechaEmision')) {

                    $('pagareFechaEmision').value =
                        today();
                }


                await syncAll();


                toast(
                    isEditing
                        ? 'Pagaré actualizado en Google Sheets'
                        : 'Pagaré guardado en Google Sheets'
                );


                go('pagares');


            } catch (error) {

                toast(
                    (isEditing
                        ? 'No se pudo actualizar el pagaré: '
                        : 'No se pudo guardar el pagaré: ') +
                    error.message
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        originalLabel;
                }
            }
        }
    );
}


/* =========================================================
   TABLA DE PAGARÉS
   ========================================================= */

function renderPagares() {

    const container =
        $('pagareTable');


    if (!container) return;


    const search =
        ($('pagareSearch')?.value || '')
            .toLowerCase()
            .trim();


    const filter =
        $('pagareFilter')?.value || '';


    const pagareMonth =
        $('pagareMonth')?.value || '';


    const rows =
        pagares
            .filter(pagare => {

                const text = `

                    ${pagare.poliza || ''}

                    ${pagare.tomador || ''}

                    ${pagare.nit || ''}

                    ${pagare.comercial || ''}

                `.toLowerCase();


                const matchesSearch =
                    !search ||
                    text.includes(search);


                const matchesFilter =
                    !filter ||
                    pagare.estado === filter;


                const matchesMonth =
                    !pagareMonth ||
                    String(pagare.fechaEmision || '').slice(0, 7) === pagareMonth;


                return (
                    matchesSearch &&
                    matchesFilter &&
                    matchesMonth
                );

            })
            .sort((a, b) => {

                const dateA =
                    new Date(
                        a.fechaEmision ||
                        a.fecha ||
                        '1970-01-01'
                    );


                const dateB =
                    new Date(
                        b.fechaEmision ||
                        b.fecha ||
                        '1970-01-01'
                    );


                return dateB - dateA;
            });


    lastFilteredPagares = rows;


    if (!rows.length) {

        container.innerHTML = `
            <div class="empty">
                No hay pagarés para mostrar.
            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>
                            Fecha emisión
                        </th>

                        <th>
                            # Póliza
                        </th>

                        <th>
                            Tomador
                        </th>

                        <th>
                            NIT
                        </th>

                        <th>
                            Tipo
                        </th>

                        <th>
                            Estado
                        </th>

                        <th>
                            Fecha
                        </th>

                        <th>
                            Comercial
                        </th>

                        <th>
                            Acciones
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${rows.map(pagare => `

                        <tr>

                            <td data-label="Fecha emisión">

                                ${esc(
                                    formatDate(
                                        pagare.fechaEmision
                                    )
                                )}

                            </td>


                            <td data-label="# Póliza">

                                <strong>
                                    ${esc(
                                        pagare.poliza
                                    )}
                                </strong>

                            </td>


                            <td data-label="Tomador">

                                <strong>
                                    ${esc(
                                        pagare.tomador
                                    )}
                                </strong>

                            </td>


                            <td data-label="NIT">

                                ${esc(
                                    pagare.nit
                                )}

                            </td>


                            <td data-label="Tipo">

                                ${esc(
                                    pagare.tipo
                                )}

                            </td>


                            <td data-label="Estado">

                                <span
                                    class="status ${cls(
                                        pagare.estado
                                    )}"
                                >

                                    ${esc(
                                        pagare.estado
                                    )}

                                </span>

                            </td>


                            <td data-label="Fecha">

                                ${esc(
                                    formatDate(
                                        pagare.fecha
                                    )
                                )}

                            </td>


                            <td data-label="Comercial">

                                ${esc(
                                    pagare.comercial
                                )}

                            </td>


                            <td data-label="Acciones">

                                <div class="actions">

                                    <button
                                        class="icon"
                                        title="Editar pagaré"
                                        onclick="editPagare('${pagare.id}')"
                                    >
                                        ✎
                                    </button>


                                    <button
                                        class="icon"
                                        title="Enviar recordatorio por WhatsApp"
                                        onclick="whatsappPagare('${pagare.id}')"
                                    >
                                        💬
                                    </button>


                                    <button
                                        class="icon"
                                        title="Cambiar estado"
                                        onclick="openPagareStatus('${pagare.id}')"
                                    >
                                        ↻
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `).join('')}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   WHATSAPP PAGARÉS
   ========================================================= */

function whatsappPagare(id) {

    const pagare =
        pagares.find(
            p => p.id === id
        );


    if (!pagare) return;


    const commercial =
        config.commercials.find(
            c => c.name === pagare.comercial
        );


    if (!commercial?.phone) {

        alert(
            'Primero agrega el número de WhatsApp de este comercial en Configuración.'
        );

        return;
    }


    const hand =
        String.fromCodePoint(0x1F44B);


    const message = [

        `Hola ${pagare.comercial}`,

        '',

        'Te comparto el estado del pagaré:',

        '',

        `• Fecha de emisión: ${
            formatDate(pagare.fechaEmision)
        }`,

        `• # Póliza: ${
            pagare.poliza
        }`,

        `• Tomador: ${
            pagare.tomador
        }`,

        `• NIT: ${
            pagare.nit
        }`,

        `• Tipo: ${
            pagare.tipo
        }`,

        `• Estado: ${
            pagare.estado
        }`,

        `• Fecha: ${
            formatDate(pagare.fecha)
        }`,

        '',

        'Por favor realizar seguimiento. ¡Gracias!'
    ].join('\n');


    const phone =
        String(commercial.phone)
            .replace(/\D/g, '');


    const url =
        'https://wa.me/' +
        phone +
        '?text=' +
        encodeURIComponent(message);


    window.open(
        url,
        '_blank'
    );
}

/* =========================================================
   ESTADO PAGARÉ
   ========================================================= */

function openPagareStatus(id) {

    const pagare =
        pagares.find(
            p => p.id === id
        );


    if (!pagare) return;


    pagareStatusId = id;


    if ($('pagareModalInfo')) {

        $('pagareModalInfo').textContent =
            `${pagare.tomador} · ${pagare.poliza}`;
    }


    if ($('newPagareStatus')) {

        $('newPagareStatus').value =
            pagare.estado;
    }


    if ($('pagareModal')) {

        $('pagareModal')
            .classList
            .remove('hidden');
    }
}


function closePagareStatus() {

    if ($('pagareModal')) {

        $('pagareModal')
            .classList
            .add('hidden');
    }


    pagareStatusId = null;
}


if ($('savePagareStatus')) {

    $('savePagareStatus').onclick =
        async () => {

            const pagare =
                pagares.find(
                    p => p.id === pagareStatusId
                );


            if (!pagare) return;


            const estado =
                $('newPagareStatus').value;


            try {

                const response =
                    await apiWrite(
                        'updatePagareStatus',
                        {
                            id: pagare.id,
                            estado
                        }
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        'No se pudo actualizar el pagaré'
                    );
                }


                await syncAll();


                toast(
                    'Estado del pagaré actualizado'
                );


            } catch (error) {

                toast(
                    'No se pudo actualizar: ' +
                    error.message
                );
            }


            closePagareStatus();
        };
}


if ($('closePagareModal')) {

    $('closePagareModal').onclick =
        closePagareStatus;
}


if ($('cancelPagareStatus')) {

    $('cancelPagareStatus').onclick =
        closePagareStatus;
}

/* =========================================================
   NEGOCIOS DECLINADOS
   ========================================================= */

function fillDeclinadoForm() {

    if (
        $('declinadoFecha') &&
        !editingDeclinadoId
    ) {

        $('declinadoFecha').value =
            $('declinadoFecha').value ||
            today();
    }


    if ($('declinadoComercial')) {

        let html =
            '<option value="">Seleccionar...</option>';

        config.commercials.forEach(commercial => {

            html += `
                <option value="${esc(commercial.name)}">
                    ${esc(commercial.name)}
                </option>
            `;

        });

        $('declinadoComercial').innerHTML = html;
    }


    if ($('declinadoIntermediario')) {

        let html =
            '<option value="">Seleccionar...</option>';

        config.intermediaries.forEach(intermediary => {

            html += `
                <option value="${esc(intermediary)}">
                    ${esc(intermediary)}
                </option>
            `;

        });

        $('declinadoIntermediario').innerHTML = html;
    }


    /* FILTROS */

    if ($('declinadoComercialFilter')) {

        const current =
            $('declinadoComercialFilter').value;

        let html =
            '<option value="">Todos los comerciales</option>';

        config.commercials.forEach(commercial => {

            html += `
                <option value="${esc(commercial.name)}">
                    ${esc(commercial.name)}
                </option>
            `;

        });

        $('declinadoComercialFilter').innerHTML = html;

        $('declinadoComercialFilter').value = current;
    }


    if ($('declinadoIntermediarioFilter')) {

        const current =
            $('declinadoIntermediarioFilter').value;

        let html =
            '<option value="">Todos los intermediarios</option>';

        config.intermediaries.forEach(intermediary => {

            html += `
                <option value="${esc(intermediary)}">
                    ${esc(intermediary)}
                </option>
            `;

        });

        $('declinadoIntermediarioFilter').innerHTML = html;

        $('declinadoIntermediarioFilter').value = current;
    }
}


function clearDeclinadoEditState() {

    editingDeclinadoId = null;

    if ($('declinadoEditId')) {

        $('declinadoEditId').value = '';
    }

    if ($('declinadoFormTitle')) {

        $('declinadoFormTitle').textContent =
            'Nuevo negocio declinado';
    }

    if ($('declinadoSubmitBtn')) {

        $('declinadoSubmitBtn').textContent =
            'Guardar';
    }
}


function applyDeclinadoToForm(declinado) {

    if ($('declinadoFecha')) {
        $('declinadoFecha').value =
            declinado.fecha || today();
    }

    if ($('declinadoTomador')) {
        $('declinadoTomador').value =
            declinado.tomador || '';
    }

    if ($('declinadoNit')) {
        $('declinadoNit').value =
            declinado.nit || '';
    }

    if ($('declinadoComercial')) {
        $('declinadoComercial').value =
            declinado.comercial || '';
    }

    if ($('declinadoIntermediario')) {
        $('declinadoIntermediario').value =
            declinado.intermediario || '';
    }

    if ($('declinadoObservaciones')) {
        $('declinadoObservaciones').value =
            declinado.observaciones || '';
    }
}


function editDeclinado(id) {

    const declinado =
        declinados.find(
            d => d.id === id
        );


    if (!declinado) return;


    editingDeclinadoId = id;

    go('declinados');

    applyDeclinadoToForm(declinado);


    if ($('declinadoFormTitle')) {

        $('declinadoFormTitle').textContent =
            `Editar declinado — ${declinado.tomador || ''}`;

        $('declinadoFormTitle')
            .scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
    }

    if ($('declinadoSubmitBtn')) {

        $('declinadoSubmitBtn').textContent =
            'Actualizar';
    }

    if ($('declinadoEditId')) {

        $('declinadoEditId').value = id;
    }
}


if ($('newDeclinadoBtn')) {

    $('newDeclinadoBtn').addEventListener(
        'click',
        () => {

            clearDeclinadoEditState();

            if ($('declinadoForm')) {

                $('declinadoForm').reset();
            }

            go('declinados');

            if ($('declinadoFormTitle')) {

                $('declinadoFormTitle')
                    .scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
            }
        }
    );
}


if ($('cancelDeclinadoForm')) {

    $('cancelDeclinadoForm').addEventListener(
        'click',
        () => {

            clearDeclinadoEditState();

            if ($('declinadoForm')) {

                $('declinadoForm').reset();
            }

            fillDeclinadoForm();
        }
    );
}


if ($('declinadoForm')) {

    $('declinadoForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const isEditing =
                !!editingDeclinadoId;


            const declinado = {

                id:
                    isEditing
                        ? editingDeclinadoId
                        : (
                            window.crypto &&
                            typeof crypto.randomUUID ===
                            'function'

                                ? crypto.randomUUID()

                                : String(Date.now())
                          ),


                fecha:
                    $('declinadoFecha').value,


                tomador:
                    $('declinadoTomador').value.trim(),


                nit:
                    $('declinadoNit').value.trim(),


                comercial:
                    $('declinadoComercial').value,


                intermediario:
                    $('declinadoIntermediario').value,


                observaciones:
                    $('declinadoObservaciones').value.trim()
            };


            const button =
                event.submitter;

            const originalLabel =
                button ? button.textContent : '';


            if (button) {

                button.disabled = true;

                button.textContent =
                    isEditing
                        ? 'Actualizando...'
                        : 'Guardando...';
            }


            try {

                const response =
                    await apiWrite(
                        isEditing
                            ? 'updateDeclinado'
                            : 'saveDeclinado',
                        declinado
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        (isEditing
                            ? 'No se pudo actualizar el registro'
                            : 'No se pudo guardar el registro')
                    );
                }


                if ($('declinadoForm')) {

                    $('declinadoForm').reset();
                }


                clearDeclinadoEditState();


                if ($('declinadoFecha')) {

                    $('declinadoFecha').value =
                        today();
                }


                await syncAll();


                toast(
                    isEditing
                        ? 'Negocio declinado actualizado en Google Sheets'
                        : 'Negocio declinado guardado en Google Sheets'
                );


            } catch (error) {

                toast(
                    (isEditing
                        ? 'No se pudo actualizar: '
                        : 'No se pudo guardar: ') +
                    error.message
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        originalLabel;
                }
            }
        }
    );
}


function renderDeclinados() {

    if (!$('declinadosTable')) return;


    const search =
        ($('declinadoSearch')?.value || '')
            .toLowerCase()
            .trim();

    const comercialFilter =
        $('declinadoComercialFilter')?.value || '';

    const intermediarioFilter =
        $('declinadoIntermediarioFilter')?.value || '';

    const monthFilter =
        $('declinadoMonth')?.value || '';


    const rows =
        declinados
            .filter(d => {

                const text = `
                    ${d.tomador || ''}
                    ${d.nit || ''}
                    ${d.comercial || ''}
                    ${d.intermediario || ''}
                `.toLowerCase();


                const matchesSearch =
                    !search ||
                    text.includes(search);


                const matchesComercial =
                    !comercialFilter ||
                    d.comercial === comercialFilter;


                const matchesIntermediario =
                    !intermediarioFilter ||
                    d.intermediario === intermediarioFilter;


                const matchesMonth =
                    !monthFilter ||
                    String(d.fecha || '').slice(0, 7) === monthFilter;


                return (
                    matchesSearch &&
                    matchesComercial &&
                    matchesIntermediario &&
                    matchesMonth
                );

            })
            .sort((a, b) => {

                const dateA =
                    new Date(a.fecha || 0).getTime();

                const dateB =
                    new Date(b.fecha || 0).getTime();

                return dateB - dateA;
            });


    lastFilteredDeclinados = rows;


    if ($('sDeclinadosCount')) {

        $('sDeclinadosCount').textContent =
            rows.length;
    }


    if (!rows.length) {

        $('declinadosTable').innerHTML = `
            <div class="empty">
                No hay negocios declinados registrados con estos filtros.
            </div>
        `;

        return;
    }


    $('declinadosTable').innerHTML = `

        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>Fecha</th>

                        <th>Tomador / NIT</th>

                        <th>Comercial</th>

                        <th>Intermediario</th>

                        <th>Observaciones</th>

                        <th>Acciones</th>

                    </tr>

                </thead>

                <tbody>

                    ${rows.map(d => `

                        <tr>

                            <td data-label="Fecha">

                                ${esc(
                                    formatDate(d.fecha)
                                )}

                            </td>


                            <td data-label="Tomador / NIT">

                                <strong>
                                    ${esc(d.tomador)}
                                </strong>

                                <span class="sub">
                                    NIT: ${esc(d.nit)}
                                </span>

                            </td>


                            <td data-label="Comercial">

                                ${esc(
                                    d.comercial || '—'
                                )}

                            </td>


                            <td data-label="Intermediario">

                                ${esc(
                                    d.intermediario || '—'
                                )}

                            </td>


                            <td data-label="Observaciones">

                                ${esc(
                                    d.observaciones || '—'
                                )}

                            </td>


                            <td data-label="Acciones">

                                <div class="actions">

                                    <button
                                        class="icon"
                                        title="Editar registro"
                                        onclick="editDeclinado('${d.id}')"
                                    >
                                        ✎
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `).join('')}

                </tbody>

            </table>

        </div>
    `;
}


if ($('declinadoSearch')) {

    $('declinadoSearch').addEventListener(
        'input',
        renderDeclinados
    );
}


if ($('declinadoComercialFilter')) {

    $('declinadoComercialFilter').addEventListener(
        'change',
        renderDeclinados
    );
}


if ($('declinadoIntermediarioFilter')) {

    $('declinadoIntermediarioFilter').addEventListener(
        'change',
        renderDeclinados
    );
}


if ($('declinadoMonth')) {

    $('declinadoMonth').addEventListener(
        'change',
        renderDeclinados
    );
}


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

function renderConfig() {

    /* COMERCIALES */

    if ($('comList')) {

        if (config.commercials.length) {

            $('comList').innerHTML =
                config.commercials
                    .map((commercial, index) => `

                        <div class="item">

                            <span>

                                <strong>
                                    ${esc(
                                        commercial.name
                                    )}
                                </strong>

                                <br>

                                <small>
                                    ${esc(
                                        commercial.phone || 'Sin número'
                                    )}
                                </small>

                            </span>


                            <button
                                class="icon"
                                title="Eliminar comercial"
                                onclick="removeCom(${index})"
                            >
                                ×
                            </button>

                        </div>

                    `)
                    .join('');

        } else {

            $('comList').innerHTML =
                'Todavía no has agregado comerciales.';
        }
    }


    /* INTERMEDIARIOS */

    if ($('intList')) {

        if (config.intermediaries.length) {

            $('intList').innerHTML =
                config.intermediaries
                    .map((intermediary, index) => `

                        <div class="item">

                            <span>
                                ${esc(intermediary)}
                            </span>


                            <button
                                class="icon"
                                title="Eliminar intermediario"
                                onclick="removeInt(${index})"
                            >
                                ×
                            </button>

                        </div>

                    `)
                    .join('');

        } else {

            $('intList').innerHTML =
                'Todavía no has agregado intermediarios.';
        }
    }
}


/* =========================================================
   AGREGAR COMERCIAL
   ========================================================= */

if ($('addCom')) {

    $('addCom').addEventListener(
        'click',
        async () => {

            const name =
                $('comName')?.value.trim() || '';

            const phone =
                $('comPhone')?.value.trim() || '';


            if (!name) {

                toast(
                    'Escribe el nombre del comercial'
                );

                return;
            }


            const button =
                $('addCom');

            const originalLabel =
                button.textContent;

            button.disabled = true;

            button.textContent =
                'Agregando...';


            try {

                const response =
                    await apiWrite(
                        'addCommercial',
                        {
                            name,
                            phone
                        }
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        'No se pudo agregar el comercial'
                    );
                }


                if ($('comName')) $('comName').value = '';

                if ($('comPhone')) $('comPhone').value = '';


                await syncAll();

                toast(
                    'Comercial agregado correctamente.'
                );


            } catch (error) {

                toast(
                    'No se pudo agregar: ' +
                    error.message
                );


            } finally {

                button.disabled = false;

                button.textContent =
                    originalLabel;
            }
        }
    );
}


/* =========================================================
   ELIMINAR COMERCIAL
   ========================================================= */

async function removeCom(index) {

    const commercial =
        config.commercials[index];

    if (!commercial) return;


    if (!confirm(
        `¿Eliminar al comercial "${commercial.name}"? Esto no afecta las cotizaciones ya registradas con su nombre.`
    )) {

        return;
    }


    try {

        const response =
            await apiWrite(
                'removeCommercial',
                {
                    name: commercial.name
                }
            );


        if (!response.success) {

            throw new Error(
                response.error ||
                'No se pudo eliminar el comercial'
            );
        }


        await syncAll();

        toast(
            'Comercial eliminado correctamente.'
        );


    } catch (error) {

        toast(
            'No se pudo eliminar: ' +
            error.message
        );
    }
}


/* =========================================================
   AGREGAR INTERMEDIARIO
   ========================================================= */

if ($('addInt')) {

    $('addInt').addEventListener(
        'click',
        async () => {

            const name =
                $('intName')?.value.trim() || '';


            if (!name) {

                toast(
                    'Escribe el nombre del intermediario'
                );

                return;
            }


            const button =
                $('addInt');

            const originalLabel =
                button.textContent;

            button.disabled = true;

            button.textContent =
                'Agregando...';


            try {

                const response =
                    await apiWrite(
                        'addIntermediary',
                        {
                            name
                        }
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        'No se pudo agregar el intermediario'
                    );
                }


                if ($('intName')) $('intName').value = '';


                await syncAll();

                toast(
                    'Intermediario agregado correctamente.'
                );


            } catch (error) {

                toast(
                    'No se pudo agregar: ' +
                    error.message
                );


            } finally {

                button.disabled = false;

                button.textContent =
                    originalLabel;
            }
        }
    );
}


/* =========================================================
   ELIMINAR INTERMEDIARIO
   ========================================================= */

async function removeInt(index) {

    const intermediary =
        config.intermediaries[index];

    if (!intermediary) return;


    if (!confirm(
        `¿Eliminar el intermediario "${intermediary}"? Esto no afecta las cotizaciones ya registradas con su nombre.`
    )) {

        return;
    }


    try {

        const response =
            await apiWrite(
                'removeIntermediary',
                {
                    name: intermediary
                }
            );


        if (!response.success) {

            throw new Error(
                response.error ||
                'No se pudo eliminar el intermediario'
            );
        }


        await syncAll();

        toast(
            'Intermediario eliminado correctamente.'
        );


    } catch (error) {

        toast(
            'No se pudo eliminar: ' +
            error.message
        );
    }
}


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

document
    .querySelectorAll('[data-go]')
    .forEach(button => {

        button.addEventListener(
            'click',
            () => {

                go(button.dataset.go);

            }
        );

    });


document
    .querySelectorAll('.nav-btn')
    .forEach(button => {

        button.addEventListener(
            'click',
            () => {

                go(button.dataset.page);

            }
        );

    });


/* =========================================================
   BÚSQUEDA COTIZACIONES
   ========================================================= */

if ($('search')) {

    $('search').addEventListener(
        'input',
        render
    );
}


if ($('filter')) {

    $('filter').addEventListener(
        'change',
        render
    );
}


/* =========================================================
   BÚSQUEDA PAGARÉS
   ========================================================= */

if ($('pagareSearch')) {

    $('pagareSearch').addEventListener(
        'input',
        renderPagares
    );
}


if ($('pagareFilter')) {

    $('pagareFilter').addEventListener(
        'change',
        renderPagares
    );
}


/* =========================================================
   PRESUPUESTO
   ========================================================= */

function fillBudgetForm() {

    if (
        $('budgetMonth') &&
        !$('budgetMonth').value
    ) {

        $('budgetMonth').value =
            new Date()
                .toISOString()
                .slice(0, 7);
    }


    const month =
        $('budgetMonth')?.value || '';

    const entry =
        budgets.find(
            b => b.mes === month
        );


    if ($('budgetValue')) {

        $('budgetValue').value =
            entry
                ? entry.presupuesto
                : '';
    }


    renderBudget();
}


function renderBudget() {

    if (!$('bPresupuesto')) return;


    const month =
        $('budgetMonth')?.value ||
        new Date().toISOString().slice(0, 7);

    const entry =
        budgets.find(
            b => b.mes === month
        );

    const presupuesto =
        entry
            ? Number(entry.presupuesto) || 0
            : 0;

    const quotesThisMonth =
        quotes.filter(q =>
            String(q.fecha || '').slice(0, 7) === month
        );

    const wonThisMonth =
        quotesThisMonth.filter(
            q => q.estado === 'Ganada'
        );

    const primaGanada =
        wonThisMonth.reduce(
            (sum, q) => sum + quotePrimaTotal(q),
            0
        );

    const restante =
        presupuesto - primaGanada;

    const percent =
        presupuesto > 0
            ? Math.round((primaGanada / presupuesto) * 100)
            : 0;


    /*
     * Guardamos el contexto del mes actual para
     * poder reutilizarlo en el reporte de Excel.
     */

    lastBudgetContext = {
        month,
        presupuesto,
        primaGanada,
        restante,
        percent,
        quotesThisMonth,
        wonThisMonth
    };


    if ($('bPresupuesto')) {

        $('bPresupuesto').textContent =
            money(presupuesto);
    }

    if ($('bGanada')) {

        $('bGanada').textContent =
            money(primaGanada);
    }

    if ($('bRestante')) {

        $('bRestante').textContent =
            money(restante);
    }

    if ($('bCount')) {

        $('bCount').textContent =
            wonThisMonth.reduce(
                (sum, q) => sum + quoteBusinessCount(q),
                0
            );
    }

    if ($('budgetPercent')) {

        $('budgetPercent').textContent =
            percent + '%';
    }

    if ($('budgetProgressFill')) {

        $('budgetProgressFill').style.width =
            Math.min(100, Math.max(0, percent)) + '%';

        $('budgetProgressFill').classList.toggle(
            'over',
            percent >= 100 && presupuesto > 0
        );
    }


    if ($('budgetQuotesTable')) {

        $('budgetQuotesTable').innerHTML =
            quotesThisMonth.length
                ? table(quotesThisMonth)
                : `
                    <div class="empty">
                        No hay cotizaciones registradas para este mes.
                    </div>
                `;
    }


    renderBudgetChart();
}


/* =========================================================
   GRÁFICA COMPARATIVA ANUAL (PRESUPUESTO VS LOGRADO)
   ========================================================= */

const BUDGET_CHART_MONTH_NAMES = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

function niceCeil(value) {

    if (value <= 0) return 1;

    const exponent =
        Math.floor(Math.log10(value));

    const magnitude =
        Math.pow(10, exponent);

    const residual =
        value / magnitude;

    let niceResidual;

    if (residual <= 1) niceResidual = 1;
    else if (residual <= 2) niceResidual = 2;
    else if (residual <= 5) niceResidual = 5;
    else niceResidual = 10;

    return niceResidual * magnitude;
}

function compactMoney(value) {

    try {

        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(Number(value) || 0);

    } catch {

        return money(value);
    }
}

function buildBudgetChartSVG(data) {

    const width = 1000;
    const height = 340;

    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 46;

    const chartWidth =
        width - paddingLeft - paddingRight;

    const chartHeight =
        height - paddingTop - paddingBottom;

    const groupCount =
        data.length;

    const groupWidth =
        chartWidth / groupCount;

    const barGap =
        groupWidth * 0.12;

    const barWidth =
        (groupWidth - (barGap * 3)) / 2;

    const maxValue =
        Math.max(
            1,
            ...data.flatMap(
                d => [d.presupuesto, d.logrado]
            )
        );

    const niceMax =
        niceCeil(maxValue);

    const scale = value =>
        (value / niceMax) * chartHeight;

    const baseY =
        paddingTop + chartHeight;


    let svg = `
        <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    `;


    /* LÍNEAS DE REFERENCIA */

    for (let i = 0; i <= 4; i++) {

        const y =
            paddingTop + chartHeight - (chartHeight * i / 4);

        const value =
            niceMax * i / 4;

        svg += `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}"
                stroke="#e5e9ee" stroke-width="1" />
            <text x="${paddingLeft - 8}" y="${y + 4}" font-size="10" fill="#8a97a6"
                text-anchor="end">${esc(compactMoney(value))}</text>
        `;

    }


    /* SEPARADOR ANTES DEL GRUPO "TOTAL" */

    if (data.some(d => d.isTotal)) {

        const totalIndex =
            data.findIndex(d => d.isTotal);

        const sepX =
            paddingLeft + (totalIndex * groupWidth);

        svg += `
            <line x1="${sepX}" y1="${paddingTop}" x2="${sepX}" y2="${baseY}"
                stroke="#c7cfd8" stroke-width="1" stroke-dasharray="4 4" />
        `;

    }


    /* BARRAS */

    data.forEach((d, i) => {

        const groupX =
            paddingLeft + (i * groupWidth);

        const bar1X =
            groupX + barGap;

        const bar2X =
            bar1X + barWidth + barGap;

        const h1 =
            scale(d.presupuesto);

        const h2 =
            scale(d.logrado);

        const y1 =
            baseY - h1;

        const y2 =
            baseY - h2;

        const color1 =
            d.isTotal ? '#123a56' : '#1d5b8f';

        const color2 =
            d.isTotal ? '#0d5c3d' : '#14835b';

        svg += `
            <rect x="${bar1X}" y="${y1}" width="${barWidth}" height="${h1}"
                rx="3" fill="${color1}">
                <title>${esc(d.label)} — Presupuesto: ${esc(money(d.presupuesto))}</title>
            </rect>
            <rect x="${bar2X}" y="${y2}" width="${barWidth}" height="${h2}"
                rx="3" fill="${color2}">
                <title>${esc(d.label)} — Prima lograda: ${esc(money(d.logrado))}</title>
            </rect>
            <text x="${groupX + (groupWidth / 2)}" y="${height - paddingBottom + 18}"
                font-size="11" fill="#475467" text-anchor="middle"
                font-weight="${d.isTotal ? '800' : '600'}">${esc(d.label)}</text>
        `;

    });


    /* EJE BASE */

    svg += `
        <line x1="${paddingLeft}" y1="${baseY}" x2="${width - paddingRight}" y2="${baseY}"
            stroke="#c7cfd8" stroke-width="1.5" />
    `;


    svg += `</svg>`;

    return svg;
}

function renderBudgetChart() {

    if (!$('budgetChartContainer')) return;


    const currentYear =
        new Date().getFullYear();

    const years = new Set();

    years.add(String(currentYear));

    budgets.forEach(b => {

        if (b.mes) years.add(String(b.mes).slice(0, 4));
    });

    quotes.forEach(q => {

        if (q.fecha) years.add(String(q.fecha).slice(0, 4));
    });

    const sortedYears =
        Array.from(years)
            .filter(Boolean)
            .sort();


    if ($('budgetChartYear')) {

        const previousValue =
            $('budgetChartYear').value ||
            String(currentYear);

        $('budgetChartYear').innerHTML =
            sortedYears
                .map(y => `<option value="${y}">${y}</option>`)
                .join('');

        $('budgetChartYear').value =
            sortedYears.includes(previousValue)
                ? previousValue
                : String(currentYear);
    }


    const year =
        $('budgetChartYear')?.value ||
        String(currentYear);


    const data = [];

    let totalPresupuesto = 0;
    let totalLogrado = 0;


    for (let m = 1; m <= 12; m++) {

        const key =
            `${year}-${String(m).padStart(2, '0')}`;

        const entry =
            budgets.find(b => b.mes === key);

        const presupuesto =
            entry
                ? Number(entry.presupuesto) || 0
                : 0;

        const logrado =
            quotes
                .filter(q =>
                    q.estado === 'Ganada' &&
                    String(q.fecha || '').slice(0, 7) === key
                )
                .reduce(
                    (sum, q) => sum + quotePrimaTotal(q),
                    0
                );

        totalPresupuesto += presupuesto;

        totalLogrado += logrado;

        data.push({

            label: BUDGET_CHART_MONTH_NAMES[m - 1],

            presupuesto,

            logrado,

            isTotal: false

        });

    }

    data.push({

        label: 'Total',

        presupuesto: totalPresupuesto,

        logrado: totalLogrado,

        isTotal: true

    });


    $('budgetChartContainer').innerHTML =
        buildBudgetChartSVG(data);
}


if ($('budgetChartYear')) {

    $('budgetChartYear').addEventListener(
        'change',
        renderBudgetChart
    );
}


if ($('budgetMonth')) {

    $('budgetMonth').addEventListener(
        'change',
        fillBudgetForm
    );
}


if ($('saveBudgetBtn')) {

    $('saveBudgetBtn').addEventListener(
        'click',
        async () => {

            const month =
                $('budgetMonth')?.value || '';

            const value =
                $('budgetValue')?.value || '';


            if (!month) {

                toast(
                    'Selecciona un mes'
                );

                return;
            }


            const button =
                $('saveBudgetBtn');

            const originalLabel =
                button ? button.textContent : '';


            if (button) {

                button.disabled = true;

                button.textContent =
                    'Guardando...';
            }


            try {

                const response =
                    await apiWrite(
                        'saveBudget',
                        {
                            mes: month,
                            presupuesto: value
                        }
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        'No se pudo guardar el presupuesto'
                    );
                }


                await syncAll();

                fillBudgetForm();

                toast(
                    'Presupuesto guardado en Google Sheets'
                );


            } catch (error) {

                toast(
                    'No se pudo guardar el presupuesto: ' +
                    error.message
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        originalLabel;
                }
            }
        }
    );
}


/* =========================================================
   FILTROS POR MES (COTIZACIONES / PAGARÉS)
   ========================================================= */

if ($('listMonth')) {

    $('listMonth').addEventListener(
        'change',
        render
    );
}


if ($('pagareMonth')) {

    $('pagareMonth').addEventListener(
        'change',
        renderPagares
    );
}


/* =========================================================
   EXPORTAR A EXCEL
   ========================================================= */

function autoFitColumns(worksheet, rows) {

    if (!rows.length) return;

    const headers =
        Object.keys(rows[0]);

    worksheet['!cols'] =
        headers.map(header => {

            const maxLen =
                Math.max(
                    header.length,
                    ...rows.map(
                        row => String(
                            row[header] ?? ''
                        ).length
                    )
                );

            return {
                wch: Math.min(
                    Math.max(maxLen + 2, 10),
                    40
                )
            };

        });
}


function downloadWorkbook(workbook, filename) {

    if (typeof XLSX === 'undefined') {

        toast(
            'No se pudo cargar el motor de Excel. Verifica tu conexión a internet e inténtalo de nuevo.'
        );

        return false;
    }

    XLSX.writeFile(
        workbook,
        filename
    );

    return true;
}


function quotesToRows(list) {

    return list.map(q => ({

        'Fecha de solicitud': q.fecha || '',

        'Tomador': q.tomador || '',

        'NIT': q.nit || '',

        'Entidad contratante': q.entidad || '',

        'Comercial': q.comercial || '',

        'Tipo de póliza': q.tipo || '',

        'Valor contrato': Number(q.valor) || 0,

        'Prima CUM': Number(q.primaCum) || 0,

        'Prima RCE': Number(q.primaRce) || 0,

        'Prima total': quotePrimaTotal(q),

        'Tasa CUM - RCE': q.tasa || '',

        'Intermediario': q.intermediario || '',

        'Estado': q.estado || '',

        'Observaciones': q.observaciones || '',

        'Fecha de creación': q.fechaCreacion || '',

        'Última actualización': q.ultimaActualizacion || ''

    }));
}


function pagaresToRows(list) {

    return list.map(p => ({

        'Fecha emisión': p.fechaEmision || '',

        '# Póliza': p.poliza || '',

        'Tomador': p.tomador || '',

        'NIT': p.nit || '',

        'Tipo': p.tipo || '',

        'Estado': p.estado || '',

        'Fecha': p.fecha || '',

        'Comercial': p.comercial || '',

        'Fecha de creación': p.fechaCreacion || '',

        'Última actualización': p.ultimaActualizacion || ''

    }));
}


function declinadosToRows(list) {

    return list.map(d => ({

        'Fecha de solicitud': d.fecha || '',

        'Tomador': d.tomador || '',

        'NIT': d.nit || '',

        'Comercial': d.comercial || '',

        'Intermediario': d.intermediario || '',

        'Observaciones': d.observaciones || '',

        'Fecha de creación': d.fechaCreacion || '',

        'Última actualización': d.ultimaActualizacion || ''

    }));
}


function exportQuotesExcel() {

    if (!lastFilteredQuotes.length) {

        toast(
            'No hay cotizaciones para exportar con los filtros actuales.'
        );

        return;
    }

    const rows =
        quotesToRows(lastFilteredQuotes);

    const worksheet =
        XLSX.utils.json_to_sheet(rows);

    autoFitColumns(worksheet, rows);

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Cotizaciones'
    );

    downloadWorkbook(
        workbook,
        `CUMTRACK_Cotizaciones_${today()}.xlsx`
    );
}


function exportPagaresExcel() {

    if (!lastFilteredPagares.length) {

        toast(
            'No hay pagarés para exportar con los filtros actuales.'
        );

        return;
    }

    const rows =
        pagaresToRows(lastFilteredPagares);

    const worksheet =
        XLSX.utils.json_to_sheet(rows);

    autoFitColumns(worksheet, rows);

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Pagarés'
    );

    downloadWorkbook(
        workbook,
        `CUMTRACK_Pagares_${today()}.xlsx`
    );
}


function exportDeclinadosExcel() {

    if (!lastFilteredDeclinados.length) {

        toast(
            'No hay negocios declinados para exportar con los filtros actuales.'
        );

        return;
    }

    const rows =
        declinadosToRows(lastFilteredDeclinados);

    const worksheet =
        XLSX.utils.json_to_sheet(rows);

    autoFitColumns(worksheet, rows);

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Declinados'
    );

    downloadWorkbook(
        workbook,
        `CUMTRACK_Declinados_${today()}.xlsx`
    );
}


function exportBudgetExcel() {

    if (!lastBudgetContext) {

        toast(
            'Selecciona un mes en Presupuesto primero.'
        );

        return;
    }

    const {
        month,
        presupuesto,
        primaGanada,
        restante,
        percent,
        quotesThisMonth,
        wonThisMonth
    } = lastBudgetContext;


    const workbook =
        XLSX.utils.book_new();


    /* HOJA 1: RESUMEN */

    const resumenRows = [{

        'Mes': month,

        'Presupuesto': presupuesto,

        'Prima ganada': primaGanada,

        'Restante': restante,

        '% Cumplimiento': percent,

        'Cotizaciones ganadas': wonThisMonth.reduce((sum, q) => sum + quoteBusinessCount(q), 0),

        'Cotizaciones totales del mes': quotesThisMonth.reduce((sum, q) => sum + quoteBusinessCount(q), 0)

    }];

    const resumenSheet =
        XLSX.utils.json_to_sheet(resumenRows);

    autoFitColumns(resumenSheet, resumenRows);

    XLSX.utils.book_append_sheet(
        workbook,
        resumenSheet,
        'Resumen presupuesto'
    );


    /* HOJA 2: COTIZACIONES DEL MES */

    const quoteRows =
        quotesToRows(quotesThisMonth);

    const quotesSheet =
        quoteRows.length
            ? XLSX.utils.json_to_sheet(quoteRows)
            : XLSX.utils.aoa_to_sheet([[
                'No hay cotizaciones registradas para este mes.'
            ]]);

    if (quoteRows.length) {

        autoFitColumns(quotesSheet, quoteRows);
    }

    XLSX.utils.book_append_sheet(
        workbook,
        quotesSheet,
        'Cotizaciones del mes'
    );


    downloadWorkbook(
        workbook,
        `CUMTRACK_Presupuesto_${month}.xlsx`
    );
}


if ($('downloadQuotesBtn')) {

    $('downloadQuotesBtn').addEventListener(
        'click',
        exportQuotesExcel
    );
}


if ($('downloadPagaresBtn')) {

    $('downloadPagaresBtn').addEventListener(
        'click',
        exportPagaresExcel
    );
}


if ($('downloadDeclinadosBtn')) {

    $('downloadDeclinadosBtn').addEventListener(
        'click',
        exportDeclinadosExcel
    );
}


if ($('downloadBudgetBtn')) {

    $('downloadBudgetBtn').addEventListener(
        'click',
        exportBudgetExcel
    );
}


/* =========================================================
   INICIO
   ========================================================= */

fillForm();

fillPagareForm();

render();

syncAll();