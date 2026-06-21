/**
 * Mapeo DTO de SENASA → modelo común de @coongro/vademecum.
 *
 * Único lugar que conoce la forma del DTO de SENASA. Defensivo: la fuente no
 * tiene contrato, así que todo campo puede faltar. El id del modelo común
 * (`sourceId`) es el id numérico estable de SENASA (clave para pedir el
 * detalle); `registrationNumber` es el numeroInscripcion visible al usuario.
 */

import type {
  CatalogComposition,
  CatalogProductDetail,
  CatalogProductStatus,
  CatalogProductSummary,
} from '@coongro/vademecum';

import type {
  SenasaComponentePorProducto,
  SenasaDetail,
  SenasaListItem,
} from '../types/senasa-dto.js';

export const SENASA_SOURCE_ID = 'senasa';
/** País del padrón SENASA (ISO 3166-1 alpha-2). SENASA es el organismo AR. */
export const SENASA_COUNTRY = 'AR';

/** Id del provider que se estampa en cada producto mapeado. */
function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const v of values) {
    const t = v?.trim();
    if (t) seen.add(t);
  }
  return [...seen];
}

/** Normaliza el estado textual de SENASA al enum del modelo común. */
function mapStatus(descripcion?: string | null): CatalogProductStatus {
  const d = descripcion?.toUpperCase().trim();
  if (!d) return 'unknown';
  if (d.includes('ACTIVO') || d.includes('VIGENTE')) return 'active';
  if (d.includes('BAJA') || d.includes('SUSPEND') || d.includes('CANCEL')) return 'discontinued';
  return 'unknown';
}

/**
 * Parsea la cantidad textual de SENASA (cantidadCompleja) a número + unidad,
 * best-effort. Conserva siempre el texto crudo en rawStrength.
 */
function parseStrength(raw: string): Pick<CatalogComposition, 'amount' | 'unit'> {
  const match = raw.match(/([\d.,]+)\s*([a-zA-Z%µ/]+.*)?/);
  if (!match) return {};
  const amount = Number.parseFloat(match[1].replace(',', '.'));
  const unit = match[2]?.trim();
  return {
    amount: Number.isFinite(amount) ? amount : undefined,
    unit: unit || undefined,
  };
}

/**
 * Tipos de componente que NO son sustancia activa: se descartan. El resto se
 * incluye (denylist, no allowlist). Clave para vacunas/biológicos: SENASA
 * clasifica sus antígenos como "AGENTE ETIOLOGICO", no "PRINCIPIO ACTIVO" — un
 * allowlist de "PRINCIPIO ACTIVO" los perdía y dejaba la composición vacía
 * (ej. CDVAC FEEDLOT, reg 00-022). Descartar solo lo claramente inerte conserva
 * principios activos y agentes etiológicos por igual.
 */
const NON_ACTIVE_COMPONENT = [
  'EXCIPIENTE',
  'ADYUVANTE',
  'CONSERVANTE',
  'VEHICULO',
  'VEHÍCULO',
  'DILUYENTE',
  'SOLVENTE',
];

/**
 * Clasifica el producto por sus componentes: si incluye agentes etiológicos /
 * antígenos es una vacuna/biológico; si incluye principios activos, un
 * medicamento. SENASA no expone el tipo como campo, así que se infiere de acá.
 */
function deriveKind(
  componentes?: SenasaComponentePorProducto[] | null
): CatalogProductDetail['kind'] {
  const tipos = (componentes ?? []).map(
    (c) => c.componente?.tipoComponente?.nombre?.toUpperCase() ?? ''
  );
  if (tipos.some((t) => /AGENTE ETIOL|ANTIGENO|ANTÍGENO|CEPA|VACUNA/.test(t))) return 'vaccine';
  if (tipos.some((t) => t.includes('PRINCIPIO ACTIVO'))) return 'medication';
  return 'other';
}

/** Extrae la composición: sustancias activas (principios activos y antígenos). */
function mapComposition(componentes?: SenasaComponentePorProducto[] | null): CatalogComposition[] {
  if (!componentes?.length) return [];
  const result: CatalogComposition[] = [];
  for (const c of componentes) {
    const tipo = c.componente?.tipoComponente?.nombre?.toUpperCase() ?? '';
    const substance = c.componente?.nombre?.trim();
    if (!substance) continue;
    // Descartar solo componentes inertes (excipiente, adyuvante, etc.); todo lo
    // demás —incluidos los agentes etiológicos de las vacunas— es activo.
    if (tipo && NON_ACTIVE_COMPONENT.some((t) => tipo.includes(t))) continue;

    const rawStrength =
      c.cantidadCompleja !== null && c.cantidadCompleja !== undefined
        ? String(c.cantidadCompleja).trim()
        : undefined;
    result.push({
      substance,
      rawStrength: rawStrength || undefined,
      ...(rawStrength ? parseStrength(rawStrength) : {}),
    });
  }
  return result;
}

/** Listado → summary del índice. */
export function mapListItem(item: SenasaListItem): CatalogProductSummary {
  return {
    sourceId: String(item.id),
    registrationNumber: item.numeroInscripcion?.trim() ?? String(item.id),
    commercialName: item.nombreComercial?.trim() ?? '(sin nombre)',
    laboratory: item.nombreFirma?.trim() || undefined,
    source: SENASA_SOURCE_ID,
    country: SENASA_COUNTRY,
  };
}

/** Detalle → ficha completa normalizada. */
export function mapDetail(detail: SenasaDetail, sourceId: string): CatalogProductDetail {
  const firma = detail.productosFirmas?.[0];
  const presentationParts = dedupe([
    detail.tipoPresentacion?.descripcion,
    detail.envases?.[0]?.capacidadUsada !== null &&
    detail.envases?.[0]?.capacidadUsada !== undefined
      ? `${detail.envases[0].capacidadUsada} ml`
      : undefined,
  ]);

  return {
    sourceId,
    registrationNumber: detail.numeroInscripcion?.trim() ?? sourceId,
    commercialName: firma?.nombreComercial?.trim() ?? '(sin nombre)',
    laboratory: firma?.firma?.nombre?.trim() || undefined,
    laboratoryTaxId: firma?.firma?.cuit?.trim() || undefined,
    source: SENASA_SOURCE_ID,
    country: SENASA_COUNTRY,
    kind: deriveKind(detail.componentesPorProducto),
    composition: mapComposition(detail.componentesPorProducto),
    administrationRoutes: dedupe(
      (detail.productosFarmacoViaPorProducto ?? []).map((v) => v.farmacoVia?.viaAdministracion)
    ),
    species: dedupe((detail.productoEspecieCategoria ?? []).map((e) => e.especie?.descripcion)),
    indications: detail.indicacionesYVias?.trim() || undefined,
    presentation: presentationParts.join(' · ') || undefined,
    presentationType: detail.tipoPresentacion?.descripcion?.trim() || undefined,
    presentationSize:
      detail.envases?.[0]?.capacidadUsada !== null &&
      detail.envases?.[0]?.capacidadUsada !== undefined
        ? String(detail.envases[0].capacidadUsada)
        : undefined,
    classification: detail.tipoProducto?.descripcion?.trim() || undefined,
    status: mapStatus(detail.estadoProducto?.descripcion),
    statusLabel: detail.estadoProducto?.descripcion?.trim() || undefined,
  };
}
