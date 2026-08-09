const SPREADSHEET_ID = '110bW9yn_2CkyNRfAqF2nILIlKxp-s17hOMMkbaKGP-g';

const SHEET_COTIZACIONES = 'Cotizaciones';
const SHEET_COMERCIALES = 'Comerciales';
const SHEET_INTERMEDIARIOS = 'Intermediarios';
const SHEET_PAGARES = 'Pagares';


/* =========================================================
   ENCABEZADOS
   ========================================================= */

const HC = [
    'ID',
    'Fecha de solicitud',
    'Tomador',
    'NIT',
    'Entidad contratante',
    'Comercial',
    'Tipo de póliza',
    'Valor asegurado',
    'Prima sin IVA',
    'Tasa CUM - RCE',
    'Intermediario',
    'Estado',
    'Observaciones',
    'Fecha de creación',
    'Última actualización'
];

const HCOM = [
    'Comercial',
    'WhatsApp'
];

const HINT = [
    'Intermediario'
];

const HPAG = [
    'ID',
    'Fecha emisión',
    '# Póliza',
    'Tomador',
    'NIT',
    'Tipo',
    'Estado',
    'Fecha',
    'Comercial',
    'Fecha de creación',
    'Última actualización'
];


/* =========================================================
   CONEXIÓN
   ========================================================= */

function ss() {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
}


/* =========================================================
   SETUP
   ========================================================= */

function setup() {

    const s = ss();

    prep(
        s,
        SHEET_COTIZACIONES,
        HC
    );

    prep(
        s,
        SHEET_COMERCIALES,
        HCOM
    );

    prep(
        s,
        SHEET_INTERMEDIARIOS,
        HINT
    );

    /* NUEVA HOJA DE PAGARÉS */

    prep(
        s,
        SHEET_PAGARES,
        HPAG
    );

}


/* =========================================================
   PREPARAR HOJA
   ========================================================= */

function prep(s, n, h) {

    let sh = s.getSheetByName(n);

    if (!sh) {
        sh = s.insertSheet(n);
    }

    if (sh.getLastRow() === 0) {

        sh
            .getRange(1, 1, 1, h.length)
            .setValues([h]);

    } else {

        const r = sh
            .getRange(1, 1, 1, h.length)
            .getValues()[0];

        if (r.every(x => x === '')) {

            sh
                .getRange(1, 1, 1, h.length)
                .setValues([h]);

        }

    }

    sh.setFrozenRows(1);
}


/* =========================================================
   GET
   ========================================================= */

function doGet(e) {

    try {

        const p = e.parameter || {};

        const a = p.action || 'ping';

        const r = dispatch(
            a,
            p
        );

        return respond(
            r,
            p.callback
        );

    } catch (err) {

        return respond(
            {
                success: false,
                error: err.message
            },
            (e &&
                e.parameter &&
                e.parameter.callback) || ''
        );

    }

}


/* =========================================================
   DISPATCH
   ========================================================= */

function dispatch(a, p) {

    /* SISTEMA */

    if (a === 'ping') {

        return {
            success: true,
            message: 'CUMTRACK conectado correctamente.'
        };

    }


    if (a === 'setup') {

        setup();

        return {
            success: true,
            message: 'Configuración completada.'
        };

    }


    /* COTIZACIONES */

    if (a === 'getQuotes') {
        return getQuotes();
    }

    if (a === 'getCommercials') {
        return getCommercials();
    }

    if (a === 'getIntermediaries') {
        return getIntermediaries();
    }

    if (a === 'saveQuote') {
        return saveQuote(p);
    }

    if (a === 'updateStatus') {
        return updateStatus(p);
    }


    /* PAGARÉS */

    if (a === 'getPagares') {
        return getPagares();
    }

    if (a === 'savePagare') {
        return savePagare(p);
    }

    if (a === 'updatePagareStatus') {
        return updatePagareStatus(p);
    }


    return {
        success: false,
        error: 'Acción no reconocida: ' + a
    };

}


/* =========================================================
   RESPUESTA JSON / JSONP
   ========================================================= */

