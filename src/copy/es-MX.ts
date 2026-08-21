/**
 * All user-facing strings live here.
 *
 * The operators using this product are Mexican, so the interface is es-MX while
 * code identifiers stay English. Centralising copy in one file keeps that an
 * assumption we can reverse cheaply.
 */

export const copy = {
  app: {
    name: 'FIRMA23 Ops',
    sliceBanner: 'Rebanada 1 · núcleo financiero',
    sliceNote:
      'Datos sintéticos. Sin Supabase, sin despliegue. Esta pantalla existe para revisar el contrato de dinero y el Riel de Ingresos.',
  },
  money: {
    projected: 'Proyección',
    projectedLong: 'Proyección no aprobada',
    approved: 'Aprobado',
    paid: 'Pagado',
    unpaid: 'Por pagar',
    base: 'Base distribuible',
    cashReceived: 'Efectivo recibido',
    excludedFromBase: 'Fuera de la base distribuible',
    notEarnedYet: 'Aún no es dinero ganado ni por pagar',
    approvedBy: 'Aprobado por',
    rulePrefix: 'Regla',
    unassigned: 'Sin asignar',
    ofSegment: 'del segmento',
  },
  rail: {
    label: 'Riel de Ingresos',
    projectionAria: 'Riel de ingresos proyectado, no aprobado',
    settlementAria: 'Riel de ingresos liquidado y aprobado',
    incompleteAssignment: 'Asignación incompleta',
  },
  states: {
    loading: 'Cargando…',
    empty: 'Sin registros todavía',
    error: 'No se pudo cargar la información',
    permissionDenied: 'Necesitas permisos de fundador para ver este detalle',
  },
  opportunity: {
    statusLabels: {
      draft: 'Borrador',
      assigned: 'Asignada',
      in_delivery: 'En producción',
      delivered: 'Entregada',
      settled_approved: 'Liquidada',
      paid: 'Pagada',
      cancelled: 'Cancelada',
    },
  },
} as const;
