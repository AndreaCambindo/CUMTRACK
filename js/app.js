const API_URL = 'https://script.google.com/macros/s/AKfycby-yE_l9CX8gw5PaoX_cIJbw6BXK1Tp_rt1BuqQoBlFdpRiHcf8NB09VQDhfL4S5s6smw/exec';

const LOCAL_KEY = 'cumtrack_local_backup_v2';
const CONFIG_KEY = 'cumtrack_config_backup_v2';
const PAGARES_KEY = 'cumtrack_pagares_local_backup_v2';

let quotes = [];
let pagares = [];

let config = {
    commercials: [],
    intermediaries: []
};

let statusId = null;
let pagareStatusId = null;


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
            pagaresResponse
        ] = await Promise.all([

            jsonp('getQuotes'),

            jsonp('getCommercials'),

            jsonp('getIntermediaries'),

            jsonp('getPagares')
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


        saveBackup();

        fillForm();

        fillPagareForm();

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


        fillForm();

        fillPagareForm();

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

    return jsonp(action, data);
}


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

function go(page) {

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

        fillPagareForm();
    }


    render();
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
            quotes.length;
    }


    if ($('sWon')) {

        $('sWon').textContent =
            quotes.filter(
                q => q.estado === 'Ganada'
            ).length;
    }


    if ($('sLost')) {

        $('sLost').textContent =
            quotes.filter(
                q => q.estado === 'Perdida'
            ).length;
    }


    if ($('sNegotiation')) {

        $('sNegotiation').textContent =
            quotes.filter(
                q => q.estado === 'En negociación'
            ).length;
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


                return (
                    matchesSearch &&
                    matchesFilter
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


    renderConfig();

    renderPagares();
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

                        <tr>

                            <td>

                                <strong>
                                    ${esc(
                                        formatDate(x.fecha)
                                    )}
                                </strong>

                            </td>


                            <td>

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


                            <td>

                                <strong>
                                    ${esc(x.comercial)}
                                </strong>

                            </td>


                            <td>

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


                            <td>

                                <strong>
                                    ${money(x.valor)}
                                </strong>

                                <span class="sub">

                                    Prima:
                                    ${money(x.prima)}

                                </span>

                            </td>


                            <td>

                                ${esc(
                                    x.intermediario || '—'
                                )}

                            </td>


                            <td>

                                <span
                                    class="status ${cls(x.estado)}"
                                >

                                    ${esc(x.estado)}

                                </span>

                            </td>


                            <td>

                                <div class="actions">

                                    <button
                                        class="icon"
                                        title="Enviar recordatorio por WhatsApp"
                                        onclick="whatsapp('${x.id}')"
                                    >
                                        💬
                                    </button>


                                    <button
                                        class="icon"
                                        title="Cambiar estado"
                                        onclick="openStatus('${x.id}')"
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

    if ($('fecha')) {

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
   GUARDAR COTIZACIÓN
========================================================= */

if ($('quoteForm')) {

    $('quoteForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();

            const quote = {

                id:
                    window.crypto &&
                    typeof crypto.randomUUID === 'function'

                        ? crypto.randomUUID()

                        : String(Date.now()),

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

                prima:
                    $('prima').value,

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


            if (button) {

                button.disabled = true;

                button.textContent =
                    'Guardando...';
            }


            try {

                const response =
                    await apiWrite(
                        'saveQuote',
                        quote
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        'No se pudo guardar la cotización'
                    );
                }


                /*
                 * Limpiar formulario
                 */

                $('quoteForm').reset();


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
                    'Cotización guardada en Google Sheets'
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
                    'No se pudo guardar la cotización: ' +
                    error.message
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        'Guardar cotización';
                }
            }
        }
    );
}

/* =========================================================
   WHATSAPP COTIZACIONES
   ========================================================= */

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


    const hand =
        String.fromCodePoint(0x1F44B);


    const message = [

        `Hola ${quote.comercial}`,

        '',

        'Comparto información de cotización realizada:',

        '',

        `• Tomador: ${quote.tomador}`,

        `• NIT: ${quote.nit}`,

        `• Entidad contratante: ${quote.entidad}`,

        `• Tipo de póliza: ${quote.tipo}`,

        `• Valor asegurado: ${money(quote.valor)}`,

        `• Prima sin IVA: ${money(quote.prima)}`,

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
   CONFIGURACIÓN
   ========================================================= */

function renderConfig() {

    if ($('comList')) {

        $('comList').innerHTML =
            config.commercials.length

                ? config.commercials
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
                                        commercial.phone
                                    )}
                                </small>

                            </span>


                            <button
                                class="icon"
                                onclick="removeCom(${index})"
                            >
                                ×
                            </button>

                        </div>

                    `)
                    .join('')

                : 'Los comerciales se administran desde Google Sheets.';
    }


    if ($('intList')) {

        $('intList').innerHTML =
            config.intermediaries.length

                ? config.intermediaries
                    .map(intermediary => `

                        <div class="item">

                            <span>
                                ${esc(intermediary)}
                            </span>

                        </div>

                    `)
                    .join('')

                : 'Los intermediarios se administran desde Google Sheets.';
    }
}


async function removeCom() {

    toast(
        'Edita los comerciales directamente en Google Sheets.'
    );
}


async function removeInt() {

    toast(
        'Edita los intermediarios directamente en Google Sheets.'
    );
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
   GUARDAR PAGARÉ
   ========================================================= */

if ($('pagareForm')) {

    $('pagareForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const pagare = {

                id:
                    window.crypto &&
                    typeof crypto.randomUUID ===
                    'function'

                        ? crypto.randomUUID()

                        : String(Date.now()),


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


            if (button) {

                button.disabled = true;

                button.textContent =
                    'Guardando...';
            }


            try {

                const response =
                    await apiWrite(
                        'savePagare',
                        pagare
                    );


                if (!response.success) {

                    throw new Error(
                        response.error ||
                        'No se pudo guardar el pagaré'
                    );
                }


                if ($('pagareForm')) {

                    $('pagareForm').reset();
                }


                if ($('pagareFechaEmision')) {

                    $('pagareFechaEmision').value =
                        today();
                }


                await syncAll();


                toast(
                    'Pagaré guardado en Google Sheets'
                );


                go('pagares');


            } catch (error) {

                toast(
                    'No se pudo guardar el pagaré: ' +
                    error.message
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        'Guardar pagaré';
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


                return (
                    matchesSearch &&
                    matchesFilter
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

                            <td>

                                ${esc(
                                    formatDate(
                                        pagare.fechaEmision
                                    )
                                )}

                            </td>


                            <td>

                                <strong>
                                    ${esc(
                                        pagare.poliza
                                    )}
                                </strong>

                            </td>


                            <td>

                                <strong>
                                    ${esc(
                                        pagare.tomador
                                    )}
                                </strong>

                            </td>


                            <td>

                                ${esc(
                                    pagare.nit
                                )}

                            </td>


                            <td>

                                ${esc(
                                    pagare.tipo
                                )}

                            </td>


                            <td>

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


                            <td>

                                ${esc(
                                    formatDate(
                                        pagare.fecha
                                    )
                                )}

                            </td>


                            <td>

                                ${esc(
                                    pagare.comercial
                                )}

                            </td>


                            <td>

                                <div class="actions">

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
                                        commercial.phone
                                    )}
                                </small>

                            </span>


                            <button
                                class="icon"
                                onclick="removeCom(${index})"
                            >
                                ×
                            </button>

                        </div>

                    `)
                    .join('');

        } else {

            $('comList').innerHTML =
                'Los comerciales se administran desde Google Sheets.';
        }
    }


    /* INTERMEDIARIOS */

    if ($('intList')) {

        if (config.intermediaries.length) {

            $('intList').innerHTML =
                config.intermediaries
                    .map(intermediary => `

                        <div class="item">

                            <span>
                                ${esc(intermediary)}
                            </span>

                        </div>

                    `)
                    .join('');

        } else {

            $('intList').innerHTML =
                'Los intermediarios se administran desde Google Sheets.';
        }
    }
}


async function removeCom() {

    toast(
        'Edita los comerciales directamente en Google Sheets.'
    );
}


async function removeInt() {

    toast(
        'Edita los intermediarios directamente en Google Sheets.'
    );
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
   INICIO
   ========================================================= */

fillForm();

fillPagareForm();

render();

syncAll();