function respond(data, cb) {

    const out = JSON.stringify(data);

    if (
        cb &&
        /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)
    ) {

        return ContentService
            .createTextOutput(
                cb + '(' + out + ');'
            )
            .setMimeType(
                ContentService.MimeType.JAVASCRIPT
            );

    }

    return ContentService
        .createTextOutput(out)
        .setMimeType(
            ContentService.MimeType.JSON
        );

}


/* =========================================================
   COTIZACIONES
   ========================================================= */

function getQuotes() {

    const sh =
        ss().getSheetByName(
            SHEET_COTIZACIONES
        );

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        return {
            success: true,
            data: []
        };

    }

    const v =
        sh
            .getRange(
                2,
                1,
                lr - 1,
                HC.length
            )
            .getValues();

    return {
        success: true,

        data: v.map(r => ({

            id: r[0],

            fecha: date(r[1]),

            tomador: r[2],

            nit: r[3],

            entidad: r[4],

            comercial: r[5],

            tipo: r[6],

            valor: r[7],

            prima: r[8],

            tasa: r[9],

            intermediario: r[10],

            estado: r[11],

            observaciones: r[12],

            fechaCreacion:
                dateTime(r[13]),

            ultimaActualizacion:
                dateTime(r[14])

        }))

    };

}


/* =========================================================
   COMERCIALES
   ========================================================= */

function getCommercials() {

    const sh =
        ss().getSheetByName(
            SHEET_COMERCIALES
        );

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        return {
            success: true,
            data: []
        };

    }

    return {

        success: true,

        data:
            sh
                .getRange(
                    2,
                    1,
                    lr - 1,
                    2
                )
                .getValues()

                .filter(
                    r => r[0] !== ''
                )

                .map(r => ({

                    name: r[0],

                    phone: r[1]

                }))

    };

}


/* =========================================================
   INTERMEDIARIOS
   ========================================================= */

function getIntermediaries() {

    const sh =
        ss().getSheetByName(
            SHEET_INTERMEDIARIOS
        );

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        return {
            success: true,
            data: []
        };

    }

    return {

        success: true,

        data:
            sh
                .getRange(
                    2,
                    1,
                    lr - 1,
                    1
                )
                .getValues()

                .filter(
                    r => r[0] !== ''
                )

                .map(
                    r => r[0]
                )

    };

}


/* =========================================================
   GUARDAR COTIZACIÓN
   ========================================================= */

function saveQuote(d) {

    const sh =
        ss().getSheetByName(
            SHEET_COTIZACIONES
        );

    if (!sh) {

        throw new Error(
            'Ejecuta setup() primero.'
        );

    }

    const now =
        new Date();

    const id =
        d.id ||
        Utilities.getUuid();

    sh.appendRow([

        id,

        d.fecha || '',

        d.tomador || '',

        d.nit || '',

        d.entidad || '',

        d.comercial || '',

        d.tipo || '',

        num(d.valor),

        num(d.prima),

        d.tasa || '',

        d.intermediario || '',

        d.estado || 'Cotizada',

        d.observaciones || '',

        now,

        now

    ]);

    return {

        success: true,

        message:
            'Cotización guardada correctamente.',

        data: {
            id: id
        }

    };

}


/* =========================================================
   ACTUALIZAR ESTADO COTIZACIÓN
   ========================================================= */

function updateStatus(d) {

    const sh =
        ss().getSheetByName(
            SHEET_COTIZACIONES
        );

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        throw new Error(
            'No existen cotizaciones.'
        );

    }

    const ids =
        sh
            .getRange(
                2,
                1,
                lr - 1,
                1
            )
            .getValues();

    let row = 0;

    for (
        let i = 0;
        i < ids.length;
        i++
    ) {

        if (
            String(ids[i][0]) ===
            String(d.id)
        ) {

            row = i + 2;

            break;

        }

    }

    if (!row) {

        throw new Error(
            'No se encontró la cotización.'
        );

    }

    sh
        .getRange(row, 12)
        .setValue(
            d.estado || 'Cotizada'
        );

    sh
        .getRange(row, 15)
        .setValue(
            new Date()
        );

    return {

        success: true,

        message:
            'Estado actualizado correctamente.',

        id: d.id,

        estado: d.estado

    };

}


