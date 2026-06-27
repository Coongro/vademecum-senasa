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

/** Dígitos/signos a su superíndice Unicode, para exponentes que se VEN como tales. */
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
  '+': '⁺',
  '.': '·',
};

function toSuperscript(exp: string): string {
  return exp.replace(/[0-9.+-]/g, (c) => SUPERSCRIPT[c] ?? c);
}

/**
 * Normaliza el título/concentración crudo de SENASA a una notación científica
 * legible Y bien renderizada. La fuente mezcla formas para lo mismo: "1.58x10e5",
 * "5x10e5" y "1e8" significan todas N×10^M. Se unifica `x10e`/`x10^`/`e` y se
 * arma "N×10ᴹ" con el exponente en SUPERÍNDICE Unicode real (no "10^8" con
 * caret, que se ve crudo): "≥2.5e8" → "≥2.5×10⁸". Los `>=`/`<=` pasan a ≥/≤ y los
 * valores planos ("20", "0.05", "2048") quedan intactos. No es exhaustivo (la
 * fuente tiene rarezas como "10e8.3" → "10⁸·³"), pero limpia los casos comunes
 * sin perder información.
 */
export function normalizeTiter(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  s = s.replace(/>=/g, '≥').replace(/<=/g, '≤');
  // "1.58x10e5" / "5x10^5" / "1x10 e 6" → "1.58e5" / "5e5" / "1e6"
  s = s.replace(/x\s*10\s*\^?\s*e?/gi, 'e');
  // "NeM" → "N×10ᴹ" con el exponente en superíndice (M puede ser decimal o con signo)
  s = s.replace(
    /(\d(?:\.\d+)?)e([+-]?\d+(?:\.\d+)?)/gi,
    (_m, mantissa: string, exp: string) => `${mantissa}×10${toSuperscript(exp)}`
  );
  return s;
}

/**
 * Texto de indicaciones efectivo: `indicacionesYVias` salvo que sea vacío o
 * "NO APLICA" (común en biológicos), en cuyo caso cae a `observaciones`, donde
 * varios registros ponen la descripción real.
 */
function pickIndications(detail: SenasaDetail): string | undefined {
  const primary = detail.indicacionesYVias?.trim();
  if (primary && !/^no aplica$|^n\/?a$|^-+$/i.test(primary)) return primary;
  // Fallback a observaciones, sacándole el prefijo administrativo de expediente
  // en papel (ej. "EXP. PAPEL: 4029/1999\n…") que no es parte de la descripción.
  const obs = detail.observaciones?.trim().replace(/^EXP\.?\s*PAPEL:[^\r\n]*\r?\n/i, '');
  return obs?.trim() || undefined;
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

    // Se parsea cantidad/unidad del valor ORIGINAL, pero se guarda el título ya
    // normalizado para mostrar (ej. "1.58x10e5" → "1.58×10^5").
    const rawOriginal =
      c.cantidadCompleja !== null && c.cantidadCompleja !== undefined
        ? String(c.cantidadCompleja).trim()
        : undefined;
    result.push({
      substance,
      rawStrength: rawOriginal ? normalizeTiter(rawOriginal) : undefined,
      ...(rawOriginal ? parseStrength(rawOriginal) : {}),
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
    indications: pickIndications(detail),
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
