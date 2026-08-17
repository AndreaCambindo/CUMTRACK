const SPREADSHEET_ID = '110bW9yn_2CkyNRfAqF2nILIlKxp-s17hOMMkbaKGP-g';

const SHEET_COTIZACIONES = 'Cotizaciones';
const SHEET_COMERCIALES = 'Comerciales';
const SHEET_INTERMEDIARIOS = 'Intermediarios';
const SHEET_PAGARES = 'Pagares';
const SHEET_PRESUPUESTOS = 'Presupuestos';


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
    'Valor contrato',
    'Prima CUM',
    'Prima RCE',
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

const HPRE = [
    'Mes',
    'Presupuesto',
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

    /* NUEVA HOJA DE PRESUPUESTOS */

    prep(
        s,
        SHEET_PRESUPUESTOS,
        HPRE
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

    /*
     * La columna "Mes" de Presupuestos (AAAA-MM) debe
     * quedar como texto plano, o Google Sheets la
     * convierte automáticamente en una fecha y deja
     * de coincidir con lo que envía la aplicación.
     */

    if (n === SHEET_PRESUPUESTOS) {

        sh
            .getRange('A:A')
            .setNumberFormat('@');
    }
}


/* =========================================================
   MIGRACIÓN: AGREGAR COLUMNA "PRIMA RCE"

   Ejecuta esta función UNA SOLA VEZ (desde el editor de
   Apps Script, seleccionándola en el menú de funciones y
   dándole a Ejecutar) si tu hoja "Cotizaciones" ya existía
   antes de este cambio. Inserta la columna "Prima RCE" en
   la posición correcta y renombra los encabezados antiguos
   ("Valor asegurado" → "Valor contrato",
   "Prima sin IVA" → "Prima CUM") sin perder ningún dato.
   ========================================================= */

function migrateAddPrimaRce() {

    const sh =
        ss().getSheetByName(
            SHEET_COTIZACIONES
        );

    if (!sh) {

        throw new Error(
            'No existe la hoja Cotizaciones. Ejecuta setup() primero.'
        );

    }

    const headers =
        sh
            .getRange(1, 1, 1, sh.getLastColumn())
            .getValues()[0];


    if (headers.indexOf('Prima RCE') !== -1) {

        return {

            success: true,

            message:
                'La columna "Prima RCE" ya existe. No se hizo ningún cambio.'

        };

    }


    let insertBeforeIndex =
        headers.indexOf('Tasa CUM - RCE');

    if (insertBeforeIndex === -1) {

        throw new Error(
            'No se encontró la columna "Tasa CUM - RCE" para ubicar la nueva columna. Verifica los encabezados de la hoja Cotizaciones.'
        );

    }

    const insertColumn =
        insertBeforeIndex + 1;

    sh.insertColumnBefore(
        insertColumn
    );

    sh
        .getRange(1, insertColumn)
        .setValue('Prima RCE');


    /*
     * Renombramos los encabezados antiguos si aún
     * conservan su nombre original.
     */

    const updatedHeaders =
        sh
            .getRange(1, 1, 1, sh.getLastColumn())
            .getValues()[0];

    for (
        let i = 0;
        i < updatedHeaders.length;
        i++
    ) {

        if (updatedHeaders[i] === 'Valor asegurado') {

            sh.getRange(1, i + 1).setValue('Valor contrato');
        }

        if (updatedHeaders[i] === 'Prima sin IVA') {

            sh.getRange(1, i + 1).setValue('Prima CUM');
        }

    }


    return {

        success: true,

        message:
            'Migración completada: se agregó la columna "Prima RCE" y se actualizaron los encabezados.'

    };

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


    if (a === 'migrateAddPrimaRce') {

        return migrateAddPrimaRce();

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

    if (a === 'addCommercial') {
        return addCommercial(p);
    }

    if (a === 'removeCommercial') {
        return removeCommercial(p);
    }

    if (a === 'addIntermediary') {
        return addIntermediary(p);
    }

    if (a === 'removeIntermediary') {
        return removeIntermediary(p);
    }

    if (a === 'saveQuote') {
        return saveQuote(p);
    }

    if (a === 'updateStatus') {
        return updateStatus(p);
    }

    if (a === 'updateQuote') {
        return updateQuote(p);
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

    if (a === 'updatePagare') {
        return updatePagare(p);
    }


    /* PRESUPUESTOS */

    if (a === 'getBudgets') {
        return getBudgets();
    }

    if (a === 'saveBudget') {
        return saveBudget(p);
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

            primaCum: r[8],

            primaRce: r[9],

            tasa: r[10],

            intermediario: r[11],

            estado: r[12],

            observaciones: r[13],

            fechaCreacion:
                dateTime(r[14]),

            ultimaActualizacion:
                dateTime(r[15])

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
   AGREGAR COMERCIAL
   ========================================================= */

function addCommercial(d) {

    const sh =
        ss().getSheetByName(
            SHEET_COMERCIALES
        );

    if (!sh) {

        throw new Error(
            'Ejecuta setup() primero.'
        );

    }

    const name =
        (d.name || '').trim();

    if (!name) {

        throw new Error(
            'El nombre del comercial es obligatorio.'
        );

    }

    const phone =
        (d.phone || '').trim();

    const lr =
        sh.getLastRow();

    if (lr >= 2) {

        const names =
            sh
                .getRange(2, 1, lr - 1, 1)
                .getValues();

        for (
            let i = 0;
            i < names.length;
            i++
        ) {

            if (
                String(names[i][0])
                    .trim()
                    .toLowerCase() ===
                name.toLowerCase()
            ) {

                throw new Error(
                    'Ya existe un comercial con ese nombre.'
                );

            }

        }

    }

    sh.appendRow([
        name,
        phone
    ]);

    return {

        success: true,

        message:
            'Comercial agregado correctamente.'

    };

}


/* =========================================================
   ELIMINAR COMERCIAL
   ========================================================= */

function removeCommercial(d) {

    const sh =
        ss().getSheetByName(
            SHEET_COMERCIALES
        );

    if (!sh) {

        throw new Error(
            'La hoja Comerciales no existe.'
        );

    }

    const name =
        d.name || '';

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        throw new Error(
            'No existen comerciales.'
        );

    }

    const names =
        sh
            .getRange(2, 1, lr - 1, 1)
            .getValues();

    let row = 0;

    for (
        let i = 0;
        i < names.length;
        i++
    ) {

        if (
            String(names[i][0]) ===
            String(name)
        ) {

            row = i + 2;

            break;

        }

    }

    if (!row) {

        throw new Error(
            'No se encontró el comercial.'
        );

    }

    sh.deleteRow(row);

    return {

        success: true,

        message:
            'Comercial eliminado correctamente.'

    };

}


/* =========================================================
   AGREGAR INTERMEDIARIO
   ========================================================= */

function addIntermediary(d) {

    const sh =
        ss().getSheetByName(
            SHEET_INTERMEDIARIOS
        );

    if (!sh) {

        throw new Error(
            'Ejecuta setup() primero.'
        );

    }

    const name =
        (d.name || '').trim();

    if (!name) {

        throw new Error(
            'El nombre del intermediario es obligatorio.'
        );

    }

    const lr =
        sh.getLastRow();

    if (lr >= 2) {

        const names =
            sh
                .getRange(2, 1, lr - 1, 1)
                .getValues();

        for (
            let i = 0;
            i < names.length;
            i++
        ) {

            if (
                String(names[i][0])
                    .trim()
                    .toLowerCase() ===
                name.toLowerCase()
            ) {

                throw new Error(
                    'Ya existe ese intermediario.'
                );

            }

        }

    }

    sh.appendRow([
        name
    ]);

    return {

        success: true,

        message:
            'Intermediario agregado correctamente.'

    };

}


/* =========================================================
   ELIMINAR INTERMEDIARIO
   ========================================================= */

function removeIntermediary(d) {

    const sh =
        ss().getSheetByName(
            SHEET_INTERMEDIARIOS
        );

    if (!sh) {

        throw new Error(
            'La hoja Intermediarios no existe.'
        );

    }

    const name =
        d.name || '';

    const lr =
        sh.getLastRow();

    if (lr < 2) {

        throw new Error(
            'No existen intermediarios.'
        );

    }

    const names =
        sh
            .getRange(2, 1, lr - 1, 1)
            .getValues();

    let row = 0;

    for (
        let i = 0;
        i < names.length;
        i++
    ) {

        if (
            String(names[i][0]) ===
            String(name)
        ) {

            row = i + 2;

            break;

        }

    }

    if (!row) {

        throw new Error(
            'No se encontró el intermediario.'
        );

    }

    sh.deleteRow(row);

    return {

        success: true,

        message:
            'Intermediario eliminado correctamente.'

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

        num(d.primaCum),

        num(d.primaRce),

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
        .getRange(row, 13)
        .setValue(
            d.estado || 'Cotizada'
        );

    sh
        .getRange(row, 16)
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
   ACTUALIZAR COTIZACIÓN COMPLETA
   ========================================================= */

function updateQuote(d) {

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
        .getRange(row, 2, 1, 13)
        .setValues([[

            d.fecha || '',

            d.tomador || '',

            d.nit || '',

            d.entidad || '',

            d.comercial || '',

            d.tipo || '',

            num(d.valor),

            num(d.primaCum),

            num(d.primaRce),

            d.tasa || '',

            d.intermediario || '',

            d.estado || 'Cotizada',

            d.observaciones || ''

        ]]);

    sh
        .getRange(row, 16)
        .setValue(
            new Date()
        );

    return {

        success: true,

        message:
            'Cotización actualizada correctamente.',

        id: d.id

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
   ACTUALIZAR PAGARÉ COMPLETO
   ========================================================= */

function updatePagare(d) {

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
            .getRange(2, 1, lr - 1, 1)
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
        .getRange(row, 2, 1, 8)
        .setValues([[

            d.fechaEmision || '',

            d.poliza || '',

            d.tomador || '',

            d.nit || '',

            d.tipo || 'Abierto',

            d.estado || 'Pendiente',

            d.fecha || '',

            d.comercial || ''

        ]]);

    sh
        .getRange(row, 11)
        .setValue(
            new Date()
        );

    return {

        success: true,

        message:
            'Pagaré actualizado correctamente.',

        id: d.id

    };

}


/* =========================================================
   PRESUPUESTOS
   ========================================================= */

function getBudgets() {

    const sh =
        ss().getSheetByName(
            SHEET_PRESUPUESTOS
        );

    if (!sh) {

        return {
            success: true,
            data: []
        };

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
                HPRE.length
            )
            .getValues();

    return {

        success: true,

        data:
            values

                .filter(
                    r => r[0] !== ''
                )

                .map(r => ({

                    mes: monthStr(r[0]),

                    presupuesto: r[1],

                    fechaCreacion:
                        dateTime(r[2]),

                    ultimaActualizacion:
                        dateTime(r[3])

                }))

    };

}


/* =========================================================
   GUARDAR / ACTUALIZAR PRESUPUESTO (por mes, upsert)
   ========================================================= */

function saveBudget(d) {

    const s = ss();

    let sh =
        s.getSheetByName(
            SHEET_PRESUPUESTOS
        );

    if (!sh) {

        prep(
            s,
            SHEET_PRESUPUESTOS,
            HPRE
        );

        sh =
            s.getSheetByName(
                SHEET_PRESUPUESTOS
            );

    }

    /*
     * Aseguramos formato de texto por si la hoja
     * ya existía de antes de este ajuste.
     */

    sh
        .getRange('A:A')
        .setNumberFormat('@');

    const mes =
        d.mes || '';

    if (!mes) {

        throw new Error(
            'Debes indicar el mes (AAAA-MM).'
        );

    }

    const now =
        new Date();

    const lr =
        sh.getLastRow();

    let row = 0;

    if (lr >= 2) {

        const meses =
            sh
                .getRange(
                    2,
                    1,
                    lr - 1,
                    1
                )
                .getValues();

        for (
            let i = 0;
            i < meses.length;
            i++
        ) {

            if (
                monthStr(meses[i][0]) ===
                String(mes)
            ) {

                row = i + 2;

                break;

            }

        }

    }

    if (row) {

        sh
            .getRange(row, 2)
            .setValue(
                num(d.presupuesto)
            );

        sh
            .getRange(row, 4)
            .setValue(now);

    } else {

        sh.appendRow([

            mes,

            num(d.presupuesto),

            now,

            now

        ]);

    }

    return {

        success: true,

        message:
            'Presupuesto guardado correctamente.',

        data: {
            mes: mes
        }

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


/*
 * Normaliza el "Mes" de Presupuestos a formato AAAA-MM.
 * Si Sheets llegó a guardarlo como fecha (bug de
 * autodetección), lo reconstruye igual como texto.
 */

function monthStr(v) {

    if (!v) return '';

    return Object.prototype.toString.call(v) ===
        '[object Date]'

        ? Utilities.formatDate(
            v,
            Session.getScriptTimeZone(),
            'yyyy-MM'
        )

        : String(v);

}