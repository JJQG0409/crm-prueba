import { almacen, sembrarDatosIniciales } from './almacen.js';
import {
  ETAPAS,
  crearCliente,
  crearOportunidad,
  normalizarCliente,
  normalizarOportunidad,
  validarCliente,
  validarOportunidad,
  generarId
} from './modelos.js';

const estado = {
  clienteSeleccionadoId: null,
  clienteEnEdicionId: null,
};

const $ = (selector) => document.querySelector(selector);

const formatoMoneda = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const formatoFecha = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' });

function escapar(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ---------- Clientes ----------

function renderizarClientes() {
  const clientes = almacen.listarClientes();
  const oportunidades = almacen.listarOportunidades();
  const lista = $('#lista-clientes');
  $('#contador-clientes').textContent = `${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`;

  if (clientes.length === 0) {
    lista.innerHTML = '<li class="vacio">Aún no hay clientes. Registra el primero con el formulario.</li>';
    return;
  }

  lista.innerHTML = clientes
    .map((cliente) => {
      const total = oportunidades.filter((o) => o.clienteId === cliente.id).length;
      const activo = cliente.id === estado.clienteSeleccionadoId ? 'activo' : '';
      return `
        <li>
          <button type="button" class="cliente ${activo}" data-id="${cliente.id}">
            <span class="cliente-nombre">${escapar(cliente.nombre)}</span>
            <span class="cliente-contacto">${escapar(cliente.contacto)}</span>
            <span class="cliente-meta">${total} oportunidad${total === 1 ? '' : 'es'}</span>
          </button>
        </li>`;
    })
    .join('');
}

function manejarFormularioCliente(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const datos = Object.fromEntries(new FormData(formulario));
  const cliente = estado.clienteEnEdicionId
    ? normalizarCliente({ ...almacen.listarClientes().find((c) => c.id === estado.clienteEnEdicionId), ...datos })
    : crearCliente(datos);

  const errores = validarCliente(cliente);
  if (errores.length > 0) {
    mostrarErrores(formulario, errores);
    return;
  }

  almacen.guardarCliente(cliente);
  estado.clienteSeleccionadoId = cliente.id;
  estado.clienteEnEdicionId = null;
  formulario.reset();
  mostrarErrores(formulario, []);
  $('#titulo-form-cliente').textContent = 'Nuevo cliente';
  $('#cancelar-edicion').hidden = true;
  renderizar();
}

function iniciarEdicionCliente(cliente) {
  estado.clienteEnEdicionId = cliente.id;
  const formulario = $('#form-cliente');
  formulario.elements.nombre.value = cliente.nombre;
  formulario.elements.contacto.value = cliente.contacto;
  $('#titulo-form-cliente').textContent = 'Editar cliente';
  $('#cancelar-edicion').hidden = false;
  formulario.elements.nombre.focus();
}

function cancelarEdicionCliente() {
  estado.clienteEnEdicionId = null;
  const formulario = $('#form-cliente');
  formulario.reset();
  mostrarErrores(formulario, []);
  $('#titulo-form-cliente').textContent = 'Nuevo cliente';
  $('#cancelar-edicion').hidden = true;
}

// ---------- Detalle y oportunidades ----------

function renderizarDetalle() {
  const panel = $('#detalle');
  const cliente = almacen.listarClientes().find((c) => c.id === estado.clienteSeleccionadoId);

  if (!cliente) {
    estado.clienteSeleccionadoId = null;
    panel.innerHTML = '<p class="vacio">Selecciona un cliente para ver sus oportunidades.</p>';
    return;
  }

  const oportunidades = almacen
    .listarOportunidades()
    .filter((o) => o.clienteId === cliente.id)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  const totalAbierto = oportunidades
    .filter((o) => !['Ganada', 'Perdida'].includes(o.etapa))
    .reduce((suma, o) => suma + o.monto, 0);

  const opcionesEtapa = (seleccionada) =>
    ETAPAS.map((e) => `<option value="${e}" ${e === seleccionada ? 'selected' : ''}>${e}</option>`).join('');

  const filas = oportunidades.length
    ? oportunidades
        .map(
          (o) => `
          <tr data-id="${o.id}">
            <td>${escapar(o.titulo)}</td>
            <td class="numero">${formatoMoneda.format(o.monto)}</td>
            <td><select class="cambiar-etapa" aria-label="Etapa">${opcionesEtapa(o.etapa)}</select></td>
            <td>${formatoFecha.format(new Date(o.creadoEn))}</td>
            <td><button type="button" class="eliminar-oportunidad enlace">Eliminar</button></td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="vacio">Este cliente aún no tiene oportunidades.</td></tr>';

  panel.innerHTML = `
    <header class="detalle-encabezado">
      <div>
        <h2>${escapar(cliente.nombre)}</h2>
        <p class="detalle-contacto">${escapar(cliente.contacto)} · Cliente desde ${formatoFecha.format(new Date(cliente.creadoEn))}</p>
      </div>
      <div class="acciones">
        <button type="button" id="editar-cliente" class="secundario">Editar</button>
        <button type="button" id="eliminar-cliente" class="peligro">Eliminar cliente</button>
      </div>
    </header>

    <p class="resumen">Pipeline abierto: <strong>${formatoMoneda.format(totalAbierto)}</strong></p>

    <table class="oportunidades">
      <thead>
        <tr><th>Oportunidad</th><th class="numero">Monto</th><th>Etapa</th><th>Creada</th><th></th></tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <form id="form-oportunidad" class="formulario en-linea" novalidate>
      <h3>Nueva oportunidad</h3>
      <label>Título <input name="titulo" maxlength="80" required></label>
      <label>Monto (GTQ) <input name="monto" type="number" min="0" step="0.01" value="0"></label>
      <label>Etapa <select name="etapa">${opcionesEtapa(ETAPAS[0])}</select></label>
      <button type="submit">Agregar</button>
      <ul class="errores" hidden></ul>
    </form>`;

  $('#editar-cliente').addEventListener('click', () => iniciarEdicionCliente(cliente));
  $('#eliminar-cliente').addEventListener('click', () => {
    if (confirm(`¿Eliminar a "${cliente.nombre}" y todas sus oportunidades?`)) {
      almacen.eliminarCliente(cliente.id);
      estado.clienteSeleccionadoId = null;
      renderizar();
    }
  });
  $('#form-oportunidad').addEventListener('submit', manejarFormularioOportunidad);
}

function manejarFormularioOportunidad(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const datos = Object.fromEntries(new FormData(formulario));
  const oportunidad = crearOportunidad({ ...datos, clienteId: estado.clienteSeleccionadoId });

  const errores = validarOportunidad(oportunidad);
  if (errores.length > 0) {
    mostrarErrores(formulario, errores);
    return;
  }

  almacen.guardarOportunidad(oportunidad);
  renderizar();
}

function manejarCambioEtapa(evento) {
  const select = evento.target.closest('.cambiar-etapa');
  if (!select) return;
  const id = select.closest('tr').dataset.id;
  const oportunidad = almacen.listarOportunidades().find((o) => o.id === id);
  if (!oportunidad) return;
  almacen.guardarOportunidad(normalizarOportunidad({ ...oportunidad, etapa: select.value }));
  renderizar();
}

function manejarEliminarOportunidad(evento) {
  const boton = evento.target.closest('.eliminar-oportunidad');
  if (!boton) return;
  almacen.eliminarOportunidad(boton.closest('tr').dataset.id);
  renderizar();
}

// ---------- Utilidades ----------

function mostrarErrores(formulario, errores) {
  const lista = formulario.querySelector('.errores');
  lista.hidden = errores.length === 0;
  lista.innerHTML = errores.map((e) => `<li>${escapar(e)}</li>`).join('');
}

function renderizar() {
  renderizarClientes();
  renderizarDetalle();
}

function iniciar() {
  sembrarDatosIniciales();

  $('#form-cliente').addEventListener('submit', manejarFormularioCliente);
  $('#cancelar-edicion').addEventListener('click', cancelarEdicionCliente);

  $('#lista-clientes').addEventListener('click', (evento) => {
    const boton = evento.target.closest('.cliente');
    if (!boton) return;
    estado.clienteSeleccionadoId = boton.dataset.id;
    renderizar();
  });

  $('#detalle').addEventListener('change', manejarCambioEtapa);
  $('#detalle').addEventListener('click', manejarEliminarOportunidad);

  $('#reiniciar-datos').addEventListener('click', () => {
    if (confirm('Esto borra todos los datos guardados en este navegador y vuelve a cargar los de ejemplo. ¿Continuar?')) {
      almacen.reiniciar();
      estado.clienteSeleccionadoId = null;
      cancelarEdicionCliente();
      sembrarDatosIniciales();
      renderizar();
    }
  });

  //CONECTAR CON LA FUNCION PARA EXPORTAR E IMPORTAR
  $('#exportar-datos').addEventListener('click', exportarDatos);
  $('#importar-datos').addEventListener('click', () => $('#input-importar').click());
  $('#input-importar').addEventListener('change', importarArchivo);

  renderizar();
}

function clienteImportado(bruto, indice){

  const cliente = normalizarCliente({
    id: bruto?.id || generarId(),
    nombre: bruto?.nombre,
    contacto: bruto?.contacto,
    creadoEn: bruto?.creadoEn || new Date().toISOString(),
  });
  const errores = validarCliente(cliente).map((e)=> `Cliente #${indice + 1}: ${e}`)
  return {cliente, errores}
}

function oportunidadImportada(bruto, indice, idsClientesValidos) {
  const oportunidad = normalizarOportunidad({
    id: bruto?.id || generarId(),
    clienteId: bruto?.clienteId,
    titulo: bruto?.titulo,
    monto: bruto?.monto,
    etapa: bruto?.etapa,
    creadoEn: bruto?.creadoEn || new Date().toISOString(),
  });

  const errores = validarOportunidad(oportunidad).map((e) => `Oportunidad #${indice + 1}: ${e}`);

  if (oportunidad.clienteId && !idsClientesValidos.has(oportunidad.clienteId)) {
    errores.push(`Oportunidad #${indice + 1}: hace referencia a un cliente que no existe en el archivo.`);
  }

  return { oportunidad, errores };
}

function exportarDatos() {
  const datos = almacen.exportar();
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const fecha = new Date().toISOString().slice(0, 10);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `crm-datos-${fecha}.json`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

async function importarArchivo(evento) {
  const archivo = evento.target.files[0];
  evento.target.value = '';
  if (!archivo) return;

  let contenido;
  try {
    contenido = JSON.parse(await archivo.text());
  } catch {
    alert('El archivo no es un JSON válido.');
    return;
  }

  if (!contenido || !Array.isArray(contenido.clientes) || !Array.isArray(contenido.oportunidades)) {
    alert('El archivo no tiene el formato esperado. Debe contener las listas "clientes" y "oportunidades".');
    return;
  }

  const erroresGenerales = [];

  const clientesValidados = [];
  contenido.clientes.forEach((bruto, indice) => {
    const { cliente, errores } = clienteImportado(bruto, indice);
    if (errores.length > 0) erroresGenerales.push(...errores);
    else clientesValidados.push(cliente);
  });

  const idsClientesValidos = new Set(clientesValidados.map((c) => c.id));
  const oportunidadesValidadas = [];
  contenido.oportunidades.forEach((bruto, indice) => {
    const { oportunidad, errores } = oportunidadImportada(bruto, indice, idsClientesValidos);
    if (errores.length > 0) erroresGenerales.push(...errores);
    else oportunidadesValidadas.push(oportunidad);
  });

  if (clientesValidados.length === 0 && oportunidadesValidadas.length === 0) {
    alert('No se encontró ningún cliente u oportunidad válida en el archivo. No se importó nada.');
    return;
  }

  const clientesActuales = almacen.listarClientes().length;
  const oportunidadesActuales = almacen.listarOportunidades().length;

  let mensaje =
    `Esto reemplazara los datos guardados en este navegador ` +
    `(${clientesActuales} cliente(s), ${oportunidadesActuales} oportunidad(es)) ` +
    `con ${clientesValidados.length} cliente(s) y ${oportunidadesValidadas.length} oportunidad del archivo.`;

  if (erroresGenerales.length > 0) {
    const primeros = erroresGenerales.slice(0, 5);
    mensaje += `\n\nSe omitirán ${erroresGenerales.length} registro(s) inválido(s):\n- ${primeros.join('\n- ')}`;
    if (erroresGenerales.length > primeros.length) {
      mensaje += `\n… y ${erroresGenerales.length - primeros.length} más.`;
    }
  }

  mensaje += '\n\n¿Deseas continuar? Esta acción no se puede deshacer.';

  if (!confirm(mensaje)) return;

  almacen.reemplazar({ clientes: clientesValidados, oportunidades: oportunidadesValidadas });
  estado.clienteSeleccionadoId = null;
  cancelarEdicionCliente();
  renderizar();
  alert('Importación completada.');
}

iniciar();