/* =========================================================
   PAGARÉS
   ========================================================= */

function getPagares() {

    const sh =
        ss().getSheetByName(
            SHEET_PAGARES
        );

    if (!sh) {

        throw new Error(
            'La hoja Pagares no existe. Ejecuta setup() primero.'
        );

    }

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        return {
            success: true,
            data: []
        };

    }

    const values =
        sh
            .getRange(
                2,
                1,
                lr - 1,
                HPAG.length
            )
            .getValues();

    return {

        success: true,

        data:
            values.map(r => ({

                id: r[0],

                fechaEmision:
                    date(r[1]),

                poliza:
                    r[2],

                tomador:
                    r[3],

                nit:
                    r[4],

                tipo:
                    r[5],

                estado:
                    r[6],

                fecha:
                    date(r[7]),

                comercial:
                    r[8],

                fechaCreacion:
                    dateTime(r[9]),

                ultimaActualizacion:
                    dateTime(r[10])

            }))

    };

}


/* =========================================================
   GUARDAR PAGARÉ
   ========================================================= */

function savePagare(d) {

    const sh =
        ss().getSheetByName(
            SHEET_PAGARES
        );

    if (!sh) {

        throw new Error(
            'Ejecuta setup() primero.'
        );

    }

    const now =
        new Date();

    const id =
        d.id ||
        Utilities.getUuid();

    sh.appendRow([

        id,

        d.fechaEmision || '',

        d.poliza || '',

        d.tomador || '',

        d.nit || '',

        d.tipo || 'Abierto',

        d.estado || 'Pendiente',

        d.fecha || '',

        d.comercial || '',

        now,

        now

    ]);

    return {

        success: true,

        message:
            'Pagaré guardado correctamente.',

        data: {
            id: id
        }

    };

}


/* =========================================================
   ACTUALIZAR ESTADO PAGARÉ
   ========================================================= */

function updatePagareStatus(d) {

    const sh =
        ss().getSheetByName(
            SHEET_PAGARES
        );

    if (!sh) {

        throw new Error(
            'La hoja Pagares no existe.'
        );

    }

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        throw new Error(
            'No existen pagarés.'
        );

    }

    const ids =
        sh
            .getRange(
                2,
                1,
                lr - 1,
                1
            )
            .getValues();

    let row = 0;

    for (
        let i = 0;
        i < ids.length;
        i++
    ) {

        if (
            String(ids[i][0]) ===
            String(d.id)
        ) {

            row = i + 2;

            break;

        }

    }

    if (!row) {

        throw new Error(
            'No se encontró el pagaré.'
        );

    }

    sh
        .getRange(row, 7)
        .setValue(
            d.estado || 'Pendiente'
        );

    sh
        .getRange(row, 11)
        .setValue(
            new Date()
        );

    return {

        success: true,

        message:
            'Estado del pagaré actualizado correctamente.',

        id: d.id,

        estado: d.estado

    };

}


/* =========================================================
   FUNCIONES AUXILIARES
   ========================================================= */

function num(v) {

    if (
        v === null ||
        v === undefined ||
        v === ''
    ) {

        return '';

    }

    if (
        typeof v === 'number'
    ) {

        return v;

    }

    const n =
        Number(
            String(v)
                .replace(/\$/g, '')
                .replace(/\s/g, '')
                .replace(/\./g, '')
                .replace(',', '.')
        );

    return isNaN(n)
        ? ''
        : n;

}


function date(v) {

    if (!v) return '';

    return Object.prototype.toString.call(v) ===
        '[object Date]'

        ? Utilities.formatDate(
            v,
            Session.getScriptTimeZone(),
            'yyyy-MM-dd'
        )

        : String(v);

}


function dateTime(v) {

    if (!v) return '';

    return Object.prototype.toString.call(v) ===
        '[object Date]'

        ? Utilities.formatDate(
            v,
            Session.getScriptTimeZone(),
            'yyyy-MM-dd HH:mm:ss'
        )

        : String(v);

}