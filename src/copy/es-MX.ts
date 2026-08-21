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
    retry: 'Reintentar',
  },
  nav: {
    home: 'Inicio',
    opportunities: 'Oportunidades',
    network: 'Red',
    leaderboard: 'Ranking',
    admin: 'Admin',
    soon: 'Pronto',
    primary: 'Navegación principal',
    mobile: 'Navegación inferior',
  },
  home: {
    greeting: 'Tu operación',
    approved: 'Aprobado',
    pendingPayout: 'Por cobrar',
    activeWork: 'Trabajo activo',
    projectedAside: 'Proyección en curso',
    primaryAction: 'Subir evidencia',
    assignments: 'Mis asignaciones',
    nextActions: 'Siguientes pasos',
    actionEvidence: 'Sube evidencia',
    actionSettle: 'Revisa liquidación',
    noAssignments: 'Todavía no tienes trabajo asignado',
    noAssignmentsDetail: 'Cuando un fundador te asigne una oportunidad, aparecerá aquí.',
    noActions: 'Nada pendiente por ahora',
    unitsActive: 'oportunidades',
  },
  viewer: {
    label: 'Vista de prototipo',
    founder: 'Fundador',
    member: 'Operador',
    warning: 'Selector de prototipo. No otorga permisos: la autorización real llega con RLS en M2.',
  },
  board: {
    title: 'Oportunidades',
    subtitle: 'Trabajo creado por fundadores, con su riel de ingresos.',
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
