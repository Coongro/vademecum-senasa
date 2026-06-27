/**
 * Tipos parciales del DTO público de SENASA (solo los campos que consumimos).
 *
 * La API no es oficial (backend de la SPA pública) y no tiene contrato; estos
 * tipos reflejan la forma observada y son defensivos (casi todo opcional). El
 * mapper tolera ausencias. Campos en español porque así los expone la fuente.
 */

/** Item del listado paginado (publicSearchProductoFarmacoDTO). */
export interface SenasaListItem {
  /** Id numérico estable del producto en SENASA — clave para pedir el detalle. */
  id: number;
  numeroInscripcion?: string | null;
  nombreComercial?: string | null;
  nombreFirma?: string | null;
}

/** Respuesta paginada HATEOAS del listado. */
export interface SenasaListResponse {
  _embedded?: {
    productosFarmacos?: SenasaListItem[];
  };
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

interface SenasaNamed {
  descripcion?: string | null;
  nombre?: string | null;
}

/** Firma (laboratorio titular). */
export interface SenasaFirma {
  nombre?: string | null;
  cuit?: string | null;
}

/** Un componente del producto (principio activo, excipiente, etc.). */
export interface SenasaComponentePorProducto {
  componente?: {
    nombre?: string | null;
    tipoComponente?: SenasaNamed | null;
  } | null;
  /** Cantidad/concentración como la expone la fuente (suele ser string). */
  cantidadCompleja?: string | number | null;
}

/** Detalle (publicSearchProducto, projection productoFarmacoDetallePublicoProjection). */
export interface SenasaDetail {
  id?: number;
  numeroInscripcion?: string | null;
  /** Texto de indicaciones / acción terapéutica. A veces es "NO APLICA". */
  indicacionesYVias?: string | null;
  /**
   * Observaciones del producto. En muchos registros (varios biológicos) la
   * descripción real vive acá cuando `indicacionesYVias` es "NO APLICA".
   */
  observaciones?: string | null;
  estadoProducto?: SenasaNamed | null;
  tipoProducto?: SenasaNamed | null;
  tipoPresentacion?: SenasaNamed | null;
  productosFirmas?: Array<{
    nombreComercial?: string | null;
    firma?: SenasaFirma | null;
  }> | null;
  componentesPorProducto?: SenasaComponentePorProducto[] | null;
  productoEspecieCategoria?: Array<{
    especie?: SenasaNamed | null;
  }> | null;
  productosFarmacoViaPorProducto?: Array<{
    farmacoVia?: { viaAdministracion?: string | null } | null;
  }> | null;
  envases?: Array<{
    capacidadUsada?: number | null;
  }> | null;
}
